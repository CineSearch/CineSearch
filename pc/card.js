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
  cookieNames.forEach((storageKey) => {
    try {
      const item = localStorage.getItem(storageKey);
      if (item) {
        const data = JSON.parse(item);
        const savedTime = parseFloat(data.value);
        if (savedTime > 60) {
          const match = storageKey.match(/_S(\d+)_E(\d+)/);
          if (match) {
            badge = `<div class="resume-badge">📺 S${match[1]} • E${match[2]}<br>⏪ ${formatTime(savedTime)}</div>`;
          } else {
            badge = `<div class="resume-badge">⏪ ${formatTime(savedTime)}</div>`;
          }
        }
      }
    } catch (e) {
      console.error("Errore lettura storage in card:", e);
    }
  });
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
    setTimeout(() => {
      openPlayer(item);
    }, 300);
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