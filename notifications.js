// 로그인 사용자 전용 알림: Cloudflare Worker + 표준 Web Push + 화면 상단 배너
(function initializeNotifications() {
    'use strict';

    const notificationRegion = document.getElementById('siteNotificationRegion');
    const notificationQueue = [];
    const shownNotificationIds = new Set();
    let isShowingNotification = false;
    let activeNotificationUser = null;
    let pendingNotificationTarget = null;

    function cleanText(value, maxLength = 140) {
        const text = String(value || '').replace(/\s+/g, ' ').trim();
        if (text.length <= maxLength) return text;
        return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, (character) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[character]));
    }

    function notificationIcon(type) {
        if (type === 'new_comment') return 'fa-solid fa-comment-dots';
        if (type === 'new_reply') return 'fa-solid fa-reply';
        if (type === 'comment_pinned' || type === 'reply_pinned') return 'fa-solid fa-thumbtack';
        if (type === 'post_deleted') return 'fa-solid fa-trash-can';
        if (type === 'site_update') return 'fa-solid fa-sparkles';
        if (type === 'permission') return 'fa-solid fa-bell';
        if (type === 'success') return 'fa-solid fa-circle-check';
        return 'fa-solid fa-bell';
    }

    function normalizeNotificationData(data = {}) {
        return {
            notificationId: cleanText(data.notificationId || data.id || '', 240),
            recipientUid: cleanText(data.recipientUid || '', 160),
            type: cleanText(data.type || 'notice', 40),
            title: cleanText(data.title || '양중과학동아리', 80),
            body: cleanText(data.body || '새 알림이 있어요.', 180),
            target: cleanText(data.target || 'community', 30),
            postId: cleanText(data.postId || '', 160),
            commentId: cleanText(data.commentId || '', 160),
            buildNumber: cleanText(data.buildNumber || '', 40)
        };
    }

    function showNextNotification() {
        if (isShowingNotification || notificationQueue.length === 0 || !notificationRegion) return;
        isShowingNotification = true;

        const item = notificationQueue.shift();
        const toast = document.createElement('div');
        toast.className = `site-notification-toast notification-${item.type}`;
        toast.setAttribute('role', 'status');
        toast.tabIndex = item.onClick ? 0 : -1;

        const icon = document.createElement('div');
        icon.className = 'site-notification-icon';
        const iconElement = document.createElement('i');
        iconElement.className = notificationIcon(item.type);
        icon.appendChild(iconElement);

        const content = document.createElement('div');
        content.className = 'site-notification-content';
        const title = document.createElement('strong');
        title.className = 'site-notification-title';
        title.textContent = item.title;
        const body = document.createElement('p');
        body.className = 'site-notification-body';
        body.textContent = item.body;
        content.append(title, body);

        let dismissButton = null;
        if (item.dismissKey) {
            dismissButton = document.createElement('button');
            dismissButton.type = 'button';
            dismissButton.className = 'site-notification-dismiss-button';
            dismissButton.textContent = item.dismissLabel || '다시 보지 않기';
            dismissButton.title = '이 계정에서만 다시 표시하지 않기';
            dismissButton.addEventListener('click', (event) => {
                event.stopPropagation();
                try {
                    localStorage.setItem(item.dismissKey, '1');
                } catch (error) {
                    console.warn('알림 표시 설정 저장 오류:', error);
                }
                closeToast();
            });
            content.appendChild(dismissButton);
        }

        const controls = document.createElement('div');
        controls.className = 'site-notification-controls';

        if (item.actionLabel && item.onAction) {
            const actionButton = document.createElement('button');
            actionButton.type = 'button';
            actionButton.className = 'site-notification-action';
            actionButton.textContent = item.actionLabel;
            actionButton.addEventListener('click', async (event) => {
                event.stopPropagation();
                closeToast();
                await item.onAction();
            });
            controls.appendChild(actionButton);
        }

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'site-notification-close';
        closeButton.setAttribute('aria-label', '알림 닫기');
        closeButton.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        controls.appendChild(closeButton);

        toast.append(icon, content, controls);
        notificationRegion.appendChild(toast);

        let closeTimer = null;
        let closed = false;

        function closeToast() {
            if (closed) return;
            closed = true;
            if (closeTimer) clearTimeout(closeTimer);
            toast.classList.remove('show');
            toast.classList.add('hide');
            setTimeout(() => {
                toast.remove();
                isShowingNotification = false;
                showNextNotification();
            }, 260);
        }

        closeButton.addEventListener('click', (event) => {
            event.stopPropagation();
            closeToast();
        });

        if (item.onClick) {
            toast.classList.add('clickable');
            const activate = async () => {
                closeToast();
                await item.onClick();
            };
            toast.addEventListener('click', (event) => {
                if (event.target.closest('button')) return;
                activate();
            });
            toast.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    activate();
                }
            });
        }

        requestAnimationFrame(() => toast.classList.add('show'));
        closeTimer = setTimeout(closeToast, item.duration || 6500);
    }

    function queueNotification(item) {
        notificationQueue.push({
            type: item.type || 'notice',
            title: cleanText(item.title || '양중과학동아리', 80),
            body: cleanText(item.body || '새 알림이 있어요.', 180),
            duration: item.duration,
            actionLabel: item.actionLabel,
            onAction: item.onAction,
            onClick: item.onClick,
            dismissKey: item.dismissKey,
            dismissLabel: item.dismissLabel
        });
        showNextNotification();
    }

    function showNotificationOnce(rawData) {
        if (!activeNotificationUser || !auth.currentUser) return;
        const data = normalizeNotificationData(rawData);
        if (data.recipientUid && data.recipientUid !== activeNotificationUser.uid) return;
        if (data.notificationId && shownNotificationIds.has(data.notificationId)) return;
        if (data.notificationId) shownNotificationIds.add(data.notificationId);

        queueNotification({
            type: data.type,
            title: data.title,
            body: data.body,
            onClick: () => openNotificationTarget(data)
        });
    }

    function workerBaseUrl() {
        const config = window.YANGJUNG_NOTIFICATION_WORKER || {};
        const isLocalSite = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
        const configuredUrl = isLocalSite && config.localBaseUrl ? config.localBaseUrl : config.baseUrl;
        return String(configuredUrl || '').trim().replace(/\/$/, '');
    }

    function isWorkerConfigured() {
        const baseUrl = workerBaseUrl();
        try {
            const url = new URL(baseUrl);
            if (url.protocol === 'https:') return true;
            return url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
        } catch {
            return false;
        }
    }

    async function callWorker(path, { method = 'POST', body, authRequired = true } = {}) {
        const baseUrl = workerBaseUrl();
        if (!isWorkerConfigured()) throw new Error('Cloudflare 알림 서버 주소가 아직 설정되지 않았습니다.');

        const headers = { 'Content-Type': 'application/json' };
        if (authRequired) {
            const user = auth.currentUser;
            if (!user) throw new Error('로그인이 필요합니다.');
            headers.Authorization = `Bearer ${await user.getIdToken()}`;
        }

        const response = await fetch(`${baseUrl}${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            const error = new Error(result.error || '알림 서버 요청에 실패했습니다.');
            error.status = response.status;
            throw error;
        }
        return result;
    }

    async function callWorkerWithRetry(path, options, retryStatuses = [502, 503]) {
        const delays = [0, 1200, 3200];
        let lastError;
        for (const delay of delays) {
            if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
            try {
                return await callWorker(path, options);
            } catch (error) {
                lastError = error;
                if (error.status && !retryStatuses.includes(error.status)) throw error;
            }
        }
        throw lastError;
    }

    function base64UrlToUint8Array(value) {
        const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
        const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
        const raw = atob(base64);
        return Uint8Array.from(raw, (character) => character.charCodeAt(0));
    }

    async function syncServiceWorkerAuthState(user) {
        if (!('serviceWorker' in navigator)) return;
        try {
            await navigator.serviceWorker.register('./sw.js');
            const registration = await navigator.serviceWorker.ready;
            registration.active?.postMessage({
                type: 'SET_NOTIFICATION_AUTH_STATE',
                uid: user?.uid || ''
            });
        } catch (error) {
            console.error('알림 로그인 상태 동기화 오류:', error);
        }
    }

    async function registerPushForUser(user) {
        if (!user || activeNotificationUser?.uid !== user.uid || !isWorkerConfigured()) return false;
        if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
        if (!('Notification' in window) || Notification.permission !== 'granted') return false;

        const keyResult = await callWorker('/vapid-public-key', {
            method: 'GET',
            authRequired: false
        });
        if (!keyResult.publicKey) throw new Error('Web Push 공개 키를 받지 못했습니다.');

        const registration = await navigator.serviceWorker.register('./sw.js');
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: base64UrlToUint8Array(keyResult.publicKey)
            });
        }

        await callWorker('/subscriptions', {
            method: 'POST',
            body: { subscription: subscription.toJSON() }
        });
        return true;
    }

    async function requestPushPermission(user) {
        if (!user || activeNotificationUser?.uid !== user.uid) return;
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            queueNotification({
                type: 'notice',
                title: '푸시 알림이 꺼져 있어요',
                body: '사이트를 보고 있을 때의 위쪽 알림은 계속 받을 수 있어요.'
            });
            return;
        }

        try {
            const registered = await registerPushForUser(user);
            queueNotification({
                type: registered ? 'success' : 'notice',
                title: registered ? '푸시 알림을 켰어요' : '푸시 알림을 켜지 못했어요',
                body: registered
                    ? '사이트를 닫아도 이 기기의 알림창에서 소식을 받을 수 있어요.'
                    : '이 브라우저가 Web Push를 지원하는지 확인해 주세요.'
            });
        } catch (error) {
            console.error('푸시 알림 등록 오류:', error);
            queueNotification({
                type: 'notice',
                title: '푸시 알림을 켜지 못했어요',
                body: error.message || '알림 서버 설정을 확인해 주세요.'
            });
        }
    }

    async function preparePushForUser(user) {
        if (!isWorkerConfigured()) {
            console.warn('Cloudflare 알림 Worker 주소가 아직 설정되지 않았습니다.');
            return;
        }
        if (!window.isSecureContext || !('Notification' in window) || !('PushManager' in window)) return;

        if (Notification.permission === 'granted') {
            await registerPushForUser(user).catch((error) => console.error('푸시 알림 등록 오류:', error));
            return;
        }

        if (Notification.permission === 'default') {
            const dismissKey = `yangjung_push_prompt_hidden_${user.uid}`;
            let isDismissed = false;
            try {
                isDismissed = localStorage.getItem(dismissKey) === '1';
            } catch (error) {
                console.warn('알림 표시 설정 읽기 오류:', error);
            }
            if (isDismissed) return;

            queueNotification({
                type: 'permission',
                title: '사이트 밖에서도 알림 받을까?',
                body: '알림을 켜면 사이트를 닫아도 댓글·답글·고정·삭제·업데이트 소식이 떠요.',
                duration: 12000,
                actionLabel: '알림 켜기',
                onAction: () => requestPushPermission(user),
                dismissKey,
                dismissLabel: '다시 보지 않기'
            });
        }
    }

    async function unregisterPushSubscription() {
        const user = auth.currentUser || activeNotificationUser;
        await syncServiceWorkerAuthState(null);
        if (!user || !('serviceWorker' in navigator) || !isWorkerConfigured()) return;

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (!subscription) return;
            await callWorker('/subscriptions', {
                method: 'DELETE',
                body: { subscription: subscription.toJSON() }
            });
            await subscription.unsubscribe();
        } catch (error) {
            console.error('푸시 구독 해제 오류:', error);
        }
    }

    async function publishCurrentSiteUpdate(user) {
        if (!user || !isWorkerConfigured()) return;
        if (typeof isAdmin !== 'function' || !isAdmin(user.email) || !window.SITE_UPDATE_INFO) return;
        const info = window.SITE_UPDATE_INFO;
        await callWorker('/events/site-update', {
            body: {
                oneUiVersion: info.oneUiVersion || '',
                buildNumber: info.buildNumber || '',
                message: info.message || ''
            }
        }).catch((error) => console.error('사이트 업데이트 알림 오류:', error));
    }

    function buildPostAvatar(post, postId) {
        if (post.userPhoto) {
            return `<img class="board-author-avatar" src="${escapeHtml(post.userPhoto)}" alt="${escapeHtml(post.author || '작성자')}" style="object-fit: cover; border: 1px solid var(--glass-border);">`;
        }
        const letter = cleanText(post.author || '?', 1) || '?';
        const hueSource = String(postId || '?').charCodeAt(0) || 1;
        return `<div class="board-author-avatar" style="background: hsl(${(hueSource * 137) % 360}, 60%, 50%)">${escapeHtml(letter)}</div>`;
    }

    function highlightComment(commentId, attempts = 0) {
        if (!commentId || attempts > 40) return;
        const commentElement = document.getElementById(`comment-${commentId}`);
        if (!commentElement) {
            setTimeout(() => highlightComment(commentId, attempts + 1), 125);
            return;
        }

        commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        commentElement.classList.add('notification-target-highlight');
        setTimeout(() => commentElement.classList.remove('notification-target-highlight'), 2200);
    }

    async function openNotificationTarget(rawData) {
        const data = normalizeNotificationData(rawData);
        if (!activeNotificationUser) {
            pendingNotificationTarget = data;
            return;
        }
        if (data.recipientUid && data.recipientUid !== activeNotificationUser.uid) return;

        if (data.target === 'update') {
            if (typeof window.openSettingsModal === 'function') {
                window.openSettingsModal('update');
                setTimeout(() => {
                    if (typeof window.showInPageUpdateDetails === 'function') window.showInPageUpdateDetails();
                }, 220);
            }
            return;
        }

        const communityPage = document.getElementById('suggestionPage');
        if (communityPage && typeof switchPage === 'function' && typeof currentPage !== 'undefined' && currentPage !== communityPage) {
            switchPage(currentPage, communityPage, false, true);
        }

        if (data.target !== 'post' || !data.postId) return;

        try {
            const postSnapshot = await db.collection('posts').doc(data.postId).get();
            if (!postSnapshot.exists) {
                queueNotification({
                    type: 'notice',
                    title: '게시물을 열 수 없어요',
                    body: '게시물이 이미 삭제됐거나 더 이상 존재하지 않아요.'
                });
                return;
            }

            const post = postSnapshot.data();
            const avatar = buildPostAvatar(post, data.postId);
            const timeText = typeof formatDate === 'function' ? formatDate(post.createdAt) : '';
            if (typeof openPostDetail === 'function') {
                openPostDetail(data.postId, post, avatar, timeText, 'fullscreen');
                if (data.commentId) highlightComment(data.commentId);
            }
        } catch (error) {
            console.error('알림 대상 열기 오류:', error);
        }
    }

    function readTargetFromUrl() {
        const url = new URL(window.location.href);
        const type = url.searchParams.get('notificationType');
        const target = url.searchParams.get('notificationTarget');
        const recipientUid = url.searchParams.get('notificationRecipient');
        const postId = url.searchParams.get('notificationPost');
        const commentId = url.searchParams.get('notificationComment');
        const buildNumber = url.searchParams.get('notificationBuild');
        if (!type && !target && !postId && !buildNumber) return null;

        ['notificationType', 'notificationTarget', 'notificationRecipient', 'notificationPost', 'notificationComment', 'notificationBuild']
            .forEach((key) => url.searchParams.delete(key));
        history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
        return { type, target, recipientUid, postId, commentId, buildNumber };
    }

    const clubNotifications = {
        isConfigured: isWorkerConfigured,

        notifyCommentCreated(postId, commentId) {
            return callWorkerWithRetry('/events/comment', {
                body: { postId, commentId }
            }, [404, 409, 502, 503]);
        },

        notifyCommentPinChanged(postId, commentId, pinned) {
            return callWorkerWithRetry('/events/comment-pin', {
                body: { postId, commentId, pinned: Boolean(pinned) }
            }, [404, 409, 502, 503]);
        },

        deletePost(postId) {
            return callWorker('/actions/delete-post', {
                body: { postId }
            });
        },

        unregister: unregisterPushSubscription
    };

    window.clubNotifications = clubNotifications;
    window.unregisterPushToken = unregisterPushSubscription;
    window.showSiteNotification = queueNotification;
    window.openNotificationTarget = openNotificationTarget;

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (!event.data) return;
            if (event.data.type === 'SHOW_SITE_NOTIFICATION') {
                showNotificationOnce(event.data.notification || {});
                return;
            }
            if (event.data.type === 'OPEN_NOTIFICATION_TARGET') {
                openNotificationTarget(event.data.notification || {});
            }
        });
    }

    pendingNotificationTarget = readTargetFromUrl();

    auth.onAuthStateChanged(async (user) => {
        shownNotificationIds.clear();
        activeNotificationUser = user || null;
        await syncServiceWorkerAuthState(user);

        if (!user) return;

        await Promise.all([
            preparePushForUser(user),
            publishCurrentSiteUpdate(user)
        ]);

        if (pendingNotificationTarget) {
            const target = pendingNotificationTarget;
            pendingNotificationTarget = null;
            await openNotificationTarget(target);
        }
    });
})();
