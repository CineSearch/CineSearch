function createCard(item, cookieNames = [], isRemovable = false) {
  const card = document.createElement("div");
  card.className = "card";
  card.setAttribute("tabindex", "0");
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `${item.title || item.name || "Contenuto"} - Premi Invio o Spazio per aprire`);

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
  
  // CERCA LA CHIAVE CORRETTA PER QUESTO ITEM
  let foundTime = 0;
  let foundSeason = null;
  let foundEpisode = null;
  
  cookieNames.forEach((storageKey) => {
    try {
      const storageItem = localStorage.getItem(storageKey);
      if (storageItem) {
        const data = JSON.parse(storageItem);
        const savedTime = parseFloat(data.value);
        
        // Verifica se questa chiave appartiene a questo item specifico
        const mediaTypeFromKey = storageKey.match(/videoTime_(movie|tv)_/);
        const tmdbIdFromKey = storageKey.match(/videoTime_(?:movie|tv)_(\d+)/);
        
        if (mediaTypeFromKey && tmdbIdFromKey) {
          const keyMediaType = mediaTypeFromKey[1];
          const keyTmdbId = tmdbIdFromKey[1];
          const currentTmdbId = item.id.toString();
          
          // Controlla se la chiave corrisponde all'item corrente
          if (keyMediaType === mediaType && keyTmdbId === currentTmdbId) {
            // Per serie TV, estrai stagione/episodio se presenti
            if (mediaType === "tv") {
              const episodeMatch = storageKey.match(/_S(\d+)_E(\d+)/);
              if (episodeMatch) {
                // Prendi sempre l'ultimo (più recente) se ci sono più chiavi
                if (savedTime > foundTime) {
                  foundTime = savedTime;
                  foundSeason = episodeMatch[1];
                  foundEpisode = episodeMatch[2];
                }
              } else {
                // Per serie senza episodio specifico (episodio 1)
                if (savedTime > foundTime) {
                  foundTime = savedTime;
                  foundSeason = "1";
                  foundEpisode = "1";
                }
              }
            } else {
              // Per film
              if (savedTime > foundTime) {
                foundTime = savedTime;
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("Errore lettura storage in card:", e);
    }
  });
  
  // CREA IL BADGE CON LE INFORMAZIONI TROVATE
  if (foundTime > 60) {
    if (mediaType === "tv" && foundSeason && foundEpisode) {
      // Se abbiamo trovato un episodio specifico
      badge = `<div class="resume-badge">📺 S${foundSeason} • E${foundEpisode}<br>⏪ ${formatTime(foundTime)}</div>`;
    } else {
      // Per film o serie senza episodio specifico
      badge = `<div class="resume-badge">⏪ ${formatTime(foundTime)}</div>`;
    }
  }
  
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
        ${isRemovable ? `<button class="remove-btn" title="Rimuovi" tabindex="-1">❌</button>` : ""}
        <button class="fav-btn" title="${isInPreferiti ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}" tabindex="-1">
          ${isInPreferiti ? '⭐' : '☆'}
        </button>
      </div>
    </div>
  `;

  if (isInPreferiti) {
    card.classList.add('in-preferiti');
  }

  const favBtn = card.querySelector(".fav-btn");
  favBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const preferiti = getPreferiti();
    const itemId = `${mediaType}-${item.id}`;
    
    if (preferiti.includes(itemId)) {
      removePreferito(item);
      card.classList.remove('in-preferiti');
      favBtn.innerHTML = '☆';
      favBtn.title = 'Aggiungi ai preferiti';
    } else {
      addPreferito(item);
      card.classList.add('in-preferiti');
      favBtn.innerHTML = '⭐';
      favBtn.title = 'Rimuovi dai preferiti';
    }
    if (document.getElementById("preferiti-section") && 
        document.getElementById("preferiti-section").style.display === "block") {
      loadPreferitiSection();
    }
    if (document.getElementById("preferiti")) {
      loadPreferiti();
    }
    updatePreferitiCounter();
  });

  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      card.click();
    }
  });

  card.addEventListener("click", () => {
    card.classList.add("clicked");
    
    // PER SERIE TV: se abbiamo trovato stagione/episodio nel badge, apri direttamente quell'episodio
    if (mediaType === "tv" && foundSeason && foundEpisode) {
      const episodeItem = {
        ...item,
        season: parseInt(foundSeason),
        episode: parseInt(foundEpisode),
        _openAtEpisode: true
      };
      
      setTimeout(() => {
        openPlayer(episodeItem);
      }, 300);
    } else {
      setTimeout(() => {
        openPlayer(item);
      }, 300);
    }
  });

  if (isRemovable) {
    const removeBtn = card.querySelector(".remove-btn");
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const confirmDelete = confirm(`Vuoi rimuovere "${rawTitle}" dalla visione?`);
      if (confirmDelete) {
        cookieNames.forEach((storageKey) => {
          localStorage.removeItem(storageKey);
        });
        card.remove();
        shownContinuaIds.delete(item.id);

        const container = document.getElementById("continua-carousel");
        if (container.children.length === 0) {
          document.getElementById("continua-visione").style.display = "none";
        }
      }
    });
  }

  return card;
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
     
    if (!carousel) {
      return;
    }

    if (carousel.children.length === 0) {
      return;
    }
    if (carousel.scrollWidth <= carousel.clientWidth) {
      return;
    }
    
    const direction = btn.classList.contains('left') ? -1 : 1;
    const scrollAmount = carousel.clientWidth * 0.8;
    if (direction === 1 && carousel.scrollLeft >= (carousel.scrollWidth - carousel.clientWidth - 10)) {
      // // console.log('➡️ Già alla fine destra');
      return;
    }
    
    if (direction === -1 && carousel.scrollLeft <= 10) {
      // // console.log('⬅️ Già all\'inizio sinistra');
      return;
    }
    
    carousel.scrollBy({
      left: direction * scrollAmount,
      behavior: 'smooth'
    });
  });
});