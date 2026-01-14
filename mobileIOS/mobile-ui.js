// mobile-ui.js - Gestione interfaccia mobile

// ============ VARIABILI UI ============
let currentMobileSection = 'home';
let requestHookInstalled = false;

// ============ INIZIALIZZAZIONE UI ============
function initMobileUI() {
    // // console.log('Inizializzazione UI mobile...');
    
    initMobileHamburgerMenu();
    initMobileSearch();
    initMobileBottomNav();
    updateMobileFavCount();
}

function initMobileHamburgerMenu() {
    const menuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('mobile-sidebar');
    const closeBtn = document.getElementById('close-sidebar');
    
    if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', () => {
            sidebar.classList.add('active');
        });
    }
    
    if (closeBtn && sidebar) {
        closeBtn.addEventListener('click', () => {
            sidebar.classList.remove('active');
        });
    }
    
    // Chiudi sidebar cliccando fuori
    document.addEventListener('click', (e) => {
        if (sidebar && menuBtn && !sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
            sidebar.classList.remove('active');
        }
    });
}

function initMobileSearch() {
    const searchInput = document.getElementById('mobile-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleMobileSearch, 500));
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performMobileSearch(e.target.value);
            }
        });
    }
}

function initMobileBottomNav() {
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.bottom-nav-item').forEach(i => {
                i.classList.remove('active');
            });
            this.classList.add('active');
        });
    });
}

// ============ GESTIONE SEZIONI ============
function showMobileSection(sectionId) {
    // Nascondi tutte le sezioni
    document.querySelectorAll('.mobile-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Mostra la sezione richiesta
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');
        currentMobileSection = sectionId.replace('mobile-', '');
    }
    
    // Nascondi la sidebar
    const sidebar = document.getElementById('mobile-sidebar');
    if (sidebar) sidebar.classList.remove('active');
    
    // Aggiorna bottom nav
    updateBottomNav(sectionId.replace('mobile-', ''));
    
}
function showContinuaMobile() {
    showMobileSection('mobile-continua');
    loadContinuaMobile();
}
function updateBottomNav(activeItem) {
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const navItem = document.querySelector(`.bottom-nav-item[onclick*="${activeItem}"]`);
    if (navItem) navItem.classList.add('active');
}

// ============ NAVIGAZIONE ============
function showHomeMobile() {
    showMobileSection('mobile-home');
}

function showAllMoviesMobile() {
    showMobileSection('mobile-allMovies');
    loadMoviesMobile(1);
}

function showAllTVMobile() {
    showMobileSection('mobile-allTV');
    loadTVMobile(1);
}

function showCategoriesMobile() {
    showMobileSection('mobile-categories');
    loadCategoriesMobile();
}

function showPreferitiMobile() {
    showMobileSection('mobile-preferiti');
    loadPreferitiMobile();
}

function showCategoryContentMobile(category) {
    mobileCategoryId = category.id;
    mobileCategoryName = category.name;
    
    showMobileSection('mobile-category-results');
    
    const title = document.getElementById('mobile-category-title');
    if (title) title.textContent = category.name;
    
    loadCategoryMovies(category.id);
}

// ============ LOADING & ERROR ============
function showMobileLoading(show, message = 'Caricamento...') {
    const loadingDiv = document.getElementById('mobile-loading');
    if (!loadingDiv) {
        const loading = document.createElement('div');
        loading.id = 'mobile-loading';
        loading.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.9);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            color: white;
        `;
        loading.innerHTML = `
            <div class="mobile-spinner" style="
                width: 50px;
                height: 50px;
                border: 5px solid #f3f3f3;
                border-top: 5px solid #e50914;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 20px;
            "></div>
            <div class="mobile-loading-text" style="font-size: 16px;">${message}</div>
        `;
        document.body.appendChild(loading);
    } else {
        loadingDiv.style.display = show ? 'flex' : 'none';
        const textEl = loadingDiv.querySelector('.mobile-loading-text');
        if (textEl) textEl.textContent = message;
    }
}

function showMobileError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(229, 9, 20, 0.9);
        color: white;
        padding: 20px 30px;
        border-radius: 10px;
        text-align: center;
        z-index: 10000;
        max-width: 80%;
    `;
    errorDiv.innerHTML = `
        <h3 style="margin: 0 0 10px 0;">⚠️ Errore</h3>
        <p style="margin: 0;">${message}</p>
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// ============ UTILITY UI ============
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}
function toggleControls() {
    const controls = document.getElementById('mobile-additional-controls');
    const toggleBtn = document.getElementById('mobile-toggle-controls');
    
    if (controls) {
        if (controls.classList.contains('show')) {
            controls.classList.remove('show');
            setTimeout(() => {
                controls.style.display = 'none';
            }, 300);
            if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-cog"></i>';
        } else {
            controls.style.display = 'flex';
            setTimeout(() => {
                controls.classList.add('show');
            }, 10);
            if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-times"></i>';
            
            // Aggiorna i selettori
            updateQualitySelector();
            updateAudioSelector();
            updateSubtitleSelector();
        }
    }
}

window.showContinuaMobile = showContinuaMobile;
window.toggleControls = toggleControls;
window.refreshMobilePlayerControls = refreshMobilePlayerControls;
window.showMobileQualitySelector = showMobileQualitySelector;
window.showMobileAudioSelector = showMobileAudioSelector;
window.showMobileSubtitleSelector = showMobileSubtitleSelector;
window.changeMobileQuality = changeMobileQuality;
window.changeMobileAudio = changeMobileAudio;
window.changeMobileSubtitle = changeMobileSubtitle;