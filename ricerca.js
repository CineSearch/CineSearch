async function performSearch(query) {
  const res = await fetch(
    `https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&language=it-IT&query=${encodeURIComponent(query)}`
  );
  const data = await res.json();
  
  hideAllSections();
  
  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = `
    <div class="grid-header">
      <button class="back-to-home" onclick="goBackToHome()" style="background: #2a09e5; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 1rem; cursor: pointer;">
        ← Torna alla Home
      </button>
      <h2>Risultati per: "${query}"</h2>
    </div>
    <div class="availability-check" id="search-checking">
      <div class="loading-small"></div>
      <span class="checking">Verifica disponibilità...</span>
    </div>
    <div class="vertical-grid" id="search-grid"></div>
    <div class="no-results" id="search-no-results" style="display: none; grid-column: 1 / -1; text-align: center; padding: 3rem;">
      Nessun risultato disponibile trovato
    </div>
  `;
  
  const grid = document.getElementById("search-grid");
  const checkingDiv = document.getElementById("search-checking");
  const noResultsDiv = document.getElementById("search-no-results");
  
  const filteredResults = data.results.filter(
    (item) => item.media_type !== "person" && item.poster_path
  );
  
  let availableCount = 0;
  
  for (const item of filteredResults) {
    const mediaType = item.media_type || (item.title ? "movie" : "tv");
    let isAvailable = false;
    
    if (mediaType === "movie") {
      isAvailable = await checkAvailabilityOnVixsrc(item.id, true);
    } else if (mediaType === "tv") {
      isAvailable = await checkAvailabilityOnVixsrc(item.id, false, 1, 1);
    }
    
    if (isAvailable) {
      item.media_type = mediaType;
      grid.appendChild(createCard(item));
      availableCount++;
    }

    checkingDiv.innerHTML = `
      <div class="loading-small"></div>
      <span class="checking">Verificati ${availableCount}/${filteredResults.length}</span>
    `;
  }
  
  checkingDiv.innerHTML = `
    <span class="available-count">✓ Trovati ${availableCount} risultati disponibili su Vixsrc</span>
  `;
  
  if (availableCount === 0) {
    noResultsDiv.style.display = "block";
    grid.style.display = "none";
  } else {
    noResultsDiv.style.display = "none";
    grid.style.display = "grid";
  }
  
  checkContinuaVisione(filteredResults);
  
  resultsDiv.style.display = "block";
  window.scrollTo(0, 0);
}

function scrollRisultati(direction) {
  console.warn("La funzione scrollRisultati è obsoleta. Usa la navigazione tramite griglia.");
}
