let player = null;
let currentItem = null;
let currentSeasons = [];

// Funzione per tentare accesso diretto (senza proxy)
async function fetchDirect(url) {
  // Prova prima senza proxy (funziona se il server supporta CORS)
  return fetch(url, { mode: 'cors' });
}

async function openPlayer(item) {
  currentItem = item;
  const currentSection = document.querySelector('section[style*="block"]')?.id || 'home';
  document.getElementById("home").style.display = "none";
  document.getElementById("results").style.display = "none";
  document.getElementById("player").style.display = "block";
  history.pushState({ section: 'player', previousSection: currentSection, item: item }, '', '#player');
  if (player) {
    player.dispose();
    player = null;
    const oldVideo = document.getElementById("player-video");
    if (oldVideo) oldVideo.remove();
  }

  const title = item.title || item.name;
  const releaseDate = item.release_date || item.first_air_date || "N/A";
  const mediaType = item.media_type || (item.title ? "movie" : "tv");

  document.getElementById("player-title").textContent = title;
  document.getElementById("player-meta").innerHTML = `...`;
  document.getElementById("player-overview").textContent =
    item.overview || "...";

  if (mediaType === "tv") {
    // // console.log('🎬 player.js - Serie TV, carico stagioni');
    document.getElementById("episode-warning").style.display = "flex";
    await loadTVSeasons(item.id);
    
    // NUOVA LOGICA: se l'item ha dati di episodio specifico, selezionalo automaticamente
    if (item._openAtEpisode && item.season && item.episode) {
      setTimeout(async () => {
        const seasonSelect = document.getElementById("season-select");
        const episodeList = document.getElementById("episodes-list");
        
        if (seasonSelect && episodeList) {
          // Seleziona la stagione corretta
          seasonSelect.value = item.season;
          
          // Attendi il caricamento degli episodi
          await loadEpisodes(item.id, item.season);
          
          // Trova e clicca l'episodio corretto
          const episodes = episodeList.querySelectorAll(".episode-item");
          for (const epDiv of episodes) {
            const epNumText = epDiv.querySelector(".episode-number").textContent;
            const epNum = parseInt(epNumText.replace("Episodio ", ""));
            
            if (epNum === item.episode) {
              epDiv.click();
              break;
            }
          }
        }
      }, 500);
    }
  } else {
    // // console.log('🎬 player.js - Film, carico direttamente');
    document.getElementById("episode-warning").style.display = "none";
    document.getElementById("episode-selector").style.display = "none";
    await loadVideo(true, item.id);
  }

  window.scrollTo(0, 0);
}

async function loadTVSeasons(tvId) {
  // // console.log('🎬 player.js - loadTVSeasons per ID:', tvId);
  const seasons = await fetchTVSeasons(tvId);
  currentSeasons = seasons.filter((s) => s.season_number > 0);

  const selector = document.getElementById("season-select");
  selector.innerHTML = "";

  currentSeasons.forEach((season) => {
    const opt = document.createElement("option");
    opt.value = season.season_number;
    opt.textContent = `Stagione ${season.season_number}`;
    selector.appendChild(opt);
  });

  selector.onchange = () => loadEpisodes(tvId, parseInt(selector.value));

  document.getElementById("episode-selector").style.display = "block";

  if (currentSeasons.length > 0) {
    await loadEpisodes(tvId, currentSeasons[0].season_number);
  }
}


async function loadEpisodes(tvId, seasonNum) {
  // // console.log('🎬 player.js - loadEpisodes S:', seasonNum, 'per TV ID:', tvId);
  const episodes = await fetchEpisodes(tvId, seasonNum);
  const container = document.getElementById("episodes-list");
  container.innerHTML = "";

  episodes.forEach((ep) => {
    const div = document.createElement("div");
    div.className = "episode-item";
    div.innerHTML = `
      <div class="episode-number">Episodio ${ep.episode_number}</div>
      <div class="episode-title">${ep.name || "Senza titolo"}</div>
    `;
    div.onclick = () => {
      document
        .querySelectorAll(".episode-item")
        .forEach((e) => e.classList.remove("active"));
      div.classList.add("active");
      document.getElementById("episode-warning").style.display = "none";
      loadVideo(false, tvId, seasonNum, ep.episode_number);
    };
    container.appendChild(div);
  });
}

async function loadVideo(isMovie, id, season = null, episode = null) {
  showLoading(true);

  try {
    // // console.log('🎬 player.js - Setup video.js xhr hook');
    setupVideoJsXhrHook();
    
    if (player) {
      // // console.log('🎬 player.js - Pulizia player esistente');
      player.dispose();
      player = null;
    }

    // // console.log('🎬 player.js - Ottenimento stream...');
    const streamData = await getDirectStream(
      id,
      isMovie,
      season,
      episode
    );

    // // console.log('🎬 player.js - Stream data ottenuto:', streamData);

    // Se streamData è null, significa che il video è stato aperto in nuova finestra
    if (!streamData) {
      showLoading(false);
      return;
    }

    if (!streamData.m3u8Url) {
      throw new Error("Impossibile ottenere l'URL dello stream");
    }

    const proxiedM3u8Url = applyCorsProxy(streamData.m3u8Url);
    // // console.log('🎬 player.js - M3U8 URL con proxy:', proxiedM3u8Url);

    let videoElement = document.getElementById("player-video");
    if (!videoElement) {
      // // console.log('🎬 player.js - Creazione nuovo elemento video');
      const videoContainer = document.querySelector(".video-container");
      videoElement = document.createElement("video");
      videoElement.id = "player-video";
      videoElement.className = "video-js vjs-theme-cinesearch vjs-big-play-centered";
      videoElement.setAttribute("controls", "");
      videoElement.setAttribute("preload", "auto");
      videoElement.setAttribute("playsinline", "");
      videoElement.setAttribute("crossorigin", "anonymous");
      
      const loadingOverlay = document.getElementById("loading-overlay");
      videoContainer.insertBefore(videoElement, loadingOverlay);
    }

    // // console.log('🎬 player.js - Inizializzazione video.js');
    player = videojs("player-video", {
      controls: true,
      fluid: true,
      aspectRatio: "16:9",
      playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
      html5: {
        vhs: {
          overrideNative: true,
          bandwidth: 1000000,
          // AGGIUNGI QUESTA OPZIONE
          limitRenditionByPlayerDimensions: false
        },
      },
      // IMPOSTAZIONI MIGLIORATE PER LA TIMELINE
      userActions: {
        hotkeys: true,
        click: true,
        doubleClick: true
      },
      controlBar: {
        volumePanel: {
          inline: false
        },
        children: [
          "playToggle",
          "volumePanel",
          "currentTimeDisplay",
          "timeDivider",
          "durationDisplay",
          "progressControl", // ASSICURATI CHE SIA PRESENTE
          "remainingTimeDisplay",
          "playbackRateMenuButton",
          "chaptersButton",
          "descriptionsButton",
          "subsCapsButton",
          "audioTrackButton",
          "qualitySelector",
          "fullscreenToggle",
        ],
      },
    });

    // // console.log('🎬 player.js - Impostazione sorgente video');
    player.src({
      src: proxiedM3u8Url,
      type: "application/x-mpegURL",
    });

    // // console.log('🎬 player.js - Aggiunta quality selector');
    player.hlsQualitySelector();

    player.ready(function () {
      // // console.log('🎬 player.js - Video.js ready');
      setupKeyboardShortcuts();
      showLoading(false);
      
      trackVideoProgress(
        currentItem.id,
        currentItem.media_type || (currentItem.title ? "movie" : "tv"),
        player.el().querySelector("video"),
        season,
        episode
      );

      // FIX FINALE PER TIMELINE - Forza il ridisegno
      setTimeout(() => {
        const progressControl = player.controlBar.getChild('progressControl');
        if (progressControl) {
          // // console.log('🎬 player.js - Aggiornamento progress control');
          // Forza il ridisegno della timeline
          progressControl.el().style.display = 'none';
          progressControl.el().offsetHeight; // Trigger reflow
          progressControl.el().style.display = '';
        }
      }, 100);

      // // console.log('🎬 player.js - Tentativo di avvio riproduzione');
      player.play().catch((e) => {
        // // console.log('🎬 player.js - Auto-play prevented:', e);
      });
    });

    // AGGIUNGI QUESTO LISTENER PER IL MOUSE MOVE
    player.on('mousemove', function() {
      const mouseDisplay = player.controlBar.progressControl.mouseDisplay;
      if (mouseDisplay) {
        mouseDisplay.el().style.zIndex = '1000';
      }
    });

    player.on("error", function () {
      console.error('🎬 player.js - Errore video.js:', player.error());
      showError("Errore durante il caricamento del video");
    });

    // Aggiungi listener per debug
    player.on('loadedmetadata', function() {
      // // console.log('🎬 player.js - Metadata loaded, duration:', player.duration());
    });
    
  } catch (err) {
    console.error('🎬 player.js - Errore in loadVideo:', err);
    showError("Impossibile caricare il video. Riprova più tardi.");
  }
}

async function getDirectStream(tmdbId, isMovie, season = null, episode = null) {
  
  try {
    showLoading(true, "Connessione al server...");

    let vixsrcUrl;
    if (isMovie) {
      vixsrcUrl = `https://${VIXSRC_URL}/api/movie/${tmdbId}`;
    } else {
      vixsrcUrl = `https://${VIXSRC_URL}/api/tv/${tmdbId}/${season || 1}/${episode || 1}`;
    }
    
    showLoading(true, "Recupero stream da VixSrc...");
    
    let response;
    let data;
    
    // Prova diretto
    try {
      response = await fetchDirect(vixsrcUrl);
      if (response.ok) {
        const text = await response.text();
        if (text && text.startsWith('{')) {
          data = JSON.parse(text);
        }
      }
    } catch (e) {
      console.log("Fetch diretto fallito:", e.message);
    }
    
    // Se fallisce, usa il proxy di default
    if (!data || !data.src) {
      const proxyUrl = applyCorsProxy(vixsrcUrl);
      response = await fetch(proxyUrl);
      const text = await response.text();
      if (text && text.startsWith('{')) {
        data = JSON.parse(text);
      }
    }
    
    if (!response || !response.ok || !data || !data.src) {
      throw new Error("Nessuno stream disponibile");
    }
    
    const embedUrl = data.src.startsWith('/') 
      ? `https://${VIXSRC_URL}${data.src}`
      : data.src;

    showLoading(true, "Recupero embed...");
    
    let html = null;
    
    // Prova fetch diretto per embed
    try {
      const embedResponse = await fetchDirect(embedUrl);
      if (embedResponse.ok) {
        html = await embedResponse.text();
      }
    } catch (e) {
      console.log("Fetch embed diretto fallito:", e.message);
    }
    
    // Se fallisce, usa il proxy
    if (!html || !html.includes('masterPlaylist')) {
      const proxyUrl = applyCorsProxy(embedUrl);
      const embedResponse = await fetch(proxyUrl);
      if (embedResponse.ok) {
        html = await embedResponse.text();
      }
    }
    
    if (!html || !html.includes('masterPlaylist') || html.includes('Forbidden')) {
      showLoading(false);
      window.open(embedUrl, '_blank');
      return null;
    }
    
    const playlistParamsRegex = /window\.masterPlaylist[^:]+params:[^{]+({[^<]+?})/;
    const playlistParamsMatch = html.match(playlistParamsRegex);

    if (!playlistParamsMatch) {
      showLoading(false);
      window.open(embedUrl, '_blank');
      return null;
    }

    let playlistParamsStr = playlistParamsMatch[1]
      .replace(/'/g, '"')
      .replace(/\s+/g, "")
      .replace(/\n/g, "")
      .replace(/\\n/g, "")
      .replace(",}", "}");

    let playlistParams;
    try {
      playlistParams = JSON.parse(playlistParamsStr);
    } catch (e) {
      showLoading(false);
      window.open(embedUrl, '_blank');
      return null;
    }

    const playlistUrlRegex = /window\.masterPlaylist\s*=\s*\{[\s\S]*?url:\s*'([^']+)'/;
    const playlistUrlMatch = html.match(playlistUrlRegex);

    if (!playlistUrlMatch) {
      showLoading(false);
      window.open(embedUrl, '_blank');
      return null;
    }

    const playlistUrl = playlistUrlMatch[1];

    const canPlayFHDRegex = /window\.canPlayFHD\s+?=\s+?(\w+)/;
    const canPlayFHDMatch = html.match(canPlayFHDRegex);
    const canPlayFHD = canPlayFHDMatch && canPlayFHDMatch[1] === "true";
    
    const hasQuery = /\?[^#]+/.test(playlistUrl);
    const separator = hasQuery ? "&" : "?";

    const m3u8Url =
      playlistUrl +
      separator +
      "expires=" +
      playlistParams.expires +
      "&token=" +
      playlistParams.token +
      (canPlayFHD ? "&h=1" : "");

    baseStreamUrl = extractBaseUrl(m3u8Url);

    showLoading(false);
    return {
      iframeUrl: vixsrcUrl,
      m3u8Url: m3u8Url,
    };
  } catch (error) {
    console.error('🎬 player.js - Errore in getDirectStream:', error);
    showLoading(false);
    showError("Errore durante l'estrazione dello stream", error.message);
    return null;
  }
}

function goBack() {
  if (player) {
    player.dispose();
    player = null;
  }
  
  const videoElement = document.getElementById("player-video");
  if (videoElement) {
    videoElement.remove();
  }

  currentItem = null;
  currentSeasons = [];

  document.getElementById("player").style.display = "none";
  
  const historyState = history.state;
  if (historyState && historyState.previousSection) {
    hideAllSections();
    switch(historyState.previousSection) {
      case 'home':
        document.getElementById("home").style.display = "block";
        break;
      case 'allMovies':
        document.getElementById("allMovies").style.display = "block";
        break;
      case 'allTV':
        document.getElementById("allTV").style.display = "block";
        break;
      case 'categories':
        document.getElementById("categories").style.display = "block";
        break;
      case 'results':
        document.getElementById("results").style.display = "block";
        break;
      case 'preferiti-section':
        document.getElementById("preferiti-section").style.display = "block";
        break;
      default:
        document.getElementById("home").style.display = "block";
    }
  } else {
    // Fallback: mostra la home
    document.getElementById("home").style.display = "block";
  }
  
  // Aggiorna l'history state per rimuovere il player
  history.replaceState({ section: historyState?.previousSection || 'home' }, '', 
                       historyState?.previousSection ? `#${historyState.previousSection}` : window.location.pathname);
  
  removeVideoJsXhrHook();

  setTimeout(async () => {
    await loadContinuaDaStorage();
    const carousel = document.getElementById("continua-carousel");
    if (carousel && carousel.children.length === 0) {
      document.getElementById("continua-visione").style.display = "none";
    }
  }, 300);
  window.scrollTo(0, 0);
}

function handleKeyboardShortcuts(event) {
  if (!player || !player.readyState()) {
    return;
  }

  if (
    event.target.tagName === "INPUT" ||
    event.target.tagName === "TEXTAREA" ||
    event.target.isContentEditable
  ) {
    return;
  }

  const key = event.key.toLowerCase();

  switch (key) {
    case " ":
      event.preventDefault();
      if (player.paused()) {
        player.play();
      } else {
        player.pause();
      }
      break;

    case "arrowright":
      event.preventDefault();
      const newTimeForward = Math.min(
        player.currentTime() + 5,
        player.duration()
      );
      player.currentTime(newTimeForward);
      showSeekFeedback("+5s");
      break;

    case "arrowleft":
      event.preventDefault();
      const newTimeBackward = Math.max(player.currentTime() - 5, 0);
      player.currentTime(newTimeBackward);
      showSeekFeedback("-5s");
      break;

    case "arrowup":
      event.preventDefault();
      const newVolumeUp = Math.min(player.volume() + 0.1, 1);
      player.volume(newVolumeUp);
      showVolumeFeedback(Math.round(newVolumeUp * 100));
      break;

    case "arrowdown":
      event.preventDefault();
      const newVolumeDown = Math.max(player.volume() - 0.1, 0);
      player.volume(newVolumeDown);
      showVolumeFeedback(Math.round(newVolumeDown * 100));
      break;

    case "f":
      event.preventDefault();
      if (player.isFullscreen()) {
        player.exitFullscreen();
      } else {
        player.requestFullscreen();
      }
      break;

    case "m":
      event.preventDefault();
      player.muted(!player.muted());
      break;
  }
}

function showSeekFeedback(text) {
  const feedback = document.createElement("div");
  feedback.className = "keyboard-feedback";
  feedback.textContent = text;
  feedback.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    color: #e50914;
    padding: 20px 40px;
    border-radius: 10px;
    font-size: 2rem;
    font-weight: bold;
    z-index: 100;
    pointer-events: none;
    animation: feedbackFade 0.8s ease;
  `;

  const videoContainer = document.querySelector(".video-container");
  videoContainer.appendChild(feedback);

  setTimeout(() => feedback.remove(), 800);
}

function showVolumeFeedback(volumePercent) {
  let volumeDisplay = document.getElementById("volume-feedback");

  if (!volumeDisplay) {
    volumeDisplay = document.createElement("div");
    volumeDisplay.id = "volume-feedback";
    volumeDisplay.style.cssText = `
      position: absolute;
      top: 50%;
      right: 40px;
      transform: translateY(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: #fff;
      padding: 15px 25px;
      border-radius: 8px;
      font-size: 1.5rem;
      font-weight: bold;
      z-index: 100;
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 10px;
    `;

    const videoContainer = document.querySelector(".video-container");
    videoContainer.appendChild(volumeDisplay);
  }

  volumeDisplay.innerHTML = `
    <span>🔊</span>
    <span>${volumePercent}%</span>
  `;

  volumeDisplay.style.opacity = "1";

  if (volumeDisplay.timeoutId) {
    clearTimeout(volumeDisplay.timeoutId);
  }

  volumeDisplay.timeoutId = setTimeout(() => {
    volumeDisplay.style.opacity = "0";
  }, 1000);
}

function showLoading(show, message = "Caricamento stream...") {
  const overlay = document.getElementById("loading-overlay");
  overlay.style.display = show ? "flex" : "none";
  overlay.querySelector(".loading-text").textContent = message;
}

function setupKeyboardShortcuts() {
  document.removeEventListener("keydown", handleKeyboardShortcuts);
  document.addEventListener("keydown", handleKeyboardShortcuts);
}

function handleKeyboardShortcuts(event) {
  if (!player || !player.readyState()) {
    return;
  }

  if (
    event.target.tagName === "INPUT" ||
    event.target.tagName === "TEXTAREA" ||
    event.target.isContentEditable
  ) {
    return;
  }

  const key = event.key.toLowerCase();

  switch (key) {
    case " ":
      event.preventDefault();
      if (player.paused()) {
        player.play();
      } else {
        player.pause();
      }
      break;

    case "arrowright":
      event.preventDefault();
      const newTimeForward = Math.min(
        player.currentTime() + 5,
        player.duration()
      );
      player.currentTime(newTimeForward);
      showSeekFeedback("+5s");
      break;

    case "arrowleft":
      event.preventDefault();
      const newTimeBackward = Math.max(player.currentTime() - 5, 0);
      player.currentTime(newTimeBackward);
      showSeekFeedback("-5s");
      break;

    case "arrowup":
      event.preventDefault();
      const newVolumeUp = Math.min(player.volume() + 0.1, 1);
      player.volume(newVolumeUp);
      showVolumeFeedback(Math.round(newVolumeUp * 100));
      break;

    case "arrowdown":
      event.preventDefault();
      const newVolumeDown = Math.max(player.volume() - 0.1, 0);
      player.volume(newVolumeDown);
      showVolumeFeedback(Math.round(newVolumeDown * 100));
      break;

    case "f":
      event.preventDefault();
      if (player.isFullscreen()) {
        player.exitFullscreen();
      } else {
        player.requestFullscreen();
      }
      break;

    case "m":
      event.preventDefault();
      player.muted(!player.muted());
      break;
  }
}

function showSeekFeedback(text) {
  const feedback = document.createElement("div");
  feedback.className = "keyboard-feedback";
  feedback.textContent = text;
  feedback.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    color: #e50914;
    padding: 20px 40px;
    border-radius: 10px;
    font-size: 2rem;
    font-weight: bold;
    z-index: 100;
    pointer-events: none;
    animation: feedbackFade 0.8s ease;
  `;

  const videoContainer = document.querySelector(".video-container");
  videoContainer.appendChild(feedback);

  setTimeout(() => feedback.remove(), 800);
}

function showVolumeFeedback(volumePercent) {
  let volumeDisplay = document.getElementById("volume-feedback");

  if (!volumeDisplay) {
    volumeDisplay = document.createElement("div");
    volumeDisplay.id = "volume-feedback";
    volumeDisplay.style.cssText = `
      position: absolute;
      top: 50%;
      right: 40px;
      transform: translateY(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: #fff;
      padding: 15px 25px;
      border-radius: 8px;
      font-size: 1.5rem;
      font-weight: bold;
      z-index: 100;
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 10px;
    `;

    const videoContainer = document.querySelector(".video-container");
    videoContainer.appendChild(volumeDisplay);
  }

  volumeDisplay.innerHTML = `
    <span>🔊</span>
    <span>${volumePercent}%</span>
  `;

  volumeDisplay.style.opacity = "1";

  if (volumeDisplay.timeoutId) {
    clearTimeout(volumeDisplay.timeoutId);
  }

  volumeDisplay.timeoutId = setTimeout(() => {
    volumeDisplay.style.opacity = "0";
  }, 1000);
}

function showError(message, details = "") {
  showLoading(false);
  const container = document.querySelector(".video-container");
  const errorDiv = document.createElement("div");
  errorDiv.className = "error-message";
  errorDiv.innerHTML = `<h3>⚠️ Errore</h3><p>${message}</p>${details ? `<p style="font-size:0.9em;opacity:0.7;margin-top:0.5em;">${details}</p>` : ""}`;
  container.appendChild(errorDiv);

  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
}