// Poll files stay outside JSON drafts until publishing. Option labels remain vote IDs.
(() => {
    'use strict';
    const MAX_FILES = 10, MAX_TOTAL_FILES = 100, MAX_SIZE = 100 * 1024 * 1024;
    const kinds = ['image', 'youtube', 'audio', 'pdf', 'html'];
    const icons = { image: 'fa-image', youtube: 'fa-brands fa-youtube', audio: 'fa-microphone', pdf: 'fa-file-pdf', html: 'fa-file-code' };
    const names = { image: '사진', youtube: '동영상', audio: '오디오', pdf: 'PDF', html: 'HTML' };
    const colors = { image: '#4dadf7', youtube: '#ff0000', audio: '#51cf66', pdf: '#ff922b', html: '#cc5de8' };
    const labels = { image: '이미지', youtube: '동영상 (유튜브 링크)', audio: '음성/오디오', pdf: 'PDF 파일', html: 'HTML 파일' };
    const accepts = { image: 'image/*', audio: 'audio/*,.mp3,.wav,.ogg,.m4a,.aac', pdf: '.pdf,application/pdf', html: '.html,.htm,text/html' };
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const committed = { post: [], comment: [] };
    const committedQuestion = { post: [], comment: [] };
    const pausedEdits = { post: null, comment: null };
    const revisions = { post: 0, comment: 0 };
    const entries = new Map(), rows = new Map();
    let questionFiles = [];
    let editing = null, sequence = 0, menu = null, trigger = null, picker = null, pickContext = null;
    let consumeBack = false, previewState = null, savedPadding = null, menuHideTimer = null;
    let youtubeManager = null;
    const uid = () => typeof currentUser !== 'undefined' ? currentUser?.uid : null;
    const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const activeRows = () => [...document.querySelectorAll('#pollOptionsList .poll-option-row:not(.poll-option-leaving)')];
    const totalFileCount = () => [...rows.values()].reduce((total, files) => total + files.length, 0) + questionFiles.length;

    function validFile(file) {
        if (!file || !kinds.includes(file.kind)) return false;
        if (typeof file.name !== 'string' || file.name.length === 0 || file.name.length > 255) return false;
        if (typeof file.url !== 'string' || file.url.length > 2048 || !/^https:\/\/[^\s]+$/i.test(file.url)) return false;
        if (file.kind === 'youtube') {
            const videoId = typeof window.extractYoutubeVideoId === 'function' ? window.extractYoutubeVideoId(file.url) : null;
            return Boolean(videoId);
        }
        return Number.isInteger(file.size) && file.size >= 0 && file.size <= MAX_SIZE;
    }

    function validate(poll) {
        if (poll.optionAttachmentCounts !== undefined || poll.questionAttachmentCount !== undefined) {
            return validateCounts(poll);
        }
        let totalFiles = 0;
        if (poll.optionAttachments !== undefined) {
            const map = poll.optionAttachments;
            if (!map || typeof map !== 'object' || Array.isArray(map)) return '투표 첨부 정보를 확인해주세요.';
            for (const [index, files] of Object.entries(map)) {
                if (!/^[0-9]$/.test(index) || Number(index) >= poll.options.length || !Array.isArray(files)
                    || files.length > MAX_FILES || files.some(file => !validFile(file)
                        || Object.keys(file).some(key => !['kind', 'name', 'url', 'size'].includes(key)))) return '투표 첨부 정보를 확인해주세요.';
                totalFiles += files.length;
            }
        }
        if (poll.questionAttachments !== undefined) {
            const qFiles = poll.questionAttachments;
            if (!Array.isArray(qFiles) || qFiles.length > MAX_FILES || qFiles.some(file => !validFile(file)
                || Object.keys(file).some(key => !['kind', 'name', 'url', 'size'].includes(key)))) return '투표 제목 첨부 정보를 확인해주세요.';
            totalFiles += qFiles.length;
        }
        if (totalFiles > MAX_TOTAL_FILES) return '투표 전체 첨부는 최대 100개까지 가능해요.';
        return '';
    }

    function validateCounts(poll) {
        if (poll.optionAttachments !== undefined || poll.questionAttachments !== undefined) return '투표 첨부 정보가 서로 겹쳐요.';
        let totalFiles = 0;
        if (poll.optionAttachmentCounts !== undefined) {
            const counts = poll.optionAttachmentCounts;
            if (!counts || typeof counts !== 'object' || Array.isArray(counts)) return '투표 첨부 정보를 확인해주세요.';
            for (const [index, count] of Object.entries(counts)) {
                if (!/^[0-9]$/.test(index) || Number(index) >= poll.options.length
                    || !Number.isInteger(count) || count < 1 || count > MAX_FILES) return '투표 첨부 정보를 확인해주세요.';
                totalFiles += count;
            }
        }
        if (poll.questionAttachmentCount !== undefined) {
            if (!Number.isInteger(poll.questionAttachmentCount) || poll.questionAttachmentCount < 1 || poll.questionAttachmentCount > MAX_FILES) {
                return '투표 제목 첨부 정보를 확인해주세요.';
            }
            totalFiles += poll.questionAttachmentCount;
        }
        if (totalFiles > MAX_TOTAL_FILES) return '투표 전체 첨부는 최대 100개까지 가능해요.';
        return '';
    }

    function remoteEntry(file) { return { ...file, id: `poll-file-${++sequence}`, remoteUrl: file.url }; }

    function sweep() {
        const keep = new Set([
            ...committed.post.flat(),
            ...committed.comment.flat(),
            ...committedQuestion.post,
            ...committedQuestion.comment,
            ...Object.values(pausedEdits).filter(Boolean).flatMap(edit => [...edit.options.flat(), ...edit.question]),
            ...[...rows.values()].flat(),
            ...questionFiles
        ].map(file => file.id));
        entries.forEach((file, id) => {
            if (keep.has(id)) return;
            if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
            entries.delete(id);
        });
    }

    function reset(kind, poll) {
        if (!(kind in committed)) return;
        pausedEdits[kind] = null;
        if (editing === kind) cancelEdit();
        committed[kind] = (poll?.options || []).map((_, i) => (poll.optionAttachments?.[i] || []).map(file => {
            const entry = remoteEntry(file); entries.set(entry.id, entry); return entry;
        }));
        committedQuestion[kind] = (poll?.questionAttachments || []).map(file => {
            const entry = remoteEntry(file); entries.set(entry.id, entry); return entry;
        });
        revisions[kind]++;
        sweep();
    }

    function cancelEdit() {
        closeYoutubeManager(true);
        closeMenu();
        rows.clear();
        questionFiles = [];
        editing = null;
        pickContext = null;
        refreshQuestionRow();
        if (picker) picker.value = '';
        sweep();
    }

    function beginEdit(kind) {
        const paused = pausedEdits[kind];
        cancelEdit(); editing = kind;
        questionFiles = [...(paused?.question || committedQuestion[kind] || [])];
        refreshQuestionRow();
        activeRows().forEach((row, i) => decorateRow(row, (paused?.options || committed[kind])[i] || []));
        pausedEdits[kind] = null;
        sweep();
    }

    function pauseEdit(kind) {
        if (editing !== kind) return;
        pausedEdits[kind] = {
            options: activeRows().map(row => [...(rows.get(row) || [])]),
            question: [...questionFiles]
        };
    }

    function commitEdit(kind) {
        pausedEdits[kind] = null;
        committed[kind] = activeRows().map(row => [...(rows.get(row) || [])]);
        committedQuestion[kind] = [...questionFiles];
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
        // 게시된 첨부에는 미리보기 주소가 없으므로 저장된 url을 사용합니다.
        const url = file.remoteUrl || (local ? file.previewUrl : '') || file.url;
        return { kind: file.kind, name: file.name, url, size: file.size };
    }

    function renderFiles(files, removable = false, target = 'option') {
        if (!files.length) return '';
        return `<div class="poll-file-grid" data-no-double-like>${files.map(file => {
            const data = serialFile(file, true);
            const attr = `data-poll-file="${escape(JSON.stringify(data))}"`;
            if (data.kind === 'youtube') {
                const videoId = typeof window.extractYoutubeVideoId === 'function' ? window.extractYoutubeVideoId(data.url) : null;
                const thumb = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
                return `<div class="poll-file-card poll-file-youtube-card youtube-card">
                    <a href="${escape(data.url)}" target="_blank" rel="noopener noreferrer" aria-label="YouTube에서 동영상 재생">
                        <div class="poll-file-youtube-thumb">
                            <img src="${escape(thumb)}" alt="유튜브 동영상 썸네일" loading="lazy">
                            <div class="poll-file-youtube-play" aria-hidden="true"><i class="fa-solid fa-play"></i></div>
                        </div>
                        <div class="youtube-card-footer">
                            <span style="display:flex;align-items:center;gap:5px;"><i class="fa-brands fa-youtube" style="color:#ff0000;font-size:1rem;" aria-hidden="true"></i> YouTube에서 재생</span>
                            <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.75rem;opacity:0.8;" aria-hidden="true"></i>
                        </div>
                    </a>
                    ${removable ? `<button type="button" class="poll-file-remove" data-poll-remove-file="${file.id}" data-poll-target="${target}" aria-label="첨부 제거">×</button>` : ''}
                </div>`;
            }
            const image = data.kind === 'image'
                ? `<button type="button" class="poll-file-image" data-poll-file-action="preview" ${attr} aria-label="${escape(data.name)} 크게 보기"><img src="${escape(data.url)}" alt="${escape(data.name)}" loading="lazy"></button>`
                : `<i class="fa-solid ${icons[data.kind]} poll-file-icon" aria-hidden="true"></i>`;
            return `<div class="poll-file-card">${image}<span class="poll-file-name">${escape(data.name)}</span>
                ${data.kind === 'audio' ? `<audio controls preload="none" src="${escape(data.url)}" aria-label="${escape(data.name)} 재생"></audio>` : ''}
                <div class="poll-file-actions">${data.kind !== 'audio' ? `<button type="button" data-poll-file-action="preview" ${attr}>미리보기</button>` : ''}<button type="button" data-poll-file-action="download" ${attr}>다운로드</button></div>
                ${removable ? `<button type="button" class="poll-file-remove" data-poll-remove-file="${file.id}" data-poll-target="${target}" aria-label="${escape(data.name)} 첨부 제거">×</button>` : ''}</div>`;
        }).join('')}</div>`;
    }

    function refreshRow(row) {
        const host = row.querySelector('.poll-option-file-list');
        if (!host) return;
        const before = host.getBoundingClientRect().height;
        host.innerHTML = renderFiles(rows.get(row) || [], true, 'option');
        const after = host.getBoundingClientRect().height;
        if (!reduced() && host.animate && before !== after) host.animate([
            { height: `${before}px`, opacity: .4 }, { height: `${after}px`, opacity: 1 }
        ], { duration: 200, easing: 'cubic-bezier(.16,1,.3,1)' });
    }

    function refreshQuestionRow() {
        const host = document.getElementById('pollQuestionFileList');
        if (!host) return;
        const before = host.getBoundingClientRect().height;
        host.innerHTML = renderFiles(questionFiles, true, 'question');
        const after = host.getBoundingClientRect().height;
        if (!reduced() && host.animate && before !== after) host.animate([
            { height: `${before}px`, opacity: .4 }, { height: `${after}px`, opacity: 1 }
        ], { duration: 200, easing: 'cubic-bezier(.16,1,.3,1)' });
    }

    function renderDraft(kind, poll) {
        const qFiles = committedQuestion[kind] || [];
        const qHtml = qFiles.length ? `<div class="poll-draft-question-attachments">${renderFiles(qFiles)}</div>` : '';
        const optHtml = poll.options.map((name, i) => {
            const files = committed[kind][i] || [];
            return files.length ? `<div class="poll-draft-option"><strong>${escape(name)}</strong>${renderFiles(files)}</div>` : '';
        }).join('');
        return qHtml + optHtml;
    }

    function renderPublishedQuestion(poll) {
        const files = poll.questionAttachments || [];
        if (!files.length) return '';
        return `<div class="poll-published-question-files" data-files-signature="${escape(JSON.stringify(files))}">${renderFiles(files)}</div>`;
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
                : file.size > MAX_SIZE ? '파일당 100MB를 넘었어요.'
                    : list.length >= MAX_FILES ? '선택지마다 최대 10개까지 첨부할 수 있어요.'
                        : totalFileCount() >= MAX_TOTAL_FILES ? '투표 전체 첨부는 최대 100개까지 가능해요.' : '';
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

    async function addQuestionFiles(files, expectedKind) {
        if (!editing) return;
        const list = questionFiles, errors = [];
        for (const file of Array.from(files || [])) {
            const kind = typeof window.getCommunityAttachmentKind === 'function'
                ? window.getCommunityAttachmentKind(file)
                : file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio'
                    : /\.pdf$/i.test(file.name) ? 'pdf' : /\.html?$/i.test(file.name) ? 'html' : null;
            const reason = !kinds.includes(kind) || (expectedKind && kind !== expectedKind) ? '지원하는 파일 종류를 선택해주세요.'
                : file.size > MAX_SIZE ? '파일당 100MB를 넘었어요.'
                    : list.length >= MAX_FILES ? '질문에는 최대 10개까지 첨부할 수 있어요.'
                        : totalFileCount() >= MAX_TOTAL_FILES ? '투표 전체 첨부는 최대 100개까지 가능해요.' : '';
            if (reason) { errors.push(`${file.name}: ${reason}`); continue; }
            const entry = { id: `poll-file-${++sequence}`, kind, name: (file.name || '파일').slice(0, 255), size: file.size, file, previewUrl: URL.createObjectURL(file) };
            entries.set(entry.id, entry); list.push(entry);
        }
        refreshQuestionRow();
        if (errors.length) {
            const message = errors.join('\n');
            if (window.customAlert) void window.customAlert(message, '투표 첨부파일 확인'); else alert(message);
        }
    }

    function ensureYoutubeModal() {
        let overlay = document.getElementById('pollYoutubeModalOverlay');
        let modal = document.getElementById('pollYoutubeModal');
        if (!modal) {
            overlay = document.createElement('div');
            overlay.id = 'pollYoutubeModalOverlay';
            overlay.className = 'modal-overlay';
            overlay.style.zIndex = '10035';
            modal = document.createElement('div');
            modal.id = 'pollYoutubeModal';
            modal.className = 'modal-container';
            modal.style.zIndex = '10036';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'pollYoutubeTitle');
            modal.innerHTML = [
                '<div class="poll-youtube-manager-header">',
                '<h3 id="pollYoutubeTitle"><i class="fa-brands fa-youtube" aria-hidden="true"></i> 유튜브 동영상 첨부</h3>',
                '<button type="button" class="close-btn poll-modal-close-btn poll-youtube-close-btn" aria-label="닫기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>',
                '</div>',
                '<div class="poll-youtube-manager-body">',
                '<p id="pollYoutubeHelp" class="poll-youtube-help">링크를 쉼표(,)로 구분하면 여러 영상을 한 번에 추가할 수 있어요. 제목·각 선택지마다 최대 10개, 투표 전체 최대 100개까지 첨부할 수 있어요.</p>',
                '<div class="poll-youtube-entry">',
                '<textarea id="pollYoutubeUrlInput" class="poll-input" rows="2" aria-label="추가할 유튜브 링크" aria-describedby="pollYoutubeHelp pollYoutubeWarning" placeholder="유튜브 링크, 유튜브 링크, 유튜브 링크"></textarea>',
                '<button type="button" id="pollYoutubeAddBtn" class="poll-youtube-add-btn"><i class="fa-solid fa-plus" aria-hidden="true"></i> 추가</button>',
                '</div>',
                '<p id="pollYoutubeWarning" class="poll-youtube-warning" role="alert" aria-hidden="true"></p>',
                '<div class="poll-youtube-list-heading"><strong>추가한 영상</strong><span id="pollYoutubeCount" aria-live="polite"></span></div>',
                '<div id="pollYoutubeVideoList" class="poll-youtube-video-list" aria-label="추가한 영상 목록"></div>',
                '</div>',
                '<div class="poll-youtube-manager-footer">',
                '<button type="button" id="pollYoutubeCancelBtn" class="poll-youtube-cancel-btn">취소</button>',
                '<button type="button" id="pollYoutubeConfirmBtn" class="poll-youtube-done-btn"><i class="fa-solid fa-check" aria-hidden="true"></i> 첨부 완료</button>',
                '</div>'
            ].join('');
            document.body.append(overlay, modal);
        }
        return { overlay, modal };
    }

    function parseYoutubeLinks(raw, remaining) {
        const parts = String(raw).split(/[,，\r\n]+/).map(value => value.trim()).filter(Boolean);
        if (!parts.length) throw new Error('추가할 유튜브 링크를 입력해주세요.');
        if (parts.length > remaining) {
            throw new Error('이 질문 또는 선택지에는 최대 10개, 투표 전체에는 최대 100개까지 첨부할 수 있어요. 지금은 ' + remaining + '개 더 추가할 수 있어요. 링크 개수를 줄여주세요.');
        }
        return parts.map((link, index) => {
            let parsed;
            try { parsed = new URL(link); } catch { /* 아래에서 한국어 안내 */ }
            const allowedHost = parsed && /^(?:(?:www|m|music)\.)?youtube\.com$|^youtu\.be$/i.test(parsed.hostname);
            const videoId = allowedHost && ['https:', 'http:'].includes(parsed.protocol)
                && !parsed.username && !parsed.password
                && typeof window.extractYoutubeVideoId === 'function'
                ? window.extractYoutubeVideoId(parsed.href) : null;
            if (!videoId) throw new Error((index + 1) + '번째 링크가 올바른 YouTube 영상 주소가 아니에요. 링크를 확인해주세요.');
            return 'https://www.youtube.com/watch?v=' + videoId;
        });
    }

    function closeYoutubeManager(fromPop = false) {
        if (!youtubeManager) return false;
        const state = youtubeManager;
        youtubeManager = null;
        state.modal.classList.remove('active');
        state.overlay.classList.remove('active');
        state.cleanup();
        if (state.returnFocus?.isConnected) state.returnFocus.focus({ preventScroll: true });
        if (!fromPop && history.state?.pollYoutubeManager) {
            consumeBack = true;
            window._isProgrammaticBack = true;
            history.back();
        }
        return true;
    }

    function promptYoutubeUrl(isQuestion, row, returnFocus) {
        const original = isQuestion ? questionFiles : rows.get(row);
        if (!original || !editing) return;
        const { overlay, modal } = ensureYoutubeModal();
        const input = modal.querySelector('#pollYoutubeUrlInput');
        const addBtn = modal.querySelector('#pollYoutubeAddBtn');
        const confirmBtn = modal.querySelector('#pollYoutubeConfirmBtn');
        const cancelBtn = modal.querySelector('#pollYoutubeCancelBtn');
        const closeBtn = modal.querySelector('.poll-youtube-close-btn');
        const listHost = modal.querySelector('#pollYoutubeVideoList');
        const countHost = modal.querySelector('#pollYoutubeCount');
        const warning = modal.querySelector('#pollYoutubeWarning');
        const isMobile = () => window.matchMedia('(max-width: 767px), (orientation: landscape) and (max-height: 550px) and (hover: none)').matches;
        const viewport = window.visualViewport;
        // Keep the header/footer inside the visible area when a phone keyboard opens.
        const syncViewport = () => {
            if (isMobile() && viewport && viewport.scale === 1) {
                modal.style.setProperty('--poll-youtube-height', viewport.height + 'px');
                modal.style.setProperty('--poll-youtube-top', viewport.offsetTop + 'px');
            } else {
                modal.style.removeProperty('--poll-youtube-height');
                modal.style.removeProperty('--poll-youtube-top');
            }
        };
        const videos = original.filter(file => file.kind === 'youtube');
        const otherCount = original.length - videos.length;
        const otherPollFileCount = totalFileCount() - original.length;
        const kind = editing, revision = revisions[kind], account = uid();
        let warningTimer = null;
        const clearWarningTimer = () => {
            if (warningTimer) { clearTimeout(warningTimer); warningTimer = null; }
        };
        const hideWarning = () => {
            clearWarningTimer();
            warning.classList.remove('active');
            warning.setAttribute('aria-hidden', 'true');
        };
        const showWarning = message => {
            clearWarningTimer();
            if (!message) {
                hideWarning();
                return;
            }
            warning.textContent = message;
            warning.removeAttribute('hidden');
            warning.setAttribute('aria-hidden', 'false');
            warning.classList.remove('active');
            void warning.offsetHeight;
            warning.classList.add('active');

            warningTimer = setTimeout(() => {
                hideWarning();
            }, 5000);
        };
        const cards = new Map(), animations = new Set();
        const grid = document.createElement('div');
        grid.className = 'poll-file-grid';
        const empty = document.createElement('div');
        empty.className = 'poll-youtube-empty';
        empty.innerHTML = '<i class="fa-brands fa-youtube" aria-hidden="true"></i><p>아직 추가된 영상이 없어요.</p><span>위에 링크를 입력해서 추가해보세요.</span>';
        listHost.replaceChildren(grid, empty);
        listHost.scrollLeft = 0;
        listHost.scrollTop = 0;
        modal.querySelector('.poll-youtube-manager-body').scrollTop = 0;
        const stopAnimations = () => {
            animations.forEach(item => {
                item.animation.onfinish = null;
                item.animation.cancel();
                item.finish();
            });
            animations.clear();
            listHost.classList.remove('poll-youtube-transition-clipped');
        };
        const play = (element, frames, duration, delay = 0, finish = () => {}) => {
            const animation = element.animate(frames, {
                duration, delay, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both'
            });
            const item = { animation, finish };
            animations.add(item);
            animation.onfinish = () => {
                animations.delete(item);
                animation.cancel();
                finish();
                if (!animations.size) listHost.classList.remove('poll-youtube-transition-clipped');
            };
        };
        const render = (animate = true, revealId = null) => {
            // Read current visual positions before interrupting a previous transition.
            const previous = new Map([...cards].map(([id, card]) => [id, {
                rect: card.getBoundingClientRect(), opacity: getComputedStyle(card).opacity
            }]));
            const oldEmpty = !empty.hidden ? empty.getBoundingClientRect() : null;
            const oldHeight = grid.getBoundingClientRect().height;
            const hostRect = listHost.getBoundingClientRect();
            const scrollTop = listHost.scrollTop;
            const scrollLeft = listHost.scrollLeft;
            const mobile = isMobile();
            const wasScrollable = listHost.scrollHeight > listHost.clientHeight + 1
                && !listHost.classList.contains('poll-youtube-transition-clipped');
            stopAnimations();
            animate = animate && !reduced() && typeof listHost.animate === 'function';
            const leave = (element, snapshot) => {
                if (!animate) { element.remove(); return; }
                element.classList.add('poll-youtube-leaving');
                element.inert = true;
                element.setAttribute('aria-hidden', 'true');
                Object.assign(element.style, {
                    left: (snapshot.rect.left - hostRect.left + scrollLeft) + 'px',
                    top: (snapshot.rect.top - hostRect.top + scrollTop) + 'px',
                    width: snapshot.rect.width + 'px', height: snapshot.rect.height + 'px'
                });
                listHost.append(element);
                play(element, [
                    { opacity: snapshot.opacity, transform: 'translateY(0) scale(1)' },
                    { opacity: 0, transform: 'translateY(-8px) scale(.96)' }
                ], 180, 0, () => element.remove());
            };
            const ids = new Set(videos.map(file => file.id));
            cards.forEach((card, id) => {
                if (ids.has(id)) return;
                cards.delete(id);
                leave(card, previous.get(id));
            });
            if (oldEmpty && videos.length && animate) {
                leave(empty.cloneNode(true), { rect: oldEmpty, opacity: getComputedStyle(empty).opacity });
            }
            videos.forEach((file, index) => {
                let card = cards.get(file.id);
                if (!card) {
                    const template = document.createElement('template');
                    template.innerHTML = renderFiles([file]);
                    card = template.content.querySelector('.poll-file-youtube-card');
                    card.dataset.pollYoutubeId = file.id;
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'poll-youtube-remove';
                    button.dataset.pollYoutubeRemove = file.id;
                    button.textContent = '×';
                    card.append(button);
                    cards.set(file.id, card);
                    grid.append(card);
                }
                card.querySelector('.poll-youtube-remove').setAttribute('aria-label', (index + 1) + '번째 영상 삭제');
            });
            grid.hidden = !videos.length;
            empty.hidden = Boolean(videos.length);
            const groupRemaining = MAX_FILES - otherCount - videos.length;
            const pollRemaining = MAX_TOTAL_FILES - otherPollFileCount - otherCount - videos.length;
            countHost.textContent = '영상 ' + videos.length + ' / 10 · 남은 첨부 자리 ' + Math.max(0, Math.min(groupRemaining, pollRemaining)) + '개';
            if (mobile) {
                const padding = getComputedStyle(listHost);
                const leftPadding = parseFloat(padding.paddingLeft) || 0;
                const rightPadding = parseFloat(padding.paddingRight) || 0;
                // Measure the real grid: departing cards can temporarily extend scrollWidth.
                const gridRight = grid.offsetLeft + grid.offsetWidth + rightPadding;
                const maxLeft = videos.length ? Math.max(0, gridRight - listHost.clientWidth) : 0;
                let targetLeft = Math.min(scrollLeft, maxLeft);
                const reveal = cards.get(revealId);
                if (reveal) {
                    const rect = reveal.getBoundingClientRect();
                    const left = rect.left - hostRect.left + listHost.scrollLeft;
                    const right = left + rect.width;
                    if (right > targetLeft + listHost.clientWidth - rightPadding) {
                        targetLeft = right - listHost.clientWidth + rightPadding;
                    }
                    if (left < targetLeft + leftPadding) targetLeft = left - leftPadding;
                }
                listHost.scrollLeft = Math.max(0, Math.min(targetLeft, maxLeft));
                listHost.scrollTop = 0;
            }
            if (!animate) return;
            // Clip motion overshoot only when the actual content fits the viewport.
            const content = videos.length ? grid : empty;
            const padding = getComputedStyle(listHost);
            const contentHeight = content.offsetHeight + parseFloat(padding.paddingTop) + parseFloat(padding.paddingBottom);
            if (!mobile && !wasScrollable && contentHeight <= listHost.clientHeight + 1) {
                listHost.classList.add('poll-youtube-transition-clipped');
            }
            let added = 0;
            cards.forEach((card, id) => {
                const before = previous.get(id);
                if (!before) {
                    play(card, [
                        { opacity: 0, transform: 'translateY(12px) scale(.98)' },
                        { opacity: 1, transform: 'translateY(0) scale(1)' }
                    ], 280, (oldEmpty ? 50 : 0) + Math.min(added++ * 30, 120));
                    return;
                }
                const after = card.getBoundingClientRect();
                const dx = before.rect.left - (listHost.scrollLeft - scrollLeft) - after.left;
                const dy = before.rect.top - (listHost.scrollTop - scrollTop) - after.top;
                if (Math.abs(dx) > .5 || Math.abs(dy) > .5 || Number(before.opacity) < 1) {
                    play(card, [
                        { opacity: before.opacity, transform: 'translate(' + dx + 'px,' + dy + 'px)' },
                        { opacity: 1, transform: 'translate(0,0)' }
                    ], 260);
                }
            });
            const height = grid.getBoundingClientRect().height;
            if (!mobile && oldHeight && height && oldHeight !== height) {
                play(grid, [{ height: oldHeight + 'px' }, { height: height + 'px' }], 260);
            }
            if (!videos.length && !oldEmpty) {
                play(empty, [
                    { opacity: 0 },
                    { opacity: 1 }
                ], 220, 80);
            }
            if (!mobile) listHost.scrollTop = scrollTop;
        };
        const onAdd = () => {
            try {
                const groupRemaining = MAX_FILES - otherCount - videos.length;
                const pollRemaining = MAX_TOTAL_FILES - otherPollFileCount - otherCount - videos.length;
                const urls = parseYoutubeLinks(input.value, Math.max(0, Math.min(groupRemaining, pollRemaining)));
                const firstAdded = videos.length;
                urls.forEach(url => videos.push({
                    id: 'poll-file-' + (++sequence), kind: 'youtube', name: 'YouTube 동영상', size: 0, url, remoteUrl: url
                }));
                input.value = '';
                showWarning('');
                render(true, videos[firstAdded].id);
                if (!isMobile()) input.focus();
                return true;
            } catch (error) { showWarning(error.message); return false; }
        };
        const onRemove = event => {
            const button = event.target.closest('[data-poll-youtube-remove]');
            if (!button || !grid.contains(button)) return;
            const index = videos.findIndex(file => file.id === button.dataset.pollYoutubeRemove);
            if (index < 0) return;
            videos.splice(index, 1);
            showWarning('');
            render();
            const next = grid.querySelectorAll('.poll-youtube-remove')[Math.min(index, videos.length - 1)];
            if (next) next.focus({ preventScroll: true });
            else if (isMobile()) closeBtn.focus({ preventScroll: true });
            else input.focus();
        };
        const onDone = () => {
            const current = isQuestion ? questionFiles : rows.get(row);
            if (editing !== kind || revisions[kind] !== revision || uid() !== account || !account
                || !current || (!isQuestion && !row.isConnected)) {
                showWarning('작성 상태가 바뀌었어요. 창을 닫고 다시 첨부해주세요.');
                return;
            }
            if (input.value.trim() && !onAdd()) return;
            const next = current.filter(file => file.kind !== 'youtube').concat(videos);
            if (next.length > MAX_FILES) { showWarning('이 질문 또는 선택지에는 최대 10개까지만 첨부할 수 있어요.'); return; }
            if (otherPollFileCount + next.length > MAX_TOTAL_FILES) { showWarning('투표 전체 첨부는 최대 100개까지만 가능합니다. 영상을 줄여주세요.'); return; }
            videos.forEach(file => entries.set(file.id, file));
            if (isQuestion) { questionFiles = next; refreshQuestionRow(); }
            else { rows.set(row, next); refreshRow(row); }
            sweep();
            closeYoutubeManager();
        };
        const close = () => closeYoutubeManager();
        const cleanup = () => {
            window.removeEventListener('resize', syncViewport);
            viewport?.removeEventListener('resize', syncViewport);
            viewport?.removeEventListener('scroll', syncViewport);
            clearWarningTimer();
            warning.classList.remove('active');
            warning.setAttribute('aria-hidden', 'true');
            warning.textContent = '';
            stopAnimations();
            addBtn.removeEventListener('click', onAdd);
            confirmBtn.removeEventListener('click', onDone);
            cancelBtn.removeEventListener('click', close);
            closeBtn.removeEventListener('click', close);
            overlay.removeEventListener('click', close);
            listHost.removeEventListener('click', onRemove);
        };
        youtubeManager = { overlay, modal, input, add: onAdd, returnFocus, cleanup };
        window.addEventListener('resize', syncViewport);
        viewport?.addEventListener('resize', syncViewport);
        viewport?.addEventListener('scroll', syncViewport);
        syncViewport();
        input.value = '';
        showWarning('');
        render(false);
        addBtn.addEventListener('click', onAdd);
        confirmBtn.addEventListener('click', onDone);
        cancelBtn.addEventListener('click', close);
        closeBtn.addEventListener('click', close);
        overlay.addEventListener('click', close);
        listHost.addEventListener('click', onRemove);
        history.pushState({ ...history.state, pollYoutubeManager: true }, '');
        requestAnimationFrame(() => {
            if (youtubeManager?.modal !== modal) return;
            overlay.classList.add('active');
            modal.classList.add('active');
            if (isMobile()) closeBtn.focus({ preventScroll: true });
            else input.focus();
        });
    }

    function removeRow(row) { if (trigger?.closest('.poll-option-row') === row) closeMenu(); rows.delete(row); sweep(); }

    async function prepare(kind) {
        const revision = revisions[kind], account = uid();
        const snapshot = committed[kind].map(files => [...files]);
        const snapshotQuestion = [...committedQuestion[kind]];
        const check = () => { if (revision !== revisions[kind] || account !== uid() || !account) throw new Error('작성 상태가 바뀌었어요. 다시 등록해주세요.'); };
        const resultOptions = {};
        for (let i = 0; i < snapshot.length; i++) {
            const files = snapshot[i];
            if (!files.length) continue;
            const uploaded = [];
            for (const file of files) {
                check();
                if (file.kind === 'youtube') {
                    file.remoteUrl = file.url;
                } else if (!file.remoteUrl && file.file) {
                    const upload = typeof uploadFileToActualCloud === 'function' ? uploadFileToActualCloud : window.uploadCommunityMedia;
                    if (!upload) throw new Error('공용 파일 저장소를 사용할 수 없습니다.');
                    file.remoteUrl = await upload(file.file);
                }
                check();
                const data = serialFile(file);
                if (!validFile(data)) { file.remoteUrl = ''; throw new Error(`${file.name}: 공유 파일 주소를 확인하지 못했어요.`); }
                uploaded.push(data);
            }
            resultOptions[i] = uploaded;
        }
        const resultQuestion = [];
        for (const file of snapshotQuestion) {
            check();
            if (file.kind === 'youtube') {
                file.remoteUrl = file.url;
            } else if (!file.remoteUrl && file.file) {
                const upload = typeof uploadFileToActualCloud === 'function' ? uploadFileToActualCloud : window.uploadCommunityMedia;
                if (!upload) throw new Error('공용 파일 저장소를 사용할 수 없습니다.');
                file.remoteUrl = await upload(file.file);
            }
            check();
            const data = serialFile(file);
            if (!validFile(data)) { file.remoteUrl = ''; throw new Error(`${file.name}: 공유 파일 주소를 확인하지 못했어요.`); }
            resultQuestion.push(data);
        }
        check();
        return { options: resultOptions, question: resultQuestion };
    }

    function ensureMenu() {
        if (menu) return;
        menu = document.createElement('div'); menu.id = 'pollOptionAttachMenu'; menu.className = 'comment-attach-menu poll-option-attach-menu';
        menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', '첨부파일 종류');
        menu.setAttribute('aria-description', '질문 또는 선택지마다 최대 10개, 투표 전체 최대 100개입니다.');
        menu.setAttribute('aria-hidden', 'true');
        const sourceIds = { image: 'commentAttachImageBtn', audio: 'commentAttachAudioBtn', pdf: 'commentAttachPdfBtn', html: 'commentAttachHtmlBtn' };
        kinds.forEach(kind => {
            const original = kind !== 'youtube' ? document.getElementById(sourceIds[kind]) : null;
            const item = original ? original.cloneNode(true) : document.createElement('button');
            item.removeAttribute('id'); item.removeAttribute('onclick');
            item.type = 'button'; item.className = 'comment-attach-option';
            item.setAttribute('role', 'menuitem'); item.dataset.pollPickKind = kind;
            if (kind === 'youtube') {
                item.innerHTML = `<i class="fa-brands fa-youtube" style="color: #ff0000;" aria-hidden="true"></i><span>${labels[kind]}</span>`;
            } else if (!original) {
                item.innerHTML = `<i class="fa-solid ${icons[kind]}" style="color:${colors[kind]}" aria-hidden="true"></i><span>${labels[kind]} (최대 10개, 파일당 100MB)</span>`;
            }
            menu.append(item);
        });
        document.body.append(menu);
        picker = document.createElement('input'); picker.id = 'pollOptionFileInput'; picker.type = 'file'; picker.multiple = true; picker.hidden = true; document.body.append(picker);
        picker.addEventListener('change', () => {
            const context = pickContext; pickContext = null;
            if (context && editing === context.kind && revisions[editing] === context.revision) {
                if (context.isQuestion) void addQuestionFiles(picker.files, context.fileKind);
                else void addFiles(context.row, picker.files, context.fileKind);
            }
            picker.value = '';
        });
    }

    function positionMenu() {
        if (!trigger || !menu || !trigger.isConnected) return;
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
        const button = trigger; trigger = null;
        if (menu) {
            menu.classList.remove('active');
            menu.classList.add('closing');
            menu.setAttribute('aria-hidden', 'true');
            clearTimeout(menuHideTimer);
            menuHideTimer = setTimeout(() => {
                menu.classList.remove('closing');
            }, 180);
        }
        button.classList.remove('open'); button.setAttribute('aria-expanded', 'false');
        const body = document.querySelector('.poll-modal-body');
        if (body && savedPadding !== null) body.style.paddingBottom = savedPadding;
        savedPadding = null;
        if (focus && button.isConnected) button.focus({ preventScroll: true });
        return true;
    }

    function openMenu(button) {
        ensureMenu();
        if (trigger === button) { closeMenu(false, true); return; }
        if (trigger) { trigger.setAttribute('aria-expanded', 'false'); trigger.classList.remove('open'); }
        clearTimeout(menuHideTimer);
        trigger = button; button.classList.add('open'); button.setAttribute('aria-expanded', 'true');
        menu.classList.remove('closing');
        menu.classList.remove('active');
        menu.setAttribute('aria-hidden', 'false');
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
            menu.classList.add('active');
            menu.querySelector('button')?.focus({ preventScroll: true });
        });
    }

    function closePreview(fromPop = false) {
        if (!previewState) return false;
        const state = previewState; previewState = null;
        if (state.kind === 'image') { if (typeof closeLightbox === 'function') closeLightbox(true); }
        else window.closeFilePreviewModal?.();
        document.body.classList.remove('poll-attachment-preview-open');
        if (state.button?.isConnected) state.button.focus({ preventScroll: true });
        if (!fromPop && (history.state?.pollFilePreview || history.state?.modal === 'lightbox')) {
            consumeBack = true;
            window._isProgrammaticBack = true;
            history.back();
        }
        return true;
    }

    function preview(file, button) {
        if (!file || !kinds.includes(file.kind) || !/^(https:\/\/|blob:)/i.test(file.url)) return;
        const open = file.kind === 'image' ? window.openLightbox : file.kind === 'pdf' ? window.openPdfPreviewModal : window.openHtmlPreviewModal;
        if (!open || file.kind === 'audio' || file.kind === 'youtube') return;
        previewState = { kind: file.kind, button };
        document.body.classList.add('poll-attachment-preview-open');
        open(file.url, file.kind === 'image' ? {} : file.name);
        if (file.kind !== 'image') history.pushState({ ...history.state, pollFilePreview: true }, '');
        const shell = document.getElementById(file.kind === 'image' ? 'imageLightbox' : 'filePreviewModal');
        shell?.querySelector('button')?.focus({ preventScroll: true });
    }

    document.addEventListener('click', event => {
        const qBtn = event.target.closest('#pollQuestionAttachBtn');
        if (qBtn) {
            event.preventDefault(); event.stopImmediatePropagation();
            openMenu(qBtn);
            return;
        }
        const button = event.target.closest('.poll-option-attach-btn');
        if (button) { event.preventDefault(); event.stopImmediatePropagation(); openMenu(button); return; }

        const pick = event.target.closest('[data-poll-pick-kind]');
        if (pick && trigger) {
            event.preventDefault(); event.stopImmediatePropagation();
            const isQuestion = trigger.id === 'pollQuestionAttachBtn' || trigger.classList.contains('poll-question-attach-btn');
            const row = trigger.closest('.poll-option-row');
            const kindToPick = pick.dataset.pollPickKind;
            const sourceButton = trigger;
            closeMenu(false, true);

            if (kindToPick === 'youtube') {
                promptYoutubeUrl(isQuestion, row, sourceButton);
                return;
            }

            pickContext = { isQuestion, row, kind: editing, revision: revisions[editing], fileKind: kindToPick };
            picker.accept = accepts[kindToPick];
            picker.click();
            return;
        }

        const remove = event.target.closest('[data-poll-remove-file]');
        if (remove) {
            event.preventDefault(); event.stopImmediatePropagation();
            const id = remove.dataset.pollRemoveFile;
            if (remove.dataset.pollTarget === 'question') {
                questionFiles = questionFiles.filter(file => file.id !== id);
                refreshQuestionRow();
                sweep();
            } else {
                const row = remove.closest('.poll-option-row'), list = rows.get(row);
                if (list) { rows.set(row, list.filter(file => file.id !== id)); refreshRow(row); sweep(); }
            }
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
        if (youtubeManager) {
            if (event.key === 'Escape') {
                event.preventDefault(); event.stopImmediatePropagation(); closeYoutubeManager(); return;
            }
            if (event.key === 'Enter' && event.target === youtubeManager.input && !event.shiftKey && !event.isComposing) {
                event.preventDefault(); event.stopImmediatePropagation(); youtubeManager.add(); return;
            }
            if (event.key === 'Tab') {
                const items = [...youtubeManager.modal.querySelectorAll('button, textarea, input, a[href]')]
                    .filter(item => !item.disabled && item.offsetParent !== null);
                const first = items[0], last = items[items.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault(); last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault(); first?.focus();
                }
                event.stopImmediatePropagation();
            }
            return;
        }
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
            buttons[next]?.focus();
        }
    }, true);

    window.addEventListener('popstate', event => {
        if (consumeBack || window._isProgrammaticBack) {
            consumeBack = false;
            setTimeout(() => { window._isProgrammaticBack = false; }, 200);
            event.stopImmediatePropagation(); return;
        }
        if (closeYoutubeManager(true)) { event.stopImmediatePropagation(); return; }
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

    window.pollAttachments = {
        validate, validateCounts, reset, beginEdit, pauseEdit, commitEdit, cancelEdit, decorateRow, removeRow, addFiles, addQuestionFiles, prepare,
        renderDraft, renderPublished, renderPublishedQuestion, closeMenu, closePreview, closeYoutubeManager,
        hasYoutubeManager: () => Boolean(youtubeManager),
        hasPreview: () => Boolean(previewState)
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            ensureMenu();
            ensureYoutubeModal();
        });
    } else {
        ensureMenu();
        ensureYoutubeModal();
    }
})();
