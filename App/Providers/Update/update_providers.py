#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
update_providers.py — Aggiorna baseUrl e URL immagini dei provider partendo da providers.json.

Come ricava l'indirizzo nuovo ("basandosi sulle fonti"):

  1. REDIRECT   segue la catena HTTP del baseUrl attuale e prende l'origin finale
                (es. cb01one.stream -> 301 -> cb01one.org).
  2. HUB        se il dominio non risponde (o è dietro Cloudflare) legge la pagina
                "hub" del provider e prende l'href del pulsante con l'indirizzo
                corrente: GuardaSerie -> https://guardaserie.foo/, dove il bottone
                <a class="btn btn-outline-success"> contiene guardoseries.autos.
                La tabella è HUB_PAGES in questo file, sovrascrivibile per provider
                con la chiave "hub" nel JSON (url, match, class_hint, label).
  3. FONTI      scarica le pagine elencate in "sourcePages" (guide "nuovo indirizzo",
                blog, elenchi) ed estrae i domini che contengono il brand del provider.
  4. CANDIDATI  prova la lista "candidates" scritta nel JSON.
  5. PERMUTE    (opzionale, --permute) prova il brand sugli altri TLD noti del giro
                (.best .autos .fun .cam .cyou .quest .rest .boo .club .fit .ac ...).
  6. VALIDAZIONE scarta domini parcheggiati / in vendita / pagine vuote / 404 e
                distingue la challenge Cloudflare (sito vivo ma bot-bloccato).

Per l'immagine: prova il logo attuale (template o URL assoluta), segue i redirect,
verifica che sia davvero un'immagine; se fallisce cerca <meta og:image>,
<link rel="icon"> e apple-touch-icon nella home, poi prova "logoPaths".

In GitHub Actions basta lanciarlo: con GITHUB_ACTIONS=true passa da solo in modalità
CI (step summary, output del job, annotazioni) e non fallisce se un provider resta
irrisolto, così il commit avviene comunque. Vedi update-providers.yml.

Uso tipico:
    python update_providers.py                       # aggiorna providers.json
    python update_providers.py --dry-run             # mostra solo il diff
    python update_providers.py --only CB01,GuardaSerie
    python update_providers.py --permute --workers 16
    python update_providers.py --patch-kotlin ./app/src/main/java/.../providers
    python update_providers.py --report report.json

Exit code: 0 tutto ok, 1 qualcosa non risolto, 2 errore d'uso/file.

Solo stdlib: nessun pip install.
"""

from __future__ import annotations

import argparse
import gzip
import json
import os
import re
import ssl
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import zlib
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from html.parser import HTMLParser

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

MAX_BYTES = 1_500_000
IMAGE_MIN_BYTES = 200
HTML_MIN_CHARS = 400

# Pagine che non sono il sito vero.
PARKED_MARKERS = (
    "domain is for sale",
    "this domain is for sale",
    "buy this domain",
    "make an offer on this domain",
    "domain may be for sale",
    "domain for sale",
    "questo dominio e in vendita",
    "dominio in vendita",
    "domain is parked",
    "parked domain",
    "parkingcrew",
    "sedoparking",
    "hugedomains",
    "afternic",
    "dan.com/buy-domain",
    "this domain has expired",
    "account suspended",
    "sito sospeso",
)

# Cloudflare / anti-bot: il sito c'e' ma non risponde a un client automatico.
CHALLENGE_MARKERS = (
    "just a moment",
    "cf-browser-verification",
    "cf_chl_opt",
    "challenge-platform",
    "attention required!",
    "checking your browser",
    "verifica del browser",
    "enable javascript and cookies to continue",
)

# TLD usati dal "giro" di questi siti quando cambiano indirizzo.
ROGUE_TLDS = (
    "com", "net", "org", "best", "autos", "fun", "cam", "cyou", "quest", "rest",
    "boo", "club", "fit", "ac", "xyz", "one", "stream", "online", "site", "top",
    "live", "watch", "vip", "icu", "buzz", "monster", "lol", "ink", "tv", "pro",
    "art", "shop", "store", "press", "world", "life", "space", "click", "link",
    "wiki", "cy", "su", "ws", "pw", "me", "in", "to", "is",
)

DEFAULT_TIMEOUT = 15
_print_lock = threading.Lock()


def log(msg: str) -> None:
    with _print_lock:
        print(msg, flush=True)


# --------------------------------------------------------------------------- #
# HTTP minimale (redirect seguiti a mano per avere la catena completa)
# --------------------------------------------------------------------------- #

_SSL_STRICT = ssl.create_default_context()
_SSL_LAX = ssl.create_default_context()
_SSL_LAX.check_hostname = False
_SSL_LAX.verify_mode = ssl.CERT_NONE


class Response:
    __slots__ = ("url", "final_url", "status", "headers", "body", "chain", "error")

    def __init__(self):
        self.url = ""
        self.final_url = ""
        self.status = 0
        self.headers = {}
        self.body = b""
        self.chain: list[str] = []
        self.error = ""

    @property
    def content_type(self) -> str:
        return (self.headers.get("content-type") or "").lower()

    @property
    def text(self) -> str:
        return decode_body(self.body, self.headers.get("content-type", ""))

    @property
    def ok(self) -> bool:
        return 200 <= self.status < 300 and not self.error


def decode_body(body: bytes, content_type: str) -> str:
    m = re.search(r"charset=([\w-]+)", content_type or "", re.I)
    enc = m.group(1) if m else "utf-8"
    for candidate in (enc, "utf-8", "latin-1"):
        try:
            return body.decode(candidate, errors="replace")
        except (LookupError, UnicodeDecodeError):
            continue
    return body.decode("utf-8", errors="replace")


def _decompress(body: bytes, encoding: str) -> bytes:
    encoding = (encoding or "").lower()
    try:
        if "gzip" in encoding:
            return gzip.decompress(body)
        if "deflate" in encoding:
            try:
                return zlib.decompress(body)
            except zlib.error:
                return zlib.decompress(body, -zlib.MAX_WBITS)
    except (OSError, zlib.error):
        return body
    return body


def http_get(url: str, timeout: int = DEFAULT_TIMEOUT, max_redirects: int = 8,
             insecure: bool = False) -> Response:
    """GET con redirect seguiti a mano: restituisce anche la catena degli hop."""
    res = Response()
    res.url = url
    current = url
    opener_ctx = _SSL_LAX if insecure else _SSL_STRICT
    seen = set()

    for _hop in range(max_redirects + 1):
        if current in seen:
            res.error = "redirect loop"
            break
        seen.add(current)

        req = urllib.request.Request(
            current,
            headers={
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml,image/avif,image/webp,image/*,*/*;q=0.8",
                "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
                "Accept-Encoding": "gzip, deflate",
                "Cache-Control": "no-cache",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=opener_ctx) as resp:
                res.status = resp.status
                res.headers = {k.lower(): v for k, v in resp.headers.items()}
                res.final_url = resp.geturl()
                res.body = _decompress(resp.read(MAX_BYTES), res.headers.get("content-encoding", ""))
                res.chain.append(f"{res.status} {current}")
                return res

        except urllib.error.HTTPError as exc:
            # 3xx non seguito da urlopen, 403/404/503 con pagina: leggiamo tutto.
            location = exc.headers.get("Location") if exc.headers else None
            res.status = exc.code
            res.headers = {k.lower(): v for k, v in (exc.headers or {}).items()}
            res.final_url = exc.geturl() or current
            res.chain.append(f"{exc.code} {current}")
            if exc.code in (301, 302, 303, 307, 308) and location:
                current = urllib.parse.urljoin(current, location)
                continue
            try:
                res.body = _decompress(exc.read(MAX_BYTES), res.headers.get("content-encoding", ""))
            except Exception:  # noqa: BLE001 - corpo opzionale
                res.body = b""
            return res

        except ssl.SSLError as exc:
            if not insecure:
                log(f"    ! certificato non valido su {current}: {exc} -> riprovo senza verifica")
                return http_get(url, timeout, max_redirects, insecure=True)
            res.error = f"ssl: {exc}"
            return res

        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            res.error = str(getattr(exc, "reason", exc))
            return res

    if not res.error:
        res.error = f"troppi redirect (>{max_redirects})"
    return res


# --------------------------------------------------------------------------- #
# Utilità URL / validazione
# --------------------------------------------------------------------------- #

def normalize_origin(url: str, keep_path: bool = False) -> str:
    """https://host.tld/qualcosa?x=1 -> https://host.tld

    Il baseUrl dei provider è un origin (nel codice Kotlin viene concatenato con
    path e slug), quindi di default il path viene scartato: tenerlo romperebbe
    l'idempotenza (es. un redirect verso /home verrebbe poi richiesto come /home).
    """
    if not url:
        return ""
    if "://" not in url:
        url = "https://" + url.lstrip("/")
    parts = urllib.parse.urlsplit(url)
    host = (parts.hostname or "").lower()
    if not host:
        return ""
    netloc = host if parts.port in (None, 80, 443) else f"{host}:{parts.port}"
    path = ""
    if keep_path:
        path = parts.path or ""
        if path in ("", "/"):
            path = ""
        elif not path.endswith("/"):
            path += "/"
    return urllib.parse.urlunsplit((parts.scheme or "https", netloc, path, "", ""))


def host_of(url: str) -> str:
    return (urllib.parse.urlsplit(url if "://" in url else "https://" + url).hostname or "").lower()


def registrable(host: str) -> str:
    """cb01one.org -> cb01one ; www.animeworld.ac -> animeworld."""
    host = host.lower().removeprefix("www.")
    parts = host.split(".")
    return parts[0] if len(parts) >= 2 else host


def brand_regex(entry: dict, name: str) -> re.Pattern:
    """Regex che riconosce il brand nel dominio. Meglio dichiararla in 'match'.

    Default: le prime 6 lettere del nome senza cifre/trattini, così
    "guardaserie" prende anche "guardoseries" e "eurostreaming" anche "eurostream".
    """
    pat = entry.get("match")
    if not pat:
        stem = re.sub(r"[^a-z]", "", name.lower())
        pat = re.escape(stem[:6] or name.lower())
    try:
        return re.compile(pat, re.I)
    except re.error:
        return re.compile(re.escape(name), re.I)


def looks_parked(text: str) -> bool:
    low = text.lower()
    return any(marker in low for marker in PARKED_MARKERS)


def looks_challenge(res: Response) -> bool:
    if res.status in (403, 429, 503) and not res.body:
        return True
    low = res.text[:6000].lower()
    return any(marker in low for marker in CHALLENGE_MARKERS)


def validate_site(res: Response, brand: re.Pattern) -> tuple[str, str]:
    """-> (stato, motivo). stati: ok | challenge | parked | dead"""
    if res.error:
        return "dead", res.error
    if res.status == 404 or res.status == 410:
        return "dead", f"HTTP {res.status}"
    if looks_challenge(res):
        return "challenge", f"Cloudflare/anti-bot (HTTP {res.status})"
    text = res.text
    if res.content_type and "html" not in res.content_type and "text" not in res.content_type:
        return "dead", f"content-type inatteso: {res.content_type}"
    if len(text) < HTML_MIN_CHARS:
        return "dead", f"pagina vuota/quasi ({len(text)} char, HTTP {res.status})"
    if looks_parked(text):
        return "parked", "dominio parcheggiato/in vendita"
    if res.status >= 400:
        return "dead", f"HTTP {res.status}"
    if not brand.search(res.final_url or ""):
        return "dead", f"dominio fuori brand: {host_of(res.final_url)}"
    return "ok", f"HTTP {res.status}"


def extract_domains(html: str, brand: re.Pattern) -> list[str]:
    """Estrae candidati dominio da una pagina-fonte (guida, blog, elenco)."""
    found: list[str] = []
    for raw in re.findall(r"(?:https?://)?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24})", html, re.I):
        host = raw.lower().removeprefix("www.")
        if brand.search(host) and host not in found:
            found.append(host)
    return found


# Pagine "hub": il sito ufficiale non risponde, ma un dominio di atterraggio pubblica
# il pulsante con l'indirizzo valido. Si legge l'href di quel pulsante.
# Si può sovrascrivere per provider nel JSON con la chiave "hub": {...}.
HUB_PAGES: dict[str, dict] = {
    "GuardaSerie": {
        "url": "https://guardaserie.foo/",
        "match": r"guard(a|o)series",
        # classi del <a> che contiene l'indirizzo corrente (btn btn-outline-success ...)
        "class_hint": "btn-outline-success",
        # testo dentro l'<a>, utile se le classi cambiano
        "label": "guardaserie",
    },
}


# Immagine "vera" del provider: ha la precedenza sul template del JSON.
# Serve quando nel JSON c'è un path che risponde 200 ma non è il logo mostrato
# dall'app (Eurostreaming: logo_upt.png è vecchio, l'app usa favicon18.jpg).
# Scrivendo qui il path, il campo "logo" del JSON viene riallineato a ogni run.
LOGO_OVERRIDES: dict[str, str] = {
    "Eurostreaming": "{base}/wp-content/uploads/2018/09/favicon18.jpg",
}


def logo_override(name: str, entry: dict) -> str:
    """Override dal JSON ("logoOverride") oppure dalla tabella LOGO_OVERRIDES."""
    own = entry.get("logoOverride")
    if isinstance(own, str) and own:
        return own
    return LOGO_OVERRIDES.get(name, "")


class _AnchorParser(HTMLParser):
    """Raccoglie gli <a href> con classi e testo interno (anche con svg/h1 dentro)."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.anchors: list[dict] = []
        self._cur: dict | None = None
        self._buf: list[str] = []

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag.lower() == "a":
            d = {k.lower(): (v or "") for k, v in attrs}
            self._cur = {"href": d.get("href", ""), "class": d.get("class", ""),
                         "id": d.get("id", ""), "title": d.get("title", "")}
            self._buf = []

    def handle_data(self, data: str) -> None:
        if self._cur is not None:
            self._buf.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._cur is not None:
            self._cur["text"] = " ".join("".join(self._buf).split())
            self.anchors.append(self._cur)
            self._cur = None


def hub_config(name: str, entry: dict) -> dict | None:
    """Hub del provider: dal JSON ("hub") oppure dalla tabella HUB_PAGES."""
    hub = entry.get("hub")
    if isinstance(hub, dict) and hub.get("url"):
        return hub
    if isinstance(hub, str) and hub:
        return {"url": hub}
    return HUB_PAGES.get(name)


def domains_from_hub(html: str, page_url: str, hub: dict, brand: re.Pattern) -> list[str]:
    """Host citati dal pulsante della pagina hub, i più probabili per primi.

    Priorità: <a> con la classe del bottone (4 pt) e/o il testo del brand (2 pt).
    Se non c'è nessun <a> utile, ricade sui domini presenti nel testo della pagina.
    """
    parser = _AnchorParser()
    try:
        parser.feed(html)
    except Exception:  # noqa: BLE001 - HTML rotto: si passa al fallback testuale
        pass

    hint = (hub.get("class_hint") or "").lower()
    label = (hub.get("label") or "").lower()
    hub_host = host_of(page_url)
    ranked: list[tuple[int, str]] = []

    for a in parser.anchors:
        href = (a.get("href") or "").strip()
        if not href or href.startswith(("#", "mailto:", "javascript:", "tel:")):
            continue
        url = urllib.parse.urljoin(page_url, href)
        host = host_of(url)
        if not host or host == hub_host or not brand.search(host):
            continue
        netloc = urllib.parse.urlsplit(url).netloc.lower().removeprefix("www.")
        score = 0
        classes = (a.get("class") or "").lower()
        text = " ".join((a.get("text") or "", a.get("title") or "", a.get("id") or "")).lower()
        if hint and hint in classes:
            score += 4
        if label and label in text:
            score += 2
        ranked.append((score, netloc))

    ranked.sort(key=lambda t: -t[0])
    out: list[str] = []
    for _score, netloc in ranked:
        if netloc not in out:
            out.append(netloc)

    if not out:  # pagina senza bottoni utili: cerco i domini nel testo
        out = extract_domains(html, brand)
        out = [h for h in out if h != hub_host]
    return out


def extract_image_from_html(html: str, page_url: str) -> str | None:
    patterns = (
        r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
        r'<link[^>]+rel=["\']apple-touch-icon[^>]*["\'][^>]+href=["\']([^"\']+)',
        r'<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\']apple-touch-icon',
        r'<link[^>]+rel=["\'][^"\']*icon[^"\']*["\'][^>]+href=["\']([^"\']+)',
    )
    for pat in patterns:
        m = re.search(pat, html, re.I)
        if m:
            return urllib.parse.urljoin(page_url, m.group(1).strip())
    return None


def validate_image(res: Response) -> tuple[bool, str]:
    if res.error:
        return False, res.error
    if res.status >= 400:
        return False, f"HTTP {res.status}"
    if not res.content_type.startswith("image/"):
        if "html" in res.content_type:
            return False, "risposta HTML, non immagine"
        return False, f"content-type {res.content_type or 'assente'}"
    if len(res.body) < IMAGE_MIN_BYTES:
        return False, f"immagine troppo piccola ({len(res.body)} B)"
    return True, f"{res.content_type}, {len(res.body) // 1024} KB"


# --------------------------------------------------------------------------- #
# Risoluzione di un provider
# --------------------------------------------------------------------------- #

def tld_permutations(entry: dict, brand: re.Pattern, limit: int | None) -> list[str]:
    current = host_of(entry.get("baseUrl", ""))
    stem = registrable(current) or re.sub(r"[^a-z0-9-]", "", entry.get("_name", "").lower())
    stem = stem.replace("www.", "")
    out: list[str] = []
    for tld in ROGUE_TLDS:
        cand = f"{stem}.{tld}"
        if cand != current and cand not in out:
            out.append(cand)
    return out[:limit] if limit else out


def try_candidates(cands: list[str], brand: re.Pattern, timeout: int, insecure: bool,
                   verbose: bool, scheme: str = "https") -> tuple[str, str, str]:
    """-> (baseUrl, stato, nota). Si ferma al primo valido."""
    challenge_hit = ""
    for host in cands:
        url = host if "://" in host else f"{scheme}://{host}"
        res = http_get(url, timeout=timeout, insecure=insecure)
        state, why = validate_site(res, brand)
        if verbose:
            log(f"      prova {url:45s} -> {state} ({why})")
        if state == "ok":
            return normalize_origin(res.final_url or url), "ok", f"trovato via {host} ({why})"
        if state == "challenge" and not challenge_hit:
            challenge_hit = normalize_origin(res.final_url or url)
    if challenge_hit:
        return challenge_hit, "challenge", "solo challenge Cloudflare: probabile sito vivo"
    return "", "unresolved", "nessun candidato valido"


def probe_hub(hub: dict | None, brand: re.Pattern, opts: argparse.Namespace) -> list[str]:
    """Legge la pagina hub e restituisce i netloc del pulsante con l'indirizzo corrente."""
    if not hub:
        return []
    hres = http_get(hub["url"], timeout=opts.timeout, insecure=opts.insecure)
    if not (hres.ok and "html" in (hres.content_type or "html")):
        log(f"  hub {hub['url']} -> non leggibile ({hres.status or hres.error})")
        return []
    found = domains_from_hub(hres.text, hres.final_url or hub["url"], hub, brand)
    if found:
        log(f"  hub {hub['url']} -> {', '.join(found[:5])}")
    else:
        log(f"  hub {hub['url']} -> nessun link al brand trovato nella pagina")
    return found


def resolve_provider(name: str, entry: dict, opts: argparse.Namespace) -> dict:
    hub = hub_config(name, entry)
    brand_src = dict(entry)
    if hub and hub.get("match") and not entry.get("match"):
        brand_src["match"] = hub["match"]
    brand = brand_regex(brand_src, name)
    entry["_name"] = name
    old_base = entry.get("baseUrl", "")
    started = time.time()
    result = {
        "name": name,
        "oldBaseUrl": old_base,
        "baseUrl": old_base,
        "changed": False,
        "status": "unresolved",
        "note": "",
        "logoUrl": entry.get("logoUrl", ""),
        "logoStatus": "kept",
        "logoSources": [],
    }

    log(f"\n[{name}] {old_base}")
    res = http_get(old_base, timeout=opts.timeout, insecure=opts.insecure)
    state, why = validate_site(res, brand)
    log(f"  redirect: {' -> '.join(res.chain) or 'nessun hop'} | {state} ({why})")

    if state == "ok":
        result["baseUrl"] = normalize_origin(res.final_url or old_base)
        result["status"] = "ok"
        result["note"] = why
    elif state == "challenge":
        # Sito vivo ma protetto: seguo il redirect se il brand combacia, altrimenti tengo.
        final = normalize_origin(res.final_url or old_base)
        if final and brand.search(host_of(final)):
            result["baseUrl"] = final
        result["status"] = "challenge"
        result["note"] = "Cloudflare: dominio mantenuto (verifica a mano se cambia)"
        # Il vecchio dominio può essere dietro Cloudflare proprio perché è stato bloccato:
        # se il hub pubblica un indirizzo diverso e funzionante, quello è il buono.
        hosts = probe_hub(hub, brand, opts)
        if hosts:
            cand, st, why = try_candidates(
                hosts, brand, opts.timeout, opts.insecure, opts.verbose,
                scheme=urllib.parse.urlsplit(old_base if "://" in old_base else "https://" + old_base).scheme or "https",
            )
            if cand and st == "ok" and normalize_origin(cand) != normalize_origin(old_base):
                result["baseUrl"] = cand
                result["status"] = "ok"
                result["note"] = f"dominio cambiato via hub ({why}); il vecchio è dietro Cloudflare"
    else:
        # 0. pagina hub: il pulsante con l'indirizzo corrente
        candidates: list[str] = list(probe_hub(hub, brand, opts))
        # 1. pagine-fonte
        for page in entry.get("sourcePages", []) or []:
            pres = http_get(page, timeout=opts.timeout, insecure=opts.insecure)
            if pres.ok and "html" in (pres.content_type or "html"):
                found = extract_domains(pres.text, brand)
                if found:
                    log(f"  fonte {page} -> {', '.join(found[:5])}")
                    candidates.extend(found)
            elif opts.verbose:
                log(f"  fonte {page} -> non leggibile ({pres.status or pres.error})")
        # 2. candidati dichiarati
        candidates.extend(entry.get("candidates", []) or [])
        # 3. permutazioni TLD
        if opts.permute:
            candidates.extend(tld_permutations(entry, brand, opts.max_permutations))
        seen, ordered = set(), []
        for c in candidates:
            c = c.lower().removeprefix("www.")
            if c and c not in seen and c != host_of(old_base):
                seen.add(c)
                ordered.append(c)
        if ordered:
            log(f"  provo {len(ordered)} candidati")
            new_base, st, note = try_candidates(
                ordered, brand, opts.timeout, opts.insecure, opts.verbose,
                scheme=urllib.parse.urlsplit(old_base if "://" in old_base else "https://" + old_base).scheme or "https",
            )
            if new_base:
                result["baseUrl"] = new_base
                result["status"] = st
                result["note"] = note
            else:
                result["note"] = "baseUrl non risolto: aggiorna 'candidates' o 'sourcePages'"
        else:
            result["note"] = "baseUrl morto e nessun candidato da provare"

    result["changed"] = result["baseUrl"].rstrip("/") != old_base.rstrip("/")

    # ---------------- logo ----------------
    result.update(resolve_logo(name, entry, result["baseUrl"], opts))
    result["elapsed"] = round(time.time() - started, 1)
    entry.pop("_name", None)
    return result


def logo_candidates(entry: dict, base: str, name: str = "") -> list[str]:
    """URL immagine da provare, in ordine di priorità."""
    cands: list[str] = []
    override = logo_override(name, entry) if name else ""
    if override:
        cands.append(override.replace("{base}", base.rstrip("/")))
    tmpl = entry.get("logo") or entry.get("logoUrl") or ""
    if tmpl:
        cands.append(tmpl.replace("{base}", base.rstrip("/")))
    for path in entry.get("logoPaths", []) or []:
        cands.append(path if path.startswith("http") else base.rstrip("/") + "/" + path.lstrip("/"))
    # ultima spiaggia: path noti
    for path in ("/apple-touch-icon.png", "/apple-icon-180x180px.png", "/favicon.ico"):
        cands.append(base.rstrip("/") + path)
    out, seen = [], set()
    for c in cands:
        if c and c not in seen:
            seen.add(c)
            out.append(c)
    return out


def resolve_logo(name: str, entry: dict, base: str, opts: argparse.Namespace) -> dict:
    old_logo = entry.get("logoUrl", "")
    for url in logo_candidates(entry, base, name):
        r = http_get(url, timeout=opts.timeout, insecure=opts.insecure)
        good, why = validate_image(r)
        if good:
            final = r.final_url or url
            if opts.verbose:
                log(f"  logo ok: {final} ({why})")
            return {"logoUrl": final, "logoStatus": "ok" if final == old_logo else "updated",
                    "logoNote": why}
        if opts.verbose:
            log(f"  logo no: {url} ({why})")
        # se la home risponde HTML, prova a pescarne og:image / icon
        if "html" in (r.content_type or "") and r.status < 400:
            guessed = extract_image_from_html(r.text, r.final_url or url)
            if guessed and guessed != url:
                r2 = http_get(guessed, timeout=opts.timeout, insecure=opts.insecure)
                good2, why2 = validate_image(r2)
                if good2:
                    log(f"  logo da meta tag: {guessed} ({why2})")
                    return {"logoUrl": guessed, "logoStatus": "updated", "logoNote": "da meta/icon"}
    return {"logoUrl": old_logo, "logoStatus": "unresolved",
            "logoNote": "immagine non trovata: aggiungi logoPaths nel JSON"}


# --------------------------------------------------------------------------- #
# Patch dei provider Kotlin (opzionale)
# --------------------------------------------------------------------------- #

KT_BASE_RE = re.compile(r'(override\s+val\s+baseUrl\s*(?::\s*String)?\s*=\s*)("(?:[^"\\]|\\.)*"|\$?URL)')
KT_LOGO_RE = re.compile(
    r'(override\s+val\s+logo\s*(?::\s*String)?\s*(?:get\(\)\s*=\s*)?=\s*)("(?:[^"\\]|\\.)*")'
)


def patch_kotlin(directory: str, results: dict[str, dict], dry_run: bool) -> list[str]:
    """Riscrive baseUrl/logo letterali nei file *Provider.kt. Ritorna il log delle modifiche."""
    changes: list[str] = []
    if not os.path.isdir(directory):
        return [f"cartella non trovata: {directory}"]
    for fname in sorted(os.listdir(directory)):
        if not fname.endswith("Provider.kt"):
            continue
        stem = fname[: -len("Provider.kt")].lower()
        match = next((n for n in results if n.lower() == stem), None)
        if not match:
            continue
        path = os.path.join(directory, fname)
        with open(path, "r", encoding="utf-8", newline="") as fh:
            src = fh.read()
        orig = src
        info = results[match]
        new_base = info.get("baseUrl", "")
        new_logo = info.get("logoUrl", "")

        if new_base and info.get("changed"):
            # conserva la convenzione sullo slash finale del letterale originale
            m0 = KT_BASE_RE.search(src)
            trailing = bool(m0 and m0.group(2).endswith('/"'))
            literal = new_base.rstrip("/") + ("/" if trailing else "")
            src = KT_BASE_RE.sub(lambda m: m.group(1) + json.dumps(literal), src, count=1)
            changes.append(f"{fname}: baseUrl -> {literal}")
        if new_logo and info.get("logoStatus") in ("ok", "updated"):
            def _logo(m: re.Match) -> str:
                body = m.group(2)
                # se il logo è derivato da $baseUrl lo lasciamo derivato
                return m.group(0) if "$baseUrl" in body or "$DEFAULT_DOMAIN" in body else m.group(1) + json.dumps(new_logo)
            new_src = KT_LOGO_RE.sub(_logo, src, count=1)
            if new_src != src:
                changes.append(f"{fname}: logo -> {new_logo}")
            src = new_src

        if src != orig:
            if dry_run:
                changes.append(f"{fname}: (dry-run, non scritto)")
            else:
                tmp = path + ".tmp"
                with open(tmp, "w", encoding="utf-8", newline="") as fh:
                    fh.write(src)
                os.replace(tmp, path)
    return changes


# --------------------------------------------------------------------------- #
# Integrazione GitHub Actions
# --------------------------------------------------------------------------- #

def is_github_actions() -> bool:
    """Letto a ogni chiamata: l'env può essere impostato dopo l'import (nei test)."""
    return os.environ.get("GITHUB_ACTIONS", "").lower() == "true"


def gh_output(**kv: object) -> None:
    """Scrive gli output del job (step outputs) in $GITHUB_OUTPUT."""
    path = os.environ.get("GITHUB_OUTPUT")
    if not path:
        return
    with open(path, "a", encoding="utf-8") as fh:
        for key, value in kv.items():
            fh.write(f"{key}={value}\n")


def gh_summary(markdown: str) -> None:
    """Aggiunge un blocco markdown alla pagina di riepilogo del run."""
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(markdown.rstrip() + "\n")


def gh_annotation(level: str, message: str, title: str = "", file: str = "") -> None:
    """Annotazione nella UI del run: level = warning | error | notice."""
    parts = []
    if file:
        parts.append(f"file={file}")
    if title:
        parts.append(f"title={title}")
    meta = (" " + ",".join(parts)) if parts else ""
    print(f"::{level}{meta}::{message}", flush=True)


def build_summary(results: dict, changed: list, updated_logos: int, stamp: str) -> str:
    rows = [
        "## Provider aggiornati",
        "",
        f"Controllo del `{stamp}` — **{len(changed)}** baseUrl cambiati, "
        f"**{updated_logos}** immagini aggiornate su {len(results)} provider.",
        "",
        "| Provider | Stato | baseUrl | Immagine |",
        "| --- | --- | --- | --- |",
    ]
    icon = {"ok": "ok", "challenge": "da verificare", "unresolved": "non risolto", "error": "errore"}
    for r in sorted(results.values(), key=lambda x: x["name"]):
        base = r["baseUrl"]
        if r.get("changed"):
            base = f"{base} (prima: {r['oldBaseUrl']})"
        logo = r.get("logoUrl", "") or "—"
        if r.get("logoStatus") not in ("ok", "updated"):
            logo = f"{logo} (non verificata)"
        rows.append(f"| {r['name']} | {icon.get(r['status'], r['status'])} | {base} | {logo} |")
    bad = [r for r in results.values() if r["status"] in ("unresolved", "error", "challenge")]
    if bad:
        rows += ["", "### Da controllare a mano", ""]
        rows += [f"- **{r['name']}**: {r.get('note', '')}" for r in bad]
    return "\n".join(rows)


def load_providers(path: str) -> tuple[dict, dict]:
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    if "providers" in data and isinstance(data["providers"], dict):
        return data, data["providers"]
    return data, data


def save_json(path: str, data: dict) -> None:
    parent = os.path.dirname(os.path.abspath(path))
    os.makedirs(parent, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=parent or ".", suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    os.replace(tmp, path)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description="Aggiorna baseUrl e URL immagini dei provider.",
        epilog="Il JSON in uscita contiene solo baseUrl, logo e logoUrl; i diagnostici "
               "vanno in stdout o nel file indicato da --report (--with-status li scrive "
               "anche nel JSON).",
    )
    ap.add_argument("-f", "--file", default="providers.json", help="file JSON da aggiornare")
    ap.add_argument("--only", default="", help="solo questi provider, separati da virgola")
    ap.add_argument("--dry-run", action="store_true", help="non scrive nulla, mostra il diff")
    ap.add_argument("--permute", action="store_true", help="prova anche le permutazioni di TLD")
    ap.add_argument("--max-permutations", type=int, default=14, help="quante permutazioni per provider")
    ap.add_argument("--workers", type=int, default=8, help="richieste parallele")
    ap.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="timeout per richiesta (s)")
    ap.add_argument("--insecure", action="store_true", help="non verificare i certificati TLS")
    ap.add_argument("--patch-kotlin", default="", metavar="DIR", help="aggiorna anche i *Provider.kt")
    ap.add_argument("--report", default="", metavar="FILE", help="scrive un report JSON")
    ap.add_argument("--with-status", action="store_true",
                    help="scrive anche _status/_note/_lastCheck/_meta nel JSON "
                         "(di default restano solo baseUrl, logo, logoUrl)")
    ap.add_argument("--ci", action="store_true",
                    help="modalità GitHub Actions: step summary, output del job e "
                         "annotazioni (auto-attiva se GITHUB_ACTIONS=true)")
    ap.add_argument("--fail-on-unresolved", action="store_true",
                    help="esce con 1 se qualche provider resta irrisolto (in CI il default è 0, "
                         "così il commit avviene comunque)")
    ap.add_argument("-v", "--verbose", action="store_true")
    opts = ap.parse_args(argv)

    if not os.path.isfile(opts.file):
        print(f"File non trovato: {opts.file}", file=sys.stderr)
        return 2

    data, providers = load_providers(opts.file)
    only = {s.strip().lower() for s in opts.only.split(",") if s.strip()}
    targets = {n: e for n, e in providers.items() if not only or n.lower() in only}
    if not targets:
        print("Nessun provider da aggiornare.", file=sys.stderr)
        return 2

    log(f"Aggiorno {len(targets)} provider da {opts.file} "
        f"(permute={'on' if opts.permute else 'off'}, workers={opts.workers})")

    results: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=max(1, opts.workers)) as pool:
        futures = {pool.submit(resolve_provider, n, dict(e), opts): n for n, e in targets.items()}
        for fut in as_completed(futures):
            name = futures[fut]
            try:
                results[name] = fut.result()
            except Exception as exc:  # noqa: BLE001 - un provider non deve fermare gli altri
                results[name] = {"name": name, "oldBaseUrl": providers[name].get("baseUrl", ""),
                                 "baseUrl": providers[name].get("baseUrl", ""), "changed": False,
                                 "status": "error", "note": f"{type(exc).__name__}: {exc}",
                                 "logoUrl": providers[name].get("logoUrl", ""), "logoStatus": "kept"}

    # applica al JSON (ordine originale preservato)
    for name, entry in providers.items():
        r = results.get(name)
        if not r:
            continue
        entry["baseUrl"] = r["baseUrl"]
        if r.get("logoUrl"):
            entry["logoUrl"] = r["logoUrl"]
        override = logo_override(name, entry)
        if override:
            # il template nel JSON deve descrivere la stessa immagine di logoUrl
            entry["logo"] = override
        if opts.with_status:
            if r["status"] == "ok":
                entry.pop("_status", None)
                entry.pop("_note", None)
            else:
                entry["_status"] = r["status"]
                entry["_note"] = r.get("note", "")
            entry["_lastCheck"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        else:
            # schema minimo: via i diagnostici rimasti da run precedenti
            for k in ("_status", "_note", "_lastCheck"):
                entry.pop(k, None)

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    if opts.with_status:
        if "providers" in data:
            data.setdefault("_meta", {})["updatedAt"] = stamp
        else:
            data["_meta"] = {"updatedAt": stamp, "schema": 2}
    else:
        data.pop("_meta", None)

    # riepilogo
    log("\n" + "=" * 78)
    changed = [r for r in results.values() if r.get("changed")]
    for r in sorted(results.values(), key=lambda x: x["name"]):
        flag = "CAMBIA" if r.get("changed") else "      "
        log(f"{flag} {r['name']:20s} {r['status']:11s} {r['baseUrl']}")
        if r.get("changed"):
            log(f"         prima: {r['oldBaseUrl']}")
        log(f"         logo [{r.get('logoStatus')}]: {r.get('logoUrl', '')}")
        if r.get("note") and r["status"] != "ok":
            log(f"         nota: {r['note']}")
    log("=" * 78)
    log(f"{len(changed)} baseUrl cambiati, {sum(1 for r in results.values() if r.get('logoStatus') == 'updated')} immagini aggiornate")

    written = False
    if opts.dry_run:
        log("\n--dry-run: JSON non scritto.")
    else:
        save_json(opts.file, data)
        written = True
        log(f"\nScritto {opts.file}")

    if opts.patch_kotlin:
        log("\nPatch provider Kotlin:")
        for line in patch_kotlin(opts.patch_kotlin, results, opts.dry_run) or ["nessuna modifica necessaria"]:
            log("  " + line)

    if opts.report:
        save_json(opts.report, {"generatedAt": stamp, "providers": results})
        log(f"Report scritto in {opts.report}")

    bad = [r for r in results.values() if r["status"] in ("unresolved", "error")]
    updated_logos = sum(1 for r in results.values() if r.get("logoStatus") == "updated")

    # ------------------------- GitHub Actions -------------------------
    ci = opts.ci or is_github_actions()
    if ci:
        gh_output(
            changed="true" if changed else "false",
            changed_count=len(changed),
            updated_logos=updated_logos,
            unresolved=",".join(r["name"] for r in bad),
            checked=len(results),
            written="true" if written else "false",
            timestamp=stamp,
        )
        gh_summary(build_summary(results, changed, updated_logos, stamp))
        for r in bad:
            gh_annotation("warning", f"{r['name']}: {r.get('note', 'non risolto')}",
                          title="Provider non risolto", file=opts.file)
        for r in changed:
            gh_annotation("notice", f"{r['name']}: {r['oldBaseUrl']} -> {r['baseUrl']}",
                          title="baseUrl aggiornato", file=opts.file)
        if bad:
            log(f"\n{len(bad)} provider da verificare (il job non fallisce: "
                f"usa --fail-on-unresolved per renderlo bloccante)")

    if bad:
        log(f"\nDa controllare a mano: {', '.join(r['name'] for r in bad)}")
        strict = opts.fail_on_unresolved or not ci
        return 1 if strict else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
