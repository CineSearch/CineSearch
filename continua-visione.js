function trackVideoProgress(tmdbId, mediaType, videoElement, season = null, episode = null) {
  let storageKey = `videoTime_${mediaType}_${tmdbId}`;
  if (mediaType === "tv" && season !== null && episode !== null) {
    storageKey += `_S${season}_E${episode}`;
  }

  // console.log("🎬 trackVideoProgress chiamato per:", storageKey);
  
  const savedTime = getFromStorage(storageKey);
  if (savedTime && parseFloat(savedTime) > 60) {
    // console.log("⏪ Riprendo da:", savedTime, "secondi");
    videoElement.currentTime = parseFloat(savedTime);
  }

  const saveInterval = setInterval(() => {
    if (!videoElement.paused && !videoElement.ended) {
      const currentTime = videoElement.currentTime;
      if (currentTime > 60) {
        saveToStorage(storageKey, currentTime, 365);
      }
    }
  }, 5000);
  videoElement._saveIntervalId = saveInterval;
}

function checkContinuaVisione(items) {
  const carousel = document.getElementById("continua-carousel");
  if (!carousel) {
    console.error("❌ Carosello 'continua-carousel' non trovato!");
    return;
  }
  
  // console.log(`🎯 Creando card per ${items.length} contenuti...`);
  
  carousel.innerHTML = "";
  shownContinuaIds.clear();
  
  items.forEach((item) => {
    const mediaType = item.media_type || (item.title ? "movie" : "tv");
    const baseKey = `videoTime_${mediaType}_${item.id}`;
    const storageKeys = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(baseKey)) {
        storageKeys.push(key);
      }
    }
    
    if (storageKeys.length > 0 && !shownContinuaIds.has(item.id)) {
      // console.log(`🃏 Creo card per: ${item.title || item.name}`);
      const card = createCard(item, storageKeys, true);
      carousel.appendChild(card);
      shownContinuaIds.add(item.id);
    }
  });
  
  if (carousel.children.length > 0) {
    document.getElementById("continua-visione").style.display = "block";
    // console.log(`🎉 Sezione mostrata con ${carousel.children.length} elementi`);
  } else {
    // console.log("📭 Nessuna card creata");
  }
}

async function loadContinuaDaStorage() {
  // console.log("🔄 loadContinuaDaStorage chiamato");
  
  cleanupExpiredStorage();
  
  const items = [];
  const ids = new Set();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    
    if (key && key.startsWith("videoTime_")) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        const now = new Date().getTime();
        if (data.expires && data.expires < now) {
          continue;
        }
        
        const value = parseFloat(data.value);
        
        if (value > 60) {
          // console.log(`✅ Trovato: ${key} = ${value}s`);

          const match = key.match(/videoTime_(movie|tv)_(\d+)/);
          if (match) {
            const [, mediaType, tmdbId] = match;
            const idKey = `${mediaType}-${tmdbId}`;

            if (!ids.has(idKey)) {
              ids.add(idKey);
              
              try {
                const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${API_KEY}&language=it-IT`);
                
                if (!res.ok) {
                  console.error(`❌ TMDB error ${res.status}: ${tmdbId}`);
                  continue;
                }
                
                const itemData = await res.json();
                if (itemData && itemData.id) {
                  itemData.media_type = mediaType;
                  itemData.id = parseInt(tmdbId);
                  
                  // console.log(`🎬 TMDB OK: ${itemData.title || itemData.name}`);
                  items.push(itemData);
                }
              } catch (err) {
                console.error(`❌ Errore TMDB ${tmdbId}:`, err.message);
              }
            }
          }
        }
      } catch (e) {
        console.error(`❌ Errore parsing ${key}:`, e);
      }
    }
  }
  
  // console.log(`📊 Totale contenuti: ${items.length}`);
  
  if (items.length > 0) {
    checkContinuaVisione(items);
  } else {
    // console.log("📭 Nessun contenuto per 'Continua visione'");
    const section = document.getElementById("continua-visione");
    if (section) {
      section.style.display = "block";
      const carousel = document.getElementById("continua-carousel");
      if (carousel) {
        carousel.innerHTML = `<div style="color: #888; text-align: center; padding: 2rem;">
          Guarda un contenuto per almeno 1 minuto per vederlo qui
        </div>`;
      }
    }
  }
}