/* ================== VARIABILI GLOBALI ================== */
let mobilePlayer = null;
let currentMobileItem = null;
let currentStreamData = null;

let availableQualities = [];
let availableAudioTracks = [];
let availableSubtitles = [];

let cleanupFunctions = [];
let requestHookInstalled = false;

/* ================== INIT GLOBALE (UNA SOLA VOLTA) ================== */
function initGlobalVhsHook() {
    if (typeof videojs === "undefined" || !videojs.Vhs) return;
    if (requestHookInstalled) return;

    videojs.Vhs.xhr.onRequest(xhrRequestHook);
    requestHookInstalled = true;

    console.log("✅ VHS XHR hook installato");
}

/* ================== APERTURA PLAYER ================== */
async function openMobilePlayer(item) {
    currentMobileItem = item;

    showMobileSection('mobile-player');
    document.getElementById('mobile-player-title').textContent =
        item.title || item.name || '';

    hideAdditionalControls();

    const mediaType = item.media_type || (item.title ? 'movie' : 'tv');

    try {
        const details = await fetchTMDB(`${mediaType}/${item.id}`);

        const meta = [];
        if (details.release_date || details.first_air_date) {
            meta.push(new Date(details.release_date || details.first_air_date).getFullYear());
        }
        if (details.vote_average) {
            meta.push(`⭐ ${details.vote_average.toFixed(1)}`);
        }

        document.getElementById('mobile-player-meta').textContent = meta.join(' • ');
        document.getElementById('mobile-player-overview').textContent =
            details.overview || "Nessuna descrizione disponibile.";

        if (mediaType === 'tv') {
            document.getElementById('mobile-episode-selector').style.display = 'block';
            await loadTVSeasonsMobile(item.id);
        } else {
            playItemMobile(item.id, 'movie');
        }

    } catch (e) {
        console.error(e);
        showMobileError("Errore caricamento contenuto");
    }
}

/* ================== PLAY ================== */
async function playItemMobile(id, type, season = null, episode = null) {
    showMobileLoading(true, "Preparazione video...");

    try {
        // distrugge SOLO il player (mai il video element)
        if (mobilePlayer) {
            mobilePlayer.dispose();
            mobilePlayer = null;
        }

        const stream = await getDirectStreamMobile(
            id,
            type === 'movie',
            season,
            episode
        );

        if (!stream?.m3u8Url) {
            throw new Error("Stream non disponibile");
        }

        currentStreamData = stream;

        const src = applyCorsProxy(stream.m3u8Url);

        mobilePlayer = videojs('mobile-player-video', {
            controls: true,
            fluid: true,
            aspectRatio: "16:9",
            preload: 'auto',
            playbackRates: [0.5, 1, 1.25, 1.5, 2],
            html5: {
                vhs: {
                    overrideNative: true,
                    withCredentials: false
                }
            }
        });

        mobilePlayer.src({
            src: src,
            type: 'application/x-mpegURL'
        });

        mobilePlayer.ready(() => {
            showMobileLoading(false);

            setTimeout(() => {
                extractAvailableQualities();
                extractAudioTracks();
                extractSubtitles();
                showAdditionalControls();
            }, 800);

            mobilePlayer.play().catch(() => {});
        });

        mobilePlayer.on('error', () => {
            console.error("Video.js error:", mobilePlayer.error());
            showMobileError("Errore durante la riproduzione");
        });

    } catch (err) {
        console.error(err);
        showMobileLoading(false);
        showMobileError(err.message);
    }
}

/* ================== QUALITÀ VIDEO ================== */
function extractAvailableQualities() {
    availableQualities = [];

    const tech = mobilePlayer?.tech();
    const vhs = tech?.vhs;
    const master = vhs?.playlists?.master;

    if (!master?.playlists) return;

    master.playlists.forEach((pl, i) => {
        const res = pl.attributes?.RESOLUTION;
        if (!res) return;

        availableQualities.push({
            index: i,
            height: res.height,
            label: `${res.height}p`
        });
    });

    updateQualitySelector();
}

function updateQualitySelector() {
    const select = document.getElementById('mobile-quality-select');
    if (!select) return;

    select.innerHTML = '<option value="auto">Auto</option>';

    availableQualities.forEach(q => {
        const opt = document.createElement('option');
        opt.value = q.index;
        opt.textContent = q.label;
        select.appendChild(opt);
    });

    select.onchange = () => changeMobileQuality(select.value);
}

function changeMobileQuality(value) {
    const vhs = mobilePlayer?.tech()?.vhs;
    if (!vhs) return;

    if (value === 'auto') {
        vhs.playlists.media();
    } else {
        vhs.playlists.media(parseInt(value));
    }
}

/* ================== AUDIO ================== */
function extractAudioTracks() {
    const tracks = mobilePlayer?.audioTracks?.();
    if (!tracks) return;

    availableAudioTracks = [];

    for (let i = 0; i < tracks.length; i++) {
        availableAudioTracks.push({
            index: i,
            label: tracks[i].label || tracks[i].language || `Audio ${i + 1}`,
            enabled: tracks[i].enabled
        });
    }

    updateAudioSelector();
}

function updateAudioSelector() {
    const select = document.getElementById('mobile-audio-select');
    if (!select) return;

    select.innerHTML = '';

    availableAudioTracks.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.index;
        opt.textContent = t.label;
        if (t.enabled) opt.selected = true;
        select.appendChild(opt);
    });

    select.onchange = () => changeMobileAudio(select.value);
}

function changeMobileAudio(index) {
    const tracks = mobilePlayer.audioTracks();
    for (let i = 0; i < tracks.length; i++) {
        tracks[i].enabled = i === parseInt(index);
    }
}

/* ================== SOTTOTITOLI ================== */
function extractSubtitles() {
    const tracks = mobilePlayer?.textTracks?.();
    if (!tracks) return;

    availableSubtitles = [{ id: -1, label: 'Nessuno' }];

    for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].kind === 'subtitles') {
            availableSubtitles.push({
                id: i,
                label: tracks[i].label || tracks[i].language
            });
        }
    }

    updateSubtitleSelector();
}

function updateSubtitleSelector() {
    const select = document.getElementById('mobile-subtitle-select');
    if (!select) return;

    select.innerHTML = '';

    availableSubtitles.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.label;
        select.appendChild(opt);
    });

    select.onchange = () => changeMobileSubtitle(select.value);
}

function changeMobileSubtitle(id) {
    const tracks = mobilePlayer.textTracks();
    for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = 'disabled';
    }

    if (id !== -1 && tracks[id]) {
        tracks[id].mode = 'showing';
    }
}

/* ================== TV: STAGIONI / EPISODI ================== */
async function loadTVSeasonsMobile(tmdbId) {
    const details = await fetchTMDB(`tv/${tmdbId}`);
    const seasons = (details.seasons || []).filter(s => s.season_number > 0);

    const select = document.getElementById('mobile-season-select');
    select.innerHTML = '';

    seasons.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.season_number;
        opt.textContent = `Stagione ${s.season_number}`;
        select.appendChild(opt);
    });

    if (seasons.length) {
        loadSeasonEpisodesMobile(tmdbId, seasons[0].season_number);
    }

    select.onchange = () =>
        loadSeasonEpisodesMobile(tmdbId, parseInt(select.value));
}

async function loadSeasonEpisodesMobile(tmdbId, season) {
    const data = await fetchTMDB(`tv/${tmdbId}/season/${season}`);
    const list = document.getElementById('mobile-episodes-list');
    list.innerHTML = '';

    data.episodes
        .filter(e => e.episode_number > 0)
        .forEach(ep => {
            const div = document.createElement('div');
            div.className = 'mobile-episode-item';
            div.textContent = `Episodio ${ep.episode_number}`;
            div.onclick = () =>
                playItemMobile(tmdbId, 'tv', season, ep.episode_number);
            list.appendChild(div);
        });
}

/* ================== CHIUSURA PLAYER ================== */
function closePlayerMobile() {
    cleanupFunctions.forEach(fn => fn());
    cleanupFunctions = [];

    if (mobilePlayer) {
        mobilePlayer.dispose();
        mobilePlayer = null;
    }

    currentMobileItem = null;
    showHomeMobile();
}

/* ================== XHR HOOK ================== */
const xhrRequestHook = (options) => {
    if (!options.uri) return options;

    if (options.uri.includes('corsproxy.io')) return options;

    if (options.uri.includes('.key') || options.uri.includes('/storage/')) {
        options.uri = applyCorsProxy(options.uri);
    }

    return options;
};
