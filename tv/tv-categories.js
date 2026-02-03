// Sistema categorie ottimizzato per TV
class TVCategories {
    constructor() {
        this.categories = [];
        this.currentCategory = null;
        this.currentPage = 1;
        this.totalPages = 1;
        this.filters = { minYear: null, maxYear: null };
        this.showingFilters = false;
    }

    async loadCategories() {
        try {
            const genres = await tvApi.getGenres();
            this.categories = genres.genres || [];
            this.displayCategories();
            
        } catch (error) {
            console.error('Error loading categories:', error);
            showToast('Errore nel caricamento delle categorie', 'error');
        }
    }

    displayCategories() {
        const grid = document.getElementById('tv-categories-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        const categoryIcons = {
            28: '💥',   // Azione
            12: '🗺️',   // Avventura
            16: '🐭',   // Animazione
            35: '😂',   // Commedia
            80: '🔫',   // Crime
            99: '🎥',   // Documentario
            18: '🎭',   // Dramma
            10751: '👨‍👩‍👧‍👦', // Famiglia
            14: '🧙‍♂️',  // Fantasy
            36: '🏛️',   // Storico
            27: '👻',   // Horror
            10402: '🎵', // Musical
            9648: '🔍',  // Mistero
            10749: '❤️', // Romantico
            878: '🚀',   // Fantascienza
            10770: '📺', // TV Movie
            53: '🔪',    // Thriller
            10752: '⚔️', // Guerra
            37: '🤠'     // Western
        };
        
        this.categories.forEach((category, index) => {
            const card = document.createElement('div');
            card.className = 'tv-category-card';
            card.setAttribute('data-focus', `tv-category-${index}`);
            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'button');
            card.setAttribute('aria-label', `Categoria ${category.name}`);
            
            card.innerHTML = `
                <div class="tv-category-icon">${categoryIcons[category.id] || '🎬'}</div>
                <div class="tv-category-name">${category.name}</div>
            `;
            
            card.addEventListener('click', () => {
                this.openCategory(category);
            });
            
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.openCategory(category);
                }
            });
            
            if (window.tvNavigation) {
                window.tvNavigation.addDynamicFocusElement(card, `tv-category-${index}`);
            }
            
            grid.appendChild(card);
        });
    }

    async openCategory(category) {
        this.currentCategory = category;
        this.currentPage = 1;
        this.showingFilters = false;
        
        // Naviga alla sezione risultati categoria
        this.showCategoryResults();
        
        // Carica contenuti
        await this.loadCategoryContent();
    }

    showCategoryResults() {
        // Crea o mostra la sezione risultati categoria
        let resultsSection = document.getElementById('tv-category-results');
        
        if (!resultsSection) {
            resultsSection = document.createElement('section');
            resultsSection.id = 'tv-category-results';
            resultsSection.className = 'tv-section';
            
            resultsSection.innerHTML = `
                <div class="tv-grid-header">
                    <button class="tv-back-btn" onclick="tvCategories.backToCategories()" tabindex="0"
                            data-focus="tv-category-back-btn">
                        <i class="fas fa-arrow-left"></i>
                        Torna alle Categorie
                    </button>
                    <h2 class="tv-grid-title" id="tv-category-results-title">
                        <i class="fas fa-tags"></i>
                        Categoria
                    </h2>
                    
                    <!-- Pulsante per mostrare/nascondere filtri anno -->
                    <button class="tv-filter-toggle-btn" id="tv-category-filter-toggle" 
                            data-focus="tv-category-filter-toggle" tabindex="0"
                            onclick="tvCategories.toggleYearFilter()">
                        <i class="fas fa-filter"></i>
                        <span id="tv-category-filter-text">Mostra Filtri Anno</span>
                    </button>
                    
                    <!-- Filtri anno (nascosti per default) -->
                    <div class="tv-filters" id="tv-category-filters">
                        <div class="tv-year-filter">
                            <label for="tv-category-year-min">Anno da:</label>
                            <input type="number" id="tv-category-year-min" min="1888" max="2030" 
                                   placeholder="1888" tabindex="0" data-focus="tv-category-year-min">
                            
                            <label for="tv-category-year-max">a:</label>
                            <input type="number" id="tv-category-year-max" min="1888" max="2030" 
                                   placeholder="2025" tabindex="0" data-focus="tv-category-year-max">
                            
                            <button class="tv-filter-btn" onclick="tvCategories.applyYearFilter()" tabindex="0"
                                    data-focus="tv-category-apply-filter">
                                Applica
                            </button>
                            <button class="tv-filter-btn reset" onclick="tvCategories.clearYearFilter()" tabindex="0"
                                    data-focus="tv-category-reset-filter">
                                Reset
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="tv-pagination-info" id="tv-category-pagination-info">
                    Caricamento...
                </div>
                
                <div class="tv-vertical-grid" id="tv-category-grid"></div>
                
                <div class="tv-pagination-controls">
                    <button class="tv-page-btn prev" onclick="tvCategories.prevPage()" tabindex="0" disabled
                            data-focus="tv-category-prev-page">
                        <i class="fas fa-chevron-left"></i> Precedente
                    </button>
                    <span class="tv-page-info" id="tv-category-page-info">Pagina 1</span>
                    <button class="tv-page-btn next" onclick="tvCategories.nextPage()" tabindex="0"
                            data-focus="tv-category-next-page">
                        Successiva <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            `;
            
            document.querySelector('main').appendChild(resultsSection);
            
            // Inizializza filtri nascosti
            const filters = document.getElementById('tv-category-filters');
            if (filters) {
                filters.classList.remove('active');
            }
        }
        
        // Aggiorna titolo
        const titleElement = document.getElementById('tv-category-results-title');
        if (titleElement && this.currentCategory) {
            const categoryIcons = {
                28: '💥', 12: '🗺️', 16: '🐭', 35: '😂', 80: '🔫',
                99: '🎥', 18: '🎭', 10751: '👨‍👩‍👧‍👦', 14: '🧙‍♂️', 36: '🏛️',
                27: '👻', 10402: '🎵', 9648: '🔍', 10749: '❤️', 878: '🚀',
                10770: '📺', 53: '🔪', 10752: '⚔️', 37: '🤠'
            };
            
            const icon = categoryIcons[this.currentCategory.id] || '🎬';
            titleElement.innerHTML = `<i class="fas fa-tags"></i> ${icon} ${this.currentCategory.name}`;
        }
        
        // Nascondi altre sezioni
        document.querySelectorAll('.tv-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Mostra questa sezione
        resultsSection.classList.add('active');
        
        // Aggiorna stato
        TV_STATE.currentSection = 'category-results';
        
        // Focus sul pulsante indietro
        if (window.tvNavigation) {
            setTimeout(() => {
                window.tvNavigation.setFocus('tv-category-back-btn');
            }, 100);
        }
    }

    async loadCategoryContent(page = 1) {
        if (!this.currentCategory) return;
        
        showLoading(true, `Caricamento ${this.currentCategory.name}...`);
        
        try {
            // Costruisci filtri
            const filters = {
                with_genres: this.currentCategory.id,
                sort_by: 'popularity.desc',
                page: page
            };
            
            // Applica filtri anno se presenti
            if (this.filters.minYear) {
                filters['primary_release_date.gte'] = `${this.filters.minYear}-01-01`;
            }
            
            if (this.filters.maxYear) {
                filters['primary_release_date.lte'] = `${this.filters.maxYear}-12-31`;
            }
            
            // Carica dati
            const data = await tvApi.getAllMovies(page, filters);
            
            this.currentPage = page;
            this.totalPages = Math.min(data.total_pages || 1, 500);
            
            // Aggiorna UI
            this.updateCategoryGrid(data.results || []);
            this.updateCategoryPagination(data.total_results || 0);
            
            showLoading(false);
            
        } catch (error) {
            console.error('Error loading category content:', error);
            showToast(`Errore nel caricamento di ${this.currentCategory.name}`, 'error');
            showLoading(false);
        }
    }

    updateCategoryGrid(movies) {
        const grid = document.getElementById('tv-category-grid');
        const paginationInfo = document.getElementById('tv-category-pagination-info');
        
        if (!grid) return;
        
        grid.innerHTML = '';
        
        if (movies.length === 0) {
            grid.innerHTML = `
                <div class="tv-empty-state" style="grid-column: 1 / -1;">
                    <i class="fas fa-film"></i>
                    <h3>Nessun film trovato</h3>
                    <p>Prova con altri filtri</p>
                </div>
            `;
            return;
        }
        
        let availableCount = 0;
        
        movies.forEach((movie, index) => {
            movie.media_type = 'movie';
            const card = createTVGridCard(movie, index);
            const focusId = `tv-category-movie-${index}`;
            
            card.setAttribute('data-focus', focusId);
            if (window.tvNavigation) {
                window.tvNavigation.addDynamicFocusElement(card, focusId);
            }
            
            grid.appendChild(card);
            availableCount++;
        });
        
        if (paginationInfo) {
            paginationInfo.textContent = `${availableCount} film disponibili`;
        }
    }

    updateCategoryPagination(totalResults) {
        const pageInfo = document.getElementById('tv-category-page-info');
        const prevBtn = document.querySelector('#tv-category-results .tv-page-btn.prev');
        const nextBtn = document.querySelector('#tv-category-results .tv-page-btn.next');
        const paginationInfo = document.getElementById('tv-category-pagination-info');
        
        if (pageInfo) {
            pageInfo.textContent = `Pagina ${this.currentPage} di ${this.totalPages}`;
        }
        
        if (prevBtn) {
            prevBtn.disabled = this.currentPage <= 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= this.totalPages;
        }
        
        if (paginationInfo) {
            const displayed = Math.min(totalResults, this.currentPage * TV_CONFIG.ITEMS_PER_PAGE);
            paginationInfo.textContent = `Mostrati ${displayed} di ${totalResults} film`;
        }
    }

    toggleYearFilter() {
        const filters = document.getElementById('tv-category-filters');
        const toggleBtn = document.getElementById('tv-category-filter-toggle');
        const textElement = document.getElementById('tv-category-filter-text');
        
        if (filters && toggleBtn && textElement) {
            if (filters.classList.contains('active')) {
                // Nascondi filtri
                filters.classList.remove('active');
                toggleBtn.classList.remove('active');
                textElement.textContent = 'Mostra Filtri Anno';
                this.showingFilters = false;
                
                // Focus sul pulsante toggle
                if (window.tvNavigation) {
                    window.tvNavigation.setFocus('tv-category-filter-toggle');
                }
            } else {
                // Mostra filtri
                filters.classList.add('active');
                toggleBtn.classList.add('active');
                textElement.textContent = 'Nascondi Filtri';
                this.showingFilters = true;
                
                // Focus sul primo input
                setTimeout(() => {
                    const firstInput = document.getElementById('tv-category-year-min');
                    if (firstInput && window.tvNavigation) {
                        window.tvNavigation.setFocus('tv-category-year-min');
                    }
                }, 100);
            }
        }
    }

    async applyYearFilter() {
        const minYearInput = document.getElementById('tv-category-year-min');
        const maxYearInput = document.getElementById('tv-category-year-max');
        
        const minYear = minYearInput?.value;
        const maxYear = maxYearInput?.value;
        
        // Validazione
        if (minYear && (parseInt(minYear) < 1888 || parseInt(minYear) > new Date().getFullYear() + 5)) {
            showToast(`Anno minimo non valido (1888-${new Date().getFullYear() + 5})`, 'warning');
            return;
        }
        
        if (maxYear && (parseInt(maxYear) < 1888 || parseInt(maxYear) > new Date().getFullYear() + 5)) {
            showToast(`Anno massimo non valido (1888-${new Date().getFullYear() + 5})`, 'warning');
            return;
        }
        
        if (minYear && maxYear && parseInt(minYear) > parseInt(maxYear)) {
            showToast('L\'anno "da" non può essere maggiore dell\'anno "a"', 'warning');
            return;
        }
        
        // Salva filtri
        this.filters = {
            minYear: minYear || null,
            maxYear: maxYear || null
        };
        
        // Ricarica contenuti
        await this.loadCategoryContent(1);
        
        // Chiudi i filtri dopo l'applicazione
        this.toggleYearFilter();
    }

    clearYearFilter() {
        const minYearInput = document.getElementById('tv-category-year-min');
        const maxYearInput = document.getElementById('tv-category-year-max');
        
        if (minYearInput) minYearInput.value = '';
        if (maxYearInput) maxYearInput.value = '';
        
        this.filters = { minYear: null, maxYear: null };
        this.loadCategoryContent(1);
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.loadCategoryContent(this.currentPage + 1);
        }
    }

    prevPage() {
        if (this.currentPage > 1) {
            this.loadCategoryContent(this.currentPage - 1);
        }
    }

    backToCategories() {
        // Nascondi risultati
        const resultsSection = document.getElementById('tv-category-results');
        if (resultsSection) {
            resultsSection.classList.remove('active');
            resultsSection.remove(); // Rimuovi dall'DOM per evitare duplicati
        }
        
        // Mostra categorie
        const categoriesSection = document.getElementById('tv-categories');
        if (categoriesSection) {
            categoriesSection.classList.add('active');
            TV_STATE.currentSection = 'categories';
        }
        
        // Reset filtri
        this.filters = { minYear: null, maxYear: null };
        this.showingFilters = false;
        
        // Focus sulla prima categoria
        if (window.tvNavigation) {
            setTimeout(() => {
                window.tvNavigation.setFocus('tv-category-0');
            }, 100);
        }
    }
}

// Istanza globale
const tvCategories = new TVCategories();

// Funzioni globali
function loadTVCategories() {
    tvCategories.loadCategories();
}

// Esponi al global scope
window.tvCategories = tvCategories;
window.loadTVCategories = loadTVCategories;