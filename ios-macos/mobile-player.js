// mobile-player.js - Player video con iframe embed (senza video.js)

let currentMobileItem = null;
let currentMobileSeasons = [];
let currentEmbedUrl = null;

async function openMobilePlayer(item) {
    currentMobileItem = item;
    showMobileSection('mobile-player');

    const title = item.title || item.name;
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv');

    document.getElementById('mobile-player-title').textContent = title;

    try {
        const details = await fetchTMDB(`${mediaType}/${item.id}`);

        const metaDiv = document.getElementById('mobile-player-meta');
        const overviewDiv = document.getElementById('mobile-player-overview');

        if (metaDiv) {
            let meta = [];
            if (details.release_date || details.first_air_date) {
                meta.push(new Date(details.release_date || details.first_air_date).getFullYear());
            }
            if (details.vote_average) {
                meta.push(`⭐ ${details.vote_average.toFixed(1)}/10`);
            }
            if (details.runtime) {
                const hours = Math.floor(details.runtime / 60);
                const minutes = details.runtime % 60;
                meta.push(`${hours}h ${minutes}m`);
            }
            metaDiv.textContent = meta.join(' • ');
        }

        if (overviewDiv) {
            overviewDiv.textContent = details.overview || "Nessuna descrizione disponibile.";
        }

        if (mediaType === 'tv') {
            document.getElementById('mobile-episode-selector').style.display = 'block';
            await loadTVSeasonsMobile(item.id);
        } else {
            setTimeout(() => playItemMobile(item.id, mediaType), 500);
        }
    } catch (error) {
        console.error('Errore caricamento dettagli:', error);
        showMobileError('Errore nel caricamento dei dettagli');
    }
}

function playItemMobile(id, type, season = null, episode = null) {
    showMobileLoading(true, "Caricamento player...");

    const mount = document.getElementById('player-mount');
    const overlay = document.getElementById('player-overlay');
    if (!mount) return;

    let oldIframe = mount.querySelector('iframe');
    if (oldIframe) oldIframe.remove();

    currentEmbedUrl = null;

    const embedUrl = getEmbedUrlMobile(id, type === 'movie', season, episode);
    currentEmbedUrl = embedUrl;

    showMobileLoading(false);

    if (overlay) overlay.style.display = 'flex';
}

function activatePlayer(url) {
    const mount = document.getElementById('player-mount');
    const overlay = document.getElementById('player-overlay');
    if (!mount || !url) return;

    let iframe = mount.querySelector('iframe');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'main-player-iframe';
        iframe.allowFullscreen = true;
        iframe.referrerPolicy = 'no-referrer';
        iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
        mount.appendChild(iframe);
    }
    iframe.src = url;
    if (overlay) overlay.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('player-overlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            if (currentEmbedUrl) activatePlayer(currentEmbedUrl);
        });
    }
});

function getEmbedUrlMobile(tmdbId, isMovie, season = null, episode = null) {
    if (isMovie) {
        return `https://${VIXSRC_URL}/movie/${tmdbId}`;
    } else {
        return `https://${VIXSRC_URL}/tv/${tmdbId}/${season || 1}/${episode || 1}`;
    }
}

// ============ GESTIONE STAGIONI ED EPISODI ============
async function loadTVSeasonsMobile(tmdbId) {
    try {
        const details = await fetchTMDB(`tv/${tmdbId}`);
        currentMobileSeasons = details.seasons || [];

        const seasonSelect = document.getElementById('mobile-season-select');
        const episodesList = document.getElementById('mobile-episodes-list');
        if (!seasonSelect || !episodesList) return;

        seasonSelect.innerHTML = '';

        const validSeasons = currentMobileSeasons.filter(season => season.season_number > 0);

        validSeasons.forEach(season => {
            const option = document.createElement('option');
            option.value = season.season_number;
            option.textContent = `Stagione ${season.season_number} (${season.episode_count} episodi)`;
            seasonSelect.appendChild(option);
        });

        if (validSeasons.length > 0) {
            await loadSeasonEpisodesMobile(tmdbId, validSeasons[0].season_number);
        } else {
            await loadSeasonEpisodesMobile(tmdbId, 1);
        }

        seasonSelect.onchange = function () {
            loadSeasonEpisodesMobile(tmdbId, parseInt(this.value));
        };
    } catch (error) {
        console.error('Errore caricamento stagioni:', error);
    }
}

async function loadSeasonEpisodesMobile(tmdbId, seasonNumber) {
    try {
        const episodesList = document.getElementById('mobile-episodes-list');
        if (!episodesList) return;

        episodesList.innerHTML = '<div class="mobile-episode-item">Caricamento episodi...</div>';

        const seasonData = await fetchTMDB(`tv/${tmdbId}/season/${seasonNumber}`);
        const episodes = seasonData.episodes || [];
        episodesList.innerHTML = '';

        const validEpisodes = episodes.filter(episode => episode.episode_number > 0);

        validEpisodes.forEach(episode => {
            const episodeItem = document.createElement('div');
            episodeItem.className = 'mobile-episode-item';
            episodeItem.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>Episodio ${episode.episode_number}</strong>
                        <div style="font-size: 12px; color: #aaa;">${episode.name || 'Senza titolo'}</div>
                        ${episode.overview ? `<div style="font-size: 11px; margin-top: 5px; opacity: 0.8;">${episode.overview.substring(0, 100)}...</div>` : ''}
                    </div>
                    <button class="mobile-control-btn" onclick="playTVEpisodeMobile(${tmdbId}, ${seasonNumber}, ${episode.episode_number})">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
            `;
            episodeItem.onclick = (e) => {
                if (!e.target.closest('button')) {
                    playTVEpisodeMobile(tmdbId, seasonNumber, episode.episode_number);
                }
            };
            episodesList.appendChild(episodeItem);
        });

        if (validEpisodes.length === 0) {
            episodesList.innerHTML = '<div class="mobile-episode-item">Nessun episodio disponibile</div>';
        }
    } catch (error) {
        console.error('Errore caricamento episodi:', error);
        showMobileError('Errore nel caricamento degli episodi');
    }
}

function playTVEpisodeMobile(tmdbId, seasonNumber, episodeNumber) {
    const episodeTitle = `Stagione ${seasonNumber}, Episodio ${episodeNumber}`;
    document.getElementById('mobile-player-title').textContent = episodeTitle;
    playItemMobile(tmdbId, 'tv', seasonNumber, episodeNumber);
}

// ============ PLAYER CLEANUP ============
function closePlayerMobile() {
    const mount = document.getElementById('player-mount');
    if (mount) {
        const iframe = mount.querySelector('iframe');
        if (iframe) {
            iframe.src = '';
            iframe.remove();
        }
    }

    const overlay = document.getElementById('player-overlay');
    if (overlay) overlay.style.display = 'flex';

    currentMobileItem = null;
    currentMobileSeasons = [];
    currentEmbedUrl = null;

    showHomeMobile();

    setTimeout(() => {
        updateMobileFavCount();
    }, 300);
}

function openInExternalPlayer() {
    if (currentEmbedUrl) {
        window.open(currentEmbedUrl, '_blank');
    } else {
        showMobileError('Nessun video caricato');
    }
}

window.openMobilePlayer = openMobilePlayer;
window.playItemMobile = playItemMobile;
window.playTVEpisodeMobile = playTVEpisodeMobile;
window.closePlayerMobile = closePlayerMobile;
window.openInExternalPlayer = openInExternalPlayer;
