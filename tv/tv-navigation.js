// Sistema di navigazione per TV/telecomando
class TVNavigation {
    constructor() {
        this.currentFocus = null;
        this.focusHistory = [];
        this.sectionHistory = ['home'];
        this.navMap = new Map();
        this.scrollDirection = 'vertical';
        this.upPressCount = 0; // Contatore per tasto SU
        this.downPressCount = 0; // Contatore per tasto GIÙ
        this.lastUpPressTime = 0;
        this.lastDownPressTime = 0;
        this.resetTimer = null;
        this.carouselMappings = {};
        this.init();
    }

    // Aggiungi questo metodo per gestire il conteggio dei tasti
    handleArrowKeyCount(key, direction) {
        const now = Date.now();
        const timeout = 1000; // 1 secondo per reset del contatore
        
        if (key === 'ArrowUp' && direction === 'up') {
            if (now - this.lastUpPressTime > timeout) {
                this.upPressCount = 0;
            }
            this.upPressCount++;
            this.lastUpPressTime = now;
            
            // Reset automatico dopo timeout
            clearTimeout(this.resetTimer);
            this.resetTimer = setTimeout(() => {
                this.upPressCount = 0;
            }, timeout);
            
        } else if (key === 'ArrowDown' && direction === 'down') {
            if (now - this.lastDownPressTime > timeout) {
                this.downPressCount = 0;
            }
            this.downPressCount++;
            this.lastDownPressTime = now;
            
            // Reset automatico dopo timeout
            clearTimeout(this.resetTimer);
            this.resetTimer = setTimeout(() => {
                this.downPressCount = 0;
            }, timeout);
        }
    }


    init() {
        // Mappa tutti gli elementi focusabili
        this.collectFocusableElements();
        this.setupCarouselButtons();
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
        
        // Setup observer per caroselli dinamici
        this.setupCarouselObserver();
    }
    
setupCarouselButtons() {
    // Assicura che tutti i pulsanti del carosello abbiano data-focus corretto
    document.querySelectorAll('.tv-carousel-btn.left').forEach((btn, index) => {
        const carouselId = btn.closest('.tv-carousel-wrapper')?.querySelector('.tv-carousel')?.id;
        if (carouselId) {
            const focusId = carouselId.replace('-carousel', '-left');
            btn.setAttribute('data-focus', focusId);
            btn.setAttribute('tabindex', '0');
            
            if (!this.navMap.has(focusId)) {
                this.addDynamicFocusElement(btn, focusId);
            }
        }
    });
    
    document.querySelectorAll('.tv-carousel-btn.right').forEach((btn, index) => {
        const carouselId = btn.closest('.tv-carousel-wrapper')?.querySelector('.tv-carousel')?.id;
        if (carouselId) {
            const focusId = carouselId.replace('-carousel', '-right');
            btn.setAttribute('data-focus', focusId);
            btn.setAttribute('tabindex', '0');
            
            if (!this.navMap.has(focusId)) {
                this.addDynamicFocusElement(btn, focusId);
            }
        }
    });
}

    setupCarouselObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    const carousel = mutation.target;
                    if (carousel.classList.contains('tv-carousel')) {
                        this.updateCarouselMappings(carousel.id);
                    }
                }
            });
        });
        
        // Osserva tutti i caroselli
        document.querySelectorAll('.tv-carousel').forEach(carousel => {
            observer.observe(carousel, { childList: true, subtree: true });
            this.updateCarouselMappings(carousel.id);
        });
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
              this.generateAllCarouselMappings();
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
                this.handleArrowKeyCount(key, 'up');
                // Se premuto 3 volte in successione, vai alla nav
                if (this.upPressCount >= 3) {
                    handled = this.goToNavFromCards();
                } else {
                    handled = this.navigate('up');
                }
                break;
            case 'ArrowDown':
                this.handleArrowKeyCount(key, 'down');
                // Se premuto 3 volte in successione, vai alla nav
                if (this.downPressCount >= 3) {
                    handled = this.goToNavFromCards();
                } else {
                    handled = this.navigate('down');
                }
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

    // Nuovo metodo per andare alla nav dalle card
    goToNavFromCards() {
        const currentElement = this.navMap.get(this.currentFocus);
        
        if (!currentElement) return false;
        
        // Controlla se siamo in una card (grid o carousel)
        const isInGrid = currentElement.closest('.tv-vertical-grid');
        const isInCarousel = currentElement.closest('.tv-carousel');
        
        if (isInGrid || isInCarousel) {
            // Vai al primo elemento della nav
            const firstNavBtn = document.querySelector('.tv-nav-btn');
            if (firstNavBtn) {
                const focusId = firstNavBtn.getAttribute('data-focus');
                this.setFocus(focusId);
                
                // Reset contatori
                this.upPressCount = 0;
                this.downPressCount = 0;
                
                return true;
            }
        }
        
        return false;
    }

    // Aggiungi questo metodo per navigazione verticale nelle grid
    navigateGrid(direction) {
        const currentElement = this.navMap.get(this.currentFocus);
        if (!currentElement) return false;
        
        const grid = currentElement.closest('.tv-vertical-grid');
        if (!grid) return false;
        
        const cards = Array.from(grid.querySelectorAll('[data-focus]'));
        const currentIndex = cards.indexOf(currentElement);
        
        if (direction === 'down' && currentIndex < cards.length - 1) {
            const nextCard = cards[currentIndex + 1];
            this.setFocus(nextCard.getAttribute('data-focus'));
            return true;
        } else if (direction === 'up' && currentIndex > 0) {
            const prevCard = cards[currentIndex - 1];
            this.setFocus(prevCard.getAttribute('data-focus'));
            return true;
        }
        
        // Se siamo all'inizio/fine della grid, usa la navigazione normale
        return this.fallbackNavigation(direction);
    }

    // Aggiungi questo metodo per navigazione nei caroselli
    navigateCarousel(direction) {
        const currentElement = this.navMap.get(this.currentFocus);
        if (!currentElement) return false;
        
        const carousel = currentElement.closest('.tv-carousel');
        if (!carousel) return false;
        
        const cards = Array.from(carousel.querySelectorAll('[data-focus]'));
        const currentIndex = cards.indexOf(currentElement);
        
        // Per i caroselli, su/giù naviga tra i caroselli stessi
        if (direction === 'up') {
            // Cerca il carosello sopra
            const carouselId = carousel.id;
            const upTarget = this.getUpTargetFromCarousel(carouselId);
            if (upTarget) {
                this.setFocus(upTarget);
                return true;
            }
        } else if (direction === 'down') {
            // Cerca il carosello sotto
            const carouselId = carousel.id;
            const downTarget = this.getDownTargetFromCarousel(carouselId);
            if (downTarget) {
                this.setFocus(downTarget);
                return true;
            }
        }
        
        return false;
    }
getUpTargetFromCarousel(carouselId) {
        // Mappatura carosello -> target sopra
        const carouselMap = {
            'trending-carousel': 'hero-trending',
            'now-playing-carousel': 'hero-movies',
            'on-air-carousel': 'hero-series',
            'continua-carousel': 'hero-favorites'
        };
        
        return carouselMap[carouselId] || null;
    }

    getDownTargetFromCarousel(carouselId) {
        // Mappatura carosello -> target sotto
        const carouselMap = {
            'trending-carousel': 'now-playing-carousel-0',
            'now-playing-carousel': 'on-air-carousel-0',
            'on-air-carousel': 'continua-carousel-0'
        };
        
        return carouselMap[carouselId] || null;
    }

navigate(direction) {
        if (!this.currentFocus) return false;
        
        // Controlla se siamo in un carosello
        const currentElement = this.navMap.get(this.currentFocus);
        const isInGrid = currentElement && currentElement.closest('.tv-vertical-grid');
        const isInCarousel = currentElement && currentElement.closest('.tv-carousel');
        
        // Per griglie verticali, navigazione su/giù tra elementi
        if (isInGrid && (direction === 'up' || direction === 'down')) {
            return this.navigateGrid(direction);
        }
        
        // Per caroselli orizzontali, navigazione sinistra/destra
        if (isInCarousel && (direction === 'left' || direction === 'right')) {
            return this.navigateCarousel(direction);
        }
        
        const mappings = this.getNavigationMappings();
        const current = this.currentFocus;
        
        if (mappings[current] && mappings[current][direction]) {
            const nextFocus = mappings[current][direction];
            if (this.navMap.has(nextFocus)) {
                this.setFocus(nextFocus);
                return true;
            }
        }
        
        // Navigazione di fallback per Web2App
        return this.fallbackNavigationWeb2App(direction);
    }

getNavigationMappings() {
    return {
        // Navigazione principale
        'nav-home': { 
            right: 'nav-movies', 
            down: 'hero-trending' 
        },
        'nav-movies': { 
            left: 'nav-home', 
            right: 'nav-series', 
            down: 'tv-continua-section'
        },
        'nav-series': { 
            left: 'nav-movies', 
            right: 'nav-categories', 
            down: 'tv-continua-section'
        },
        'nav-categories': { 
            left: 'nav-series', 
            right: 'nav-favorites', 
            down: 'tv-continua-section'
        },
        'nav-favorites': { 
            left: 'nav-categories', 
            right: 'nav-continue', 
            down: 'tv-continua-section'
        },
        'nav-continue': { 
            left: 'nav-favorites', 
            down: 'tv-continua-section'
        },
        
        // Barra di ricerca
        'search': { 
            up: 'nav-home', 
            right: 'cors', 
            down: 'preferiti' 
        },
        'cors': { 
            left: 'search', 
            right: 'preferiti', 
            up: 'nav-home' 
        },
        'preferiti': { 
            left: 'cors', 
            up: 'search' 
        },
        
        // Hero section
        'hero-trending': { 
            up: 'nav-home', 
            right: 'hero-movies', 
            down: 'trending-left'  // FIXED: Punta alla freccia sinistra del carosello
        },
        'hero-movies': { 
            left: 'hero-trending', 
            right: 'hero-series', 
            down: 'now-playing-left'
        },
        'hero-series': { 
            left: 'hero-movies', 
            right: 'hero-favorites', 
            down: 'on-air-left'
        },
        'hero-favorites': { 
            left: 'hero-series', 
            down: 'continua-left'
        },
        
        // Pulsanti carosello SINISTRA
        'trending-left': {
            right: 'trending-0',  // FIXED: Da sinistra va alla prima card
            left: null,
            up: 'hero-trending',
            down: 'trending-0'  // FIXED: Anche giù va alla prima card
        },
        'now-playing-left': {
            right: 'now-playing-0',
            left: null,
            up: 'hero-movies',
            down: 'now-playing-0'
        },
        'on-air-left': {
            right: 'on-air-0',
            left: null,
            up: 'hero-series',
            down: 'on-air-0'
        },
        'continua-left': {
            right: 'continua-0',
            left: null,
            up: 'hero-favorites',
            down: 'continua-0'
        },
        
        // Pulsanti carosello DESTRA
        'trending-right': {
            left: 'trending-9',  // FIXED: Da destra va all'ultima card
            right: null,
            up: 'hero-trending',
            down: 'trending-9'
        },
        'now-playing-right': {
            left: 'now-playing-9',
            right: null,
            up: 'hero-movies',
            down: 'now-playing-9'
        },
        'on-air-right': {
            left: 'on-air-9',
            right: null,
            up: 'hero-series',
            down: 'on-air-9'
        },
        'continua-right': {
            left: 'continua-9',
            right: null,
            up: 'hero-favorites',
            down: 'continua-9'
        },
        
        // Sezione CONTINUA
        'tv-continua-section': {
            up: 'nav-home',
            down: 'continua-left'
        }
    };
}

generateAllCarouselMappings() {
        // Resetta le mappature precedenti
        this.carouselMappings = {};
        
        // Per ogni carosello, genera mappature
        const carouselIds = [
            'trending-carousel',
            'now-playing-carousel',
            'popular-movies-carousel',
            'on-air-carousel',
            'popular-tv-carousel',
            'continua-carousel'
        ];
        
        carouselIds.forEach(carouselId => {
            this.updateCarouselMappings(carouselId);
        });
    }

    // METODO NUOVO: Aggiorna mappature per un carosello specifico
    updateCarouselMappings(carouselId) {
        const carousel = document.getElementById(carouselId);
        if (!carousel) return;
        
        const prefix = carouselId.replace('-carousel', '');
        const cards = Array.from(carousel.querySelectorAll('[data-focus]'));
        const wrapper = carousel.closest('.tv-carousel-wrapper');
        const leftBtn = wrapper?.querySelector('.tv-carousel-btn.left');
        const rightBtn = wrapper?.querySelector('.tv-carousel-btn.right');
        
        // Mappatura per il pulsante sinistro
        if (leftBtn) {
            const leftFocus = leftBtn.getAttribute('data-focus');
            if (leftFocus) {
                this.carouselMappings[leftFocus] = {
                    right: cards.length > 0 ? cards[0].getAttribute('data-focus') : (rightBtn?.getAttribute('data-focus') || null),
                    left: null
                };
            }
        }
        
        // Mappatura per ogni card
        cards.forEach((card, index) => {
            const focusId = card.getAttribute('data-focus');
            if (!focusId) return;
            
            const prevCard = index > 0 ? cards[index - 1].getAttribute('data-focus') : null;
            const nextCard = index < cards.length - 1 ? cards[index + 1].getAttribute('data-focus') : null;
            
            // Se non c'è una card precedente, il left va al pulsante sinistro
            if (!prevCard && leftBtn) {
                prevCard = leftBtn.getAttribute('data-focus');
            }
            
            // Se non c'è una card successiva, il right va al pulsante destro
            if (!nextCard && rightBtn) {
                nextCard = rightBtn.getAttribute('data-focus');
            }
            
            this.carouselMappings[focusId] = {
                left: prevCard,
                right: nextCard
            };
        });
        
        // Mappatura per il pulsante destro
        if (rightBtn) {
            const rightFocus = rightBtn.getAttribute('data-focus');
            if (rightFocus) {
                const lastCard = cards.length > 0 ? cards[cards.length - 1].getAttribute('data-focus') : null;
                this.carouselMappings[rightFocus] = {
                    left: lastCard || (leftBtn?.getAttribute('data-focus') || null),
                    right: null
                };
            }
        }
        
        // Aggiungi mappature verticali per le card
        cards.forEach((card, index) => {
            const focusId = card.getAttribute('data-focus');
            if (focusId) {
                this.carouselMappings[focusId].up = this.getUpTarget(focusId);
                this.carouselMappings[focusId].down = this.getDownTarget(focusId);
            }
        });
    }

    getUpTarget(focusId) {
        // Mappatura per freccia SU dalle card
        if (focusId.startsWith('trending-')) return 'tv-continua-section';
        if (focusId.startsWith('now-playing-')) return 'trending-0';
        if (focusId.startsWith('on-air-')) return 'now-playing-0';
        if (focusId.startsWith('continua-')) return 'on-air-0';
        return null;
    }

    getDownTarget(focusId) {
        // Mappatura per freccia GIÙ dalle card
        if (focusId.startsWith('trending-')) return 'now-playing-0';
        if (focusId.startsWith('now-playing-')) return 'on-air-0';
        if (focusId.startsWith('on-air-')) return 'continua-0';
        if (focusId.startsWith('continua-')) return 'hero-favorites';
        return null;
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
    // PRIMA controlla se c'è un popup aperto
    const popup = document.getElementById('card-popup');
    if (popup && popup.classList.contains('active')) {
        // Chiudi il popup invece di tornare alla home
        closeCardPopup();
        return true;
    }
    
    // Poi controlla se siamo nel player
    if (TV_STATE.currentSection === 'player' && window.tvPlayer) {
        tvPlayer.close();
        return true;
    }
    
    // Torna alla home solo se non siamo già nella home
    if (TV_STATE.currentSection !== 'home') {
        showHome();
        return true;
    }
    
    // Se siamo già nella home, il tasto indietro potrebbe chiudere l'app
    // (questo dipende dal sistema operativo della TV)
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
    // Se l'elemento esiste già, rimuovilo prima
    if (this.navMap.has(focusId)) {
        console.warn(`Focus ID already exists: ${focusId} - Replacing...`);
        this.removeFocusElement(focusId);
    }
    
    // Assicurati che l'elemento abbia tutti gli attributi necessari
    element.setAttribute('data-focus', focusId);
    element.setAttribute('tabindex', '0');
    element.setAttribute('role', 'button');
    
    // Aggiungi alla mappa
    this.navMap.set(focusId, element);
    
    // Event listeners per focus
    element.addEventListener('focus', () => this.onElementFocus(element, focusId));
    element.addEventListener('blur', () => this.onElementBlur(element));
    element.addEventListener('mouseenter', () => this.setFocus(focusId));
        element.addEventListener('click', () => this.setFocus(focusId));
        
        // Aggiorna mappature carosello se l'elemento è in un carosello
        const carousel = element.closest('.tv-carousel');
        if (carousel) {
            setTimeout(() => {
                this.updateCarouselMappings(carousel.id);
            }, 50);
        }
        
        // Per debug
        if (TV_CONFIG.debug) {
            console.log(`Added dynamic focus element: ${focusId}`);
        }
    }

refreshNavigationMap() {
    // Pulisci e ricostruisci la mappa
    this.navMap.clear();
    this.collectFocusableElements();
    
    // Reimposta il focus corrente se esiste ancora
    if (this.currentFocus && this.navMap.has(this.currentFocus)) {
        this.setFocus(this.currentFocus);
    } else if (this.navMap.size > 0) {
        // Fallback al primo elemento disponibile
        const firstKey = Array.from(this.navMap.keys())[0];
        this.setFocus(firstKey);
    }
    
    if (TV_CONFIG.debug) {
        console.log(`Navigation map refreshed. Total elements: ${this.navMap.size}`);
    }
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

function updateCarousel(carouselId, items) {
    const carousel = document.getElementById(carouselId);
    if (!carousel) return;
    
    carousel.innerHTML = '';
    
    if (items.length === 0) {
        carousel.innerHTML = '<div class="tv-empty-carousel">Nessun contenuto disponibile</div>';
        return;
    }
    
    // Assicurati che i pulsanti del carosello abbiano data-focus
    const wrapper = carousel.closest('.tv-carousel-wrapper');
    if (wrapper) {
        const leftBtn = wrapper.querySelector('.tv-carousel-btn.left');
        const rightBtn = wrapper.querySelector('.tv-carousel-btn.right');
        
        if (leftBtn && !leftBtn.hasAttribute('data-focus')) {
            leftBtn.setAttribute('data-focus', `${carouselId}-left`);
            leftBtn.setAttribute('tabindex', '0');
        }
        
        if (rightBtn && !rightBtn.hasAttribute('data-focus')) {
            rightBtn.setAttribute('data-focus', `${carouselId}-right`);
            rightBtn.setAttribute('tabindex', '0');
        }
    }
    
    items.forEach((item, index) => {
        const card = createTVCard(item, [], false);
        const focusId = `${carouselId.replace('-carousel', '')}-${index}`;
        
        // Assicurati che data-focus sia impostato correttamente
        card.setAttribute('data-focus', focusId);
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        
        // Aggiungi l'elemento alla mappa di navigazione
        if (tvNavigation) {
            tvNavigation.addDynamicFocusElement(card, focusId);
        }
        
        carousel.appendChild(card);
    });
    
    // Aggiorna le mappature del carosello
    if (tvNavigation) {
        setTimeout(() => {
            tvNavigation.updateCarouselMappings(carouselId);
            tvNavigation.collectFocusableElements();
        }, 100);
    }
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
                if (trending.status === 'fulfilled') {
            updateCarousel('trending-carousel', trending.value);
        }
        
        if (nowPlaying.status === 'fulfilled') {
            updateCarousel('now-playing-carousel', nowPlaying.value);
        }
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
        
        // IMPORTANTE: Refresh della navigazione dopo che tutto è caricato
        setTimeout(() => {
            if (tvNavigation) {
                tvNavigation.refreshNavigationMap();
                
                // Imposta focus su hero-trending se disponibile
                if (tvNavigation.navMap.has('hero-trending')) {
                    tvNavigation.setFocus('hero-trending');
                }
            }
        }, 500);
        
    } catch (error) {
        console.error("Error loading home content:", error);
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
        const focusId = `${carouselId.replace('-carousel', '')}-${index}`;
        
        // IMPORTANTE: Assicurati che data-focus sia impostato correttamente
        card.setAttribute('data-focus', focusId);
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        
        // Aggiungi l'elemento alla mappa di navigazione
        if (tvNavigation) {
            tvNavigation.addDynamicFocusElement(card, focusId);
        }
        
        carousel.appendChild(card);
    });
    
    // Force refresh della navigazione dopo l'aggiornamento del carosello
    if (tvNavigation) {
        setTimeout(() => {
            tvNavigation.collectFocusableElements();
        }, 100);
    }
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