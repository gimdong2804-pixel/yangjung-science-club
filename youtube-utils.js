// 유튜브 관련 유틸리티 및 렌더링 헬퍼

function extractYoutubeVideoId(url) {
    if (!url) return null;
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regExp);
    return (match && match[1]) ? match[1] : null;
}

function renderTextWithYoutubeLinks(text) {
    if (!text) return '';
    
    // URL 정규식 (http/https로 시작하는 문자열)
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    const youtubeCards = [];

    // URL을 찾아서 하이퍼링크로 전환
    const processedText = text.replace(urlRegex, (url) => {
        const cleanUrl = url.replace(/&amp;/g, '&');
        const videoId = extractYoutubeVideoId(cleanUrl);
        
        if (videoId) {
            if (!youtubeCards.some(c => c.videoId === videoId)) {
                youtubeCards.push({ url: cleanUrl, videoId: videoId });
            }
            return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="youtube-link-text" style="color: #ff4e4e; text-decoration: underline; font-weight: 500;"><i class="fa-brands fa-youtube" style="color: #ff0000; margin-right: 4px;"></i>${url}</a>`;
        } else {
            return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="custom-link-text" style="color: #4dadf7; text-decoration: underline;">${url}</a>`;
        }
    });

    // 유튜브 카드 HTML 생성
    let cardsHtml = '';
    if (youtubeCards.length > 0) {
        cardsHtml = '<div class="youtube-cards-container" style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">';
        youtubeCards.forEach(card => {
            const thumbUrl = `https://img.youtube.com/vi/${card.videoId}/hqdefault.jpg`;
            cardsHtml += `
                <div class="youtube-card" style="max-width: 360px; border-radius: 12px; overflow: hidden; background: rgba(0,0,0,0.25); border: 1px solid var(--glass-border, rgba(255,255,255,0.12)); transition: transform 0.2s, box-shadow 0.2s;">
                    <a href="${card.url}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: block;">
                        <div style="position: relative; width: 100%; aspect-ratio: 16/9; overflow: hidden; background: #000;">
                            <img src="${thumbUrl}" alt="유튜브 동영상 썸네일" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 46px; height: 46px; background: rgba(255, 0, 0, 0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.1rem; box-shadow: 0 4px 14px rgba(0,0,0,0.5);">
                                <i class="fa-solid fa-play" style="margin-left: 3px;"></i>
                            </div>
                        </div>
                        <div style="padding: 8px 12px; font-size: 0.82rem; color: var(--text-secondary, #a0aec0); display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.03);">
                            <span style="display: flex; align-items: center; gap: 5px;"><i class="fa-brands fa-youtube" style="color: #ff0000; font-size: 1rem;"></i> YouTube에서 재생</span>
                            <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.75rem; opacity: 0.8;"></i>
                        </div>
                    </a>
                </div>
            `;
        });
        cardsHtml += '</div>';
    }

    return processedText + cardsHtml;
}

window.extractYoutubeVideoId = extractYoutubeVideoId;
window.renderTextWithYoutubeLinks = renderTextWithYoutubeLinks;

// 유튜브 선택 모달 제어
const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/channel/UCKtLefVrKe2C7BwhbXb2lSA';
const YOUTUBE_STUDIO_URL = 'https://studio.youtube.com/channel/UCKtLefVrKe2C7BwhbXb2lSA';

function openYoutubeSelectModal() {
    const modal = document.getElementById('youtubeSelectModal');
    const overlay = document.getElementById('youtubeSelectOverlay');
    if (modal && overlay) {
        modal.classList.add('active');
        overlay.classList.add('active');
    }
}

function closeYoutubeSelectModal() {
    const modal = document.getElementById('youtubeSelectModal');
    const overlay = document.getElementById('youtubeSelectOverlay');
    if (modal && overlay) {
        modal.classList.remove('active');
        overlay.classList.remove('active');
    }
}

function initYoutubeModalEvents() {
    const closeBtn = document.getElementById('youtubeSelectCloseBtn');
    const overlay = document.getElementById('youtubeSelectOverlay');
    const channelBtn = document.getElementById('youtubeChannelBtn');
    const studioBtn = document.getElementById('youtubeStudioBtn');

    if (closeBtn) closeBtn.addEventListener('click', closeYoutubeSelectModal);
    if (overlay) overlay.addEventListener('click', closeYoutubeSelectModal);

    if (channelBtn) {
        channelBtn.addEventListener('click', () => {
            window.open(YOUTUBE_CHANNEL_URL, '_blank', 'noopener,noreferrer');
        });
    }

    if (studioBtn) {
        studioBtn.addEventListener('click', () => {
            window.open(YOUTUBE_STUDIO_URL, '_blank', 'noopener,noreferrer');
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initYoutubeModalEvents);
} else {
    initYoutubeModalEvents();
}

window.openYoutubeSelectModal = openYoutubeSelectModal;
window.closeYoutubeSelectModal = closeYoutubeSelectModal;
