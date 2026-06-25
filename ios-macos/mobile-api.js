// mobile-api.js - Gestione chiamate API

const API_KEY = "f75aac685f3389aa89c4f8580c078a28";
const VIXSRC_URL = "vixsrc.to";
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

// ============ HOME DATA ============
async function loadMobileHomeData() {
    try {
        const [trendingData, nowPlayingData, onAirData] = await Promise.all([
            fetchTMDB('trending/all/day'),
            fetchTMDB('movie/now_playing'),
            fetchTMDB('tv/on_the_air')
        ]);

        if (trendingData.results) {
            populateMobileCarousel('mobile-trending-carousel', trendingData.results.slice(0, 10));
        }
        if (nowPlayingData.results) {
            const movies = nowPlayingData.results.slice(0, 10).map(m => { m.media_type = "movie"; return m; });
            populateMobileCarousel('mobile-nowPlaying-carousel', movies);
        }
        if (onAirData.results) {
            const tv = onAirData.results.slice(0, 10).map(t => { t.media_type = "tv"; return t; });
            populateMobileCarousel('mobile-onTheAir-carousel', tv);
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
        
        const movies = (data.results || []).slice(0, ITEMS_PER_PAGE);
        movies.forEach(movie => {
            movie.media_type = "movie";
            grid.appendChild(createMobileCard(movie));
        });
        
        if (movies.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-film"></i>
                    <p>Nessun film in questa categoria</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Errore caricamento categoria:', error);
    }
}