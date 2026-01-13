// mobile-player.js - Gestione player video (AGGIORNATO)

// ============ VARIABILI PLAYER ============
let currentMobileItem = null;
let currentMobileSeasons = [];
let mobilePlayer = null;
let currentStreamData = null;
let availableAudioTracks = [];
let availableSubtitles = [];
let availableQualities = [];

// ============ PLAYER FUNCTIONS ============
async function openMobilePlayer(item) {
    console.log("Apertura player per:", item);
    
    currentMobileItem = item;
    showMobileSection('mobile-player');
    
    const title = item.title || item.name;
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
    
    document.getElementById('mobile-player-title').textContent = title;
    
    hideAdditionalControls();
    
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
            if (details.runtime) {
                const hours = Math.floor(details.runtime / 60);
                const minutes = details.runtime % 60;
                meta.push(`${hours}h ${minutes}m`);
            }
            metaDiv.textContent = meta.join(' • ');
        }
        
        if (overviewDiv) {
            overviewDiv.textContent = details.overview || "Nessuna descrizione disponibile.";
        }
        
        if (mediaType === 'tv') {
            document.getElementById('mobile-episode-selector').style.display = 'block';
            await loadTVSeasonsMobile(item.id);            
        } else {
            setTimeout(() => playItemMobile(item.id, mediaType), 500);
        }
        
    } catch (error) {
        console.error('Errore caricamento dettagli:', error);
        showMobileError('Errore nel caricamento dei dettagli');
    }
}

function hideAdditionalControls() {
    const controls = document.getElementById('mobile-additional-controls');
    if (controls) {
        controls.style.display = 'none';
    }
}

function showAdditionalControls() {
    const controls = document.getElementById('mobile-additional-controls');
    if (controls) {
        controls.style.display = 'flex';
    }
}

async function playItemMobile(id, type, season = null, episode = null) {
    console.log(`Riproduzione ${type} ${id}`, season ? `S${season}E${episode}` : '');
    
    showMobileLoading(true, "Preparazione video...");
    
    try {
        // Distruggi player precedente
        if (mobilePlayer) {
            mobilePlayer.dispose();
            mobilePlayer = null;
        }
        
        const videoContainer = document.querySelector('.mobile-video-container');
        let videoElement = document.getElementById('mobile-player-video');
        
        if (!videoElement) {
            videoElement = document.createElement('video');
            videoElement.id = 'mobile-player-video';
            videoElement.className = 'video-js vjs-default-skin vjs-big-play-centered';
            videoElement.setAttribute('controls', '');
            videoElement.setAttribute('preload', 'auto');
            videoElement.setAttribute('playsinline', '');
            videoElement.setAttribute('webkit-playsinline', ''); // IMPORTANTE per iOS
            videoElement.setAttribute('x5-playsinline', ''); // Per alcuni browser mobile
            videoElement.setAttribute('crossorigin', 'anonymous');
            videoContainer.insertBefore(videoElement, videoContainer.firstChild);
        }
        
        // Ottieni stream M3U8
        const streamData = await getDirectStreamMobile(id, type === 'movie', season, episode);
        currentStreamData = streamData;
        
        if (!streamData || !streamData.m3u8Url) {
            throw new Error('Impossibile ottenere lo stream');
        }
        
        // IMPORTANTE: Controlla se l'M3U8 è accessibile
        const m3u8Url = streamData.m3u8Url;
        console.log('URL M3U8 originale:', m3u8Url);
        
        // Prova a fare un fetch per verificare l'accessibilità
        try {
            const testResponse = await fetch(m3u8Url, { method: 'HEAD' });
            console.log('Test accessibilità M3U8:', testResponse.status);
        } catch (e) {
            console.warn('M3U8 potrebbe non essere accessibile:', e.message);
        }
        
        // Configura Video.js per iOS
        setupVideoJsXhrHook();
        
        // Configurazione specifica per iOS
        const playerOptions = {
            controls: true,
            fluid: true,
            aspectRatio: "16:9",
            playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
            html5: {
                vhs: {
                    overrideNative: !videojs.browser.IS_SAFARI, // Non sovrascrivere su Safari
                    enableLowInitialPlaylist: true,
                    smoothQualityChange: true,
                    useDevicePixelRatio: true,
                    bandwidth: 2000000, // Aumenta bandwidth per iOS
                    withCredentials: false,
                    handleManifestRedirects: true,
                    customTagParsers: [],
                    customTagMappers: [],
                },
                nativeAudioTracks: false,
                nativeVideoTracks: false,
                nativeTextTracks: false
            },
            controlBar: {
                children: [
                    'playToggle',
                    'volumePanel',
                    'currentTimeDisplay',
                    'timeDivider',
                    'durationDisplay',
                    'progressControl',
                    'remainingTimeDisplay',
                    'playbackRateMenuButton',
                    'fullscreenToggle',
                ],
            },
            liveui: false,
            enableSourceset: true,
            suppressNotSupportedError: false,
            preload: 'auto'
        };
        
        // Inizializza il player
        mobilePlayer = videojs('mobile-player-video', playerOptions);
        
        // IMPORTANTE: Aggiungi gestione errori specifica per iOS
        mobilePlayer.tech_.on('retryplaylist', function() {
            console.log('📱 iOS - Retry playlist chiamato');
            mobilePlayer.src({
                src: m3u8Url,
                type: 'application/x-mpegURL',
                withCredentials: false
            });
        });
        
        // Imposta la sorgente
        mobilePlayer.src({
            src: m3u8Url,
            type: 'application/x-mpegURL',
            withCredentials: false
        });
        
        // Gestione errori dettagliata
        mobilePlayer.on('error', function (e) {
            const error = mobilePlayer.error();
            console.error('📱 iOS - Video.js error:', error);
            
            switch(error.code) {
                case 1: // MEDIA_ERR_ABORTED
                    console.log('Utente ha annullato il caricamento');
                    break;
                case 2: // MEDIA_ERR_NETWORK
                    console.log('Errore di rete, riprovo...');
                    // Riprova una volta
                    setTimeout(() => {
                        mobilePlayer.src({
                            src: m3u8Url,
                            type: 'application/x-mpegURL'
                        });
                    }, 2000);
                    break;
                case 3: // MEDIA_ERR_DECODE
                    console.log('Errore decodifica - formato non supportato');
                    showMobileError('Formato video non supportato su iOS');
                    break;
                case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
                    console.log('Sorgente non supportata');
                    // Prova a usare il proxy CORS
                    const proxiedUrl = applyCorsProxy(m3u8Url);
                    console.log('Provo con proxy:', proxiedUrl);
                    mobilePlayer.src({
                        src: proxiedUrl,
                        type: 'application/x-mpegURL'
                    });
                    break;
            }
        });
        
        mobilePlayer.ready(() => {
            showMobileLoading(false);
            console.log('✅ Player ready su iOS');
            
            // Riproduci automaticamente (iOS potrebbe bloccare)
            const playPromise = mobilePlayer.play();
            
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.log('📱 iOS - Auto-play bloccato, richiede interazione utente');
                    // Mostra messaggio informativo
                    showMobileInfo('Tocca il video per avviare la riproduzione');
                });
            }
        });
        
        // Monitora lo stato del caricamento
        mobilePlayer.on('loadstart', () => {
            console.log('📱 iOS - Loadstart');
        });
        
        mobilePlayer.on('loadedmetadata', () => {
            console.log('📱 iOS - Metadata caricati');
        });
        
        mobilePlayer.on('loadeddata', () => {
            console.log('📱 iOS - Dati caricati');
        });
        
        mobilePlayer.on('canplay', () => {
            console.log('📱 iOS - Video può essere riprodotto');
        });
        
        mobilePlayer.on('playing', () => {
            console.log('📱 iOS - Riproduzione iniziata');
        });
        
    } catch (error) {
        console.error('📱 iOS - Errore riproduzione mobile:', error);
        showMobileLoading(false);
        showMobileError(`Impossibile riprodurre: ${error.message}`);
    }
}
function initQualitySelectorPlugin() {
    try {
        // Controlla se il plugin esiste come oggetto globale
        if (typeof window.videojsHlsQualitySelector !== 'undefined') {
            // Registra solo se non è già registrato
            if (typeof videojs.getPlugin('hlsQualitySelector') === 'undefined') {
                videojs.registerPlugin('hlsQualitySelector', window.videojsHlsQualitySelector);
                console.log('✅ Plugin qualità registrato');
            }
            
            // Applica il plugin
            mobilePlayer.hlsQualitySelector({
                displayCurrentQuality: true,
                placementIndex: 7
            });
            console.log('✅ Plugin qualità inizializzato');
            return true;
        }
        
        // Se il plugin è già registrato globalmente
        if (typeof videojs.getPlugin('hlsQualitySelector') !== 'undefined') {
            mobilePlayer.hlsQualitySelector({
                displayCurrentQuality: true
            });
            console.log('✅ Plugin qualità già attivo');
            return true;
        }
        
        console.warn('⚠️ Plugin qualità non trovato');
        return false;
    } catch (error) {
        console.error('Errore inizializzazione plugin qualità:', error);
        return false;
    }
}

// ============ GESTIONE QUALITÀ ============
function extractAvailableQualities() {
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 20;
        
        function checkVhs() {
            attempts++;
            
            try {
                // METODO CORRETTO per ottenere il tech
                const tech = mobilePlayer.tech_;
                
                if (!tech) {
                    console.log(`Tentativo ${attempts}: Tech non disponibile`);
                    if (attempts < maxAttempts) {
                        setTimeout(checkVhs, 500);
                    } else {
                        console.warn('❌ Tech non disponibile dopo massimi tentativi');
                        resolve([]);
                    }
                    return;
                }
                
                if (!tech.vhs) {
                    console.log(`Tentativo ${attempts}: VHS non disponibile`);
                    if (attempts < maxAttempts) {
                        setTimeout(checkVhs, 500);
                    } else {
                        console.warn('❌ VHS non disponibile dopo massimi tentativi');
                        resolve([]);
                    }
                    return;
                }
                
                const vhs = tech.vhs;
                const playlists = vhs.playlists || {};
                const master = playlists.master;
                
                if (!master || !master.playlists) {
                    console.log(`Tentativo ${attempts}: Master playlist non pronta`);
                    if (attempts < maxAttempts) {
                        setTimeout(checkVhs, 500);
                    } else {
                        console.warn('❌ Master playlist non pronta');
                        resolve([]);
                    }
                    return;
                }
                
                // SUCCESSO: VHS è pronto!
                console.log(`✅ VHS pronto dopo ${attempts} tentativi`);
                
                availableQualities = [];
                
                // Estrai qualità dalla master playlist
                master.playlists.forEach((playlist, index) => {
                    if (playlist.attributes) {
                        const height = playlist.attributes.RESOLUTION ? 
                            playlist.attributes.RESOLUTION.height : 
                            playlist.attributes.HEIGHT || 0;
                        
                        const width = playlist.attributes.RESOLUTION ? 
                            playlist.attributes.RESOLUTION.width : 
                            playlist.attributes.WIDTH || 0;
                        
                        const bandwidth = playlist.attributes.BANDWIDTH || 0;
                        
                        // Determina etichetta qualità
                        let label = 'Auto';
                        if (height >= 2160) label = '4K';
                        else if (height >= 1440) label = 'QHD';
                        else if (height >= 1080) label = 'FHD';
                        else if (height >= 720) label = 'HD';
                        else if (height >= 480) label = 'SD';
                        else if (height > 0) label = `${height}p`;
                        
                        if (label !== 'Auto') {
                            availableQualities.push({
                                index: index,
                                label: label,
                                resolution: `${width}x${height}`,
                                height: height,
                                bandwidth: bandwidth,
                            });
                        }
                    }
                });
                
                console.log('Qualità estratte:', availableQualities);
                
                // Aggiorna il dropdown
                updateQualitySelector();
                
                // Se ci sono qualità, informa anche il plugin
                if (availableQualities.length > 0) {
                    console.log(`✅ ${availableQualities.length} qualità disponibili`);
                    
                    // Aggiorna il plugin se esiste
                    if (mobilePlayer.hlsQualitySelector) {
                        setTimeout(() => {
                            try {
                                // Forza refresh del plugin
                                mobilePlayer.controlBar.trigger('qualitychange');
                            } catch (e) {
                                // Ignora errori del plugin
                            }
                        }, 1000);
                    }
                }
                
                resolve(availableQualities);
                
            } catch (error) {
                if (attempts < maxAttempts) {
                    setTimeout(checkVhs, 500);
                } else {
                    resolve([]);
                }
            }
        }
        
        // Inizia il controllo
        console.log('Inizio estrazione qualità...');
        setTimeout(checkVhs, 1000);
    });
}

function updateQualitySelector() {
    const qualitySelect = document.getElementById('mobile-quality-select');
    if (!qualitySelect) return;
    
    qualitySelect.innerHTML = '';
    
    // Aggiungi opzione automatica
    const autoOption = document.createElement('option');
    autoOption.value = 'auto';
    autoOption.textContent = 'Auto';
    qualitySelect.appendChild(autoOption);
    
    // Aggiungi tutte le qualità disponibili
    availableQualities.forEach((quality, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${quality.label} (${quality.resolution})`;
        qualitySelect.appendChild(option);
    });
    
    // Imposta qualità attuale - METODO CORRETTO
    const tech = mobilePlayer.tech_;
    if (tech && tech.vhs) {
        try {
            const currentQuality = tech.vhs.selectPlaylist();
            if (currentQuality !== -1 && currentQuality < availableQualities.length) {
                qualitySelect.value = currentQuality;
            }
        } catch (e) {
            console.log('Impossibile ottenere qualità corrente:', e);
        }
    }
    
    // Aggiungi evento change
    qualitySelect.onchange = function() {
        changeMobileQuality(this.value);
    };
}

function changeMobileQuality(qualityIndex) {
    // METODO CORRETTO per ottenere il VHS
    const tech = mobilePlayer.tech_;
    if (!tech || !tech.vhs) return;
    
    try {
        const vhs = tech.vhs;
        
        if (qualityIndex === 'auto') {
            // Modalità automatica
            vhs.playlists.media();
            console.log('Qualità impostata su: Auto');
        } else {
            const index = parseInt(qualityIndex);
            if (!isNaN(index) && index >= 0 && index < availableQualities.length) {
                vhs.playlists.media(index);
                console.log(`Qualità cambiata a: ${availableQualities[index].label}`);
            }
        }
        
        // Forza aggiornamento
        mobilePlayer.trigger('loadstart');
    } catch (error) {
        console.error('Errore cambio qualità:', error);
    }
}

// ============ GESTIONE LINGUA AUDIO ============
function extractAudioTracks() {
    try {
        if (!mobilePlayer || !mobilePlayer.audioTracks) {
            console.log('Tracce audio non disponibili');
            availableAudioTracks = [];
            return;
        }
        
        const audioTracks = mobilePlayer.audioTracks();
        availableAudioTracks = [];
        
        for (let i = 0; i < audioTracks.length; i++) {
            const track = audioTracks[i];
            availableAudioTracks.push({
                id: track.id || i,
                language: track.language || 'und',
                label: track.label || `Audio ${i + 1}`,
                enabled: track.enabled || false,
            });
        }
        
        console.log('Tracce audio disponibili:', availableAudioTracks);
        
        // Aggiorna dropdown audio
        updateAudioSelector();
        
        return availableAudioTracks;
    } catch (error) {
        console.error('Errore estrazione tracce audio:', error);
        availableAudioTracks = [];
        return [];
    }
}

function updateAudioSelector() {
    const audioSelect = document.getElementById('mobile-audio-select');
    if (!audioSelect || availableAudioTracks.length === 0) return;
    
    audioSelect.innerHTML = '';
    
    availableAudioTracks.forEach((track, index) => {
        const option = document.createElement('option');
        option.value = index;
        
        // Formatta etichetta lingua
        let label = track.label;
        if (track.language && track.language !== 'und') {
            const langName = getLanguageName(track.language);
            label = langName || track.language.toUpperCase();
        }
        
        option.textContent = label + (track.enabled ? ' ✓' : '');
        audioSelect.appendChild(option);
        
        // Seleziona traccia attiva
        if (track.enabled) {
            audioSelect.value = index;
        }
    });
    
    // Aggiungi evento change
    audioSelect.onchange = function() {
        changeMobileAudio(this.value);
    };
}

function changeMobileAudio(audioIndex) {
    if (!mobilePlayer || !mobilePlayer.audioTracks || availableAudioTracks.length === 0) return;
    
    try {
        const index = parseInt(audioIndex);
        if (!isNaN(index) && index >= 0 && index < availableAudioTracks.length) {
            const audioTracks = mobilePlayer.audioTracks();
            
            // Disabilita tutte le tracce
            for (let i = 0; i < audioTracks.length; i++) {
                audioTracks[i].enabled = false;
            }
            
            // Abilita traccia selezionata
            if (audioTracks[index]) {
                audioTracks[index].enabled = true;
                console.log(`Audio cambiato a: ${availableAudioTracks[index].label}`);
                
                // Aggiorna UI
                updateAudioSelector();
            }
        }
    } catch (error) {
        console.error('Errore cambio audio:', error);
    }
}

// ============ GESTIONE SOTTOTITOLI ============
function extractSubtitles() {
    try {
        if (!mobilePlayer || !mobilePlayer.textTracks) {
            console.log('Tracce testo non disponibili');
            availableSubtitles = [];
            return;
        }
        
        const textTracks = mobilePlayer.textTracks();
        availableSubtitles = [];
        
        // Aggiungi opzione "Nessun sottotitolo"
        availableSubtitles.push({
            id: -1,
            language: 'none',
            label: 'Nessun sottotitolo',
            mode: 'disabled',
        });
        
        for (let i = 0; i < textTracks.length; i++) {
            const track = textTracks[i];
            if (track.kind === 'subtitles' || track.kind === 'captions') {
                availableSubtitles.push({
                    id: i,
                    language: track.language || 'und',
                    label: track.label || `Sottotitoli ${i + 1}`,
                    mode: track.mode || 'disabled',
                });
            }
        }
        
        console.log('Sottotitoli disponibili:', availableSubtitles);
        
        // Aggiorna dropdown sottotitoli
        updateSubtitleSelector();
        
        return availableSubtitles;
    } catch (error) {
        console.error('Errore estrazione sottotitoli:', error);
        availableSubtitles = [];
        return [];
    }
}

function updateSubtitleSelector() {
    const subtitleSelect = document.getElementById('mobile-subtitle-select');
    if (!subtitleSelect || availableSubtitles.length === 0) return;
    
    subtitleSelect.innerHTML = '';
    
    availableSubtitles.forEach((sub, index) => {
        const option = document.createElement('option');
        option.value = sub.id;
        
        // Formatta etichetta
        let label = sub.label;
        if (sub.language && sub.language !== 'none' && sub.language !== 'und') {
            const langName = getLanguageName(sub.language);
            label = langName || sub.language.toUpperCase();
        }
        
        option.textContent = label;
        subtitleSelect.appendChild(option);
        
        // Seleziona sottotitolo attivo
        if (sub.mode === 'showing') {
            subtitleSelect.value = sub.id;
        }
    });
    
    // Aggiungi evento change
    subtitleSelect.onchange = function() {
        changeMobileSubtitle(this.value);
    };
}

function changeMobileSubtitle(subtitleId) {
    if (!mobilePlayer || !mobilePlayer.textTracks) return;
    
    try {
        const textTracks = mobilePlayer.textTracks();
        const id = parseInt(subtitleId);
        
        // Disabilita tutti i sottotitoli
        for (let i = 0; i < textTracks.length; i++) {
            const track = textTracks[i];
            if (track.kind === 'subtitles' || track.kind === 'captions') {
                track.mode = 'disabled';
            }
        }
        
        if (id !== -1 && textTracks[id]) {
            // Attiva sottotitolo selezionato
            textTracks[id].mode = 'showing';
            console.log(`Sottotitoli attivati: ${availableSubtitles.find(s => s.id === id)?.label}`);
        } else {
            console.log('Sottotitoli disabilitati');
        }
        
        // Aggiorna UI
        updateSubtitleSelector();
    } catch (error) {
        console.error('Errore cambio sottotitoli:', error);
    }
}
// ============ GESTIONE STAGIONI ED EPISODI ============
async function loadTVSeasonsMobile(tmdbId) {
    try {
        const details = await fetchTMDB(`tv/${tmdbId}`);
        currentMobileSeasons = details.seasons || [];
        
        const seasonSelect = document.getElementById('mobile-season-select');
        const episodesList = document.getElementById('mobile-episodes-list');
        
        if (!seasonSelect || !episodesList) return;
        
        seasonSelect.innerHTML = '';
        
        // FILTRA: Rimuovi le stagioni con season_number = 0
        const validSeasons = currentMobileSeasons.filter(season => season.season_number > 0);
        
        validSeasons.forEach((season, index) => {
            const option = document.createElement('option');
            option.value = season.season_number;
            option.textContent = `Stagione ${season.season_number} (${season.episode_count} episodi)`;
            seasonSelect.appendChild(option);
        });
        
        if (validSeasons.length > 0) {
            const firstSeasonNumber = validSeasons[0].season_number;
            await loadSeasonEpisodesMobile(tmdbId, firstSeasonNumber);
        } else {
            // Se non ci sono stagioni valide, prova con la stagione 1
            console.warn("Nessuna stagione valida trovata, provo con la stagione 1");
            await loadSeasonEpisodesMobile(tmdbId, 1);
        }
        
        seasonSelect.onchange = function() {
            const seasonNumber = parseInt(this.value);
            loadSeasonEpisodesMobile(tmdbId, seasonNumber);
        };
        
    } catch (error) {
        console.error('Errore caricamento stagioni:', error);
    }
}

async function loadSeasonEpisodesMobile(tmdbId, seasonNumber) {
    try {
        const episodesList = document.getElementById('mobile-episodes-list');
        if (!episodesList) return;
        
        episodesList.innerHTML = '<div class="mobile-episode-item">Caricamento episodi...</div>';
        
        const seasonData = await fetchTMDB(`tv/${tmdbId}/season/${seasonNumber}`);
        const episodes = seasonData.episodes || [];
        episodesList.innerHTML = '';
        
        // FILTRA: Rimuovi episodi con episode_number = 0
        const validEpisodes = episodes.filter(episode => episode.episode_number > 0);
        
        validEpisodes.forEach(episode => {
            const episodeItem = document.createElement('div');
            episodeItem.className = 'mobile-episode-item';
            episodeItem.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>Episodio ${episode.episode_number}</strong>
                        <div style="font-size: 12px; color: #aaa;">${episode.name || 'Senza titolo'}</div>
                        ${episode.overview ? `<div style="font-size: 11px; margin-top: 5px; opacity: 0.8;">${episode.overview.substring(0, 100)}...</div>` : ''}
                    </div>
                    <button class="mobile-control-btn" onclick="playTVEpisodeMobile(${tmdbId}, ${seasonNumber}, ${episode.episode_number})">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
            `;
            
            episodeItem.onclick = (e) => {
                if (!e.target.closest('button')) {
                    playTVEpisodeMobile(tmdbId, seasonNumber, episode.episode_number);
                }
            };
            
            episodesList.appendChild(episodeItem);
        });
        
        if (validEpisodes.length === 0) {
            episodesList.innerHTML = '<div class="mobile-episode-item">Nessun episodio disponibile</div>';
        }
        
    } catch (error) {
        console.error('Errore caricamento episodi:', error);
        showMobileError('Errore nel caricamento degli episodi');
    }
}

function playTVEpisodeMobile(tmdbId, seasonNumber, episodeNumber) {
    console.log(`Riproduzione episodio S${seasonNumber}E${episodeNumber}`);
    
    // Aggiorna il titolo del player con dettagli episodio
    const episodeTitle = `Stagione ${seasonNumber}, Episodio ${episodeNumber}`;
    document.getElementById('mobile-player-title').textContent = episodeTitle;
    
    // Riproduci l'episodio
    playItemMobile(tmdbId, 'tv', seasonNumber, episodeNumber);
}

// ============ UTILITY LINGUE ============
function getLanguageName(code) {
    const languages = {
        'it': 'Italiano',
        'en': 'English',
        'es': 'Español',
        'fr': 'Français',
        'de': 'Deutsch',
        'pt': 'Português',
        'ru': 'Русский',
        'zh': '中文',
        'ja': '日本語',
        'ko': '한국어',
        'ar': 'العربية',
        'hi': 'हिन्दी',
    };
    
    return languages[code] || code;
}

// ============ FUNZIONI PLAYER ESPOSTE ============
function refreshMobilePlayerControls() {
    setTimeout(() => {
        extractAvailableQualities();
        extractAudioTracks();
        extractSubtitles();
    }, 1000);
}

function showMobileQualitySelector() {
    const qualitySelect = document.getElementById('mobile-quality-select');
    if (qualitySelect) {
        qualitySelect.style.display = 'block';
        updateQualitySelector();
    }
}

function showMobileAudioSelector() {
    const audioSelect = document.getElementById('mobile-audio-select');
    if (audioSelect) {
        audioSelect.style.display = 'block';
        updateAudioSelector();
    }
}

function showMobileSubtitleSelector() {
    const subtitleSelect = document.getElementById('mobile-subtitle-select');
    if (subtitleSelect) {
        subtitleSelect.style.display = 'block';
        updateSubtitleSelector();
    }
}

// ... RESTANTE CODICE (getDirectStreamMobile, trackVideoProgressMobile, closePlayerMobile, ecc.)
// Mantieni tutto il codice esistente qui sotto...
async function getDirectStreamMobile(tmdbId, isMovie, season = null, episode = null) {
    try {
        let vixsrcUrl = `https://${VIXSRC_URL}/${isMovie ? 'movie' : 'tv'}/${tmdbId}`;
        if (!isMovie && season !== null && episode !== null) {
            vixsrcUrl += `/${season}/${episode}`;
        }
        
        // console.log('Fetching vixsrc URL:', vixsrcUrl);
        
        const proxiedVixsrcUrl = applyCorsProxy(vixsrcUrl);
        const response = await fetch(proxiedVixsrcUrl);
        const html = await response.text();
        
        // Estrai parametri playlist
        const playlistParamsRegex = /window\.masterPlaylist[^:]+params:[^{]+({[^<]+?})/;
        const playlistParamsMatch = html.match(playlistParamsRegex);
        
        if (!playlistParamsMatch) {
            throw new Error('Parametri playlist non trovati');
        }
        
        let playlistParamsStr = playlistParamsMatch[1]
            .replace(/'/g, '"')
            .replace(/\s+/g, '')
            .replace(/\n/g, '')
            .replace(/\\n/g, '')
            .replace(',}', '}');
        
        let playlistParams;
        try {
            playlistParams = JSON.parse(playlistParamsStr);
        } catch (e) {
            throw new Error('Errore parsing parametri: ' + e.message);
        }
        
        const playlistUrlRegex = /window\.masterPlaylist\s*=\s*\{[\s\S]*?url:\s*'([^']+)'/;
        const playlistUrlMatch = html.match(playlistUrlRegex);
        
        if (!playlistUrlMatch) {
            throw new Error('URL playlist non trovato');
        }
        
        const playlistUrl = playlistUrlMatch[1];
        // console.log('Playlist URL trovato:', playlistUrl);
        
        const canPlayFHDRegex = /window\.canPlayFHD\s+?=\s+?(\w+)/;
        const canPlayFHDMatch = html.match(canPlayFHDRegex);
        const canPlayFHD = canPlayFHDMatch && canPlayFHDMatch[1] === 'true';
        
        const hasQuery = /\?[^#]+/.test(playlistUrl);
        const separator = hasQuery ? '&' : '?';
        
        const m3u8Url = playlistUrl + 
            separator + 
            'expires=' + playlistParams.expires + 
            '&token=' + playlistParams.token + 
            (canPlayFHD ? '&h=1' : '');
        
        // console.log('M3U8 URL ottenuto:', m3u8Url);
        
        // DEBUG: Scarica e controlla la playlist M3U8
        // console.log('📱 MOBILE - DEBUG: Controllo contenuto playlist M3U8');
        try {
            const m3u8Response = await fetch(applyCorsProxy(m3u8Url));
            const m3u8Content = await m3u8Response.text();
            // console.log('📱 MOBILE - Contenuto M3U8 (prime 500 caratteri):', m3u8Content.substring(0, 500));
            
            // Cerca riferimenti a chiavi
            const keyLines = m3u8Content.split('\n').filter(line => line.includes('EXT-X-KEY'));
            // console.log('📱 MOBILE - Linee chiave trovate:', keyLines);
        } catch (e) {
            // console.log('📱 MOBILE - Errore lettura M3U8:', e);
        }
        
        return {
            iframeUrl: vixsrcUrl,
            m3u8Url: m3u8Url
        };
        
    } catch (error) {
        console.error('Errore getDirectStreamMobile:', error);
        throw error;
    }
}

function trackVideoProgressMobile(tmdbId, mediaType, videoElement, season = null, episode = null) {
    let storageKey = `videoTime_${mediaType}_${tmdbId}`;
    if (mediaType === "tv" && season !== null && episode !== null) {
        storageKey += `_S${season}_E${episode}`;
    }
    
    // Riprendi da tempo salvato
    const savedTime = getFromStorage(storageKey);
    if (savedTime && parseFloat(savedTime) > 60) {
        videoElement.currentTime = parseFloat(savedTime);
    }
    
    // Salva progresso ogni 5 secondi
    const saveInterval = setInterval(() => {
        if (!videoElement.paused && !videoElement.ended) {
            const currentTime = videoElement.currentTime;
            if (currentTime > 60) {
                saveToStorage(storageKey, currentTime, 365);
            }
        }
    }, 5000);
    
    // Pulisci intervallo quando il video finisce
    videoElement.addEventListener('ended', () => {
        clearInterval(saveInterval);
        // Rimuovi dalla "Continua visione" se completato
        localStorage.removeItem(storageKey);
    });
    
    // Gestione uscita dal player
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            clearInterval(saveInterval);
        }
    });

    videoElement.addEventListener('timeupdate', () => {
    // Aggiorna la sezione "Continua Visione" se è visibile
    if (currentMobileSection === 'continua') {
        updateContinuaVisione();
    }
});
}
let cleanupFunctions = [];
function closePlayerMobile() {
    // console.log("Chiusura player mobile...");
    cleanupMobilePlayer();

    if (mobilePlayer) {
        mobilePlayer.dispose();
        mobilePlayer = null;
    }
    
    currentMobileItem = null;
    currentMobileSeasons = [];
    
    removeVideoJsXhrHook();
    
    // Pulisci elemento video
    const videoElement = document.getElementById('mobile-player-video');
    if (videoElement) {
        videoElement.remove();
    }
    
    showHomeMobile();
    
    // Aggiorna "Continua visione"
    setTimeout(() => {
        updateMobileFavCount();
    }, 300);
}

function cleanupMobilePlayer() {
    console.log("🧹 PULIZIA COMPLETA PLAYER MOBILE");
    
    // Rimuovi tutti gli event listener
    cleanupFunctions.forEach(fn => fn());
    cleanupFunctions = [];
    
    // Distruggi player Video.js
    if (mobilePlayer) {
        try {
            mobilePlayer.dispose();
            mobilePlayer = null;
        } catch (e) {
            console.error("Errore durante dispose player:", e);
        }
    }
    
    // Pulisci elemento video completamente
    const videoContainer = document.querySelector('.mobile-video-container');
    if (videoContainer) {
        videoContainer.innerHTML = '';
        
        // Crea nuovo elemento video
        const videoElement = document.createElement('video');
        videoElement.id = 'mobile-player-video';
        videoElement.className = 'video-js vjs-theme-cinesearch';
        videoElement.setAttribute('controls', '');
        videoElement.setAttribute('preload', 'auto');
        videoElement.setAttribute('playsinline', '');
        videoElement.setAttribute('crossorigin', 'anonymous');
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        
        videoContainer.appendChild(videoElement);
    }
    
    // Resetta tutte le variabili globali
    currentStreamData = null;
    availableAudioTracks = [];
    availableSubtitles = [];
    availableQualities = [];
    playerInitialized = false;
    
    // Rimuovi hook XHR
    removeVideoJsXhrHook();
}

// ============ VIDEO.JS CORS HOOK ============
const xhrRequestHook = (options) => {
    const originalUri = options.uri;
    
    console.log('📱 MOBILE - xhrRequestHook - URL originale:', originalUri);
    
    if (!originalUri) return options;
    
    // Gestione speciale per chiavi di crittografia
    if (originalUri.includes('/storage/enc.key') || originalUri.includes('.key')) {
        console.log('📱 MOBILE - Rilevata richiesta chiave di crittografia');
        
        // Usa l'URL diretto senza proxy per le chiavi
        const directUrl = originalUri
            .replace(/^https:\/\/[^\/]+\//, 'https://vixsrc.to/')
            .replace(/^http:\/\/[^\/]+\//, 'http://vixsrc.to/');
        
        console.log('📱 MOBILE - URL chiave diretto:', directUrl);
        
        options.uri = directUrl;
        
        // Rimuovi header non sicuri che causano errori
        delete options.headers;
        
        // Configurazione CORS minima
        options.cors = true;
        options.withCredentials = false;
        
        return options;
    }
    
    // Per segmenti media (.ts, .m3u8), usa URL diretto
    if (originalUri.includes('.ts') || originalUri.includes('.m3u8')) {
        console.log('📱 MOBILE - Segmento media, uso URL diretto');
        options.uri = originalUri;
        
        // Configurazione per media
        options.cors = true;
        options.withCredentials = false;
        
        // Non impostare header non sicuri
        const safeHeaders = {};
        if (options.headers) {
            // Filtra solo header sicuri
            const safeHeaderKeys = ['Accept', 'Accept-Language', 'Cache-Control'];
            safeHeaderKeys.forEach(key => {
                if (options.headers[key]) {
                    safeHeaders[key] = options.headers[key];
                }
            });
        }
        
        options.headers = safeHeaders;
        
        return options;
    }
    
    // Per altri URL, mantieni il proxy ma senza header non sicuri
    if (originalUri.includes('corsproxy.io') || 
        originalUri.includes('allorigins.win') || 
        originalUri.includes('api.codetabs.com')) {
        console.log('📱 MOBILE - URL già proxyato');
        
        // Pulisci header non sicuri
        delete options.headers;
        
        return options;
    }
    
    // Default: applica proxy ma senza header problematici
    console.log('📱 MOBILE - Applico proxy CORS (senza header non sicuri)');
    const proxyUrl = applyCorsProxy(originalUri);
    options.uri = proxyUrl;
    
    // Rimuovi header non sicuri
    delete options.headers;
    
    return options;
};

// Aggiungi questa funzione per gestire le richieste di chiavi
function fetchEncryptionKey(keyUrl) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('📱 MOBILE - Tentativo di fetch chiave:', keyUrl);
            
            // Prova diverse strategie
            const strategies = [
                () => fetch(keyUrl, { mode: 'no-cors' }),
                () => fetch(keyUrl.replace('https://', 'http://'), { mode: 'no-cors' }),
                () => fetch(applyCorsProxy(keyUrl)),
                () => fetch(keyUrl, { 
                    headers: { 
                        'Origin': 'https://vixsrc.to',
                        'Referer': 'https://vixsrc.to/'
                    }
                })
            ];
            
            for (let strategy of strategies) {
                try {
                    const response = await strategy();
                    if (response.ok || response.type === 'opaque') {
                        const arrayBuffer = await response.arrayBuffer();
                        console.log('📱 MOBILE - Chiave ottenuta, dimensione:', arrayBuffer.byteLength);
                        resolve(arrayBuffer);
                        return;
                    }
                } catch (e) {
                    console.warn('📱 MOBILE - Strategia fallita:', e.message);
                }
            }
            
            reject(new Error('Impossibile ottenere la chiave di crittografia'));
            
        } catch (error) {
            reject(error);
        }
    });
}

function setupVideoJsXhrHook() {
    if (typeof videojs === "undefined" || !videojs.Vhs) {
        return;
    }

    if (requestHookInstalled) {
        return;
    }

    videojs.Vhs.xhr.onRequest(xhrRequestHook);
    requestHookInstalled = true;
}

function removeVideoJsXhrHook() {
    if (typeof videojs !== "undefined" && videojs.Vhs && requestHookInstalled) {
        videojs.Vhs.xhr.offRequest(xhrRequestHook);
        requestHookInstalled = false;
    }
}

function openInExternalPlayer(tmdbId, mediaType, season, episode) {
    let externalUrl;
    
    if (mediaType === 'movie') {
        externalUrl = `https://${VIXSRC_URL}/movie/${tmdbId}`;
    } else {
        externalUrl = `https://${VIXSRC_URL}/tv/${tmdbId}/${season || 1}/${episode || 1}`;
    }
    
    // Apri in nuova finestra
    window.open(applyCorsProxy(externalUrl), '_blank');
}
