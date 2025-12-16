// mobile-continua.js - Gestione "Continua Visione"

function showContinuaMobile() {
    showMobileSection('mobile-continua');
    loadContinuaMobile();
}

async function loadContinuaMobile() {
    const grid = document.getElementById('mobile-continua-grid');
    const emptyState = document.getElementById('mobile-empty-continua');
    
    if (!grid) return;
    
    try {
        // Trova tutte le chiavi di "Continua Visione" nel localStorage
        const continueKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("videoTime_")) {
                continueKeys.push(key);
            }
        }
        
        if (continueKeys.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            grid.innerHTML = '';
            return;
        }
        
        if (emptyState) emptyState.style.display = 'none';
        grid.innerHTML = '';
        
        // Processa ogni chiave
        const continueItems = [];
        
        for (const key of continueKeys) {
            try {
                // Formato: videoTime_movie_123 o videoTime_tv_123_S1_E1
                const parts = key.replace('videoTime_', '').split('_');
                if (parts.length < 2) continue;
                
                const mediaType = parts[0]; // 'movie' o 'tv'
                const tmdbId = parseInt(parts[1]);
                
                if (!tmdbId || isNaN(tmdbId)) continue;
                
                // Ottieni i dati di progresso
                const progressData = getFromStorage(key);
                if (!progressData || progressData < 60) continue; // Solo se guardato almeno 60 secondi
                
                // Ottieni dettagli dal TMDB
                const item = await fetchTMDB(`${mediaType}/${tmdbId}`);
                item.media_type = mediaType;
                item.progress = progressData;
                
                // Per le serie TV, aggiungi info stagione/episodio
                if (mediaType === 'tv' && parts.length >= 4) {
                    const season = parseInt(parts[2].replace('S', ''));
                    const episode = parseInt(parts[3].replace('E', ''));
                    
                    if (!isNaN(season) && !isNaN(episode)) {
                        item.season = season;
                        item.episode = episode;
                        
                        // Prova a ottenere dettagli episodio
                        try {
                            const episodeData = await fetchTMDB(`tv/${tmdbId}/season/${season}/episode/${episode}`);
                            item.episode_title = episodeData.name;
                        } catch (e) {
                            item.episode_title = `Episodio ${episode}`;
                        }
                    }
                }
                
                continueItems.push(item);
            } catch (error) {
                console.error(`Errore elaborazione ${key}:`, error);
            }
        }
        
        // Ordina per progresso (più recente/più avanzato)
        continueItems.sort((a, b) => b.progress - a.progress);
        
        // Crea le card per ogni elemento
        continueItems.forEach(item => {
            const card = createContinueCard(item);
            grid.appendChild(card);
        });
        
        if (continueItems.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
        }
        
    } catch (error) {
        console.error('Errore caricamento "Continua Visione":', error);
        showMobileError('Errore nel caricamento');
    }
}

function createContinueCard(item) {
    const card = document.createElement('div');
    card.className = 'mobile-card continue-card';
    
    const isMovie = item.media_type === 'movie';
    const imageUrl = item.poster_path 
        ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
        : 'https://via.placeholder.com/342x513?text=No+Image';
    
    const title = isMovie ? item.title : item.name;
    const subtitle = isMovie ? '' : `S${item.season || 1} E${item.episode || 1}`;
    
    // Calcola percentuale progresso
    let runtime = item.runtime || (isMovie ? 120 : 45); // Default 2h per film, 45min per serie
    const progressPercent = Math.min(100, Math.round((item.progress / runtime) * 100));
    
    card.innerHTML = `
        <img src="${imageUrl}" alt="${title}" class="mobile-card-image" 
             onerror="this.src='https://via.placeholder.com/342x513?text=Image+Error'">
        
        <!-- Barra di progresso -->
        <div class="mobile-progress-bar">
            <div class="mobile-progress-fill" style="width: ${progressPercent}%"></div>
        </div>
        
        <div class="mobile-card-content">
            <div class="mobile-card-title" title="${title}">${title}</div>
            
            <div class="mobile-continua-meta">
                <div class="mobile-progress-info">
                    <i class="fas fa-play-circle"></i>
                    <span>${Math.round(item.progress / 60)} min guardati</span>
                </div>
                ${!isMovie ? `<div class="mobile-episode-info">${subtitle}</div>` : ''}
            </div>
            
            <div class="mobile-card-buttons">
                <button class="mobile-card-btn play" 
                        onclick="playContinueItem(${item.id}, '${item.media_type}', ${item.season || 1}, ${item.episode || 1}, event)">
                    <i class="fas fa-play"></i>
                </button>
                <button class="mobile-card-btn remove-continue" 
                        onclick="removeContinueItem(${item.id}, '${item.media_type}', ${item.season || null}, ${item.episode || null}, this)">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
    
    // Click sulla card per riprodurre - USA LO STESSO MECCANISMO DELLA CARD NORMALE
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.mobile-card-btn')) {
            playContinueItem(item.id, item.media_type, item.season || 1, item.episode || 1);
        }
    });
    
    return card;
}

async function playContinueItem(tmdbId, mediaType, season = 1, episode = 1) {
    console.log(`Riproduci "Continua": ${mediaType} ${tmdbId} S${season}E${episode}`);
    
    try {
        // Carica i dettagli completi
        const details = await fetchTMDB(`${mediaType}/${tmdbId}`);
        details.media_type = mediaType;
        
        // Per serie TV, aggiungi info episodio se disponibile
        if (mediaType === 'tv') {
            details.season = season;
            details.episode = episode;
        }
        
        // Apri il player
        openMobilePlayer(details);
        
        // Per serie TV, avvia immediatamente l'episodio specifico
        if (mediaType === 'tv') {
            setTimeout(() => {
                playTVEpisodeMobile(tmdbId, season, episode);
            }, 1000);
        }
        
    } catch (error) {
        console.error('Errore playContinueItem:', error);
        showMobileError('Errore nel caricamento del contenuto');
    }
}

function removeContinueItem(tmdbId, mediaType, season = null, episode = null, button) {
    // Crea la chiave di storage
    let storageKey = `videoTime_${mediaType}_${tmdbId}`;
    if (mediaType === 'tv' && season !== null && episode !== null) {
        storageKey += `_S${season}_E${episode}`;
    }
    
    // Rimuovi dal localStorage
    localStorage.removeItem(storageKey);
    
    // Rimuovi la card dal DOM
    const card = button.closest('.mobile-card');
    if (card) {
        card.remove();
    }
    
    // Controlla se ci sono ancora elementi
    const grid = document.getElementById('mobile-continua-grid');
    if (grid && grid.children.length === 0) {
        const emptyState = document.getElementById('mobile-empty-continua');
        if (emptyState) emptyState.style.display = 'block';
    }
}

// Aggiungi questa funzione a mobile-player.js per aggiornare "Continua Visione" quando si guarda un video
function updateContinuaVisione() {
    if (currentMobileSection === 'continua') {
        loadContinuaMobile();
    }
}

// Esponi la funzione globalmente
window.showContinuaMobile = showContinuaMobile;
window.playContinueItem = playContinueItem;
window.removeContinueItem = removeContinueItem;
window.handlePlayClick = handlePlayClick;