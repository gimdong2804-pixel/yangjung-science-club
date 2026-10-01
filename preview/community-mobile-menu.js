// A single mobile menu reuses each card's existing, permission-checked action buttons.
(function () {
    const menuId = 'communityMobileMoreMenu';
    let menu;
    let activeTrigger = null;
    let closeTimer = null;
    let dismissedCommentBackground = null;
    let dismissedCommentBackgroundTimer = null;

    window.communityMobileMoreButton = function () {
        return `<button type="button" class="community-more-trigger" aria-label="더보기" aria-haspopup="menu" aria-controls="${menuId}" aria-expanded="false" title="더보기"><span aria-hidden="true">⋯</span></button>`;
    };

    function getActionContainer(trigger) {
        const comment = trigger.closest('.comment-item, .comment-flat-reply');
        if (comment) return comment.querySelector('.comment-header .mobile-hide, .flat-reply-header .mobile-hide');
        const postCard = trigger.closest('.board-card');
        if (postCard) return postCard.querySelector('.board-card-actions');
        const detail = trigger.closest('#detailPostArea');
        return detail?.querySelector('.post-detail-action-buttons') || null;
    }

    function ensureMenu() {
        if (menu) return menu;
        menu = document.createElement('div');
        menu.id = menuId;
        menu.className = 'community-mobile-menu';
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', '관리 메뉴');
        menu.hidden = true;
        document.body.appendChild(menu);
        return menu;
    }

    function closeMenu(returnFocus = false) {
        if (!activeTrigger) return;
        const trigger = activeTrigger;
        activeTrigger = null;
        trigger.setAttribute('aria-expanded', 'false');
        menu.classList.remove('is-open');
        clearTimeout(closeTimer);
        const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 190;
        closeTimer = setTimeout(() => {
            if (activeTrigger) return;
            menu.hidden = true;
            menu.replaceChildren();
            closeTimer = null;
        }, duration);
        if (returnFocus && trigger.isConnected) trigger.focus({ preventScroll: true });
    }

    function clearDismissedCommentBackground() {
        dismissedCommentBackground = null;
        if (dismissedCommentBackgroundTimer) clearTimeout(dismissedCommentBackgroundTimer);
        dismissedCommentBackgroundTimer = null;
    }

    function getCommentBackgroundItem(target) {
        const element = target instanceof Element ? target : target?.parentElement;
        if (!element || element.closest('button, a, input, textarea, select, audio, video, iframe, [contenteditable="true"], [role="button"], [onclick]')) return null;
        return element.closest('.comment-item, .comment-flat-reply');
    }

    window.consumeCommunityMobileMenuDismissalClick = function (comment) {
        if (!comment || dismissedCommentBackground !== comment) return false;
        clearDismissedCommentBackground();
        return true;
    };

    function positionMenu(trigger) {
        const rect = trigger.getBoundingClientRect();
        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        const viewport = window.visualViewport;
        const leftEdge = viewport ? viewport.offsetLeft : 0;
        const topEdge = viewport ? viewport.offsetTop : 0;
        const rightEdge = leftEdge + (viewport ? viewport.width : window.innerWidth);
        let bottomEdge = topEdge + (viewport ? viewport.height : window.innerHeight);
        const composer = trigger.closest('.side-detail-container')?.querySelector('.comment-input-area');
        if (composer) bottomEdge = Math.min(bottomEdge, composer.getBoundingClientRect().top - 8);
        const left = Math.max(leftEdge + 8, Math.min(rect.right - menuWidth, rightEdge - menuWidth - 8));
        const below = rect.bottom + 6;
        const above = rect.top - menuHeight - 6;
        const top = below + menuHeight + 8 <= bottomEdge
            ? below
            : Math.max(topEdge + 8, above);
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
        menu.style.transformOrigin = top === below ? 'top right' : 'bottom right';
        menu.style.visibility = 'visible';
    }

    function openMenu(trigger) {
        if (!window.matchMedia('(max-width: 768px)').matches) return;
        if (document.body.classList.contains('multi-select-active') || document.body.classList.contains('post-multi-select-active')) return;
        const container = getActionContainer(trigger);
        if (!container) return;
        const available = [
            { selector: '.pin-toggle-btn', icon: 'fa-solid fa-thumbtack', fallback: '고정' },
            { selector: '.edit-btn', icon: 'fa-solid fa-pen-to-square', fallback: '수정', tone: 'edit' },
            { selector: '.delete-btn', icon: 'fa-solid fa-trash-can', fallback: '삭제', danger: true }
        ].map(action => ({ ...action, button: container.querySelector(action.selector) }))
            .filter(action => action.button);
        if (!available.length) return;

        ensureMenu();
        closeMenu();
        clearTimeout(closeTimer);
        closeTimer = null;
        menu.classList.remove('is-open');
        const items = available.map(action => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'community-mobile-menu-item' + (action.tone ? ` ${action.tone}` : '') + (action.danger ? ' danger' : '');
            item.setAttribute('role', 'menuitem');
            const icon = document.createElement('i');
            icon.className = action.icon;
            icon.setAttribute('aria-hidden', 'true');
            const label = document.createElement('span');
            label.textContent = action.button.title || action.fallback;
            item.append(icon, label);
            item.addEventListener('click', event => {
                event.stopPropagation();
                closeMenu();
                if (action.button.isConnected) action.button.click();
            });
            return item;
        });
        menu.replaceChildren(...items);
        activeTrigger = trigger;
        trigger.setAttribute('aria-expanded', 'true');
        menu.style.visibility = 'hidden';
        menu.hidden = false;
        positionMenu(trigger);
        void menu.offsetHeight;
        menu.classList.add('is-open');
        items[0].focus({ preventScroll: true });
    }

    document.addEventListener('click', event => {
        const trigger = event.target.closest('.community-more-trigger');
        if (!trigger) return;
        event.preventDefault();
        event.stopPropagation();
        if (activeTrigger === trigger) closeMenu(true);
        else openMenu(trigger);
    });
    document.addEventListener('pointerdown', event => {
        clearDismissedCommentBackground();
        const target = event.target instanceof Element ? event.target : event.target?.parentElement;
        if (!activeTrigger || !target || menu.contains(target) || target.closest('.community-more-trigger')) return;

        const activeComment = activeTrigger.closest('.comment-item, .comment-flat-reply');
        const clickedCommentBackground = getCommentBackgroundItem(target);
        if (activeComment && clickedCommentBackground) {
            dismissedCommentBackground = clickedCommentBackground;
            dismissedCommentBackgroundTimer = setTimeout(clearDismissedCommentBackground, 700);
        }
        closeMenu();
    }, true);
    document.addEventListener('keydown', event => {
        if (!activeTrigger) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            closeMenu(true);
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
            const index = items.indexOf(document.activeElement);
            const next = event.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
            event.preventDefault();
            items[next]?.focus({ preventScroll: true });
        }
    });
    window.addEventListener('scroll', () => closeMenu(), true);
    window.addEventListener('resize', () => closeMenu());
    window.visualViewport?.addEventListener('resize', () => closeMenu());
    ensureMenu();
})();
