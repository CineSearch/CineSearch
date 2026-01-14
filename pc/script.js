const AVAILABILITY_CHECK_TIMEOUT = 5000;
const API_KEY = "f75aac685f3389aa89c4f8580c078a28";
const VIXSRC_URL = "vixsrc.to";
const CORS_PROXIES_REQUIRING_ENCODING = [];
const SECTIONS = {
    'home': 'home',
    'allMovies': 'allMovies',
    'allTV': 'allTV',
    'categories': 'categories',
    'category-results': 'category-results',
    'results': 'results',
    'player': 'player',
    'preferiti-section': 'preferiti-section'
};

const CORS_LIST = [
  "cors-anywhere.com/",
  "corsproxy.io/",
  "api.allorigins.win/raw?url=",
  ...CORS_PROXIES_REQUIRING_ENCODING,
];

let CORS = "corsproxy.io/";

let shownContinuaIds = new Set();
let baseStreamUrl = "";
let requestHookInstalled = false;

let currentMoviePage = 1;
let currentTVPage = 1;
let totalMoviePages = 0;
let totalTVPages = 0;
let currentCategory = null;
let currentCategoryPage = 1;

let currentMovieMinYear = null;
let currentMovieMaxYear = null;
let currentTVMinYear = null;
let currentTVMaxYear = null;
let currentMinYear = null;
let currentMaxYear = null;

let currentNavigationSection = null;
let currentNavigationPage = 1;
let navigationItems = [];
let itemsPerPage = 30;

const endpoints = {
  trending: `trending/all/week`,
  nowPlaying: `movie/now_playing`,
  popularMovies: `movie/popular`,
  onTheAir: `tv/on_the_air`,
  popularTV: `tv/popular`,
};

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
    // // console.log(`💾 localStorage salvato: ${name}=${value}`);
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
      if (!data.expires || data.expires > new Date().getTime()) {
        // // console.log(`📖 localStorage letto: ${name}=${data.value}`);
        return data.value;
      } else {
        localStorage.removeItem(name);
        // // console.log(`🗑️ Rimosso scaduto: ${name}`);
      }
    }
  } catch (e) {
    console.error("❌ Errore lettura localStorage:", e);
  }
  return null;
}

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
            i--; 
          }
        } catch (e) {

        }
      }
    }
    
    if (removed > 0) {
      // // console.log(`🧹 Puliti ${removed} elementi scaduti`);
    }
  } catch (e) {
    console.error("❌ Errore pulizia storage:", e);
  }
}

function showNavigationSection(section) {
  hideAllSections();
  currentNavigationSection = section;
  currentNavigationPage = 1;
  navigationItems = [];
  
  const navigationSection = document.getElementById("navigation-section");
  if (!navigationSection) {
    const main = document.querySelector("main");
    const navSection = document.createElement("section");
    navSection.id = "navigation-section";
    navSection.innerHTML = `
      <div class="navigation-header">
        <button class="back-to-home" onclick="goBackToHome()">← Torna alla Home</button>
        <h2 id="navigation-title"></h2>
        <div class="pagination-info" id="pagination-info"></div>
      </div>
      <div class="navigation-grid" id="navigation-grid"></div>
      <div class="navigation-pagination" id="navigation-pagination">
        <button class="pagination-btn prev" onclick="prevNavigationPage()" disabled>◀ Precedente</button>
        <span class="page-info" id="page-info">Pagina 1</span>
        <button class="pagination-btn next" onclick="nextNavigationPage()">Successiva ▶</button>
      </div>
    `;
    main.appendChild(navSection);
  }
  
  document.getElementById("navigation-section").style.display = "block";
  document.getElementById("navigation-title").textContent = getNavigationTitle(section);
  
  loadNavigationContent(section);
}

function getNavigationTitle(section) {
  switch(section) {
    case 'movies': return '🎬 Tutti i Film';
    case 'tv': return '📺 Tutte le Serie TV';
    case 'categories': return '🎭 Categorie';
    case 'favorites': return '⭐ Preferiti';
    default: return 'Navigazione';
  }
}

async function loadNavigationContent(section, page = 1) {
  currentNavigationPage = page;
  const grid = document.getElementById("navigation-grid");
  grid.innerHTML = '<div class="loading">Caricamento...</div>';
  
  try {
    let items = [];
    
    switch(section) {
      case 'movies':
        items = await loadMoviesForNavigation(page);
        break;
      case 'tv':
        items = await loadTVForNavigation(page);
        break;
      case 'categories':
        loadCategories();
        return;
      case 'favorites':
        items = await loadFavoritesForNavigation();
        break;
    }
    
    navigationItems = items;
    displayNavigationItems(items, page);
    updatePaginationControls(items.length);
    
  } catch (error) {
    console.error(`Errore nel caricamento ${section}:`, error);
    grid.innerHTML = '<div class="error">Errore nel caricamento dei contenuti</div>';
  }
}

async function loadMoviesForNavigation(page) {
  const res = await fetch(
    `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=it-IT&sort_by=popularity.desc&page=${page}`
  );
  const data = await res.json();
  
  const availableMovies = [];
  for (const movie of data.results.slice(0, 50)) {
    const isAvailable = await checkAvailabilityOnVixsrc(movie.id, true);
    if (isAvailable) {
      movie.media_type = "movie";
      availableMovies.push(movie);
    }
    if (availableMovies.length >= itemsPerPage) break;
  }
  
  return availableMovies;
}

async function loadTVForNavigation(page) {
  const res = await fetch(
    `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&language=it-IT&sort_by=popularity.desc&page=${page}`
  );
  const data = await res.json();
  
  const availableTV = [];
  for (const tv of data.results.slice(0, 50)) {
    const isAvailable = await checkTvSeriesAvailability(tv.id);
    if (isAvailable) {
      tv.media_type = "tv";
      availableTV.push(tv);
    }
    if (availableTV.length >= itemsPerPage) break;
  }
  
  return availableTV;
}

async function loadFavoritesForNavigation() {
  const preferiti = getPreferiti();
  const items = [];
  
  for (const itemId of preferiti) {
    const [mediaType, tmdbId] = itemId.split("-");
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${API_KEY}&language=it-IT`
      );
      const item = await res.json();
      item.media_type = mediaType;
      items.push(item);
    } catch (error) {
      console.error(`Errore nel caricamento del preferito ${itemId}:`, error);
    }
  }
  
  return items;
}

function displayNavigationItems(items, currentPage) {
  const grid = document.getElementById("navigation-grid");
  grid.innerHTML = '';
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageItems = items.slice(startIndex, endIndex);
  
  if (pageItems.length === 0) {
    grid.innerHTML = '<div class="no-results">Nessun contenuto trovato</div>';
    return;
  }
  
  pageItems.forEach(item => {
    const card = createCard(item, [], false);
    grid.appendChild(card);
  });
  
  document.getElementById("page-info").textContent = 
    `Pagina ${currentPage} di ${Math.ceil(items.length / itemsPerPage)}`;
  document.getElementById("pagination-info").textContent = 
    `${items.length} contenuti totali, ${pageItems.length} in questa pagina`;
}

function updatePaginationControls(totalItems) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const prevBtn = document.querySelector(".pagination-btn.prev");
  const nextBtn = document.querySelector(".pagination-btn.next");
  
  prevBtn.disabled = currentNavigationPage <= 1;
  nextBtn.disabled = currentNavigationPage >= totalPages || totalItems <= itemsPerPage;
}

function nextNavigationPage() {
  const totalPages = Math.ceil(navigationItems.length / itemsPerPage);
  if (currentNavigationPage < totalPages) {
    displayNavigationItems(navigationItems, currentNavigationPage + 1);
    currentNavigationPage++;
    updatePaginationControls(navigationItems.length);
    window.scrollTo(0, 0);
  }
}

function prevNavigationPage() {
  if (currentNavigationPage > 1) {
    displayNavigationItems(navigationItems, currentNavigationPage - 1);
    currentNavigationPage--;
    updatePaginationControls(navigationItems.length);
    window.scrollTo(0, 0);
  }
}

function showAllMovies() {
    hideAllSections();
    document.getElementById("allMovies").style.display = "block";
    loadAllMovies();
    window.scrollTo(0, 0);
    
    // Aggiorna l'URL senza ricaricare la pagina
    history.pushState({ section: 'allMovies' }, '', '#allMovies');
}

function showAllTV() {
    hideAllSections();
    document.getElementById("allTV").style.display = "block";
    loadAllTV();
    window.scrollTo(0, 0);
    
    history.pushState({ section: 'allTV' }, '', '#allTV');
}

function showCategories() {
    hideAllSections();
    document.getElementById("categories").style.display = "block";
    loadCategories();
    window.scrollTo(0, 0);
    
    history.pushState({ section: 'categories' }, '', '#categories');
}

function showPreferiti() {
    hideAllSections();
    document.getElementById("preferiti-section").style.display = "block";
    loadPreferitiSection();
    window.scrollTo(0, 0);
    
    history.pushState({ section: 'preferiti-section' }, '', '#preferiti');
}

function goBackToCategories() {
    hideAllSections();
    document.getElementById("categories").style.display = "block";
    window.scrollTo(0, 0);
    
    history.pushState({ section: 'categories' }, '', '#categories');
}

function handlePopState(event) {
    // console.log('Popstate triggered', event.state);
    
    if (event.state && event.state.section) {
        const sectionId = event.state.section;
        hideAllSections();
        
        switch(sectionId) {
            case 'home':
                document.getElementById("home").style.display = "block";
                break;
            case 'allMovies':
                document.getElementById("allMovies").style.display = "block";
                if (!document.querySelector('#allMovies-grid').children.length) {
                    loadAllMovies();
                }
                break;
            case 'allTV':
                document.getElementById("allTV").style.display = "block";
                if (!document.querySelector('#allTV-grid').children.length) {
                    loadAllTV();
                }
                break;
            case 'categories':
                document.getElementById("categories").style.display = "block";
                if (!document.querySelector('#categories-grid').children.length) {
                    loadCategories();
                }
                break;
            case 'preferiti-section':
                document.getElementById("preferiti-section").style.display = "block";
                loadPreferitiSection();
                break;
            case 'category-results':
                document.getElementById("category-results").style.display = "block";
                break;
            case 'results':
                document.getElementById("results").style.display = "block";
                break;
            case 'player':
                // Se viene richiamato il player dall'history, torna alla home
                goBackToHome();
                break;
        }
        
        window.scrollTo(0, 0);
    } else {
        // Se non c'è state, torna alla home
        goBackToHome();
    }
}

function hideAllSections() {
  const sections = [
    "home", 
    "allMovies", 
    "allTV", 
    "categories", 
    "category-results", 
    "results", 
    "player", 
    "preferiti-section",
    "navigation-section"
  ];
  
  sections.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.style.display = "none";
    }
  });
}

function goBackToCategories() {
  const resultsSection = document.getElementById("category-results");
  if (resultsSection) {
    resultsSection.style.display = "none";
  }
  document.getElementById("categories").style.display = "block";
  window.scrollTo(0, 0);
}

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

document.getElementById("search").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const query = e.target.value.trim();
    
    if (query.length < 2) {
      alert("Inserisci almeno 2 caratteri per la ricerca");
      return;
    }
    
    performSearch(query);
  }
});

// Opzionale: se vuoi supportare anche il click su un'icona di ricerca


function debugCookies() {
  // // console.log("🔍 DEBUG - Tutti i cookie:");
  const allCookies = document.cookie.split(";").map((c) => c.trim());
  allCookies.forEach(cookie => {
    // // console.log("🍪", cookie);
  });
}

function goBackToHome() {
    hideAllSections();
    document.getElementById("home").style.display = "block";
    window.scrollTo(0, 0);
    
    // Aggiorna l'history state
    history.pushState({ section: 'home' }, '', window.location.pathname);
}

function handleRemoteNavigation(event) {
  switch(event.key) {
    case 'Enter':
    case ' ':
      const focusedElement = document.activeElement;
      if (focusedElement && focusedElement.classList.contains('card')) {
        event.preventDefault();
        focusedElement.click();
      }
      break;
      
    case 'Backspace':
    case 'Escape':
      if (document.getElementById("player").style.display === "block") {
        event.preventDefault();
        goBack();
      }
      break;
  }
}


window.addEventListener("DOMContentLoaded", async () => {
  // // console.log("🚀 Pagina caricata");
  
  // // console.log("💽 localStorage totale:", localStorage.length, "elementi");
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    // // console.log(`  ${i}: ${key}`);
  }
      window.addEventListener('popstate', handlePopState);
      
  const corsSelect = document.getElementById("cors-select");
  
  CORS_LIST.forEach((proxy) => {
    const option = document.createElement("option");
    option.value = proxy;
    option.textContent = proxy.replace(/\/|\?|=/g, "");
    corsSelect.appendChild(option);
  });
  corsSelect.value = CORS;

  await loadContinuaDaStorage();

  await loadPreferiti();
  
  if (typeof videojs !== "undefined") {
    setupVideoJsXhrHook();
  } else {
    window.addEventListener("load", setupVideoJsXhrHook);
  }
  document.addEventListener('keydown', handleRemoteNavigation);
  
  setTimeout(() => {
    const firstCard = document.querySelector('.card');
    if (firstCard) {
      firstCard.focus();
    }
  }, 1000);
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

      window.addEventListener('popstate', handlePopState);
    
    // Gestione iniziale dell'hash nell'URL
    if (window.location.hash) {
        const hash = window.location.hash.substring(1); // Rimuove il #
        if (SECTIONS[hash]) {
            hideAllSections();
            switch(hash) {
                case 'allMovies':
                    showAllMovies();
                    break;
                case 'allTV':
                    showAllTV();
                    break;
                case 'categories':
                    showCategories();
                    break;
                case 'preferiti-section':
                    showPreferiti();
                    break;
                default:
                    document.getElementById(hash).style.display = "block";
            }
        }
    } else {
        // Imposta lo stato iniziale per la home
        history.replaceState({ section: 'home' }, '', window.location.pathname);
    }
});

window.addEventListener("scroll", () => {
  const header = document.getElementById("header");
  if (window.scrollY > 50) {
    header.classList.add("scrolled");
  } else {
    header.classList.remove("scrolled");
  }
});

document.querySelectorAll(".arrow").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetId = btn.getAttribute("data-target");
    const container = document.getElementById(targetId).parentElement;
    const scrollAmount = container.offsetWidth * 0.8;
    container.scrollBy({
      left: btn.classList.contains("left") ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  });
});


window.formatTime = function(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};