// Sistema di navigazione per TV/telecomando
class TVNavigation {
    constructor() {
        this.currentFocus = null;
        this.focusHistory = [];
        this.sectionHistory = ['home'];
        this.navMap = new Map();
        this.init();
    }

    init() {
        // Mappa tutti gli elementi focusabili
        this.collectFocusableElements();
        
        // Event listeners per telecomando
        document.addEventListener('keydown', this.handleKeyPress.bind(this));
        
        // Click per emulare OK/Enter
        document.addEventListener('click', (e) => {
            if (e.target.hasAttribute('data-focus')) {
                this.setFocus(e.target.getAttribute('data-focus'));
            }
        });
        
        // Inizializza con focus sulla home
        setTimeout(() => {
            this.setFocus('nav-home');
        }, 100);
    }

    collectFocusableElements() {
        // Raccoglie tutti gli elementi con data-focus
        const focusableElements = document.querySelectorAll('[data-focus]');
        
        focusableElements.forEach(el => {
            const focusId = el.getAttribute('data-focus');
            this.navMap.set(focusId, el);
            
            // Aggiungi attributi ARIA
            el.setAttribute('tabindex', '0');
            el.setAttribute('role', 'button');
            
            // Event listeners per focus
            el.addEventListener('focus', () => this.onElementFocus(el, focusId));
            el.addEventListener('blur', () => this.onElementBlur(el));
            el.addEventListener('mouseenter', () => this.setFocus(focusId));
            
            // Per elementi input
            if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
                el.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.handleElementAction(focusId);
                    }
                });
            }
        });
    }

    handleKeyPress(event) {
        // Ignora se siamo nel player
        if (TV_STATE.currentSection === 'player' && window.tvPlayer) {
            return window.tvPlayer.handleKeyPress(event);
        }
        
        const key = event.key;
        let handled = false;
        
        switch(key) {
            case 'ArrowUp':
                handled = this.navigate('up');
                break;
            case 'ArrowDown':
                handled = this.navigate('down');
                break;
            case 'ArrowLeft':
                handled = this.navigate('left');
                break;
            case 'ArrowRight':
                handled = this.navigate('right');
                break;
            case 'Enter':
            case ' ':
                handled = this.handleSelect();
                break;
            case 'Backspace':
            case 'Escape':
                handled = this.handleBack();
                break;
            case 'Home':
                handled = this.goToHome();
                break;
            case 'End':
                handled = this.goToEnd();
                break;
            case 'PageUp':
                handled = this.pageUp();
                break;
            case 'PageDown':
                handled = this.pageDown();
                break;
        }
        
        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    navigate(direction) {
        if (!this.currentFocus) return false;
        
        const mappings = this.getNavigationMappings();
        const current = this.currentFocus;
        
        if (mappings[current] && mappings[current][direction]) {
            const nextFocus = mappings[current][direction];
            if (this.navMap.has(nextFocus)) {
                this.setFocus(nextFocus);
                return true;
            }
        }
        
        // Navigazione di fallback
        return this.fallbackNavigation(direction);
    }

    getNavigationMappings() {
        // Mappa di navigazione per TV
        return {
            // Navigazione principale
            'nav-home': { right: 'nav-movies', down: 'hero-trending' },
            'nav-movies': { left: 'nav-home', right: 'nav-series', down: 'search' },
            'nav-series': { left: 'nav-movies', right: 'nav-categories', down: 'search' },
            'nav-categories': { left: 'nav-series', right: 'nav-favorites', down: 'search' },
            'nav-favorites': { left: 'nav-categories', right: 'nav-continue', down: 'search' },
            'nav-continue': { left: 'nav-favorites', down: 'search' },
            
            // Barra di ricerca
            'search': { up: 'nav-home', right: 'cors', down: 'preferiti' },
            'cors': { left: 'search', right: 'preferiti', up: 'nav-home' },
            'preferiti': { left: 'cors', up: 'search' },
            
            // Hero section
            'hero-trending': { up: 'nav-home', right: 'hero-movies', down: 'trending-carousel-0' },
            'hero-movies': { left: 'hero-trending', right: 'hero-series', down: 'tv-movie-grid-0' },
            'hero-series': { left: 'hero-movies', right: 'hero-favorites', down: 'tv-series-grid-0' },
            'hero-favorites': { left: 'hero-series', down: 'tv-favorite-0' }
        };
    }

    fallbackNavigation(direction) {
        const allFocusIds = Array.from(this.navMap.keys());
        const currentIndex = allFocusIds.indexOf(this.currentFocus);
        
        if (currentIndex === -1) return false;
        
        let nextIndex;
        switch(direction) {
            case 'right':
            case 'down':
                nextIndex = (currentIndex + 1) % allFocusIds.length;
                break;
            case 'left':
            case 'up':
                nextIndex = currentIndex > 0 ? currentIndex - 1 : allFocusIds.length - 1;
                break;
            default:
                return false;
        }
        
        this.setFocus(allFocusIds[nextIndex]);
        return true;
    }

    setFocus(focusId) {
        if (!this.navMap.has(focusId)) {
            console.warn(`Focus ID not found: ${focusId}`);
            return;
        }
        
        // Salva il focus precedente
        if (this.currentFocus) {
            this.focusHistory.push(this.currentFocus);
            if (this.focusHistory.length > 10) {
                this.focusHistory.shift();
            }
        }
        
        // Rimuovi focus precedente
        if (this.currentFocus && this.navMap.has(this.currentFocus)) {
            const prevEl = this.navMap.get(this.currentFocus);
            prevEl.classList.remove('tv-focused');
            prevEl.blur();
        }
        
        // Imposta nuovo focus
        this.currentFocus = focusId;
        const element = this.navMap.get(focusId);
        
        if (element) {
            element.classList.add('tv-focused');
            element.focus({ preventScroll: true });
            
            // Scrolla l'elemento in vista (per TV)
            this.scrollIntoView(element);
            
            // Aggiorna indicatore visivo
            this.updateFocusIndicator(element);
            
            // Log per debug (solo sviluppo)
            if (TV_CONFIG.debug) {
                console.log(`Focus set to: ${focusId}`);
            }
        }
    }

    scrollIntoView(element) {
        const container = element.closest('.tv-carousel-container, .tv-vertical-grid, .tv-main');
        if (!container) return;
        
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        
        // Calcola se l'elemento è fuori dalla vista
        if (elementRect.top < containerRect.top) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (elementRect.bottom > containerRect.bottom) {
            element.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }

    updateFocusIndicator(element) {
        const indicator = document.getElementById('focus-indicator');
        if (!indicator) return;
        
        const rect = element.getBoundingClientRect();
        indicator.style.cssText = `
            top: ${rect.top}px;
            left: ${rect.left}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            opacity: 1;
            transform: scale(1.05);
        `;
        
        // Rimuovi l'indicatore dopo l'animazione
        clearTimeout(this.indicatorTimeout);
        this.indicatorTimeout = setTimeout(() => {
            indicator.style.opacity = '0';
        }, 300);
    }

    handleSelect() {
        if (!this.currentFocus) return false;
        
        const element = this.navMap.get(this.currentFocus);
        if (!element) return false;
        
        // Simula click
        if (element.onclick) {
            element.onclick();
        } else if (element.tagName === 'BUTTON') {
            element.click();
        } else if (element.tagName === 'INPUT' && element.type === 'text') {
            // Per ricerca, avvia ricerca su Enter
            if (element.id === 'tv-search') {
                performTVSearch();
            }
        }
        
        return true;
    }

    handleBack() {
        // Torna alla home
        if (TV_STATE.currentSection !== 'home') {
            showHome();
            return true;
        }
        
        return false;
    }

    navigateToSection(sectionId) {
        // Nascondi tutte le sezioni
        document.querySelectorAll('.tv-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Mostra la sezione richiesta
        const section = document.getElementById(`tv-${sectionId}`);
        if (section) {
            section.classList.add('active');
            TV_STATE.currentSection = sectionId;
            
            // Aggiorna navigazione attiva
            document.querySelectorAll('.tv-nav-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            const navBtn = document.querySelector(`[data-focus="nav-${sectionId.replace('tv-', '')}"]`);
            if (navBtn) {
                navBtn.classList.add('active');
            }
            
            // Salva nella cronologia
            this.sectionHistory.push(sectionId);
            if (this.sectionHistory.length > 10) {
                this.sectionHistory.shift();
            }
            
            // Aggiorna stato globale
            TV_STATE.sectionHistory = this.sectionHistory;
            
            // Imposta focus appropriato per la sezione
            this.setInitialFocusForSection(sectionId);
        }
    }

    setInitialFocusForSection(sectionId) {
        let initialFocus;
        
        switch(sectionId) {
            case 'home':
                initialFocus = 'nav-home';
                break;
            case 'all-movies':
                initialFocus = 'tv-movie-grid-0';
                break;
            case 'all-series':
                initialFocus = 'tv-series-grid-0';
                break;
            case 'categories':
                initialFocus = 'tv-category-0';
                break;
            case 'preferiti':
                initialFocus = 'tv-favorite-0';
                break;
            case 'search-results':
                initialFocus = 'tv-search-result-0';
                break;
            default:
                initialFocus = 'nav-home';
        }
        
        setTimeout(() => {
            this.setFocus(initialFocus);
        }, 100);
    }

    goToHome() {
        showHome();
        return true;
    }

    goToEnd() {
        const allFocusIds = Array.from(this.navMap.keys());
        if (allFocusIds.length > 0) {
            this.setFocus(allFocusIds[allFocusIds.length - 1]);
            return true;
        }
        return false;
    }

    pageUp() {
        // Simula PageUp - scroll su
        window.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
        return true;
    }

    pageDown() {
        // Simula PageDown - scroll giù
        window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
        return true;
    }

    onElementFocus(element, focusId) {
        // Aggiorna lo stato
        TV_STATE.focusElement = focusId;
        
        // Aggiungi classe di focus
        element.classList.add('tv-element-focused');
        
        // Per elementi in caroselli, assicurati che siano visibili
        if (element.closest('.tv-carousel')) {
            const carousel = element.closest('.tv-carousel-container');
            if (carousel) {
                const scrollLeft = element.offsetLeft - (carousel.offsetWidth / 2) + (element.offsetWidth / 2);
                carousel.scrollTo({ left: scrollLeft, behavior: 'smooth' });
            }
        }
    }

    onElementBlur(element) {
        element.classList.remove('tv-element-focused');
    }

    handleElementAction(focusId) {
        const element = this.navMap.get(focusId);
        if (!element) return;
        
        // Gestisci azioni specifiche per tipo di elemento
        switch(focusId) {
            case 'tv-search':
                performTVSearch();
                break;
            case 'preferiti':
                showPreferiti();
                break;
            // Aggiungi altri casi specifici qui
        }
    }

    // Aggiungi elementi dinamici (per caroselli, griglie, ecc.)
    addDynamicFocusElement(element, focusId) {
        if (this.navMap.has(focusId)) {
            console.warn(`Focus ID already exists: ${focusId}`);
            return;
        }
        
        element.setAttribute('data-focus', focusId);
        element.setAttribute('tabindex', '0');
        element.setAttribute('role', 'button');
        
        this.navMap.set(focusId, element);
        
        element.addEventListener('focus', () => this.onElementFocus(element, focusId));
        element.addEventListener('blur', () => this.onElementBlur(element));
        element.addEventListener('mouseenter', () => this.setFocus(focusId));
        element.addEventListener('click', () => this.setFocus(focusId));
    }

    // Rimuovi elementi dinamici
    removeFocusElement(focusId) {
        if (this.navMap.has(focusId)) {
            const element = this.navMap.get(focusId);
            element.removeAttribute('data-focus');
            element.removeAttribute('tabindex');
            this.navMap.delete(focusId);
            
            if (this.currentFocus === focusId) {
                this.setFocus('nav-home'); // Fallback
            }
        }
    }

    // Reset navigazione quando si cambia sezione
    resetNavigation() {
        this.currentFocus = null;
        this.focusHistory = [];
        this.collectFocusableElements();
    }
}

// Inizializza navigazione
let tvNavigation = null;

function initTVNavigation() {
    tvNavigation = new TVNavigation();
    window.tvNavigation = tvNavigation;
}

// Funzioni globali per navigazione
function showHome() {
    if (tvNavigation) {
        tvNavigation.navigateToSection('home');
    }
    loadHomeContent();
}

function showAllMovies() {
    if (tvNavigation) {
        tvNavigation.navigateToSection('all-movies');
    }
    loadTVMovies();
}

function showAllTV() {
    if (tvNavigation) {
        tvNavigation.navigateToSection('all-series');
    }
    loadTVSeries();
}

function showCategories() {
    if (tvNavigation) {
        tvNavigation.navigateToSection('categories');
    }
    loadTVCategories();
}

function showPreferiti() {
    if (tvNavigation) {
        tvNavigation.navigateToSection('preferiti');
    }
    loadTVFavorites();
}

function showContinuaVisione() {
    // Se non siamo nella home, prima torna alla home
    if (TV_STATE.currentSection !== 'home') {
        showHome();
        
        // Dopo un breve ritardo, fai scroll alla sezione continua
        setTimeout(() => {
            const continuaSection = document.getElementById('tv-continua');
            if (continuaSection) {
                continuaSection.scrollIntoView({ behavior: 'smooth' });
                
                // Focus sul primo elemento della sezione continua
                setTimeout(() => {
                    if (tvNavigation) {
                        // Prova a focus sul primo elemento del carosello
                        const firstCard = document.querySelector('#continua-carousel [data-focus]');
                        if (firstCard) {
                            tvNavigation.setFocus(firstCard.getAttribute('data-focus'));
                        } else {
                            // Fallback
                            tvNavigation.setFocus('hero-trending');
                        }
                    }
                }, 200);
            }
        }, 500); // Ritardo per permettere il caricamento della home
    } else {
        // Siamo già nella home, fai solo scroll
        const continuaSection = document.getElementById('tv-continua');
        if (continuaSection) {
            continuaSection.scrollIntoView({ behavior: 'smooth' });
            
            // Focus sul primo elemento della sezione continua
            setTimeout(() => {
                if (tvNavigation) {
                    const firstCard = document.querySelector('#continua-carousel [data-focus]');
                    if (firstCard) {
                        tvNavigation.setFocus(firstCard.getAttribute('data-focus'));
                    } else {
                        tvNavigation.setFocus('hero-trending');
                    }
                }
            }, 200);
        }
    }
}

function goBackFromPlayer() {
    if (TV_STATE.previousSection && tvNavigation) {
        tvNavigation.navigateToSection(TV_STATE.previousSection);
    } else {
        showHome();
    }
}

// Carica contenuti home
async function loadHomeContent() {
    showLoading(true, "Caricamento contenuti disponibili...");
    
    try {
        // Carica contenuti filtrando solo quelli disponibili
        const [
            trending,
            nowPlaying,
            popularMovies,
            onTheAir,
            popularTV
        ] = await Promise.allSettled([
            tvApi.loadWithAvailability(TV_CONFIG.ENDPOINTS.trending),
            tvApi.loadWithAvailability(TV_CONFIG.ENDPOINTS.nowPlaying),
            tvApi.loadWithAvailability(TV_CONFIG.ENDPOINTS.popularMovies),
            tvApi.loadWithAvailability(TV_CONFIG.ENDPOINTS.onTheAir),
            tvApi.loadWithAvailability(TV_CONFIG.ENDPOINTS.popularTV)
        ]);
        
        // Aggiorna le sezioni
        if (trending.status === 'fulfilled') {
            updateCarousel('trending-carousel', trending.value);
        }
        
        if (nowPlaying.status === 'fulfilled') {
            updateCarousel('now-playing-carousel', nowPlaying.value);
        }
        
        if (popularMovies.status === 'fulfilled') {
            updateCarousel('popular-movies-carousel', popularMovies.value);
        }
        
        if (onTheAir.status === 'fulfilled') {
            updateCarousel('on-air-carousel', onTheAir.value);
        }
        
        if (popularTV.status === 'fulfilled') {
            updateCarousel('popular-tv-carousel', popularTV.value);
        }
        
        // Aggiorna preferiti counter
        updatePreferitiCounter();
        
        // Se nessun contenuto disponibile, mostra messaggio
        this.checkEmptySections();
        
        showLoading(false);
        
    } catch (error) {
        console.error("Error loading home content:", error);
        showToast("Errore nel caricamento dei contenuti", "error");
        showLoading(false);
    }
}

// Aggiungi funzione per verificare sezioni vuote
function checkEmptySections() {
    const sections = [
        'trending-carousel',
        'now-playing-carousel',
        'popular-movies-carousel',
        'on-air-carousel',
        'popular-tv-carousel'
    ];
    
    sections.forEach(sectionId => {
        const carousel = document.getElementById(sectionId);
        if (carousel && carousel.children.length === 0) {
            carousel.innerHTML = `
                <div class="tv-empty-carousel">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Nessun contenuto disponibile</p>
                </div>
            `;
        }
    });
}

// Funzioni helper
function updateCarousel(carouselId, items) {
    const carousel = document.getElementById(carouselId);
    if (!carousel) return;
    
    carousel.innerHTML = '';
    
    if (items.length === 0) {
        carousel.innerHTML = '<div class="tv-empty-carousel">Nessun contenuto disponibile</div>';
        return;
    }
    
    items.forEach((item, index) => {
        const card = createTVCard(item, [], false);
        const focusId = `${carouselId}-${index}`;
        card.setAttribute('data-focus', focusId);
        
        if (tvNavigation) {
            tvNavigation.addDynamicFocusElement(card, focusId);
        }
        
        carousel.appendChild(card);
    });
}

// Esponi al global scope
window.initTVNavigation = initTVNavigation;
window.showHome = showHome;
window.showAllMovies = showAllMovies;
window.showAllTV = showAllTV;
window.showCategories = showCategories;
window.showPreferiti = showPreferiti;
window.showContinuaVisione = showContinuaVisione;
window.goBackFromPlayer = goBackFromPlayer;
window.loadHomeContent = loadHomeContent;
window.updateCarousel = updateCarousel;