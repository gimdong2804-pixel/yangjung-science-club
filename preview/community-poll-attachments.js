// Poll files stay outside JSON drafts until publishing. Option labels remain vote IDs.
(() => {
    'use strict';
    const MAX_FILES = 10, MAX_SIZE = 100 * 1024 * 1024;
    const kinds = ['image', 'audio', 'pdf', 'html'];
    const icons = { image: 'fa-image', audio: 'fa-microphone', pdf: 'fa-file-pdf', html: 'fa-file-code' };
    const names = { image: '사진', audio: '오디오', pdf: 'PDF', html: 'HTML' };
    const accepts = { image: 'image/*', audio: 'audio/*,.mp3,.wav,.ogg,.m4a,.aac', pdf: '.pdf,application/pdf', html: '.html,.htm,text/html' };
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const committed = { post: [], comment: [] }, revisions = { post: 0, comment: 0 };
    const entries = new Map(), rows = new Map();
    let editing = null, sequence = 0, menu = null, trigger = null, picker = null, pickContext = null;
    let consumeBack = false, previewState = null, savedPadding = null, menuHideTimer = null;
    const uid = () => typeof currentUser !== 'undefined' ? currentUser?.uid : null;
    const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const activeRows = () => [...document.querySelectorAll('#pollOptionsList .poll-option-row:not(.poll-option-leaving)')];

    function validFile(file) {
        return file && kinds.includes(file.kind) && typeof file.name === 'string' && file.name.length > 0 && file.name.length <= 255
            && typeof file.url === 'string' && file.url.length <= 2048 && /^https:\/\/[^\s]+$/i.test(file.url)
            && Number.isInteger(file.size) && file.size >= 0 && file.size <= MAX_SIZE;
    }
    function validate(poll) {
        if (poll.optionAttachments === undefined) return '';
        const map = poll.optionAttachments;
        if (!map || typeof map !== 'object' || Array.isArray(map)) return '투표 첨부 정보를 확인해주세요.';
        for (const [index, files] of Object.entries(map)) {
            if (!/^[0-9]$/.test(index) || Number(index) >= poll.options.length || !Array.isArray(files)
                || files.length > MAX_FILES || files.some(file => !validFile(file)
                    || Object.keys(file).some(key => !['kind', 'name', 'url', 'size'].includes(key)))) return '투표 첨부 정보를 확인해주세요.';
        }
        return '';
    }
    function remoteEntry(file) { return { ...file, id: `poll-file-${++sequence}`, remoteUrl: file.url }; }
    function sweep() {
        const keep = new Set([...committed.post.flat(), ...committed.comment.flat(), ...[...rows.values()].flat()].map(file => file.id));
        entries.forEach((file, id) => {
            if (keep.has(id)) return;
            if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
            entries.delete(id);
        });
    }
    function reset(kind, poll) {
        if (!(kind in committed)) return;
        if (editing === kind) cancelEdit();
        committed[kind] = (poll?.options || []).map((_, i) => (poll.optionAttachments?.[i] || []).map(file => {
            const entry = remoteEntry(file); entries.set(entry.id, entry); return entry;
        }));
        revisions[kind]++;
        sweep();
    }
    function cancelEdit() {
        closeMenu();
        rows.clear(); editing = null; pickContext = null;
        if (picker) picker.value = '';
        sweep();
    }
    function beginEdit(kind) {
        cancelEdit(); editing = kind;
        activeRows().forEach((row, i) => decorateRow(row, committed[kind][i] || []));
    }
    function commitEdit(kind) {
        committed[kind] = activeRows().map(row => [...(rows.get(row) || [])]);
        revisions[kind]++;
        cancelEdit();
    }
    function decorateRow(row, files = []) {
        const input = row.querySelector('.poll-option-input');
        if (!input) return;
        if (!row.querySelector('.poll-option-input-wrap')) {
            const wrap = document.createElement('div'); wrap.className = 'poll-option-input-wrap';
            input.before(wrap); wrap.append(input);
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'comment-attach-btn poll-option-attach-btn';
            button.innerHTML = '<i class="fa-solid fa-plus" aria-hidden="true"></i>';
            button.setAttribute('aria-haspopup', 'menu'); button.setAttribute('aria-controls', 'pollOptionAttachMenu');
            button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-label', '선택지 파일 첨부');
            wrap.append(button);
            const host = document.createElement('div'); host.className = 'poll-option-file-list'; row.append(host);
        }
        if (!rows.has(row)) rows.set(row, [...files]);
        refreshRow(row);
    }
    function serialFile(file, local = false) {
        return { kind: file.kind, name: file.name, url: file.remoteUrl || (local ? file.previewUrl : file.url), size: file.size };
    }
    function renderFiles(files, removable = false) {
        if (!files.length) return '';
        return `<div class="poll-file-grid" data-no-double-like>${files.map(file => {
            const data = serialFile(file, true);
            const attr = `data-poll-file="${escape(JSON.stringify(data))}"`;
            const image = data.kind === 'image'
                ? `<button type="button" class="poll-file-image" data-poll-file-action="preview" ${attr} aria-label="${escape(data.name)} 크게 보기"><img src="${escape(data.url)}" alt="${escape(data.name)}" loading="lazy"></button>`
                : `<i class="fa-solid ${icons[data.kind]} poll-file-icon" aria-hidden="true"></i>`;
            return `<div class="poll-file-card">${image}<span class="poll-file-name">${escape(data.name)}</span>
                ${data.kind === 'audio' ? `<audio controls preload="none" src="${escape(data.url)}" aria-label="${escape(data.name)} 재생"></audio>` : ''}
                <div class="poll-file-actions">${data.kind !== 'audio' ? `<button type="button" data-poll-file-action="preview" ${attr}>미리보기</button>` : ''}<button type="button" data-poll-file-action="download" ${attr}>다운로드</button></div>
                ${removable ? `<button type="button" class="poll-file-remove" data-poll-remove-file="${file.id}" aria-label="${escape(data.name)} 첨부 제거">×</button>` : ''}</div>`;
        }).join('')}</div>`;
    }
    function refreshRow(row) {
        const host = row.querySelector('.poll-option-file-list');
        const before = host.getBoundingClientRect().height;
        host.innerHTML = renderFiles(rows.get(row) || [], true);
        const after = host.getBoundingClientRect().height;
        if (!reduced() && host.animate && before !== after) host.animate([
            { height: `${before}px`, opacity: .4 }, { height: `${after}px`, opacity: 1 }
        ], { duration: 200, easing: 'cubic-bezier(.16,1,.3,1)' });
    }
    function renderDraft(kind, poll) {
        return poll.options.map((name, i) => {
            const files = committed[kind][i] || [];
            return files.length ? `<div class="poll-draft-option"><strong>${escape(name)}</strong>${renderFiles(files)}</div>` : '';
        }).join('');
    }
    function renderPublished(poll, i) {
        const files = poll.optionAttachments?.[i] || [];
        if (!files.length) return '';
        return `<div class="poll-published-files" data-poll-option-files="${i}" data-files-signature="${escape(JSON.stringify(files))}">${renderFiles(files)}</div>`;
    }
    async function addFiles(row, files, expectedKind) {
        if (!editing || !rows.has(row) || !row.isConnected || row.classList.contains('poll-option-leaving')) return;
        const list = rows.get(row), errors = [];
        for (const file of Array.from(files || [])) {
            const kind = typeof window.getCommunityAttachmentKind === 'function'
                ? window.getCommunityAttachmentKind(file)
                : file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio'
                    : /\.pdf$/i.test(file.name) ? 'pdf' : /\.html?$/i.test(file.name) ? 'html' : null;
            const reason = !kinds.includes(kind) || (expectedKind && kind !== expectedKind) ? '지원하는 파일 종류를 선택해주세요.'
                : file.size > MAX_SIZE ? '파일당 100MB를 넘었어요.' : list.length >= MAX_FILES ? '선택지마다 최대 10개까지 첨부할 수 있어요.' : '';
            if (reason) { errors.push(`${file.name}: ${reason}`); continue; }
            const entry = { id: `poll-file-${++sequence}`, kind, name: (file.name || '파일').slice(0, 255), size: file.size, file, previewUrl: URL.createObjectURL(file) };
            entries.set(entry.id, entry); list.push(entry);
        }
        refreshRow(row);
        if (errors.length) {
            const message = errors.join('\n');
            if (window.customAlert) void window.customAlert(message, '투표 첨부파일 확인'); else alert(message);
        }
    }
    function removeRow(row) { if (trigger?.closest('.poll-option-row') === row) closeMenu(); rows.delete(row); sweep(); }
    async function prepare(kind) {
        const revision = revisions[kind], account = uid(), snapshot = committed[kind].map(files => [...files]);
        const check = () => { if (revision !== revisions[kind] || account !== uid() || !account) throw new Error('작성 상태가 바뀌었어요. 다시 등록해주세요.'); };
        const result = {};
        for (let i = 0; i < snapshot.length; i++) {
            const files = snapshot[i];
            if (!files.length) continue;
            const uploaded = [];
            for (const file of files) {
                check();
                if (!file.remoteUrl && file.file) {
                    const upload = typeof uploadFileToActualCloud === 'function' ? uploadFileToActualCloud : window.uploadCommunityMedia;
                    if (!upload) throw new Error('공용 파일 저장소를 사용할 수 없습니다.');
                    file.remoteUrl = await upload(file.file);
                }
                check();
                const data = serialFile(file);
                if (!validFile(data)) { file.remoteUrl = ''; throw new Error(`${file.name}: 공유 파일 주소를 확인하지 못했어요.`); }
                uploaded.push(data);
            }
            result[i] = uploaded;
        }
        check();
        return result;
    }

    function ensureMenu() {
        if (menu) return;
        menu = document.createElement('div'); menu.id = 'pollOptionAttachMenu'; menu.className = 'comment-attach-menu poll-option-attach-menu';
        menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', '선택지 첨부파일 종류');
        menu.setAttribute('aria-description', '한 선택지의 파일은 모든 종류를 합쳐 최대 10개입니다.'); menu.hidden = true;
        const sourceIds = { image: 'commentAttachImageBtn', audio: 'commentAttachAudioBtn', pdf: 'commentAttachPdfBtn', html: 'commentAttachHtmlBtn' };
        const colors = { image: '#4dadf7', audio: '#51cf66', pdf: '#ff922b', html: '#cc5de8' };
        const labels = { image: '이미지', audio: '음성/오디오', pdf: 'PDF 파일', html: 'HTML 파일' };
        kinds.forEach(kind => {
            const original = document.getElementById(sourceIds[kind]);
            const item = original ? original.cloneNode(true) : document.createElement('button');
            item.removeAttribute('id'); item.removeAttribute('onclick');
            item.type = 'button'; item.className = 'comment-attach-option';
            item.setAttribute('role', 'menuitem'); item.dataset.pollPickKind = kind;
            if (!original) item.innerHTML = `<i class="fa-solid ${icons[kind]}" style="color:${colors[kind]}" aria-hidden="true"></i><span>${labels[kind]} (최대 10개, 파일당 100MB)</span>`;
            menu.append(item);
        });
        document.body.append(menu);
        picker = document.createElement('input'); picker.id = 'pollOptionFileInput'; picker.type = 'file'; picker.multiple = true; picker.hidden = true; document.body.append(picker);
        picker.addEventListener('change', () => {
            const context = pickContext; pickContext = null;
            if (context && editing === context.kind && revisions[editing] === context.revision) void addFiles(context.row, picker.files, context.fileKind);
            picker.value = '';
        });
    }
    function positionMenu() {
        if (!trigger || menu.hidden || !trigger.isConnected) return;
        const viewport = window.visualViewport;
        const leftEdge = viewport?.offsetLeft || 0, topEdge = viewport?.offsetTop || 0;
        const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
        const rect = trigger.getBoundingClientRect(), popupWidth = Math.min(menu.offsetWidth || 390, width - 16);
        const top = rect.bottom + 16;
        menu.style.width = `${popupWidth}px`;
        menu.style.left = `${Math.max(leftEdge + 8, Math.min(rect.right - popupWidth, leftEdge + width - popupWidth - 8))}px`;
        menu.style.top = `${top}px`;
        menu.style.bottom = 'auto'; menu.style.right = 'auto';
        menu.style.maxHeight = `${Math.max(40, topEdge + height - top - 8)}px`;
    }
    function closeMenu(fromPop = false, focus = false) {
        if (!trigger) return false;
        const button = trigger; trigger = null; menu.classList.remove('active');
        button.classList.remove('open'); button.setAttribute('aria-expanded', 'false');
        clearTimeout(menuHideTimer);
        menuHideTimer = setTimeout(() => { if (!trigger) menu.hidden = true; }, reduced() ? 0 : 250);
        const body = document.querySelector('.poll-modal-body');
        if (body && savedPadding !== null) body.style.paddingBottom = savedPadding;
        savedPadding = null;
        if (focus && button.isConnected) button.focus({ preventScroll: true });
        return true;
    }
    function openMenu(button) {
        ensureMenu();
        if (trigger === button) { closeMenu(false, true); return; }
        // Retarget the same history layer instead of creating a back-navigation race.
        if (trigger) { trigger.setAttribute('aria-expanded', 'false'); trigger.classList.remove('open'); }
        clearTimeout(menuHideTimer);
        trigger = button; button.classList.add('open'); button.setAttribute('aria-expanded', 'true'); menu.hidden = false;
        menu.style.width = ''; menu.style.maxHeight = '';
        const body = document.querySelector('.poll-modal-body');
        const bottom = (window.visualViewport?.offsetTop || 0) + (window.visualViewport?.height || innerHeight);
        const shortage = menu.scrollHeight + 16 - (bottom - button.getBoundingClientRect().bottom - 16);
        if (body && shortage > 0) {
            if (savedPadding === null) savedPadding = body.style.paddingBottom;
            body.style.paddingBottom = `${parseFloat(getComputedStyle(body).paddingBottom) + shortage}px`;
            body.scrollTop += shortage;
        }
        positionMenu();
        void menu.offsetHeight;
        requestAnimationFrame(() => {
            if (trigger !== button) return;
            menu.classList.add('active'); menu.querySelector('button').focus({ preventScroll: true });
        });
    }

    function closePreview(fromPop = false) {
        if (!previewState) return false;
        const state = previewState; previewState = null;
        if (state.kind === 'image') { if (typeof closeLightbox === 'function') closeLightbox(true); }
        else window.closeFilePreviewModal?.();
        document.body.classList.remove('poll-attachment-preview-open');
        if (state.button?.isConnected) state.button.focus({ preventScroll: true });
        if (!fromPop && (history.state?.pollFilePreview || history.state?.modal === 'lightbox')) { consumeBack = true; history.back(); }
        return true;
    }
    function preview(file, button) {
        if (!file || !kinds.includes(file.kind) || !/^(https:\/\/|blob:)/i.test(file.url)) return;
        const open = file.kind === 'image' ? window.openLightbox : file.kind === 'pdf' ? window.openPdfPreviewModal : window.openHtmlPreviewModal;
        if (!open || file.kind === 'audio') return;
        previewState = { kind: file.kind, button };
        document.body.classList.add('poll-attachment-preview-open');
        open(file.url, file.kind === 'image' ? {} : file.name);
        if (file.kind !== 'image') history.pushState({ ...history.state, pollFilePreview: true }, '');
        const shell = document.getElementById(file.kind === 'image' ? 'imageLightbox' : 'filePreviewModal');
        shell?.querySelector('button')?.focus({ preventScroll: true });
    }
    document.addEventListener('click', event => {
        const button = event.target.closest('.poll-option-attach-btn');
        if (button) { event.preventDefault(); event.stopImmediatePropagation(); openMenu(button); return; }
        const pick = event.target.closest('[data-poll-pick-kind]');
        if (pick && trigger) {
            event.preventDefault(); event.stopImmediatePropagation();
            pickContext = { row: trigger.closest('.poll-option-row'), kind: editing, revision: revisions[editing], fileKind: pick.dataset.pollPickKind };
            picker.accept = accepts[pick.dataset.pollPickKind]; closeMenu(false, true); picker.click(); return;
        }
        const remove = event.target.closest('[data-poll-remove-file]');
        if (remove) {
            event.preventDefault(); event.stopImmediatePropagation();
            const row = remove.closest('.poll-option-row'), list = rows.get(row);
            if (list) { rows.set(row, list.filter(file => file.id !== remove.dataset.pollRemoveFile)); refreshRow(row); sweep(); }
            return;
        }
        const action = event.target.closest('[data-poll-file-action]');
        if (action) {
            event.preventDefault(); event.stopImmediatePropagation();
            let file; try { file = JSON.parse(action.dataset.pollFile); } catch { return; }
            if (!/^(https:\/\/|blob:)/i.test(file.url)) return;
            if (action.dataset.pollFileAction === 'download') window.downloadFileAttachment?.(file.url, file.name);
            else preview(file, action);
            return;
        }
        if (trigger && !menu.contains(event.target)) closeMenu();
    }, true);
    document.addEventListener('keydown', event => {
        if (previewState) {
            if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closePreview(); }
            return;
        }
        if (!trigger) return;
        if (event.key === 'Escape' || event.key === 'Tab') { closeMenu(false, true); if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); } return; }
        const buttons = [...menu.querySelectorAll('button')];
        const index = buttons.indexOf(document.activeElement);
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault(); event.stopImmediatePropagation();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
            buttons[next].focus();
        }
    }, true);
    window.addEventListener('popstate', event => {
        if (consumeBack || window._isProgrammaticBack) {
            consumeBack = false; window._isProgrammaticBack = false;
            event.stopImmediatePropagation(); return;
        }
        if (closePreview(true)) { event.stopImmediatePropagation(); return; }
        if (closeMenu(true, true)) {
            history.pushState({ ...event.state, pollModal: true }, '');
            event.stopImmediatePropagation(); return;
        }
        if (document.body.classList.contains('poll-modal-open')) { window.closePollModal?.(true); event.stopImmediatePropagation(); }
    }, true);
    document.addEventListener('scroll', positionMenu, true);
    window.addEventListener('resize', positionMenu);
    window.visualViewport?.addEventListener('resize', positionMenu);
    window.visualViewport?.addEventListener('scroll', positionMenu);
    new MutationObserver(() => {
        if (!previewState) return;
        const shell = document.getElementById(previewState.kind === 'image' ? 'imageLightbox' : 'filePreviewModal');
        if (shell && !shell.classList.contains('active')) closePreview();
    }).observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });

    window.pollAttachments = { validate, reset, beginEdit, commitEdit, cancelEdit, decorateRow, removeRow, addFiles, prepare,
        renderDraft, renderPublished, closeMenu, closePreview, hasPreview: () => Boolean(previewState) };
})();
