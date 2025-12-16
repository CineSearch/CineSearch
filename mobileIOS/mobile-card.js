function createMobileCard(item) {
    const isMovie = item.media_type === 'movie' || item.title;
    const mediaType = isMovie ? 'movie' : 'tv';
    const card = document.createElement('div');
    card.className = 'mobile-card';
    
    const imageUrl = item.poster_path 
        ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
        : 'https://via.placeholder.com/342x513?text=No+Image';
    
    const title = isMovie ? item.title : item.name;
    const year = isMovie 
        ? (item.release_date ? new Date(item.release_date).getFullYear() : 'N/A')
        : (item.first_air_date ? new Date(item.first_air_date).getFullYear() : 'N/A');
    
    const isFav = checkIfFavorite(item.id, mediaType);
    
    // Formatta il titolo per mobile
    const displayTitle = title.length > 25 ? title.substring(0, 22) + '...' : title;
    
    // Classi diverse per stelle: 'star' per vuoto, 'star-active' per pieno
    const starClass = isFav ? 'fas fa-star star-active' : 'far fa-star star-empty';
    
    card.innerHTML = `
        <img src="${imageUrl}" alt="${title}" class="mobile-card-image" 
             onerror="this.src='https://via.placeholder.com/342x513?text=Image+Error'">
        <div class="mobile-card-content">
            <div class="mobile-card-title" title="${title}">${displayTitle}</div>
            <div class="mobile-card-meta">${year} • ${isMovie ? '🎬 Film' : '📺 Serie'}</div>
            <div class="mobile-card-buttons">
            <button class="mobile-card-btn play" onclick="openMobilePlayer(${JSON.stringify(item).replace(/"/g, '&quot;')}, event)">
                <i class="fas fa-play"></i>
            </button>
                <button class="mobile-card-btn fav" 
                        onclick="toggleFavoriteMobile(${item.id}, '${mediaType}', '${title.replace(/'/g, "\\'")}', event)"
                        data-fav="${isFav}">
                    <i class="${starClass}"></i>
                </button>
            </div>
        </div>
    `;
    
    // Apri player al click sulla card
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.mobile-card-btn')) {
            openMobilePlayer(item);
        }
    });
    
    return card;
}


function populateMobileCarousel(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    items.slice(0, 10).forEach(item => {
        const card = createMobileCard(item);
        container.appendChild(card);
    });
}

function createCategoryCard(category) {
    const categoryCard = document.createElement('div');
    categoryCard.className = 'mobile-category-card';
    categoryCard.innerHTML = `
        <div class="mobile-category-icon">${category.icon}</div>
        <div class="mobile-category-name">${category.name}</div>
    `;
    
    categoryCard.addEventListener('click', () => {
        showCategoryContentMobile(category);
    });
    
    return categoryCard;
}