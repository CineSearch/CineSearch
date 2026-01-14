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

async function checkAvailabilityOnVixsrc(tmdbId, isMovie, season = null, episode = null) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      // // console.log("⏰ Timeout per TMDB ID:", tmdbId);
      resolve(false);
    }, AVAILABILITY_CHECK_TIMEOUT);
    
    (async () => {
      try {
        let vixsrcUrl;
        
        if (isMovie) {
          vixsrcUrl = `https://${VIXSRC_URL}/movie/${tmdbId}`;
        } else {
          if (season === null || episode === null) {
            vixsrcUrl = `https://${VIXSRC_URL}/tv/${tmdbId}/1/1`;
          } else {
            vixsrcUrl = `https://${VIXSRC_URL}/tv/${tmdbId}/${season}/${episode}`;
          }
        }
        
        // // console.log("🔗 Controllo URL:", vixsrcUrl);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          // // console.log("🚫 Fetch abortito per timeout:", vixsrcUrl);
        }, 3000);
        
        const response = await fetch(applyCorsProxy(vixsrcUrl), {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        // // console.log("📡 Risposta per", vixsrcUrl, ":", response.status, response.statusText);
        
        if (response.status === 404) {
          // // console.log("❌ 404 - Non disponibile:", vixsrcUrl);
          clearTimeout(timeout);
          resolve(false);
          return;
        }
        
        const html = await response.text();
        const hasPlaylist = /window\.masterPlaylist/.test(html);
        const notFound = /not found|not available|no sources found|error 404/i.test(html);
        
        clearTimeout(timeout);
        resolve(hasPlaylist && !notFound);
        
      } catch (error) {
        console.error("💥 Errore in checkAvailabilityOnVixsrc:", error.name, error.message);
        clearTimeout(timeout);
        resolve(false);
      }
    })();
  });
}

async function checkTvSeriesAvailability(tmdbId) {
  try {
    const firstEpisodeUrl = `https://${VIXSRC_URL}/tv/${tmdbId}/1/1`;
    const response = await fetch(applyCorsProxy(firstEpisodeUrl));
    
    if (!response.ok) {
      return false;
    }
    
    const html = await response.text();
    
    // Verifica se la pagina contiene la playlist
    const hasPlaylist = /window\.masterPlaylist/.test(html);
    const notFound = /not found|not available|no sources found|error 404/i.test(html);
    
    return hasPlaylist && !notFound;
    
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