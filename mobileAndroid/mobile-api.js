// mobile-api.js - Gestione chiamate API

const API_KEY = "f75aac685f3389aa89c4f8580c078a28";
const VIXSRC_URL = "vixsrc.to";
const AVAILABILITY_CHECK_TIMEOUT = 5000;
const ITEMS_PER_PAGE = 20;
const AVAILABILITY_CACHE_DURATION = 24 * 60 * 60 * 1000;

function getFromAvailabilityCache(tmdbId, isMovie) {
    try {
        const key = `mobile_avail_${isMovie ? 'movie' : 'tv'}_${tmdbId}`;
        const cached = localStorage.getItem(key);
        if (cached) {
            const data = JSON.parse(cached);
            if (Date.now() < data.expires) {
                return data.available;
            }
            localStorage.removeItem(key);
        }
    } catch (e) {}
    return null;
}

function setToAvailabilityCache(tmdbId, isMovie, available) {
    try {
        const key = `mobile_avail_${isMovie ? 'movie' : 'tv'}_${tmdbId}`;
        localStorage.setItem(key, JSON.stringify({
            available: available,
            expires: Date.now() + AVAILABILITY_CACHE_DURATION
        }));
    } catch (e) {}
}

// ============ API TMDB ============
async function fetchTMDB(endpoint, params = {}) {
    let url = `https://api.themoviedb.org/3/${endpoint}?api_key=${API_KEY}&language=it-IT`;
    
    // Aggiungi parametri
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
            url += `&${key}=${encodeURIComponent(params[key])}`;
        }
    });
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`TMDB API error: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Errore fetch TMDB:', error);
        throw error;
    }
}

// ============ VERIFICA DISPONIBILITÀ ============
async function checkAvailabilityOnVixsrc(tmdbId, isMovie, season = null, episode = null) {
    const cached = getFromAvailabilityCache(tmdbId, isMovie);
    if (cached !== null) {
        return cached;
    }
    
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            resolve(false);
        }, AVAILABILITY_CHECK_TIMEOUT);
        
        (async () => {
            try {
                let vixsrcUrl;
                
                if (isMovie) {
                    vixsrcUrl = `https://${VIXSRC_URL}/api/movie/${tmdbId}`;
                } else {
                    vixsrcUrl = `https://${VIXSRC_URL}/api/tv/${tmdbId}/1/1`;
                }
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);
                
                const response = await fetch(applyCorsProxy(vixsrcUrl), {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                
                if (response.status === 404) {
                    setToAvailabilityCache(tmdbId, isMovie, false);
                    clearTimeout(timeout);
                    resolve(false);
                    return;
                }
                
                const text = await response.text();
                
                if (!text || !text.startsWith('{')) {
                    setToAvailabilityCache(tmdbId, isMovie, false);
                    clearTimeout(timeout);
                    resolve(false);
                    return;
                }
                
                const data = JSON.parse(text);
                const available = Boolean(data && data.src);
                setToAvailabilityCache(tmdbId, isMovie, available);
                
                clearTimeout(timeout);
                resolve(available);
                
            } catch (error) {
                console.error("Errore in checkAvailabilityOnVixsrc:", error);
                clearTimeout(timeout);
                resolve(false);
            }
        })();
    });
}

async function checkTvSeriesAvailability(tmdbId) {
    const cached = getFromAvailabilityCache(tmdbId, false);
    if (cached !== null) {
        return cached;
    }
    
    try {
        const vixsrcUrl = `https://${VIXSRC_URL}/api/tv/${tmdbId}/1/1`;
        const response = await fetch(applyCorsProxy(vixsrcUrl));
        
        if (!response.ok) {
            setToAvailabilityCache(tmdbId, false, false);
            return false;
        }
        
        const text = await response.text();
        
        if (!text || !text.startsWith('{')) {
            setToAvailabilityCache(tmdbId, false, false);
            return false;
        }
        
        const data = JSON.parse(text);
        const available = Boolean(data && data.src);
        setToAvailabilityCache(tmdbId, false, available);
        
        return available;
    } catch (error) {
        return false;
    }
}

// ============ HOME DATA CON CONTROLLO DISPONIBILITÀ ============
async function loadMobileHomeData() {
    try {
        console.log('Caricamento dati home mobile con controllo disponibilità...');
        
        // Carica trending - VERIFICA DISPONIBILITÀ
        const trendingData = await fetchTMDB('trending/all/day');
        if (trendingData.results && trendingData.results.length > 0) {
            const availableTrending = [];
            
            for (const item of trendingData.results.slice(0, 15)) {
                // Determina il tipo di media
                const isMovie = item.media_type === 'movie' || item.title;
                const mediaType = isMovie ? 'movie' : 'tv';
                
                // Verifica disponibilità su Vixsrc
                let isAvailable = false;
                if (isMovie) {
                    isAvailable = await checkAvailabilityOnVixsrc(item.id, true);
                } else {
                    isAvailable = await checkTvSeriesAvailability(item.id);
                }
                
                // Aggiungi solo se disponibile
                if (isAvailable) {
                    availableTrending.push(item);
                    
                    // Limita a 10 elementi
                    if (availableTrending.length >= 10) break;
                }
            }
            
            if (availableTrending.length > 0) {
                populateMobileCarousel('mobile-trending-carousel', availableTrending);
            } else {
                document.getElementById('mobile-trending-carousel').innerHTML = 
                    '<div class="empty-state">Nessun trending disponibile</div>';
            }
        }
        
        // Carica ultimi film - VERIFICA DISPONIBILITÀ
        const nowPlayingData = await fetchTMDB('movie/now_playing');
        if (nowPlayingData.results && nowPlayingData.results.length > 0) {
            const availableMovies = [];
            
            for (const movie of nowPlayingData.results.slice(0, 15)) {
                movie.media_type = "movie";
                const isAvailable = await checkAvailabilityOnVixsrc(movie.id, true);
                
                if (isAvailable) {
                    availableMovies.push(movie);
                    
                    // Limita a 10 elementi
                    if (availableMovies.length >= 10) break;
                }
            }
            
            if (availableMovies.length > 0) {
                populateMobileCarousel('mobile-nowPlaying-carousel', availableMovies);
            } else {
                document.getElementById('mobile-nowPlaying-carousel').innerHTML = 
                    '<div class="empty-state">Nessun film disponibile</div>';
            }
        }
        
        // Carica ultime serie - VERIFICA DISPONIBILITÀ
        const onAirData = await fetchTMDB('tv/on_the_air');
        if (onAirData.results && onAirData.results.length > 0) {
            const availableTV = [];
            
            for (const tv of onAirData.results.slice(0, 15)) {
                tv.media_type = "tv";
                const isAvailable = await checkTvSeriesAvailability(tv.id);
                
                if (isAvailable) {
                    availableTV.push(tv);
                    
                    // Limita a 10 elementi
                    if (availableTV.length >= 10) break;
                }
            }
            
            if (availableTV.length > 0) {
                populateMobileCarousel('mobile-onTheAir-carousel', availableTV);
            } else {
                document.getElementById('mobile-onTheAir-carousel').innerHTML = 
                    '<div class="empty-state">Nessuna serie disponibile</div>';
            }
        }
        
        console.log('Caricamento home completato con controlli disponibilità');
        
    } catch (error) {
        console.error('Errore caricamento home mobile:', error);
    }
}

// ============ CATEGORIE ============
const categories = [
    { id: 28, name: "Azione", icon: "💥" },
    { id: 12, name: "Avventura", icon: "🗺️" },
    { id: 16, name: "Animazione", icon: "🐭" },
    { id: 35, name: "Commedia", icon: "😂" },
    { id: 80, name: "Crime", icon: "🔫" },
    { id: 99, name: "Documentario", icon: "🎥" },
    { id: 18, name: "Dramma", icon: "🎭" },
    { id: 10751, name: "Famiglia", icon: "👨‍👩‍👧‍👦" },
    { id: 14, name: "Fantasy", icon: "🧙‍♂️" },
    { id: 36, name: "Storico", icon: "🏛️" },
    { id: 27, name: "Horror", icon: "👻" },
    { id: 10402, name: "Musical", icon: "🎵" },
    { id: 9648, name: "Mistero", icon: "🔍" },
    { id: 10749, name: "Romantico", icon: "❤️" },
    { id: 878, name: "Fantascienza", icon: "🚀" },
    { id: 10770, name: "TV Movie", icon: "📺" },
    { id: 53, name: "Thriller", icon: "🔪" },
    { id: 10752, name: "Guerra", icon: "⚔️" },
    { id: 37, name: "Western", icon: "🤠" }
];

async function loadCategoryMovies(genreId) {
    try {
        const apiUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=it-IT&sort_by=popularity.desc&page=1&with_genres=${genreId}`;
        const res = await fetch(apiUrl);
        const data = await res.json();
        
        const grid = document.getElementById('mobile-category-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
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
        
        if (availableMovies.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-film"></i>
                    <p>Nessun film disponibile in questa categoria</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Errore caricamento categoria:', error);
    }
}