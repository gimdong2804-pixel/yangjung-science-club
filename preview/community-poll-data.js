// 투표 정의는 게시글/댓글에 저장하고, 표는 계정과 분리된 임의 ID로 저장한다.
(function () {
    const drafts = { post: null, comment: null };
    const locked = { post: false, comment: false };
    const states = new Map();
    const pendingCreates = new Map();
    const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const clone = value => value ? JSON.parse(JSON.stringify(value)) : null;
    const signatureOf = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
    const user = () => typeof currentUser !== 'undefined' ? currentUser : null;

    function ballotRefs(uid, pollPath) {
        const parts = String(pollPath || '').split('/');
        if (parts[0] !== 'posts' || (parts.length !== 2 && !(parts.length === 4 && parts[2] === 'comments'))) {
            throw new Error('투표 경로가 올바르지 않아요.');
        }
        const postId = parts[1];
        const commentId = parts.length === 4 ? parts[3] : '';
        const mappingPath = commentId
            ? `pollBallotMappings/${uid}/posts/${postId}/comments/${commentId}`
            : `pollBallotMappings/${uid}/posts/${postId}`;
        return {
            mapping: db.doc(mappingPath),
            legacy: db.doc(`${pollPath}/votes/${uid}`),
            anonymous: ballotId => db.doc(`${pollPath}/anonymousVotes/${ballotId}`)
        };
    }

    function newBallotId() {
        const cryptoApi = window.crypto;
        if (!cryptoApi?.getRandomValues) throw new Error('익명 투표용 보안 키를 만들 수 없어요.');
        const bytes = new Uint8Array(16);
        cryptoApi.getRandomValues(bytes);
        return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    async function migrateLegacyBallot(refs, ballotId) {
        const legacySnapshot = await refs.legacy.get();
        if (!legacySnapshot.exists) return;
        const oldVote = legacySnapshot.data();
        const anonymousRef = refs.anonymous(ballotId);
        const anonymousSnapshot = await anonymousRef.get();
        if (!anonymousSnapshot.exists) {
            const migrated = {
                choices: Array.isArray(oldVote.choices) ? oldVote.choices : [],
                cancelCount: Number.isInteger(oldVote.cancelCount) ? oldVote.cancelCount : 0,
                votedAt: oldVote.votedAt || oldVote.updatedAt,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            try {
                await anonymousRef.set(migrated);
            } catch (error) {
                const concurrentSnapshot = await anonymousRef.get();
                if (!concurrentSnapshot.exists) throw error;
            }
        }
        try {
            await refs.legacy.delete();
        } catch (error) {
            const remainingLegacy = await refs.legacy.get();
            if (remainingLegacy.exists) throw error;
        }
    }

    async function getBallotId(state, account, createIfMissing = false) {
        const refs = ballotRefs(account.uid, state.path);
        let mapping = await refs.mapping.get();
        let ballotId = mapping.exists ? mapping.data().ballotId : '';
        if (!ballotId) {
            const legacy = await refs.legacy.get();
            if (!legacy.exists && !createIfMissing) return null;
            const candidate = newBallotId();
            ballotId = await db.runTransaction(async transaction => {
                const current = await transaction.get(refs.mapping);
                if (current.exists) return current.data().ballotId;
                transaction.set(refs.mapping, { ballotId: candidate });
                return candidate;
            });
        }
        await migrateLegacyBallot(refs, ballotId);
        return ballotId;
    }
    function submissionErrorMessage(error, kind = 'post') {
        const code = String(error?.code || '').split('/').pop();
        if (code === 'permission-denied' || /Missing or insufficient permissions/i.test(error?.message || '')) {
            return '서버에서 저장을 허용하지 않았어요. 로그인 상태를 확인하고, 계속되면 관리자에게 문의해주세요. 작성 내용은 유지됩니다.';
        }
        if (code === 'unauthenticated') return '로그인이 만료됐어요. 다시 로그인한 후 전송해주세요.';
        if (code === 'unavailable' || code === 'deadline-exceeded') {
            return '서버에 연결하지 못했어요. 인터넷 연결을 확인한 후 다시 시도해주세요.';
        }
        if (code === 'resource-exhausted') return '현재 요청이 많아 저장하지 못했어요. 잠시 후 다시 시도해주세요.';
        if (/[가-힣]/.test(error?.message || '')) return error.message;
        return kind === 'comment'
            ? '댓글 저장 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.'
            : '게시글 저장 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.';
    }
    let target = 'post';
    let suspended = false;
    let scheduled = false;
    const previewAnimations = new WeakMap();
    const previewAnimationTimers = new WeakMap();
    const pollHeightAnimations = new WeakMap();
    const MAX_VOTE_CANCELLATIONS = 2;
    const VOTE_CANCELLATION_WINDOW_MS = 5 * 60 * 1000;

    function timestampMillis(value) {
        if (value && typeof value.toMillis === 'function') return value.toMillis();
        if (value instanceof Date) return value.getTime();
        return typeof value === 'number' && Number.isFinite(value) ? value : null;
    }

    function normalizeVoteDocument(data) {
        const votedAt = data.votedAt || data.updatedAt || null;
        const hasValidCancelCount = Number.isInteger(data.cancelCount) || !Object.prototype.hasOwnProperty.call(data, 'cancelCount');
        return {
            choices: Array.isArray(data.choices) ? [...data.choices] : [],
            cancelCount: Number.isInteger(data.cancelCount) ? data.cancelCount : 0,
            votedAt,
            updatedAt: data.updatedAt || null,
            metadataKnown: hasValidCancelCount && timestampMillis(votedAt) !== null
        };
    }

    function getCancelDisabledReason(state) {
        if (state.saving || state.closing) return '투표 처리 중에는 취소할 수 없어요.';
        if (state.closed) return '투표가 마감됐어요.';
        if (!user()) return '로그인 상태를 확인한 뒤 다시 시도해 주세요.';
        if (!state.ownVoteLoaded || !state.ownVote?.metadataKnown) return '취소 제한 정보를 확인할 수 없어요. 결과를 다시 불러와 주세요.';
        if (state.ownVote.cancelCount >= MAX_VOTE_CANCELLATIONS) return '투표 취소는 최대 2회까지만 가능해요.';
        const votedAt = timestampMillis(state.ownVote.votedAt);
        if (votedAt === null) return '투표 시간을 확인할 수 없어 취소할 수 없어요.';
        if (Date.now() >= votedAt + VOTE_CANCELLATION_WINDOW_MS) return '투표 후 5분이 지나 취소할 수 없어요.';
        return '';
    }

    function scheduleCancelExpiry(state) {
        clearTimeout(state.cancelExpiryTimer);
        state.cancelExpiryTimer = null;
        if (!state.ownVoteLoaded || !state.ownVote?.choices.length || !state.ownVote.metadataKnown
            || state.ownVote.cancelCount >= MAX_VOTE_CANCELLATIONS) return;
        const votedAt = timestampMillis(state.ownVote.votedAt);
        if (votedAt === null) return;
        const remaining = votedAt + VOTE_CANCELLATION_WINDOW_MS - Date.now();
        if (remaining <= 0) return;
        state.cancelExpiryTimer = setTimeout(() => {
            state.cancelExpiryTimer = null;
            paint(state);
        }, remaining + 5);
    }

    function prefersReducedMotion() {
        return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    }

    const pollHelpButtonAnimations = new WeakMap();
    const pollHelpDetailsAnimations = new WeakMap();

    function animatePollHelpButton(button, expanded) {
        const startWidth = Number.parseFloat(getComputedStyle(button).width) || button.getBoundingClientRect().width;
        const previous = pollHelpButtonAnimations.get(button);
        if (previous) {
            previous.onfinish = null;
            previous.cancel();
            pollHelpButtonAnimations.delete(button);
        }
        button.setAttribute('aria-expanded', String(expanded));
        button.setAttribute('aria-label', expanded ? '투표 안내 접기' : '투표 안내 더 보기');
        const label = button.querySelector('.poll-help-toggle-label');
        if (label) label.textContent = expanded ? '간단히 접기' : '자세히';

        if (prefersReducedMotion() || typeof button.animate !== 'function') {
            button.style.removeProperty('width');
            return;
        }

        button.style.removeProperty('width');
        const endWidth = Number.parseFloat(getComputedStyle(button).width) || button.getBoundingClientRect().width;
        if (Math.abs(startWidth - endWidth) < 1) {
            button.style.removeProperty('width');
            return;
        }

        const animation = button.animate([
            { width: `${startWidth}px` },
            { width: `${endWidth}px` }
        ], { duration: 240, easing: 'cubic-bezier(.2, .7, .2, 1)' });
        pollHelpButtonAnimations.set(button, animation);
        animation.onfinish = () => {
            if (pollHelpButtonAnimations.get(button) !== animation) return;
            button.style.removeProperty('width');
            pollHelpButtonAnimations.delete(button);
        };
    }

    function animatePollHelpDetails(details, expanded) {
        const startHeight = details.getBoundingClientRect().height;
        const startOpacity = Number.parseFloat(getComputedStyle(details).opacity) || 0;
        const startMarginTop = Number.parseFloat(getComputedStyle(details).marginTop) || 0;
        const previous = pollHelpDetailsAnimations.get(details);
        if (previous) {
            previous.onfinish = null;
            previous.cancel();
            pollHelpDetailsAnimations.delete(details);
        }
        details.classList.toggle('is-open', expanded);
        details.setAttribute('aria-hidden', String(!expanded));
        if (expanded) details.removeAttribute('inert');
        else details.setAttribute('inert', '');

        const clearAnimationStyles = () => {
            details.style.removeProperty('height');
            details.style.removeProperty('opacity');
            details.style.removeProperty('margin-top');
        };
        if (prefersReducedMotion() || typeof details.animate !== 'function') {
            clearAnimationStyles();
            return;
        }

        const endHeight = expanded ? details.scrollHeight : 0;
        const endMarginTop = expanded ? (Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) * .2 : 0;
        const endOpacity = expanded ? 1 : 0;
        clearAnimationStyles();
        const animation = details.animate([
            { height: `${startHeight}px`, opacity: startOpacity, marginTop: `${startMarginTop}px` },
            { height: `${endHeight}px`, opacity: endOpacity, marginTop: `${endMarginTop}px` }
        ], { duration: expanded ? 260 : 220, easing: 'cubic-bezier(.2, .7, .2, 1)' });
        pollHelpDetailsAnimations.set(details, animation);
        animation.onfinish = () => {
            if (pollHelpDetailsAnimations.get(details) !== animation) return;
            clearAnimationStyles();
            pollHelpDetailsAnimations.delete(details);
        };
    }

    function stopPollHeightAnimation(host) {
        const active = pollHeightAnimations.get(host);
        if (active) {
            clearTimeout(active.timer);
            active.animation.onfinish = null;
            active.animation.cancel();
            pollHeightAnimations.delete(host);
        }
        host.style.height = '';
        host.classList.remove('poll-resizing');
    }

    function measurePollNaturalHeight(host) {
        const style = getComputedStyle(host);
        return host.scrollHeight + parseFloat(style.borderTopWidth || '0') + parseFloat(style.borderBottomWidth || '0');
    }

    function animatePollHeight(host, fromHeight) {
        const existing = pollHeightAnimations.get(host);
        let startHeight = fromHeight;
        if (existing) {
            if (Math.abs(existing.targetHeight - measurePollNaturalHeight(host)) < 1) return;
            startHeight = host.getBoundingClientRect().height;
            clearTimeout(existing.timer);
            existing.animation.onfinish = null;
            existing.animation.cancel();
            pollHeightAnimations.delete(host);
        }
        if (prefersReducedMotion() || typeof host.animate !== 'function') {
            host.style.height = '';
            host.classList.remove('poll-resizing');
            return;
        }

        host.style.height = 'auto';
        const targetHeight = host.getBoundingClientRect().height;
        if (Math.abs(startHeight - targetHeight) < 1) {
            host.style.height = '';
            host.classList.remove('poll-resizing');
            return;
        }

        host.style.height = `${startHeight}px`;
        void host.offsetHeight;
        host.classList.add('poll-resizing');
        const animation = host.animate([
            { height: `${startHeight}px` },
            { height: `${targetHeight}px` }
        ], { duration: 300, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' });
        const active = { animation, timer: null, targetHeight };
        const finish = () => {
            if (pollHeightAnimations.get(host) !== active) return;
            clearTimeout(active.timer);
            host.style.height = `${active.targetHeight}px`;
            animation.onfinish = null;
            animation.cancel();
            pollHeightAnimations.delete(host);
            host.style.height = '';
            host.classList.remove('poll-resizing');
        };
        pollHeightAnimations.set(host, active);
        animation.onfinish = finish;
        active.timer = setTimeout(finish, 420);
    }
    function stopPreviewAnimation(host) {
        const animation = previewAnimations.get(host);
        if (animation) {
            animation.onfinish = null;
            animation.cancel();
            previewAnimations.delete(host);
        }
        const timer = previewAnimationTimers.get(host);
        if (timer !== undefined) {
            clearTimeout(timer);
            previewAnimationTimers.delete(host);
        }
        host.style.overflow = '';
        host.style.pointerEvents = '';
    }

    function animateDraftVisibility(host, kind, show) {
        if (prefersReducedMotion() || typeof host.animate !== 'function') return false;

        host.style.overflow = 'hidden';
        host.style.pointerEvents = 'none';
        const height = host.getBoundingClientRect().height;
        const keyframes = show
            ? [
                { height: '0px', opacity: 0, transform: 'translateY(8px)' },
                { height: `${height}px`, opacity: 1, transform: 'translateY(0)' }
            ]
            : [
                { height: `${height}px`, opacity: 1, transform: 'translateY(0)' },
                { height: '0px', opacity: 0, transform: 'translateY(-6px)' }
            ];
        const duration = show ? 240 : 190;
        const animation = host.animate(keyframes, {
            duration,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
        });
        previewAnimations.set(host, animation);
        const finish = () => {
            if (previewAnimations.get(host) !== animation) return;
            previewAnimations.delete(host);
            const timer = previewAnimationTimers.get(host);
            if (timer !== undefined) clearTimeout(timer);
            previewAnimationTimers.delete(host);
            animation.onfinish = null;
            animation.cancel();
            host.style.overflow = '';
            host.style.pointerEvents = '';
            if (!show && !drafts[kind]) {
                host.hidden = true;
                host.innerHTML = '';
            }
        };
        animation.onfinish = finish;
        previewAnimationTimers.set(host, setTimeout(finish, duration + 80));
        return true;
    }

    function validate(poll) {
        if (!poll || typeof poll.question !== 'string' || !poll.question.trim() || poll.question.length > 100) return '투표 제목을 100자 이내로 입력해주세요.';
        if (!Array.isArray(poll.options) || poll.options.length < 2 || poll.options.length > 10) return '선택지는 2개 이상, 10개 이하로 입력해주세요.';
        if (poll.options.some(option => typeof option !== 'string' || !option.trim() || option.length > 50)) return '모든 선택지를 50자 이내로 입력해주세요.';
        if (new Set(poll.options.map(option => option.trim().toLowerCase())).size !== poll.options.length) return '같은 선택지를 중복해서 넣을 수 없습니다.';
        if (typeof poll.multiple !== 'boolean') return '복수 선택 설정을 확인해주세요.';
        return window.pollAttachments?.validate(poll) || '';
    }

    function preview(kind) {
        const host = document.getElementById(kind + 'PollPreview');
        if (!host) return;
        const poll = drafts[kind];
        stopPreviewAnimation(host);

        if (poll) {
            const wasHidden = host.hidden;
            host.hidden = false;
            host.innerHTML = `<div class="poll-draft-heading"><span class="poll-draft-badge"><i class="fa-solid fa-square-poll-vertical" aria-hidden="true"></i> ${locked[kind] ? '게시된 투표' : '투표 첨부됨 · 아직 전송 전'}</span>${locked[kind] ? '' : `<div class="poll-draft-actions"><button type="button" data-draft-edit="${kind}">수정</button><button type="button" data-draft-remove="${kind}">삭제</button></div>`}</div><strong class="poll-draft-question">${escape(poll.question)}</strong><p class="poll-draft-options">${poll.options.map(escape).join(' · ')}</p><small>${poll.multiple ? '복수 선택' : '단일 선택'}${locked[kind] ? ' · 게시된 투표의 질문과 선택지는 변경할 수 없어요.' : ''}</small>`;
            if (window.pollAttachments) host.insertAdjacentHTML('beforeend', window.pollAttachments.renderDraft(kind, poll));
            if (wasHidden) animateDraftVisibility(host, kind, true);
        } else if (!host.hidden && animateDraftVisibility(host, kind, false)) {
            // Keep the preview mounted until its exit motion completes.
        } else {
            host.hidden = true;
            host.innerHTML = '';
        }
        const button = document.getElementById(kind === 'post' ? 'postPollBtn' : 'commentAttachPollBtn');
        if (button) button.disabled = locked[kind];
        if (kind === 'comment') {
            const submit = document.querySelector('.side-detail-container .comment-submit-btn');
            if (submit) {
                submit.setAttribute('aria-label', poll && !locked[kind] ? '댓글과 투표 게시하기' : '댓글 전송');
                submit.title = poll && !locked[kind] ? '댓글과 투표 게시하기' : '댓글 전송';
            }
        }
    }

    function setDraft(kind, poll = null, isLocked = false, preserveFiles = false) {
        if (!preserveFiles) window.pollAttachments?.reset(kind, poll);
        drafts[kind] = clone(poll);
        locked[kind] = isLocked;
        preview(kind);
    }

    function beginDraft(kind) {
        if (!user()) { alert('투표를 만들려면 먼저 로그인해주세요.'); return false; }
        if (!(kind in drafts) || locked[kind]) { alert('게시된 글의 투표는 변경할 수 없습니다. 새 글에 투표를 첨부해주세요.'); return false; }
        const sending = document.querySelector(kind === 'post' ? '#submitPostBtn' : '.comment-submit-btn');
        if (sending?.disabled) return false;
        target = kind;
        const poll = drafts[kind];
        document.getElementById('pollQuestionInput').value = poll?.question || '';
        document.getElementById('pollMultipleChoice').checked = !!poll?.multiple;
        document.getElementById('pollOptionsList').innerHTML = (poll?.options || ['', '']).map((option, index) => `<div class="poll-option-row"><input type="text" class="poll-input poll-option-input" placeholder="선택지 ${index + 1}" aria-label="선택지 ${index + 1}" maxlength="50" value="${escape(option)}"><button type="button" class="poll-option-remove-btn" onclick="window.removePollOption(this)" title="삭제"><i class="fa-solid fa-xmark"></i></button></div>`).join('');
        window.pollAttachments?.beginEdit(kind);
        return true;
    }

    function attachDraft() {
        const poll = {
            question: document.getElementById('pollQuestionInput').value.trim(),
            options: Array.from(document.querySelectorAll('#pollOptionsList .poll-option-row:not(.poll-option-leaving) .poll-option-input')).map(input => input.value.trim()),
            multiple: document.getElementById('pollMultipleChoice').checked
        };
        const error = validate(poll);
        if (error) { alert(error); return; }
        window.pollAttachments?.commitEdit(target);
        setDraft(target, poll, false, true);
        window.closePollModal();
    }

    function renderHtml(poll, postId, commentId = '', ownerUid = '', closed = false) {
        if (validate(poll) || !/^[A-Za-z0-9_-]{1,128}$/.test(postId) || (commentId && !/^[A-Za-z0-9_-]{1,128}$/.test(commentId))) return '';
        const path = `posts/${postId}${commentId ? '/comments/' + commentId : ''}`;
        return `<div class="community-poll" data-no-double-like data-poll-path="${path}" data-poll-owner="${escape(ownerUid)}" data-poll-closed="${closed === true ? 'true' : 'false'}" data-poll="${escape(JSON.stringify(poll))}"></div>`;
    }

    function measureElementRect(element) {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }

    function updateVoteActionRow(actions, state, own, disabled, animate) {
        const saveButton = actions.querySelector('[data-vote="save"]');
        const label = saveButton?.querySelector('.poll-vote-label');
        const nextLabel = state.showSaving ? '저장 중…' : '투표하기';
        if (label && label.textContent.trim() !== nextLabel) {
            label.textContent = nextLabel;
            if (animate && !prefersReducedMotion()) {
                label.classList.add('poll-vote-label-changing');
                label.addEventListener('animationend', () => label.classList.remove('poll-vote-label-changing'), { once: true });
            } else {
                label.classList.remove('poll-vote-label-changing');
            }
        }
        if (saveButton) saveButton.disabled = disabled || Boolean(own) || !state.selection.length;
        const cancelButton = actions.querySelector('[data-vote="cancel"]');
        const cancelWrapper = actions.querySelector('.poll-vote-cancel-wrap');
        const cancelReason = own ? getCancelDisabledReason(state) : '';
        const cancelDisabled = disabled || Boolean(cancelReason);
        const cancelTooltip = cancelReason || (disabled ? '투표 처리 중에는 취소할 수 없어요.' : '');
        if (cancelButton) {
            cancelButton.disabled = cancelDisabled;
            cancelButton.setAttribute('aria-label', cancelTooltip
                ? `투표 취소. ${cancelTooltip}`
                : '투표 취소');
        }
        if (cancelWrapper) {
            cancelWrapper.classList.toggle('is-disabled', cancelDisabled);
            const title = cancelReason || (disabled ? '투표 처리 중에는 취소할 수 없어요.' : '');
            if (title) cancelWrapper.title = title;
            else cancelWrapper.removeAttribute('title');
        }
        const closeButton = actions.querySelector('[data-vote="close"]');
        if (closeButton) {
            closeButton.disabled = disabled || state.closing;
            closeButton.textContent = state.closing ? '마감 중…' : '투표 마감';
        }
    }
    function animateVoteActions(host, previous, enabled) {
        if (!enabled || prefersReducedMotion() || !previous) return;
        const saveButton = host.querySelector('[data-vote="save"]') || host.querySelector('[data-vote="cancel"]');
        if (!saveButton) return;

        const label = saveButton.querySelector('.poll-vote-label');
        if (label && previous.label !== label.textContent.trim()) {
            label.classList.add('poll-vote-label-changing');
            label.addEventListener('animationend', () => label.classList.remove('poll-vote-label-changing'), { once: true });
        }

        const cancelButton = host.querySelector('[data-vote="cancel"]');
        if (!cancelButton && previous.hadCancel && previous.cancelButton && previous.cancelRect) {
            const actions = saveButton.closest('.poll-vote-actions');
            const actionsRect = measureElementRect(actions);
            const exiting = previous.cancelButton;
            if (actions && actionsRect) {
                exiting.removeAttribute('data-vote');
                exiting.disabled = true;
                exiting.setAttribute('aria-hidden', 'true');
                exiting.classList.add('poll-vote-cancel-ghost');
                exiting.style.left = `${previous.cancelRect.left - actionsRect.left}px`;
                exiting.style.top = `${previous.cancelRect.top - actionsRect.top}px`;
                exiting.style.width = `${previous.cancelRect.width}px`;
                exiting.style.height = `${previous.cancelRect.height}px`;
                actions.append(exiting);
                const animation = exiting.animate([
                    { opacity: 1, transform: 'translateY(0) scale(1)' },
                    { opacity: 0, transform: 'translateY(-4px) scale(.96)' }
                ], { duration: 200, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
                let cleaned = false;
                const cleanup = () => {
                    if (cleaned) return;
                    cleaned = true;
                    animation.onfinish = null;
                    animation.cancel();
                    exiting.remove();
                };
                animation.onfinish = cleanup;
                setTimeout(cleanup, 300);
            }
        }

        const nextRect = measureElementRect(saveButton);
        if (previous.saveRect && nextRect) {
            const dx = previous.saveRect.left - nextRect.left;
            const dy = previous.saveRect.top - nextRect.top;
            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                saveButton.animate([
                    { transform: `translate(${dx}px, ${dy}px)` },
                    { transform: 'translate(0, 0)' }
                ], { duration: 260, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
            }
        }

        if (cancelButton && !previous.hadCancel) {
            cancelButton.classList.add('poll-vote-cancel-entering');
            cancelButton.addEventListener('animationend', () => cancelButton.classList.remove('poll-vote-cancel-entering'), { once: true });
        }
    }
    function paint(state, animateEntrance = false, animateResults = true) {
        const { poll } = state;
        const counts = poll.options.map(option => state.votes.filter(vote => vote.choices.includes(option)).length);
        const total = state.votes.length;
        const own = state.ownVote?.choices?.length ? state.ownVote : null;
        const disabled = state.saving || state.closing || state.closed || !user() || !state.ownVoteLoaded;
        const visibleError = state.error || state.ownVoteError || state.resultsError;
        const canRetry = Boolean(state.ownVoteError || state.resultsError);
        const saveDisabled = disabled || Boolean(own) || !state.selection.length;
        const choicesDisabled = disabled || Boolean(own);
        const cancelDisabledReason = own ? getCancelDisabledReason(state) : '';
        const cancelDisabled = disabled || Boolean(cancelDisabledReason);
        const cancelTooltip = cancelDisabledReason || (disabled ? '투표 처리 중에는 취소할 수 없어요.' : '');
        const cancelButtonHtml = own
            ? `<span class="poll-vote-cancel-wrap ${cancelDisabled ? 'is-disabled' : ''}" ${cancelTooltip ? `title="${escape(cancelTooltip)}"` : ''}><button type="button" data-vote="cancel" ${cancelDisabled ? 'disabled' : ''} aria-label="${escape(cancelTooltip ? `투표 취소. ${cancelTooltip}` : '투표 취소')}">투표 취소</button></span>`
            : '';
        const statusMessage = !user()
            ? '로그인하면 결과를 확인하고 투표할 수 있어요.'
            : visibleError ? [visibleError, cancelDisabledReason].filter(Boolean).join(' ')
            : !state.ownVoteLoaded ? '내 투표 정보를 확인하고 있어요.'
            : state.closed ? '투표가 마감됐어요.'
                : state.closing ? '투표를 마감하고 있어요.'
                    : state.saving ? '투표를 저장하고 있어요.'
                        : cancelDisabledReason || (own ? '내 투표가 저장됐어요.' : '');
        const canClose = Boolean(state.ownerUid && user()?.uid === state.ownerUid && !state.closed);
        const publishedPoll = {
            ...poll,
            optionAttachments: state.optionFiles || poll.optionAttachments || {},
            questionAttachments: state.questionFiles || poll.questionAttachments || []
        };
        const selected = state.selection;
        const reducedMotion = prefersReducedMotion();
        state.nodes.forEach(host => {
            if (!host.isConnected) return;
            const activeElement = document.activeElement;
            let focusSnapshot = null;
            if (host.contains(activeElement)) {
                if (activeElement.matches('.poll-choice input')) {
                    focusSnapshot = { kind: 'choice', index: Number(activeElement.value) };
                } else if (activeElement.matches('[data-vote]')) {
                    focusSnapshot = { kind: 'vote', action: activeElement.dataset.vote };
                } else if (activeElement.matches('.poll-status')) {
                    focusSnapshot = { kind: 'status' };
                } else {
                    focusSnapshot = { kind: 'node', node: activeElement };
                }
            }
            const hasPainted = host.dataset.pollPainted === 'true';
            let activeHeightAnimation = pollHeightAnimations.get(host);
            const previousHeight = host.getBoundingClientRect().height;
            if (reducedMotion && activeHeightAnimation) {
                stopPollHeightAnimation(host);
                activeHeightAnimation = null;
            }
            const previousWidths = Array.from(host.querySelectorAll('.poll-result-fill'), fill => fill.style.width);
            const previousFiles = new Map([...host.querySelectorAll('.poll-published-question-files, [data-poll-option-files]')]
                .map(node => [node.classList.contains('poll-published-question-files') ? 'question' : node.dataset.pollOptionFiles, node]));
            const previousStatusNode = host.querySelector('.poll-status');
            const previousCounts = Array.from(host.querySelectorAll('.poll-result-count'), count => count.textContent);
            const previousStatus = host.querySelector('.poll-status')?.textContent;
            const previousRetry = Boolean(host.querySelector('[data-vote="retry"]'));
            const previousActions = host.querySelector('.poll-vote-actions');
            const previousSaveButton = host.querySelector('[data-vote="save"]');
            const previousCancelButton = host.querySelector('[data-vote="cancel"]');
            const previousActionState = previousActions ? {
                label: previousSaveButton?.textContent.trim() || '',
                saveRect: measureElementRect(previousSaveButton || previousCancelButton),
                cancelButton: previousCancelButton,
                cancelRect: measureElementRect(previousCancelButton),
                hadCancel: Boolean(previousCancelButton),
                hadClose: Boolean(host.querySelector('[data-vote="close"]'))
            } : null;
            host.innerHTML = `<h4>${escape(poll.question)}</h4>${window.pollAttachments?.renderPublishedQuestion?.(publishedPoll) || ''}<div class="poll-help">
    <p class="poll-help-summary">${poll.multiple ? '복수 선택 가능' : '한 항목 선택'}${!user() ? ' · 로그인 후 투표 가능' : state.closed ? ' · 투표 마감' : ' · 취소 후 재투표로 변경 최대 2회 · 취소는 5분 안에'}</p>
    <button type="button" class="poll-help-toggle" data-vote="help" aria-expanded="${state.helpOpen ? 'true' : 'false'}" aria-label="${state.helpOpen ? '투표 안내 접기' : '투표 안내 더 보기'}">
        <span class="poll-help-toggle-label">${state.helpOpen ? '간단히 접기' : '자세히'}</span>
        <i class="fa-solid fa-chevron-down poll-help-toggle-caret" aria-hidden="true"></i>
    </button>
    <div class="poll-help-details${state.helpOpen ? ' is-open' : ''}" aria-hidden="${state.helpOpen ? 'false' : 'true'}" ${state.helpOpen ? '' : 'inert'}>
        <div class="poll-help-details-inner">
            <p>내 투표 기록은 내 계정에서만 확인할 수 있어요.</p>
            <p>다른 회원은 누가 어떤 선택을 했는지 연결할 수 없어요. Firebase 운영자는 데이터 접근 권한으로 연결할 수 있어요.</p>
            <p>${state.closed ? '이 투표는 마감되어 새 투표와 변경을 할 수 없어요.' : '투표를 바꾸려면 먼저 취소한 뒤 다시 투표해주세요. 변경은 최대 2회이고, 취소는 각 투표 후 5분 안에 가능해요.'}</p>
            ${canClose ? '<p>작성자는 투표를 마감할 수 있어요.</p>' : ''}
        </div>
    </div>
</div><div class="poll-choices">${poll.options.map((option, index) => {
                const percent = total ? Math.round(counts[index] / total * 100) : 0;
                return `<div class="poll-choice-group"><label class="poll-choice ${selected.includes(option) ? 'is-selected' : ''}"><span class="poll-result-fill" style="width:${percent}%"></span><input type="${poll.multiple ? 'checkbox' : 'radio'}" name="poll-${escape(state.path)}" value="${index}" ${selected.includes(option) ? 'checked' : ''} ${choicesDisabled ? 'disabled' : ''}><span class="poll-choice-text">${escape(option)}</span><span class="poll-result-count">${state.loaded ? `${counts[index]}표 · ${percent}%` : '—'}</span></label>${window.pollAttachments?.renderPublished(publishedPoll, index) || ''}</div>`;
            }).join('')}</div><div class="poll-vote-footer"><span>${!user() ? '로그인하면 결과를 확인할 수 있어요.' : state.loaded ? `${total}명 참여` : state.resultsError ? '결과를 표시할 수 없어요.' : '결과 불러오는 중…'}${poll.multiple ? ' · 참여자 기준 비율' : ''}</span><div class="poll-vote-actions">${own ? '' : `<button type="button" data-vote="save" ${saveDisabled ? 'disabled' : ''}><span class="poll-vote-label">${state.showSaving ? '저장 중…' : '투표하기'}</span></button>`}${cancelButtonHtml}${canClose ? `<button type="button" data-vote="close" ${state.closing || state.saving ? 'disabled' : ''}>${state.closing ? '마감 중…' : '투표 마감'}</button>` : ''}</div></div><p class="poll-status" role="status" tabindex="-1">${escape(statusMessage)}</p>${user() && canRetry ? '<button type="button" data-vote="retry">다시 불러오기</button>' : ''}`;

            host.querySelectorAll('.poll-published-question-files, [data-poll-option-files]').forEach(node => {
                const key = node.classList.contains('poll-published-question-files') ? 'question' : node.dataset.pollOptionFiles;
                const previous = previousFiles.get(key);
                if (previous?.dataset.filesSignature === node.dataset.filesSignature) node.replaceWith(previous);
            });
            const nextStatus = host.querySelector('.poll-status');
            if (previousStatusNode && nextStatus) {
                nextStatus.replaceWith(previousStatusNode);
                previousStatusNode.textContent = statusMessage;
            }
            const retryButton = host.querySelector('[data-vote="retry"]');
            if (retryButton && !previousRetry && animateResults && !reducedMotion) {
                retryButton.classList.add('poll-retry-entering');
                retryButton.addEventListener('animationend', () => retryButton.classList.remove('poll-retry-entering'), { once: true });
            }
            const nextActions = host.querySelector('.poll-vote-actions');
            const actionSetUnchanged = previousActions && previousActionState
                && previousActionState.hadCancel === Boolean(own)
                && previousActionState.hadClose === canClose;
            if (actionSetUnchanged && nextActions) {
                nextActions.replaceWith(previousActions);
                updateVoteActionRow(previousActions, state, own, disabled, animateResults);
            } else {
                animateVoteActions(host, previousActionState, animateResults);
            }
            if (hasPainted && animateResults && !reducedMotion) animatePollHeight(host, previousHeight);
            host.dataset.pollPainted = 'true';

            const fills = Array.from(host.querySelectorAll('.poll-result-fill'));
            fills.forEach((fill, index) => {
                const nextWidth = fill.style.width;
                const previousWidth = previousWidths[index] || '0%';
                if (reducedMotion || !animateResults || previousWidth === nextWidth) return;
                fill.style.width = previousWidth;
                void fill.offsetWidth;
                requestAnimationFrame(() => {
                    if (fill.isConnected) fill.style.width = nextWidth;
                });
            });

            if (!reducedMotion && animateResults) {
                const nextCounts = Array.from(host.querySelectorAll('.poll-result-count'));
                nextCounts.forEach((count, index) => {
                    if (previousCounts[index] === undefined || previousCounts[index] === count.textContent) return;
                    count.classList.add('poll-count-updated');
                    count.addEventListener('animationend', () => count.classList.remove('poll-count-updated'), { once: true });
                });

                const status = host.querySelector('.poll-status');
                if (status && previousStatus !== undefined && previousStatus !== status.textContent && status.textContent) {
                    status.classList.add('poll-status-updated');
                    status.addEventListener('animationend', () => status.classList.remove('poll-status-updated'), { once: true });
                }
            }

            if (!reducedMotion && animateEntrance && !host.closest('.comment-item, .comment-flat-reply, .side-detail-container')) {
                host.classList.add('poll-entering');
                const clearEntrance = event => {
                    if (event.target !== host) return;
                    host.classList.remove('poll-entering');
                    host.removeEventListener('animationend', clearEntrance);
                };
                host.addEventListener('animationend', clearEntrance);
            }

            if (focusSnapshot) {
                let target = null;
                if (focusSnapshot.kind === 'choice') target = host.querySelector(`.poll-choice input[value="${focusSnapshot.index}"]`);
                else if (focusSnapshot.kind === 'vote') target = host.querySelector(`[data-vote="${focusSnapshot.action}"]`);
                else if (focusSnapshot.kind === 'status') target = host.querySelector('.poll-status');
                else if (focusSnapshot.node?.isConnected) target = focusSnapshot.node;
                if (!target || target.disabled) target = host.querySelector('.poll-status');
                target?.focus?.({ preventScroll: true });
            }
        });
    }

    function subscribePollFiles(state) {
        state.unsubscribeFiles?.();
        state.unsubscribeFiles = null;
        const poll = state.poll;
        const usesCounts = poll.optionAttachmentCounts !== undefined || poll.questionAttachmentCount !== undefined;
        if (!usesCounts) {
            state.optionFiles = poll.optionAttachments || {};
            state.questionFiles = poll.questionAttachments || [];
            return;
        }
        state.optionFiles = {};
        state.questionFiles = [];
        if (!user()) return;
        state.unsubscribeFiles = db.doc(state.path).collection('pollFiles').onSnapshot(snapshot => {
            const optionFiles = {};
            let questionFiles = [];
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (doc.id === 'question' && Array.isArray(data.files)) questionFiles = data.files;
                if (doc.id === '0' && Array.isArray(data.questionFiles)) questionFiles = data.questionFiles;
                if (data.options && typeof data.options === 'object' && !Array.isArray(data.options)) {
                    Object.assign(optionFiles, data.options);
                } else if (/^[0-9]$/.test(doc.id) && Array.isArray(data.files) && data.files.length) {
                    optionFiles[doc.id] = data.files;
                }
            });
            state.optionFiles = optionFiles;
            state.questionFiles = questionFiles;
            paint(state, false, false);
        }, error => {
            console.error('투표 첨부를 불러오지 못했어요:', error);
            state.error = '투표 첨부를 불러오지 못했어요. 결과와 투표는 계속 이용할 수 있어요.';
            paint(state, false, false);
        });
    }

    function applyOwnBallotSnapshot(state) {
        const ownVote = state.allVotes.find(vote => vote.ballotId === state.ballotId);
        state.ownVote = ownVote || null;
        state.ownVoteLoaded = true;
        if (!state.dirty && !state.saving) state.selection = [...(state.ownVote?.choices || [])];
        scheduleCancelExpiry(state);
    }

    function subscribe(state) {
        state.error = '';
        state.resultsError = '';
        state.ownVoteError = '';
        state.unsubscribe?.();
        state.unsubscribeFiles?.();
        state.unsubscribeParent?.();
        state.ballotIdLoaded = false;
        state.ownVoteLoaded = false;
        state.unsubscribe = db.doc(state.path).collection('anonymousVotes').onSnapshot(snapshot => {
            state.allVotes = snapshot.docs
                .map(doc => ({ ballotId: doc.id, ...normalizeVoteDocument(doc.data()) }));
            state.votes = state.allVotes.filter(vote => vote.choices.length > 0);
            state.loaded = true;
            state.resultsError = '';
            if (state.ballotIdLoaded) applyOwnBallotSnapshot(state);
            paint(state);
        }, error => {
            console.error('투표 결과 불러오기 실패:', error);
            state.loaded = false;
            state.resultsError = '투표 결과를 불러오지 못했어요. 다시 시도해주세요.';
            paint(state);
        });
        state.unsubscribeParent = null;
        if (user()) {
            subscribePollFiles(state);
            const account = user();
            getBallotId(state, account).then(ballotId => {
                if (user()?.uid !== account.uid || states.get(state.path) !== state) return;
                state.ballotId = ballotId;
                state.ballotIdLoaded = true;
                state.ownVoteError = '';
                applyOwnBallotSnapshot(state);
                paint(state);
            }).catch(error => {
                if (user()?.uid !== account.uid || states.get(state.path) !== state) return;
                console.error('비공개 투표 연결 정보를 읽지 못했어요:', error);
                state.ownVoteError = '내 투표 정보를 불러오지 못했어요. 다시 시도해주세요.';
                paint(state);
            });
            state.unsubscribeParent = db.doc(state.path).onSnapshot(snapshot => {
                if (!snapshot.exists) {
                    state.closed = true;
                    state.error = '투표가 마감됐어요.';
                    paint(state);
                    return;
                }
                const parent = snapshot.data();
                const closed = parent.pollClosed === true || parent.pollsDeleting === true;
                const ownerUid = parent.uid || parent.authorUid || state.ownerUid;
                if (state.closed !== closed || state.ownerUid !== ownerUid) {
                    state.closed = closed;
                    state.ownerUid = ownerUid;
                    paint(state, false, false);
                }
            }, error => console.warn('투표 상태를 불러오지 못했어요:', error));
        }
    }

    function sync() {
        scheduled = false;
        if (suspended) return;
        const active = new Map();
        document.querySelectorAll('.community-poll[data-poll-path]').forEach(host => {
            const path = host.dataset.pollPath;
            if (!active.has(path)) active.set(path, new Set());
            active.get(path).add(host);
        });
        states.forEach((state, path) => {
            if (!active.has(path)) {
                state.unsubscribe?.();
                state.unsubscribeFiles?.();
                state.unsubscribeParent?.();
                clearTimeout(state.cancelExpiryTimer);
                states.delete(path);
            }
        });
        active.forEach((nodes, path) => {
            let state = states.get(path);
            const newNodes = !state || [...nodes].some(node => !state.nodes.has(node));
            if (!state) {
                const firstNode = [...nodes][0];
                const poll = JSON.parse(firstNode.dataset.poll);
                if (validate(poll)) return;
                state = {
                    path, poll, nodes, votes: [], allVotes: [], ballotId: null, ballotIdLoaded: false,
                    helpOpen: false,
                    ownVote: null, ownVoteLoaded: false, cancelExpiryTimer: null,
                    selection: [], loaded: false, saving: false, closing: false,
                    closed: firstNode.dataset.pollClosed === 'true', ownerUid: firstNode.dataset.pollOwner || '',
                    dirty: false, error: '', resultsError: '', ownVoteError: ''
                };
                states.set(path, state);
                state.nodes = nodes;
                paint(state, true);
                subscribe(state);
                return;
            }
            state.nodes = nodes;
            const firstNode = [...nodes][0];
            state.ownerUid ||= firstNode.dataset.pollOwner || '';
            if (firstNode.dataset.pollClosed === 'true') state.closed = true;
            if (newNodes) paint(state, false, false);
        });
    }

    function scheduleSync() {
        if (scheduled || suspended) return;
        scheduled = true;
        queueMicrotask(sync);
    }

    async function closePoll(state) {
        const account = user();
        if (!account || !state.ownerUid || account.uid !== state.ownerUid || state.closed || state.closing || state.saving) return;
        if (!window.confirm('투표를 마감할까요? 마감하면 새 투표와 투표 변경을 할 수 없어요.')) return;
        state.closing = true;
        state.error = '';
        paint(state);
        try {
            await db.doc(state.path).update({
                pollClosed: true,
                pollClosedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            state.closed = true;
        } catch (error) {
            console.error('투표 마감 실패:', error);
            state.error = error.code === 'permission-denied'
                ? '투표를 마감할 권한이 없어요.'
                : '투표를 마감하지 못했어요. 연결을 확인하고 다시 시도해주세요.';
        } finally {
            state.closing = false;
            paint(state);
        }
    }

    async function vote(state, action) {
        const account = user();
        if (!account || !state.ownVoteLoaded || state.saving || state.closing || state.closed) return;
        if (action === 'cancel' && getCancelDisabledReason(state)) return;
        const choices = [...state.selection];
        if (action === 'save' && (!choices.length || (!state.poll.multiple && choices.length !== 1))) return;
        const previousOwnVote = state.ownVote ? { ...state.ownVote, choices: [...state.ownVote.choices] } : null;
        if (action === 'save' && previousOwnVote?.choices.length) return;
        state.saving = true;
        state.showSaving = false;
        state.error = '';
        paint(state);
        let savingIndicatorShownAt = 0;
        const savingIndicatorTimer = setTimeout(() => {
            if (!state.saving) return;
            state.showSaving = true;
            savingIndicatorShownAt = performance.now();
            paint(state);
        }, 300);
        try {
            const ballotId = await getBallotId(state, account, true);
            if (user()?.uid !== account.uid) throw new Error('계정이 바뀌었어요. 다시 투표해주세요.');
            state.ballotId = ballotId;
            state.ballotIdLoaded = true;
            const ref = ballotRefs(account.uid, state.path).anonymous(ballotId);
            if (action === 'cancel') {
                await ref.update({
                    choices: [],
                    cancelCount: firebase.firestore.FieldValue.increment(1),
                    votedAt: previousOwnVote.votedAt,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // 계정 전용 비공개 연결 문서가 가리키는 익명 ID로 표를 저장한다.
                await ref.set({
                    choices,
                    cancelCount: firebase.firestore.FieldValue.increment(0),
                    votedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
            if (user()?.uid === account.uid) {
                if (action === 'cancel') {
                    state.ownVote = {
                        ...previousOwnVote,
                        choices: [],
                        cancelCount: previousOwnVote.cancelCount + 1,
                        updatedAt: Date.now()
                    };
                } else {
                    const metadataKnown = state.loaded && state.ownVoteLoaded && (!previousOwnVote || previousOwnVote.metadataKnown);
                    state.ownVote = {
                        choices: [...choices],
                        cancelCount: metadataKnown ? (previousOwnVote?.cancelCount || 0) : null,
                        votedAt: metadataKnown ? Date.now() : null,
                        updatedAt: Date.now(),
                        metadataKnown
                    };
                }
                state.selection = action === 'cancel' ? [] : [...choices];
                state.dirty = false;
                scheduleCancelExpiry(state);
            }
            if (!state.loaded) state.error = action === 'cancel'
                ? '투표를 취소했어요. 결과는 아직 불러오지 못했어요.'
                : '투표는 저장됐어요. 결과는 아직 불러오지 못했어요.';
        } catch (error) {
            console.error('투표 저장 실패:', error);
            const actionVerb = action === 'cancel' ? '취소' : '저장';
            const actionNoun = action === 'cancel' ? '취소할' : '저장할';
            state.error = error.code === 'permission-denied' && action === 'cancel'
                ? '취소할 수 없어요. 제한 시간이 지났거나 취소 횟수를 모두 사용했을 수 있어요.'
                : error.code === 'permission-denied'
                    ? `투표를 ${actionNoun} 수 없어요. 로그인 상태와 삭제된 글인지 확인해주세요.`
                : `${actionVerb}하지 못했어요. 연결을 확인하고 다시 시도해주세요.`;
            if (action === 'cancel' && error.code === 'permission-denied') {
                state.ownVoteLoaded = false;
                if (state.ownVote) state.ownVote.metadataKnown = false;
                clearTimeout(state.cancelExpiryTimer);
                state.cancelExpiryTimer = null;
            }
        } finally {
            clearTimeout(savingIndicatorTimer);
            const visibleSavingTime = performance.now() - savingIndicatorShownAt;
            const savingMessageRemainder = state.error || !savingIndicatorShownAt
                ? 0
                : Math.max(0, 220 - visibleSavingTime);
            if (savingMessageRemainder) await new Promise(resolve => setTimeout(resolve, savingMessageRemainder));
            state.showSaving = false;
            state.saving = false;
            paint(state);
        }
    }

    document.addEventListener('animationend', event => {
        if (event.animationName !== 'pollCheckboxCheck') return;
        event.target.closest('.poll-choice')?.classList.remove('poll-checking');
    });

    document.addEventListener('change', event => {
        const host = event.target.closest('.community-poll');
        if (!host || !event.target.matches('.poll-choice input')) return;
        const state = states.get(host.dataset.pollPath);
        if (!state || state.saving || state.closing || state.closed || !state.ownVoteLoaded || state.ownVote?.choices?.length) return;
        state.selection = Array.from(host.querySelectorAll('.poll-choice input:checked')).map(input => state.poll.options[Number(input.value)]);
        state.dirty = true;
        // 입력 DOM을 유지해 키보드 포커스가 사라지지 않도록 한다.
        host.querySelectorAll('.poll-choice').forEach(label => {
            const input = label.querySelector('input');
            label.classList.toggle('is-selected', input.checked);
            if (input !== event.target || input.type !== 'checkbox') return;
            label.classList.remove('poll-checking');
            if (input.checked) {
                void input.offsetWidth;
                label.classList.add('poll-checking');
            }
        });
        const saveButton = host.querySelector('[data-vote="save"]');
        if (saveButton) saveButton.disabled = !state.selection.length;
    });
    document.addEventListener('click', event => {
        const edit = event.target.closest('[data-draft-edit]');
        const remove = event.target.closest('[data-draft-remove]');
        if (edit) window.openPollModal(edit.dataset.draftEdit);
        if (remove) {
            const kind = remove.dataset.draftRemove;
            const sending = document.querySelector(kind === 'post' ? '#submitPostBtn' : '.comment-submit-btn');
            if (!locked[kind] && !sending?.disabled) setDraft(kind);
        }
        const button = event.target.closest('[data-vote]');
        const host = button?.closest('.community-poll');
        const state = host && states.get(host.dataset.pollPath);
        if (!state) return;
        if (button.dataset.vote === 'retry') subscribe(state);
        else if (button.dataset.vote === 'help') {
            state.helpOpen = !state.helpOpen;
            state.nodes.forEach(pollHost => {
                const helpButton = pollHost.querySelector('[data-vote="help"]');
                const details = pollHost.querySelector('.poll-help-details');
                if (!helpButton || !details) return;
                const expanded = state.helpOpen;
                animatePollHelpButton(helpButton, expanded);
                animatePollHelpDetails(details, expanded);
            });
        }
        else if (button.dataset.vote === 'close') closePoll(state);
        else vote(state, button.dataset.vote);
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && document.body.classList.contains('poll-modal-open')) {
            event.stopImmediatePropagation();
            window.closePollModal();
        }
    }, true);
    // 상세/댓글이 좋아요·수정·답글 펼치기로 재생성되어도 같은 구독과 선택을 유지한다.
    const detail = document.getElementById('sideDetailContainer');
    if (detail) new MutationObserver(scheduleSync).observe(detail, { childList: true, subtree: true });

    window.communityPolls = {
        validate, beginDraft, attachDraft, setDraft, renderHtml, submissionErrorMessage,
        async getOwnBallotId(pollPath) {
            const account = user();
            if (!account) return null;
            const snapshot = await ballotRefs(account.uid, pollPath).mapping.get();
            return snapshot.exists ? snapshot.data().ballotId : null;
        },
        async prepareForSubmit(kind) {
            const poll = clone(drafts[kind]);
            if (!poll || locked[kind]) return poll;
            const prep = await window.pollAttachments?.prepare(kind);
            if (prep) {
                const optFiles = prep.options || prep;
                const questionFiles = prep.question || [];
                if (optFiles && Object.keys(optFiles).length) {
                    poll.optionAttachmentCounts = Object.fromEntries(Object.entries(optFiles).map(([index, files]) => [index, files.length]));
                }
                if (questionFiles.length) poll.questionAttachmentCount = questionFiles.length;
                if (Object.keys(optFiles || {}).length || questionFiles.length) {
                    Object.defineProperty(poll, '__pollFileProofs', {
                        value: { options: optFiles || {}, question: questionFiles },
                        configurable: true
                    });
                }
            }
            const error = validate(poll);
            if (error) throw new Error(error);
            return poll;
        },
        async createWithFiles(collection, data, assertContext = () => {}) {
            const check = () => {
                assertContext();
                if (user()?.uid !== data.uid) throw new Error('로그인 계정이 바뀌었어요. 다시 등록해주세요.');
            };
            check();
            const proofFiles = data.poll?.__pollFileProofs || {};
            const files = proofFiles.options || data.poll?.optionAttachments;
            const qFiles = proofFiles.question || data.poll?.questionAttachments;
            const keepsProofFiles = Boolean(data.poll?.optionAttachmentCounts || data.poll?.questionAttachmentCount);
            const hasOptionFiles = files && Object.keys(files).length > 0;
            const hasQuestionFiles = qFiles && qFiles.length > 0;
            const persistedData = data.poll ? { ...data, poll: { ...data.poll } } : { ...data };
            if (!hasOptionFiles && !hasQuestionFiles) return collection.add(persistedData);
            const signature = signatureOf(data.poll);
            const key = `${data.uid}:${collection.path}`;
            let pending = pendingCreates.get(key);
            if (!pending || pending.signature !== signature) {
                pending = { ref: collection.doc(), signature };
                pendingCreates.set(key, pending);
            }
            const { ref } = pending;
            const existing = await ref.get();
            check();
            if (existing.exists) {
                const saved = existing.data();
                if (saved.uid === data.uid && signatureOf(saved.poll) === signature
                    && ['title', 'body', 'parentId', 'categoryMain', 'categorySub'].every(field => saved[field] === data[field])) {
                    pendingCreates.delete(key); return ref;
                }
                pendingCreates.delete(key);
                return this.createWithFiles(collection, data, assertContext);
            }
            const proofs = [];
            if (keepsProofFiles) {
                const actualCounts = Object.fromEntries(Object.entries(files || {}).filter(([, attachments]) => attachments.length).map(([index, attachments]) => [index, attachments.length]));
                const expectedCounts = data.poll.optionAttachmentCounts || {};
                const sortedEntries = value => Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
                if (JSON.stringify(sortedEntries(actualCounts)) !== JSON.stringify(sortedEntries(expectedCounts))
                    || (data.poll.questionAttachmentCount || 0) !== (qFiles?.length || 0)) {
                    throw new Error('투표 첨부 개수와 파일 정보가 일치하지 않아요. 다시 첨부해주세요.');
                }
                check();
                const manifest = ref.collection('pollFiles').doc('manifest');
                await manifest.set({
                    uid: data.uid,
                    optionCount: data.poll.options.length,
                    optionAttachmentCounts: expectedCounts,
                    questionAttachmentCount: data.poll.questionAttachmentCount || 0
                });
                proofs.push(manifest);
                for (const [index, attachments] of Object.entries(files)) {
                    check();
                    const proof = ref.collection('pollFiles').doc(index);
                    await proof.set({ uid: data.uid, options: { [index]: attachments } });
                    proofs.push(proof);
                }
                if (hasQuestionFiles) {
                    check();
                    const qProof = ref.collection('pollFiles').doc('question');
                    await qProof.set({ uid: data.uid, files: qFiles });
                    proofs.push(qProof);
                }
            } else {
                if (hasOptionFiles) {
                    for (const [index, attachments] of Object.entries(files)) {
                        check();
                        const proof = ref.collection('pollFiles').doc(index);
                        const proofData = { uid: data.uid, files: attachments };
                        if (index === '0' && hasQuestionFiles) proofData.questionFiles = qFiles;
                        await proof.set(proofData);
                        proofs.push(proof);
                    }
                }
                if (hasQuestionFiles && !Object.prototype.hasOwnProperty.call(files || {}, '0')) {
                    check();
                    const qProof = ref.collection('pollFiles').doc('0');
                    await qProof.set({ uid: data.uid, files: [], questionFiles: qFiles });
                    proofs.push(qProof);
                }
            }
            check();
            await ref.set(persistedData);
            pendingCreates.delete(key);
            if (!keepsProofFiles) await Promise.allSettled(proofs.map(proof => proof.delete()));
            check();
            return ref;
        },
        getDraft: kind => clone(drafts[kind]),
        resume() { suspended = false; scheduleSync(); },
        dispose() {
            suspended = true;
            states.forEach(state => {
                state.unsubscribe?.();
                state.unsubscribeFiles?.();
                state.unsubscribeParent?.();
                clearTimeout(state.cancelExpiryTimer);
            });
            states.clear();
        },
        resetComment() { setDraft('comment'); window.closePollModal?.(); }
    };
    if (typeof auth !== 'undefined') auth.onAuthStateChanged(() => {
        pendingCreates.clear();
        states.forEach(state => {
            state.selection = [];
            state.ballotId = null;
            state.ballotIdLoaded = false;
            state.ownVote = null;
            state.ownVoteLoaded = false;
            state.resultsError = '';
            state.ownVoteError = '';
            state.dirty = false;
            clearTimeout(state.cancelExpiryTimer);
            state.cancelExpiryTimer = null;
        });
        setDraft('post');
        setDraft('comment');
        window.closePollModal?.();
        states.forEach(state => { state.loaded = false; state.votes = []; state.allVotes = []; paint(state); subscribe(state); });
    });
})();
