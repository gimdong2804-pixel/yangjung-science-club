// 게시글 다중 선택, 휴대폰 뒤로가기, PWA 기능
// Post Multi Select Variables
window.isPostMultiSelectMode = false;
let postPressTimer = null;
let isPostPressing = false;
let postStartY = 0;
let postStartX = 0;
window.ignoreNextPostClick = false;

window.handlePostPointerDown = function (e, postId) {
    if (e.button === 2) return;
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input') || e.target.closest('.board-author')) return;

    isPostPressing = true;
    postStartY = e.clientY || (e.touches && e.touches[0].clientY);
    postStartX = e.clientX || (e.touches && e.touches[0].clientX);

    postPressTimer = setTimeout(() => {
        if (isPostPressing && !window.isPostMultiSelectMode) {
            if (navigator.vibrate) navigator.vibrate(50);
            window.ignoreNextPostClick = true;
            enterPostMultiSelectMode(postId);
        }
    }, 600);
};

window.handlePostPointerMove = function (e) {
    if (!isPostPressing) return;
    const currentY = e.clientY || (e.touches && e.touches[0].clientY);
    const currentX = e.clientX || (e.touches && e.touches[0].clientX);
    if (Math.abs(currentY - postStartY) > 10 || Math.abs(currentX - postStartX) > 10) {
        clearTimeout(postPressTimer);
        isPostPressing = false;
    }
};

window.handlePostPointerUp = function () {
    clearTimeout(postPressTimer);
    isPostPressing = false;
};

window.enterPostMultiSelectMode = function (targetId) {
    window.isPostMultiSelectMode = true;
    history.pushState({ modal: 'postMultiSelect' }, '', '');
    document.body.classList.add('post-multi-select-active');
    const cb = document.querySelector(`.post-select-cb[value="${targetId}"]`);
    if (cb) {
        cb.checked = true;
    }
    updatePostMultiDeleteUI();
};

window.updatePostMultiDeleteUI = function () {
    const checkboxes = document.querySelectorAll('.post-select-cb:checked');
    const bar = document.getElementById('postMultiDeleteBar');
    const cntSpan = document.getElementById('postMultiDeleteCount');
    const pinBtn = document.getElementById('postMultiPinBtn');
    if (pinBtn) pinBtn.style.display = (currentUser && isAdmin(currentUser.email)) ? 'block' : 'none';
    if (checkboxes.length > 0) {
        cntSpan.textContent = `${checkboxes.length}개 선택됨`;
        bar.style.bottom = '100px';
    } else {
        bar.style.bottom = '-250px';
    }
};

window.executePostMultiPin = async function () {
    if (!currentUser || !isAdmin(currentUser.email)) return;
    const checkboxes = document.querySelectorAll('.post-select-cb:checked');
    if (checkboxes.length === 0) return;
    if (!await window.customConfirm(`선택한 ${checkboxes.length}개의 게시물 고정 상태를 전환하시겠습니까?`, '게시물 고정 설정')) return;

    try {
        for (let cb of checkboxes) {
            const pid = cb.value;
            const doc = await db.collection('posts').doc(pid).get();
            if (doc.exists) {
                const currentPinned = doc.data().pinned || false;
                await db.collection('posts').doc(pid).update({ pinned: !currentPinned });
            }
        }
        cancelPostMultiDelete();
    } catch (e) {
        console.error("Multi pin post error", e);
        alert('게시물 고정 중 오류가 발생했습니다.');
    }
};

window.cancelPostMultiDelete = function (fromPopState = false) {
    window.isPostMultiSelectMode = false;
    document.body.classList.remove('post-multi-select-active');
    document.querySelectorAll('.post-select-cb').forEach(cb => cb.checked = false);
    updatePostMultiDeleteUI();
    if (!fromPopState && history.state && history.state.modal === 'postMultiSelect') {
        window._isProgrammaticBack = true;
        history.back();
    }
};

window.executePostMultiDelete = async function () {
    const checkboxes = document.querySelectorAll('.post-select-cb:checked');
    if (checkboxes.length === 0) return;
    if (!await window.customConfirm(`선택한 ${checkboxes.length}개의 게시물을 삭제하시겠습니까?`, '게시물 삭제')) return;

    try {
        for (let cb of checkboxes) {
            const pid = cb.value;
            await db.collection('posts').doc(pid).delete();
        }
        cancelPostMultiDelete();
    } catch (e) {
        console.error("Multi delete post error", e);
        alert('게시물 삭제 중 오류가 발생했습니다.');
    }
};

window.addEventListener('popstate', (e) => {
    if (window._isProgrammaticBack) {
        setTimeout(() => { window._isProgrammaticBack = false; }, 200);
        return;
    }

    // 관리자 비밀번호 모달
    const adminModal = document.getElementById('adminModal');
    if (adminModal && adminModal.classList.contains('active')) {
        if (typeof window.closeAdminModal === 'function') window.closeAdminModal(true);
        return;
    }
    // 관리자 비활성화 모달
    const adminDeactivateModal = document.getElementById('adminDeactivateModal');
    if (adminDeactivateModal && adminDeactivateModal.classList.contains('active')) {
        if (typeof window.closeAdminDeactivateModal === 'function') window.closeAdminDeactivateModal(true);
        return;
    }
    // 커스텀 확인 모달 (삭제 확인 등) - 자체 popstate 핸들러가 있으므로 여기서는 fallback
    const customConfirmModal = document.getElementById('customConfirmModal');
    if (customConfirmModal && customConfirmModal.classList.contains('active')) {
        return; // customConfirm 자체 popstate 핸들러가 처리
    }

    // 댓글/답글 다중선택 모드
    if (window.isMultiSelectMode) {
        window.cancelMultiDelete(true);
        return;
    }
    // 게시물 다중선택 모드
    if (window.isPostMultiSelectMode) {
        window.cancelPostMultiDelete(true);
        return;
    }

    const lightbox = document.getElementById('imageLightbox');
    if (lightbox && lightbox.classList.contains('active')) {
        closeLightbox(true);
        return;
    }
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal && settingsModal.classList.contains('active')) {
        if (window.updateSubState === 'details' && typeof window.hideInPageUpdateDetails === 'function') {
            window.hideInPageUpdateDetails(true);
        } else if (window.updateSubState === 'pill' && typeof window.resetUpdateCheckState === 'function') {
            window.resetUpdateCheckState(true);
        } else if (window.isUsefulSubPageOpen && typeof window.closeUsefulSubPage === 'function') {
            window.closeUsefulSubPage(true);
        } else if (typeof window.closeSettingsModal === 'function') {
            window.closeSettingsModal(true);
        }
        return;
    }
    const aiChatbotWindow = document.getElementById('aiChatbotWindow');
    if (aiChatbotWindow && aiChatbotWindow.classList.contains('active')) {
        if (typeof window.closeAiChatbotModal === 'function') {
            window.closeAiChatbotModal(true);
        }
        return;
    }
    const sideDrawer = document.getElementById('sideDrawer');
    if (sideDrawer && sideDrawer.classList.contains('active')) {
        closeDrawer(true);
        return;
    }
    const writePostPage = document.getElementById('writePostPage');
    if (writePostPage && writePostPage.classList.contains('active')) {
        closeWritePage(true);
        return;
    }
    const sideDetailContainer = document.getElementById('sideDetailContainer');
    if (sideDetailContainer && !sideDetailContainer.classList.contains('detail-hidden')) {
        closeSideDetail(true);
        return;
    }

    // [추가] 탭 네비게이션 복구 처리 (시스템 뒤로 가기 시 페이지 전환)
    if (e.state && e.state.page) {
        const targetPage = document.getElementById(e.state.page);
        if (targetPage) switchPage(currentPage, targetPage, true);
    } else {
        if (currentPage !== mainPage) switchPage(currentPage, mainPage, true);
    }
});
// 초기 상태 히스토리 설정
window.addEventListener('DOMContentLoaded', () => {
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    if (!history.state || !history.state.page) {
        history.replaceState({ page: 'mainPage' }, '', '#/mainPage');
    }
});

// PWA 설정
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => {
            console.error('ServiceWorker registration failed: ', err);
        });
    });
}

