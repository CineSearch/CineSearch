// Sistema player ottimizzato per TV
class TVPlayer {
    constructor() {
        this.player = null;
        this.currentItem = null;
        this.currentSeasons = [];
        this.currentEpisode = null;
        this.isFullscreen = false;
        this.keyboardEnabled = true;
        this.volume = TV_CONFIG.DEFAULT_VOLUME;
        this.qualitySelector = null;
        
        // Aggiungi questo binding esplicito
        this.handleKeyPress = this.handleKeyPress.bind(this);
        this.init();
    }
    
    validateItem(item) {
        if (!item) {
            throw new Error('Item is null or undefined');
        }
        
        if (!item.id) {
            throw new Error('Item missing ID');
        }
        
        // Assicurati che ci siano le proprietà di base
        item.title = item.title || item.name || 'Senza titolo';
        item.name = item.name || item.title || 'Senza titolo';
        item.media_type = item.media_type || (item.title !== undefined ? 'movie' : 'tv');
        
        return item;
    }
    
    init() {
        // Setup CORS hook per Video.js
        this.setupVideoJSCorsHook();
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    setupVideoJSCorsHook() {
    if (typeof videojs === 'undefined' || !videojs.Vhs) {
        setTimeout(() => this.setupVideoJSCorsHook(), 100);
        return;
    }
    
    const xhrRequestHook = (options) => {
        const originalUri = options.uri;
        
        if (!originalUri) {
            return options;
        }
        
        // Ottieni il proxy corrente dalla configurazione globale
        const currentProxy = window.CORS || "corsproxy.io/";
        
        // Gestione speciale per enc.key e altri file di cifratura
        if (originalUri.includes('/storage/enc.key') || 
            originalUri.includes('/storage/key')) {
            
            // Se è già un URL proxy ma manca l'URL target, ricostruiscilo
            if (originalUri.includes(currentProxy) && 
                !originalUri.includes(`${currentProxy}https://`)) {
                
                // Estrai la parte dopo il proxy
                const proxyPattern = currentProxy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`${proxyPattern}(.*)`);
                const match = originalUri.match(regex);
                
                if (match && match[1]) {
                    options.uri = applyCorsProxy(`https://vixsrc.to/${match[1]}`);
                }
                
            } else if (originalUri.includes('vixsrc.to')) {
                // Se contiene già vixsrc.to, applica il proxy normalmente
                options.uri = applyCorsProxy(originalUri);
            } else {
                // Altrimenti assume che sia relativo a vixsrc.to
                options.uri = applyCorsProxy(`https://vixsrc.to${originalUri}`);
            }
            
            console.log('Fixed encryption key URL:', originalUri, '→', options.uri);
            
        } else if (originalUri.includes('vixsrc.to')) {
            // URL normali di vixsrc.to
            options.uri = applyCorsProxy(originalUri);
        }
        
        // Gestione speciale per segmenti HLS che potrebbero avere URL diretti
        if (originalUri.includes('vix-content.net') || 
            originalUri.includes('.ts') || 
            originalUri.includes('.m3u8')) {
            
            // Se già ha un proxy ma è malformato, correggilo
            if (originalUri.includes(currentProxy) && 
                !originalUri.includes(`${currentProxy}https://`) &&
                !originalUri.includes('vixsrc.to')) {
                
                // Probabilmente un segmento HLS diretto che non ha bisogno di proxy
                const cleanUri = originalUri.replace(currentProxy, '');
                options.uri = cleanUri;
            }
        }
        
        return options;
    };
    
    videojs.Vhs.xhr.onRequest(xhrRequestHook);
}
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', this.handleKeyPress.bind(this));
    }
    
    setupEventListeners() {
        // Fullscreen change detection
        document.addEventListener('fullscreenchange', () => {
            this.isFullscreen = !!document.fullscreenElement;
        });
        
        document.addEventListener('webkitfullscreenchange', () => {
            this.isFullscreen = !!document.webkitFullscreenElement;
        });
    }
    
    async open(item) {
        try {
            // Valida l'item
            item = this.validateItem(item);
            
            // Salva sezione precedente
            TV_STATE.previousSection = TV_STATE.currentSection;
            
            // Imposta stato corrente
            TV_STATE.currentSection = 'player';
            this.currentItem = item;
            
            // Mostra sezione player
            this.showPlayerSection();
            
            // Carica info
            this.loadPlayerInfo(item);
            
            // Inizializza player se necessario
            if (!this.player) {
                this.initializePlayer();
            } else {
                // Se il player esiste già, resetta il sorgente
                this.player.src({});
                this.player.currentTime(0);
            }
            
            // Carica stream
            await this.loadStream(item);
            
        } catch (error) {
            console.error('Error opening player:', error);
            showToast('Errore nell\'apertura del player: ' + error.message, 'error');
            this.close();
        }
    }
    
    showPlayerSection() {
        // Nascondi tutte le sezioni
        document.querySelectorAll('.tv-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Mostra player
        const playerSection = document.getElementById('tv-player');
        if (playerSection) {
            playerSection.classList.add('active');
            
            // Scrolla in cima
            window.scrollTo(0, 0);
            
            // Imposta focus sul pulsante indietro
            setTimeout(() => {
                if (window.tvNavigation) {
                    window.tvNavigation.setFocus('tv-player-back-btn');
                }
            }, 100);
        }
    }
    
    handleKeyPress(event) {
        // Gestisci i tasti solo se siamo nel player
        if (TV_STATE.currentSection !== 'player' || !this.player) {
            return;
        }
        
        const key = event.key;
        let handled = false;
        
        switch(key) {
            case ' ':
            case 'Spacebar':
                handled = this.togglePlayPause();
                break;
            case 'ArrowLeft':
                handled = this.seek(-10);
                break;
            case 'ArrowRight':
                handled = this.seek(30);
                break;
            case 'ArrowUp':
                handled = this.adjustVolume(0.1);
                break;
            case 'ArrowDown':
                handled = this.adjustVolume(-0.1);
                break;
            case 'm':
            case 'M':
                handled = this.toggleMute();
                break;
            case 'f':
            case 'F':
                handled = this.toggleFullscreen();
                break;
            case 'Escape':
                if (this.isFullscreen) {
                    handled = this.exitFullscreen();
                } else {
                    this.close();
                }
                break;
            case '0':
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
            case '9':
                handled = this.seekToPercentage(parseInt(key) / 10);
                break;
        }
        
        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    }
    
    loadPlayerInfo(item) {
        try {
            // Valida l'item
            item = this.validateItem(item);
            
            const title = item.title || item.name || 'Senza titolo';
            const year = item.release_date?.slice(0, 4) || item.first_air_date?.slice(0, 4) || '—';
            const rating = item.vote_average?.toFixed(1) || '—';
            const type = item.media_type === 'movie' ? 'Film' : 'Serie TV';
            
            // Aggiorna titolo
            const titleElement = document.getElementById('tv-player-title');
            if (titleElement) {
                titleElement.textContent = title;
            }
            
            // Aggiorna meta
            const metaElement = document.getElementById('tv-player-meta');
            if (metaElement) {
                metaElement.innerHTML = `
                    <span class="tv-meta-year">${year}</span>
                    <span class="tv-meta-rating">⭐ ${rating}</span>
                    <span class="tv-meta-type">${type}</span>
                `;
            }
            
            // Per serie TV, carica le stagioni
            if (item.media_type === 'tv') {
                this.loadTVSeasons(item.id);
                const warningElement = document.getElementById('tv-episode-warning');
                if (warningElement) {
                    warningElement.style.display = 'flex';
                }
                const selectorElement = document.getElementById('tv-episode-selector');
                if (selectorElement) {
                    selectorElement.style.display = 'block';
                }
            } else {
                const warningElement = document.getElementById('tv-episode-warning');
                if (warningElement) {
                    warningElement.style.display = 'none';
                }
                const selectorElement = document.getElementById('tv-episode-selector');
                if (selectorElement) {
                    selectorElement.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Error loading player info:', error);
            throw error;
        }
    }
    
    async loadTVSeasons(tvId) {
        try {
            this.currentSeasons = await tvApi.getTVSeasons(tvId);
            this.populateSeasonSelector();
            
            if (this.currentSeasons.length > 0) {
                await this.loadEpisodes(this.currentSeasons[0].season_number);
            }
        } catch (error) {
            console.error('Error loading TV seasons:', error);
            showToast('Errore nel caricamento delle stagioni', 'error');
        }
    }
    
    populateSeasonSelector() {
        const selector = document.getElementById('tv-season-select');
        if (!selector) return;
        
        selector.innerHTML = '';
        
        this.currentSeasons.forEach(season => {
            const option = document.createElement('option');
            option.value = season.season_number;
            option.textContent = `Stagione ${season.season_number}`;
            selector.appendChild(option);
        });
        
        selector.onchange = (e) => {
            this.loadEpisodes(parseInt(e.target.value));
        };
    }
    
    async loadEpisodes(seasonNum) {
        try {
            const episodes = await tvApi.getEpisodes(this.currentItem.id, seasonNum);
            this.populateEpisodesList(episodes);
        } catch (error) {
            console.error('Error loading episodes:', error);
            showToast('Errore nel caricamento degli episodi', 'error');
        }
    }
    
    populateEpisodesList(episodes) {
        const container = document.getElementById('tv-episodes-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        episodes.forEach((episode, index) => {
            const episodeItem = document.createElement('div');
            episodeItem.className = 'tv-episode-item';
            episodeItem.setAttribute('data-focus', `tv-episode-${index}`);
            episodeItem.setAttribute('tabindex', '0');
            
            episodeItem.innerHTML = `
                <div class="tv-episode-number">Episodio ${episode.episode_number}</div>
                <div class="tv-episode-name">${episode.name || 'Senza titolo'}</div>
            `;
            
            episodeItem.addEventListener('click', () => {
                this.selectEpisode(episode, episodeItem);
            });
            
            episodeItem.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.selectEpisode(episode, episodeItem);
                }
            });
            
            // Aggiungi alla navigazione
            if (window.tvNavigation) {
                window.tvNavigation.addDynamicFocusElement(episodeItem, `tv-episode-${index}`);
            }
            
            container.appendChild(episodeItem);
        });
    }
    
    selectEpisode(episode, element) {
        // Rimuovi selezione precedente
        document.querySelectorAll('.tv-episode-item').forEach(el => {
            el.classList.remove('active');
        });
        
        // Aggiungi selezione corrente
        element.classList.add('active');
        
        // Nascondi warning
        const warningElement = document.getElementById('tv-episode-warning');
        if (warningElement) {
            warningElement.style.display = 'none';
        }
        
        // Imposta episodio corrente
        this.currentEpisode = episode;
        
        // Carica stream
        const seasonSelect = document.getElementById('tv-season-select');
        if (seasonSelect) {
            this.loadStream(this.currentItem, 
                           parseInt(seasonSelect.value),
                           episode.episode_number);
        }
    }
    
    initializePlayer() {
        const videoElement = document.getElementById('tv-player-video');
        if (!videoElement) {
            console.error('Video element not found');
            return;
        }
        
        // Distruggi player esistente
        if (this.player) {
            this.player.dispose();
        }
        
        // IMPORTANTE: Assicurati che il container esista
        const videoContainer = document.getElementById('tv-video-container');
        if (videoContainer) {
            // Rimuovi eventuali margini/padding problematici
            videoContainer.style.cssText = `
                position: relative;
                width: 100%;
                height: 0;
                padding-bottom: 56.25%; /* 16:9 aspect ratio */
                overflow: hidden;
                background: #000;
            `;
            
            // Posiziona il wrapper video correttamente
            const videoWrapper = videoContainer.querySelector('.tv-video-wrapper');
            if (videoWrapper) {
                videoWrapper.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                `;
            }
        }
        
        // Crea nuovo player con impostazioni ottimizzate per Firestick
        this.player = videojs('tv-player-video', {
            controls: true,
            fluid: false, // IMPORTANTE: Disabilita fluid per Firestick
            autoplay: false, // Disabilita autoplay per problemi su Firestick
            aspectRatio: '16:9',
            playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
            html5: {
                vhs: {
                    overrideNative: true,
                    limitRenditionByPlayerDimensions: true,
                    handleManifestRedirects: true,
                    enableLowInitialPlaylist: true,
                    smoothQualityChange: true,
                    useDevicePixelRatio: false // Disabilita per Firestick
                }
            },
            userActions: {
                hotkeys: false, // Disabilita hotkeys per problemi Firestick
                click: true,
                doubleClick: true
            },
            controlBar: {
                volumePanel: {
                    inline: false,
                    vertical: true
                },
                pictureInPictureToggle: false,
                children: [
                    'playToggle',
                    'volumePanel',
                    'currentTimeDisplay',
                    'timeDivider',
                    'durationDisplay',
                    'progressControl',
                    'remainingTimeDisplay',
                    'playbackRateMenuButton',
                    'qualitySelector',
                    'fullscreenToggle'
                ]
            },
            // Ottimizzazioni per Firestick
            inactivityTimeout: 3000,
            disablePictureInPicture: true,
            liveui: false,
            preload: 'auto',
            responsive: false, // Disabilita responsive per Firestick
            fullscreen: {
                options: {
                    navigationUI: 'hide'
                }
            }
        });
        this.player.hlsQualitySelector();
        this.player.ready(() => {
            const container = this.player.el();
            if (container) {
                container.style.width = '100%';
                container.style.height = '100%';
                container.style.position = 'absolute';
                container.style.top = '0';
                container.style.left = '0';
            }
            
            // Setup event listeners
            this.setupPlayerEvents();
            
            // Gestione speciale fullscreen per Firestick
            this.player.on('fullscreenchange', () => {
                const isFullscreen = this.player.isFullscreen();
                
                if (isFullscreen) {
                    // In fullscreen, usa dimensioni complete
                    this.player.el().style.width = '100vw';
                    this.player.el().style.height = '100vh';
                } else {
                    // Torna alle dimensioni normali
                    this.player.el().style.width = '100%';
                    this.player.el().style.height = '100%';
                }
            });
        });
    }
    
    // Funzione per correggere le richieste di chiavi di cifratura
    fixEncryptionKeyRequest() {
        if (!this.player.currentSource()) return;
        
        const source = this.player.currentSource();
        console.log('Current source:', source);
        
        // Se stiamo usando HLS e ci sono problemi con le chiavi
        if (source.type === 'application/x-mpegURL') {
            console.log('Re-inizializza player con URL corretto...');
            // Potrebbe essere necessario ricaricare il sorgente
        }
    }
    
    setupPlayerEvents() {
        if (!this.player) return;
        
        // Track progress
        this.player.on('timeupdate', () => {
            this.trackProgress();
        });
        
        // Error handling
        this.player.on('error', (error) => {
            console.error('Player error:', error);
            this.showError('Errore nella riproduzione');
        });
        
        // Fullscreen change
        this.player.on('fullscreenchange', () => {
            this.isFullscreen = this.player.isFullscreen();
        });
    }
    
    async loadStream(item, season = null, episode = null) {
        try {
            this.showLoading(true, 'Caricamento stream...');
            
            const isMovie = item.media_type === 'movie';
            const streamData = await tvApi.getStream(item.id, isMovie, season, episode);
            
            if (!streamData || !streamData.m3u8Url) {
                throw new Error('Stream non disponibile');
            }
            
            // Imposta sorgente
            if (this.player) {
                this.player.src({
                    src: streamData.m3u8Url,
                    type: 'application/x-mpegURL'
                });
                
                // Riprendi da dove avevi lasciato
                this.resumeFromProgress(item, season, episode);
                
                // Aspetta che il player sia pronto
                this.player.ready(() => {
                    // Riproduci automaticamente con un piccolo ritardo
                    setTimeout(() => {
                        this.player.play().catch(e => {
                            console.log('Autoplay fallito, utente deve premere play:', e);
                            showToast('Premi play per iniziare la riproduzione', 'info');
                        });
                        
                        // Full screen automatico con ritardo per caricamento (opzionale)
                        setTimeout(() => {
                            if (!this.player.isFullscreen()) {
                                this.player.requestFullscreen().catch(e => {
                                    console.log('Full screen automatico non supportato:', e);
                                });
                            }
                        }, 2000); // Ritardo per caricamento video
                    }, 500);
                });
            }
            
            this.showLoading(false);
            
        } catch (error) {
            console.error('Error loading stream:', error);
            this.showError('Impossibile caricare lo stream');
            this.showLoading(false);
        }
    }
    
    trackProgress() {
        if (!this.player || !this.currentItem) return;
        
        const currentTime = this.player.currentTime();
        const duration = this.player.duration();
        
        // Salva solo se abbiamo guardato per almeno 60 secondi
        if (currentTime > 60 && currentTime < duration - 30) {
            const mediaType = this.currentItem.media_type || 'movie';
            let storageKey = `videoTime_${mediaType}_${this.currentItem.id}`;
            
            if (mediaType === 'tv' && this.currentEpisode) {
                const seasonNum = parseInt(document.getElementById('tv-season-select').value);
                storageKey += `_S${seasonNum}_E${this.currentEpisode.episode_number}`;
            }
            
            TVStorage.set(storageKey, currentTime, 86400000); // 24 ore
            
            // Aggiungi alla visione continua
            if (window.addToContinuaVisione) {
                addToContinuaVisione(this.currentItem, currentTime, 
                    mediaType === 'tv' ? seasonNum : null, 
                    mediaType === 'tv' ? this.currentEpisode.episode_number : null);
            }
        }
    }
    
    resumeFromProgress(item, season = null, episode = null) {
        const mediaType = item.media_type || 'movie';
        let storageKey = `videoTime_${mediaType}_${item.id}`;
        
        if (mediaType === 'tv' && season && episode) {
            storageKey += `_S${season}_E${episode}`;
        }
        
        const savedTime = TVStorage.get(storageKey);
        if (savedTime && savedTime > 60 && this.player) {
            // Salva il tempo attuale per un ripristino più preciso
            setTimeout(() => {
                if (this.player) {
                    this.player.currentTime(savedTime);
                    
                    // Mostra notifica
                    this.showResumeNotification(savedTime);
                }
            }, 1000);
        }
    }
    
    showResumeNotification(time) {
        const timeStr = formatTime(time);
        showToast(`Ripresa da ${timeStr}`, 'success');
    }
    
    seek(seconds) {
        if (!this.player) return;
        
        const newTime = Math.max(0, Math.min(this.player.currentTime() + seconds, this.player.duration()));
        this.player.currentTime(newTime);
        
        // Mostra feedback
        const direction = seconds > 0 ? '+ ' : '- ';
        const absSeconds = Math.abs(seconds);
        this.showKeyFeedback(`${direction}${absSeconds}s`);
    }
    
    seekToPercentage(percentage) {
        if (!this.player) return;
        
        const newTime = this.player.duration() * percentage;
        this.player.currentTime(newTime);
        
        this.showKeyFeedback(`${Math.round(percentage * 100)}%`);
    }
    
    adjustVolume(delta) {
        if (!this.player) return;
        
        const newVolume = Math.max(0, Math.min(this.player.volume() + delta, 1));
        this.player.volume(newVolume);
        
        this.showKeyFeedback(`Volume: ${Math.round(newVolume * 100)}%`);
    }
    
    toggleMute() {
        if (!this.player) return;
        
        this.player.muted(!this.player.muted());
        
        if (this.player.muted()) {
            this.showKeyFeedback('Muto');
        } else {
            this.showKeyFeedback(`Volume: ${Math.round(this.player.volume() * 100)}%`);
        }
    }
    
    toggleFullscreen() {
        if (!this.player) return;
        
        if (this.player.isFullscreen()) {
            this.player.exitFullscreen();
        } else {
            this.player.requestFullscreen();
        }
    }
    
    exitFullscreen() {
        if (this.player && this.player.isFullscreen()) {
            this.player.exitFullscreen();
        }
    }
    
    showLoading(show, message = 'Caricamento...') {
        const overlay = document.getElementById('tv-loading-overlay');
        const text = overlay?.querySelector('.tv-loading-text');
        
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
        
        if (text && message) {
            text.textContent = message;
        }
    }
    
    showError(message) {
        showToast(message, 'error');
        
        // Crea elemento errore nel player
        const errorDiv = document.createElement('div');
        errorDiv.className = 'tv-player-error';
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Errore</h3>
            <p>${message}</p>
            <button class="tv-error-btn" onclick="tvPlayer.retry()">Riprova</button>
        `;
        
        const container = document.querySelector('.tv-video-container');
        if (container) {
            container.appendChild(errorDiv);
        }
    }
    
    showKeyFeedback(text) {
        const feedback = document.createElement('div');
        feedback.className = 'tv-key-feedback';
        feedback.textContent = text;
        
        const container = document.querySelector('.tv-video-container');
        if (container) {
            container.appendChild(feedback);
            
            setTimeout(() => {
                feedback.remove();
            }, 1000);
        }
    }
    
    retry() {
        if (this.currentItem) {
            const season = this.currentItem.media_type === 'tv' ? 
                          parseInt(document.getElementById('tv-season-select').value) : null;
            const episode = this.currentEpisode ? this.currentEpisode.episode_number : null;
            
            this.loadStream(this.currentItem, season, episode);
        }
        
        // Rimuovi errori esistenti
        document.querySelectorAll('.tv-player-error').forEach(el => el.remove());
    }
    
    close() {
        // Ferma il player
        if (this.player) {
            this.player.pause();
            // Non disporre il player per mantenere lo stato
        }
        
        // Torna alla sezione precedente
        if (TV_STATE.previousSection && window.tvNavigation) {
            window.tvNavigation.navigateToSection(TV_STATE.previousSection);
        } else {
            showHome();
        }
        
        // Reset stato
        this.currentItem = null;
        this.currentSeasons = [];
        this.currentEpisode = null;
        
        // Nascondi sezione player
        const playerSection = document.getElementById('tv-player');
        if (playerSection) {
            playerSection.classList.remove('active');
        }
    }
    
    togglePlayPause() {
        if (!this.player) return false;
        
        if (this.player.paused()) {
            this.player.play();
            this.showKeyFeedback('Play');
        } else {
            this.player.pause();
            this.showKeyFeedback('Pausa');
        }
        
        return true;
    }
}

// Istanza globale
const tvPlayer = new TVPlayer();

// Funzioni globali
function openTVPlayer(item) {
    tvPlayer.open(item);
}

function playerSeek(seconds) {
    tvPlayer.seek(seconds);
}

function togglePlayPause() {
    return tvPlayer.togglePlayPause();
}

function toggleFullscreen() {
    tvPlayer.toggleFullscreen();
}

// Esponi al global scope
window.tvPlayer = tvPlayer;
window.openTVPlayer = openTVPlayer;
window.playerSeek = playerSeek;
window.togglePlayPause = togglePlayPause;
window.toggleFullscreen = toggleFullscreen;