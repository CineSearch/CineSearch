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
      carousel.appendChild(createCard(item));
      availableCount++;
    }

    checkingDiv.innerHTML = `
      <div class="loading-small"></div>
      <span class="checking">Verificati ${availableCount}/${filteredResults.length}</span>
    `;
  }
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

function scrollRisultati(direction) {
  const container = document.getElementById("searchCarousel");
  if (!container) return;

  const scrollAmount = 300 * direction;
  container.scrollBy({
    left: scrollAmount,
    behavior: "smooth"
  });
}