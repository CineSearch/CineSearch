async function fetchList(type) {
  const res = await fetch(
    `https://api.themoviedb.org/3/${endpoints[type]}?api_key=${API_KEY}&language=it-IT`
  );
  const j = await res.json();
  return j.results;
}

async function fetchTVSeasons(tvId) {
  if (tvId === 87623) {
    return [
      { season_number: 1, name: "Stagione 1" },
      { season_number: 2, name: "Stagione 2" },
      { season_number: 3, name: "Stagione 3" },
    ];
  }

  const res = await fetch(
    `https://api.themoviedb.org/3/tv/${tvId}?api_key=${API_KEY}&language=it-IT`
  );
  const j = await res.json();
  return j.seasons || [];
}

async function fetchEpisodes(tvId, seasonNum) {
  if (tvId === 87623) {
    const episodeCounts = {
      1: 44,
      2: 100,
      3: 92,
    };

    const count = episodeCounts[seasonNum] || 0;

    return Array.from({ length: count }, (_, i) => ({
      episode_number: i + 1,
      name: `Episodio ${i + 1}`,
    }));
  }

  const res = await fetch(
    `https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNum}?api_key=${API_KEY}&language=it-IT`
  );
  const j = await res.json();
  return j.episodes || [];
}

const AVAILABILITY_CACHE_DURATION = 24 * 60 * 60 * 1000;

function getFromAvailabilityCache(tmdbId, isMovie) {
  try {
    const key = `avail_${isMovie ? 'movie' : 'tv'}_${tmdbId}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      const data = JSON.parse(cached);
      if (Date.now() < data.expires) {
        return data.available;
      }
      localStorage.removeItem(key);
    }
  } catch (e) {}
  return null;
}

function setToAvailabilityCache(tmdbId, isMovie, available) {
  try {
    const key = `avail_${isMovie ? 'movie' : 'tv'}_${tmdbId}`;
    localStorage.setItem(key, JSON.stringify({
      available: available,
      expires: Date.now() + AVAILABILITY_CACHE_DURATION
    }));
  } catch (e) {}
}

async function checkAvailabilityOnVixsrc(tmdbId, isMovie, season = null, episode = null) {
  const cached = getFromAvailabilityCache(tmdbId, isMovie);
  if (cached !== null) {
    return cached;
  }
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, AVAILABILITY_CHECK_TIMEOUT);
    
    (async () => {
      try {
        let vixsrcUrl;
        
        if (isMovie) {
          vixsrcUrl = `https://${VIXSRC_URL}/api/movie/${tmdbId}`;
        } else {
          vixsrcUrl = `https://${VIXSRC_URL}/api/tv/${tmdbId}/1/1`;
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 15000);
        
        const response = await fetch(applyCorsProxy(vixsrcUrl), {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (response.status === 404) {
          setToAvailabilityCache(tmdbId, isMovie, false);
          clearTimeout(timeout);
          resolve(false);
          return;
        }
        
        const text = await response.text();
        
        if (!text || !text.startsWith('{')) {
          setToAvailabilityCache(tmdbId, isMovie, false);
          clearTimeout(timeout);
          resolve(false);
          return;
        }
        
        const data = JSON.parse(text);
        const available = Boolean(data && data.src);
        setToAvailabilityCache(tmdbId, isMovie, available);
        
        clearTimeout(timeout);
        resolve(available);
        
      } catch (error) {
        console.error("💥 Errore in checkAvailabilityOnVixsrc:", error.name, error.message);
        clearTimeout(timeout);
        resolve(false);
      }
    })();
  });
}

async function checkTvSeriesAvailability(tmdbId) {
  const cached = getFromAvailabilityCache(tmdbId, false);
  if (cached !== null) {
    return cached;
  }
  
  try {
    const vixsrcUrl = `https://${VIXSRC_URL}/api/tv/${tmdbId}/1/1`;
    const response = await fetch(applyCorsProxy(vixsrcUrl));
    
    if (!response.ok) {
      setToAvailabilityCache(tmdbId, false, false);
      return false;
    }
    
    const text = await response.text();
    
    if (!text || !text.startsWith('{')) {
      setToAvailabilityCache(tmdbId, false, false);
      return false;
    }
    
    const data = JSON.parse(text);
    const available = Boolean(data && data.src);
    setToAvailabilityCache(tmdbId, false, available);
    
    return available;
    
  } catch (error) {
    return false;
  }
}

async function fetchAndFilterAvailable(type, page = 1) {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/${endpoints[type]}?api_key=${API_KEY}&language=it-IT&page=${page}`
    );
    const data = await res.json();
    
    const availableItems = [];
    for (const item of data.results) {
      const mediaType = item.media_type || (item.title ? "movie" : "tv");
      const isAvailable = mediaType === "movie" 
        ? await checkAvailabilityOnVixsrc(item.id, true)
        : await checkTvSeriesAvailability(item.id);
      
      if (isAvailable) {
        item.media_type = mediaType;
        availableItems.push(item);
      }
      if (availableItems.length >= 10) break;
    }
    
    return {
      results: availableItems,
      total_pages: data.total_pages,
      total_results: data.total_results
    };
    
  } catch (error) {
    return { results: [], total_pages: 0, total_results: 0 };
  }
}