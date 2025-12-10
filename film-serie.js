// Funzioni per caricare tutti i film
// Funzioni per caricare tutti i film (MODIFICATA CORRETTAMENTE)
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
    
    const section = document.getElementById("allMovies");
    const carousel = document.getElementById("allMovies-carousel");
    
    if (page === 1) {
      carousel.innerHTML = "";
      
      // Aggiungi il tasto "Torna alla Home" e i filtri per anno solo la prima volta
      const headerSection = document.querySelector("#allMovies .category-header");
      if (!headerSection) {
        const headerDiv = document.createElement("div");
        headerDiv.className = "category-header";
        headerDiv.innerHTML = `
          <button class="back-to-home" onclick="goBackToHome()" style="background: #2a09e5; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 1rem; cursor: pointer; margin-bottom: 15px; display: inline-block;">
            ← Torna alla Home
          </button>
          <h2>🎬 Tutti i Film</h2>
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
        const h2 = section.querySelector("h2");
        if (h2) {
          h2.parentNode.insertBefore(headerDiv, h2);
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
    section.style.display = "block";
    
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
    await loadAllMovies(
      currentMoviePage + 1, 
      currentMovieMinYear, 
      currentMovieMaxYear  // Mantieni i filtri anno
    );
  }
}

// Funzione per caricare più serie TV (MODIFICATA)
async function loadMoreTV() {
  if (currentTVPage < totalTVPages) {
    await loadAllTV(
      currentTVPage + 1, 
      currentTVMinYear, 
      currentTVMaxYear  // Mantieni i filtri anno
    );
  }
}

// Filtri anno per film
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

// Filtri anno per serie TV
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