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
        
        // VERIFICA DISPONIBILITÀ PRIMA DI CREARE LE CARD
        showMobileLoading(true, "Verifica disponibilità...");
        
        // Array per contenuti disponibili
        const availableItems = [];
        
        // Controlla disponibilità per i primi 20 risultati
        const itemsToCheck = filteredResults.slice(0, 20);
        
        for (const item of itemsToCheck) {
            const mediaType = item.media_type || (item.title ? "movie" : "tv");
            let isAvailable = false;
            
            if (mediaType === "movie") {
                isAvailable = await checkAvailabilityOnVixsrc(item.id, true);
            } else if (mediaType === "tv") {
                isAvailable = await checkTvSeriesAvailability(item.id);
            }
            
            if (isAvailable) {
                item.media_type = mediaType;
                availableItems.push(item);
            }
        }
        
        showMobileLoading(false);
        
        // CREA SOLO UNA VOLTA LE CARD PER GLI ITEM DISPONIBILI
        if (availableItems.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>Nessun contenuto disponibile trovato per "${query}"</p>
                </div>
            `;
        } else {
            // Crea le card solo una volta
            availableItems.forEach(item => {
                grid.appendChild(createMobileCard(item));
            });
        }
        
    } catch (error) {
        console.error('Errore ricerca mobile:', error);
        showMobileLoading(false);
        showMobileError('Errore durante la ricerca');
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