// Mobile.js - Versione completa per CineSearch Mobile

// ============ VARIABILI GLOBALI ============
const AVAILABILITY_CHECK_TIMEOUT = 5000;
const API_KEY = "f75aac685f3389aa89c4f8580c078a28";
const VIXSRC_URL = "vixsrc.to";

let currentMobileSection = 'home';
let mobileMoviePage = 1;
let mobileTVPage = 1;
let currentCorsProxy = 'https://corsproxy.io/?';
let currentCategory = null;
let mobileCategoryPage = 1;
let mobileCategoryId = null;
let mobileCategoryName = '';
let currentMovieMinYear = null;
let currentMovieMaxYear = null;
let currentTVMinYear = null;
let currentTVMaxYear = null;

const itemsPerPage = 20;

const endpoints = {
    trending: `trending/all/week`,
    nowPlaying: `movie/now_playing`,
    popularMovies: `movie/popular`,
    onTheAir: `tv/on_the_air`,
    popularTV: `tv/popular`,
};

// ============ INIZIALIZZAZIONE ============
document.addEventListener('DOMContentLoaded', function() {
    console.log('CineSearch Mobile inizializzato');
    initMobileUI();
    initMobileCors();
    loadMobileHomeData();
});

// ============ INTERFACCIA MOBILE ============
function initMobileUI() {
    console.log('Inizializzazione UI mobile...');
    
    // Menu hamburger
    const menuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('mobile-sidebar');
    const closeBtn = document.getElementById('close-sidebar');
    
    if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', () => {
            sidebar.classList.add('active');
        });
    }
    
    if (closeBtn && sidebar) {
        closeBtn.addEventListener('click', () => {
            sidebar.classList.remove('active');
        });
    }
    
    // Chiudi sidebar cliccando fuori
    document.addEventListener('click', (e) => {
        if (sidebar && menuBtn && !sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
            sidebar.classList.remove('active');
        }
    });
    
    // Ricerca mobile
    const searchInput = document.getElementById('mobile-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleMobileSearch, 500));
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performMobileSearch(e.target.value);
            }
        });
    }
    
    // Aggiorna contatore preferiti
    updateMobileFavCount();
}

// ============ CORS PROXY MOBILE ============
function initMobileCors() {
    const corsSelect = document.getElementById('mobile-cors-select');
    
    if (!corsSelect) return;
    
    // Carica proxy salvati o usa quelli predefiniti
    const savedProxy = localStorage.getItem('mobile-cors-proxy') || 'https://corsproxy.io/?';
    currentCorsProxy = savedProxy;
    
    corsSelect.value = savedProxy;
    
    corsSelect.addEventListener('change', function() {
        currentCorsProxy = this.value;
        localStorage.setItem('mobile-cors-proxy', currentCorsProxy);
        console.log('CORS proxy mobile cambiato a:', currentCorsProxy);
    });
}

function applyCorsProxy(url) {
    if (!currentCorsProxy || currentCorsProxy === '') {
        return url;
    }
    
    if (url.includes(currentCorsProxy)) {
        return url;
    }
    
    return currentCorsProxy + encodeURIComponent(url);
}

// ============ PREFERITI MOBILE ============
function getPreferiti() {
    const raw = localStorage.getItem("preferiti");
    return raw ? JSON.parse(raw) : [];
}

function addPreferito(item) {
    const preferiti = getPreferiti();
    const id = `${item.media_type || (item.title ? "movie" : "tv")}-${item.id}`;
    if (!preferiti.includes(id)) {
        preferiti.push(id);
        localStorage.setItem("preferiti", JSON.stringify(preferiti));
        updateMobileFavCount();
    }
}

function removePreferito(item) {
    const preferiti = getPreferiti();
    const id = `${item.media_type || (item.title ? "movie" : "tv")}-${item.id}`;
    const updated = preferiti.filter((p) => p !== id);
    localStorage.setItem("preferiti", JSON.stringify(updated));
    updateMobileFavCount();
}

function updateMobileFavCount() {
    const preferiti = getPreferiti();
    const countElement = document.getElementById('mobile-preferiti-count');
    const badgeElement = document.getElementById('mobile-fav-count');
    
    if (countElement) countElement.textContent = preferiti.length;
    if (badgeElement) badgeElement.textContent = preferiti.length;
}

function checkIfFavorite(id, type) {
    const preferiti = getPreferiti();
    const itemId = `${type}-${id}`;
    return preferiti.includes(itemId);
}

// ============ API TMDB ============
async function fetchTMDB(endpoint, params = {}) {
    let url = `https://api.themoviedb.org/3/${endpoint}?api_key=${API_KEY}&language=it-IT`;
    
    // Aggiungi parametri
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
            url += `&${key}=${encodeURIComponent(params[key])}`;
        }
    });
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`TMDB API error: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Errore fetch TMDB:', error);
        throw error;
    }
}

async function checkAvailabilityOnVixsrc(tmdbId, isMovie, season = null, episode = null) {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            resolve(false);
        }, AVAILABILITY_CHECK_TIMEOUT);
        
        (async () => {
            try {
                let vixsrcUrl;
                
                if (isMovie) {
                    vixsrcUrl = `https://${VIXSRC_URL}/movie/${tmdbId}`;
                } else {
                    if (season === null || episode === null) {
                        vixsrcUrl = `https://${VIXSRC_URL}/tv/${tmdbId}/1/1`;
                    } else {
                        vixsrcUrl = `https://${VIXSRC_URL}/tv/${tmdbId}/${season}/${episode}`;
                    }
                }
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);
                
                const response = await fetch(applyCorsProxy(vixsrcUrl), {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                
                if (response.status === 404) {
                    clearTimeout(timeout);
                    resolve(false);
                    return;
                }
                
                const html = await response.text();
                const hasPlaylist = /window\.masterPlaylist/.test(html);
                const notFound = /not found|not available|no sources found|error 404/i.test(html);
                
                clearTimeout(timeout);
                resolve(hasPlaylist && !notFound);
                
            } catch (error) {
                console.error("Errore in checkAvailabilityOnVixsrc:", error);
                clearTimeout(timeout);
                resolve(false);
            }
        })();
    });
}

async function checkTvSeriesAvailability(tmdbId) {
    try {
        const firstEpisodeUrl = `https://${VIXSRC_URL}/tv/${tmdbId}/1/1`;
        const response = await fetch(applyCorsProxy(firstEpisodeUrl));
        
        if (!response.ok) {
            return false;
        }
        
        const html = await response.text();
        const hasPlaylist = /window\.masterPlaylist/.test(html);
        const notFound = /not found|not available|no sources found|error 404/i.test(html);
        
        return hasPlaylist && !notFound;
    } catch (error) {
        return false;
    }
}

// ============ CARD E CAROSELLI ============
function createMobileCard(item) {
    const isMovie = item.media_type === 'movie' || item.title;
    const mediaType = isMovie ? 'movie' : 'tv';
    const card = document.createElement('div');
    card.className = 'mobile-card';
    
    const imageUrl = item.poster_path 
        ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
        : 'https://via.placeholder.com/342x513?text=No+Image';
    
    const title = isMovie ? item.title : item.name;
    const year = isMovie 
        ? (item.release_date ? new Date(item.release_date).getFullYear() : 'N/A')
        : (item.first_air_date ? new Date(item.first_air_date).getFullYear() : 'N/A');
    
    const isFav = checkIfFavorite(item.id, mediaType);
    
    // Formatta il titolo per mobile
    const displayTitle = title.length > 25 ? title.substring(0, 22) + '...' : title;
    
    card.innerHTML = `
        <img src="${imageUrl}" alt="${title}" class="mobile-card-image" 
             onerror="this.src='https://via.placeholder.com/342x513?text=Image+Error'">
        <div class="mobile-card-content">
            <div class="mobile-card-title" title="${title}">${displayTitle}</div>
            <div class="mobile-card-meta">${year} • ${isMovie ? '🎬 Film' : '📺 Serie'}</div>
            <div class="mobile-card-buttons">
                <button class="mobile-card-btn play" onclick="playItemMobile(${item.id}, '${mediaType}', event)">
                    <i class="fas fa-play"></i>
                </button>
                <button class="mobile-card-btn fav ${isFav ? 'active' : ''}" 
                        onclick="toggleFavoriteMobile(${item.id}, '${mediaType}', '${title.replace(/'/g, "\\'")}', event)">
                    <i class="fas fa-star"></i>
                </button>
            </div>
        </div>
    `;
    
    // Apri player al click sulla card
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.mobile-card-btn')) {
            openMobilePlayer(item);
        }
    });
    
    return card;
}

function populateMobileCarousel(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    items.slice(0, 10).forEach(item => {
        const card = createMobileCard(item);
        container.appendChild(card);
    });
}

// ============ NAVIGAZIONE MOBILE ============
function showMobileSection(sectionId) {
    // Nascondi tutte le sezioni
    document.querySelectorAll('.mobile-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Mostra la sezione richiesta
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');
        currentMobileSection = sectionId.replace('mobile-', '');
    }
    
    // Nascondi la sidebar
    const sidebar = document.getElementById('mobile-sidebar');
    if (sidebar) sidebar.classList.remove('active');
    
    // Aggiorna bottom nav
    updateBottomNav(sectionId.replace('mobile-', ''));
}

function showHomeMobile() {
    showMobileSection('mobile-home');
}

function showAllMoviesMobile() {
    showMobileSection('mobile-allMovies');
    loadMoviesMobile(1);
}

function showAllTVMobile() {
    showMobileSection('mobile-allTV');
    loadTVMobile(1);
}

function showCategoriesMobile() {
    showMobileSection('mobile-categories');
    loadCategoriesMobile();
}

function showPreferitiMobile() {
    showMobileSection('mobile-preferiti');
    loadPreferitiMobile();
}

function updateBottomNav(activeItem) {
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const navItem = document.querySelector(`.bottom-nav-item[onclick*="${activeItem}"]`);
    if (navItem) navItem.classList.add('active');
}

// ============ HOME MOBILE ============
async function loadMobileHomeData() {
    try {
        console.log('Caricamento dati home mobile...');
        
        // Carica trending
        const trendingData = await fetchTMDB('trending/all/day');
        if (trendingData.results && trendingData.results.length > 0) {
            populateMobileCarousel('mobile-trending-carousel', trendingData.results);
        }
        
        // Carica ultimi film
        const nowPlayingData = await fetchTMDB('movie/now_playing');
        if (nowPlayingData.results && nowPlayingData.results.length > 0) {
            populateMobileCarousel('mobile-nowPlaying-carousel', nowPlayingData.results);
        }
        
        // Carica ultime serie
        const onAirData = await fetchTMDB('tv/on_the_air');
        if (onAirData.results && onAirData.results.length > 0) {
            populateMobileCarousel('mobile-onTheAir-carousel', onAirData.results);
        }
        
    } catch (error) {
        console.error('Errore caricamento home mobile:', error);
    }
}

// ============ FILM MOBILE ============
async function loadMoviesMobile(page = 1) {
    try {
        mobileMoviePage = page;
        
        let apiUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=it-IT&sort_by=popularity.desc&page=${page}`;
        
        if (currentMovieMinYear) {
            apiUrl += `&primary_release_date.gte=${currentMovieMinYear}-01-01`;
        }
        if (currentMovieMaxYear) {
            apiUrl += `&primary_release_date.lte=${currentMovieMaxYear}-12-31`;
        }
        
        const res = await fetch(apiUrl);
        const data = await res.json();
        
        const grid = document.getElementById('mobile-allMovies-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        // Carica disponibilità per ogni film
        const availableMovies = [];
        for (const movie of data.results) {
            movie.media_type = "movie";
            const isAvailable = await checkAvailabilityOnVixsrc(movie.id, true);
            
            if (isAvailable) {
                grid.appendChild(createMobileCard(movie));
                availableMovies.push(movie);
            }
            
            if (availableMovies.length >= itemsPerPage) break;
        }
        
        // Aggiorna paginazione
        updateMoviePaginationMobile(data.total_pages, data.total_results);
        
        if (availableMovies.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-film"></i>
                    <p>Nessun film disponibile trovato</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Errore caricamento film mobile:', error);
    }
}

function updateMoviePaginationMobile(totalPages, totalResults) {
    const prevBtn = document.getElementById('mobile-movie-prev');
    const nextBtn = document.getElementById('mobile-movie-next');
    const pageInfo = document.getElementById('mobile-movie-page');
    
    if (prevBtn) prevBtn.disabled = mobileMoviePage <= 1;
    if (nextBtn) nextBtn.disabled = mobileMoviePage >= totalPages;
    if (pageInfo) pageInfo.textContent = `Pag. ${mobileMoviePage} (${totalResults} film)`;
}

function prevMoviePageMobile() {
    if (mobileMoviePage > 1) {
        mobileMoviePage--;
        loadMoviesMobile(mobileMoviePage);
    }
}

function nextMoviePageMobile() {
    mobileMoviePage++;
    loadMoviesMobile(mobileMoviePage);
}

// ============ SERIE TV MOBILE ============
async function loadTVMobile(page = 1) {
    try {
        mobileTVPage = page;
        
        let apiUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&language=it-IT&sort_by=popularity.desc&page=${page}`;
        
        if (currentTVMinYear) {
            apiUrl += `&first_air_date.gte=${currentTVMinYear}-01-01`;
        }
        if (currentTVMaxYear) {
            apiUrl += `&first_air_date.lte=${currentTVMaxYear}-12-31`;
        }
        
        const res = await fetch(apiUrl);
        const data = await res.json();
        
        const grid = document.getElementById('mobile-allTV-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        // Carica disponibilità per ogni serie
        const availableTV = [];
        for (const tv of data.results) {
            tv.media_type = "tv";
            const isAvailable = await checkTvSeriesAvailability(tv.id);
            
            if (isAvailable) {
                grid.appendChild(createMobileCard(tv));
                availableTV.push(tv);
            }
            
            if (availableTV.length >= itemsPerPage) break;
        }
        
        // Aggiorna paginazione
        updateTVPaginationMobile(data.total_pages, data.total_results);
        
        if (availableTV.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-tv"></i>
                    <p>Nessuna serie TV disponibile trovata</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Errore caricamento serie TV mobile:', error);
    }
}

function updateTVPaginationMobile(totalPages, totalResults) {
    const prevBtn = document.getElementById('mobile-tv-prev');
    const nextBtn = document.getElementById('mobile-tv-next');
    const pageInfo = document.getElementById('mobile-tv-page');
    
    if (prevBtn) prevBtn.disabled = mobileTVPage <= 1;
    if (nextBtn) nextBtn.disabled = mobileTVPage >= totalPages;
    if (pageInfo) pageInfo.textContent = `Pag. ${mobileTVPage} (${totalResults} serie)`;
}

function prevTVPageMobile() {
    if (mobileTVPage > 1) {
        mobileTVPage--;
        loadTVMobile(mobileTVPage);
    }
}

function nextTVPageMobile() {
    mobileTVPage++;
    loadTVMobile(mobileTVPage);
}

// ============ FILTRI MOBILE ============
function applyMovieFilterMobile() {
    const minYearInput = document.getElementById('mobile-movie-min-year');
    const maxYearInput = document.getElementById('mobile-movie-max-year');
    
    const minYear = minYearInput ? minYearInput.value : null;
    const maxYear = maxYearInput ? maxYearInput.value : null;
    
    // Validazione
    if (minYear && (parseInt(minYear) < 1888 || parseInt(minYear) > new Date().getFullYear() + 5)) {
        alert("Inserisci un anno valido (1888 - " + (new Date().getFullYear() + 5) + ")");
        return;
    }
    
    if (maxYear && (parseInt(maxYear) < 1888 || parseInt(maxYear) > new Date().getFullYear() + 5)) {
        alert("Inserisci un anno valido (1888 - " + (new Date().getFullYear() + 5) + ")");
        return;
    }
    
    if (minYear && maxYear && parseInt(minYear) > parseInt(maxYear)) {
        alert("L'anno 'Da' non può essere maggiore dell'anno 'A'");
        return;
    }
    
    currentMovieMinYear = minYear || null;
    currentMovieMaxYear = maxYear || null;
    
    loadMoviesMobile(1);
}

function applyTVFilterMobile() {
    const minYearInput = document.getElementById('mobile-tv-min-year');
    const maxYearInput = document.getElementById('mobile-tv-max-year');
    
    const minYear = minYearInput ? minYearInput.value : null;
    const maxYear = maxYearInput ? maxYearInput.value : null;
    
    // Validazione
    if (minYear && (parseInt(minYear) < 1888 || parseInt(minYear) > new Date().getFullYear() + 5)) {
        alert("Inserisci un anno valido (1888 - " + (new Date().getFullYear() + 5) + ")");
        return;
    }
    
    if (maxYear && (parseInt(maxYear) < 1888 || parseInt(maxYear) > new Date().getFullYear() + 5)) {
        alert("Inserisci un anno valido (1888 - " + (new Date().getFullYear() + 5) + ")");
        return;
    }
    
    if (minYear && maxYear && parseInt(minYear) > parseInt(maxYear)) {
        alert("L'anno 'Da' non può essere maggiore dell'anno 'A'");
        return;
    }
    
    currentTVMinYear = minYear || null;
    currentTVMaxYear = maxYear || null;
    
    loadTVMobile(1);
}

// ============ CATEGORIE MOBILE ============
const categories = [
    { id: 28, name: "Azione", icon: "💥" },
    { id: 12, name: "Avventura", icon: "🗺️" },
    { id: 16, name: "Animazione", icon: "🐭" },
    { id: 35, name: "Commedia", icon: "😂" },
    { id: 80, name: "Crime", icon: "🔫" },
    { id: 99, name: "Documentario", icon: "🎥" },
    { id: 18, name: "Dramma", icon: "🎭" },
    { id: 10751, name: "Famiglia", icon: "👨‍👩‍👧‍👦" },
    { id: 14, name: "Fantasy", icon: "🧙‍♂️" },
    { id: 36, name: "Storico", icon: "🏛️" },
    { id: 27, name: "Horror", icon: "👻" },
    { id: 10402, name: "Musical", icon: "🎵" },
    { id: 9648, name: "Mistero", icon: "🔍" },
    { id: 10749, name: "Romantico", icon: "❤️" },
    { id: 878, name: "Fantascienza", icon: "🚀" },
    { id: 10770, name: "TV Movie", icon: "📺" },
    { id: 53, name: "Thriller", icon: "🔪" },
    { id: 10752, name: "Guerra", icon: "⚔️" },
    { id: 37, name: "Western", icon: "🤠" }
];

function loadCategoriesMobile() {
    const grid = document.getElementById('mobile-categories-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    categories.forEach(category => {
        const categoryCard = document.createElement('div');
        categoryCard.className = 'mobile-category-card';
        categoryCard.innerHTML = `
            <div class="mobile-category-icon">${category.icon}</div>
            <div class="mobile-category-name">${category.name}</div>
        `;
        
        categoryCard.addEventListener('click', () => {
            showCategoryContentMobile(category);
        });
        
        grid.appendChild(categoryCard);
    });
}

async function showCategoryContentMobile(category) {
    mobileCategoryId = category.id;
    mobileCategoryName = category.name;
    
    showMobileSection('mobile-category-results');
    
    try {
        const apiUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=it-IT&sort_by=popularity.desc&page=1&with_genres=${category.id}`;
        const res = await fetch(apiUrl);
        const data = await res.json();
        
        const grid = document.getElementById('mobile-category-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        const availableMovies = [];
        for (const movie of data.results) {
            movie.media_type = "movie";
            const isAvailable = await checkAvailabilityOnVixsrc(movie.id, true);
            
            if (isAvailable) {
                grid.appendChild(createMobileCard(movie));
                availableMovies.push(movie);
            }
            
            if (availableMovies.length >= itemsPerPage) break;
        }
        
        if (availableMovies.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-film"></i>
                    <p>Nessun film disponibile nella categoria "${category.name}"</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error(`Errore caricamento categoria ${category.name}:`, error);
    }
}

// ============ PREFERITI MOBILE ============
function loadPreferitiMobile() {
    const container = document.getElementById('mobile-preferiti-list');
    const emptyState = document.getElementById('mobile-empty-preferiti');
    
    if (!container) return;
    
    const preferiti = getPreferiti();
    
    if (preferiti.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        container.innerHTML = '';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    container.innerHTML = '';
    
    // Carica i preferiti
    preferiti.forEach(itemId => {
        const [mediaType, tmdbId] = itemId.split('-');
        
        fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${API_KEY}&language=it-IT`)
            .then(res => res.json())
            .then(item => {
                item.media_type = mediaType;
                
                const card = createMobileCard(item);
                
                // Aggiungi bottone rimuovi
                const removeBtn = document.createElement('button');
                removeBtn.className = 'mobile-remove-btn';
                removeBtn.innerHTML = '<i class="fas fa-trash"></i>';
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    removePreferito(item);
                    card.remove();
                    updateMobileFavCount();
                };
                
                card.querySelector('.mobile-card-buttons').appendChild(removeBtn);
                container.appendChild(card);
            })
            .catch(error => {
                console.error(`Errore caricamento preferito ${itemId}:`, error);
            });
    });
}

function toggleFavoriteMobile(id, type, title, event) {
    if (event) event.stopPropagation();
    
    const preferiti = getPreferiti();
    const itemId = `${type}-${id}`;
    
    if (preferiti.includes(itemId)) {
        // Rimuovi dai preferiti
        removePreferito({id: id, media_type: type});
        if (event && event.target) {
            event.target.innerHTML = '<i class="fas fa-star"></i>';
            event.target.classList.remove('active');
        }
    } else {
        // Aggiungi ai preferiti
        addPreferito({id: id, media_type: type, title: title});
        if (event && event.target) {
            event.target.innerHTML = '<i class="fas fa-star"></i>';
            event.target.classList.add('active');
        }
    }
    
    // Se siamo nella sezione preferiti, ricarica
    if (currentMobileSection === 'preferiti') {
        loadPreferitiMobile();
    }
}

// ============ RICERCA MOBILE ============
function handleMobileSearch(e) {
    const query = e.target.value.trim();
    
    if (query.length < 2) {
        if (currentMobileSection === 'results') {
            showHomeMobile();
        }
        return;
    }
    
    performMobileSearch(query);
}

async function performMobileSearch(query) {
    try {
        showMobileSection('mobile-results');
        
        const data = await fetchTMDB('search/multi', {
            query: query,
            include_adult: false
        });
        
        const grid = document.getElementById('mobile-results-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        const filteredResults = data.results.filter(
            (item) => item.media_type !== "person" && item.poster_path
        );
        
        if (filteredResults.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>Nessun risultato trovato per "${query}"</p>
                </div>
            `;
            return;
        }
        
        // Verifica disponibilità
        let availableCount = 0;
        for (const item of filteredResults.slice(0, 20)) {
            const mediaType = item.media_type || (item.title ? "movie" : "tv");
            let isAvailable = false;
            
            if (mediaType === "movie") {
                isAvailable = await checkAvailabilityOnVixsrc(item.id, true);
            } else if (mediaType === "tv") {
                isAvailable = await checkTvSeriesAvailability(item.id);
            }
            
            if (isAvailable) {
                item.media_type = mediaType;
                grid.appendChild(createMobileCard(item));
                availableCount++;
            }
        }
        
        if (availableCount === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>Nessun contenuto disponibile trovato per "${query}"</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Errore ricerca mobile:', error);
    }
}

// ============ PLAYER MOBILE ============
async function openMobilePlayer(item) {
    showMobileSection('mobile-player');
    
    const title = item.title || item.name;
    const mediaType = item.media_type || (item.title ? "movie" : "tv");
    
    document.getElementById('mobile-player-title').textContent = title;
    
    // Carica dettagli aggiuntivi
    try {
        const details = await fetchTMDB(`${mediaType}/${item.id}`);
        
        const metaDiv = document.getElementById('mobile-player-meta');
        const overviewDiv = document.getElementById('mobile-player-overview');
        
        if (metaDiv) {
            let meta = [];
            if (details.release_date || details.first_air_date) {
                meta.push(new Date(details.release_date || details.first_air_date).getFullYear());
            }
            if (details.vote_average) {
                meta.push(`⭐ ${details.vote_average.toFixed(1)}/10`);
            }
            metaDiv.textContent = meta.join(' • ');
        }
        
        if (overviewDiv) {
            overviewDiv.textContent = details.overview || "Nessuna descrizione disponibile.";
        }
        
    } catch (error) {
        console.error('Errore caricamento dettagli:', error);
    }
    
    // Per serie TV, carica episodi
    if (mediaType === 'tv') {
        await loadTVSeasonsMobile(item.id);
    } else {
        // Per film, avvia direttamente la riproduzione
        playItemMobile(item.id, 'movie');
    }
}

async function loadTVSeasonsMobile(tvId) {
    try {
        const details = await fetchTMDB(`tv/${tvId}`);
        const seasons = details.seasons || [];
        
        const seasonSelect = document.getElementById('mobile-season-select');
        if (seasonSelect) {
            seasonSelect.innerHTML = '';
            
            seasons.forEach(season => {
                if (season.season_number > 0) {
                    const option = document.createElement('option');
                    option.value = season.season_number;
                    option.textContent = `Stagione ${season.season_number}`;
                    seasonSelect.appendChild(option);
                }
            });
            
            seasonSelect.onchange = () => {
                loadEpisodesMobile(tvId, parseInt(seasonSelect.value));
            };
            
            // Carica prima stagione
            if (seasons.length > 0) {
                loadEpisodesMobile(tvId, seasons[0].season_number);
            }
        }
    } catch (error) {
        console.error('Errore caricamento stagioni:', error);
    }
}

async function loadEpisodesMobile(tvId, seasonNum) {
    try {
        const data = await fetchTMDB(`tv/${tvId}/season/${seasonNum}`);
        const episodes = data.episodes || [];
        
        const episodesList = document.getElementById('mobile-episodes-list');
        if (episodesList) {
            episodesList.innerHTML = '';
            
            episodes.forEach(ep => {
                const episodeItem = document.createElement('div');
                episodeItem.className = 'mobile-episode-item';
                episodeItem.innerHTML = `
                    <div class="mobile-episode-number">Episodio ${ep.episode_number}</div>
                    <div class="mobile-episode-title">${ep.name || "Senza titolo"}</div>
                `;
                
                episodeItem.onclick = () => {
                    document.querySelectorAll('.mobile-episode-item').forEach(e => e.classList.remove('active'));
                    episodeItem.classList.add('active');
                    playItemMobile(tvId, 'tv', seasonNum, ep.episode_number);
                };
                
                episodesList.appendChild(episodeItem);
            });
        }
    } catch (error) {
        console.error('Errore caricamento episodi:', error);
    }
}

function playItemMobile(id, type, season = null, episode = null) {
    console.log(`Riproduzione ${type} ${id}`, season ? `S${season}E${episode}` : '');
    
    // Mostra messaggio di attesa
    alert('Riproduzione video - Funzionalità in sviluppo\n\nQuesta versione mobile dimostra il layout e la navigazione.\nLa riproduzione video completa richiede integrazioni aggiuntive.');
}

function closePlayerMobile() {
    showHomeMobile();
}

// ============ UTILITY FUNCTIONS ============
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

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ============ PULIZIA LOCALSTORAGE ============
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
                    // Ignora errori di parsing
                }
            }
        }
        
        if (removed > 0) {
            console.log(`Puliti ${removed} elementi scaduti`);
        }
    } catch (e) {
        console.error("Errore pulizia storage:", e);
    }
}

// ============ EVENT LISTENERS GLOBALI ============
document.addEventListener('keydown', function(e) {
    // Gestione tasti per TV/remote
    const focusedElement = document.activeElement;
    
    if (focusedElement && focusedElement.classList.contains('mobile-card')) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            focusedElement.click();
        }
    }
    
    if (e.key === 'Escape') {
        if (currentMobileSection === 'player') {
            closePlayerMobile();
        }
    }
});

// Pulisci storage scaduto al caricamento
cleanupExpiredStorage();