const AVAILABILITY_CHECK_TIMEOUT = 5000;
const API_KEY = "f75aac685f3389aa89c4f8580c078a28";
const VIXSRC_URL = "vixsrc.to";
const CORS_PROXIES_REQUIRING_ENCODING = [];

const CORS_LIST = [
  "cors-anywhere.com/",
  "corsproxy.io/",
  "api.allorigins.win/raw?url=",
  ...CORS_PROXIES_REQUIRING_ENCODING,
];

// Impostiamo automaticamente corsproxy.io
let CORS = "corsproxy.io/";

// Dichiarazione delle variabili globali (senza re-inizializzare in altri file)
let shownContinuaIds = new Set();
let baseStreamUrl = "";
let requestHookInstalled = false;

// Variabili per gestire lo stato corrente
let currentMoviePage = 1;
let currentTVPage = 1;
let totalMoviePages = 0;
let totalTVPages = 0;
let currentCategory = null;
let currentCategoryPage = 1;

// Filtri anno
let currentMovieMinYear = null;
let currentMovieMaxYear = null;
let currentTVMinYear = null;
let currentTVMaxYear = null;
let currentMinYear = null;
let currentMaxYear = null;

const endpoints = {
  trending: `trending/all/week`,
  nowPlaying: `movie/now_playing`,
  popularMovies: `movie/popular`,
  onTheAir: `tv/on_the_air`,
  popularTV: `tv/popular`,
};

// Funzioni di utilità
function applyCorsProxy(url) {
  const CORS = document.getElementById("cors-select").value;
  const requiresEncoding = CORS_PROXIES_REQUIRING_ENCODING.some(
    (proxy) => CORS === proxy
  );
  let cleanUrl = url;
  if (url.includes(CORS)) {
    if (requiresEncoding) {
      cleanUrl = decodeURIComponent(url.split(CORS)[1]);
    } else {
      cleanUrl = url.split(CORS)[1];
    }
  }
  if (
    !cleanUrl.startsWith("http://") &&
    !cleanUrl.startsWith("https://")
  ) {
    cleanUrl = resolveUrl(cleanUrl);
  }
  if (
    cleanUrl.startsWith("data:") ||
    cleanUrl.startsWith("blob:") ||
    !cleanUrl.startsWith("https://vixsrc.to")
  ) {
    return url;
  }

  if (requiresEncoding) {
    return `https://${CORS}${encodeURIComponent(cleanUrl)}`;
  } else {
    return `https://${CORS}${cleanUrl}`;
  }
}

function resolveUrl(url, baseUrl = "https://vixsrc.to") {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("/")) {
    return baseUrl + url;
  }

  return baseUrl + "/" + url;
}

function extractBaseUrl(url) {
  try {
    const CORS = document.getElementById("cors-select").value;
    let cleanUrl = url;
    if (url.includes(CORS)) {
      cleanUrl = url.split(CORS)[1];
    }

    const urlObj = new URL(cleanUrl);
    return `${urlObj.protocol}//${urlObj.host}`;
  } catch (e) {
    return "";
  }
}

function saveToStorage(name, value, days) {
  try {
    const data = {
      value: value,
      expires: new Date().getTime() + (days * 24 * 60 * 60 * 1000),
      created: new Date().getTime()
    };
    localStorage.setItem(name, JSON.stringify(data));
    // console.log(`💾 localStorage salvato: ${name}=${value}`);
    return true;
  } catch (e) {
    console.error("❌ Errore localStorage:", e);
    return false;
  }
}

function getFromStorage(name) {
  try {
    const item = localStorage.getItem(name);
    if (item) {
      const data = JSON.parse(item);
      // Controlla se è scaduto
      if (!data.expires || data.expires > new Date().getTime()) {
        // console.log(`📖 localStorage letto: ${name}=${data.value}`);
        return data.value;
      } else {
        // Rimuovi se scaduto
        localStorage.removeItem(name);
        // console.log(`🗑️ Rimosso scaduto: ${name}`);
      }
    }
  } catch (e) {
    console.error("❌ Errore lettura localStorage:", e);
  }
  return null;
}

// Funzione per pulire tutti i dati scaduti
function cleanupExpiredStorage() {
  try {
    const now = new Date().getTime();
    let removed = 0;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("videoTime_")) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data.expires && data.expires < now) {
            localStorage.removeItem(key);
            removed++;
            i--; // Adjust index after removal
          }
        } catch (e) {
          // Ignora errori di parsing
        }
      }
    }
    
    if (removed > 0) {
      // console.log(`🧹 Puliti ${removed} elementi scaduti`);
    }
  } catch (e) {
    console.error("❌ Errore pulizia storage:", e);
  }
}

// Funzioni per mostrare/nascondere sezioni
function showAllMovies() {
  hideAllSections();
  document.getElementById("allMovies").style.display = "block";
  loadAllMovies(1, currentMovieMinYear, currentMovieMaxYear);
}

function showAllTV() {
  hideAllSections();
  document.getElementById("allTV").style.display = "block";
  loadAllTV(1, currentTVMinYear, currentTVMaxYear);
}

function showTrending() {
  hideAllSections();
  document.getElementById("home").style.display = "block";
  window.scrollTo(0, 0);
}

function showCategories() {
  hideAllSections();
  const categoriesSection = document.getElementById("categories");
  categoriesSection.style.display = "block";
  
  // Aggiungi il tasto "Torna alla Home" se non esiste già
  let backButton = document.querySelector("#categories .back-to-home");
  if (!backButton) {
    const grid = document.getElementById("categories-grid");
    const backBtn = document.createElement("button");
    backBtn.className = "back-to-home";
    backBtn.textContent = "← Torna alla Home";
    backBtn.style.margin = "0 4% 20px";
    backBtn.onclick = goBackToHome;
    categoriesSection.insertBefore(backBtn, grid);
  }
  
  loadCategories();
}

function showPreferiti() {
  hideAllSections();
  const preferitiSection = document.getElementById("preferiti-section");
  preferitiSection.style.display = "block";
  
  // Aggiungi il tasto "Torna alla Home" se non esiste già
  let backButton = document.querySelector("#preferiti-section .back-to-home");
  if (!backButton) {
    const h2 = preferitiSection.querySelector("h2");
    const backBtn = document.createElement("button");
    backBtn.className = "back-to-home";
    backBtn.textContent = "← Torna alla Home";
    backBtn.style.margin = "0 4% 20px";
    backBtn.onclick = goBackToHome;
    preferitiSection.insertBefore(backBtn, h2);
  }
  
  loadPreferitiSection();
}
function hideAllSections() {
  const sections = [
    "home", 
    "allMovies", 
    "allTV", 
    "categories", 
    "results", 
    "player", 
    "preferiti-section",
    "category-results"  // Aggiungi questa sezione
  ];
  sections.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.style.display = "none";
    }
  });
}
function goBackToCategories() {
  hideAllSections();
  document.getElementById("categories").style.display = "block";
  window.scrollTo(0, 0);
}
// Setup iniziale
document.getElementById("cors-select").addEventListener("change", (e) => {
  CORS = e.target.value;
  
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    background: rgba(229, 9, 20, 0.95);
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = `CORS proxy cambiato: ${CORS.replace(/\/|\?|=/g, "")}`;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease";
    setTimeout(() => notification.remove(), 300);
  }, 2000);
});

// Event listener per la ricerca
let searchTimeout;
document.getElementById("search").addEventListener("input", (e) => {
  clearTimeout(searchTimeout);
  const query = e.target.value.trim();

  if (query.length < 2) {
    document.getElementById("results").style.display = "none";
    document.getElementById("home").style.display = "block";
    return;
  }

  searchTimeout = setTimeout(() => performSearch(query), 500);
});
function debugCookies() {
  // console.log("🔍 DEBUG - Tutti i cookie:");
  const allCookies = document.cookie.split(";").map((c) => c.trim());
  allCookies.forEach(cookie => {
    // console.log("🍪", cookie);
  });
}
function goBackToHome() {
  hideAllSections();
  document.getElementById("home").style.display = "block";
  window.scrollTo(0, 0);
}

// Caricamento iniziale
window.addEventListener("DOMContentLoaded", async () => {
  // console.log("🚀 Pagina caricata");
  
  // Mostra debug storage
  // console.log("💽 localStorage totale:", localStorage.length, "elementi");
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    // console.log(`  ${i}: ${key}`);
  }
  
  const corsSelect = document.getElementById("cors-select");
  
  CORS_LIST.forEach((proxy) => {
    const option = document.createElement("option");
    option.value = proxy;
    option.textContent = proxy.replace(/\/|\?|=/g, "");
    corsSelect.appendChild(option);
  });
  corsSelect.value = CORS;
  
  // PRIMA carica "Continua visione"
  await loadContinuaDaStorage(); // Nome cambiato!
  
  // Poi carica i preferiti
  await loadPreferiti();
  
  if (typeof videojs !== "undefined") {
    setupVideoJsXhrHook();
  } else {
    window.addEventListener("load", setupVideoJsXhrHook);
  }

  // Carica altre sezioni...
  for (const [key, endpoint] of Object.entries(endpoints)) {
    try {
      const data = await fetchAndFilterAvailable(key);
      const section = document.getElementById(key);
      const carousel = section.querySelector(".carousel");
      
      carousel.innerHTML = "";
      
      data.results.forEach((item) => {
        carousel.appendChild(createCard(item));
      });
      
      if (data.results.length === 0) {
        section.style.display = "none";
      }
      
    } catch (error) {
      document.getElementById(key).style.display = "none";
    }
  }
  
  updatePreferitiCounter();
});
window.formatTime = function(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};
// Aggiungi stili per le animazioni
const style = document.createElement("style");
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
  }
`;
document.head.appendChild(style);