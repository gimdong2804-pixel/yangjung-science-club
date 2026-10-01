// 투표 정의는 게시글/댓글과 함께 저장하고, 각 계정의 응답은 UID 문서 하나로 관리한다.
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

    function sameChoices(left, right) {
        return Array.isArray(left) && Array.isArray(right)
            && left.length === right.length
            && left.every(choice => right.includes(choice));
    }

    function getCancelDisabledReason(state) {
        if (state.saving) return '투표를 저장하는 동안에는 취소할 수 없어요.';
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

    function renderHtml(poll, postId, commentId = '') {
        if (validate(poll) || !/^[A-Za-z0-9_-]{1,128}$/.test(postId) || (commentId && !/^[A-Za-z0-9_-]{1,128}$/.test(commentId))) return '';
        const path = `posts/${postId}${commentId ? '/comments/' + commentId : ''}`;
        return `<div class="community-poll" data-no-double-like data-poll-path="${path}" data-poll="${escape(JSON.stringify(poll))}"></div>`;
    }

    function measureElementRect(element) {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }

    function updateVoteActionRow(actions, state, own, disabled, animate) {
        const saveButton = actions.querySelector('[data-vote="save"]');
        const label = saveButton?.querySelector('.poll-vote-label');
        const nextLabel = state.showSaving ? '저장 중…' : own ? '투표 변경' : '투표하기';
        if (label && label.textContent.trim() !== nextLabel) {
            label.textContent = nextLabel;
            if (animate && !prefersReducedMotion()) {
                label.classList.add('poll-vote-label-changing');
                label.addEventListener('animationend', () => label.classList.remove('poll-vote-label-changing'), { once: true });
            } else {
                label.classList.remove('poll-vote-label-changing');
            }
        }
        if (saveButton) saveButton.disabled = disabled || !state.selection.length
            || (own && sameChoices(state.selection, own.choices));
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
    }
    function animateVoteActions(host, previous, enabled) {
        if (!enabled || prefersReducedMotion() || !previous) return;
        const saveButton = host.querySelector('[data-vote="save"]');
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
        const disabled = state.saving || !user();
        const saveDisabled = disabled || !state.selection.length
            || (own && sameChoices(state.selection, own.choices));
        const cancelDisabledReason = own ? getCancelDisabledReason(state) : '';
        const cancelDisabled = disabled || Boolean(cancelDisabledReason);
        const cancelTooltip = cancelDisabledReason || (disabled ? '투표 처리 중에는 취소할 수 없어요.' : '');
        const cancelButtonHtml = own
            ? `<span class="poll-vote-cancel-wrap ${cancelDisabled ? 'is-disabled' : ''}" ${cancelTooltip ? `title="${escape(cancelTooltip)}"` : ''}><button type="button" data-vote="cancel" ${cancelDisabled ? 'disabled' : ''} aria-label="${escape(cancelTooltip ? `투표 취소. ${cancelTooltip}` : '투표 취소')}">투표 취소</button></span>`
            : '';
        const statusMessage = state.error
            ? [state.error, cancelDisabledReason].filter(Boolean).join(' ')
            : !user() ? '로그인 후 참여할 수 있어요.'
                : cancelDisabledReason || (own ? '내 투표가 저장됐어요.' : '');
        const selected = state.selection;
        const reducedMotion = prefersReducedMotion();
        state.nodes.forEach(host => {
            if (!host.isConnected) return;
            const hasPainted = host.dataset.pollPainted === 'true';
            let activeHeightAnimation = pollHeightAnimations.get(host);
            const previousHeight = host.getBoundingClientRect().height;
            if (reducedMotion && activeHeightAnimation) {
                stopPollHeightAnimation(host);
                activeHeightAnimation = null;
            }
            const previousWidths = Array.from(host.querySelectorAll('.poll-result-fill'), fill => fill.style.width);
            const previousFiles = new Map([...host.querySelectorAll('[data-poll-option-files]')].map(node => [node.dataset.pollOptionFiles, node]));
            const previousCounts = Array.from(host.querySelectorAll('.poll-result-count'), count => count.textContent);
            const previousStatus = host.querySelector('.poll-status')?.textContent;
            const previousRetry = Boolean(host.querySelector('[data-vote="retry"]'));
            const previousActions = host.querySelector('.poll-vote-actions');
            const previousSaveButton = host.querySelector('[data-vote="save"]');
            const previousCancelButton = host.querySelector('[data-vote="cancel"]');
            const previousActionState = previousSaveButton ? {
                label: previousSaveButton.textContent.trim(),
                saveRect: measureElementRect(previousSaveButton),
                cancelButton: previousCancelButton,
                cancelRect: measureElementRect(previousCancelButton),
                hadCancel: Boolean(previousCancelButton)
            } : null;
            host.innerHTML = `<h4>${escape(poll.question)}</h4><p class="poll-help">${poll.multiple ? '여러 항목을 선택할 수 있어요.' : '한 항목을 선택해주세요.'}</p><div class="poll-choices">${poll.options.map((option, index) => {
                const percent = total ? Math.round(counts[index] / total * 100) : 0;
                return `<div class="poll-choice-group"><label class="poll-choice ${selected.includes(option) ? 'is-selected' : ''}"><span class="poll-result-fill" style="width:${percent}%"></span><input type="${poll.multiple ? 'checkbox' : 'radio'}" name="poll-${escape(state.path)}" value="${index}" ${selected.includes(option) ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span class="poll-choice-text">${escape(option)}</span><span class="poll-result-count">${state.loaded ? `${counts[index]}표 · ${percent}%` : '—'}</span></label>${window.pollAttachments?.renderPublished(poll, index) || ''}</div>`;
            }).join('')}</div><div class="poll-vote-footer"><span>${state.loaded ? `${total}명 참여` : state.error ? '결과를 표시할 수 없어요.' : '결과 불러오는 중…'}${poll.multiple ? ' · 참여자 기준 비율' : ''}</span><div class="poll-vote-actions"><button type="button" data-vote="save" ${saveDisabled ? 'disabled' : ''}><span class="poll-vote-label">${state.showSaving ? '저장 중…' : own ? '투표 변경' : '투표하기'}</span></button>${cancelButtonHtml}</div></div><p class="poll-status" role="status">${escape(statusMessage)}</p>${state.error && !state.loaded ? '<button type="button" data-vote="retry">다시 불러오기</button>' : ''}`;

            host.querySelectorAll('[data-poll-option-files]').forEach(node => {
                const previous = previousFiles.get(node.dataset.pollOptionFiles);
                if (previous?.dataset.filesSignature === node.dataset.filesSignature) node.replaceWith(previous);
            });
            const retryButton = host.querySelector('[data-vote="retry"]');
            if (retryButton && !previousRetry && animateResults && !reducedMotion) {
                retryButton.classList.add('poll-retry-entering');
                retryButton.addEventListener('animationend', () => retryButton.classList.remove('poll-retry-entering'), { once: true });
            }
            const nextActions = host.querySelector('.poll-vote-actions');
            const actionSetUnchanged = previousActions && previousActionState
                && previousActionState.hadCancel === Boolean(own);
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
        });
    }

    function subscribe(state) {
        state.error = '';
        state.unsubscribe?.();
        state.unsubscribe = db.doc(state.path).collection('votes').onSnapshot(snapshot => {
            const votes = snapshot.docs.map(doc => ({ uid: doc.id, ...normalizeVoteDocument(doc.data()) }));
            state.votes = votes.filter(vote => vote.choices.length > 0);
            const ownVote = votes.find(vote => vote.uid === user()?.uid);
            state.ownVote = ownVote || null;
            state.ownVoteLoaded = true;
            state.loaded = true;
            state.error = '';
            if (!state.dirty && !state.saving) state.selection = [...(state.ownVote?.choices || [])];
            scheduleCancelExpiry(state);
            paint(state);
        }, error => {
            console.error('투표 결과 불러오기 실패:', error);
            state.loaded = false;
            state.error = '결과를 불러오지 못했어요. 선택 후 투표는 시도할 수 있어요.';
            paint(state);
        });
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
                clearTimeout(state.cancelExpiryTimer);
                states.delete(path);
            }
        });
        active.forEach((nodes, path) => {
            let state = states.get(path);
            const newNodes = !state || [...nodes].some(node => !state.nodes.has(node));
            if (!state) {
                const poll = JSON.parse([...nodes][0].dataset.poll);
                if (validate(poll)) return;
                state = { path, poll, nodes, votes: [], ownVote: null, ownVoteLoaded: false, cancelExpiryTimer: null, selection: [], loaded: false, saving: false, dirty: false, error: '' };
                states.set(path, state);
                state.nodes = nodes;
                paint(state, true);
                subscribe(state);
                return;
            }
            state.nodes = nodes;
            if (newNodes) paint(state, false, false);
        });
    }

    function scheduleSync() {
        if (scheduled || suspended) return;
        scheduled = true;
        queueMicrotask(sync);
    }

    async function vote(state, action) {
        const account = user();
        if (!account || state.saving) return;
        if (action === 'cancel' && getCancelDisabledReason(state)) return;
        const choices = [...state.selection];
        if (action === 'save' && (!choices.length || (!state.poll.multiple && choices.length !== 1))) return;
        const previousOwnVote = state.ownVote ? { ...state.ownVote, choices: [...state.ownVote.choices] } : null;
        if (action === 'save' && previousOwnVote?.choices.length && sameChoices(choices, previousOwnVote.choices)) return;
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
            const ref = db.doc(state.path).collection('votes').doc(account.uid);
            if (action === 'cancel') {
                await ref.update({
                    choices: [],
                    cancelCount: firebase.firestore.FieldValue.increment(1),
                    votedAt: previousOwnVote.votedAt,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // UID별 한 문서에 표를 저장해 재시도와 여러 탭의 중복 응답을 막는다.
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
                    const metadataKnown = state.ownVoteLoaded && (!previousOwnVote || previousOwnVote.metadataKnown);
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
        if (!state || state.saving) return;
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
        const own = state.ownVote?.choices?.length ? state.ownVote : null;
        host.querySelector('[data-vote="save"]').disabled = !state.selection.length
            || (own && sameChoices(state.selection, own.choices));
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
        validate, beginDraft, attachDraft, setDraft, renderHtml,
        async prepareForSubmit(kind) {
            const poll = clone(drafts[kind]);
            if (!poll || locked[kind]) return poll;
            const files = await window.pollAttachments?.prepare(kind);
            if (files && Object.keys(files).length) poll.optionAttachments = files;
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
            const files = data.poll?.optionAttachments;
            if (!files || !Object.keys(files).length) return collection.add(data);
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
            // Each proof has at most ten files; validating all 100 in one rule
            // evaluation exceeds Firestore's 1000-expression budget.
            const proofs = [];
            for (const [index, attachments] of Object.entries(files)) {
                check();
                const proof = ref.collection('pollFiles').doc(index);
                await proof.set({ uid: data.uid, files: attachments });
                proofs.push(proof);
            }
            check();
            await ref.set(data);
            pendingCreates.delete(key);
            // Parent data is immutable, so validation proofs can be removed.
            await Promise.allSettled(proofs.map(proof => proof.delete()));
            check();
            return ref;
        },
        getDraft: kind => clone(drafts[kind]),
        resume() { suspended = false; scheduleSync(); },
        dispose() {
            suspended = true;
            states.forEach(state => {
                state.unsubscribe?.();
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
            state.ownVote = null;
            state.ownVoteLoaded = false;
            state.dirty = false;
            clearTimeout(state.cancelExpiryTimer);
            state.cancelExpiryTimer = null;
        });
        setDraft('post');
        setDraft('comment');
        window.closePollModal?.();
        states.forEach(state => { state.loaded = false; state.votes = []; paint(state); subscribe(state); });
    });
})();
