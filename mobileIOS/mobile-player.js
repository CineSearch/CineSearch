function cleanupMobilePlayer() {
    console.log("🧹 PULIZIA COMPLETA PLAYER MOBILE");
    
    // Rimuovi tutti gli event listener
    cleanupFunctions.forEach(fn => fn());
    cleanupFunctions = [];
    
    // Distruggi player Video.js
    if (mobilePlayer) {
        try {
            mobilePlayer.dispose();
            mobilePlayer = null;
        } catch (e) {
            console.error("Errore durante dispose player:", e);
        }
    }
    
    // Pulisci elemento video completamente
    const videoContainer = document.querySelector('.mobile-video-container');
    if (videoContainer) {
        videoContainer.innerHTML = '';
        
        // Crea nuovo elemento video
        const videoElement = document.createElement('video');
        videoElement.id = 'mobile-player-video';
        videoElement.className = 'video-js vjs-theme-cinesearch';
        videoElement.setAttribute('controls', '');
        videoElement.setAttribute('preload', 'auto');
        videoElement.setAttribute('playsinline', '');
        videoElement.setAttribute('crossorigin', 'anonymous');
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        
        videoContainer.appendChild(videoElement);
    }
    
    // Resetta tutte le variabili globali
    currentStreamData = null;
    availableAudioTracks = [];
    availableSubtitles = [];
    availableQualities = [];
    playerInitialized = false;
    
    // Rimuovi hook XHR
    removeVideoJsXhrHook();
}
