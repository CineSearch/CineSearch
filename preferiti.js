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

function updatePreferitiCounter() {
  const preferiti = getPreferiti();
  const counter = document.getElementById("preferiti-count");
  if (counter) {
    counter.textContent = preferiti.length;
  }
}

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
      
      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn preferiti-remove";
      removeBtn.innerHTML = "⭐ Rimuovi";
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
          
          updatePreferitiCounter();
          
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
  if (!carousel) return;
  
  carousel.innerHTML = "";

  items.forEach((item) => {
    const card = createCard(item, [], false);

    const removeBtn = document.createElement("button");
    removeBtn.innerHTML = "⭐ Rimuovi";
    removeBtn.className = "remove-btn";
    removeBtn.style.position = "absolute";
    removeBtn.style.bottom = "10px";
    removeBtn.style.left = "50%";
    removeBtn.style.transform = "translateX(-50%)";
    removeBtn.style.background = "#e50914";
    removeBtn.style.color = "white";
    removeBtn.style.border = "none";
    removeBtn.style.padding = "8px 16px";
    removeBtn.style.borderRadius = "6px";
    removeBtn.style.fontSize = "0.9rem";
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

function scrollCarouselPreferiti(direction) {
  const carousel = document.getElementById("preferiti-section-carousel");
  if (!carousel) return;
  
  const scrollAmount = carousel.clientWidth * 0.8;
  carousel.scrollBy({
    left: direction * scrollAmount,
    behavior: "smooth"
  });
}