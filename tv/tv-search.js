// Sistema di ricerca ottimizzato per TV
class TVSearch {
    constructor() {
        this.currentQuery = '';
        this.currentResults = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.isSearching = false;
    }

    async performSearch(query, page = 1) {
        if (this.isSearching) return;
        
        this.isSearching = true;
        this.currentQuery = query;
        this.currentPage = page;
        
        showLoading(true, `Ricerca: "${query}"`);
        
        try {
            // Naviga alla sezione risultati
            if (window.tvNavigation) {
                window.tvNavigation.navigateToSection('search-results');
            }
            
            // Aggiorna titolo
            const titleElement = document.getElementById('tv-search-title');
            if (titleElement) {
                titleElement.innerHTML = `<i class="fas fa-search"></i> Risultati per: "${query}"`;
            }
            
            // Esegui ricerca
            const searchData = await tvApi.search(query, page);
            
            this.currentResults = searchData.results || [];
            this.totalPages = Math.min(searchData.total_pages || 1, 500);
            
            // Mostra risultati
            await this.displayResults(this.currentResults);
            
            // Aggiorna paginazione
            this.updatePagination();
            
            showLoading(false);
            
        } catch (error) {
            console.error('Search error:', error);
            showToast('Errore nella ricerca', 'error');
            showLoading(false);
        } finally {
            this.isSearching = false;
        }
    }

    async displayResults(results) {
    const grid = document.getElementById('tv-search-grid');
    const status = document.getElementById('tv-search-status');
    const empty = document.getElementById('tv-search-empty');
    
    if (!grid || !status || !empty) return;
    
    grid.innerHTML = '';
    empty.style.display = 'none';
    
    // Filtra risultati solo per film e serie TV
    const filteredResults = results.filter(item => 
        item.media_type !== 'person' && 
        item.poster_path &&
        (item.media_type === 'movie' || item.media_type === 'tv')
    );
    
    if (filteredResults.length === 0) {
        status.innerHTML = 'Nessun risultato trovato';
        empty.style.display = 'block';
        grid.style.display = 'none';
        return;
    }
    
    status.innerHTML = `
        <div class="tv-loading-small"></div>
        <span>Verifica disponibilità (0/${filteredResults.length})</span>
    `;
    
    let availableCount = 0;
    
    // Usa batch processing per velocizzare
    const batchSize = 5;
    for (let i = 0; i < filteredResults.length; i += batchSize) {
        const batch = filteredResults.slice(i, i + batchSize);
        
        // Aggiorna status
        status.innerHTML = `
            <div class="tv-loading-small"></div>
            <span>Verifica ${Math.min(i + batchSize, filteredResults.length)}/${filteredResults.length}</span>
        `;
        
        // Controlla disponibilità in parallelo
        const availabilityPromises = batch.map(item => 
            item.media_type === 'movie' 
                ? tvApi.checkAvailability(item.id, true)
                : tvApi.checkSeriesAvailability(item.id)
        );
        
        const availabilityResults = await Promise.all(availabilityPromises);
        
        // Aggiungi elementi disponibili
        for (let j = 0; j < batch.length; j++) {
            if (availabilityResults[j]) {
                const item = batch[j];
                const card = createTVGridCard(item, availableCount);
                const focusId = `tv-search-result-${availableCount}`;
                
                card.setAttribute('data-focus', focusId);
                if (window.tvNavigation) {
                    window.tvNavigation.addDynamicFocusElement(card, focusId);
                }
                
                grid.appendChild(card);
                availableCount++;
            }
        }
        
        // Pausa tra batch per non sovraccaricare
        if (i + batchSize < filteredResults.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    
    // Aggiorna status finale
    if (availableCount === 0) {
        status.innerHTML = 'Nessun contenuto disponibile trovato';
        empty.style.display = 'block';
        grid.style.display = 'none';
    } else {
        status.innerHTML = `✓ Trovati ${availableCount} contenuti disponibili su ${filteredResults.length} risultati`;
        grid.style.display = 'grid';
        
        // Focus sul primo risultato
        if (window.tvNavigation && availableCount > 0) {
            setTimeout(() => {
                window.tvNavigation.setFocus('tv-search-result-0');
            }, 100);
        }
    }
}

    updatePagination() {
        const paginationControls = document.querySelector('#tv-search-results .tv-pagination-controls');
        if (!paginationControls) return;
        
        paginationControls.innerHTML = '';
        
        if (this.totalPages > 1) {
            paginationControls.innerHTML = `
                <button class="tv-page-btn prev" onclick="tvSearch.prevPage()" tabindex="0" 
                        ${this.currentPage <= 1 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i> Precedente
                </button>
                <span class="tv-page-info">Pagina ${this.currentPage} di ${this.totalPages}</span>
                <button class="tv-page-btn next" onclick="tvSearch.nextPage()" tabindex="0"
                        ${this.currentPage >= this.totalPages ? 'disabled' : ''}>
                    Successiva <i class="fas fa-chevron-right"></i>
                </button>
            `;
        }
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.performSearch(this.currentQuery, this.currentPage + 1);
        }
    }

    prevPage() {
        if (this.currentPage > 1) {
            this.performSearch(this.currentQuery, this.currentPage - 1);
        }
    }

    clearSearch() {
        const searchInput = document.getElementById('tv-search');
        if (searchInput) {
            searchInput.value = '';
        }
        
        this.currentQuery = '';
        this.currentResults = [];
        this.currentPage = 1;
        
        // Torna alla home
        showHome();
    }
}

// Istanza globale
const tvSearch = new TVSearch();

// Funzione globale per ricerca
function performTVSearch() {
    const searchInput = document.getElementById('tv-search');
    if (!searchInput) return;
    
    const query = searchInput.value.trim();
    
    if (query.length < 2) {
        showToast('Inserisci almeno 2 caratteri', 'warning');
        return;
    }
    
    tvSearch.performSearch(query);
}

// Esponi al global scope
window.tvSearch = tvSearch;
window.performTVSearch = performTVSearch;