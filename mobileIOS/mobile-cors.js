// mobile-cors.js - Gestione CORS proxy

let currentCorsProxy = 'https://corsproxy.io/?';

function initMobileCors() {
    const corsSelect = document.getElementById('mobile-cors-select');
    
    if (!corsSelect) return;
    
    // Carica proxy salvati o usa quelli predefiniti
    const savedProxy = localStorage.getItem('mobile-cors-proxy') || 'https://corsproxy.io/?';
    currentCorsProxy = savedProxy;
    
    corsSelect.value = savedProxy;
    
    corsSelect.addEventListener('change', function() {
        currentCorsProxy = this.value;
        localStorage.setItem('mobile-cors-proxy', currentCorsProxy);
        // console.log('CORS proxy mobile cambiato a:', currentCorsProxy);
    });
}

function applyCorsProxy(url) {
    // NON applicare il proxy se l'URL è già un URL del proxy CORS
    if (url.includes('corsproxy.io') || url.includes('cors-anywhere') || 
        url.includes('allorigins.win') || url.includes('api.codetabs.com')) {
        return url;
    }
    
    if (!currentCorsProxy || currentCorsProxy === '') {
        return url;
    }
    
    // Decodifica se necessario per evitare doppia codifica
    try {
        const decodedUrl = decodeURIComponent(url);
        // Se l'URL decodificato inizia già con il proxy, ritorna l'URL originale
        if (decodedUrl.startsWith(currentCorsProxy)) {
            return url;
        }
    } catch (e) {
        // Ignora errori di decodifica
    }
    
    return currentCorsProxy + encodeURIComponent(url);
}

function extractBaseUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.origin + parsed.pathname;
    } catch (e) {
        return url;
    }
}