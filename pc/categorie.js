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

async function loadCategoryContent(category, page = 1, minYear = null, maxYear = null) {
  currentCategory = category;
  currentCategoryPage = page;
  currentMinYear = minYear;
  currentMaxYear = maxYear;
  
  try {
    let apiUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=it-IT&sort_by=popularity.desc&page=${page}&with_genres=${category.id}`;
    
    if (minYear) {
      apiUrl += `&primary_release_date.gte=${minYear}-01-01`;
    }
    if (maxYear) {
      apiUrl += `&primary_release_date.lte=${maxYear}-12-31`;
    }
    
    const res = await fetch(apiUrl);
    const data = await res.json();
    
    document.getElementById("categories").style.display = "none";
    
    let resultsSection = document.getElementById("category-results");
    if (!resultsSection) {
      resultsSection = document.createElement("section");
      resultsSection.id = "category-results";
      document.querySelector("main").appendChild(resultsSection);
    }
    
    resultsSection.innerHTML = `
      <div class="grid-header">
        <button class="back-to-categories" onclick="goBackToCategories()" style="background: #2a09e5; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 1rem; cursor: pointer;">
          ← Torna alle Categorie
        </button>
        <h2 id="category-results-title">${category.icon} ${category.name}</h2>
        <div class="grid-controls">
          <div class="year-filter" style="display: flex; align-items: center; gap: 10px;">
            <label style="color: #fff;">Filtra per anno:</label>
            <input type="number" id="minYear" placeholder="Da" style="padding: 8px; width: 80px; border-radius: 4px; border: 1px solid #333;" 
                   value="${minYear || ''}">
            <span>-</span>
            <input type="number" id="maxYear" placeholder="A" style="padding: 8px; width: 80px; border-radius: 4px; border: 1px solid #333;"
                   value="${maxYear || ''}">
            <button onclick="applyYearFilter()" style="background: #2a09e5; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-left: 10px; cursor: pointer;">
              Applica
            </button>
            <button onclick="clearYearFilter()" style="background: #666; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-left: 10px; cursor: pointer;">
              Reset
            </button>
          </div>
        </div>
      </div>
      <div class="pagination-info" id="category-pagination-info" style="margin: 0 4% 1rem; color: #aaa;"></div>
      <div class="vertical-grid" id="category-grid"></div>
      <div class="pagination-controls">
        <button class="page-btn prev" onclick="prevCategoryPage()" ${page <= 1 ? 'disabled' : ''}>◀ Precedente</button>
        <span class="page-info" id="category-page-info">Pagina ${page} di ${data.total_pages}</span>
        <button class="page-btn next" onclick="nextCategoryPage()" ${page >= data.total_pages ? 'disabled' : ''}>Successiva ▶</button>
      </div>
    `;
    
    const grid = document.getElementById("category-grid");
    
    const availableMovies = [];
    for (const movie of data.results.slice(0, 50)) {
      movie.media_type = "movie";
      const isAvailable = await checkAvailabilityOnVixsrc(movie.id, true);
      
      if (isAvailable) {
        grid.appendChild(createCard(movie));
        availableMovies.push(movie);
      }
      
      if (availableMovies.length >= itemsPerPage) break;
    }
    
    updateCategoryPaginationInfo(data.total_results);
    updateCategoryPageInfo(data.total_pages);
    
    if (availableMovies.length === 0) {
      grid.innerHTML = `
        <div class="no-results" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
          Nessun film disponibile trovato in "${category.name}"${minYear || maxYear ? ` per gli anni ${minYear || '...'} - ${maxYear || '...'}` : ''}
        </div>
      `;
    }
    
    checkContinuaVisione(availableMovies);
    resultsSection.style.display = "block";
    
  } catch (error) {
    console.error(`Errore nel caricamento della categoria ${category.name}:`, error);
  }
}

function nextCategoryPage() {
  if (currentCategory) {
    loadCategoryContent(
      currentCategory, 
      currentCategoryPage + 1,
      currentMinYear,
      currentMaxYear
    );
  }
}

function prevCategoryPage() {
  if (currentCategory && currentCategoryPage > 1) {
    loadCategoryContent(
      currentCategory, 
      currentCategoryPage - 1,
      currentMinYear,
      currentMaxYear
    );
  }
}

function updateCategoryPageInfo(totalPages) {
  const infoElement = document.getElementById("category-page-info");
  if (infoElement) {
    infoElement.textContent = `Pagina ${currentCategoryPage} di ${totalPages}`;
  }
}

function updateCategoryPaginationInfo(totalItems) {
  const infoDiv = document.getElementById("category-pagination-info");
  if (infoDiv) {
    infoDiv.textContent = `${totalItems} film totali nella categoria`;
  }
}

function applyYearFilter() {
  const minYearInput = document.getElementById("minYear");
  const maxYearInput = document.getElementById("maxYear");
  
  const minYear = minYearInput ? minYearInput.value : null;
  const maxYear = maxYearInput ? maxYearInput.value : null;

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

  if (currentCategory) {
    loadCategoryContent(
      currentCategory, 
      1, 
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