// mobile-content.js - Gestione contenuti (film, serie, categorie, preferiti)

// ============ VARIABILI CONTENUTI ============
let mobileMoviePage = 1;
let mobileTVPage = 1;
let mobileCategoryPage = 1;
let mobileCategoryId = null;
let mobileCategoryName = '';
let currentMovieMinYear = null;
let currentMovieMaxYear = null;
let currentTVMinYear = null;
let currentTVMaxYear = null;
let currentCategoryMinYear = null;
let currentCategoryMaxYear = null;


// ============ FILTRI CATEGORIE ============
function applyCategoryFilterMobile() {
    const minYearInput = document.getElementById('mobile-category-min-year');
    const maxYearInput = document.getElementById('mobile-category-max-year');
    
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
    
    currentCategoryMinYear = minYear || null;
    currentCategoryMaxYear = maxYear || null;
    
    // Ricarica i film della categoria con i nuovi filtri
    loadCategoryMovies(mobileCategoryId, 1);
}

function resetCategoryFilterMobile() {
    const minYearInput = document.getElementById('mobile-category-min-year');
    const maxYearInput = document.getElementById('mobile-category-max-year');
    
    if (minYearInput) minYearInput.value = '';
    if (maxYearInput) maxYearInput.value = '';
    
    currentCategoryMinYear = null;
    currentCategoryMaxYear = null;
    
    // Ricarica i film della categoria senza filtri
    loadCategoryMovies(mobileCategoryId, 1);
}
// ============ CARICAMENTO FILM PER CATEGORIA ============
async function loadCategoryMovies(genreId, page = 1) {
    try {
        mobileCategoryPage = page;
        
        let apiUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=it-IT&sort_by=popularity.desc&page=${page}&with_genres=${genreId}`;
        
        // Aggiungi filtri anno se presenti
        if (currentCategoryMinYear) {
            apiUrl += `&primary_release_date.gte=${currentCategoryMinYear}-01-01`;
        }
        if (currentCategoryMaxYear) {
            apiUrl += `&primary_release_date.lte=${currentCategoryMaxYear}-12-31`;
        }
        
        const res = await fetch(apiUrl);
        const data = await res.json();
        
        const grid = document.getElementById('mobile-category-grid');
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
            
            if (availableMovies.length >= ITEMS_PER_PAGE) break;
        }
        
        // Aggiorna paginazione
        updateCategoryPaginationMobile(data.total_pages, data.total_results);
        
        if (availableMovies.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-film"></i>
                    <p>Nessun film disponibile trovato</p>
                    ${currentCategoryMinYear || currentCategoryMaxYear ? 
                        `<p style="font-size: 12px; opacity: 0.7;">Prova a rimuovere i filtri dell'anno</p>` : ''}
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Errore caricamento film categoria:', error);
        showMobileError('Errore nel caricamento dei film della categoria');
    }
}
// ============ PAGINAZIONE CATEGORIE ============
function updateCategoryPaginationMobile(totalPages, totalResults) {
    const prevBtn = document.getElementById('mobile-category-prev');
    const nextBtn = document.getElementById('mobile-category-next');
    const pageInfo = document.getElementById('mobile-category-page');
    
    if (prevBtn) prevBtn.disabled = mobileCategoryPage <= 1;
    if (nextBtn) nextBtn.disabled = mobileCategoryPage >= totalPages;
    if (pageInfo) pageInfo.textContent = `Pag. ${mobileCategoryPage} (${totalResults} film)`;
}

function prevCategoryPageMobile() {
    if (mobileCategoryPage > 1) {
        mobileCategoryPage--;
        loadCategoryMovies(mobileCategoryId, mobileCategoryPage);
    }
}

function nextCategoryPageMobile() {
    mobileCategoryPage++;
    loadCategoryMovies(mobileCategoryId, mobileCategoryPage);
}
// ============ FILM ============
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
            
            if (availableMovies.length >= ITEMS_PER_PAGE) break;
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

// ============ SERIE TV ============
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
            
            if (availableTV.length >= ITEMS_PER_PAGE) break;
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

// ============ CATEGORIE ============
function loadCategoriesMobile() {
    const grid = document.getElementById('mobile-categories-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    categories.forEach(category => {
        grid.appendChild(createCategoryCard(category));
    });
}

// ============ PREFERITI ============
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
// ============ CONTINUA VISIONE ============
async function loadContinuaMobile() {
    try {
        const container = document.getElementById('mobile-continua-grid');
        const emptyState = document.getElementById('mobile-empty-continua');
        
        if (!container) return;
        
        console.log("📱 Caricamento Continua Visione...");
        
        // Trova TUTTE le chiavi di storage di progresso
        const progressKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("videoProgress_")) {
                progressKeys.push(key);
            }
        }
        
        console.log("📱 Chiavi trovate:", progressKeys.length, progressKeys);
        
        if (progressKeys.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            container.innerHTML = '';
            return;
        }
        
        if (emptyState) emptyState.style.display = 'none';
        container.innerHTML = '';
        
        let loadedCount = 0;
        
        // Per ogni progresso salvato
        for (const storageKey of progressKeys) {
            try {
                // Estrai dati dalla chiave
                const savedData = localStorage.getItem(storageKey);
                if (!savedData) continue;
                
                const data = JSON.parse(savedData);
                console.log("📱 Dati salvati:", data);
                
                // Verifica validità dei dati
                if (!data.tmdbId || !data.mediaType) continue;
                
                // Verifica se il salvataggio è recente (entro 60 giorni)
                const dataAge = Date.now() - (data.timestamp || 0);
                const maxAge = 60 * 24 * 60 * 60 * 1000; // 60 giorni
                
                if (dataAge > maxAge) {
                    console.log("📱 Dati scaduti, rimuovo:", storageKey);
                    localStorage.removeItem(storageKey);
                    continue;
                }
                
                // MODIFICA: Mostra anche se guardato poco (per test)
                // Soglia minima: 30 secondi OPPURE più del 5%
                const minTimeToShow = 30; // secondi
                const minPercentToShow = 2; // percentuale
                
                const meetsTimeCriteria = data.time > minTimeToShow;
                const meetsPercentCriteria = data.totalDuration > 0 && 
                    (data.time / data.totalDuration) * 100 > minPercentToShow;
                
                if (meetsTimeCriteria || meetsPercentCriteria) {
                    // Carica i dettagli da TMDB
                    const item = await fetchTMDB(`${data.mediaType}/${data.tmdbId}`);
                    item.media_type = data.mediaType;
                    
                    // Crea card
                    const card = createContinuaCard(item, data.time, data.season, data.episode);
                    container.appendChild(card);
                    loadedCount++;
                    
                    if (loadedCount >= 20) break; // Limita a 20 card
                }
                
            } catch (error) {
                console.error(`Errore caricamento progresso ${storageKey}:`, error);
            }
        }
        
        // Se non ci sono contenuti validi
        if (loadedCount === 0) {
            if (emptyState) emptyState.style.display = 'block';
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-play-circle"></i>
                    <p>Nessun contenuto da continuare</p>
                    <p style="font-size: 12px; opacity: 0.7;">Guarda almeno 30 secondi di un contenuto per vederlo qui</p>
                </div>
            `;
        }
        
        console.log("📱 Caricamento completato:", loadedCount, "contenuti");
        
    } catch (error) {
        console.error('Errore caricamento continua visione:', error);
    }
}

// Funzione per creare una card "Continua Visione"
function createContinuaCard(item, savedTime, season = null, episode = null) {
    const isMovie = item.media_type === 'movie';
    const mediaType = isMovie ? 'movie' : 'tv';
    
    const card = document.createElement('div');
    card.className = 'mobile-card continua-card';
    
    const imageUrl = item.poster_path 
        ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
        : 'https://via.placeholder.com/342x513?text=No+Image';
    
    const title = isMovie ? item.title : item.name;
    
    // Formatta il titolo
    const displayTitle = title.length > 25 ? title.substring(0, 22) + '...' : title;
    
    // Info episodio se serie TV
    let episodeInfo = '';
    if (!isMovie && season && episode) {
        episodeInfo = `<div class="continua-episode">S${season}E${episode}</div>`;
    }
    
    // Calcola percentuale guardata
    let totalDuration = item.runtime ? item.runtime * 60 : // film in secondi
                        (item.episode_run_time && item.episode_run_time.length > 0) ? 
                        item.episode_run_time[0] * 60 : 0; // serie in secondi
    
    const percentWatched = totalDuration > 0 ? 
        Math.min(Math.round((savedTime / totalDuration) * 100), 100) : 0;
    
    // Formatta il tempo rimanente
    const remainingSeconds = Math.max(0, totalDuration - savedTime);
    const remainingMinutes = Math.floor(remainingSeconds / 60);
    const remainingText = remainingMinutes > 0 ? 
        `${remainingMinutes} min rimanenti` : 
        (percentWatched >= 95 ? 'Completato' : 'Quasi finito');
    
    // DEBUG info
    card.dataset.debug = `saved:${savedTime.toFixed(0)}s, total:${totalDuration}s, ${percentWatched}%`;
    
    card.innerHTML = `
        <img src="${imageUrl}" alt="${title}" class="mobile-card-image">
        <div class="mobile-card-content">
            <div class="mobile-card-title" title="${title}">${displayTitle}</div>
            <div class="mobile-card-meta">
                ${isMovie ? '🎬 Film' : '📺 Serie'} ${episodeInfo}
                <div style="font-size: 10px; color: #666; margin-top: 2px;">
                    ${percentWatched}% guardato
                </div>
            </div>
            <div class="continua-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentWatched}%"></div>
                </div>
                <div class="progress-info">
                    <span>${formatTime(savedTime)} / ${totalDuration > 0 ? formatTime(totalDuration) : '??:??'}</span>
                    <span>${remainingText}</span>
                </div>
            </div>
            <div class="mobile-card-buttons">
                <button class="mobile-card-btn play" onclick="resumeWatching('${mediaType}', ${item.id}, ${season || 'null'}, ${episode || 'null'}, event)">
                    <i class="fas fa-play"></i> Continua
                </button>
                <button class="mobile-card-btn remove" onclick="removeContinuaItem('${mediaType}', ${item.id}, ${season || 'null'}, ${episode || 'null'}, event)">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;
    
    return card;
}

// Funzione per riprendere la visione
async function resumeWatching(mediaType, tmdbId, season, episode, event) {
    if (event) event.stopPropagation();
    
    try {
        // Carica i dettagli dell'item
        const item = await fetchTMDB(`${mediaType}/${tmdbId}`);
        item.media_type = mediaType;
        
        // Apri il player
        openMobilePlayer(item);
        
        // Se è una serie TV con stagione/episodio, carica quell'episodio
        if (mediaType === 'tv' && season && episode && season !== 'null' && episode !== 'null') {
            setTimeout(() => {
                playTVEpisodeMobile(tmdbId, season, episode);
            }, 500);
        }
        
    } catch (error) {
        console.error('Errore ripresa visione:', error);
        showMobileError('Errore nel riprendere la visione');
    }
}

// Funzione per rimuovere dalla lista "Continua Visione"
function removeContinuaItem(mediaType, tmdbId, season, episode, event) {
    if (event) event.stopPropagation();
    
    let storageKey = `videoTime_${mediaType}_${tmdbId}`;
    if (mediaType === 'tv' && season && episode && season !== 'null' && episode !== 'null') {
        storageKey += `_S${season}_E${episode}`;
    }
    
    // Rimuovi dallo storage
    localStorage.removeItem(storageKey);
    
    // Ricarica la lista
    loadContinuaMobile();
    
    // Aggiorna il badge se necessario
    updateMobileFavCount();
}
// ============ RICERCA ============
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

// ============ FILTRI ============
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