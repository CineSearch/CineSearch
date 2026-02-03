// Sistema di card ottimizzato per TV
class TVCardSystem {
    constructor() {
        this.cards = new Map();
        this.cardFocusPrefix = 'tv-card-';
        this.cardCounter = 0;
    }

    createCard(item, storageKeys = [], isRemovable = false, context = 'carousel') {
    const cardId = `${this.cardFocusPrefix}${this.cardCounter++}`;
    
    const card = document.createElement('div');
    card.className = 'tv-card';
    card.setAttribute('data-focus', cardId);
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${item.title || item.name} - ${item.media_type === 'movie' ? 'Film' : 'Serie TV'}`);
    
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
    const year = item.release_date?.slice(0, 4) || item.first_air_date?.slice(0, 4) || '—';
    const rating = item.vote_average?.toFixed(1) || '—';
    const type = mediaType === 'movie' ? 'Film' : 'Serie TV';
    
    const poster = item.poster_path 
        ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
        : 'https://via.placeholder.com/500x750?text=No+Image';
    
    // Controlla se ha progresso di visione
    const resumeInfo = this.getResumeInfo(storageKeys);
    
    // MODIFICA: Rimossa la stella dai pulsanti della card
    card.innerHTML = `
        <img src="${poster}" alt="${item.title || item.name}" class="tv-card-image" loading="lazy">
        
        ${resumeInfo ? `
            <div class="tv-resume-badge" aria-label="Riprendi da ${resumeInfo.time}">
                ${resumeInfo.season ? `S${resumeInfo.season} E${resumeInfo.episode}<br>` : ''}
                ⏪ ${resumeInfo.time}
            </div>
        ` : ''}
        
        <div class="tv-card-overlay">
            <div class="tv-card-title" aria-hidden="true">
                ${item.title || item.name}
            </div>
            
            <div class="tv-card-meta" aria-hidden="true">
                <span>${year}</span>
                <span>⭐ ${rating}</span>
                <span>${type}</span>
            </div>
            
            <div class="tv-card-buttons">
                ${isRemovable ? `
                    <button class="tv-card-btn remove" 
                            data-action="remove" 
                            aria-label="Rimuovi dalla visione"
                            tabindex="-1">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : ''}
                
                <!-- RIMOSSA LA STELLA -->
            </div>
        </div>
    `;
    
    // Aggiungi event listeners
    this.setupCardEvents(card, item, isRemovable, storageKeys);
    
    // Registra la card
    this.cards.set(cardId, {
        element: card,
        item: item,
        context: context
    });
    
    // Aggiungi alla navigazione
    if (window.tvNavigation) {
        window.tvNavigation.addDynamicFocusElement(card, cardId);
    }
    
    return card;
}

// Aggiungi queste nuove funzioni alla classe TVCardSystem:

// Sostituisci la funzione showCardPopup con questa:

showCardPopup(item) {
    // Salva l'item in modo sicuro
    try {
        // Serializza e deserializza per assicurare una copia pulita
        const itemClone = JSON.parse(JSON.stringify({
            id: item.id,
            title: item.title || item.name,
            name: item.name || item.title,
            media_type: item.media_type || (item.title ? 'movie' : 'tv'),
            release_date: item.release_date,
            first_air_date: item.first_air_date,
            vote_average: item.vote_average,
            overview: item.overview,
            poster_path: item.poster_path,
            backdrop_path: item.backdrop_path
        }));
        
        // Salva nello storage con un ID univoco
        const popupId = 'current_popup_item_' + Date.now();
        TVStorage.set(popupId, itemClone, 300000); // 5 minuti di scadenza
        window.currentPopupItemId = popupId;
        
        // Salva anche l'ID della card per ripristinare il focus
        const card = event?.currentTarget;
        if (card) {
            const cardFocusId = card.getAttribute('data-focus');
            if (cardFocusId) {
                window.currentPopupCardId = cardFocusId;
            }
        }
        
        // Aggiorna contenuto del popup
        this.updatePopupContent(itemClone);
        
        // Mostra popup e backdrop
        document.getElementById('card-popup').classList.add('active');
        document.getElementById('card-popup-backdrop').classList.add('active');
        
        // Focus sul pulsante play
        setTimeout(() => {
            document.getElementById('popup-play-btn').focus();
        }, 100);
        
        // Blocca scroll dello sfondo
        document.body.style.overflow = 'hidden';
        
    } catch (error) {
        console.error('Error showing card popup:', error);
        showToast('Errore nell\'apertura del popup', 'error');
    }
}

// Aggiungi questa nuova funzione:

updatePopupContent(item) {
    const title = item.title || item.name;
    const year = item.release_date?.slice(0, 4) || item.first_air_date?.slice(0, 4) || '—';
    const rating = item.vote_average?.toFixed(1) || '—';
    const type = item.media_type === 'movie' ? 'Film' : 'Serie TV';
    const overview = item.overview || 'Nessuna descrizione disponibile.';
    const poster = item.poster_path 
        ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
        : 'https://via.placeholder.com/500x750?text=No+Image';
    
    // Aggiorna DOM
    const titleElement = document.getElementById('popup-title');
    const posterElement = document.getElementById('popup-poster');
    const overviewElement = document.getElementById('popup-overview');
    const metaElement = document.getElementById('popup-meta');
    
    if (titleElement) titleElement.textContent = title;
    if (posterElement) {
        posterElement.src = poster;
        posterElement.alt = title;
    }
    if (overviewElement) overviewElement.textContent = overview;
    
    if (metaElement) {
        const metaHtml = `
            <div class="tv-popup-meta-item">${year}</div>
            <div class="tv-popup-meta-item">⭐ ${rating}</div>
            <div class="tv-popup-meta-item">${type}</div>
        `;
        metaElement.innerHTML = metaHtml;
    }
    
    // Aggiorna stato pulsante preferiti
    const isFavorite = TVFavorites.isFavorite(item);
    const favBtn = document.getElementById('popup-fav-btn');
    const favText = document.getElementById('popup-fav-text');
    
    if (favBtn && favText) {
        if (isFavorite) {
            favBtn.classList.add('active');
            favText.textContent = 'Rimuovi dai Preferiti';
        } else {
            favBtn.classList.remove('active');
            favText.textContent = 'Aggiungi ai Preferiti';
        }
    }
}

// Modifica la funzione handleCardClick:

handleCardClick(item, card) {
    try {
        // Mostra un'animazione di click
        if (card) {
            card.classList.add('tv-card-clicked');
            setTimeout(() => card.classList.remove('tv-card-clicked'), 300);
        }
        
        // Mostra il popup
        this.showCardPopup(item);
        
    } catch (error) {
        console.error('Error handling card click:', error);
        // Fallback: apri direttamente il player
        openTVPlayer(item);
    }
}

// Modifica la funzione closeCardPopup:

closeCardPopup() {
    try {
        const popup = document.getElementById('card-popup');
        const backdrop = document.getElementById('card-popup-backdrop');
        
        if (popup) popup.classList.remove('active');
        if (backdrop) backdrop.classList.remove('active');
        
        // Ripristina scroll
        document.body.style.overflow = '';
        
        // Pulisci lo storage
        if (window.currentPopupItemId) {
            TVStorage.remove(window.currentPopupItemId);
            delete window.currentPopupItemId;
        }
        
        // Ripristina focus se abbiamo salvato l'ID della card
        if (window.currentPopupCardId && window.tvNavigation) {
            // Verifica che la card esista ancora
            const cardExists = document.querySelector(`[data-focus="${window.currentPopupCardId}"]`);
            if (cardExists) {
                setTimeout(() => {
                    window.tvNavigation.setFocus(window.currentPopupCardId);
                }, 50);
            } else {
                // Fallback al primo elemento focusabile
                const firstFocusable = document.querySelector('[data-focus]');
                if (firstFocusable) {
                    const firstFocusId = firstFocusable.getAttribute('data-focus');
                    window.tvNavigation.setFocus(firstFocusId);
                }
            }
        }
        
        // Pulisci variabili
        delete window.currentPopupCardId;
        
    } catch (error) {
        console.error('Error closing popup:', error);
    }
}


    getResumeInfo(storageKeys) {
        for (const key of storageKeys) {
            try {
                const data = TVStorage.get(key.replace('tv_videoTime_', ''));
                if (data && data.value > 60) {
                    const match = key.match(/videoTime_(?:movie|tv)_\d+_S(\d+)_E(\d+)/);
                    return {
                        time: formatTime(data.value),
                        season: match ? match[1] : null,
                        episode: match ? match[2] : null
                    };
                }
            } catch (e) {
                // Ignora errori
            }
        }
        return null;
    }

    setupCardEvents(card, item, isRemovable, storageKeys) {
    // Click principale sulla card
    card.addEventListener('click', (e) => {
        this.handleCardClick(item, card);
    });
    
    // Gestione tasti sulla card
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.handleCardClick(item, card);
        }
    });
    
    // Pulsante rimuovi (solo per "Continua visione")
    if (isRemovable) {
        const removeBtn = card.querySelector('[data-action="remove"]');
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleRemove(card, item, storageKeys);
            });
            
            removeBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleRemove(card, item, storageKeys);
                }
            });
        }
    }
}


    toggleFavorite(card, item, favBtn) {
        const isFavorite = TVFavorites.isFavorite(item);
        
        if (isFavorite) {
            TVFavorites.remove(item);
            favBtn.classList.remove('active');
            favBtn.setAttribute('aria-label', 'Aggiungi ai preferiti');
            favBtn.innerHTML = '<i class="fas fa-star"></i>';
            
            showToast('Rimosso dai preferiti', 'success');
        } else {
            TVFavorites.add(item);
            favBtn.classList.add('active');
            favBtn.setAttribute('aria-label', 'Rimuovi dai preferiti');
            favBtn.innerHTML = '<i class="fas fa-star"></i>';
            
            showToast('Aggiunto ai preferiti', 'success');
        }
        
        // Aggiorna contatore
        updatePreferitiCounter();
        
        // Se siamo nella sezione preferiti, aggiorna
        if (TV_STATE.currentSection === 'preferiti') {
            loadTVFavorites();
        }
    }

    handleRemove(card, item, storageKeys) {
        const title = item.title || item.name;
        
        // Mostra conferma
        if (confirm(`Rimuovere "${title}" dalla sezione "Continua visione"?`)) {
            // Rimuovi dallo storage
            storageKeys.forEach(key => {
                TVStorage.remove(key.replace('tv_videoTime_', ''));
            });
            
            // Rimuovi dalla visualizzazione
            card.remove();
            
            // Rimuovi dalla navigazione
            const focusId = card.getAttribute('data-focus');
            if (focusId && window.tvNavigation) {
                window.tvNavigation.removeFocusElement(focusId);
            }
            
            // Aggiorna stato
            TV_STATE.shownContinuaIds.delete(item.id);
            
            // Controlla se la sezione è vuota
            const container = document.getElementById('continua-carousel');
            if (container && container.children.length === 0) {
                document.getElementById('continua-empty').style.display = 'block';
            }
            
            showToast('Rimosso dalla visione', 'success');
        }
    }

    // Crea card per griglie verticali (più compatte)
    createGridCard(item, index, context = 'grid') {
        const card = this.createCard(item, [], false, context);
        
        // Stile specifico per griglie
        card.classList.add('tv-grid-card');
        card.setAttribute('data-grid-index', index);
        
        return card;
    }

    // Crea card per preferiti
    createFavoriteCard(item, index) {
        const card = this.createCard(item, [], false, 'favorites');
        
        // Aggiungi pulsante rimuovi specifico per preferiti
        const removeBtn = document.createElement('button');
        removeBtn.className = 'tv-card-btn remove-favorite';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.setAttribute('aria-label', 'Rimuovi dai preferiti');
        removeBtn.setAttribute('tabindex', '-1');
        
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleFavorite(card, item, card.querySelector('.fav'));
        });
        
        const buttonsContainer = card.querySelector('.tv-card-buttons');
        if (buttonsContainer) {
            buttonsContainer.appendChild(removeBtn);
        }
        
        return card;
    }

    // Aggiorna lo stato di una card esistente
    updateCard(cardId, updates) {
        const cardData = this.cards.get(cardId);
        if (!cardData) return;
        
        const { element, item } = cardData;
        
        // Aggiorna i dati dell'item
        Object.assign(item, updates);
        
        // Puoi aggiungere qui la logica per aggiornare il DOM della card
        // se necessario
    }

    // Rimuovi tutte le card di un contesto specifico
    clearContext(context) {
        for (const [cardId, cardData] of this.cards.entries()) {
            if (cardData.context === context) {
                cardData.element.remove();
                
                if (window.tvNavigation) {
                    window.tvNavigation.removeFocusElement(cardId);
                }
                
                this.cards.delete(cardId);
            }
        }
    }

    // Scroll carosello
    scrollCarousel(carouselId, direction) {
        const carousel = document.getElementById(carouselId);
        if (!carousel) return;
        
        const scrollAmount = carousel.clientWidth * 0.8;
        carousel.scrollBy({
            left: direction * scrollAmount,
            behavior: 'smooth'
        });
    }

    // Focus sulla prima card di un carosello
    focusFirstCard(carouselId) {
        const carousel = document.getElementById(carouselId);
        if (!carousel || !carousel.firstChild) return;
        
        const firstCard = carousel.firstChild;
        const focusId = firstCard.getAttribute('data-focus');
        
        if (focusId && window.tvNavigation) {
            window.tvNavigation.setFocus(focusId);
        }
    }
}

// Istanza globale
const tvCardSystem = new TVCardSystem();

// Funzioni helper globali
function createTVCard(item, storageKeys = [], isRemovable = false) {
    return tvCardSystem.createCard(item, storageKeys, isRemovable);
}

function createTVGridCard(item, index) {
    return tvCardSystem.createGridCard(item, index);
}

function createTVFavoriteCard(item, index) {
    return tvCardSystem.createFavoriteCard(item, index);
}

function scrollCarousel(carouselId, direction) {
    tvCardSystem.scrollCarousel(carouselId, direction);
}

function updatePreferitiCounter() {
    const count = TVFavorites.getCount();
    const counter = document.getElementById('tv-preferiti-count');
    if (counter) {
        counter.textContent = count;
    }
}
function playFromPopup() {
    try {
        if (!window.currentPopupItemId) {
            throw new Error('No popup item ID found');
        }
        
        // Recupera l'item dallo storage
        const item = TVStorage.get(window.currentPopupItemId);
        if (!item) {
            throw new Error('Popup item not found in storage');
        }
        
        // Chiudi il popup prima
        closeCardPopup();
        
        // Aspetta un po' per la chiusura del popup
        setTimeout(() => {
            // Apri il player
            openTVPlayer(item);
        }, 150);
        
    } catch (error) {
        console.error('Error playing from popup:', error);
        showToast('Errore nell\'apertura del player', 'error');
        closeCardPopup();
    }
}

function toggleFavoriteFromPopup() {
    try {
        if (!window.currentPopupItemId) {
            throw new Error('No popup item ID found');
        }
        
        const item = TVStorage.get(window.currentPopupItemId);
        if (!item) {
            throw new Error('Popup item not found in storage');
        }
        
        const favBtn = document.getElementById('popup-fav-btn');
        const favText = document.getElementById('popup-fav-text');
        const isFavorite = TVFavorites.isFavorite(item);
        
        if (isFavorite) {
            TVFavorites.remove(item);
            if (favBtn) favBtn.classList.remove('active');
            if (favText) favText.textContent = 'Aggiungi ai Preferiti';
            showToast('Rimosso dai preferiti', 'success');
        } else {
            TVFavorites.add(item);
            if (favBtn) favBtn.classList.add('active');
            if (favText) favText.textContent = 'Rimuovi dai Preferiti';
            showToast('Aggiunto ai preferiti', 'success');
        }
        
        // Aggiorna contatore
        updatePreferitiCounter();
        
    } catch (error) {
        console.error('Error toggling favorite from popup:', error);
        showToast('Errore nella gestione dei preferiti', 'error');
    }
}

function closeCardPopup() {
    tvCardSystem.closeCardPopup();
}

// Esponi le nuove funzioni globali
window.playFromPopup = playFromPopup;
window.toggleFavoriteFromPopup = toggleFavoriteFromPopup;
window.closeCardPopup = closeCardPopup;
// Esponi al global scope
window.tvCardSystem = tvCardSystem;
window.createTVCard = createTVCard;
window.createTVGridCard = createTVGridCard;
window.createTVFavoriteCard = createTVFavoriteCard;
window.scrollCarousel = scrollCarousel;
window.updatePreferitiCounter = updatePreferitiCounter;