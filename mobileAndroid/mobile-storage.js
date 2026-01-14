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

function toggleFavoriteMobile(id, type, title, button, event) {
    if (event) event.stopPropagation();
    
    const preferiti = getPreferiti();
    const itemId = `${type}-${id}`;
    
    if (preferiti.includes(itemId)) {
        removePreferito({id: id, media_type: type, title: title});
        if (button) {
            button.classList.remove('active');
            button.innerHTML = '<i class="far fa-star"></i>';
        }
    } else {
        addPreferito({id: id, media_type: type, title: title});
        if (button) {
            button.classList.add('active');
            button.innerHTML = '<i class="fas fa-star"></i>';
        }
    }

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

                }
            }
        }
        
        if (removed > 0) {
            // // console.log(`Puliti ${removed} elementi scaduti`);
        }
    } catch (e) {
        console.error("Errore pulizia storage:", e);
    }
}