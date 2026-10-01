// ==========================================================================
// 양중과학동아리 - 투표 만들기 창 UI, 부드러운 추가/삭제 애니메이션 및 커스텀 스크롤바
// ==========================================================================

(function () {
    const pollModalOverlay = document.getElementById('pollModalOverlay');
    const pollModal = document.getElementById('pollModal');
    const pollModalBody = document.querySelector('.poll-modal-body');
    const pollModalCloseBtn = document.getElementById('pollModalCloseBtn');
    const pollSubmitBtn = document.getElementById('pollSubmitBtn');
    const pollAddOptionBtn = document.getElementById('pollAddOptionBtn');
    const pollOptionsList = document.getElementById('pollOptionsList');
    const pollQuestionInput = document.getElementById('pollQuestionInput');

    const pollModalScrollbar = document.getElementById('pollModalScrollbar');
    const pollModalScrollbarThumb = document.getElementById('pollModalScrollbarThumb');

    const MAX_POLL_OPTIONS = 10;
    const MIN_POLL_OPTIONS = 2;

    let pollScrollTimeout = null;
    let isHoveringPollScrollbar = false;
    let isPollScrollDragging = false;
    let pollStartY = 0;
    let pollStartScrollTop = 0;
    let pollReturnFocus = null;
    let pollQuestionFocusTimer = null;
    const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

    // 1. 우리 앱의 모달 커스텀 스크롤바 제어 로직 (카테고리 모달 메커니즘과 100% 동일)
    function updatePollModalScrollbar() {
        if (!pollModalBody || !pollModalScrollbar || !pollModalScrollbarThumb) return;

        const modalHeader = document.querySelector('.poll-modal-header');
        const modalFooter = document.querySelector('.poll-modal-footer');
        const headerHeight = modalHeader ? modalHeader.offsetHeight : 64;
        const footerHeight = modalFooter ? modalFooter.offsetHeight : 62;

        pollModalScrollbar.style.top = `${headerHeight + 6}px`;
        pollModalScrollbar.style.bottom = `${footerHeight + 8}px`;

        const scrollHeight = pollModalBody.scrollHeight;
        const clientHeight = pollModalBody.clientHeight;
        const scrollTop = pollModalBody.scrollTop;

        const trackHeight = pollModalScrollbar.clientHeight || Math.max(10, clientHeight - 16);

        if (scrollHeight <= clientHeight + 1) {
            pollModalScrollbar.classList.remove('visible');
            pollModalScrollbarThumb.style.height = `${trackHeight}px`;
            pollModalScrollbarThumb.style.transform = 'translateY(0px)';
            return;
        }

        const thumbHeight = Math.max(30, (clientHeight / scrollHeight) * trackHeight);
        const maxScrollTop = scrollHeight - clientHeight;
        const maxThumbTop = Math.max(0, trackHeight - thumbHeight);

        const thumbTop = maxScrollTop > 0 ? (scrollTop / maxScrollTop) * maxThumbTop : 0;

        pollModalScrollbarThumb.style.height = `${thumbHeight}px`;
        pollModalScrollbarThumb.style.transform = `translateY(${thumbTop}px)`;

        pollModalScrollbar.classList.add('visible');

        clearTimeout(pollScrollTimeout);
        if (!isPollScrollDragging && !isHoveringPollScrollbar) {
            pollScrollTimeout = setTimeout(() => {
                pollModalScrollbar.classList.remove('visible');
            }, 1500);
        }
    }

    if (pollModalBody) {
        pollModalBody.addEventListener('scroll', updatePollModalScrollbar, { passive: true });
    }

    if (typeof ResizeObserver !== 'undefined' && pollModalBody) {
        const pollResizeObserver = new ResizeObserver(() => {
            updatePollModalScrollbar();
        });
        pollResizeObserver.observe(pollModalBody);
    }

    if (pollModalScrollbar) {
        pollModalScrollbar.addEventListener('mouseenter', () => {
            isHoveringPollScrollbar = true;
            pollModalScrollbar.classList.add('visible');
        });
        pollModalScrollbar.addEventListener('mouseleave', () => {
            isHoveringPollScrollbar = false;
            if (!isPollScrollDragging) {
                clearTimeout(pollScrollTimeout);
                pollScrollTimeout = setTimeout(() => {
                    pollModalScrollbar.classList.remove('visible');
                }, 1000);
            }
        });
    }

    if (pollModalScrollbarThumb) {
        pollModalScrollbarThumb.addEventListener('mousedown', (e) => {
            isPollScrollDragging = true;
            pollStartY = e.clientY;
            pollStartScrollTop = pollModalBody ? pollModalBody.scrollTop : 0;
            pollModalScrollbarThumb.classList.add('dragging');
            document.body.style.userSelect = 'none';

            const onMouseMove = (moveEvent) => {
                if (!isPollScrollDragging || !pollModalBody) return;
                const deltaY = moveEvent.clientY - pollStartY;
                const scrollHeight = pollModalBody.scrollHeight;
                const clientHeight = pollModalBody.clientHeight;
                const trackHeight = pollModalScrollbar.clientHeight || Math.max(10, clientHeight - 16);
                const thumbHeight = parseFloat(pollModalScrollbarThumb.style.height) || 30;
                const maxThumbTop = Math.max(1, trackHeight - thumbHeight);
                const maxScrollTop = scrollHeight - clientHeight;

                const scrollDelta = (deltaY / maxThumbTop) * maxScrollTop;
                pollModalBody.scrollTop = pollStartScrollTop + scrollDelta;
            };

            const onMouseUp = () => {
                if (!isPollScrollDragging) return;
                isPollScrollDragging = false;
                document.body.style.userSelect = '';
                pollModalScrollbarThumb.classList.remove('dragging');
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);

                if (!isHoveringPollScrollbar) {
                    clearTimeout(pollScrollTimeout);
                    pollScrollTimeout = setTimeout(() => {
                        pollModalScrollbar.classList.remove('visible');
                    }, 1000);
                }
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    // 2. 투표 만들기 모달 열기
    window.openPollModal = function (target = 'post') {
        if (!window.communityPolls.beginDraft(target)) return;
        clearTimeout(pollQuestionFocusTimer);
        pollReturnFocus = document.activeElement;
        if (typeof window.closeCommentAttachMenu === 'function') {
            window.closeCommentAttachMenu();
        }
        document.body.classList.add('poll-modal-open');
        history.pushState({ ...history.state, pollModal: true }, '');
        if (pollModalOverlay) pollModalOverlay.classList.add('active');
        if (pollModal) {
            pollModal.classList.add('active');
            if (pollQuestionInput) {
                pollQuestionFocusTimer = setTimeout(() => {
                    pollQuestionFocusTimer = null;
                    const focusIsStillOutside = !pollModal.contains(document.activeElement)
                        || document.activeElement === pollReturnFocus;
                    if (pollModal.classList.contains('active') && focusIsStillOutside) pollQuestionInput.focus();
                }, 150);
            }
            setTimeout(updatePollModalScrollbar, 200);
        }
    };

    // 3. 투표 만들기 모달 닫기
    window.closePollModal = function (fromPopState = false) {
        const wasOpen = pollModal?.classList.contains('active');
        clearTimeout(pollQuestionFocusTimer);
        pollQuestionFocusTimer = null;
        window.pollAttachments?.cancelEdit();
        document.body.classList.remove('poll-modal-open');
        if (pollModalOverlay) pollModalOverlay.classList.remove('active');
        if (pollModal) pollModal.classList.remove('active');
        if (wasOpen && pollReturnFocus?.isConnected) pollReturnFocus.focus();
        if (wasOpen && !fromPopState && history.state?.pollModal) {
            window._isProgrammaticBack = true;
            history.back();
        }
    };

    // 4. 선택지 항목 추가 (위에서 아래로 스르륵 부드럽게 펼쳐지는 One UI 애니메이션)
    window.addPollOption = function () {
        if (!pollOptionsList) return;
        const validRows = pollOptionsList.querySelectorAll('.poll-option-row:not(.poll-option-leaving)');
        if (validRows.length >= MAX_POLL_OPTIONS) {
            alert('선택지는 최대 ' + MAX_POLL_OPTIONS + '개까지만 추가할 수 있습니다.');
            return;
        }

        const newIndex = validRows.length + 1;
        const row = document.createElement('div');
        row.className = 'poll-option-row poll-option-enter';
        row.innerHTML = `
            <input type="text" class="poll-input poll-option-input" placeholder="선택지 ${newIndex}" aria-label="선택지 ${newIndex}" maxlength="50">
            <button type="button" class="poll-option-remove-btn" onclick="window.removePollOption(this)" title="삭제">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;
        window.pollAttachments?.decorateRow(row);

        if (prefersReducedMotion()) {
            row.classList.remove('poll-option-enter');
            pollOptionsList.appendChild(row);
            row.querySelector('.poll-option-input')?.focus();
            updatePollModalScrollbar();
            return;
        }
        
        // 애니메이션 초기 상태 세팅 (높이와 마진 모두 0)
        row.style.height = '0px';
        row.style.marginBottom = '0px';
        row.style.opacity = '0';
        row.style.transform = 'translateY(-12px) scale(0.96)';
        row.style.overflow = 'hidden';
        row.style.transition = 'none';

        pollOptionsList.appendChild(row);

        // 실제 목표 높이 측정
        row.style.height = 'auto';
        row.style.marginBottom = '0.6rem';
        const targetHeight = row.offsetHeight || 44;
        
        row.style.height = '0px';
        row.style.marginBottom = '0px';
        row.offsetHeight; // force reflow

        // 부드럽게 아래로 펼쳐지는 애니메이션 실행
        requestAnimationFrame(() => {
            row.style.transition = 'height 0.28s cubic-bezier(0.16, 1, 0.3, 1), margin-bottom 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease, transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
            row.style.height = targetHeight + 'px';
            row.style.marginBottom = '0.6rem';
            row.style.opacity = '1';
            row.style.transform = 'translateY(0) scale(1)';
        });

        setTimeout(() => {
            row.style.height = '';
            row.style.marginBottom = '';
            row.style.opacity = '';
            row.style.transform = '';
            row.style.overflow = '';
            row.style.transition = '';
            row.classList.remove('poll-option-enter');
            
            const newInput = row.querySelector('.poll-option-input');
            if (newInput && row.isConnected && pollModal?.classList.contains('active')) newInput.focus();
            updatePollModalScrollbar();
        }, 300);

        // 아래로 부드럽게 스크롤
        if (pollModalBody) {
            setTimeout(() => {
                pollModalBody.scrollTo({
                    top: pollModalBody.scrollHeight,
                    behavior: prefersReducedMotion() ? 'auto' : 'smooth'
                });
            }, 60);
        }
    };

    // 5. 선택지 항목 삭제 (높이와 간격이 완벽하게 0으로 스르륵 수축되어 끊김 없는 애니메이션)
    window.removePollOption = function (btn) {
        if (!pollOptionsList) return;
        const validRows = pollOptionsList.querySelectorAll('.poll-option-row:not(.poll-option-leaving)');
        if (validRows.length <= MIN_POLL_OPTIONS) {
            alert('선택지는 최소 ' + MIN_POLL_OPTIONS + '개 이상이어야 합니다.');
            return;
        }

        const targetRow = btn.closest('.poll-option-row');
        if (!targetRow || targetRow.classList.contains('poll-option-leaving')) return;
        window.pollAttachments?.removeRow(targetRow);

        if (prefersReducedMotion()) {
            targetRow.remove();
            pollOptionsList.querySelectorAll('.poll-option-row:not(.poll-option-leaving)').forEach((row, idx) => {
                const input = row.querySelector('.poll-option-input');
                if (input && !input.value) input.placeholder = '선택지 ' + (idx + 1);
            });
            updatePollModalScrollbar();
            return;
        }

        targetRow.classList.add('poll-option-leaving');
        const startHeight = targetRow.offsetHeight;

        // 시작 치수 고정
        targetRow.style.height = startHeight + 'px';
        targetRow.style.marginBottom = '0.6rem';
        targetRow.style.overflow = 'hidden';
        targetRow.offsetHeight; // force reflow

        // 높이와 마진을 동시에 0px로 부드럽게 수축
        requestAnimationFrame(() => {
            targetRow.style.transition = 'height 0.28s cubic-bezier(0.16, 1, 0.3, 1), margin-bottom 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease, transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
            targetRow.style.height = '0px';
            targetRow.style.marginBottom = '0px';
            targetRow.style.opacity = '0';
            targetRow.style.transform = 'translateY(-10px) scale(0.94)';
        });

        // 애니메이션 완료(280ms) 직후 남은 공간이 0px인 상태에서 안전하게 DOM 제거
        setTimeout(() => {
            targetRow.remove();
            // 남은 항목 번호(placeholder) 매끄럽게 재정렬
            pollOptionsList.querySelectorAll('.poll-option-row:not(.poll-option-leaving)').forEach((row, idx) => {
                const input = row.querySelector('.poll-option-input');
                if (input && !input.value) {
                    input.placeholder = '선택지 ' + (idx + 1);
                }
            });
            updatePollModalScrollbar();
        }, 290);
    };

    // 이벤트 리스너 연결
    const commentAttachPollBtn = document.getElementById('commentAttachPollBtn');
    if (commentAttachPollBtn) {
        commentAttachPollBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.openPollModal('comment');
        });
    }

    const postPollBtn = document.getElementById('postPollBtn');
    if (postPollBtn) {
        postPollBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.openPollModal('post');
        });
    }

    if (pollModalCloseBtn) {
        pollModalCloseBtn.addEventListener('click', () => {
            window.closePollModal();
        });
    }

    if (pollModalOverlay) {
        pollModalOverlay.addEventListener('click', () => {
            window.closePollModal();
        });
    }

    if (pollAddOptionBtn) {
        pollAddOptionBtn.addEventListener('click', () => {
            window.addPollOption();
        });
    }

    if (pollSubmitBtn) {
        pollSubmitBtn.addEventListener('click', () => {
            window.communityPolls.attachDraft();
        });
    }

    // 바깥 창으로 스크롤 번짐(체이닝) 완벽 차단
    if (pollModalBody) {
        pollModalBody.addEventListener('wheel', (e) => {
            const delta = e.deltaY;
            const scrollTop = pollModalBody.scrollTop;
            const maxScroll = pollModalBody.scrollHeight - pollModalBody.clientHeight;

            // 맨 위에서 위로 스크롤하거나, 맨 아래에서 아래로 스크롤할 때 바깥 페이지 스크롤 차단
            if ((delta < 0 && scrollTop <= 0) || (delta > 0 && scrollTop >= maxScroll)) {
                e.preventDefault();
            }
            e.stopPropagation();
        }, { passive: false });
    }

    if (pollModalOverlay) {
        pollModalOverlay.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
        pollModalOverlay.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    }

    if (pollModal) {
        pollModal.addEventListener('keydown', (event) => {
            if (window.pollAttachments?.hasPreview()) return;
            if (event.key !== 'Tab') return;
            const items = Array.from(pollModal.querySelectorAll('button, input')).filter(el => !el.disabled && el.offsetParent !== null);
            const first = items[0], last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        });
        const header = pollModal.querySelector('.poll-modal-header');
        const footer = pollModal.querySelector('.poll-modal-footer');
        if (header) header.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
        if (footer) footer.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
    }

})();
