// Configurazione per TV
const TV_CONFIG = {
    API_KEY: "f75aac685f3389aa89c4f8580c078a28",
    VIXSRC_URL: "vixsrc.to",
    
    // Timeouts ottimizzati per TV
    AVAILABILITY_TIMEOUT: 10000,
    API_TIMEOUT: 15000,
    PLAYER_TIMEOUT: 30000,
    
    // Cache settings
    CACHE_DURATION: 3600000, // 1 ora
    PREFERITI_CACHE_KEY: "tv_preferiti_cache",
    CONTINUA_CACHE_KEY: "tv_continua_cache",
    
    // Pagination
    ITEMS_PER_PAGE: 20,
    CAROUSEL_ITEMS: 10,
    
    // UI settings
    FOCUS_ANIMATION_DURATION: 150,
    SCROLL_SPEED: 300,
    TOAST_DURATION: 3000,
    
    // Player settings
    DEFAULT_VOLUME: 0.8,
    SEEK_STEP_SMALL: 10,
    SEEK_STEP_LARGE: 30,
    
    // CORS Proxies per TV
    CORS_PROXIES: [
        "corsproxy.io/",
        "api.allorigins.win/raw?url=",
        "cors-anywhere.herokuapp.com/",
        "api.codetabs.com/v1/proxy?quest="
    ],
    
    // Endpoints TMDB
    ENDPOINTS: {
        trending: "trending/all/week",
        nowPlaying: "movie/now_playing",
        popularMovies: "movie/popular",
        onTheAir: "tv/on_the_air",
        popularTV: "tv/popular"
    }
};

// Variabili globali
let TV_STATE = {
    currentSection: "home",
    previousSection: null,
    currentPage: {
        movies: 1,
        series: 1,
        search: 1,
        category: 1
    },
    currentFilters: {
        movies: { minYear: null, maxYear: null },
        series: { minYear: null, maxYear: null },
        category: { minYear: null, maxYear: null }
    },
    currentCategory: null,
    currentItem: null,
    playerInstance: null,
    focusElement: "nav-home",
    focusStack: [],
    isLoading: false,
    shownContinuaIds: new Set()
};

// CORS LIST
const CORS_LIST = [
    "corsproxy.io/",
    "api.allorigins.win/raw?url=",
    "cors-anywhere.herokuapp.com/",
    "https://api.codetabs.com/v1/proxy?quest="
];

let CORS = "https://api.codetabs.com/v1/proxy?quest=";

// Storage per TV
class TVStorage {
    static set(key, value, ttl = TV_CONFIG.CACHE_DURATION) {
        try {
            const data = {
                value: value,
                expires: Date.now() + ttl,
                timestamp: Date.now()
            };
            localStorage.setItem(`tv_${key}`, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error("TV Storage Error:", e);
            return false;
        }
    }

    static get(key) {
        try {
            const item = localStorage.getItem(`tv_${key}`);
            if (!item) return null;
            
            const data = JSON.parse(item);
            if (data.expires && Date.now() > data.expires) {
                localStorage.removeItem(`tv_${key}`);
                return null;
            }
            return data.value;
        } catch (e) {
            console.error("TV Storage Read Error:", e);
            return null;
        }
    }

    static remove(key) {
        localStorage.removeItem(`tv_${key}`);
    }

    static clearExpired() {
        const now = Date.now();
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("tv_")) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data.expires && now > data.expires) {
                        localStorage.removeItem(key);
                        i--;
                    }
                } catch (e) {
                    // Ignora errori di parsing
                }
            }
        }
    }
}

// Utility functions
function showToast(message, type = "info") {
    const toast = document.getElementById("tv-toast");
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = `tv-toast tv-toast-${type}`;
    toast.style.display = "block";
    
    setTimeout(() => {
        toast.style.display = "none";
    }, TV_CONFIG.TOAST_DURATION);
}

function showLoading(show, message = "Caricamento...") {
    TV_STATE.isLoading = show;
    const loadingOverlay = document.getElementById("loading-overlay");
    const loadingText = loadingOverlay?.querySelector(".loading-text");
    
    if (loadingOverlay) {
        loadingOverlay.style.display = show ? "flex" : "none";
    }
    
    if (loadingText && message) {
        loadingText.textContent = message;
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// CORS Proxy management
let CURRENT_CORS_PROXY = TV_CONFIG.CORS_PROXIES[0];

function applyCorsProxy(url) {
    if (!url || url.startsWith("blob:") || url.startsWith("data:")) {
        return url;
    }
    
    // Se è già un URL proxy corretto, restituisci così
    if (url.includes('corsproxy.io/https://') || 
        url.includes('api.allorigins.win') ||
        url.includes('cors-anywhere.herokuapp.com') ||
        url.includes('api.codetabs.com/v1/proxy?quest=')) {
        return url;
    }
    
    // URL che non hanno bisogno di proxy (CDN dirette)
    if (url.includes('vix-content.net') || 
        url.includes('image.tmdb.org') ||
        url.includes('themoviedb.org')) {
        return url;
    }
    
    // Controlla se l'URL è relativo
    if (url.startsWith('/')) {
        url = `https://vixsrc.to${url}`;
    }
    
    // Assicurati che l'URL sia completo
    if (!url.startsWith('http')) {
        url = `https://vixsrc.to/${url}`;
    }
    
    // Costruisci l'URL con il proxy selezionato
    if (CURRENT_CORS_PROXY.includes("allorigins")) {
        const encodedUrl = encodeURIComponent(url);
        return `https://api.allorigins.win/raw?url=${encodedUrl}`;
    } else if (CURRENT_CORS_PROXY.includes("herokuapp")) {
        return `https://cors-anywhere.herokuapp.com/${url}`;
    } else if (CURRENT_CORS_PROXY.includes("corsproxy.io")) {
        return `https://corsproxy.io/?${encodeURIComponent(url)}`;
    } else if (CURRENT_CORS_PROXY.includes("api.codetabs.com/v1/proxy?quest=")) {
        // CORREZIONE: rimuovi il / davanti a https://
        return `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
    } else {
        // Fallback
        return `https://corsproxy.io/?${encodeURIComponent(url)}`;
    }
}

function setCorsProxy(proxy) {
    CURRENT_CORS_PROXY = proxy;
    TVStorage.set("cors_proxy", proxy);
    showToast(`Proxy cambiato: ${proxy.replace(/\/$/, "")}`, "success");
}

// Inizializza CORS selector
function initCorsSelector() {
    const select = document.getElementById("tv-cors-select");
    if (!select) return;
    
    TV_CONFIG.CORS_PROXIES.forEach(proxy => {
        const option = document.createElement("option");
        option.value = proxy;
        option.textContent = proxy.replace(/\/$/, "");
        select.appendChild(option);
    });
    
    // Imposta il proxy salvato o default
    const savedProxy = TVStorage.get("cors_proxy");
    select.value = savedProxy || TV_CONFIG.CORS_PROXIES[0];
    CURRENT_CORS_PROXY = select.value;
    
    select.addEventListener("change", (e) => {
        setCorsProxy(e.target.value);
    });
}

// Gestione errori TV
function handleTVError(error, context = "") {
    console.error(`TV Error [${context}]:`, error);
    
    let message = "Si è verificato un errore";
    if (error.message.includes("network") || error.message.includes("fetch")) {
        message = "Errore di connessione. Verifica la rete.";
    } else if (error.message.includes("timeout")) {
        message = "Timeout. Riprova.";
    }
    
    showToast(`${message} ${context ? `(${context})` : ""}`, "error");
    showLoading(false);
    
    return null;
}

// Formattazione tempo
function formatTime(seconds) {
    if (!seconds || seconds < 0) return "0:00";
    
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Scroll to section
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
        showToast(`Scorri a ${sectionId.replace('tv-', '')}`, 'info');
    }
}

// Cleanup iniziale
TVStorage.clearExpired();

// Esponi al global scope
window.TV_CONFIG = TV_CONFIG;
window.TV_STATE = TV_STATE;
window.TVStorage = TVStorage;
window.CORS_LIST = CORS_LIST;
window.CORS = CORS;
window.showToast = showToast;
window.showLoading = showLoading;
window.applyCorsProxy = applyCorsProxy;
window.setCorsProxy = setCorsProxy;
window.formatTime = formatTime;
window.scrollToSection = scrollToSection;