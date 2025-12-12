const API_KEY = "f75aac685f3389aa89c4f8580c078a28";
const VIXSRC_URL = "vixsrc.to";
const AVAILABILITY_CHECK_TIMEOUT = 5000;
const ITEMS_PER_PAGE = 20;

// ============ API TMDB ============
async function fetchTMDB(endpoint, params = {}) {
    let url = `https://api.themoviedb.org/3/${endpoint}?api_key=${API_KEY}&language=it-IT`;
    
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
                
                // console.log(`Verifica disponibilità: ${vixsrcUrl}`);
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000);
                
                const response = await fetch(applyCorsProxy(vixsrcUrl), {
                    signal: controller.signal,
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
                    }
                });
                clearTimeout(timeoutId);
                
                if (response.status === 404) {
                    // console.log(`❌ Contenuto non trovato (404): ${tmdbId}`);
                    clearTimeout(timeout);
                    resolve(false);
                    return;
                }
                
                const html = await response.text();
                
                const hasPlaylist = /window\.masterPlaylist|\.m3u8|"playlist"/i.test(html);
                const notFound = /not found|not available|no sources found|error 404|content unavailable|this movie is not available/i.test(html);
                const hasSources = /sources:\s*\[|video sources|streaming links/i.test(html);
                
                const isAvailable = (hasPlaylist || hasSources) && !notFound;
                
                // console.log(`📊 Risultato verifica ${isMovie ? 'Film' : 'Serie'} ${tmdbId}:`, {
                    hasPlaylist,
                    hasSources,
                    notFound,
                    isAvailable
                });
                
                clearTimeout(timeout);
                resolve(isAvailable);
                
            } catch (error) {
                console.error(`Errore verifica ${isMovie ? 'film' : 'serie'} ${tmdbId}:`, error.message);
                clearTimeout(timeout);
                resolve(false);
            }
        })();
    });
}

async function checkMovieAvailability(tmdbId) {
    try {
        const movieUrl = `https://${VIXSRC_URL}/movie/${tmdbId}`;
        // console.log(`🎬 Verifica film: ${movieUrl}`);
        
        const response = await fetch(applyCorsProxy(movieUrl));
        const html = await response.text();
        
        if (html.includes('window.masterPlaylist')) {
            // console.log(`✅ Film ${tmdbId} disponibile su vixsrc`);
            return true;
        }
        
        const patterns = [
            /sources:\s*\[.*?\]/s,
            /"playlist".*?\.m3u8/,
            /file:\s*["'].*?\.m3u8["']/,
            /video\s+source/i
        ];
        
        for (const pattern of patterns) {
            if (pattern.test(html)) {
                // console.log(`✅ Film ${tmdbId} disponibile (pattern trovato)`);
                return true;
            }
        }
        
        const errorPatterns = [
            /movie not found/i,
            /this movie is not available/i,
            /no sources found/i,
            /error 404/i
        ];
        
        for (const pattern of errorPatterns) {
            if (pattern.test(html)) {
                // console.log(`❌ Film ${tmdbId} non disponibile`);
                return false;
            }
        }
        
        // console.log(`⚠️ Film ${tmdbId}: stato indeterminato`);
        return false;
        
    } catch (error) {
        console.error(`Errore verifica film ${tmdbId}:`, error);
        return false;
    }
}

async function checkTvSeriesAvailability(tmdbId) {
    try {
        const cacheKey = `tv_availability_${tmdbId}`;
        const cached = localStorage.getItem(cacheKey);
        
        if (cached) {
            const cacheData = JSON.parse(cached);
            if (cacheData.expiry > Date.now()) {
                // console.log(`📺 Serie ${tmdbId}: risultato cache ${cacheData.available ? '✅' : '❌'}`);
                return cacheData.available;
            }
        }
        
        // console.log(`📺 Verifica serie TV: ${tmdbId}`);
        
        const firstEpisodeUrl = `https://${VIXSRC_URL}/tv/${tmdbId}/1/1`;
        const response = await fetch(applyCorsProxy(firstEpisodeUrl));
        
        if (!response.ok) {
            const cacheData = {
                available: false,
                expiry: Date.now() + (60 * 60 * 1000)
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
            return false;
        }
        
        const html = await response.text();
        
        const availablePatterns = [
            /window\.masterPlaylist/,
            /sources:\s*\[/,
            /\.m3u8["']/,
            /video\s+id=["']vid-[^"']+["']/,
            /class=["']video-container["']/
        ];
        
        const errorPatterns = [
            /tv show not found/i,
            /no episodes available/i,
            /error 404/i,
            /this series is not available/i
        ];
        
        let isAvailable = false;
        
        for (const pattern of availablePatterns) {
            if (pattern.test(html)) {
                isAvailable = true;
                break;
            }
        }
        
        for (const pattern of errorPatterns) {
            if (pattern.test(html)) {
                isAvailable = false;
                break;
            }
        }
        
        const cacheData = {
            available: isAvailable,
            expiry: Date.now() + (2 * 60 * 60 * 1000)
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        
        // console.log(`📺 Serie ${tmdbId}: ${isAvailable ? '✅ Disponibile' : '❌ Non disponibile'}`);
        return isAvailable;
        
    } catch (error) {
        console.error(`Errore verifica serie TV ${tmdbId}:`, error);
        return false;
    }
}

async function batchCheckAvailability(items, isMovie = true) {
    // console.log(`🔍 Verifica batch di ${items.length} ${isMovie ? 'film' : 'serie'}`);
    
    const results = [];
    const batchSize = 5;
    
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchPromises = batch.map(item => 
            isMovie 
                ? checkMovieAvailability(item.id)
                : checkTvSeriesAvailability(item.id)
        );
        
        const batchResults = await Promise.all(batchPromises);
        
        batch.forEach((item, index) => {
            if (batchResults[index]) {
                results.push(item);
            }
        });
        
        if (i + batchSize < items.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    // console.log(`✅ Trovati ${results.length} ${isMovie ? 'film' : 'serie'} disponibili su ${items.length}`);
    return results;
}

async function checkTvSeriesAvailability(tmdbId) {
    try {
        const seriesUrl = `https://${VIXSRC_URL}/tv/${tmdbId}`;
        const seriesResponse = await fetch(applyCorsProxy(seriesUrl));
        
        if (!seriesResponse.ok) {
            return false;
        }
        
        const seriesHtml = await seriesResponse.text();
        
        const episodesPattern = /season-data.*?data-season="(\d+)"/g;
        const seasonsMatch = [...seriesHtml.matchAll(episodesPattern)];
        
        if (seasonsMatch.length > 0) {
            const firstSeason = seasonsMatch[0][1];
            return await checkEpisodeAvailability(tmdbId, firstSeason, 1);
        }
        
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
        console.error("Errore verifica serie TV:", error);
        return false;
    }
}

async function checkEpisodeAvailability(tmdbId, season, episode) {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            resolve(false);
        }, 3000);
        
        (async () => {
            try {
                const episodeUrl = `https://${VIXSRC_URL}/tv/${tmdbId}/${season}/${episode}`;
                const response = await fetch(applyCorsProxy(episodeUrl));
                
                if (!response.ok) {
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
                console.error("Errore verifica episodio:", error);
                clearTimeout(timeout);
                resolve(false);
            }
        })();
    });
}

// ============ HOME DATA ============
async function loadMobileHomeData() {
    try {
        // console.log('Caricamento dati home mobile...');
        
        const trendingData = await fetchTMDB('trending/all/day');
        if (trendingData.results && trendingData.results.length > 0) {
            populateMobileCarousel('mobile-trending-carousel', trendingData.results);
        }
        
        const nowPlayingData = await fetchTMDB('movie/now_playing');
        if (nowPlayingData.results && nowPlayingData.results.length > 0) {
            populateMobileCarousel('mobile-nowPlaying-carousel', nowPlayingData.results);
        }
        
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