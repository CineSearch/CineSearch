// Inizializzazione completa per TV
async function initTVApp() {
    try {
        cleanupPopupStorage();
        
        // Mostra loading iniziale
        showLoading(true, 'Inizializzazione TV App...');
                
        // Inizializza configurazione
        await initTVConfig();
        
        // Inizializza navigazione
        initTVNavigation();
        
        // Inizializza CORS selector
        initCorsSelector();
        
        // Carica contenuti iniziali
        await loadInitialContent();
        
        // Setup event listeners
        setupTVEventListeners();
        
        // Nascondi loading
        setTimeout(() => {
            showLoading(false);
            showToast('CineSearch TV pronto!', 'success');
        }, 1000);
        
    } catch (error) {
        console.error('Error initializing TV app:', error);
        showToast('Errore nell\'inizializzazione', 'error');
        showLoading(false);
    }
}

async function initTVConfig() {
    // Carica configurazioni salvate
    const savedCors = TVStorage.get('cors_proxy');
    if (savedCors) {
        CURRENT_CORS_PROXY = savedCors;
    }
    
    // Aggiorna contatore preferiti
    updatePreferitiCounter();
    
    // Setup responsive design per TV
    setupTVResponsive();
}

async function loadInitialContent() {
    // Carica home content
    await loadHomeContent();
    
    // Pre-carica "Continua visione"
    loadContinuaDaStorage();
    
    // Pre-carica alcune categorie popolari
    preloadPopularCategories();
}

function setupTVEventListeners() {
    // Ricerca
    const searchInput = document.getElementById('tv-search');
    const searchBtn = document.getElementById('tv-search-btn');
    
    if (searchInput && searchBtn) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                performTVSearch();
            }
        });
        
        searchBtn.addEventListener('click', performTVSearch);
    }
    
    // Pulsante preferiti
    const preferitiBtn = document.getElementById('tv-preferiti-counter');
    if (preferitiBtn) {
        preferitiBtn.addEventListener('click', showPreferiti);
    }
    
    // Gestione errori di rete
    window.addEventListener('online', () => {
        showToast('Connessione ripristinata', 'success');
    });
    
    window.addEventListener('offline', () => {
        showToast('Connessione persa', 'error');
    });
    
    // Gestione visibility change (per TV che vanno in standby)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // App in background
            if (tvPlayer && tvPlayer.player && !tvPlayer.player.paused()) {
                tvPlayer.player.pause();
            }
        }
    });
    
    // Gestione beforeunload
    window.addEventListener('beforeunload', () => {
        // Salva stato corrente
        TVStorage.set('last_section', TV_STATE.currentSection);
        
        if (tvPlayer && tvPlayer.player && !tvPlayer.player.paused()) {
            tvPlayer.player.pause();
        }
    });
    
    // Gestione resize per TV
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            handleTVResize();
        }, 250);
    });

    // Observer per aggiornare la navigazione quando vengono aggiunte nuove card
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Se sono state aggiunte nuove card, refresh la navigazione
                setTimeout(() => {
                    if (tvNavigation && TV_STATE.currentSection === 'home') {
                        tvNavigation.refreshNavigationMap();
                    }
                }, 500);
            }
        });
    });
    
    // Click sul backdrop per chiudere il popup
    const backdrop = document.getElementById('card-popup-backdrop');
    if (backdrop) {
        backdrop.addEventListener('click', closeCardPopup);
    }
    
    // Tasti Escape/Backspace per chiudere popup
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Backspace') {
            const popup = document.getElementById('card-popup');
            if (popup && popup.classList.contains('active')) {
                e.preventDefault();
                e.stopPropagation();
                closeCardPopup();
            }
        }
    });

    // Osserva i caroselli
    document.querySelectorAll('.tv-carousel').forEach(carousel => {
        observer.observe(carousel, { childList: true });
    });
}

function setupTVResponsive() {
    // Rileva risoluzione TV
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Log per debug
    console.log(`TV Resolution: ${width}x${height}`);
    
    // Applica scaling per diverse risoluzioni
    if (width >= 3840) { // 4K
        document.documentElement.style.fontSize = '28px';
    } else if (width >= 1920) { // Full HD
        document.documentElement.style.fontSize = '24px';
    } else if (width >= 1280) { // HD
        document.documentElement.style.fontSize = '20px';
    }
    
    // Rileva se siamo su Smart TV
    detectTVPlatform();
}

function detectTVPlatform() {
    const ua = navigator.userAgent.toLowerCase();
    
    if (ua.includes('smarttv') || ua.includes('smart-tv')) {
        console.log('Smart TV detected');
        document.body.classList.add('smart-tv');
    }
    
    if (ua.includes('webos')) {
        console.log('LG WebOS detected');
        document.body.classList.add('webos');
    }
    
    if (ua.includes('tizen')) {
        console.log('Samsung Tizen detected');
        document.body.classList.add('tizen');
    }
    
    if (ua.includes('netcast')) {
        console.log('LG NetCast detected');
        document.body.classList.add('netcast');
    }
    
    if (ua.includes('appletv') || ua.includes('tvos')) {
        console.log('Apple TV detected');
        document.body.classList.add('appletv');
    }
    
    if (ua.includes('android') && ua.includes('tv')) {
        console.log('Android TV detected');
        document.body.classList.add('android-tv');
    }
    
    if (ua.includes('crkey')) {
        console.log('Chromecast detected');
        document.body.classList.add('chromecast');
    }
}

function handleTVResize() {
    // Aggiorna layout in base alla nuova dimensione
    setupTVResponsive();
    
    // Aggiorna dimensioni player se visibile
    if (tvPlayer && tvPlayer.player) {
        tvPlayer.player.trigger('resize');
    }
}

async function preloadPopularCategories() {
    // Pre-carica alcune categorie popolari in background
    const popularCategories = [28, 12, 35, 18, 878]; // Azione, Avventura, Commedia, Dramma, Fantascienza
    
    popularCategories.forEach(async genreId => {
        try {
            await tvApi.getByGenre(genreId, 1);
        } catch (error) {
            // Ignora errori in background
        }
    });
}

// Funzioni per film e serie
async function loadTVMovies(page = 1) {
    showLoading(true, 'Caricamento film...');
    
    try {
        const filters = {};
        if (TV_STATE.currentFilters.movies.minYear) {
            filters['primary_release_date.gte'] = `${TV_STATE.currentFilters.movies.minYear}-01-01`;
        }
        if (TV_STATE.currentFilters.movies.maxYear) {
            filters['primary_release_date.lte'] = `${TV_STATE.currentFilters.movies.maxYear}-12-31`;
        }
        
        const data = await tvApi.getAllMovies(page, filters);
        
        // Aggiorna stato
        TV_STATE.currentPage.movies = page;
        
        // Aggiorna UI
        updateMoviesGrid(data.results, page, data.total_pages, data.total_results);
        
        showLoading(false);
        
    } catch (error) {
        console.error('Error loading movies:', error);
        showToast('Errore nel caricamento dei film', 'error');
        showLoading(false);
    }
}

function updateMoviesGrid(movies, currentPage, totalPages, totalResults) {
    const grid = document.getElementById('tv-all-movies-grid');
    const paginationInfo = document.getElementById('tv-movie-pagination-info');
    const pageInfo = document.getElementById('tv-movie-page-info');
    const prevBtn = document.querySelector('#tv-all-movies .tv-page-btn.prev');
    const nextBtn = document.querySelector('#tv-all-movies .tv-page-btn.next');
    
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (movies.length === 0) {
        grid.innerHTML = `
            <div class="tv-empty-state" style="grid-column: 1 / -1;">
                <i class="fas fa-film"></i>
                <h3>Nessun film trovato</h3>
                <p>Prova con altri filtri</p>
            </div>
        `;
        return;
    }
    
    // Mostra film disponibili
    let availableCount = 0;
    
    movies.forEach((movie, index) => {
        movie.media_type = 'movie';
        const card = createTVGridCard(movie, index);
        const focusId = `tv-movie-grid-${index}`;
        
        card.setAttribute('data-focus', focusId);
        if (window.tvNavigation) {
            window.tvNavigation.addDynamicFocusElement(card, focusId);
        }
        
        grid.appendChild(card);
        availableCount++;
    });
    
    // Aggiorna paginazione
    if (paginationInfo) {
        const displayed = Math.min(totalResults, currentPage * TV_CONFIG.ITEMS_PER_PAGE);
        paginationInfo.textContent = `Mostrati ${availableCount} di ${totalResults} film`;
    }
    
    if (pageInfo) {
        pageInfo.textContent = `Pagina ${currentPage} di ${totalPages}`;
    }
    
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
    }
}

async function applyMovieYearFilter() {
    const minYearInput = document.getElementById('tv-movie-year-min');
    const maxYearInput = document.getElementById('tv-movie-year-max');
    
    const minYear = minYearInput?.value;
    const maxYear = maxYearInput?.value;
    
    // Validazione
    if (minYear && (parseInt(minYear) < 1888 || parseInt(minYear) > new Date().getFullYear() + 5)) {
        showToast(`Anno minimo non valido (1888-${new Date().getFullYear() + 5})`, 'warning');
        return;
    }
    
    if (maxYear && (parseInt(maxYear) < 1888 || parseInt(maxYear) > new Date().getFullYear() + 5)) {
        showToast(`Anno massimo non valido (1888-${new Date().getFullYear() + 5})`, 'warning');
        return;
    }
    
    if (minYear && maxYear && parseInt(minYear) > parseInt(maxYear)) {
        showToast('L\'anno "da" non può essere maggiore dell\'anno "a"', 'warning');
        return;
    }
    
    // Salva filtri
    TV_STATE.currentFilters.movies = {
        minYear: minYear || null,
        maxYear: maxYear || null
    };
    
    // Ricarica film
    loadTVMovies(1);
    
    const filters = document.getElementById('tv-movie-filters');
    const toggleBtn = document.getElementById('tv-movie-filter-toggle');
    const textElement = document.getElementById('tv-movie-filter-text');
    
    if (filters && toggleBtn && textElement) {
        filters.classList.remove('active');
        toggleBtn.classList.remove('active');
        textElement.textContent = 'Mostra Filtri Anno';
    }
}

function clearMovieYearFilter() {
    const minYearInput = document.getElementById('tv-movie-year-min');
    const maxYearInput = document.getElementById('tv-movie-year-max');
    
    if (minYearInput) minYearInput.value = '';
    if (maxYearInput) maxYearInput.value = '';
    
    TV_STATE.currentFilters.movies = { minYear: null, maxYear: null };
    loadTVMovies(1);
}

function nextMoviePage() {
    if (TV_STATE.currentPage.movies < 500) { // Limite API TMDB
        loadTVMovies(TV_STATE.currentPage.movies + 1);
    }
}

function prevMoviePage() {
    if (TV_STATE.currentPage.movies > 1) {
        loadTVMovies(TV_STATE.currentPage.movies - 1);
    }
}

// Funzioni per serie TV
async function loadTVSeries(page = 1) {
    showLoading(true, 'Caricamento serie TV...');
    
    try {
        const filters = {};
        if (TV_STATE.currentFilters.series.minYear) {
            filters['first_air_date.gte'] = `${TV_STATE.currentFilters.series.minYear}-01-01`;
        }
        if (TV_STATE.currentFilters.series.maxYear) {
            filters['first_air_date.lte'] = `${TV_STATE.currentFilters.series.maxYear}-12-31`;
        }
        
        const data = await tvApi.getAllTV(page, filters);
        
        // Aggiorna stato
        TV_STATE.currentPage.series = page;
        
        // Aggiorna UI
        updateSeriesGrid(data.results, page, data.total_pages, data.total_results);
        
        showLoading(false);
        
    } catch (error) {
        console.error('Error loading series:', error);
        showToast('Errore nel caricamento delle serie TV', 'error');
        showLoading(false);
    }
}

function updateSeriesGrid(series, currentPage, totalPages, totalResults) {
    const grid = document.getElementById('tv-all-series-grid');
    const paginationInfo = document.getElementById('tv-series-pagination-info');
    const pageInfo = document.getElementById('tv-series-page-info');
    const prevBtn = document.querySelector('#tv-all-series .tv-page-btn.prev');
    const nextBtn = document.querySelector('#tv-all-series .tv-page-btn.next');
    
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (series.length === 0) {
        grid.innerHTML = `
            <div class="tv-empty-state" style="grid-column: 1 / -1;">
                <i class="fas fa-tv"></i>
                <h3>Nessuna serie TV trovata</h3>
                <p>Prova con altri filtri</p>
            </div>
        `;
        return;
    }
    
    // Mostra serie disponibili
    let availableCount = 0;
    
    series.forEach((tv, index) => {
        tv.media_type = 'tv';
        const card = createTVGridCard(tv, index);
        const focusId = `tv-series-grid-${index}`;
        
        card.setAttribute('data-focus', focusId);
        if (window.tvNavigation) {
            window.tvNavigation.addDynamicFocusElement(card, focusId);
        }
        
        grid.appendChild(card);
        availableCount++;
    });
    
    // Aggiorna paginazione
    if (paginationInfo) {
        const displayed = Math.min(totalResults, currentPage * TV_CONFIG.ITEMS_PER_PAGE);
        paginationInfo.textContent = `Mostrati ${availableCount} di ${totalResults} serie`;
    }
    
    if (pageInfo) {
        pageInfo.textContent = `Pagina ${currentPage} di ${totalPages}`;
    }
    
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
    }
}

async function applySeriesYearFilter() {
    const minYearInput = document.getElementById('tv-series-year-min');
    const maxYearInput = document.getElementById('tv-series-year-max');
    
    const minYear = minYearInput?.value;
    const maxYear = maxYearInput?.value;
    
    // Validazione
    if (minYear && (parseInt(minYear) < 1888 || parseInt(minYear) > new Date().getFullYear() + 5)) {
        showToast(`Anno minimo non valido (1888-${new Date().getFullYear() + 5})`, 'warning');
        return;
    }
    
    if (maxYear && (parseInt(maxYear) < 1888 || parseInt(maxYear) > new Date().getFullYear() + 5)) {
        showToast(`Anno massimo non valido (1888-${new Date().getFullYear() + 5})`, 'warning');
        return;
    }
    
    if (minYear && maxYear && parseInt(minYear) > parseInt(maxYear)) {
        showToast('L\'anno "da" non può essere maggiore dell\'anno "a"', 'warning');
        return;
    }
    
    // Salva filtri
    TV_STATE.currentFilters.series = {
        minYear: minYear || null,
        maxYear: maxYear || null
    };
    
    // Ricarica serie
    loadTVSeries(1);
}

function clearSeriesYearFilter() {
    const minYearInput = document.getElementById('tv-series-year-min');
    const maxYearInput = document.getElementById('tv-series-year-max');
    
    if (minYearInput) minYearInput.value = '';
    if (maxYearInput) maxYearInput.value = '';
    
    TV_STATE.currentFilters.series = { minYear: null, maxYear: null };
    loadTVSeries(1);
}

function nextSeriesPage() {
    if (TV_STATE.currentPage.series < 500) {
        loadTVSeries(TV_STATE.currentPage.series + 1);
    }
}

function prevSeriesPage() {
    if (TV_STATE.currentPage.series > 1) {
        loadTVSeries(TV_STATE.currentPage.series - 1);
    }
}

// Avvia l'app quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    // Ritardo iniziale per TV più lente
    setTimeout(() => {
        initTVApp();
    }, 500);
});

// Aggiungi questa funzione per pulire lo storage dei popup
function cleanupPopupStorage() {
    // Pulisci tutti gli item popup scaduti
    const now = Date.now();
    const keysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('tv_current_popup_item_')) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                if (data.expires && data.expires < now) {
                    keysToRemove.push(key);
                }
            } catch (e) {
                keysToRemove.push(key);
            }
        }
    }
    
    keysToRemove.forEach(key => {
        localStorage.removeItem(key);
    });
    
    // Pulisci anche le variabili globali
    if (window.currentPopupItemId) {
        TVStorage.remove(window.currentPopupItemId);
        delete window.currentPopupItemId;
    }
    delete window.currentPopupCardId;
    delete window.currentPopupItem;
}

function toggleYearFilter(type) {
    const filtersId = `tv-${type}-filters`;
    const toggleBtnId = `tv-${type}-filter-toggle`;
    const textElementId = `tv-${type}-filter-text`;
    
    const filters = document.getElementById(filtersId);
    const toggleBtn = document.getElementById(toggleBtnId);
    const textElement = document.getElementById(textElementId);
    
    if (filters && toggleBtn && textElement) {
        if (filters.classList.contains('active')) {
            // Nascondi filtri
            filters.classList.remove('active');
            toggleBtn.classList.remove('active');
            textElement.textContent = 'Mostra Filtri Anno';
            
            // Focus sul pulsante toggle
            if (window.tvNavigation) {
                window.tvNavigation.setFocus(toggleBtnId);
            }
        } else {
            // Mostra filtri
            filters.classList.add('active');
            toggleBtn.classList.add('active');
            textElement.textContent = 'Nascondi Filtri';
            
            // Focus sul primo input
            setTimeout(() => {
                const firstInput = filters.querySelector('input[type="number"]');
                if (firstInput && window.tvNavigation) {
                    window.tvNavigation.setFocus(firstInput.id);
                }
            }, 100);
        }
    }
}

// Esponi funzioni globali
window.loadTVMovies = loadTVMovies;
window.loadTVSeries = loadTVSeries;
window.applyMovieYearFilter = applyMovieYearFilter;
window.clearMovieYearFilter = clearMovieYearFilter;
window.nextMoviePage = nextMoviePage;
window.prevMoviePage = prevMoviePage;
window.applySeriesYearFilter = applySeriesYearFilter;
window.clearSeriesYearFilter = clearSeriesYearFilter;
window.nextSeriesPage = nextSeriesPage;
window.prevSeriesPage = prevSeriesPage;
window.toggleYearFilter = toggleYearFilter;