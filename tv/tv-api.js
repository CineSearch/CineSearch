// API Client ottimizzato per TV
class TVApiClient {
    constructor() {
        this.baseURL = "https://api.themoviedb.org/3";
        this.apiKey = TV_CONFIG.API_KEY;
        this.language = "it-IT";
        this.cache = new Map();
    }

    // Richiesta generica con cache e timeout
    async request(endpoint, params = {}, useCache = true, cacheKey = null) {
        const cacheKeyFinal = cacheKey || `${endpoint}_${JSON.stringify(params)}`;
        
        // Controlla cache
        if (useCache) {
            const cached = TVStorage.get(`api_${cacheKeyFinal}`);
            if (cached) {
                return cached;
            }
        }
        
        // Costruisci URL
        const urlParams = new URLSearchParams({
            api_key: this.apiKey,
            language: this.language,
            ...params
        });
        
        const url = `${this.baseURL}/${endpoint}?${urlParams}`;
        
        try {
            // Timeout per TV
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), TV_CONFIG.API_TIMEOUT);
            
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Salva in cache
            if (useCache) {
                TVStorage.set(`api_${cacheKeyFinal}`, data, 1800000); // 30 minuti
            }
            
            return data;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Timeout della richiesta API');
            }
            throw error;
        }
    }

    // Trending
    async getTrending() {
        return this.request(TV_CONFIG.ENDPOINTS.trending, {}, true, 'trending');
    }

    // Film ora al cinema
    async getNowPlaying(page = 1) {
        return this.request(TV_CONFIG.ENDPOINTS.nowPlaying, { page }, true, `now_playing_${page}`);
    }

    // Film popolari
    async getPopularMovies(page = 1) {
        return this.request(TV_CONFIG.ENDPOINTS.popularMovies, { page }, true, `popular_movies_${page}`);
    }

    // Serie TV in onda
    async getOnTheAir(page = 1) {
        return this.request(TV_CONFIG.ENDPOINTS.onTheAir, { page }, true, `on_the_air_${page}`);
    }

    // Serie TV popolari
    async getPopularTV(page = 1) {
        return this.request(TV_CONFIG.ENDPOINTS.popularTV, { page }, true, `popular_tv_${page}`);
    }

    // Tutti i film con filtri
    async getAllMovies(page = 1, filters = {}) {
        const params = {
            page,
            sort_by: "popularity.desc",
            ...filters
        };
        
        return this.request("discover/movie", params, false);
    }

    // Tutte le serie TV con filtri
    async getAllTV(page = 1, filters = {}) {
        const params = {
            page,
            sort_by: "popularity.desc",
            ...filters
        };
        
        return this.request("discover/tv", params, false);
    }

    // Ricerca
    async search(query, page = 1) {
        return this.request("search/multi", {
            query,
            page,
            include_adult: false
        }, false);
    }

    // Dettaglio film/serie
    async getDetails(mediaType, id) {
        return this.request(`${mediaType}/${id}`, {}, true, `${mediaType}_${id}`);
    }

    // Stagioni serie TV
async getTVSeasons(tvId) {
    try {
        // Usa una cache specifica per le stagioni
        const cacheKey = `tv_seasons_${tvId}`;
        const cached = TVStorage.get(cacheKey);
        
        if (cached) {
            return cached;
        }
        
        // FIX: Usa l'endpoint corretto per ottenere le informazioni complete della serie
        const data = await this.request(`tv/${tvId}`, {
            append_to_response: 'season/1'
        }, true, `tv_details_${tvId}`);
        
        if (tvId === 87623) {
            // Caso speciale per serie specifica
            const specialSeasons = [
                { season_number: 1, name: "Stagione 1", episode_count: 44 },
                { season_number: 2, name: "Stagione 2", episode_count: 100 },
                { season_number: 3, name: "Stagione 3", episode_count: 92 }
            ];
            TVStorage.set(cacheKey, specialSeasons, 3600000);
            return specialSeasons;
        }
        
        const seasons = data.seasons?.filter(s => s.season_number > 0) || [];
        
        // Salva in cache
        TVStorage.set(cacheKey, seasons, 3600000); // 1 ora
        
        return seasons;
        
    } catch (error) {
        console.error(`Error loading seasons for TV ${tvId}:`, error);
        return [];
    }
}

    // Episodi
   async getEpisodes(tvId, seasonNum) {
    try {
        const cacheKey = `tv_episodes_${tvId}_season_${seasonNum}`;
        const cached = TVStorage.get(cacheKey);
        
        if (cached) {
            return cached;
        }
        
        if (tvId === 87623) {
            // Caso speciale per serie specifica
            const episodeCounts = {
                1: 44,
                2: 100,
                3: 92
            };
            
            const count = episodeCounts[seasonNum] || 0;
            const episodes = Array.from({ length: count }, (_, i) => ({
                episode_number: i + 1,
                name: `Episodio ${i + 1}`,
                season_number: seasonNum,
                still_path: null,
                overview: '',
                air_date: ''
            }));
            
            TVStorage.set(cacheKey, episodes, 3600000);
            return episodes;
        }
        
        const data = await this.request(`tv/${tvId}/season/${seasonNum}`, {}, true, `tv_${tvId}_season_${seasonNum}`);
        const episodes = data.episodes || [];
        
        // Aggiungi numero stagione a ogni episodio
        episodes.forEach(ep => {
            ep.season_number = seasonNum;
        });
        
        TVStorage.set(cacheKey, episodes, 3600000);
        return episodes;
        
    } catch (error) {
        console.error(`Error loading episodes for TV ${tvId} S${seasonNum}:`, error);
        return [];
    }
}
    // Categorie
    async getGenres() {
        return this.request("genre/movie/list", {}, true, "genres");
    }

    // Contenuti per categoria
    async getByGenre(genreId, page = 1, filters = {}) {
        const params = {
            page,
            with_genres: genreId,
            sort_by: "popularity.desc",
            ...filters
        };
        
        return this.request("discover/movie", params, false);
    }

    // Controlla disponibilità su Vixsrc (ottimizzato per TV)
    async checkAvailability(tmdbId, isMovie = true, season = null, episode = null) {
    return new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
            TVStorage.set(`avail_${tmdbId}_${isMovie}_${season}_${episode}`, false, 300000);
            resolve(false);
        }, TV_CONFIG.AVAILABILITY_TIMEOUT);
        
        (async () => {
            try {
                let vixsrcUrl;
                
                if (isMovie) {
                    vixsrcUrl = `https://${TV_CONFIG.VIXSRC_URL}/movie/${tmdbId}`;
                } else {
                    if (season === null || episode === null) {
                        vixsrcUrl = `https://${TV_CONFIG.VIXSRC_URL}/tv/${tmdbId}/1/1`;
                    } else {
                        vixsrcUrl = `https://${TV_CONFIG.VIXSRC_URL}/tv/${tmdbId}/${season}/${episode}`;
                    }
                }
                
                const proxiedUrl = applyCorsProxy(vixsrcUrl);
                const controller = new AbortController();
                const fetchTimeoutId = setTimeout(() => controller.abort(), 6000);
                
                const response = await fetch(proxiedUrl, {
                    signal: controller.signal
                });
                
                clearTimeout(fetchTimeoutId);
                
                if (response.status === 404) {
                    TVStorage.set(`avail_${tmdbId}_${isMovie}_${season}_${episode}`, false, 300000);
                    clearTimeout(timeoutId);
                    resolve(false);
                    return;
                }
                
                const html = await response.text();
                const hasPlaylist = /window\.masterPlaylist/.test(html);
                const notFound = /not found|not available|no sources found|error 404/i.test(html);
                
                const isAvailable = hasPlaylist && !notFound;
                TVStorage.set(`avail_${tmdbId}_${isMovie}_${season}_${episode}`, isAvailable, 
                             isAvailable ? 3600000 : 300000);
                
                clearTimeout(timeoutId);
                resolve(isAvailable);
                
            } catch (error) {
                console.error("Availability check error:", error);
                TVStorage.set(`avail_${tmdbId}_${isMovie}_${season}_${episode}`, false, 60000);
                clearTimeout(timeoutId);
                resolve(false);
            }
        })();
    });
}

// Aggiungi metodo per serie TV
async checkSeriesAvailability(tmdbId) {
    return this.checkAvailability(tmdbId, false, 1, 1);
}

// Modifica loadWithAvailability per filtrare meglio
async loadWithAvailability(endpoint, limit = TV_CONFIG.CAROUSEL_ITEMS) {
    try {
        const data = await this.request(endpoint);
        const availableItems = [];
        
        // Usa Promise.all per velocizzare i controlli
        const availabilityChecks = data.results.slice(0, 30).map(async (item, index) => {
            const mediaType = item.media_type || (item.title ? "movie" : "tv");
            const isAvailable = await this.checkAvailability(item.id, mediaType === "movie");
            
            if (isAvailable) {
                item.media_type = mediaType;
                return item;
            }
            return null;
        });
        
        const results = await Promise.all(availabilityChecks);
        
        // Filtra risultati e limita
        for (const result of results) {
            if (result && availableItems.length < limit) {
                availableItems.push(result);
            }
        }
        
        return availableItems;
        
    } catch (error) {
        console.error(`Error loading ${endpoint}:`, error);
        return [];
    }
}
    // Stream diretto da Vixsrc
    async getStream(tmdbId, isMovie = true, season = null, episode = null) {
        try {
            let vixsrcUrl = `https://${TV_CONFIG.VIXSRC_URL}/${isMovie ? "movie" : "tv"}/${tmdbId}`;
            if (!isMovie && season !== null && episode !== null) {
                vixsrcUrl += `/${season}/${episode}`;
            }
            
            const proxiedUrl = applyCorsProxy(vixsrcUrl);
            const response = await fetch(proxiedUrl);
            
            if (!response.ok) {
                throw new Error(`Vixsrc error: ${response.status}`);
            }
            
            const html = await response.text();
            
            // Estrai parametri playlist
            const playlistParamsRegex = /window\.masterPlaylist[^:]+params:[^{]+({[^<]+?})/;
            const playlistParamsMatch = html.match(playlistParamsRegex);
            
            if (!playlistParamsMatch) {
                throw new Error("Playlist params not found");
            }
            
            let playlistParamsStr = playlistParamsMatch[1]
                .replace(/'/g, '"')
                .replace(/\s+/g, "")
                .replace(/\n/g, "")
                .replace(/\\n/g, "")
                .replace(",}", "}");
            
            const playlistParams = JSON.parse(playlistParamsStr);
            
            // Estrai URL playlist
            const playlistUrlRegex = /window\.masterPlaylist\s*=\s*\{[\s\S]*?url:\s*'([^']+)'/;
            const playlistUrlMatch = html.match(playlistUrlRegex);
            
            if (!playlistUrlMatch) {
                throw new Error("Playlist URL not found");
            }
            
            const playlistUrl = playlistUrlMatch[1];
            const canPlayFHDRegex = /window\.canPlayFHD\s+?=\s+?(\w+)/;
            const canPlayFHDMatch = html.match(canPlayFHDRegex);
            const canPlayFHD = canPlayFHDMatch && canPlayFHDMatch[1] === "true";
            
            const hasQuery = /\?[^#]+/.test(playlistUrl);
            const separator = hasQuery ? "&" : "?";
            
            const m3u8Url = playlistUrl + separator +
                "expires=" + playlistParams.expires +
                "&token=" + playlistParams.token +
                (canPlayFHD ? "&h=1" : "");
            
            return {
                iframeUrl: vixsrcUrl,
                m3u8Url: m3u8Url,
                canPlayFHD: canPlayFHD
            };
            
        } catch (error) {
            console.error("Stream extraction error:", error);
            throw error;
        }
    }

    // Carica contenuti con disponibilità filtrata
    async loadWithAvailability(endpoint, limit = TV_CONFIG.CAROUSEL_ITEMS) {
        try {
            const data = await this.request(endpoint);
            const availableItems = [];
            
            for (const item of data.results.slice(0, 20)) { // Controlla più elementi
                const mediaType = item.media_type || (item.title ? "movie" : "tv");
                const isAvailable = await this.checkAvailability(item.id, mediaType === "movie");
                
                if (isAvailable) {
                    item.media_type = mediaType;
                    availableItems.push(item);
                }
                
                if (availableItems.length >= limit) {
                    break;
                }
            }
            
            return availableItems;
            
        } catch (error) {
            console.error(`Error loading ${endpoint}:`, error);
            return [];
        }
    }
}

// Istanza globale
const tvApi = new TVApiClient();

// Funzioni helper globali
async function fetchWithAvailability(type, limit = TV_CONFIG.CAROUSEL_ITEMS) {
    return tvApi.loadWithAvailability(TV_CONFIG.ENDPOINTS[type], limit);
}

async function checkSeriesAvailability(tmdbId) {
    return tvApi.checkAvailability(tmdbId, false, 1, 1);
}

// Esponi al global scope
window.tvApi = tvApi;
window.fetchWithAvailability = fetchWithAvailability;
window.checkSeriesAvailability = checkSeriesAvailability;