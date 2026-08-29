// 커뮤니티 보조 화면: 사이드 메뉴와 이미지 크게 보기
// 사이드 메뉴 아이템 클릭 시 알림 및 드로어 닫기 (연결된 페이지 메뉴는 제외)
document.querySelectorAll('.drawer-menu a:not(#greetingLink):not(#goalLink):not(#suggestionLink):not(#roleManageMenuBtn):not(#aiSettingsMenuBtn):not(#updateRulesMenuBtn):not(#cloudAccountManageMenuBtn):not(#versionManageMenuBtn)').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const title = item.innerText.trim();
        alert(title + ' 페이지로 이동 기능은 아직 준비 중입니다.');
        if (typeof closeDrawer === 'function') closeDrawer();
    });
});

// 클라우드 계정 관리 메뉴 클릭 연동 (독립 페이지 전환)
const cloudAccountBtn = document.getElementById('cloudAccountManageMenuBtn');
if (cloudAccountBtn) {
    cloudAccountBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof closeDrawer === 'function') closeDrawer();
        const targetPage = document.getElementById('cloudAccountSettingsPage');
        const fromPage = window.currentPage || document.getElementById('mainPage');
        if (targetPage && typeof window.switchPage === 'function') {
            window.switchPage(fromPage, targetPage);
        }
    });
}

// --- 이미지 라이트박스 줌 & 패닝 기능 ---
const imageLightbox = document.getElementById('imageLightbox');
const imageLightboxImg = document.getElementById('imageLightboxImg');
const imageLightboxClose = document.getElementById('imageLightboxClose');

let currentZoom = 1;
let currentPanX = 0;
let currentPanY = 0;

let isLightboxDragging = false;
let lightboxStartX = 0;
let lightboxStartY = 0;
let initialPinchDistance = null;

function updateTransform(animate = false) {
    imageLightboxImg.style.transition = animate ? 'transform 0.1s ease-out' : 'none';
    imageLightboxImg.style.transform = `translate(${currentPanX}px, ${currentPanY}px) scale(${currentZoom})`;
}

let lightboxMeta = {};

window.openLightbox = function (url, meta) {
    if (!meta) meta = {};
    history.pushState({ modal: 'lightbox' }, '', '#lightbox');
    imageLightboxImg.src = url;
    imageLightbox.classList.add('active');
    currentZoom = 1; currentPanX = 0; currentPanY = 0;
    updateTransform(true);

    // 설명 보기 버튼 처리
    lightboxMeta = meta;
    const descBtn = document.getElementById('lightboxDescBtn');

    if ((meta.postId && meta.imageIndex !== undefined) || (meta.preUpload && meta.imageIndex !== undefined) || meta.description) {
        descBtn.style.display = '';
    } else {
        descBtn.style.display = 'none';
    }
};

async function loadImageDescription(meta) {
    try {
        let docRef;
        if (meta.commentId) {
            docRef = db.collection('posts').doc(meta.postId)
                .collection('comments').doc(meta.commentId);
        } else {
            docRef = db.collection('posts').doc(meta.postId);
        }
        const doc = await docRef.get();
        if (doc.exists) {
            const descriptions = doc.data().imageDescriptions || {};
            return descriptions[String(meta.imageIndex)] || '';
        }
        return '';
    } catch (e) {
        console.error('사진 설명 불러오기 실패', e);
        return '';
    }
}

async function saveImageDescription(meta, description) {
    try {
        let docRef;
        if (meta.commentId) {
            docRef = db.collection('posts').doc(meta.postId)
                .collection('comments').doc(meta.commentId);
        } else {
            docRef = db.collection('posts').doc(meta.postId);
        }
        await docRef.update({
            [`imageDescriptions.${meta.imageIndex}`]: description
        });
        return true;
    } catch (e) {
        console.error('사진 설명 저장 실패', e);
        return false;
    }
}

// 설명 모달 열기/닫기
function openDescModal() {
    document.getElementById('lightboxDescOverlay').classList.add('active');
    document.getElementById('lightboxDescModal').classList.add('active');
}

function closeDescModal() {
    document.getElementById('lightboxDescOverlay').classList.remove('active');
    document.getElementById('lightboxDescModal').classList.remove('active');
    // 편집 영역 숨기기
    const ea = document.getElementById('lightboxDescEditArea');
    ea.style.display = 'none';
    document.getElementById('lightboxDescText').style.display = '';
    document.getElementById('lightboxDescEditBtn').style.display =
        document.getElementById('lightboxDescEditBtn').dataset.canEdit === 'true' ? '' : 'none';
}

// 설명 보기 버튼 클릭
document.getElementById('lightboxDescBtn').addEventListener('click', async (e) => {
    e.stopPropagation();
    const descText = document.getElementById('lightboxDescText');
    const editBtn = document.getElementById('lightboxDescEditBtn');
    const editArea = document.getElementById('lightboxDescEditArea');

    editArea.style.display = 'none';
    descText.style.display = '';

    if (lightboxMeta.description) {
        descText.textContent = lightboxMeta.description;
        descText.className = 'lightbox-desc-text';
        editBtn.style.display = 'none';
        editBtn.dataset.canEdit = 'false';
        openDescModal();
    } else if (lightboxMeta.preUpload) {
        const attachedImages = window.commentAttachedImages || [];
        const desc = attachedImages[lightboxMeta.imageIndex]?.description || '';
        descText.textContent = desc || '설명이 없습니다.';
        descText.className = 'lightbox-desc-text' + (desc ? '' : ' empty');
        editBtn.style.display = '';
        editBtn.dataset.canEdit = 'true';
        openDescModal();
    } else if (lightboxMeta.postId) {
        const desc = await loadImageDescription(lightboxMeta);
        descText.textContent = desc || '설명이 없습니다.';
        descText.className = 'lightbox-desc-text' + (desc ? '' : ' empty');
        const canEdit = currentUser && (
            lightboxMeta.authorUid === currentUser.uid || isAdmin(currentUser.email)
        );
        editBtn.style.display = canEdit ? '' : 'none';
        editBtn.dataset.canEdit = canEdit ? 'true' : 'false';
        openDescModal();
    }
});

// 설명 모달 X 버튼
document.getElementById('lightboxDescCloseBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    closeDescModal();
});

// 오버레이 클릭
document.getElementById('lightboxDescOverlay').addEventListener('click', (e) => {
    e.stopPropagation();
    closeDescModal();
});

// 모달 본문 높이 전환 (FLIP)
function transitionModalBody(prepare) {
    const body = document.getElementById('lightboxDescModal');
    const oldH = body.offsetHeight;
    prepare();
    const newH = body.offsetHeight;
    body.style.overflow = 'hidden';
    const anim = body.animate([
        { height: oldH + 'px' },
        { height: newH + 'px' }
    ], { duration: 280, easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)' });

    anim.onfinish = () => {
        body.style.overflow = '';
        body.style.height = '';
    };
}

// 수정 버튼
document.getElementById('lightboxDescEditBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const editArea = document.getElementById('lightboxDescEditArea');
    const input = document.getElementById('lightboxDescInput');
    const currentText = document.getElementById('lightboxDescText').textContent;
    input.value = (currentText === '설명이 없습니다.' || currentText === '불러오는 중...') ? '' : currentText;

    transitionModalBody(() => {
        document.getElementById('lightboxDescText').style.display = 'none';
        document.getElementById('lightboxDescEditBtn').style.display = 'none';
        editArea.style.display = 'block';
    });
    setTimeout(() => input.focus(), 300);
});

// 편집→보기 전환
function switchToView() {
    const editArea = document.getElementById('lightboxDescEditArea');
    const editBtn = document.getElementById('lightboxDescEditBtn');
    transitionModalBody(() => {
        editArea.style.display = 'none';
        document.getElementById('lightboxDescText').style.display = '';
        if (editBtn.dataset.canEdit === 'true') {
            editBtn.style.display = '';
        }
    });
}

// 저장 버튼
document.getElementById('lightboxDescSave').addEventListener('click', async (e) => {
    e.stopPropagation();
    const desc = document.getElementById('lightboxDescInput').value.trim();
    const saveBtn = document.getElementById('lightboxDescSave');

    if (lightboxMeta.preUpload) {
        const attachedImages = window.commentAttachedImages || [];
        if (attachedImages[lightboxMeta.imageIndex]) {
            attachedImages[lightboxMeta.imageIndex].description = desc;
        }
        const descText = document.getElementById('lightboxDescText');
        descText.textContent = desc || '설명이 없습니다.';
        descText.className = 'lightbox-desc-text' + (desc ? '' : ' empty');
        switchToView();
        return;
    }

    saveBtn.textContent = '저장 중...';
    saveBtn.disabled = true;
    const success = await saveImageDescription(lightboxMeta, desc);
    if (success) {
        const descText = document.getElementById('lightboxDescText');
        descText.textContent = desc || '설명이 없습니다.';
        descText.className = 'lightbox-desc-text' + (desc ? '' : ' empty');
        switchToView();
    } else {
        alert('저장 실패');
    }
    saveBtn.textContent = '저장';
    saveBtn.disabled = false;
});

// 취소 버튼
document.getElementById('lightboxDescCancel').addEventListener('click', (e) => {
    e.stopPropagation();
    switchToView();
});

function closeLightbox(e) {
    const fromPopState = (e === true);
    imageLightbox.classList.remove('active');
    closeDescModal();
    setTimeout(() => {
        imageLightboxImg.src = '';
        lightboxMeta = {};
    }, 300);
    if (fromPopState !== true && history.state && history.state.modal === 'lightbox') {
        window._isProgrammaticBack = true;
        history.back();
    }
}

imageLightboxClose.addEventListener('click', closeLightbox);
imageLightbox.addEventListener('click', (e) => {
    if (e.target === imageLightbox) closeLightbox();
});

// 데스크탑 마우스 휠 확대/축소
imageLightbox.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
        currentZoom = Math.min(currentZoom + 0.15, 5);
    } else {
        currentZoom = Math.max(currentZoom - 0.15, 1);
        if (currentZoom === 1) { currentPanX = 0; currentPanY = 0; }
    }
    updateTransform(true);
}, { passive: false });

// 데스크탑 마우스 드래그 패닝
imageLightboxImg.addEventListener('mousedown', (e) => {
    if (currentZoom > 1) {
        isLightboxDragging = true;
        lightboxStartX = e.clientX - currentPanX;
        lightboxStartY = e.clientY - currentPanY;
        imageLightboxImg.style.cursor = 'grabbing';
        e.preventDefault();
    }
});
window.addEventListener('mousemove', (e) => {
    if (!isLightboxDragging) return;
    currentPanX = e.clientX - lightboxStartX;
    currentPanY = e.clientY - lightboxStartY;
    updateTransform(false);
});
window.addEventListener('mouseup', () => {
    isLightboxDragging = false;
    imageLightboxImg.style.cursor = 'pointer';
});

// 모바일 손가락(핀치) 확대/축소 및 패닝
imageLightbox.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
        initialPinchDistance = Math.hypot(
            e.touches[0].pageX - e.touches[1].pageX,
            e.touches[0].pageY - e.touches[1].pageY
        );
    } else if (e.touches.length === 1 && currentZoom > 1) {
        isLightboxDragging = true;
        lightboxStartX = e.touches[0].pageX - currentPanX;
        lightboxStartY = e.touches[0].pageY - currentPanY;
    }
});

imageLightbox.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 2 && initialPinchDistance !== null) {
        const currentDistance = Math.hypot(
            e.touches[0].pageX - e.touches[1].pageX,
            e.touches[0].pageY - e.touches[1].pageY
        );
        const ratio = currentDistance / initialPinchDistance;
        currentZoom = Math.min(Math.max(currentZoom * ratio, 1), 5);
        if (currentZoom === 1) { currentPanX = 0; currentPanY = 0; }
        initialPinchDistance = currentDistance;
        updateTransform(false);
    } else if (e.touches.length === 1 && isLightboxDragging) {
        currentPanX = e.touches[0].pageX - lightboxStartX;
        currentPanY = e.touches[0].pageY - lightboxStartY;
        updateTransform(false);
    }
}, { passive: false });

imageLightbox.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) initialPinchDistance = null;
    if (e.touches.length === 0) {
        isLightboxDragging = false;
        imageLightboxImg.style.transition = 'transform 0.2s ease';
    }
});


