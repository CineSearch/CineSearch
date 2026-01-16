// mobile-cors.js - Gestione CORS proxy

const CORS_PROXIES = [
    { name: 'CodeTabs (Default)', url: 'https://api.codetabs.com/v1/proxy?quest=' },
    { name: 'corsproxy.io', url: 'https://corsproxy.io/?' },
    { name: 'AllOrigins', url: 'https://api.allorigins.win/raw?url=' },
    { name: 'ProxyCors', url: 'https://proxy.cors.sh/?' }
];

let currentCorsProxy = 'https://api.codetabs.com/v1/proxy?quest=';

function initMobileCors() {
    const corsSelect = document.getElementById('mobile-cors-select');
    
    if (!corsSelect) return;
    
    // Carica proxy salvati o usa CodeTabs come default
    const savedProxy = localStorage.getItem('mobile-cors-proxy') || 'https://api.codetabs.com/v1/proxy?quest=';
    currentCorsProxy = savedProxy;
    
    // Popola il dropdown con i proxy disponibili
    corsSelect.innerHTML = '';
    CORS_PROXIES.forEach(proxy => {
        const option = document.createElement('option');
        option.value = proxy.url;
        option.textContent = proxy.name;
        
        // Imposta selezionato quello salvato o CodeTabs di default
        if (proxy.url === savedProxy) {
            option.selected = true;
        }
        
        corsSelect.appendChild(option);
    });
    
    corsSelect.addEventListener('change', function() {
        currentCorsProxy = this.value;
        localStorage.setItem('mobile-cors-proxy', currentCorsProxy);
        console.log('CORS proxy mobile cambiato a:', currentCorsProxy);
    });
}

function applyCorsProxy(url) {
    // NON applicare il proxy se l'URL è già un URL del proxy CORS
    if (url.includes('corsproxy.io') || url.includes('cors-anywhere') || 
        url.includes('allorigins.win') || url.includes('api.codetabs.com') ||
        url.includes('proxy.cors.sh')) {
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

function getCurrentProxyName() {
    const proxy = CORS_PROXIES.find(p => p.url === currentCorsProxy);
    return proxy ? proxy.name : 'Custom';
}

function extractBaseUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.origin + parsed.pathname;
    } catch (e) {
        return url;
    }
}