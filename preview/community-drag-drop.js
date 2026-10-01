// 탐색기 파일을 현재 열려 있는 커뮤니티 입력창으로 전달합니다.
(function () {
    const overlay = document.createElement('div');
    overlay.className = 'community-file-drop-overlay';
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
        <div class="community-file-drop-panel">
            <i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>
            <strong class="community-file-drop-title"></strong>
            <span>파일을 놓으면 첨부 목록에 추가돼요</span>
        </div>
    `;
    document.body.appendChild(overlay);
    const title = overlay.querySelector('.community-file-drop-title');
    let dragDepth = 0;
    let hideTimer = null;

    function hasFiles(event) {
        return Array.from(event.dataTransfer?.types || []).includes('Files') ||
            (event.type === 'drop' && event.dataTransfer?.files?.length > 0);
    }

    function destination() {
        const writePage = document.getElementById('writePostPage');
        if (writePage && !writePage.classList.contains('hidden') &&
            typeof currentPage !== 'undefined' && currentPage === writePage) return 'post';
        const detail = document.getElementById('sideDetailContainer');
        if (detail && !detail.classList.contains('detail-hidden') &&
            typeof currentPostId !== 'undefined' && currentPostId &&
            typeof currentPage !== 'undefined' && currentPage === suggestionPage) return 'comment';
        return null;
    }

    function pasteDestination(eventTarget) {
        if (!(eventTarget instanceof Element)) return null;
        if (eventTarget.id === 'postBody' && destination() === 'post') return 'post';
        if (eventTarget.matches('.side-detail-container .comment-input') && destination() === 'comment') return 'comment';
        return null;
    }

    function getPastedFiles(clipboardData) {
        if (!clipboardData) return [];
        const files = Array.from(clipboardData.files || []);
        if (files.length) return files;

        return Array.from(clipboardData.items || [])
            .filter(item => item.kind === 'file')
            .map(item => {
                try {
                    return item.getAsFile();
                } catch (error) {
                    return null;
                }
            })
            .filter(Boolean);
    }

    function show(target) {
        clearTimeout(hideTimer);
        title.textContent = target === 'post' ? '놓으면 게시글에 첨부' : '놓으면 댓글에 첨부';
        if (overlay.hidden) {
            overlay.hidden = false;
            requestAnimationFrame(() => {
                if (dragDepth > 0 && !overlay.hidden) overlay.classList.add('active');
            });
        } else {
            overlay.classList.add('active');
        }
    }

    function hide() {
        overlay.classList.remove('active');
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => { overlay.hidden = true; }, 220);
    }

    document.addEventListener('dragenter', (event) => {
        if (!hasFiles(event)) return;
        dragDepth++;
        const target = destination();
        if (target) show(target);
    }, true);

    document.addEventListener('dragover', (event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        const target = destination();
        if (event.dataTransfer) event.dataTransfer.dropEffect = target ? 'copy' : 'none';
        if (target) {
            if (dragDepth === 0) dragDepth = 1;
            show(target);
        }
        else hide();
    }, true);

    document.addEventListener('dragleave', (event) => {
        if (!hasFiles(event)) return;
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) hide();
    }, true);

    document.addEventListener('drop', async (event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.stopPropagation();
        dragDepth = 0;
        hide();
        const target = destination();
        if (!target) return;
        const files = Array.from(event.dataTransfer?.files || []);
        if (!files.length) {
            alert('파일을 찾지 못했어요. 폴더 대신 파일을 놓아 주세요.');
            return;
        }
        try {
            if (target === 'post') window.addPostFiles(files);
            else await window.addCommentFiles(files);
        } catch (error) {
            console.error('파일 끌어놓기 처리 실패:', error);
            alert('파일을 첨부하지 못했어요. 다시 시도해 주세요.');
        }
    }, true);

    document.addEventListener('paste', async (event) => {
        const target = pasteDestination(event.target);
        if (!target) return;
        const files = getPastedFiles(event.clipboardData);
        if (!files.length) return;

        event.preventDefault();
        try {
            if (target === 'post') window.addPostFiles(files);
            else await window.addCommentFiles(files);
        } catch (error) {
            console.error('파일 붙여넣기 처리 실패:', error);
            alert('파일을 첨부하지 못했어요. 다시 시도해 주세요.');
        }
    }, true);

    document.addEventListener('dragend', () => { dragDepth = 0; hide(); }, true);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') { dragDepth = 0; hide(); }
    });
    window.addEventListener('blur', () => { dragDepth = 0; hide(); });
})();
