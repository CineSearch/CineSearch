// Sistema "Continua visione" ottimizzato per TV
class TVContinuaVisione {
    constructor() {
        this.items = [];
        this.loaded = false;
    }

    async load() {
        try {
            // Pulisci storage scaduto
            this.cleanupExpiredStorage();
            
            // Carica contenuti dallo storage
            await this.loadFromStorage();
            
            // Aggiorna UI
            this.updateUI();
            
            this.loaded = true;
            
        } catch (error) {
            console.error('Error loading continua visione:', error);
        }
    }

    cleanupExpiredStorage() {
        const now = Date.now();
        const keysToRemove = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('tv_videoTime_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data.expires && data.expires < now) {
                        keysToRemove.push(key);
                    }
                } catch (e) {
                    // Ignora errori di parsing
                }
            }
        }
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
    }

    async loadFromStorage() {
        this.items = [];
        const itemIds = new Set();
        
        // Cerca tutti gli elementi con progresso salvato
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('tv_videoTime_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    
                    // Solo se ha guardato per almeno 60 secondi
                    if (data.value > 60) {
                        const match = key.match(/tv_videoTime_(movie|tv)_(\d+)/);
                        if (match) {
                            const [, mediaType, tmdbId] = match;
                            const itemId = `${mediaType}-${tmdbId}`;
                            
                            if (!itemIds.has(itemId)) {
                                itemIds.add(itemId);
                                
                                // Carica dettagli da TMDB
                                const item = await this.loadItemDetails(mediaType, tmdbId);
                                if (item) {
                                    // Aggiungi storage keys per questa card
                                    const storageKeys = this.getStorageKeysForItem(mediaType, tmdbId);
                                    item.storageKeys = storageKeys;
                                    this.items.push(item);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error parsing storage item:', e);
                }
            }
        }
        
        // Ordina per ultima visualizzazione
        this.items.sort((a, b) => {
            const timeA = this.getLatestTime(a.storageKeys);
            const timeB = this.getLatestTime(b.storageKeys);
            return timeB - timeA;
        });
    }

    getStorageKeysForItem(mediaType, tmdbId) {
        const keys = [];
        const prefix = `tv_videoTime_${mediaType}_${tmdbId}`;
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                keys.push(key);
            }
        }
        
        return keys;
    }

    getLatestTime(storageKeys) {
        let latestTime = 0;
        
        storageKeys.forEach(key => {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                if (data && data.timestamp > latestTime) {
                    latestTime = data.timestamp;
                }
            } catch (e) {
                // Ignora errori
            }
        });
        
        return latestTime;
    }

    async loadItemDetails(mediaType, tmdbId) {
        try {
            const item = await tvApi.getDetails(mediaType, tmdbId);
            if (item) {
                item.media_type = mediaType;
                return item;
            }
        } catch (error) {
            console.error(`Error loading item ${mediaType}-${tmdbId}:`, error);
        }
        return null;
    }

    updateUI() {
        const carousel = document.getElementById('continua-carousel');
        const empty = document.getElementById('continua-empty');
        
        if (!carousel || !empty) return;
        
        carousel.innerHTML = '';
        
        if (this.items.length === 0) {
            carousel.style.display = 'none';
            empty.style.display = 'block';
            return;
        }
        
        carousel.style.display = 'flex';
        empty.style.display = 'none';
        
        // Mostra solo i primi 10 elementi
        const displayItems = this.items.slice(0, 10);
        
        displayItems.forEach((item, index) => {
            const card = createTVCard(item, item.storageKeys || [], true);
            const focusId = `continua-carousel-${index}`;
            
            card.setAttribute('data-focus', focusId);
            if (window.tvNavigation) {
                window.tvNavigation.addDynamicFocusElement(card, focusId);
            }
            
            carousel.appendChild(card);
        });
    }

    addProgress(item, currentTime, season = null, episode = null) {
        if (currentTime < 60) return; // Solo se guardato per almeno 60 secondi
        
        const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
        let storageKey = `tv_videoTime_${mediaType}_${item.id}`;
        
        if (mediaType === 'tv' && season !== null && episode !== null) {
            storageKey += `_S${season}_E${episode}`;
        }
        
        // Salva con scadenza di 30 giorni
        TVStorage.set(storageKey.replace('tv_', ''), currentTime, 2592000000);
        
        // Ricarica se necessario
        if (!this.items.some(i => i.id === item.id)) {
            this.load();
        }
    }

    removeItem(item) {
        // Rimuovi dallo storage
        const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
        const prefix = `tv_videoTime_${mediaType}_${item.id}`;
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                localStorage.removeItem(key);
                i--;
            }
        }
        
        // Rimuovi dalla lista
        this.items = this.items.filter(i => i.id !== item.id);
        
        // Aggiorna UI
        this.updateUI();
    }

    // Ricarica i dati
    async reload() {
        await this.load();
    }
}

// Istanza globale
const tvContinuaVisione = new TVContinuaVisione();

// Funzioni globali
async function loadContinuaDaStorage() {
    await tvContinuaVisione.load();
}

function addToContinuaVisione(item, currentTime, season = null, episode = null) {
    tvContinuaVisione.addProgress(item, currentTime, season, episode);
}

// Esponi al global scope
window.tvContinuaVisione = tvContinuaVisione;
window.loadContinuaDaStorage = loadContinuaDaStorage;
window.addToContinuaVisione = addToContinuaVisione;