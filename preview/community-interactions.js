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

    try {
        const postIds = Array.from(checkboxes).map(cb => cb.value);
        const docs = await Promise.all(postIds.map(pid => db.collection('posts').doc(pid).get()));
        
        // 하나라도 고정 안 된 글이 있으면 모두 '고정(true)', 전부 이미 고정되어 있으면 '고정 해제(false)'
        const hasUnpinned = docs.some(doc => doc.exists && !doc.data().pinned);
        const targetPinned = hasUnpinned;
        const actionText = targetPinned ? '상단 고정' : '고정 해제';

        if (!await window.customConfirm(`선택한 ${postIds.length}개의 게시물을 ${actionText}하시겠습니까?`, `게시물 ${actionText}`)) return;

        const updatePromises = postIds.map(pid => db.collection('posts').doc(pid).update({ pinned: targetPinned }));
        await Promise.all(updatePromises);

        cancelPostMultiDelete();
    } catch (e) {
        console.error("Multi pin post error", e);
        alert('게시물 고정 처리 중 오류가 발생했습니다: ' + e.message);
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
            if (typeof window.deletePostDocumentWithNotification === 'function') {
                await window.deletePostDocumentWithNotification(pid);
            } else {
                await db.collection('posts').doc(pid).delete();
            }
        }
        cancelPostMultiDelete();
    } catch (e) {
        console.error("Multi delete post error", e);
        alert('게시물 삭제 중 오류가 발생했습니다.');
    }
};

window.addEventListener('popstate', (e) => {
    // 열려있는 댓글 첨부 메뉴 닫기
    if (typeof window.closeCommentAttachMenu === 'function') {
        window.closeCommentAttachMenu();
    }

    if (window._isProgrammaticBack) {
        setTimeout(() => { window._isProgrammaticBack = false; }, 200);
        return;
    }

    // 커스텀 확인 모달 (삭제 확인 등)
    const customConfirmModal = document.getElementById('customConfirmModal');
    if (customConfirmModal && customConfirmModal.classList.contains('active')) {
        return;
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

    // 투표 첨부 유튜브 모달이 열려있는 경우
    const pollYoutubeModal = document.getElementById('pollYoutubeModal');
    if (pollYoutubeModal && pollYoutubeModal.classList.contains('active')) {
        if (typeof window.pollAttachments?.closeYoutubeManager === 'function') {
            window.pollAttachments.closeYoutubeManager(true);
        }
        return;
    }

    // 투표 작성 모달이 열려있는 경우
    const pollModal = document.getElementById('pollModal');
    if (document.body.classList.contains('poll-modal-open') || (pollModal && pollModal.classList.contains('active'))) {
        if (typeof window.closePollModal === 'function') {
            window.closePollModal(true);
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

// 개발 미리보기에서는 기존 사이트의 서비스 워커와 캐시를 유지합니다.

// 더블클릭/더블탭 좋아요와 단일 클릭 동작의 충돌을 처리합니다.
(() => {
    const DOUBLE_TAP_MS = 380;
    const DESKTOP_DOUBLE_CLICK_MS = 380;
    const MOUSE_CLICK_DELAY_MS = 380;
    const TOUCH_CLICK_DELAY_MS = 380;
    const MAX_TAP_DISTANCE = 54;
    const MAX_POINTER_MOVEMENT = 16;
    const pendingActions = new WeakMap();
    const inFlightLikes = new Set();
    let activeTouch = null;
    let previousTouch = null;
    let suppressedTouchClick = null;
    let suppressedTouchClickTimer = null;
    let suppressedMouseClick = false;
    let suppressedMouseClickTimer = null;
    let previousDesktopClick = null;

    function isDoubleTapLikeEnabled() {
        if (typeof window.isDoubleTapLikeEnabled === 'function') {
            return window.isDoubleTapLikeEnabled();
        }
        return true;
    }

    function scheduleSingleAction(target, action, delay = DOUBLE_TAP_MS) {
        if (!isDoubleTapLikeEnabled()) {
            if (!target || target.isConnected) action();
            return;
        }
        const oldAction = pendingActions.get(target);
        if (oldAction) clearTimeout(oldAction.timer);
        const pending = { timer: null, action };
        pending.timer = setTimeout(() => {
            if (pendingActions.get(target) !== pending) return;
            pendingActions.delete(target);
            if (target.isConnected) action();
        }, delay);
        pendingActions.set(target, pending);
    }

    function takePendingAction(target) {
        if (!target) return null;
        const pending = pendingActions.get(target);
        if (pending) clearTimeout(pending.timer);
        pendingActions.delete(target);
        return pending ? pending.action : null;
    }

    function cancelSingleAction(target) {
        return Boolean(takePendingAction(target));
    }

    function isImmediatePointer(event) {
        if (event && (event.pointerType === 'touch' || event.pointerType === 'pen')) return false;
        return !!(event && event.pointerType === 'mouse')
            || !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
    }

    window.schedulePostCardOpen = (card, openDetail, event) => {
        if (!isDoubleTapLikeEnabled()) {
            openDetail();
            return;
        }
        scheduleSingleAction(card, openDetail, isImmediatePointer(event) ? MOUSE_CLICK_DELAY_MS : TOUCH_CLICK_DELAY_MS);
    };
    window.scheduleCommentBackgroundAction = (comment, action, event) => {
        if (!isDoubleTapLikeEnabled()) {
            action();
            return;
        }
        scheduleSingleAction(comment, action, isImmediatePointer(event) ? MOUSE_CLICK_DELAY_MS : TOUCH_CLICK_DELAY_MS);
    };

    function findLikeTarget(eventTarget) {
        const element = eventTarget instanceof Element ? eventTarget : eventTarget && eventTarget.parentElement;
        if (!element) return null;
        if (element.closest('button, a, input, textarea, select, audio, video, iframe, [contenteditable="true"], [data-no-double-like], .comment-actions, .post-detail-action-buttons, .post-detail-meta, .post-select-cb, label')) return null;

        const comment = element.closest('.comment-flat-reply, .comment-item');
        if (comment) {
            if (comment.classList.contains('comment-deleted')) return null;
            if (!comment.querySelector('.c-like-btn')) return null;
            if (element.closest('.comment-text img, .flat-reply-body img')) return null;
            return comment;
        }

        const detailArea = element.closest('#detailPostArea');
        if (detailArea) {
            if (element.closest('.post-detail-header-top, .board-card-header')) return null;
            return detailArea;
        }

        return element.closest('.board-card');
    }

    function isCommentTarget(target) {
        return !!(target && target.matches('.comment-item, .comment-flat-reply'));
    }

    function isSameLikeTarget(first, second) {
        if (!first || !second) return false;
        if (first === second) return true;
        if (isCommentTarget(first) && isCommentTarget(second)) {
            return first.getAttribute('data-id') === second.getAttribute('data-id');
        }
        if (first.classList.contains('board-card') && second.classList.contains('board-card')) {
            return first.getAttribute('data-id') === second.getAttribute('data-id');
        }
        if (first.id === 'detailPostArea' && second.id === 'detailPostArea') {
            return true;
        }
        return false;
    }

    function isExplicitControl(target) {
        const element = target instanceof Element ? target : target && target.parentElement;
        return !!(element && element.closest('button, a, input, textarea, select, [contenteditable="true"]'));
    }

    function findLiveTarget(target) {
        if (!target) return null;
        if (isCommentTarget(target)) {
            const commentId = target.getAttribute('data-id');
            return Array.from(document.querySelectorAll('.comment-item[data-id], .comment-flat-reply[data-id]'))
                .find((item) => item.getAttribute('data-id') === commentId) || (target.isConnected ? target : null);
        }
        if (target.classList.contains('board-card')) {
            const postId = target.getAttribute('data-id');
            return Array.from(document.querySelectorAll('.board-card[data-id]'))
                .find((card) => card.getAttribute('data-id') === postId) || (target.isConnected ? target : null);
        }
        if (target.matches('#detailPostArea')) {
            return document.getElementById('detailPostArea') || (target.isConnected ? target : null);
        }
        return target.isConnected ? target : null;
    }

    function cancelLikeTargetAction(target) {
        return cancelSingleAction(target);
    }

    function showDoubleLikeHeart(target, point) {
        let x;
        let y;
        if (point && typeof point.x === 'number' && typeof point.y === 'number') {
            x = point.x;
            y = point.y;
        } else {
            const rect = target.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            x = rect.left + rect.width / 2;
            y = rect.top + rect.height / 2;
        }

        const margin = 32;
        const winWidth = window.innerWidth || document.documentElement.clientWidth || 360;
        const winHeight = window.innerHeight || document.documentElement.clientHeight || 640;
        x = Math.max(margin, Math.min(winWidth - margin, x));
        y = Math.max(margin, Math.min(winHeight - margin, y));

        const burst = document.createElement('span');
        burst.className = 'double-like-burst';
        burst.setAttribute('aria-hidden', 'true');
        burst.innerHTML = '<i class="fa-solid fa-heart"></i>';
        burst.style.left = `${x}px`;
        burst.style.top = `${y}px`;
        document.body.appendChild(burst);
        burst.addEventListener('animationend', () => burst.remove(), { once: true });
        setTimeout(() => burst.remove(), 950);
    }

    function animateTargetLikeButtons(target) {
        if (!target) return;
        const animateFn = typeof window.animateLikeButton === 'function' ? window.animateLikeButton : (button) => {
            if (!button) return;
            const heartIcon = button.querySelector('i');
            const likeCountEl = button.querySelector('.like-count') || button.querySelector('#detailLikeCnt');
            if (!heartIcon) return;
            const currentlyLiked = heartIcon.classList.contains('fa-solid');
            heartIcon.classList.remove('animate-heart', 'animate-heart-cancel');
            void heartIcon.offsetWidth;
            heartIcon.classList.remove('fa-regular');
            heartIcon.classList.add('fa-solid', 'animate-heart');
            heartIcon.style.color = '#ff6b6b';
            if (!currentlyLiked && likeCountEl) {
                const cur = parseInt(likeCountEl.textContent, 10) || 0;
                likeCountEl.textContent = cur + 1;
            }
            const onAnimEnd = () => {
                heartIcon.classList.remove('animate-heart', 'animate-heart-cancel');
                heartIcon.removeEventListener('animationend', onAnimEnd);
            };
            heartIcon.addEventListener('animationend', onAnimEnd, { once: true });
            setTimeout(() => {
                heartIcon.classList.remove('animate-heart', 'animate-heart-cancel');
            }, 400);
        };

        if (target.matches('.comment-item, .comment-flat-reply')) {
            const commentId = target.getAttribute('data-id');
            const items = commentId
                ? document.querySelectorAll(`.comment-item[data-id="${commentId}"], .comment-flat-reply[data-id="${commentId}"]`)
                : [target];
            items.forEach((item) => {
                const btn = item.querySelector('.like-count')?.closest('button') || item.querySelector('.c-like-btn');
                if (btn) animateFn(btn);
            });
            return;
        }

        const postId = target.classList.contains('board-card')
            ? target.getAttribute('data-id')
            : target.dataset.postId;
        if (!postId) {
            const fallbackBtn = target.querySelector('.like-count')?.closest('button') || target.querySelector('.board-action-btn, .c-like-btn');
            if (fallbackBtn) animateFn(fallbackBtn);
            return;
        }

        document.querySelectorAll(`.board-card[data-id="${postId}"]`).forEach((card) => {
            const btn = card.querySelector('.like-count')?.closest('button') || card.querySelector('.board-action-btn[onclick*="likePost"]');
            if (btn) animateFn(btn);
        });

        const detailArea = document.getElementById('detailPostArea');
        if (detailArea && detailArea.dataset.postId === postId) {
            const detailBtn = document.getElementById('detailLikeBtn');
            if (detailBtn) animateFn(detailBtn);
        }
    }

    function performDoubleLike(target, point) {
        if (!isDoubleTapLikeEnabled()) return;
        if (window.isPostMultiSelectMode || window.isMultiSelectMode) return;
        const isSignedIn = typeof currentUser !== 'undefined' && !!currentUser;
        if (!isSignedIn) {
            const postId = target.classList.contains('board-card')
                ? target.getAttribute('data-id')
                : document.getElementById('detailPostArea')?.dataset.postId;
            const comment = target.matches('.comment-item, .comment-flat-reply');
            if (comment) {
                const postIdForComment = document.getElementById('detailPostArea')?.dataset.postId;
                if (postIdForComment && typeof window.ensureCommentLiked === 'function') {
                    window.ensureCommentLiked(postIdForComment, target.getAttribute('data-id'));
                }
            } else if (postId && typeof window.ensurePostLiked === 'function') {
                window.ensurePostLiked(postId);
            }
            return;
        }

        showDoubleLikeHeart(target, point);
        animateTargetLikeButtons(target);
        let key;
        let likePromise;
        if (target.matches('.comment-item, .comment-flat-reply')) {
            const postId = document.getElementById('detailPostArea')?.dataset.postId;
            const commentId = target.getAttribute('data-id');
            if (!postId || !commentId || typeof window.ensureCommentLiked !== 'function') return;
            key = `comment:${postId}:${commentId}`;
            likePromise = () => window.ensureCommentLiked(postId, commentId);
        } else {
            const postId = target.classList.contains('board-card')
                ? target.getAttribute('data-id')
                : target.dataset.postId;
            if (!postId || typeof window.ensurePostLiked !== 'function') return;
            key = `post:${postId}`;
            likePromise = () => window.ensurePostLiked(postId);
        }

        if (inFlightLikes.has(key)) return;
        inFlightLikes.add(key);
        Promise.resolve(likePromise()).catch((error) => {
            console.error('더블클릭 좋아요 처리 실패:', error);
        }).finally(() => inFlightLikes.delete(key));
    }

    function handleDesktopDoubleClick(event, firstClick) {
        if (!isDoubleTapLikeEnabled()) return false;
        if (window.isPostMultiSelectMode || window.isMultiSelectMode) return false;
        if (isExplicitControl(event.target)) return false;
        const currentTarget = findLikeTarget(event.target);
        if (!firstClick || !currentTarget) return false;
        const isSame = isSameLikeTarget(firstClick.target, currentTarget);
        const matchesFirstClick = isSame
            && Date.now() - firstClick.time <= DESKTOP_DOUBLE_CLICK_MS;
        if (!matchesFirstClick) return false;
        const canceledPendingAction = cancelLikeTargetAction(firstClick.target);
        let target = currentTarget;

        if (isCommentTarget(firstClick.target)) {
            target = findLiveTarget(firstClick.target) || currentTarget;
            if (!canceledPendingAction && firstClick.hasReplies && typeof window.restoreCommentReplyState === 'function') {
                window.restoreCommentReplyState(firstClick.commentId, firstClick.wasExpanded);
                target = findLiveTarget(firstClick.target) || target;
            }
        } else if (firstClick.target.classList.contains('board-card')) {
            const postId = firstClick.target.getAttribute('data-id');
            const detailArea = document.getElementById('detailPostArea');
            if (!canceledPendingAction && detailArea && detailArea.dataset.postId === postId && !firstClick.detailWasOpen && typeof window.closeSideDetail === 'function') {
                window.closeSideDetail();
            }
            target = findLiveTarget(firstClick.target) || currentTarget;
        } else {
            target = findLiveTarget(firstClick.target) || currentTarget;
        }

        if (!target) return false;
        cancelLikeTargetAction(target);
        performDoubleLike(target, { x: event.clientX, y: event.clientY });
        return true;
    }

    document.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'mouse' || !event.isPrimary) return;
        if (window.isPostMultiSelectMode || window.isMultiSelectMode) return;
        if (!isDoubleTapLikeEnabled()) {
            previousDesktopClick = null;
            return;
        }

        const firstClick = previousDesktopClick;
        const currentTarget = findLikeTarget(event.target);
        const isDoubleClick = firstClick && currentTarget
            && isSameLikeTarget(firstClick.target, currentTarget)
            && Date.now() - firstClick.time <= DESKTOP_DOUBLE_CLICK_MS;
        if (!isDoubleClick || !handleDesktopDoubleClick(event, firstClick)) return;

        previousDesktopClick = null;
        suppressedMouseClick = true;
        if (suppressedMouseClickTimer) clearTimeout(suppressedMouseClickTimer);
        suppressedMouseClickTimer = setTimeout(() => {
            suppressedMouseClick = false;
            suppressedMouseClickTimer = null;
        }, 250);
        event.stopPropagation();
    }, true);

    document.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
        if (!event.isPrimary || window.isPostMultiSelectMode || window.isMultiSelectMode) return;
        if (!isDoubleTapLikeEnabled()) {
            previousTouch = null;
            return;
        }
        const currentTarget = findLikeTarget(event.target);
        const isSame = isSameLikeTarget(previousTouch?.target, currentTarget);
        const isSecondTap = previousTouch
            && Date.now() - previousTouch.time <= DOUBLE_TAP_MS
            && isSame
            && !isExplicitControl(event.target);
        const target = isSecondTap ? previousTouch.target : currentTarget;
        if (!target) previousTouch = null;
        activeTouch = target ? {
            target,
            x: event.clientX,
            y: event.clientY,
            moved: false,
            firstTouch: isSecondTap ? previousTouch : null,
            pendingAction: isSecondTap ? takePendingAction(previousTouch.target) : null
        } : null;
        if (isSecondTap) event.stopPropagation();
    }, true);

    document.addEventListener('pointermove', (event) => {
        if (!activeTouch || (event.pointerType !== 'touch' && event.pointerType !== 'pen')) return;
        if (Math.hypot(event.clientX - activeTouch.x, event.clientY - activeTouch.y) > MAX_POINTER_MOVEMENT) {
            activeTouch.moved = true;
        }
    }, true);

    document.addEventListener('pointerup', (event) => {
        if (!activeTouch || (event.pointerType !== 'touch' && event.pointerType !== 'pen')) return;
        if (!isDoubleTapLikeEnabled()) {
            activeTouch = null;
            previousTouch = null;
            return;
        }
        const tap = activeTouch;
        activeTouch = null;
        if (tap.moved || Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > MAX_POINTER_MOVEMENT) {
            previousTouch = null;
            return;
        }

        const now = Date.now();
        const isDoubleTap = tap.firstTouch && previousTouch === tap.firstTouch
            && now - tap.firstTouch.time <= DOUBLE_TAP_MS
            && isSameLikeTarget(tap.firstTouch.target, tap.target);
        if (!isDoubleTap) {
            previousTouch = {
                target: tap.target,
                time: now,
                x: event.clientX,
                y: event.clientY,
                commentId: isCommentTarget(tap.target) ? tap.target.getAttribute('data-id') : null,
                hasReplies: isCommentTarget(tap.target) && Number(tap.target.getAttribute('data-reply-count') || 0) > 0,
                wasExpanded: isCommentTarget(tap.target) && window.expandedCommentIds.has(tap.target.getAttribute('data-id')),
                detailWasOpen: !!(document.getElementById('sideDetailContainer')
                    && !document.getElementById('sideDetailContainer').classList.contains('detail-hidden'))
            };
            return;
        }

        previousTouch = null;
        const canceledPendingAction = cancelLikeTargetAction(tap.target) || Boolean(tap.pendingAction);
        let likeTarget = findLiveTarget(tap.target);
        if (!canceledPendingAction && isCommentTarget(tap.target) && tap.firstTouch.hasReplies
            && typeof window.restoreCommentReplyState === 'function') {
            window.restoreCommentReplyState(tap.firstTouch.commentId, tap.firstTouch.wasExpanded);
            likeTarget = findLiveTarget(tap.target);
        } else if (!canceledPendingAction && tap.target.classList.contains('board-card')) {
            const detailArea = document.getElementById('detailPostArea');
            if (detailArea && detailArea.dataset.postId === tap.target.getAttribute('data-id')
                && !tap.firstTouch.detailWasOpen && typeof window.closeSideDetail === 'function') {
                window.closeSideDetail();
            }
        }
        if (likeTarget) {
            const point = {
                x: typeof event.clientX === 'number' && event.clientX !== 0 ? event.clientX : tap.x,
                y: typeof event.clientY === 'number' && event.clientY !== 0 ? event.clientY : tap.y
            };
            performDoubleLike(likeTarget, point);
        }
        suppressedTouchClick = true;
        if (suppressedTouchClickTimer) clearTimeout(suppressedTouchClickTimer);
        suppressedTouchClickTimer = setTimeout(() => {
            suppressedTouchClick = null;
            suppressedTouchClickTimer = null;
        }, 700);
    }, true);

    document.addEventListener('pointercancel', () => {
        activeTouch = null;
        previousTouch = null;
    }, true);

    document.addEventListener('click', (event) => {
        if (suppressedMouseClick && (!event.pointerType || event.pointerType === 'mouse')) {
            event.preventDefault();
            event.stopPropagation();
            suppressedMouseClick = false;
            if (suppressedMouseClickTimer) clearTimeout(suppressedMouseClickTimer);
            suppressedMouseClickTimer = null;
            previousDesktopClick = null;
            return;
        }

        if (suppressedTouchClick) {
            event.preventDefault();
            event.stopPropagation();
            suppressedTouchClick = null;
            if (suppressedTouchClickTimer) clearTimeout(suppressedTouchClickTimer);
            suppressedTouchClickTimer = null;
            return;
        }

        if (event.detail === 1) {
            if (!isImmediatePointer(event) || !isDoubleTapLikeEnabled()) {
                previousDesktopClick = null;
                return;
            }
            const firstTarget = findLikeTarget(event.target);
            const commentId = isCommentTarget(firstTarget) ? firstTarget.getAttribute('data-id') : null;
            previousDesktopClick = firstTarget ? {
                target: firstTarget,
                time: Date.now(),
                x: event.clientX,
                y: event.clientY,
                commentId,
                detailWasOpen: !!(document.getElementById('sideDetailContainer')
                    && !document.getElementById('sideDetailContainer').classList.contains('detail-hidden')),
                hasReplies: isCommentTarget(firstTarget) && Number(firstTarget.getAttribute('data-reply-count') || 0) > 0,
                wasExpanded: !!(commentId && window.expandedCommentIds && window.expandedCommentIds.has(commentId))
            } : null;
            return;
        }

        if (event.detail !== 2 || window.isPostMultiSelectMode || window.isMultiSelectMode) return;
        const firstClick = previousDesktopClick;
        previousDesktopClick = null;
        if (!handleDesktopDoubleClick(event, firstClick)) return;
        event.preventDefault();
        event.stopPropagation();
    }, true);

    document.addEventListener('click', (event) => {
        const image = event.target instanceof Element ? event.target.closest('[data-double-like-image="true"]') : null;
        if (!image || event.detail > 1 || typeof window.openLightbox !== 'function') return;
        event.preventDefault();
        event.stopPropagation();
        const details = {
            postId: image.dataset.lightboxPostId || '',
            commentId: null,
            authorUid: image.dataset.lightboxAuthorUid || '',
            imageIndex: Number(image.dataset.lightboxImageIndex) || 0
        };
        const openImg = () => {
            if (image.isConnected) window.openLightbox(image.dataset.lightboxUrl, details);
        };
        if (!isDoubleTapLikeEnabled()) {
            openImg();
            return;
        }
        scheduleSingleAction(image.closest('#detailPostArea') || image, openImg);
    });
})();
