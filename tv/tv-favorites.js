// Sistema preferiti ottimizzato per TV
class TVFavorites {
    static STORAGE_KEY = 'tv_favorites';
    static MAX_FAVORITES = 100;

    static get() {
        try {
            const favorites = TVStorage.get(this.STORAGE_KEY) || [];
            return Array.isArray(favorites) ? favorites : [];
        } catch (e) {
            console.error('Error getting favorites:', e);
            return [];
        }
    }

    static save(favorites) {
        try {
            // Limita il numero di preferiti
            if (favorites.length > this.MAX_FAVORITES) {
                favorites = favorites.slice(0, this.MAX_FAVORITES);
            }
            
            TVStorage.set(this.STORAGE_KEY, favorites);
            return true;
        } catch (e) {
            console.error('Error saving favorites:', e);
            return false;
        }
    }

    static isFavorite(item) {
        const favorites = this.get();
        const itemId = this.getItemId(item);
        return favorites.includes(itemId);
    }

    static add(item) {
        const favorites = this.get();
        const itemId = this.getItemId(item);
        
        if (!favorites.includes(itemId)) {
            favorites.push(itemId);
            this.save(favorites);
            
            // Aggiorna cache
            this.cacheItem(item);
            
            return true;
        }
        return false;
    }

    static remove(item) {
        const favorites = this.get();
        const itemId = this.getItemId(item);
        
        const index = favorites.indexOf(itemId);
        if (index > -1) {
            favorites.splice(index, 1);
            this.save(favorites);
            
            // Rimuovi dalla cache
            this.uncacheItem(itemId);
            
            return true;
        }
        return false;
    }

    static getItemId(item) {
        const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
        return `${mediaType}-${item.id}`;
    }

    static getCount() {
        return this.get().length;
    }

    static cacheItem(item) {
        const itemId = this.getItemId(item);
        TVStorage.set(`fav_item_${itemId}`, item, TV_CONFIG.CACHE_DURATION);
    }

    static uncacheItem(itemId) {
        TVStorage.remove(`fav_item_${itemId}`);
    }

    static getCachedItem(itemId) {
        return TVStorage.get(`fav_item_${itemId}`);
    }

    // Carica tutti i preferiti con dettagli
    static async loadAll() {
        const favoriteIds = this.get();
        const favorites = [];
        
        for (const itemId of favoriteIds) {
            try {
                // Controlla cache
                let item = this.getCachedItem(itemId);
                
                if (!item) {
                    // Carica da API
                    const [mediaType, tmdbId] = itemId.split('-');
                    item = await tvApi.getDetails(mediaType, tmdbId);
                    
                    if (item) {
                        item.media_type = mediaType;
                        this.cacheItem(item);
                    }
                }
                
                if (item) {
                    favorites.push(item);
                }
            } catch (error) {
                console.error(`Error loading favorite ${itemId}:`, error);
                // Continua con gli altri
            }
        }
        
        return favorites;
    }

    // Carica preferiti per una griglia
    static async loadForGrid(gridId) {
        const grid = document.getElementById(gridId);
        if (!grid) return;
        
        const favorites = await this.loadAll();
        grid.innerHTML = '';
        
        if (favorites.length === 0) {
            document.getElementById('tv-preferiti-empty').style.display = 'block';
            return;
        }
        
        document.getElementById('tv-preferiti-empty').style.display = 'none';
        
        favorites.forEach((item, index) => {
            const card = createTVFavoriteCard(item, index);
            
            // Imposta focus ID specifico per preferiti
            const focusId = `tv-favorite-${index}`;
            card.setAttribute('data-focus', focusId);
            
            if (window.tvNavigation) {
                window.tvNavigation.addDynamicFocusElement(card, focusId);
            }
            
            grid.appendChild(card);
        });
    }

    // Gestione tasti rapidi per preferiti
    static setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Solo se non siamo in un input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            // Tasto 'F' per aggiungere/rimuovere preferiti
            if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                
                const focusedElement = document.activeElement;
                if (focusedElement && focusedElement.classList.contains('tv-card')) {
                    const focusId = focusedElement.getAttribute('data-focus');
                    const cardData = window.tvCardSystem?.cards.get(focusId);
                    
                    if (cardData) {
                        const favBtn = focusedElement.querySelector('[data-action="favorite"]');
                        if (favBtn) {
                            window.tvCardSystem.toggleFavorite(focusedElement, cardData.item, favBtn);
                        }
                    }
                }
            }
        });
    }
}

// Inizializza
TVFavorites.setupKeyboardShortcuts();

// Funzioni globali
function loadTVFavorites() {
    showLoading(true, 'Caricamento preferiti...');
    
    TVFavorites.loadForGrid('tv-preferiti-grid').then(() => {
        showLoading(false);
    }).catch(error => {
        console.error('Error loading favorites:', error);
        showToast('Errore nel caricamento dei preferiti', 'error');
        showLoading(false);
    });
}

// Esponi al global scope
window.TVFavorites = TVFavorites;
window.loadTVFavorites = loadTVFavorites;