// ============ INIZIALIZZAZIONE ============
document.addEventListener('DOMContentLoaded', function() {
    // // console.log('CineSearch Mobile inizializzato');
    initMobileUI();
    initMobileCors();
    loadMobileHomeData();
    cleanupExpiredStorage();
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
});

// ============ EVENT LISTENERS GLOBALI ============
document.addEventListener('keydown', function(e) {
    const focusedElement = document.activeElement;
    
    if (focusedElement && focusedElement.classList.contains('mobile-card')) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            focusedElement.click();
        }
    }
    
    if (e.key === 'Escape') {
        if (currentMobileSection === 'player') {
            closePlayerMobile();
        }
    }
});


window.showHomeMobile = showHomeMobile;
window.showAllMoviesMobile = showAllMoviesMobile;
window.showAllTVMobile = showAllTVMobile;
window.showCategoriesMobile = showCategoriesMobile;
window.showPreferitiMobile = showPreferitiMobile;
window.showCategoryContentMobile = showCategoryContentMobile;
window.openMobilePlayer = openMobilePlayer;
window.playItemMobile = playItemMobile;
window.toggleFavoriteMobile = toggleFavoriteMobile;
window.closePlayerMobile = closePlayerMobile;
window.openInExternalPlayer = openInExternalPlayer;
window.prevMoviePageMobile = prevMoviePageMobile;
window.nextMoviePageMobile = nextMoviePageMobile;
window.prevTVPageMobile = prevTVPageMobile;
window.nextTVPageMobile = nextTVPageMobile;
window.applyMovieFilterMobile = applyMovieFilterMobile;
window.applyTVFilterMobile = applyTVFilterMobile;
window.toggleControls = toggleControls;
window.refreshMobilePlayerControls = refreshMobilePlayerControls;
window.showMobileQualitySelector = showMobileQualitySelector;
window.showMobileAudioSelector = showMobileAudioSelector;
window.showMobileSubtitleSelector = showMobileSubtitleSelector;
window.changeMobileQuality = changeMobileQuality;
window.changeMobileAudio = changeMobileAudio;
window.changeMobileSubtitle = changeMobileSubtitle;
window.showContinuaMobile = showContinuaMobile;
window.loadContinuaMobile = loadContinuaMobile;
window.resumeWatching = resumeWatching;
window.removeContinuaItem = removeContinuaItem;
window.applyCategoryFilterMobile = applyCategoryFilterMobile;
window.resetCategoryFilterMobile = resetCategoryFilterMobile;
window.prevCategoryPageMobile = prevCategoryPageMobile;
window.nextCategoryPageMobile = nextCategoryPageMobile;