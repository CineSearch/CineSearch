// mobile-api.js - Gestione chiamate API

const API_KEY = "f75aac685f3389aa89c4f8580c078a28";
const VIXSRC_URL = "vixsrc.to";
const AVAILABILITY_CHECK_TIMEOUT = 5000;
const ITEMS_PER_PAGE = 20;

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
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            resolve(false);
        }, AVAILABILITY_CHECK_TIMEOUT);
        
        (async () => {
            try {
                let vixsrcUrl;
                
                if (isMovie) {
                    vixsrcUrl = `https://${VIXSRC_URL}/movie/${tmdbId}`;
                } else {
                    if (season === null || episode === null) {
                        vixsrcUrl = `https://${VIXSRC_URL}/tv/${tmdbId}/1/1`;
                    } else {
                        vixsrcUrl = `https://${VIXSRC_URL}/tv/${tmdbId}/${season}/${episode}`;
                    }
                }
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);
                
                const response = await fetch(applyCorsProxy(vixsrcUrl), {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                
                if (response.status === 404) {
                    clearTimeout(timeout);
                    resolve(false);
                    return;
                }
                
                const html = await response.text();
                const hasPlaylist = /window\.masterPlaylist/.test(html);
                const notFound = /not found|not available|no sources found|error 404/i.test(html);
                
                clearTimeout(timeout);
                resolve(hasPlaylist && !notFound);
                
            } catch (error) {
                console.error("Errore in checkAvailabilityOnVixsrc:", error);
                clearTimeout(timeout);
                resolve(false);
            }
        })();
    });
}

async function checkTvSeriesAvailability(tmdbId) {
    try {
        const firstEpisodeUrl = `https://${VIXSRC_URL}/tv/${tmdbId}/1/1`;
        const response = await fetch(applyCorsProxy(firstEpisodeUrl));
        
        if (!response.ok) {
            return false;
        }
        
        const html = await response.text();
        const hasPlaylist = /window\.masterPlaylist/.test(html);
        const notFound = /not found|not available|no sources found|error 404/i.test(html);
        
        return hasPlaylist && !notFound;
    } catch (error) {
        return false;
    }
}

// ============ HOME DATA ============
async function loadMobileHomeData() {
    try {
        // console.log('Caricamento dati home mobile...');
        
        // Carica trending
        const trendingData = await fetchTMDB('trending/all/day');
        if (trendingData.results && trendingData.results.length > 0) {
            populateMobileCarousel('mobile-trending-carousel', trendingData.results);
        }
        
        // Carica ultimi film
        const nowPlayingData = await fetchTMDB('movie/now_playing');
        if (nowPlayingData.results && nowPlayingData.results.length > 0) {
            populateMobileCarousel('mobile-nowPlaying-carousel', nowPlayingData.results);
        }
        
        // Carica ultime serie
        const onAirData = await fetchTMDB('tv/on_the_air');
        if (onAirData.results && onAirData.results.length > 0) {
            populateMobileCarousel('mobile-onTheAir-carousel', onAirData.results);
        }
        
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