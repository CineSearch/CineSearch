const AVAILABILITY_CHECK_TIMEOUT = 5000; 
async function checkAvailabilityOnVixsrc(tmdbId, isMovie, season = null, episode = null) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), AVAILABILITY_CHECK_TIMEOUT);
    
    (async () => {
      try {
        let vixsrcUrl;
        
        if (isMovie) {
          // Per film: usa il formato standard
          vixsrcUrl = `https://${VIXSRC_URL}/movie/${tmdbId}`;
        } else {
          // Per serie TV: se non sono specificati stagione/episodio, usa il primo episodio
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
        
        const html = await response.text();
        
        // Verifica rapida
        const hasPlaylist = /window\.masterPlaylist/.test(html);
        const notFound = /not found|not available|no sources found|error 404/i.test(html);
        
        clearTimeout(timeout);
        resolve(hasPlaylist && !notFound);
        
      } catch (error) {
        clearTimeout(timeout);
        resolve(false);
      }
    })();
  });
}

// Funzione per verificare disponibilità di una serie TV (controlla almeno un episodio)
async function checkTvSeriesAvailability(tmdbId) {
  try {
    // Prova direttamente con il primo episodio della prima stagione
    const firstEpisodeUrl = `https://${VIXSRC_URL}/tv/${tmdbId}/1/1`;
    const response = await fetch(applyCorsProxy(firstEpisodeUrl));
    
    if (!response.ok) {
      return false;
    }
    
    const html = await response.text();
    
    // Verifica se la pagina contiene la playlist
    const hasPlaylist = /window\.masterPlaylist/.test(html);
    const notFound = /not found|not available|no sources found|error 404/i.test(html);
    
    return hasPlaylist && !notFound;
    
  } catch (error) {
    // console.error("❌ Error checking TV series availability:", error);
    return false;
  }
}
// Modifica le funzioni di caricamento per filtrare i disponibili
async function fetchAndFilterAvailable(type, page = 1) {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/${endpoints[type]}?api_key=${API_KEY}&language=it-IT&page=${page}`
    );
    const data = await res.json();
    
    const availableItems = [];
    
    // Verifica disponibilità per ogni item
    for (const item of data.results) {
      const mediaType = item.media_type || (item.title ? "movie" : "tv");
      const isAvailable = mediaType === "movie" 
        ? await checkAvailabilityOnVixsrc(item.id, true)
        : await checkTvSeriesAvailability(item.id);
      
      if (isAvailable) {
        item.media_type = mediaType;
        availableItems.push(item);
      }
      
      // Limita il numero di controlli per performance
      if (availableItems.length >= 10) break;
    }
    
    return {
      results: availableItems,
      total_pages: data.total_pages,
      total_results: data.total_results
    };
    
  } catch (error) {
    // console.error("❌ Error in fetchAndFilterAvailable:", error);
    return { results: [], total_pages: 0, total_results: 0 };
  }
}

let currentMovieMinYear = null;
let currentMovieMaxYear = null;
let currentTVMinYear = null;
let currentTVMaxYear = null;
function applyMovieYearFilter() {
  const minYearInput = document.getElementById("movieMinYear");
  const maxYearInput = document.getElementById("movieMaxYear");
  
  const minYear = minYearInput ? minYearInput.value : null;
  const maxYear = maxYearInput ? maxYearInput.value : null;
  
  // Validazione base
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
  
  // Ricarica i contenuti con i nuovi filtri
  loadAllMovies(1, minYear || null, maxYear || null);
}

function clearMovieYearFilter() {
  loadAllMovies(1, null, null);
}

// Aggiungi queste funzioni per gestire i filtri anno per serie TV
function applyTVYearFilter() {
  const minYearInput = document.getElementById("tvMinYear");
  const maxYearInput = document.getElementById("tvMaxYear");
  
  const minYear = minYearInput ? minYearInput.value : null;
  const maxYear = maxYearInput ? maxYearInput.value : null;
  
  // Validazione base
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
  
  // Ricarica i contenuti con i nuovi filtri
  loadAllTV(1, minYear || null, maxYear || null);
}

function clearTVYearFilter() {
  loadAllTV(1, null, null);
}

let currentMinYear = null;
let currentMaxYear = null;
function applyYearFilter() {
  const minYearInput = document.getElementById("minYear");
  const maxYearInput = document.getElementById("maxYear");
  
  const minYear = minYearInput ? minYearInput.value : null;
  const maxYear = maxYearInput ? maxYearInput.value : null;
  
  // Validazione base
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
  
  // Ricarica i contenuti con i nuovi filtri
  if (currentCategory) {
    loadCategoryContent(
      currentCategory, 
      1, // Torna alla prima pagina
      minYear || null, 
      maxYear || null
    );
  }
}

function clearYearFilter() {
  if (currentCategory) {
    loadCategoryContent(currentCategory, 1, null, null);
  }
}

// Modifica la funzione loadMoreCategory per mantenere i filtri
async function loadMoreCategory() {
  if (currentCategory) {
    await loadCategoryContent(
      currentCategory, 
      currentCategoryPage + 1,
      currentMinYear,
      currentMaxYear
    );
  }
}

let currentMoviePage = 1;
let currentTVPage = 1;
let totalMoviePages = 0;
let totalTVPages = 0;
let currentCategory = null;
let currentCategoryPage = 1;

// Aggiungi questo oggetto delle categorie/genere
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

// Funzioni per mostrare/nascondere sezioni
function showAllMovies() {
  hideAllSections();
  document.getElementById("allMovies").style.display = "block";
  loadAllMovies(1, currentMovieMinYear, currentMovieMaxYear);
}

// Modifica la funzione showAllTV per resettare i filtri quando si torna alla sezione
function showAllTV() {
  hideAllSections();
  document.getElementById("allTV").style.display = "block";
  loadAllTV(1, currentTVMinYear, currentTVMaxYear);
}

function showTrending() {
  hideAllSections();
  document.getElementById("home").style.display = "block";
  window.scrollTo(0, 0);
}

function showCategories() {
  hideAllSections();
  document.getElementById("categories").style.display = "block";
  loadCategories();
}

function hideAllSections() {
  const sections = ["home", "allMovies", "allTV", "categories", "results", "player"];
  sections.forEach(id => {
    document.getElementById(id).style.display = "none";
  });
}

// Funzioni per caricare tutti i film
async function loadAllMovies(page = 1, minYear = null, maxYear = null) {
  try {
    currentMovieMinYear = minYear;
    currentMovieMaxYear = maxYear;
    
    let apiUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=it-IT&sort_by=popularity.desc&page=${page}`;
    
    if (minYear) {
      apiUrl += `&primary_release_date.gte=${minYear}-01-01`;
    }
    if (maxYear) {
      apiUrl += `&primary_release_date.lte=${maxYear}-12-31`;
    }
    
    const res = await fetch(apiUrl);
    const data = await res.json();
    
    totalMoviePages = data.total_pages;
    currentMoviePage = page;
    
    const carousel = document.getElementById("allMovies-carousel");
    
    if (page === 1) {
      carousel.innerHTML = "";
      
      // Aggiungi i filtri per anno solo la prima volta
      const headerSection = document.querySelector("#allMovies .category-header");
      if (!headerSection) {
        const headerDiv = document.createElement("div");
        headerDiv.className = "category-header";
        headerDiv.innerHTML = `
          <div class="year-filter" style="margin-top: 1rem; margin-bottom: 1rem;">
            <label style="color: #fff; margin-right: 10px;">Filtra per anno:</label>
            <input type="number" id="movieMinYear" placeholder="Da anno" style="padding: 8px; border-radius: 4px; border: 1px solid #333; margin-right: 10px; width: 100px;" 
                   value="${minYear || ''}">
            <input type="number" id="movieMaxYear" placeholder="A anno" style="padding: 8px; border-radius: 4px; border: 1px solid #333; width: 100px;"
                   value="${maxYear || ''}">
            <button onclick="applyMovieYearFilter()" style="background: #2a09e5; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-left: 10px; cursor: pointer;">
              Applica
            </button>
            <button onclick="clearMovieYearFilter()" style="background: #666; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-left: 10px; cursor: pointer;">
              Reset
            </button>
            ${minYear || maxYear ? `<span style="margin-left: 15px; color: #ccc;">Filtro attivo: ${minYear || '...'} - ${maxYear || '...'}</span>` : ''}
          </div>
        `;
        
        // Inserisci i filtri dopo l'h2
        const h2 = document.querySelector("#allMovies h2");
        if (h2) {
          h2.parentNode.insertBefore(headerDiv, h2.nextSibling);
        }
      } else {
        // Aggiorna i valori dei filtri se esistono già
        const movieMinYearInput = document.getElementById("movieMinYear");
        const movieMaxYearInput = document.getElementById("movieMaxYear");
        if (movieMinYearInput) movieMinYearInput.value = minYear || '';
        if (movieMaxYearInput) movieMaxYearInput.value = maxYear || '';
        
        // Aggiorna il testo del filtro attivo
        const activeFilterText = headerSection.querySelector(".year-filter span");
        if (activeFilterText) {
          activeFilterText.textContent = `Filtro attivo: ${minYear || '...'} - ${maxYear || '...'}`;
        }
      }
    }
    
    // Filtra solo film disponibili
    const availableMovies = [];
    for (const movie of data.results) {
      movie.media_type = "movie";
      const isAvailable = await checkAvailabilityOnVixsrc(movie.id, true);
      
      if (isAvailable) {
        carousel.appendChild(createCard(movie));
        availableMovies.push(movie);
      }
      
      // Limita per performance
      if (availableMovies.length >= 15) break;
    }
    
    // Mostra la sezione
    document.getElementById("allMovies").style.display = "block";
    
    // Aggiorna il pulsante "Carica più"
    const loadMoreBtn = document.getElementById("loadMoreMovies");
    if (currentMoviePage >= totalMoviePages || availableMovies.length === 0) {
      loadMoreBtn.style.display = "none";
    } else {
      loadMoreBtn.style.display = "block";
      loadMoreBtn.textContent = `Carica più film (${currentMoviePage}/${totalMoviePages})`;
    }
    
    checkContinuaVisione(availableMovies);
  } catch (error) {
    console.error("Errore nel caricamento dei film:", error);
  }
}

// Funzioni per caricare tutte le serie TV
async function loadAllTV(page = 1, minYear = null, maxYear = null) {
  try {
    currentTVMinYear = minYear;
    currentTVMaxYear = maxYear;
    
    let apiUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&language=it-IT&sort_by=popularity.desc&page=${page}`;
    
    if (minYear) {
      apiUrl += `&first_air_date.gte=${minYear}-01-01`;
    }
    if (maxYear) {
      apiUrl += `&first_air_date.lte=${maxYear}-12-31`;
    }
    
    const res = await fetch(apiUrl);
    const data = await res.json();
    
    totalTVPages = data.total_pages;
    currentTVPage = page;
    
    const carousel = document.getElementById("allTV-carousel");
    
    if (page === 1) {
      carousel.innerHTML = "";
      
      // Aggiungi i filtri per anno solo la prima volta
      const headerSection = document.querySelector("#allTV .category-header");
      if (!headerSection) {
        const headerDiv = document.createElement("div");
        headerDiv.className = "category-header";
        headerDiv.innerHTML = `
          <div class="year-filter" style="margin-top: 1rem; margin-bottom: 1rem;">
            <label style="color: #fff; margin-right: 10px;">Filtra per anno:</label>
            <input type="number" id="tvMinYear" placeholder="Da anno" style="padding: 8px; border-radius: 4px; border: 1px solid #333; margin-right: 10px; width: 100px;" 
                   value="${minYear || ''}">
            <input type="number" id="tvMaxYear" placeholder="A anno" style="padding: 8px; border-radius: 4px; border: 1px solid #333; width: 100px;"
                   value="${maxYear || ''}">
            <button onclick="applyTVYearFilter()" style="background: #2a09e5; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-left: 10px; cursor: pointer;">
              Applica
            </button>
            <button onclick="clearTVYearFilter()" style="background: #666; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-left: 10px; cursor: pointer;">
              Reset
            </button>
            ${minYear || maxYear ? `<span style="margin-left: 15px; color: #ccc;">Filtro attivo: ${minYear || '...'} - ${maxYear || '...'}</span>` : ''}
          </div>
        `;
        
        // Inserisci i filtri dopo l'h2
        const h2 = document.querySelector("#allTV h2");
        if (h2) {
          h2.parentNode.insertBefore(headerDiv, h2.nextSibling);
        }
      } else {
        // Aggiorna i valori dei filtri se esistono già
        const tvMinYearInput = document.getElementById("tvMinYear");
        const tvMaxYearInput = document.getElementById("tvMaxYear");
        if (tvMinYearInput) tvMinYearInput.value = minYear || '';
        if (tvMaxYearInput) tvMaxYearInput.value = maxYear || '';
        
        // Aggiorna il testo del filtro attivo
        const activeFilterText = headerSection.querySelector(".year-filter span");
        if (activeFilterText) {
          activeFilterText.textContent = `Filtro attivo: ${minYear || '...'} - ${maxYear || '...'}`;
        }
      }
    }
    
    // Filtra solo serie TV disponibili
    const availableTV = [];
    for (const tv of data.results) {
      tv.media_type = "tv";
      const isAvailable = await checkTvSeriesAvailability(tv.id);
      
      if (isAvailable) {
        carousel.appendChild(createCard(tv));
        availableTV.push(tv);
      }
      
      // Limita per performance
      if (availableTV.length >= 15) break;
    }
    
    // Mostra la sezione
    document.getElementById("allTV").style.display = "block";
    
    // Aggiorna il pulsante "Carica più"
    const loadMoreBtn = document.getElementById("loadMoreTV");
    if (currentTVPage >= totalTVPages || availableTV.length === 0) {
      loadMoreBtn.style.display = "none";
    } else {
      loadMoreBtn.style.display = "block";
      loadMoreBtn.textContent = `Carica più serie (${currentTVPage}/${totalTVPages})`;
    }
    
    checkContinuaVisione(availableTV);
  } catch (error) {
    console.error("Errore nel caricamento delle serie TV:", error);
  }
}


// Funzione per caricare più film
async function loadMoreMovies() {
  if (currentMoviePage < totalMoviePages) {
    await loadAllMovies(currentMoviePage + 1, currentMovieMinYear, currentMovieMaxYear);
  }
}

// Funzione per caricare più serie TV
async function loadMoreTV() {
  if (currentTVPage < totalTVPages) {
    await loadAllTV(currentTVPage + 1, currentTVMinYear, currentTVMaxYear);
  }
}

// Funzione per aggiornare il contatore dei preferiti nell'header
function updatePreferitiCounter() {
  const preferiti = getPreferiti();
  const counter = document.getElementById("preferiti-count");
  if (counter) {
    counter.textContent = preferiti.length;
  }
}

// Funzione per caricare la sezione dedicata ai preferiti
async function loadPreferitiSection() {
  const preferiti = getPreferiti();
  const carousel = document.getElementById("preferiti-section-carousel");
  const message = document.getElementById("preferiti-message");
  
  if (!carousel) return;
  
  carousel.innerHTML = "";
  
  if (preferiti.length === 0) {
    if (message) message.style.display = "block";
    return;
  }
  
  if (message) message.style.display = "none";
  
  for (const itemId of preferiti) {
    const [mediaType, tmdbId] = itemId.split("-");
    
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${API_KEY}&language=it-IT`
      );
      const item = await res.json();
      item.media_type = mediaType;
      
      const card = createCard(item, [], false);
      
      // Aggiungi pulsante per rimuovere dai preferiti
      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn preferiti-remove";
      removeBtn.innerHTML = "❌ Rimuovi";
      removeBtn.style.cssText = `
        position: absolute;
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: #e50914;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 0.9rem;
        font-weight: bold;
        cursor: pointer;
        z-index: 20;
        transition: all 0.3s ease;
      `;
      
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const confirmRemove = confirm(`Rimuovere "${item.title || item.name}" dai preferiti?`);
        if (confirmRemove) {
          removePreferito(item);
          card.remove();
          
          // Aggiorna il contatore
          updatePreferitiCounter();
          
          // Se non ci sono più preferiti, mostra il messaggio
          const updatedPreferiti = getPreferiti();
          if (updatedPreferiti.length === 0 && message) {
            message.style.display = "block";
          }
        }
      });
      
      card.appendChild(removeBtn);
      carousel.appendChild(card);
      
    } catch (error) {
      // console.error(`Errore nel caricamento del preferito ${itemId}:`, error);
    }
  }
}

// Funzione per mostrare la sezione preferiti
function showPreferiti() {
  hideAllSections();
  document.getElementById("preferiti-section").style.display = "block";
  loadPreferitiSection();
}

// Aggiungi "preferiti-section" alla lista delle sezioni da nascondere
function hideAllSections() {
  const sections = ["home", "allMovies", "allTV", "categories", "results", "player", "preferiti-section"];
  sections.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.style.display = "none";
    }
  });
}

// Chiamala quando aggiungi/rimuovi preferiti
function addPreferito(item) {
  const preferiti = getPreferiti();
  const id = `${item.media_type || (item.title ? "movie" : "tv")}-${item.id}`;
  if (!preferiti.includes(id)) {
    preferiti.push(id);
    localStorage.setItem("preferiti", JSON.stringify(preferiti));
    updatePreferitiCounter();
  }
}

function removePreferito(item) {
  const preferiti = getPreferiti();
  const id = `${item.media_type || (item.title ? "movie" : "tv")}-${item.id}`;
  const updated = preferiti.filter((p) => p !== id);
  localStorage.setItem("preferiti", JSON.stringify(updated));
  updatePreferitiCounter();
}

// Aggiorna il contatore al caricamento della pagina
window.addEventListener("DOMContentLoaded", () => {
  updatePreferitiCounter();

});
// Funzione per caricare le categorie
async function loadCategories() {
  const grid = document.getElementById("categories-grid");
  grid.innerHTML = "";
  
  categories.forEach(category => {
    const categoryCard = document.createElement("div");
    categoryCard.className = "category-card";
    categoryCard.innerHTML = `
      <div class="category-icon">${category.icon}</div>
      <div class="category-name">${category.name}</div>
    `;
    
    categoryCard.addEventListener("click", () => {
      loadCategoryContent(category);
    });
    
    grid.appendChild(categoryCard);
  });
}

// Funzione per caricare contenuti di una categoria
async function loadCategoryContent(category, page = 1, minYear = null, maxYear = null) {
  currentCategory = category;
  currentCategoryPage = page;
  currentMinYear = minYear;
  currentMaxYear = maxYear;
  
  try {
    let apiUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=it-IT&sort_by=popularity.desc&page=${page}&with_genres=${category.id}`;
    
    // Aggiungi filtri per anno se specificati
    if (minYear) {
      apiUrl += `&primary_release_date.gte=${minYear}-01-01`;
    }
    if (maxYear) {
      apiUrl += `&primary_release_date.lte=${maxYear}-12-31`;
    }
    
    const res = await fetch(apiUrl);
    const data = await res.json();
    
    // Nascondi la griglia delle categorie
    document.getElementById("categories").style.display = "none";
    
    // Crea una sezione per i risultati della categoria
    let resultsSection = document.getElementById("category-results");
    if (!resultsSection) {
      resultsSection = document.createElement("section");
      resultsSection.id = "category-results";
      resultsSection.innerHTML = `
        <div class="category-header">
          <button class="back-to-categories" onclick="backToCategories()">← Torna alle categorie</button>
          <h2>${category.icon} ${category.name}</h2>
          <div class="year-filter" style="margin-top: 1rem;">
            <label style="color: #fff; margin-right: 10px;">Filtra per anno:</label>
            <input type="number" id="minYear" placeholder="Da anno" style="padding: 8px; border-radius: 4px; border: 1px solid #333; margin-right: 10px; width: 100px;" 
                   value="${minYear || ''}">
            <input type="number" id="maxYear" placeholder="A anno" style="padding: 8px; border-radius: 4px; border: 1px solid #333; width: 100px;"
                   value="${maxYear || ''}">
            <button onclick="applyYearFilter()" style="background: #2a09e5; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-left: 10px; cursor: pointer;">
              Applica
            </button>
            <button onclick="clearYearFilter()" style="background: #666; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-left: 10px; cursor: pointer;">
              Reset
            </button>
            ${minYear || maxYear ? `<span style="margin-left: 15px; color: #ccc;">Filtro attivo: ${minYear || '...'} - ${maxYear || '...'}</span>` : ''}
          </div>
        </div>
        <div class="carousel-wrapper">
          <button class="arrow left" data-target="category-carousel">◀</button>
          <div class="carousel-container">
            <div class="carousel" id="category-carousel"></div>
          </div>
          <button class="arrow right" data-target="category-carousel">▶</button>
        </div>
        <div class="load-more-container">
          <button id="loadMoreCategory" class="load-more-btn" onclick="loadMoreCategory()">Carica più contenuti</button>
        </div>
      `;
      document.querySelector("main").appendChild(resultsSection);
    } else {
      // Aggiorna i filtri se già esistono
      const minYearInput = document.getElementById("minYear");
      const maxYearInput = document.getElementById("maxYear");
      if (minYearInput) minYearInput.value = minYear || '';
      if (maxYearInput) maxYearInput.value = maxYear || '';
      
      // Aggiorna il testo del filtro attivo
      const activeFilterText = resultsSection.querySelector(".year-filter span");
      if (activeFilterText) {
        activeFilterText.textContent = `Filtro attivo: ${minYear || '...'} - ${maxYear || '...'}`;
      }
    }
    
    const carousel = document.getElementById("category-carousel");
    
    // Pulisci solo se è la prima pagina
    if (page === 1) {
      carousel.innerHTML = "";
      resultsSection.querySelector("h2").textContent = `${category.icon} ${category.name}${minYear || maxYear ? ` (${minYear || '...'} - ${maxYear || '...'})` : ''}`;
    }
    
    data.results.forEach(item => {
      item.media_type = "movie";
      carousel.appendChild(createCard(item));
    });
    
    // Aggiorna il pulsante "Carica più"
    const loadMoreBtn = document.getElementById("loadMoreCategory");
    if (page >= data.total_pages) {
      loadMoreBtn.style.display = "none";
    } else {
      loadMoreBtn.style.display = "block";
      loadMoreBtn.textContent = `Carica più ${category.name} (${page}/${data.total_pages})`;
    }
    
    checkContinuaVisione(data.results);
    resultsSection.style.display = "block";
    
  } catch (error) {
    // console.error(`Errore nel caricamento della categoria ${category.name}:`, error);
  }
}

// Funzione per caricare più contenuti della categoria
async function loadMoreCategory() {
  if (currentCategory) {
    await loadCategoryContent(currentCategory, currentCategoryPage + 1);
  }
}

// Funzione per tornare alle categorie
function backToCategories() {
  const resultsSection = document.getElementById("category-results");
  if (resultsSection) {
    resultsSection.style.display = "none";
  }
  document.getElementById("categories").style.display = "block";
}
function showPreferiti() {
  hideAllSections();
  document.getElementById("preferiti-section").style.display = "block";
  loadPreferitiSection();
}

// Funzione per caricare i preferiti nella sezione dedicata
async function loadPreferitiSection() {
  const preferiti = getPreferiti();
  const carousel = document.getElementById("preferiti-section-carousel");
  const message = document.getElementById("preferiti-message");
  
  carousel.innerHTML = "";
  
  if (preferiti.length === 0) {
    message.style.display = "block";
    return;
  }
  
  message.style.display = "none";
  
  for (const itemId of preferiti) {
    const [mediaType, tmdbId] = itemId.split("-");
    
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${API_KEY}&language=it-IT`
      );
      const item = await res.json();
      item.media_type = mediaType;
      
      const card = createCard(item, [], false);
      
      // Aggiungi pulsante per rimuovere dai preferiti
      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn preferiti-remove";
      removeBtn.innerHTML = "❌ Rimuovi";
      removeBtn.style.cssText = `
        position: absolute;
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: #e50914;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 0.9rem;
        font-weight: bold;
        cursor: pointer;
        z-index: 20;
        transition: all 0.3s ease;
      `;
      
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const confirmRemove = confirm(`Rimuovere "${item.title || item.name}" dai preferiti?`);
        if (confirmRemove) {
          removePreferito(item);
          card.remove();
          
          // Aggiorna il contatore
          const updatedPreferiti = getPreferiti();
          if (updatedPreferiti.length === 0) {
            message.style.display = "block";
          }
          
          // Aggiorna anche la sezione preferiti nella home
          loadPreferiti();
        }
      });
      
      card.appendChild(removeBtn);
      carousel.appendChild(card);
      
    } catch (error) {
      // console.error(`Errore nel caricamento del preferito ${itemId}:`, error);
    }
  }
}

// Funzione per scorrere i preferiti
function scrollCarouselPreferiti(direction) {
  const carousel = document.getElementById("preferiti-section-carousel");
  if (!carousel) return;
  
  const scrollAmount = carousel.clientWidth * 0.8;
  carousel.scrollBy({
    left: direction * scrollAmount,
    behavior: "smooth"
  });
}

// Modifica la funzione showCategories per nascondere anche la sezione preferiti
function hideAllSections() {
  const sections = ["home", "allMovies", "allTV", "categories", "results", "player", "preferiti-section"];
  sections.forEach(id => {
    document.getElementById(id).style.display = "none";
  });
}
const API_KEY = "f75aac685f3389aa89c4f8580c078a28";
const VIXSRC_URL = "vixsrc.to";
const CORS_PROXIES_REQUIRING_ENCODING = [];

const CORS_LIST = [
  "cors-anywhere.com/",
  "corsproxy.io/",
  "api.allorigins.win/raw?url=",
  ...CORS_PROXIES_REQUIRING_ENCODING,
];

// Impostiamo automaticamente corsproxy.io
let CORS = "corsproxy.io/";

const shownContinuaIds = new Set();
const endpoints = {
  trending: `trending/all/week`,
  nowPlaying: `movie/now_playing`,
  popularMovies: `movie/popular`,
  onTheAir: `tv/on_the_air`,
  popularTV: `tv/popular`,
};

let currentItem = null;
let currentSeasons = [];
let player = null;
let baseStreamUrl = "";
let requestHookInstalled = false;


document.getElementById("cors-select").addEventListener("change", (e) => {
  CORS = e.target.value;
  // console.log("🌐 CORS proxy changed to:", CORS);

  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    background: rgba(229, 9, 20, 0.95);
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = `CORS proxy cambiato: ${CORS.replace(/\/|\?|=/g, "")}`;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease";
    setTimeout(() => notification.remove(), 300);
  }, 2000);
});

const originalconsoleWarn = console.warn;
console.warn = function (...args) {
  const message = args[0];
  if (
    typeof message === "string" &&
    (message.includes("videojs.mergeOptions is deprecated") ||
      message.includes("MouseEvent.mozPressure") ||
      message.includes("MouseEvent.mozInputSource"))
  ) {
    return;
  }
  originalconsoleWarn.apply( console, args);
};

function extractBaseUrl(url) {
  try {
    const CORS = document.getElementById("cors-select").value;
    let cleanUrl = url;
    if (url.includes(CORS)) {
      cleanUrl = url.split(CORS)[1];
    }

    const urlObj = new URL(cleanUrl);
    return `${urlObj.protocol}//${urlObj.host}`;
  } catch (e) {
    // console.error("Error extracting base URL:", e);
    return "";
  }
}

function resolveUrl(url, baseUrl = "https://vixsrc.to") {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("/")) {
    return baseUrl + url;
  }

  return baseUrl + "/" + url;
}

function applyCorsProxy(url) {
  const CORS = document.getElementById("cors-select").value;
  const requiresEncoding = CORS_PROXIES_REQUIRING_ENCODING.some(
    (proxy) => CORS === proxy
  );
  let cleanUrl = url;
  if (url.includes(CORS)) {
    if (requiresEncoding) {
      cleanUrl = decodeURIComponent(url.split(CORS)[1]);
    } else {
      cleanUrl = url.split(CORS)[1];
    }
  }
  if (
    !cleanUrl.startsWith("http://") &&
    !cleanUrl.startsWith("https://")
  ) {
    cleanUrl = resolveUrl(cleanUrl);
    // console.log("🔗 Resolved relative URL:", url, "->", cleanUrl);
  }
  if (
    cleanUrl.startsWith("data:") ||
    cleanUrl.startsWith("blob:") ||
    !cleanUrl.startsWith("https://vixsrc.to")
  ) {
    return url;
  }

  // console.log("🔒 Applying CORS proxy to:", cleanUrl);
  if (requiresEncoding) {
    return `https://${CORS}${encodeURIComponent(cleanUrl)}`;
  } else {
    return `https://${CORS}${cleanUrl}`;
  }
}

const xhrRequestHook = (options) => {
  const originalUri = options.uri;
  options.uri = applyCorsProxy(originalUri);

  // console.log("📡 XHR Request intercepted:");
  // console.log("   Original:", originalUri);
  // console.log("   Proxied:", options.uri);

  return options;
};

function setupVideoJsXhrHook() {
  if (typeof videojs === "undefined" || !videojs.Vhs) {
    // console.warn("⚠️ Video.js or Vhs not loaded yet");
    return;
  }

  if (requestHookInstalled) {
    // console.log("✅ XHR hook already installed");
    return;
  }

  // console.log("🔧 Setting up Video.js XHR hook");
  videojs.Vhs.xhr.onRequest(xhrRequestHook);
  requestHookInstalled = true;
  // console.log("✅ Video.js XHR hook installed");
}

function removeVideoJsXhrHook() {
  if (
    typeof videojs !== "undefined" &&
    videojs.Vhs &&
    requestHookInstalled
  ) {
    // console.log("🧹 Removing XHR hook");
    videojs.Vhs.xhr.offRequest(xhrRequestHook);
    requestHookInstalled = false;
  }
}

window.addEventListener("scroll", () => {
  const header = document.getElementById("header");
  if (window.scrollY > 50) {
    header.classList.add("scrolled");
  } else {
    header.classList.remove("scrolled");
  }
});

async function fetchList(type) {
  const res = await fetch(
    `https://api.themoviedb.org/3/${endpoints[type]}?api_key=${API_KEY}&language=it-IT`
  );
  const j = await res.json();
  return j.results;
}

async function fetchTVSeasons(tvId) {
  if (tvId === 87623) {
    // Hercai: override stagioni personalizzate
    return [
      { season_number: 1, name: "Stagione 1" },
      { season_number: 2, name: "Stagione 2" },
      { season_number: 3, name: "Stagione 3" },
    ];
  }

  const res = await fetch(
    `https://api.themoviedb.org/3/tv/${tvId}?api_key=${API_KEY}&language=it-IT`
  );
  const j = await res.json();
  return j.seasons || [];
}

async function fetchEpisodes(tvId, seasonNum) {
  if (tvId === 87623) {
    const episodeCounts = {
      1: 44,
      2: 100,
      3: 92,
    };

    const count = episodeCounts[seasonNum] || 0;

    return Array.from({ length: count }, (_, i) => ({
      episode_number: i + 1,
      name: `Episodio ${i + 1}`,
    }));
  }

  const res = await fetch(
    `https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNum}?api_key=${API_KEY}&language=it-IT`
  );
  const j = await res.json();
  return j.episodes || [];
}

function getPreferiti() {
  const raw = localStorage.getItem("preferiti");
  return raw ? JSON.parse(raw) : [];
}

function addPreferito(item) {
  const preferiti = getPreferiti();
  const id = `${item.media_type || (item.title ? "movie" : "tv")}-${item.id}`;
  if (!preferiti.includes(id)) {
    preferiti.push(id);
    localStorage.setItem("preferiti", JSON.stringify(preferiti));
  }
}

function removePreferito(item) {
  const preferiti = getPreferiti();
  const id = `${item.media_type || (item.title ? "movie" : "tv")}-${item.id}`;
  const updated = preferiti.filter((p) => p !== id);
  localStorage.setItem("preferiti", JSON.stringify(updated));
}

function createCard(item, cookieNames = [], isRemovable = false) {
  const card = document.createElement("div");
  card.className = "card";

  const poster = item.poster_path
    ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
    : "https://via.placeholder.com/200x300?text=No+Image";

  const rawTitle = item.title || item.name || "";
  const mediaType = item.media_type || (item.title ? "movie" : "tv");
  const anno = item.release_date?.slice(0, 4) || item.first_air_date?.slice(0, 4) || "—";
  const tipo = mediaType === "movie" ? "Film" : mediaType === "tv" ? "Serie TV" : "—";
  const voto = item.vote_average?.toFixed(1) || "—";

  let title = rawTitle.length > 42
    ? rawTitle.slice(0, 42).replace(/(.{21})/, "$1\n") + "..."
    : rawTitle.length > 21
      ? rawTitle.replace(/(.{21})/, "$1\n")
      : rawTitle;

  let badge = "";
  cookieNames.forEach((name) => {
    const value = getCookie(name);
    const savedTime = parseFloat(value);
    if (savedTime > 10) {
      const match = name.match(/_S(\d+)_E(\d+)/);
      if (match) {
        badge = `<div class="resume-badge">📺 S${match[1]} • E${match[2]}<br>⏪ ${formatTime(savedTime)}</div>`;
      } else {
        badge = `<div class="resume-badge">⏪ ${formatTime(savedTime)}</div>`;
      }
    }
  });

  // Verifica se l'item è già nei preferiti
  const preferiti = getPreferiti();
  const itemId = `${mediaType}-${item.id}`;
  const isInPreferiti = preferiti.includes(itemId);
  
  card.innerHTML = `
    <div class="card-image-wrapper">
      <img src="${poster}" alt="${rawTitle}">
      <div class="card-title-overlay">${title}</div>
      ${badge}
    </div>
    <div class="card-content">
      <div class="card-meta">
        <div>${anno}</div>
        <div>${voto}</div>
        <div>${tipo}</div>
      </div>
      <div class="card-buttons">
        ${isRemovable ? `<button class="remove-btn" title="Rimuovi">❌</button>` : ""}
        <button class="fav-btn" title="${isInPreferiti ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}">
          ${isInPreferiti ? '❤️' : '🤍'}
        </button>
      </div>
    </div>
  `;

  // Aggiungi classe se è nei preferiti
  if (isInPreferiti) {
    card.classList.add('in-preferiti');
  }

  // Gestione click sul pulsante preferiti
  card.querySelector(".fav-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    const preferiti = getPreferiti();
    const itemId = `${mediaType}-${item.id}`;
    const favBtn = card.querySelector('.fav-btn');
    
    if (preferiti.includes(itemId)) {
      // Rimuovi dai preferiti
      removePreferito(item);
      card.classList.remove('in-preferiti');
      favBtn.innerHTML = '🤍';
      favBtn.title = 'Aggiungi ai preferiti';
    } else {
      // Aggiungi ai preferiti
      addPreferito(item);
      card.classList.add('in-preferiti');
      favBtn.innerHTML = '❤️';
      favBtn.title = 'Rimuovi dai preferiti';
    }
    
    // Aggiorna la sezione preferiti se è visibile
    if (document.getElementById("preferiti-section") && 
        document.getElementById("preferiti-section").style.display === "block") {
      loadPreferitiSection();
    }
    
    // Aggiorna la sezione preferiti nella home
    if (document.getElementById("preferiti")) {
      loadPreferiti();
    }
    
    // Aggiorna il contatore
    updatePreferitiCounter();
  });

  if (isRemovable) {
    const removeBtn = card.querySelector(".remove-btn");
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const confirmDelete = confirm(`Vuoi rimuovere "${rawTitle}" dalla visione?`);
      if (confirmDelete) {
        cookieNames.forEach((name) => {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
        });
        card.remove();
        shownContinuaIds.delete(item.id);
        // console.log(`🗑️ Rimosso ${rawTitle} e cancellati cookie:`, cookieNames);

        const container = document.getElementById("continua-carousel");
        if (container.children.length === 0) {
          document.getElementById("continua-visione").style.display = "none";
        }
      }
    });
  }

  card.addEventListener("click", () => {
    card.classList.add("clicked");
    setTimeout(() => {
      openPlayer(item);
    }, 300);
  });

  return card;
}

async function openPlayer(item) {
  currentItem = item;

  document.getElementById("home").style.display = "none";
  document.getElementById("results").style.display = "none";
  document.getElementById("player").style.display = "block";

  const title = item.title || item.name;
  const releaseDate = item.release_date || item.first_air_date || "N/A";
  const mediaType = item.media_type || (item.title ? "movie" : "tv");

  document.getElementById("player-title").textContent = title;
  document.getElementById("player-meta").innerHTML = `...`;
  document.getElementById("player-overview").textContent =
    item.overview || "...";

  if (mediaType === "tv") {
    document.getElementById("episode-warning").style.display = "flex";
    await loadTVSeasons(item.id);
  } else {
    document.getElementById("episode-warning").style.display = "none";
    document.getElementById("episode-selector").style.display = "none";
    await loadVideo(true, item.id);
  }

  window.scrollTo(0, 0);
}

async function loadTVSeasons(tvId) {
  const seasons = await fetchTVSeasons(tvId);
  currentSeasons = seasons.filter((s) => s.season_number > 0);

  const selector = document.getElementById("season-select");
  selector.innerHTML = "";

  currentSeasons.forEach((season) => {
    const opt = document.createElement("option");
    opt.value = season.season_number;
    opt.textContent = `Stagione ${season.season_number}`;
    selector.appendChild(opt);
  });

  selector.onchange = () => loadEpisodes(tvId, parseInt(selector.value));

  document.getElementById("episode-selector").style.display = "block";

  if (currentSeasons.length > 0) {
    await loadEpisodes(tvId, currentSeasons[0].season_number);
  }
}

async function loadEpisodes(tvId, seasonNum) {
  const episodes = await fetchEpisodes(tvId, seasonNum);
  const container = document.getElementById("episodes-list");
  container.innerHTML = "";

  episodes.forEach((ep) => {
    const div = document.createElement("div");
    div.className = "episode-item";
    div.innerHTML = `
      <div class="episode-number">Episodio ${ep.episode_number}</div>
      <div class="episode-title">${ep.name || "Senza titolo"}</div>
    `;
    div.onclick = () => {
      document
        .querySelectorAll(".episode-item")
        .forEach((e) => e.classList.remove("active"));
      div.classList.add("active");
      document.getElementById("episode-warning").style.display = "none";
      loadVideo(false, tvId, seasonNum, ep.episode_number);
    };
    container.appendChild(div);
  });
}

async function getDirectStream(
  tmdbId,
  isMovie,
  season = null,
  episode = null
) {
  try {
    showLoading(true, "Connessione al server...");

    let vixsrcUrl = `https://${VIXSRC_URL}/${isMovie ? "movie" : "tv"}/${tmdbId}`;
    if (!isMovie && season !== null && episode !== null) {
      vixsrcUrl += `/${season}/${episode}`;
    }

    // console.log("🎬 Fetching stream from:", vixsrcUrl);

    showLoading(true, "Recupero pagina vixsrc...");
    const response = await fetch(applyCorsProxy(vixsrcUrl));
    const html = await response.text();

    // console.log("✅ Page fetched successfully, length:", html.length);

    showLoading(true, "Estrazione parametri stream...");

    const playlistParamsRegex =
      /window\.masterPlaylist[^:]+params:[^{]+({[^<]+?})/;
    const playlistParamsMatch = html.match(playlistParamsRegex);

    if (!playlistParamsMatch) {
      // console.error("❌ HTML Preview:", html.substring(0, 1000));
      throw new Error("Impossibile trovare i parametri della playlist");
    }

    let playlistParamsStr = playlistParamsMatch[1]
      .replace(/'/g, '"')
      .replace(/\s+/g, "")
      .replace(/\n/g, "")
      .replace(/\\n/g, "")
      .replace(",}", "}");

    // console.log("📋 Playlist params string:", playlistParamsStr);

    let playlistParams;
    try {
      playlistParams = JSON.parse(playlistParamsStr);
    } catch (e) {
      // console.error("❌ Failed to parse params:", playlistParamsStr);
      throw new Error("Errore nel parsing dei parametri: " + e.message);
    }

    // console.log("✅ Parsed params:", playlistParams);

    const playlistUrlRegex =
      /window\.masterPlaylist\s*=\s*\{[\s\S]*?url:\s*'([^']+)'/;
    const playlistUrlMatch = html.match(playlistUrlRegex);

    if (!playlistUrlMatch) {
      throw new Error("Impossibile trovare l'URL della playlist");
    }

    const playlistUrl = playlistUrlMatch[1];
    // console.log("🔗 Playlist URL:", playlistUrl);

    const canPlayFHDRegex = /window\.canPlayFHD\s+?=\s+?(\w+)/;
    const canPlayFHDMatch = html.match(canPlayFHDRegex);
    const canPlayFHD = canPlayFHDMatch && canPlayFHDMatch[1] === "true";

    // console.log("🎥 Can play FHD:", canPlayFHD);

    const hasQuery = /\?[^#]+/.test(playlistUrl);
    const separator = hasQuery ? "&" : "?";

    const m3u8Url =
      playlistUrl +
      separator +
      "expires=" +
      playlistParams.expires +
      "&token=" +
      playlistParams.token +
      (canPlayFHD ? "&h=1" : "");

    // console.log("🎬 Generated m3u8 URL:", m3u8Url);

    baseStreamUrl = extractBaseUrl(m3u8Url);
    // console.log("🏠 Base stream URL:", baseStreamUrl);

    showLoading(false);
    return {
      iframeUrl: vixsrcUrl,
      m3u8Url: m3u8Url,
    };
  } catch (error) {
    // console.error("❌ Error in getDirectStream:", error);
    showLoading(false);
    showError("Errore durante l'estrazione dello stream", error.message);
    return null;
  }
}

function setupKeyboardShortcuts() {
  document.removeEventListener("keydown", handleKeyboardShortcuts);
  document.addEventListener("keydown", handleKeyboardShortcuts);
}

function handleKeyboardShortcuts(event) {
  if (!player || !player.readyState()) {
    return;
  }

  if (
    event.target.tagName === "INPUT" ||
    event.target.tagName === "TEXTAREA" ||
    event.target.isContentEditable
  ) {
    return;
  }

  const key = event.key.toLowerCase();

  switch (key) {
    case " ":
      event.preventDefault();
      if (player.paused()) {
        player.play();
      } else {
        player.pause();
      }
      // console.log("⌨️ Play/Pause toggled");
      break;

    case "arrowright":
      event.preventDefault();
      const newTimeForward = Math.min(
        player.currentTime() + 5,
        player.duration()
      );
      player.currentTime(newTimeForward);
      // console.log("⌨️ Seek forward +5s to", newTimeForward.toFixed(2));
      showSeekFeedback("+5s");
      break;

    case "arrowleft":
      event.preventDefault();
      const newTimeBackward = Math.max(player.currentTime() - 5, 0);
      player.currentTime(newTimeBackward);
      // console.log("⌨️ Seek backward -5s to", newTimeBackward.toFixed(2));
      showSeekFeedback("-5s");
      break;

    case "arrowup":
      event.preventDefault();
      const newVolumeUp = Math.min(player.volume() + 0.1, 1);
      player.volume(newVolumeUp);
      showVolumeFeedback(Math.round(newVolumeUp * 100));
      break;

    case "arrowdown":
      event.preventDefault();
      const newVolumeDown = Math.max(player.volume() - 0.1, 0);
      player.volume(newVolumeDown);
      showVolumeFeedback(Math.round(newVolumeDown * 100));
      break;

    case "f":
      event.preventDefault();
      if (player.isFullscreen()) {
        player.exitFullscreen();
      } else {
        player.requestFullscreen();
      }
      // console.log("⌨️ Fullscreen toggled");
      break;

    case "m":
      event.preventDefault();
      player.muted(!player.muted());
      // console.log("⌨️ Mute toggled:", player.muted() ? "ON" : "OFF");
      break;
  }
}

function showSeekFeedback(text) {
  const feedback = document.createElement("div");
  feedback.className = "keyboard-feedback";
  feedback.textContent = text;
  feedback.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    color: #e50914;
    padding: 20px 40px;
    border-radius: 10px;
    font-size: 2rem;
    font-weight: bold;
    z-index: 100;
    pointer-events: none;
    animation: feedbackFade 0.8s ease;
  `;

  const videoContainer = document.querySelector(".video-container");
  videoContainer.appendChild(feedback);

  setTimeout(() => feedback.remove(), 800);
}

function showVolumeFeedback(volumePercent) {
  let volumeDisplay = document.getElementById("volume-feedback");

  if (!volumeDisplay) {
    volumeDisplay = document.createElement("div");
    volumeDisplay.id = "volume-feedback";
    volumeDisplay.style.cssText = `
      position: absolute;
      top: 50%;
      right: 40px;
      transform: translateY(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: #fff;
      padding: 15px 25px;
      border-radius: 8px;
      font-size: 1.5rem;
      font-weight: bold;
      z-index: 100;
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 10px;
    `;

    const videoContainer = document.querySelector(".video-container");
    videoContainer.appendChild(volumeDisplay);
  }

  volumeDisplay.innerHTML = `
    <span>🔊</span>
    <span>${volumePercent}%</span>
  `;

  volumeDisplay.style.opacity = "1";

  if (volumeDisplay.timeoutId) {
    clearTimeout(volumeDisplay.timeoutId);
  }

  volumeDisplay.timeoutId = setTimeout(() => {
    volumeDisplay.style.opacity = "0";
  }, 1000);
}

const feedbackStyles = document.createElement("style");
feedbackStyles.textContent = `
  @keyframes feedbackFade {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.8);
    }
    20% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
    80% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.8);
    }
  }

  #volume-feedback {
    transition: opacity 0.3s ease;
  }
`;
document.head.appendChild(feedbackStyles);

async function loadVideo(isMovie, id, season = null, episode = null) {
  showLoading(true);

  try {
    setupVideoJsXhrHook();

    if (player) {
      player.dispose();
      player = null;

      const videoContainer = document.querySelector(".video-container");
      const oldVideo = document.getElementById("player-video");
      if (oldVideo) {
        oldVideo.remove();
      }

      const newVideo = document.createElement("video");
      newVideo.id = "player-video";
      newVideo.className =
        "video-js vjs-theme-vixflix vjs-big-play-centered";
      newVideo.setAttribute("controls", "");
      newVideo.setAttribute("preload", "auto");
      newVideo.setAttribute("playsinline", "");
      newVideo.setAttribute("crossorigin", "anonymous");

      const loadingOverlay = document.getElementById("loading-overlay");
      videoContainer.insertBefore(newVideo, loadingOverlay);
    }

    const streamData = await getDirectStream(
      id,
      isMovie,
      season,
      episode
    );

    if (!streamData || !streamData.m3u8Url) {
      throw new Error("Impossibile ottenere l'URL dello stream");
    }

    // console.log("🎬 Loading stream:", streamData.m3u8Url);

    const proxiedM3u8Url = applyCorsProxy(streamData.m3u8Url);
    // console.log("🔒 Proxied m3u8 URL:", proxiedM3u8Url);

    player = videojs("player-video", {
      controls: true,
      fluid: true,
      aspectRatio: "16:9",
      playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
      html5: {
        vhs: {
          overrideNative: true,
          bandwidth: 1000000,
        },
      },
      controlBar: {
        children: [
          "playToggle",
          "volumePanel",
          "currentTimeDisplay",
          "timeDivider",
          "durationDisplay",
          "progressControl",
          "remainingTimeDisplay",
          "playbackRateMenuButton",
          "chaptersButton",
          "descriptionsButton",
          "subsCapsButton",
          "audioTrackButton",
          "qualitySelector",
          "fullscreenToggle",
        ],
      },
    });

    player.src({
      src: proxiedM3u8Url,
      type: "application/x-mpegURL",
    });

    player.hlsQualitySelector();

    player.ready(function () {
      setupKeyboardShortcuts();
      showLoading(false);
      // console.log("✅ Player ready");
      
      trackVideoProgress(
        currentItem.id,
        currentItem.media_type || (currentItem.title ? "movie" : "tv"),
        player.el().querySelector("video"),
        season,
        episode
      );

      player.play().catch((e) => {
        // console.log("Auto-play prevented:", e);
      });
    });

    player.on("error", function () {
      // console.error("❌ Video.js error:", player.error());
      showError("Errore durante il caricamento del video");
    });

    player.on("loadeddata", function () {
      // console.log("✅ Video data loaded");
    });
  } catch (err) {
    // console.error("❌ Error loading video:", err);
    showError("Impossibile caricare il video. Riprova più tardi.");
  }
}

function showLoading(show, message = "Caricamento stream...") {
  const overlay = document.getElementById("loading-overlay");
  overlay.style.display = show ? "flex" : "none";
  overlay.querySelector(".loading-text").textContent = message;
}

function showError(message, details = "") {
  showLoading(false);
  const container = document.querySelector(".video-container");
  const errorDiv = document.createElement("div");
  errorDiv.className = "error-message";
  errorDiv.innerHTML = `<h3>⚠️ Errore</h3><p>${message}</p>${details ? `<p style="font-size:0.9em;opacity:0.7;margin-top:0.5em;">${details}</p>` : ""}`;
  container.appendChild(errorDiv);

  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
}

function goBack() {
  if (player) {
    player.dispose();
    player = null;
  }

  document.getElementById("player").style.display = "none";
  document.getElementById("home").style.display = "block";
}

let searchTimeout;
document.getElementById("search").addEventListener("input", (e) => {
  clearTimeout(searchTimeout);
  const query = e.target.value.trim();

  if (query.length < 2) {
    document.getElementById("results").style.display = "none";
    document.getElementById("home").style.display = "block";
    return;
  }

  searchTimeout = setTimeout(() => performSearch(query), 500);
});

function setCookie(name, value, days) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/`;
}

function getCookie(name) {
  const target = name + "=";
  return document.cookie
    .split(";")
    .map((c) => c.trim())
    .filter((c) => c.startsWith(target))
    .map((c) => decodeURIComponent(c.substring(target.length)))[0] || null;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function trackVideoProgress(tmdbId, mediaType, videoElement, season = null, episode = null) {
  let cookieName = `videoTime_${mediaType}_${tmdbId}`;
  if (mediaType === "tv" && season !== null && episode !== null) {
    cookieName += `_S${season}_E${episode}`;
  }

  const savedTime = getCookie(cookieName);
  if (savedTime && parseFloat(savedTime) > 10) {
    videoElement.currentTime = parseFloat(savedTime);
    // console.log(`⏪ Ripreso ${cookieName} da ${formatTime(savedTime)}`);
  }

  setInterval(() => {
    if (!videoElement.paused && !videoElement.ended) {
      const currentTime = videoElement.currentTime;
      setCookie(cookieName, currentTime, 365);
      // console.log(`💾 Salvato ${cookieName} a ${formatTime(currentTime)}`);
    }
  }, 5000);
}

function checkContinuaVisione(items) {
  const carousel = document.getElementById("continua-carousel");
  const allCookies = document.cookie.split(";").map((c) => c.trim());

  items.forEach((item) => {
    const mediaType = item.media_type || (item.title ? "movie" : "tv");
    const baseKey = `videoTime_${mediaType}_${item.id}`;

    const matchingCookies = allCookies.filter((c) => c.startsWith(baseKey));
    const validCookies = matchingCookies.filter((cookie) => {
      const [, value] = cookie.split("=");
      return parseFloat(decodeURIComponent(value)) > 10;
    });

    if (validCookies.length > 0 && !shownContinuaIds.has(item.id)) {
      carousel.appendChild(createCard(item, validCookies.map(c => c.split("=")[0]), true));
      shownContinuaIds.add(item.id);
    }
  });

  if (carousel.children.length > 0) {
    document.getElementById("continua-visione").style.display = "block";
  }
}

async function loadContinuaDaCookie() {
  const allCookies = document.cookie.split(";").map((c) => c.trim());
  const ids = new Set();

  allCookies.forEach((cookie) => {
    const match = cookie.match(/^videoTime_(movie|tv)_(\d+)/);
    if (match && parseFloat(cookie.split("=")[1]) > 10) {
      ids.add(`${match[1]}-${match[2]}`);
    }
  });

  const items = [];

  for (const id of ids) {
    const [mediaType, tmdbId] = id.split("-");
    try {
      const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${API_KEY}&language=it-IT`);
      const data = await res.json();
      data.media_type = mediaType;
      items.push(data);
    } catch (err) {
      // console.error("Errore nel recupero TMDB:", err);
    }
  }

  checkContinuaVisione(items);
}

async function loadPreferiti() {
  const ids = getPreferiti();
  const items = [];

  for (const id of ids) {
    const [mediaType, tmdbId] = id.split("-");
    try {
      const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${API_KEY}&language=it-IT`);
      const data = await res.json();
      data.media_type = mediaType;
      items.push(data);
    } catch (err) {
      // console.error("❌ Errore nel recupero TMDB:", err);
    }
  }

  const carousel = document.getElementById("preferiti-carousel");
  carousel.innerHTML = "";

  items.forEach((item) => {
    const card = createCard(item, [], false);

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Rimuovi dai preferiti";
    removeBtn.className = "remove-btn";
    removeBtn.style.position = "absolute";
    removeBtn.style.bottom = "10px";
    removeBtn.style.left = "10px";
    removeBtn.style.background = "#e50914";
    removeBtn.style.color = "white";
    removeBtn.style.border = "none";
    removeBtn.style.padding = "6px 12px";
    removeBtn.style.borderRadius = "6px";
    removeBtn.style.fontSize = "0.85rem";
    removeBtn.style.fontWeight = "bold";
    removeBtn.style.cursor = "pointer";
    removeBtn.style.zIndex = "10";
    removeBtn.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";

    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removePreferito(item);
      card.remove();

      if (carousel.children.length === 1) {
        document.getElementById("preferiti").style.display = "none";
      }
    });

    card.appendChild(removeBtn);
    carousel.appendChild(card);
  });

  document.getElementById("preferiti").style.display = items.length > 0 ? "block" : "none";
}

function scrollCarousel(carouselId, direction) {
  const carousel = document.getElementById(carouselId);
  if (!carousel) return;

  const scrollAmount = carousel.clientWidth * 0.8;
  carousel.scrollBy({
    left: direction * scrollAmount,
    behavior: "smooth",
  });
}

document.querySelectorAll('.arrow').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-target');
    const carousel = document.getElementById(targetId);
    if (!carousel) return;

    const direction = btn.classList.contains('left') ? -1 : 1;
    const scrollAmount = carousel.clientWidth * 0.8;
    carousel.scrollBy({
      left: direction * scrollAmount,
      behavior: 'smooth'
    });
  });
});

function scrollRisultati(direction) {
  const container = document.getElementById("searchCarousel");
  if (!container) return;

  const scrollAmount = 300 * direction;
  container.scrollBy({
    left: scrollAmount,
    behavior: "smooth"
  });
}

// Modifica la parte di performSearch dove verifichi la disponibilità
async function performSearch(query) {
  const res = await fetch(
    `https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&language=it-IT&query=${encodeURIComponent(query)}`
  );
  const data = await res.json();
  
  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = `
    <h2>Risultati della ricerca</h2>
    <div class="availability-check" id="search-checking">
      <div class="loading-small"></div>
      <span class="checking">Verifica disponibilità...</span>
    </div>
    <div class="vix-carousel">
      <button class="vix-arrow sinistra" onclick="scrollRisultati(-1)">&#10094;</button>
      <div class="carousel" id="searchCarousel"></div>
      <button class="vix-arrow destra" onclick="scrollRisultati(1)">&#10095;</button>
    </div>
  `;
  
  const carousel = resultsDiv.querySelector(".carousel");
  const checkingDiv = document.getElementById("search-checking");
  
  const filteredResults = data.results.filter(
    (item) => item.media_type !== "person" && item.poster_path
  );
  
  let availableCount = 0;
  
  // Filtra solo quelli disponibili
  for (const item of filteredResults) {
    const mediaType = item.media_type || (item.title ? "movie" : "tv");
    let isAvailable = false;
    
    if (mediaType === "movie") {
      isAvailable = await checkAvailabilityOnVixsrc(item.id, true);
    } else if (mediaType === "tv") {
      // Per le serie TV, prova con il primo episodio
      isAvailable = await checkAvailabilityOnVixsrc(item.id, false, 1, 1);
    }
    
    if (isAvailable) {
      item.media_type = mediaType;
      carousel.appendChild(createCard(item));
      availableCount++;
    }
    
    // Aggiorna l'indicatore
    checkingDiv.innerHTML = `
      <div class="loading-small"></div>
      <span class="checking">Verificati ${availableCount}/${filteredResults.length}</span>
    `;
  }
  
  // Finalizza l'indicatore
  checkingDiv.innerHTML = `
    <span class="available-count">✓ Disponibili: ${availableCount} risultati</span>
  `;
  
  if (availableCount === 0) {
    checkingDiv.innerHTML = `
      <span style="color: #e50914;">❌ Nessun risultato disponibile su Vixsrc</span>
    `;
  }
  
  checkContinuaVisione(data.results);
  
  document.getElementById("home").style.display = "none";
  document.getElementById("player").style.display = "none";
  resultsDiv.style.display = "block";
}

document.querySelectorAll(".arrow").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetId = btn.getAttribute("data-target");
    const container = document.getElementById(targetId).parentElement;
    const scrollAmount = container.offsetWidth * 0.8;
    container.scrollBy({
      left: btn.classList.contains("left") ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  });
});

function scrollCarousel(id, direction) {
  const carousel = document.getElementById(id);
  if (carousel) {
    carousel.scrollBy({ left: direction * 300, behavior: 'smooth' });
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  const corsSelect = document.getElementById("cors-select");
  
  CORS_LIST.forEach((proxy) => {
    const option = document.createElement("option");
    option.value = proxy;
    option.textContent = proxy.replace(/\/|\?|=/g, "");
    corsSelect.appendChild(option);
  });
  corsSelect.value = CORS;
  
  if (typeof videojs !== "undefined") {
    setupVideoJsXhrHook();
  } else {
    window.addEventListener("load", setupVideoJsXhrHook);
  }

 for (const [key, endpoint] of Object.entries(endpoints)) {
    try {
      const data = await fetchAndFilterAvailable(key);
      const section = document.getElementById(key);
      const carousel = section.querySelector(".carousel");
      
      carousel.innerHTML = ""; // Pulisci prima
      
      data.results.forEach((item) => {
        carousel.appendChild(createCard(item));
      });
      
      // Nascondi sezione se non ci sono risultati
      if (data.results.length === 0) {
        section.style.display = "none";
      }
      
    } catch (error) {
      // console.error(`❌ Error loading ${key}:`, error);
      document.getElementById(key).style.display = "none";
    }
  }
  
  await loadContinuaDaCookie();
  await loadPreferiti();
});

const style = document.createElement("style");
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
  }
`;
document.head.appendChild(style);
