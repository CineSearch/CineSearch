async function loadAllMovies(page = 1, minYear = null, maxYear = null) {
  try {
    currentMovieMinYear = minYear;
    currentMovieMaxYear = maxYear;
    currentMoviePage = page;
    
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
    
    const grid = document.getElementById("allMovies-grid");
    
    if (page === 1) {
      grid.innerHTML = "";
      updateMoviePageInfo();
    }

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
    
    document.getElementById("allMovies").style.display = "block";
    
    updateMoviePaginationInfo(data.total_results);
    updateMoviePageInfo();
    updateMoviePaginationControls();

    if (availableMovies.length === 0 && page === 1) {
      grid.innerHTML = `
        <div class="no-results" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
          Nessun film disponibile trovato${minYear || maxYear ? ` per gli anni ${minYear || '...'} - ${maxYear || '...'}` : ''}
        </div>
      `;
    }
    
    checkContinuaVisione(availableMovies);
    
  } catch (error) {
    console.error("Errore nel caricamento dei film:", error);
  }
}

async function loadAllTV(page = 1, minYear = null, maxYear = null) {
  try {
    currentTVMinYear = minYear;
    currentTVMaxYear = maxYear;
    currentTVPage = page;
    
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
    
    const grid = document.getElementById("allTV-grid");
    
    if (page === 1) {
      grid.innerHTML = "";
      updateTVPageInfo();
    }

    const availableTV = [];
    for (const tv of data.results.slice(0, 50)) {
      tv.media_type = "tv";
      const isAvailable = await checkTvSeriesAvailability(tv.id);
      
      if (isAvailable) {
        grid.appendChild(createCard(tv));
        availableTV.push(tv);
      }
      
      if (availableTV.length >= itemsPerPage) break;
    }
    
    document.getElementById("allTV").style.display = "block";

    updateTVPaginationInfo(data.total_results);
    updateTVPageInfo();
    updateTVPaginationControls();
    
    if (availableTV.length === 0 && page === 1) {
      grid.innerHTML = `
        <div class="no-results" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
          Nessuna serie TV disponibile trovata${minYear || maxYear ? ` per gli anni ${minYear || '...'} - ${maxYear || '...'}` : ''}
        </div>
      `;
    }
    
    checkContinuaVisione(availableTV);
    
  } catch (error) {
    console.error("Errore nel caricamento delle serie TV:", error);
  }
}

function nextMoviePage() {
  if (currentMoviePage < totalMoviePages) {
    loadAllMovies(currentMoviePage + 1, currentMovieMinYear, currentMovieMaxYear);
  }
}

function prevMoviePage() {
  if (currentMoviePage > 1) {
    loadAllMovies(currentMoviePage - 1, currentMovieMinYear, currentMovieMaxYear);
  }
}

function updateMoviePageInfo() {
  const infoElement = document.getElementById("movie-page-info");
  if (infoElement) {
    infoElement.textContent = `Pagina ${currentMoviePage} di ${totalMoviePages}`;
  }
}

function updateMoviePaginationControls() {
  const prevBtn = document.querySelector("#allMovies .page-btn.prev");
  const nextBtn = document.querySelector("#allMovies .page-btn.next");
  
  if (prevBtn) {
    prevBtn.disabled = currentMoviePage <= 1;
  }
  if (nextBtn) {
    nextBtn.disabled = currentMoviePage >= totalMoviePages;
  }
}

function nextTVPage() {
  if (currentTVPage < totalTVPages) {
    loadAllTV(currentTVPage + 1, currentTVMinYear, currentTVMaxYear);
  }
}

function prevTVPage() {
  if (currentTVPage > 1) {
    loadAllTV(currentTVPage - 1, currentTVMinYear, currentTVMaxYear);
  }
}

function updateTVPageInfo() {
  const infoElement = document.getElementById("tv-page-info");
  if (infoElement) {
    infoElement.textContent = `Pagina ${currentTVPage} di ${totalTVPages}`;
  }
}

function updateTVPaginationControls() {
  const prevBtn = document.querySelector("#allTV .page-btn.prev");
  const nextBtn = document.querySelector("#allTV .page-btn.next");
  
  if (prevBtn) {
    prevBtn.disabled = currentTVPage <= 1;
  }
  if (nextBtn) {
    nextBtn.disabled = currentTVPage >= totalTVPages;
  }
}

function applyMovieYearFilter() {
  const minYearInput = document.getElementById("movieMinYear");
  const maxYearInput = document.getElementById("movieMaxYear");
  
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
  
  loadAllMovies(1, minYear || null, maxYear || null);
}

function clearMovieYearFilter() {
  const minYearInput = document.getElementById("movieMinYear");
  const maxYearInput = document.getElementById("movieMaxYear");
  
  if (minYearInput) minYearInput.value = '';
  if (maxYearInput) maxYearInput.value = '';
  
  loadAllMovies(1, null, null);
}

function applyTVYearFilter() {
  const minYearInput = document.getElementById("tvMinYear");
  const maxYearInput = document.getElementById("tvMaxYear");
  
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

  loadAllTV(1, minYear || null, maxYear || null);
}

function clearTVYearFilter() {
  const minYearInput = document.getElementById("tvMinYear");
  const maxYearInput = document.getElementById("tvMaxYear");
  
  if (minYearInput) minYearInput.value = '';
  if (maxYearInput) maxYearInput.value = '';
  
  loadAllTV(1, null, null);
}

function updateMoviePaginationInfo(totalItems) {
  const infoDiv = document.getElementById("movie-pagination-info");
  if (infoDiv) {
    const displayedItems = Math.min(totalItems, currentMoviePage * itemsPerPage);
    infoDiv.textContent = `Mostrati ${displayedItems} di ${totalItems} film totali`;
  }
}

function updateTVPaginationInfo(totalItems) {
  const infoDiv = document.getElementById("tv-pagination-info");
  if (infoDiv) {
    const displayedItems = Math.min(totalItems, currentTVPage * itemsPerPage);
    infoDiv.textContent = `Mostrati ${displayedItems} di ${totalItems} serie totali`;
  }
}