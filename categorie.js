// Oggetto delle categorie/genere
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
// Funzione per caricare contenuti di una categoria (MODIFICATA CORRETTAMENTE)
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
          <button class="back-to-categories" onclick="goBackToCategories()" style="background: #2a09e5; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 1rem; cursor: pointer; margin-bottom: 15px; display: inline-block;">
            ← Torna alle Categorie
          </button>
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
      
      // Aggiorna il tasto indietro (assicurati che sia "Torna alle Categorie")
      const backBtn = resultsSection.querySelector(".back-to-categories");
      if (backBtn) {
        backBtn.onclick = () => goBackToCategories();
        backBtn.textContent = "← Torna alle Categorie";
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
    console.error(`Errore nel caricamento della categoria ${category.name}:`, error);
  }
}

// Funzione per caricare più contenuti della categoria
async function loadMoreCategory() {
  if (currentCategory) {
    await loadCategoryContent(
      currentCategory, 
      currentCategoryPage + 1,
      currentMinYear,  // Mantieni i filtri anno
      currentMaxYear
    );
  }
}
// Funzione per tornare alle categorie
// Funzione per tornare alle categorie (SOSTITUISCI l'esistente)
function backToCategories() {
  const resultsSection = document.getElementById("category-results");
  if (resultsSection) {
    resultsSection.style.display = "none";
  }
  document.getElementById("categories").style.display = "block";
  window.scrollTo(0, 0);
}

// Filtri anno per categorie
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