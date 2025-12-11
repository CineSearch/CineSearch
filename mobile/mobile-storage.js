// mobile-storage.js - Gestione localStorage

// ============ PREFERITI ============
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
        updateMobileFavCount();
    }
}

function removePreferito(item) {
    const preferiti = getPreferiti();
    const id = `${item.media_type || (item.title ? "movie" : "tv")}-${item.id}`;
    const updated = preferiti.filter((p) => p !== id);
    localStorage.setItem("preferiti", JSON.stringify(updated));
    updateMobileFavCount();
}

function updateMobileFavCount() {
    const preferiti = getPreferiti();
    const countElement = document.getElementById('mobile-preferiti-count');
    const badgeElement = document.getElementById('mobile-fav-count');
    
    if (countElement) countElement.textContent = preferiti.length;
    if (badgeElement) badgeElement.textContent = preferiti.length;
}

function checkIfFavorite(id, type) {
    const preferiti = getPreferiti();
    const itemId = `${type}-${id}`;
    return preferiti.includes(itemId);
}

function toggleFavoriteMobile(id, type, title, event) {
    if (event) event.stopPropagation();
    
    const preferiti = getPreferiti();
    const itemId = `${type}-${id}`;
    
    if (preferiti.includes(itemId)) {
        // Rimuovi dai preferiti
        removePreferito({id: id, media_type: type});
        if (event && event.target) {
            event.target.innerHTML = '<i class="fas fa-star"></i>';
            event.target.classList.remove('active');
        }
    } else {
        // Aggiungi ai preferiti
        addPreferito({id: id, media_type: type, title: title});
        if (event && event.target) {
            event.target.innerHTML = '<i class="fas fa-star"></i>';
            event.target.classList.add('active');
        }
    }
    
    // Se siamo nella sezione preferiti, ricarica
    if (currentMobileSection === 'preferiti') {
        loadPreferitiMobile();
    }
}

// ============ STORAGE UTILITY ============
function getFromStorage(key) {
    try {
        const data = JSON.parse(localStorage.getItem(key));
        if (data && data.expires && data.expires > Date.now()) {
            return data.value;
        }
        localStorage.removeItem(key);
        return null;
    } catch (e) {
        return localStorage.getItem(key);
    }
}

function saveToStorage(key, value, days = 7) {
    try {
        const expires = Date.now() + days * 24 * 60 * 60 * 1000;
        const data = { value, expires };
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error("Errore salvataggio storage:", e);
    }
}

// ============ PULIZIA LOCALSTORAGE ============
function cleanupExpiredStorage() {
    try {
        const now = new Date().getTime();
        let removed = 0;
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("videoTime_")) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data.expires && data.expires < now) {
                        localStorage.removeItem(key);
                        removed++;
                        i--;
                    }
                } catch (e) {
                    // Ignora errori di parsing
                }
            }
        }
        
        if (removed > 0) {
            // console.log(`Puliti ${removed} elementi scaduti`);
        }
    } catch (e) {
        console.error("Errore pulizia storage:", e);
    }
}