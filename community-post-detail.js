// 게시글 상세 화면과 좋아요·수정·삭제, 댓글 관리 기능
function closeSideDetail(e) {
    const fromPopState = (e === true);
    const sideDetailContainer = document.getElementById('sideDetailContainer');
    const writePostBtn = document.getElementById('writePostBtn');

    // 첨부 메뉴 닫기
    if (typeof window.closeCommentAttachMenu === 'function') {
        window.closeCommentAttachMenu();
    }

    // 댓글 다중선택 모드가 켜져 있으면 먼저 해제
    if (window.isMultiSelectMode) {
        window.cancelMultiDelete(true);
    }

    if (sideDetailContainer) {
        // 1. 먼저 애니메이션 클래스를 추가하여 페이드 아웃/이동 시작
        sideDetailContainer.classList.add('detail-hidden');
        document.body.classList.remove('detail-open');

        // 작성 버튼 다시 표시 여부 판단 (통합 함수 호출)
        updateWriteButtonVisibility();

        // 상단 동아리 로고 및 헤더 액션(테마/메뉴) 버튼 복원
        if (typeof _showTopButtons === 'function') {
            _showTopButtons();
        }

        if (fromPopState !== true && history.state && history.state.modal === 'postDetail') {
            window._isProgrammaticBack = true;
            history.back();
        }
        // 2. 애니메이션(0.4s)이 완료된 후 레이아웃을 정리합니다.
        const closingPostId = currentPostId; // 현재 닫으려는 ID 백업
        setTimeout(() => {
            // 애니메이션이 진행되는 동안 다른 게시물이 열리지 않았을 때만 정리
            if (currentPostId === closingPostId || currentPostId === null) {
                sideDetailContainer.classList.remove('fullscreen-detail');
                const communityLayout = document.querySelector('.community-layout');
                if (communityLayout && sideDetailContainer.parentElement !== communityLayout) {
                    communityLayout.appendChild(sideDetailContainer);
                }
                document.body.classList.remove('detail-open');

                // 애니메이션이 끝난 후 ID 초기화
                if (currentPostId === closingPostId) {
                    currentPostId = null;
                }
            }
        }, 400);
    }

    if (postUnsubscribe) {
        postUnsubscribe();
        postUnsubscribe = null;
    }
    if (commentUnsubscribe) {
        commentUnsubscribe();
        commentUnsubscribe = null;
    }
    window.expandedCommentIds.clear();
    window.currentCommentDocs = [];
    window.replyTarget = null;
    updateReplyTargetUI();
    // 즉시 초기화하지 않고 애니메이션 종료 후 처리 (위의 setTimeout 내부)
    // currentPostId = null;
    currentDetailMode = 'side';
}

// 상세 페이지 렌더링
function openPostDetail(id, post, avatar, timeStr, mode = 'fullscreen') {
    const isMobile = window.innerWidth <= 1023;
    if (isMobile) {
        mode = 'fullscreen'; // 폰에서는 항상 전체화면 모드로 고정
    }

    history.pushState({ modal: 'postDetail' }, '', '#post');
    const sideDetailContainer = document.getElementById('sideDetailContainer');
    if (!sideDetailContainer) return;

    // 이미 같은 게시물이 열려있다면 무시 (필요시 업데이트 로직 추가)
    if (currentPostId === id && !sideDetailContainer.classList.contains('detail-hidden')) return;

    if (currentPostId !== id) {
        window.expandedCommentIds.clear();
        window.currentCommentDocs = [];
        window.replyTarget = null;
        updateReplyTargetUI();
    }
    currentPostId = id;
    window.currentPostData = post || null;
    currentDetailMode = mode;

    const isFullscreen = currentDetailMode === 'fullscreen';

    // 1. 현재 열려있는 상태라면 일단 숨김 상태로 시작하여 부드럽게 전환
    sideDetailContainer.classList.add('detail-hidden');
    updateWriteButtonVisibility();

    // 2. DOM 위치 조정 및 클래스 설정 (애니메이션 없이 즉시 반영되는 속성들)
    if (isFullscreen || isMobile) {
        if (sideDetailContainer.parentElement !== document.body) {
            document.body.appendChild(sideDetailContainer);
        }
    } else {
        const communityLayout = document.querySelector('.community-layout');
        if (communityLayout && sideDetailContainer.parentElement !== communityLayout) {
            communityLayout.appendChild(sideDetailContainer);
        }
    }

    sideDetailContainer.classList.toggle('fullscreen-detail', isFullscreen);
    document.body.classList.toggle('detail-open', isFullscreen || isMobile);

    // 모바일 진입 시 잔여 스크롤 타이머 해제 및 상단 헤더 버튼 강제 숨김
    if (typeof _scrollStopTimer !== 'undefined' && _scrollStopTimer) {
        clearTimeout(_scrollStopTimer);
    }
    if (typeof _hideTopButtons === 'function') {
        _hideTopButtons();
    }

    const detailTitle = sideDetailContainer.querySelector('.side-detail-title');
    if (detailTitle) {
        detailTitle.innerHTML = isFullscreen
            ? '<i class="fa-solid fa-file-lines"></i> 게시글 상세'
            : '<i class="fa-regular fa-comments"></i> 댓글 보기';
    }

    // 3. 브라우저가 레이아웃 변경을 완료하도록 짧은 지연 후 애니메이션 시작
    requestAnimationFrame(() => {
        setTimeout(() => {
            sideDetailContainer.classList.remove('detail-hidden');
            sideDetailContainer.scrollTop = 0;

            // [수정] 디테일이 실제로 열린 후 제미나이 버튼 위치 복원
            if (typeof updateWriteButtonVisibility === 'function') {
                updateWriteButtonVisibility();
            }

            const scrollArea = sideDetailContainer.querySelector('.side-detail-scroll-area');
            if (scrollArea && !scrollArea.dataset.scrollListenerAttached) {
                scrollArea.dataset.scrollListenerAttached = 'true';
                scrollArea.addEventListener('scroll', () => {
                    if (scrollArea.scrollTop > 15) {
                        scrollArea.classList.add('has-scrolled');
                        sideDetailContainer.classList.add('has-scrolled-detail');
                    } else {
                        scrollArea.classList.remove('has-scrolled');
                        sideDetailContainer.classList.remove('has-scrolled-detail');
                    }
                });
            }
        }, 10);
    });

    const area = document.getElementById('detailPostArea');
    if (currentUser) {
        const postRef = db.collection('posts').doc(id);
        db.runTransaction(async (transaction) => {
            const postSnapshot = await transaction.get(postRef);
            if (!postSnapshot.exists) return;
            const postData = postSnapshot.data() || {};
            const viewedBy = Array.isArray(postData.viewedBy) ? postData.viewedBy : [];
            if (viewedBy.includes(currentUser.uid)) return;
            transaction.update(postRef, {
                views: Math.max(0, Number(postData.views) || 0) + 1,
                viewedBy: [...viewedBy, currentUser.uid]
            });
        }).catch((error) => console.warn('게시글 조회 수 저장 실패:', error));
    }

    let detailUpdateTimeout = null;
    if (postUnsubscribe) postUnsubscribe();
    postUnsubscribe = db.collection('posts').doc(id).onSnapshot(docSnap => {
        if (!docSnap.exists) return;
        const currentPost = docSnap.data();
        window.currentPostData = currentPost;

        const existingBtn = document.getElementById('detailLikeBtn');
        const existingHeart = existingBtn ? existingBtn.querySelector('i') : null;
        const isHeartAnimating = existingHeart && (existingHeart.classList.contains('animate-heart') || existingHeart.classList.contains('animate-heart-cancel'));

        const existingPinBtn = document.querySelector('.side-detail-container .pin-toggle-btn');
        const isPinAnimating = existingPinBtn && existingPinBtn.classList.contains('animate-pin-action');

        const isAnimating = isHeartAnimating || isPinAnimating;

        const updateUI = () => {
            const isPresident = currentUser && isAdmin(currentUser.email);
            const isAuthor = currentUser && (currentPost.uid === currentUser.uid || isPresident);
            const safePostId = toJsString(id);
            const isPinned = currentPost.pinned === true;

            // 삭제 버튼 (작성자 또는 회장)
            const deleteBtnHtml = isAuthor ? `
                        <button type="button" class="board-action-btn delete-btn" onclick="event.stopPropagation(); deletePost('${safePostId}')" title="삭제하기">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    ` : '';

            // 수정 버튼 (작성자 또는 회장)
            const editBtnHtml = isAuthor ? `
                        <button type="button" class="board-action-btn edit-btn role-edit-btn" onclick="event.stopPropagation(); editPost('${safePostId}')" title="수정하기" style="color: #007bff !important;">
                            <i class="fa-solid fa-pen-to-square" style="color: #007bff !important;"></i>
                        </button>
                    ` : '';

            // 고정 버튼 (회장, 사장 전용)
            const pinBtnHtml = isPresident ? `
                        <button type="button" class="board-action-btn pin-toggle-btn ${isPinned ? 'active' : ''}" onclick="event.stopPropagation(); togglePin('${safePostId}', ${isPinned})" title="${isPinned ? '고정 해제' : '상단 고정'}">
                            <i class="fa-solid fa-thumbtack"></i>
                        </button>
                    ` : '';

            const isLiked = currentUser && Array.isArray(currentPost.likedUsers) && currentPost.likedUsers.includes(currentUser.uid);
            const existingTopCountEl = document.getElementById('detailTopCommentCount');
            const currentTopCount = existingTopCountEl && typeof safeDisplayCount === 'function'
                ? safeDisplayCount(existingTopCountEl.innerText)
                : 0;

            const heartClass = isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
            const heartColor = isLiked ? 'color: #ff6b6b;' : 'color: var(--text-primary);';

            // 첨부파일 및 이미지 자동 분류 및 정제
            const rawImages = Array.isArray(currentPost.images) ? currentPost.images : [];
            const rawAttachments = Array.isArray(currentPost.attachments) ? currentPost.attachments : [];

            const displayImages = [];
            const displayAttachments = [];

            rawImages.forEach((img, idx) => {
                let url = '';
                let name = '첨부 이미지';
                let type = '';

                if (typeof img === 'string') {
                    url = img;
                } else if (img && typeof img === 'object') {
                    url = img.url || '';
                    name = String(img.name || '첨부파일');
                    type = String(img.type || '');
                }

                url = typeof getSafeAttachmentUrl === 'function'
                    ? getSafeAttachmentUrl(url, ['image/', 'video/', 'audio/', 'application/pdf', 'text/html', 'application/xhtml+xml'])
                    : String(url || '');
                if (!url) return;

                const lowerUrl = url.toLowerCase();
                const lowerName = name.toLowerCase();
                const lowerType = type.toLowerCase();

                const isNonImage = (
                    lowerType.includes('html') || lowerUrl.startsWith('data:text/html') || /\.(html|htm)$/i.test(lowerName) ||
                    lowerType.includes('pdf') || lowerUrl.startsWith('data:application/pdf') || /\.pdf$/i.test(lowerName) ||
                    lowerType.startsWith('audio/') || lowerUrl.startsWith('data:audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(lowerName) ||
                    lowerType.startsWith('video/') || lowerUrl.startsWith('data:video/') || /\.(mp4|webm|mov)$/i.test(lowerName)
                );

                if (isNonImage) {
                    displayAttachments.push({ url, name: (name && name !== '첨부 이미지') ? name : '첨부파일', type, index: idx });
                } else {
                    displayImages.push({ url, index: idx });
                }
            });

            rawAttachments.forEach((att, idx) => {
                let url = '';
                let name = '첨부파일';
                let type = '';

                if (typeof att === 'string') {
                    url = att;
                } else if (att && typeof att === 'object') {
                    url = att.url || att.dataUrl || '';
                    name = String(att.name || '첨부파일');
                    type = String(att.type || '');
                }

                url = typeof getSafeAttachmentUrl === 'function'
                    ? getSafeAttachmentUrl(url, ['image/', 'video/', 'audio/', 'application/pdf', 'text/html', 'application/xhtml+xml'])
                    : String(url || '');
                if (!url) return;

                const lowerUrl = url.toLowerCase();
                const lowerName = name.toLowerCase();
                const lowerType = type.toLowerCase();

                const isImage = (
                    lowerType.startsWith('image/') ||
                    lowerUrl.startsWith('data:image/') ||
                    /\.(png|jpe?g|gif|webp|svg)($|\?)/i.test(lowerUrl) ||
                    /\.(png|jpe?g|gif|webp|svg)$/i.test(lowerName)
                );

                if (isImage) {
                    if (!displayImages.some(i => i.url === url)) {
                        displayImages.push({ url, index: idx });
                    }
                } else {
                    if (!displayAttachments.some(a => a.url === url)) {
                        displayAttachments.push({ url, name, type, index: idx });
                    }
                }
            });

            const catIcon = typeof getCategoryIcon === 'function' ? getCategoryIcon(currentPost.categorySub) : 'fa-solid fa-tag';
            const detailCategoryHtml = (currentPost.categoryMain && currentPost.categorySub)
                ? `<span class="post-category-badge detail-category-badge"><i class="${catIcon}"></i> ${escapeHtml(currentPost.categoryMain)} &gt; ${escapeHtml(currentPost.categorySub)}</span>`
                : '<div class="detail-category-fallback">커뮤니티 · 게시글</div>';

            area.innerHTML = `
                        <div class="post-detail-header-top">
                            <div class="post-detail-category-wrap">
                                ${detailCategoryHtml}
                            </div>
                            <div class="post-detail-action-buttons">
                                ${pinBtnHtml}
                                ${deleteBtnHtml}
                                ${editBtnHtml}
                            </div>
                        </div>
                        <h2 class="post-body-title" style="margin-bottom: 0.5rem; font-size: 1.6rem; color: var(--text-primary); word-break: break-word; overflow-wrap: anywhere;">${escapeHtml(currentPost.title || '')}</h2>
                        <div style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1.5rem;">
                            ${timeStr} &nbsp;|&nbsp; 조회 ${typeof safeDisplayCount === 'function' ? safeDisplayCount(currentPost.views) : 0}회
                        </div>
                        
                        <div class="board-card-header" style="margin-bottom: 2rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 1rem;">
                            <div class="board-author" style="flex: 1;">
                                ${avatar}
                                <span class="board-author-name" style="font-weight: 600; font-size: 1rem;">${escapeHtml(currentPost.author || '사용자')}</span>
                            </div>
                            <div class="board-stats" style="font-size: 0.95rem;">
                                <span style="cursor: default; user-select: none; margin-right: 0.8rem;"><i class="fa-regular fa-comment"></i> <span id="detailTopCommentCount">${currentTopCount}</span></span>
                                <button type="button" class="board-action-btn" onclick="likePost('${safePostId}', this)" id="detailLikeBtn" title="좋아요">
                                    <i class="${heartClass}" style="${isLiked ? 'color: #ff6b6b;' : ''}"></i> <span id="detailLikeCnt" class="like-count">${typeof safeDisplayCount === 'function' ? safeDisplayCount(currentPost.likes) : 0}</span>
                                </button>
                            </div>
                        </div>
                        
                        <div class="post-body" style="font-size: 1.05rem; line-height: 1.7; color: var(--text-primary); padding-bottom: 1rem;">
                            ${typeof window.renderTextWithYoutubeLinks === 'function'
                    ? window.renderTextWithYoutubeLinks(escapeHtml(String(currentPost.body || '')).replace(/\n/g, '<br>'))
                    : escapeHtml(String(currentPost.body || '')).replace(/\n/g, '<br>')}
                        </div>

                        ${displayImages.length > 0 ? `
                            <div class="post-image-gallery">
                                ${displayImages.map((imgObj, imgIdx) => `<img src="${escapeHtml(imgObj.url)}" alt="게시글 첨부 사진" style="cursor: pointer;" onclick="openLightbox('${toJsString(imgObj.url)}', {postId:'${toJsString(currentPostId)}', commentId:null, authorUid:'${toJsString(currentPost.uid || '')}', imageIndex:${imgIdx}})">`).join('')}
                            </div>
                        ` : ''}

                        ${displayAttachments.length > 0 ? `
                            <div class="post-attachments-section" style="margin-top: 1.5rem; padding: 1.25rem; background: var(--glass-bg, rgba(30, 41, 59, 0.7)); border: 1px solid var(--glass-border); border-radius: 16px; box-shadow: 0 4px 14px rgba(0,0,0,0.12);">
                                <div style="font-size: 0.95rem; font-weight: 700; color: var(--accent-color); margin-bottom: 0.9rem; display: flex; align-items: center; gap: 0.5rem;">
                                    <i class="fa-solid fa-paperclip" style="font-size: 1.1rem;"></i>
                                    <span>첨부파일 목록 (${displayAttachments.length})</span>
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                                    ${displayAttachments.map(att => {
                let iconClass = 'fa-solid fa-file-lines';
                let iconColor = '#2563eb';
                let isHtml = false;
                let isPdf = false;
                let isAudio = false;
                let isVideo = false;

                const attName = String(att.name || '첨부파일');
                const lowerAttName = attName.toLowerCase();
                const lowerAttUrl = (att.url || '').toLowerCase();
                const type = String(att.type || '').toLowerCase();

                if (type.includes('html') || lowerAttUrl.startsWith('data:text/html') || /\.(html|htm)$/i.test(lowerAttName)) {
                    iconClass = 'fa-solid fa-file-code'; iconColor = '#7c3aed'; isHtml = true;
                } else if (type.includes('pdf') || lowerAttUrl.startsWith('data:application/pdf') || /\.pdf$/i.test(lowerAttName)) {
                    iconClass = 'fa-solid fa-file-pdf'; iconColor = '#ea580c'; isPdf = true;
                } else if (type.startsWith('audio/') || lowerAttUrl.startsWith('data:audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(lowerAttName)) {
                    iconClass = 'fa-solid fa-file-audio'; iconColor = '#16a34a'; isAudio = true;
                } else if (type.startsWith('video/') || lowerAttUrl.startsWith('data:video/') || /\.(mp4|webm|mov)$/i.test(lowerAttName)) {
                    iconClass = 'fa-solid fa-file-video'; iconColor = '#dc2626'; isVideo = true;
                }

                return `
                                            <div style="padding: 0.9rem 1.1rem; background: var(--bg-color, rgba(15, 23, 42, 0.6)); border: 1px solid var(--glass-border); border-radius: 12px; display: flex; flex-direction: column; gap: 0.6rem; transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                                                <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.8rem; flex-wrap: wrap;">
                                                    <div style="display: flex; align-items: center; gap: 0.7rem; flex: 1; min-width: 180px;">
                                                        <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(255, 255, 255, 0.08); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                                            <i class="${iconClass}" style="font-size: 1.35rem; color: ${iconColor};"></i>
                                                        </div>
                                                        <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); word-break: break-all; white-space: normal; line-height: 1.35; flex: 1;">${escapeHtml(attName)}</span>
                                                    </div>
                                                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
                                                        ${isHtml ? `<button type="button" onclick="openHtmlPreviewModal('${toJsString(att.url)}', '${toJsString(attName)}')" style="padding: 0.45rem 0.9rem; border: none; border-radius: 8px; background: #7c3aed; color: #ffffff; font-size: 0.85rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; box-shadow: 0 2px 6px rgba(124, 58, 237, 0.25); transition: background 0.15s, transform 0.1s;"><i class="fa-solid fa-eye"></i> 미리보기</button>` : ''}
                                                        ${isPdf ? `<button type="button" onclick="openPdfPreviewModal('${toJsString(att.url)}', '${toJsString(attName)}')" style="padding: 0.45rem 0.9rem; border: none; border-radius: 8px; background: #ea580c; color: #ffffff; font-size: 0.85rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; box-shadow: 0 2px 6px rgba(234, 88, 12, 0.25); transition: background 0.15s, transform 0.1s;"><i class="fa-solid fa-eye"></i> 미리보기</button>` : ''}
                                                        <button type="button" onclick="downloadFileAttachment('${toJsString(att.url)}', '${toJsString(attName)}')" style="padding: 0.45rem 0.9rem; border: none; border-radius: 8px; background: #2563eb; color: #ffffff; font-size: 0.85rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25); transition: background 0.15s, transform 0.1s;"><i class="fa-solid fa-download"></i> 다운로드</button>
                                                    </div>
                                                </div>
                                                ${isAudio ? `<audio controls src="${escapeHtml(att.url)}" style="width: 100%; height: 38px; margin-top: 0.3rem; border-radius: 8px;"></audio>` : ''}
                                                ${isVideo ? `<video controls playsinline src="${escapeHtml(att.url)}" style="max-width: 100%; max-height: 380px; border-radius: 10px; margin-top: 0.3rem;"></video>` : ''}
                                            </div>
                                        `;
            }).join('')}
                                </div>
                            </div>
                        ` : ''}


                    `;
        };

        if (isAnimating) {
            if (detailUpdateTimeout) clearTimeout(detailUpdateTimeout);
            detailUpdateTimeout = setTimeout(updateUI, 600);
        } else {
            if (detailUpdateTimeout) clearTimeout(detailUpdateTimeout);
            updateUI();
        }
    });

    // 댓글 실시간 렌더링
    const commentArea = document.getElementById('detailCommentArea');
    if (commentUnsubscribe) commentUnsubscribe();
    commentUnsubscribe = db.collection('posts').doc(id).collection('comments').onSnapshot(snap => {
        const updateComments = () => {
            window.currentCommentDocs = snap.docs.map(normalizeCommentDoc);
            window.renderCurrentComments(id);
        };

        const isDeleting = !!document.querySelector('.comment-fade-out, .deleting');
        const isAnimating = isDeleting || !!document.querySelector('.c-like-btn i.animate-heart, .c-like-btn i.animate-heart-cancel, .board-action-btn i.animate-heart, .board-action-btn i.animate-heart-cancel');
        if (isAnimating) {
            if (window.commentUpdateTimeout) clearTimeout(window.commentUpdateTimeout);
            window.commentUpdateTimeout = setTimeout(updateComments, 450);
        } else {
            if (window.commentUpdateTimeout) clearTimeout(window.commentUpdateTimeout);
            updateComments();
        }
        return;
    });

    // openPostDetail 하단에 있던 중복 hidden 제거 로직은 함수 내부(상단)로 옮겼으므로 여기서는 삭제합니다.
}

// 상세 닫기 이벤트 바인딩
const closeSideDetailBtn = document.getElementById('closeSideDetailBtn');
if (closeSideDetailBtn) {
    closeSideDetailBtn.addEventListener('click', closeSideDetail);
}

function applyLikeButtonState(button, liked, count) {
    if (!button) return;
    const icon = button.querySelector('i');
    const countElement = button.querySelector('.like-count') || button.querySelector('#detailLikeCnt');
    if (icon) {
        icon.classList.toggle('fa-solid', liked);
        icon.classList.toggle('fa-regular', !liked);
        icon.style.color = liked ? '#ff6b6b' : '';
    }
    if (countElement) countElement.textContent = Math.max(0, Number(count) || 0);
}

window.likePost = async function (id, btnEl) {
    if (!currentUser) {
        alert('로그인이 필요한 기능입니다. Google 로그인 해주세요!');
        openDrawer();
        return;
    }

    if (btnEl) {
        if (btnEl.dataset.processing) return;
        btnEl.dataset.processing = 'true';

        const heartIcon = btnEl.querySelector('i');
        const likeCountEl = btnEl.querySelector('.like-count') || btnEl.querySelector('#detailLikeCnt');
        if (heartIcon) {
            const currentlyLiked = heartIcon.classList.contains('fa-solid');

            // 기존 애니메이션 클래스 깔끔히 제거 후 강제 리플로우
            heartIcon.classList.remove('animate-heart', 'animate-heart-cancel');
            void heartIcon.offsetWidth;

            if (currentlyLiked) {
                // 취소 시: regular로 변경 및 cancel 애니메이션 부여
                heartIcon.classList.remove('fa-solid');
                heartIcon.classList.add('fa-regular', 'animate-heart-cancel');
                heartIcon.style.color = '';
                if (likeCountEl) {
                    const cur = parseInt(likeCountEl.textContent) || 0;
                    likeCountEl.textContent = Math.max(0, cur - 1);
                }
            } else {
                // 추가 시: solid로 변경 및 heart 애니메이션 부여
                heartIcon.classList.remove('fa-regular');
                heartIcon.classList.add('fa-solid', 'animate-heart');
                heartIcon.style.color = '#ff6b6b';
                if (likeCountEl) {
                    const cur = parseInt(likeCountEl.textContent) || 0;
                    likeCountEl.textContent = cur + 1;
                }
            }

            const onAnimEnd = () => {
                heartIcon.classList.remove('animate-heart', 'animate-heart-cancel');
                heartIcon.removeEventListener('animationend', onAnimEnd);
            };
            heartIcon.addEventListener('animationend', onAnimEnd);
        }
    }

    const postRef = db.collection('posts').doc(id);
    try {
        const finalState = await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(postRef);
            if (!doc.exists) throw new Error('게시글을 찾을 수 없습니다.');
            const postData = doc.data() || {};
            const likedUsers = Array.isArray(postData.likedUsers) ? postData.likedUsers : [];
            const wasLiked = likedUsers.includes(currentUser.uid);
            const nextUsers = wasLiked
                ? likedUsers.filter(uid => uid !== currentUser.uid)
                : [...likedUsers, currentUser.uid];
            const nextLikes = Math.max(0, (Number(postData.likes) || 0) + (wasLiked ? -1 : 1));

            transaction.update(postRef, { likes: nextLikes, likedUsers: nextUsers });
            return { liked: !wasLiked, count: nextLikes };
        });
        applyLikeButtonState(btnEl, finalState.liked, finalState.count);
    } catch (error) {
        console.error("Error toggling like: ", error);
        try {
            const latest = await postRef.get();
            if (latest.exists) {
                const data = latest.data() || {};
                const users = Array.isArray(data.likedUsers) ? data.likedUsers : [];
                applyLikeButtonState(btnEl, users.includes(currentUser.uid), data.likes);
            }
        } catch (syncError) {
            console.warn('좋아요 화면 복구 실패:', syncError);
        }
    } finally {
        if (btnEl) {
            delete btnEl.dataset.processing;
        }
    }
};

window.togglePin = async function (id, currentPinned) {
    if (!currentUser || !isAdmin(currentUser.email)) return;
    const btn = window.event ? (window.event.currentTarget || window.event.target.closest('.pin-toggle-btn')) : null;
    if (btn && btn.dataset.processing === 'true') return;
    if (btn) btn.dataset.processing = 'true';

    const targetPinned = !currentPinned;

    try {
        await db.collection('posts').doc(id).update({ pinned: targetPinned });
        if (btn) {
            btn.classList.toggle('active', targetPinned);
            btn.classList.remove('animate-pin-action');
            void btn.offsetWidth;
            btn.classList.add('animate-pin-action');
            btn.title = targetPinned ? '고정 해제' : '상단 고정';
        }
    } catch (e) {
        console.error('togglePin error: ', e);
        alert('게시글 고정 설정 중 오류가 발생했습니다: ' + e.message);
        if (btn) {
            btn.classList.toggle('active', currentPinned);
            btn.title = currentPinned ? '고정 해제' : '상단 고정';
        }
    } finally {
        if (btn) delete btn.dataset.processing;
    }
};

window.togglePinComment = async function (postId, commentId, currentPinned) {
    const isPresident = typeof isPresidentUser === 'function' ? isPresidentUser() : (currentUser && isAdmin(currentUser.email));
    const isPostAuthor = currentUser && window.currentPostData && (window.currentPostData.uid === currentUser.uid || window.currentPostData.authorUid === currentUser.uid);
    if (!currentUser || (!isPresident && !isPostAuthor)) return;
    const btn = window.event ? (window.event.currentTarget || window.event.target.closest('.pin-toggle-btn')) : null;
    if (btn && btn.dataset.processing === 'true') return;
    if (btn) btn.dataset.processing = 'true';

    const targetPinned = !currentPinned;

    try {
        await db.collection('posts').doc(postId).collection('comments').doc(commentId).update({ pinned: targetPinned });
        if (window.clubNotifications?.isConfigured()) {
            window.clubNotifications.notifyCommentPinChanged(postId, commentId, targetPinned)
                .catch((error) => console.error('댓글 고정 알림 전송 오류:', error));
        }
        if (btn) {
            btn.classList.toggle('active', targetPinned);
            btn.classList.remove('animate-pin-action');
            void btn.offsetWidth;
            btn.classList.add('animate-pin-action');
            btn.title = targetPinned ? '고정 해제' : '상단 고정';
        }
    } catch (e) {
        console.error('togglePinComment error: ', e);
        alert('댓글 고정 설정 중 오류가 발생했습니다: ' + e.message);
        if (btn) {
            btn.classList.toggle('active', currentPinned);
            btn.title = currentPinned ? '고정 해제' : '상단 고정';
        }
    } finally {
        if (btn) delete btn.dataset.processing;
    }
};

async function deletePostAndCommentsDirectly(id) {
    const postRef = db.collection('posts').doc(id);
    const commentsSnapshot = await postRef.collection('comments').get();
    const commentDocs = commentsSnapshot.docs;

    for (let start = 0; start < commentDocs.length; start += 400) {
        const batch = db.batch();
        commentDocs.slice(start, start + 400).forEach(commentDoc => batch.delete(commentDoc.ref));
        await batch.commit();
    }

    await postRef.delete();
}

window.deletePostDocumentWithNotification = async function (id) {
    if (!currentUser) throw new Error('로그인이 필요합니다.');

    if (window.clubNotifications?.isConfigured()) {
        try {
            await window.clubNotifications.deletePost(id);
            return;
        } catch (error) {
            if (error?.status === 401 || error?.status === 403) throw error;
            if (error?.status === 404) return;
            console.warn('알림 서버를 통한 삭제 실패, Firebase에서 직접 삭제합니다:', error);
        }
    }

    await deletePostAndCommentsDirectly(id);
};

window.deletePostWithAnim = async function (id, btn) {
    if (!await window.customConfirm('정말 이 게시글을 삭제하시겠습니까?', '게시글 삭제')) return;
    const card = btn.closest('.board-card');
    if (card) {
        card.classList.add('deleting');
        setTimeout(async () => {
            try {
                await window.deletePostDocumentWithNotification(id);
                if (card && card.parentNode) {
                    card.remove();
                }
            } catch (error) {
                console.error("Error deleting post: ", error);
                card.classList.remove('deleting');
                alert('삭제 중 오류가 발생했습니다: ' + error.message);
            }
        }, 300);
    } else {
        deletePost(id);
    }
};

window.deletePost = async function (id) {
    if (!await window.customConfirm('정말로 이 게시글을 삭제하시겠습니까?', '게시글 삭제')) return;
    try {
        await window.deletePostDocumentWithNotification(id);
        alert('게시글이 성공적으로 삭제되었습니다.');
        closeSideDetail();
    } catch (error) {
        console.error("Error deleting post: ", error);
        alert('삭제 중 오류가 발생했습니다: ' + error.message);
    }
};

// 게시글 수정 함수
window.editPost = async function (id) {
    if (!currentUser) {
        alert('로그인이 필요합니다.');
        openDrawer();
        return;
    }
    try {
        const doc = await db.collection('posts').doc(id).get();
        if (!doc.exists) { alert('게시글을 찾을 수 없습니다.'); return; }
        const post = doc.data();

        // 상세 보기가 열려있는지 확인
        const sideDetailContainer = document.getElementById('sideDetailContainer');
        const wasDetailOpen = sideDetailContainer && !sideDetailContainer.classList.contains('detail-hidden');
        window._editFromDetail = wasDetailOpen;

        // 상세 보기가 열려있으면 정상적으로 닫기
        if (wasDetailOpen) {
            closeSideDetail(true);
        }

        // 글쓰기 페이지 수정 모드로 전환
        const writePostPage = document.getElementById('writePostPage');
        document.getElementById('postTitle').value = post.title || '';
        document.getElementById('postBody').value = post.body || '';
        const pageTitleEl = writePostPage.querySelector('.greeting-title');
        if (pageTitleEl) pageTitleEl.innerText = '게시글 수정';
        document.getElementById('submitPostBtn').innerText = '수정 완료';

        window._editingPostId = id;
        window._editingPostImages = Array.isArray(post.images) ? [...post.images] : (post.imageUrl ? [post.imageUrl] : []);
        window._editingPostAttachments = Array.isArray(post.attachments) ? [...post.attachments] : [];

        if (post.categoryMain && post.categorySub && typeof window.selectCategory === 'function') {
            window.selectCategory(post.categoryMain, post.categorySub);
        } else if (typeof window.resetCategorySelect === 'function') {
            window.resetCategorySelect();
        }

        if (typeof window.resetSelectedImages === 'function') {
            window.resetSelectedImages();
        } else if (typeof window.updateImagePreview === 'function') {
            window.updateImagePreview();
        }

        history.pushState({ modal: 'writePage' }, '', '#write');
        switchPage(currentPage, writePostPage, true);
    } catch (e) {
        console.error(e);
        alert('게시글 정보를 불러오는 중 오류가 발생했습니다.');
    }
};

window.editTarget = null;

// 댓글/답글 수정 함수
window.editComment = async function (postId, commentId) {
    if (!currentUser) {
        alert('로그인이 필요합니다.');
        openDrawer();
        return;
    }
    try {
        const doc = await db.collection('posts').doc(postId).collection('comments').doc(commentId).get();
        if (!doc.exists) { alert('댓글을 찾을 수 없습니다.'); return; }
        const comment = doc.data();

        window.editTarget = {
            postId: postId,
            id: commentId,
            body: comment.body || '',
            images: comment.images || []
        };

        window.replyTarget = null; // 수정 모드로 진입하므로 답글 모드 해제

        if (typeof window.setCommentAttachments === 'function') {
            window.setCommentAttachments({
                images: comment.images || [],
                videos: comment.videos || [],
                audios: comment.audios || [],
                pdfs: comment.pdfs || [],
                htmls: comment.htmls || []
            });
        } else {
            window.commentAttachedImages = (comment.images || []).map(imgUrl => ({ file: null, dataUrl: imgUrl }));
            window.commentAttachedVideos = (comment.videos || []).map(v => typeof v === 'string' ? { file: null, dataUrl: v, name: '동영상' } : { file: null, dataUrl: v.url, name: v.name || '동영상' });
            window.commentAttachedAudios = (comment.audios || []).map(a => typeof a === 'string' ? { file: null, dataUrl: a, name: '음성 파일' } : { file: null, dataUrl: a.url, name: a.name || '음성 파일' });
            window.commentAttachedPdfs = (comment.pdfs || []).map(p => typeof p === 'string' ? { file: null, dataUrl: p, name: 'PDF 문서' } : { file: null, dataUrl: p.url, name: p.name || 'PDF 문서' });
            window.commentAttachedHtmls = (comment.htmls || []).map(h => typeof h === 'string' ? { file: null, dataUrl: h, name: 'HTML 문서' } : { file: null, dataUrl: h.url, name: h.name || 'HTML 문서' });

            if (typeof renderCommentAttachmentPreview === 'function') {
                renderCommentAttachmentPreview();
            }
        }

        if (typeof updateReplyTargetUI === 'function') {
            updateReplyTargetUI(comment.body || '', true);
        }

    } catch (e) {
        console.error(e);
        alert('댓글 수정 중 오류가 발생했습니다.');
    }
};

window.toggleLikeComment = async function (postId, commentId, btn, isLiked) {
    if (!currentUser) {
        alert('좋아요를 누르시려면 먼저 Google 로그인을 해주세요!');
        openDrawer();
        return;
    }

    // 애니메이션 먼저 실행 (DB 호출과 분리)
    if (btn) {
        if (btn.dataset.processing) return;
        btn.dataset.processing = 'true';

        const heartIcon = btn.querySelector('i');
        const likeCountEl = btn.querySelector('.like-count');
        if (heartIcon) {
            const currentlyLiked = heartIcon.classList.contains('fa-solid');

            // 기존 애니메이션 클래스 깔끔히 제거 후 강제 리플로우
            heartIcon.classList.remove('animate-heart', 'animate-heart-cancel');
            void heartIcon.offsetWidth;

            if (currentlyLiked) {
                // 취소 시: regular로 변경 및 cancel 애니메이션 부여
                heartIcon.classList.remove('fa-solid');
                heartIcon.classList.add('fa-regular', 'animate-heart-cancel');
                heartIcon.style.color = '';
                if (likeCountEl) {
                    const cur = parseInt(likeCountEl.textContent) || 0;
                    likeCountEl.textContent = Math.max(0, cur - 1);
                }
            } else {
                // 추가 시: solid로 변경 및 heart 애니메이션 부여
                heartIcon.classList.remove('fa-regular');
                heartIcon.classList.add('fa-solid', 'animate-heart');
                heartIcon.style.color = '#ff6b6b';
                if (likeCountEl) {
                    const cur = parseInt(likeCountEl.textContent) || 0;
                    likeCountEl.textContent = cur + 1;
                }
            }

            const onAnimEnd = () => {
                heartIcon.classList.remove('animate-heart', 'animate-heart-cancel');
                heartIcon.removeEventListener('animationend', onAnimEnd);
            };
            heartIcon.addEventListener('animationend', onAnimEnd);
        }
    }

    const commentRef = db.collection('posts').doc(postId).collection('comments').doc(commentId);
    try {
        const finalState = await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(commentRef);
            if (!doc.exists) throw new Error('댓글을 찾을 수 없습니다.');
            const commentData = doc.data() || {};
            const likedUsers = Array.isArray(commentData.likedUsers) ? commentData.likedUsers : [];
            const wasLiked = likedUsers.includes(currentUser.uid);
            const nextUsers = wasLiked
                ? likedUsers.filter(uid => uid !== currentUser.uid)
                : [...likedUsers, currentUser.uid];
            const nextLikes = Math.max(0, (Number(commentData.likes) || 0) + (wasLiked ? -1 : 1));

            transaction.update(commentRef, { likes: nextLikes, likedUsers: nextUsers });
            return { liked: !wasLiked, count: nextLikes };
        });
        applyLikeButtonState(btn, finalState.liked, finalState.count);
    } catch (error) {
        console.error("Error toggling comment like: ", error);
        try {
            const latest = await commentRef.get();
            if (latest.exists) {
                const data = latest.data() || {};
                const users = Array.isArray(data.likedUsers) ? data.likedUsers : [];
                applyLikeButtonState(btn, users.includes(currentUser.uid), data.likes);
            }
        } catch (syncError) {
            console.warn('댓글 좋아요 화면 복구 실패:', syncError);
        }
    } finally {
        if (btn) {
            delete btn.dataset.processing;
        }
    }
};

window.isMultiSelectMode = false;
window.skipCommentFlip = false;
let pressTimer;
window.ignoreNextCommentClick = false;

window.handleCommentPointerDown = function (e, cid) {
    if (window.isMultiSelectMode) return;
    if (e.target.closest('button') || e.target.closest('a') || e.target.tagName.toLowerCase() === 'input') return;

    pressTimer = setTimeout(() => {
        window.ignoreNextCommentClick = true;
        window.enterMultiSelectMode(cid);
    }, 500);
};

window.handleCommentPointerUp = function () {
    clearTimeout(pressTimer);
};

window.enterMultiSelectMode = function (targetCid) {
    window.isMultiSelectMode = true;
    history.pushState({ modal: 'commentMultiSelect' }, '', '');
    document.body.classList.add('multi-select-active');
    if (typeof window.cancelReplyTarget === 'function') {
        window.cancelReplyTarget();
    }
    const cb = document.querySelector(`.comment-select-cb[value="${targetCid}"]`);
    if (cb) {
        cb.checked = true;
    }
    updateMultiDeleteUI();
};

window.updateMultiDeleteUI = function () {
    const checkboxes = document.querySelectorAll('.comment-select-cb:checked');
    const bar = document.getElementById('multiDeleteBar');
    const cntSpan = document.getElementById('multiDeleteCount');
    const pinBtn = document.getElementById('multiPinBtn');
    if (pinBtn) pinBtn.style.display = (currentUser && isAdmin(currentUser.email)) ? 'block' : 'none';
    if (checkboxes.length > 0) {
        cntSpan.textContent = `${checkboxes.length}개 선택됨`;
        bar.style.bottom = '100px';
    } else {
        bar.style.bottom = '-250px';
    }
};

window.executeMultiPin = async function () {
    const isPresident = typeof isPresidentUser === 'function' ? isPresidentUser() : (currentUser && isAdmin(currentUser.email));
    const isPostAuthor = currentUser && window.currentPostData && (window.currentPostData.uid === currentUser.uid || window.currentPostData.authorUid === currentUser.uid);
    if (!currentUser || (!isPresident && !isPostAuthor)) return;
    const checkboxes = document.querySelectorAll('.comment-select-cb:checked');
    if (checkboxes.length === 0) return;
    if (!await window.customConfirm(`선택한 ${checkboxes.length}개의 댓글 고정 상태를 전환하시겠습니까?`, '댓글 고정 설정')) return;

    try {
        window.skipCommentFlip = true;
        const batch = db.batch();
        const pinChanges = [];
        for (let cb of checkboxes) {
            const cid = cb.value;
            const ref = db.collection('posts').doc(currentPostId).collection('comments').doc(cid);
            const doc = await ref.get();
            if (doc.exists) {
                const currentPinned = doc.data().pinned || false;
                const targetPinned = !currentPinned;
                batch.update(ref, { pinned: targetPinned });
                pinChanges.push({ commentId: cid, pinned: targetPinned });
            }
        }
        await batch.commit();
        if (window.clubNotifications?.isConfigured()) {
            Promise.allSettled(pinChanges.map((change) =>
                window.clubNotifications.notifyCommentPinChanged(currentPostId, change.commentId, change.pinned)
            )).then((results) => {
                results.forEach((result) => {
                    if (result.status === 'rejected') console.error('댓글 고정 알림 전송 오류:', result.reason);
                });
            });
        }
        cancelMultiDelete();
        setTimeout(() => { window.skipCommentFlip = false; }, 450);
    } catch (e) {
        window.skipCommentFlip = false;
        console.error("Multi pin comment error", e);
        alert('댓글 고정 중 오류가 발생했습니다.');
    }
};

window.cancelMultiDelete = function (fromPopState = false) {
    window.skipCommentFlip = true;
    window.isMultiSelectMode = false;
    document.body.classList.remove('multi-select-active');
    document.querySelectorAll('.comment-select-cb').forEach(cb => cb.checked = false);
    updateMultiDeleteUI();
    setTimeout(() => { window.skipCommentFlip = false; }, 400);
    if (!fromPopState && history.state && history.state.modal === 'commentMultiSelect') {
        window._isProgrammaticBack = true;
        history.back();
    }
};

function buildDeleteChildrenMap(comments) {
    const childrenMap = new Map();
    comments.forEach(comment => {
        if (!childrenMap.has(comment.parentId || null)) childrenMap.set(comment.parentId || null, []);
        childrenMap.get(comment.parentId || null).push(comment);
    });
    return childrenMap;
}

async function deleteSelectedComments(postId, selectedIds) {
    if (!currentUser) {
        alert('댓글을 삭제하시려면 먼저 Google 로그인을 해주세요!');
        openDrawer();
        return;
    }

    const commentsRef = db.collection('posts').doc(postId).collection('comments');
    const snap = await commentsRef.get();
    const comments = snap.docs.map(normalizeCommentDoc);
    const byId = new Map(comments.map(comment => [comment.id, comment]));
    const childrenMap = buildDeleteChildrenMap(comments);
    let blockedCount = 0;

    const toHardDelete = new Set();
    const toSoftDelete = new Set();
    const notificationCommentIds = new Set();
    const postData = window.currentPostData || {};
    const canModerateAllComments = isPresidentUser()
        || postData.uid === currentUser.uid
        || postData.authorUid === currentUser.uid;

    selectedIds.forEach(commentId => {
        const comment = byId.get(commentId);
        if (!comment || comment.deleted) return;

        const isCommentOwner = comment.uid === currentUser.uid || comment.authorUid === currentUser.uid;
        const canDelete = canModerateAllComments || isCommentOwner;
        if (!canDelete) {
            blockedCount += 1;
            return;
        }

        const children = childrenMap.get(commentId) || [];
        if (!canModerateAllComments && children.length > 0) {
            // 일반 작성자가 댓글을 지울 때 답글 작성자의 글까지 삭제하지 않고 흔적만 남깁니다.
            toSoftDelete.add(commentId);
            return;
        }

        if (canModerateAllComments) {
            // 관리 삭제는 알림 서버가 결과를 검증할 수 있도록 내용을 비운 삭제 상태로 남깁니다.
            const queue = [commentId];
            while (queue.length > 0) {
                const currentId = queue.shift();
                const currentComment = byId.get(currentId);
                if (!currentComment) continue;
                if (!currentComment.deleted) {
                    toSoftDelete.add(currentId);
                    const recipientUid = currentComment.uid || currentComment.authorUid || '';
                    if (recipientUid && recipientUid !== currentUser.uid) {
                        notificationCommentIds.add(currentId);
                    }
                }
                const kids = childrenMap.get(currentId) || [];
                kids.forEach(k => queue.push(k.id));
            }
        } else {
            toHardDelete.add(commentId);
        }
    });

    const operations = [];
    toHardDelete.forEach(commentId => {
        operations.push({ type: 'delete', ref: commentsRef.doc(commentId) });
    });

    toSoftDelete.forEach(commentId => {
        operations.push({
            type: 'update',
            ref: commentsRef.doc(commentId),
            data: {
                body: '',
                content: '',
                images: [],
                videos: [],
                audios: [],
                pdfs: [],
                htmls: [],
                imageDescriptions: {},
                deleted: true,
                deletedAt: firebase.firestore.FieldValue.serverTimestamp()
            }
        });
    });

    for (let start = 0; start < operations.length; start += 400) {
        const batch = db.batch();
        operations.slice(start, start + 400).forEach(operation => {
            if (operation.type === 'delete') batch.delete(operation.ref);
            else batch.update(operation.ref, operation.data);
        });
        await batch.commit();
    }

    if (notificationCommentIds.size > 0 && window.clubNotifications?.isConfigured()) {
        Promise.allSettled(Array.from(notificationCommentIds).map(commentId =>
            window.clubNotifications.notifyCommentDeleted(postId, commentId)
        )).then(results => {
            results.forEach(result => {
                if (result.status === 'rejected') console.error('댓글 삭제 알림 전송 오류:', result.reason);
            });
        });
    }
    if (blockedCount > 0) alert('삭제 권한이 없는 댓글은 제외했습니다.');
}

window.executeMultiDelete = async function () {
    const checkboxes = document.querySelectorAll('.comment-select-cb:checked');
    if (checkboxes.length === 0) return;
    if (!await window.customConfirm(`선택한 ${checkboxes.length}개의 댓글을 정말로 삭제하시겠습니까?`, '댓글 삭제')) return;

    const selectedIds = new Set(Array.from(checkboxes).map(cb => cb.value));
    selectedIds.forEach(cid => {
        const el = document.getElementById(`comment-${cid}`);
        if (el) {
            el.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
            el.style.opacity = '0';
            el.style.transform = 'scale(0.96)';
        }
    });
    await new Promise(resolve => setTimeout(resolve, 250));
    cancelMultiDelete(); // UI 숨기기 및 선택 해제

    try {
        await deleteSelectedComments(currentPostId, selectedIds);
    } catch (e) {
        console.error("Batch delete error:", e);
        alert("댓글 삭제 실패");
    }
};

window.deleteComment = async function (postId, commentId, isReply = false) {
    if (!currentUser) {
        alert('삭제하시려면 먼저 Google 로그인을 해주세요!');
        openDrawer();
        return;
    }

    if (!isReply) {
        const commentEl = document.getElementById(`comment-${commentId}`);
        if (commentEl && commentEl.classList.contains('comment-flat-reply')) {
            isReply = true;
        } else if (window.currentCommentDocs) {
            const doc = window.currentCommentDocs.find(c => c.id === commentId);
            if (doc && doc.parentId) {
                isReply = true;
            }
        }
    }

    const itemLabel = isReply ? '답글' : '댓글';
    if (!await window.customConfirm(`정말로 이 ${itemLabel}을 삭제하시겠습니까?`, `${itemLabel} 삭제`)) return;

    const commentEl = document.getElementById(`comment-${commentId}`);
    const commentList = document.getElementById('detailCommentList');

    if (commentList) {
        window.preDeletePositions = new Map();
        commentList.querySelectorAll('.comment-item, .comment-flat-reply').forEach(item => {
            const cid = item.getAttribute('data-id');
            if (cid !== commentId) {
                window.preDeletePositions.set(cid, item.getBoundingClientRect().top);
            }
        });
    }

    if (commentEl) {
        commentEl.classList.remove('comment-slide-in');
        commentEl.classList.add('comment-fade-out');

        setTimeout(async () => {
            try {
                commentEl.remove();
                await deleteSelectedComments(postId, new Set([commentId]));
            } catch (error) {
                console.error(`Error deleting ${itemLabel}: `, error);
                alert(`${itemLabel} 삭제 실패`);
            }
        }, 300);
    } else {
        try {
            await deleteSelectedComments(postId, new Set([commentId]));
        } catch (error) {
            console.error(`Error deleting ${itemLabel}: `, error);
            alert(`${itemLabel} 삭제 실패`);
        }
    }
};

// --- 전역 첨부파일 미리보기 및 안전 다운로드 헬퍼 ---
function parseDataUrlToText(dataUrl) {
    if (!dataUrl) return '';
    try {
        const parts = dataUrl.split(',');
        if (parts.length < 2) return '';
        const meta = parts[0];
        const rawData = parts[1];
        if (meta.includes(';base64')) {
            const binaryStr = atob(rawData);
            const len = binaryStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }
            return new TextDecoder('utf-8').decode(bytes);
        } else {
            return decodeURIComponent(rawData);
        }
    } catch (e) {
        console.error('Data URL decoding error:', e);
        return '';
    }
}

window.downloadFileAttachment = function (url, filename = 'download') {
    const safeUrl = typeof getSafeAttachmentUrl === 'function'
        ? getSafeAttachmentUrl(url, ['image/', 'video/', 'audio/', 'application/pdf', 'text/html', 'application/xhtml+xml', 'application/octet-stream'])
        : String(url || '');
    if (!safeUrl) {
        alert('안전하지 않은 파일 주소라서 열 수 없습니다.');
        return;
    }
    try {
        if (safeUrl.startsWith('data:') || safeUrl.startsWith('blob:')) {
            const a = document.createElement('a');
            a.href = safeUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else if (safeUrl.startsWith('http')) {
            fetch(safeUrl)
                .then(res => {
                    if (!res.ok) {
                        throw new Error(`Attachment request failed: HTTP ${res.status}`);
                    }
                    return res.blob();
                })
                .then(blob => {
                    if (!blob || blob.size === 0) {
                        throw new Error('Attachment response was empty');
                    }
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                })
                .catch(() => {
                    window.open(safeUrl, '_blank', 'noopener,noreferrer');
                });
        }
    } catch (e) {
        console.error('Download error:', e);
        if (safeUrl.startsWith('http')) window.open(safeUrl, '_blank', 'noopener,noreferrer');
    }
};

let currentFilePreviewBlobUrl = '';

function clearFilePreviewBlobUrl() {
    if (!currentFilePreviewBlobUrl) return;
    URL.revokeObjectURL(currentFilePreviewBlobUrl);
    currentFilePreviewBlobUrl = '';
}

window.openHtmlPreviewModal = function (url, filename = 'HTML 문서') {
    const overlay = document.getElementById('filePreviewModalOverlay');
    const modal = document.getElementById('filePreviewModal');
    const titleEl = document.getElementById('filePreviewTitle');
    const iconEl = document.getElementById('filePreviewIcon');
    const iframe = document.getElementById('filePreviewIframe');
    const downloadBtn = document.getElementById('filePreviewDownloadBtn');

    if (!overlay || !modal || !iframe) return;
    const safeUrl = typeof getSafeAttachmentUrl === 'function'
        ? getSafeAttachmentUrl(url, ['text/html', 'application/xhtml+xml'])
        : '';
    if (!safeUrl) {
        alert('안전하지 않은 HTML 파일 주소라서 미리 볼 수 없습니다.');
        return;
    }
    clearFilePreviewBlobUrl();
    iframe.setAttribute('sandbox', '');

    if (titleEl) titleEl.textContent = filename || 'HTML 미리보기';
    if (iconEl) iconEl.className = 'fa-solid fa-file-code';
    if (iconEl) iconEl.style.color = '#7c3aed';

    if (downloadBtn) {
        downloadBtn.onclick = () => window.downloadFileAttachment(safeUrl, filename);
    }

    // 초기 로딩 상태 설정
    iframe.removeAttribute('src');
    iframe.srcdoc = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif; color:#64748b; background:#f8fafc;">
            <div style="border:3px solid #e2e8f0; border-top-color:#7c3aed; border-radius:50%; width:36px; height:36px; animation:spin 0.8s linear infinite; margin-bottom:12px;"></div>
            <style>@keyframes spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}</style>
            <div style="font-size:14px; font-weight:600;">HTML 문서를 불러오는 중입니다...</div>
        </div>
    `;

    overlay.classList.add('active');
    modal.classList.add('active');

    if (safeUrl.startsWith('data:')) {
        const htmlText = parseDataUrlToText(safeUrl);
        if (htmlText) {
            iframe.srcdoc = htmlText;
        } else {
            iframe.srcdoc = '<div style="padding:2rem; font-family:sans-serif; color:#475569;">HTML 문서 내용을 표시할 수 없습니다.</div>';
        }
    } else if (safeUrl.startsWith('http')) {
        fetch(safeUrl)
            .then(res => {
                if (!res.ok) throw new Error('Network response error');
                return res.text();
            })
            .then(htmlText => {
                iframe.removeAttribute('src');
                iframe.srcdoc = htmlText;
            })
            .catch(err => {
                console.warn('HTML fetch preview error:', err);
                iframe.removeAttribute('srcdoc');
                iframe.src = safeUrl;
            });
    } else {
        iframe.removeAttribute('srcdoc');
        iframe.src = safeUrl;
    }
};

window.openPdfPreviewModal = function (url, filename = 'PDF 문서') {
    const overlay = document.getElementById('filePreviewModalOverlay');
    const modal = document.getElementById('filePreviewModal');
    const titleEl = document.getElementById('filePreviewTitle');
    const iconEl = document.getElementById('filePreviewIcon');
    const iframe = document.getElementById('filePreviewIframe');
    const downloadBtn = document.getElementById('filePreviewDownloadBtn');

    if (!overlay || !modal || !iframe) return;
    const safeUrl = typeof getSafeAttachmentUrl === 'function'
        ? getSafeAttachmentUrl(url, ['application/pdf'])
        : '';
    if (!safeUrl) {
        alert('안전하지 않은 PDF 파일 주소라서 미리 볼 수 없습니다.');
        return;
    }
    clearFilePreviewBlobUrl();
    // Chrome의 내장 PDF 뷰어는 sandbox 안의 blob URL을 차단할 수 있으므로
    // 검증된 원본 PDF 주소를 iframe에서 직접 엽니다.
    iframe.removeAttribute('sandbox');

    if (titleEl) titleEl.textContent = filename || 'PDF 미리보기';
    if (iconEl) iconEl.className = 'fa-solid fa-file-pdf';
    if (iconEl) iconEl.style.color = '#ea580c';

    if (downloadBtn) {
        downloadBtn.onclick = () => window.downloadFileAttachment(safeUrl, filename);
    }

    iframe.removeAttribute('src');
    iframe.srcdoc = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif; color:#64748b; background:#f8fafc;">
            <div style="border:3px solid #e2e8f0; border-top-color:#ea580c; border-radius:50%; width:36px; height:36px; animation:spin 0.8s linear infinite; margin-bottom:12px;"></div>
            <style>@keyframes spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}</style>
            <div style="font-size:14px; font-weight:600;">PDF 문서를 불러오는 중입니다...</div>
        </div>
    `;

    overlay.classList.add('active');
    modal.classList.add('active');

    if (safeUrl.startsWith('data:')) {
        try {
            const arr = safeUrl.split(',');
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) u8arr[n] = bstr.charCodeAt(n);
            const blob = new Blob([u8arr], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);
            currentFilePreviewBlobUrl = blobUrl;
            iframe.removeAttribute('srcdoc');
            iframe.src = blobUrl;
        } catch (e) {
            iframe.removeAttribute('srcdoc');
            iframe.src = safeUrl;
        }
    } else if (safeUrl.startsWith('http')) {
        fetch(safeUrl)
            .then(res => {
                if (!res.ok) throw new Error('PDF fetch error');
                return res.blob();
            })
            .then(() => {
                iframe.removeAttribute('srcdoc');
                iframe.src = safeUrl;
            })
            .catch(err => {
                console.warn('PDF fetch preview error:', err);
                iframe.removeAttribute('srcdoc');
                iframe.src = `https://docs.google.com/viewer?url=${encodeURIComponent(safeUrl)}&embedded=true`;
            });
    } else {
        iframe.removeAttribute('srcdoc');
        iframe.src = safeUrl;
    }
};

window.closeFilePreviewModal = function () {
    const overlay = document.getElementById('filePreviewModalOverlay');
    const modal = document.getElementById('filePreviewModal');
    const iframe = document.getElementById('filePreviewIframe');

    if (overlay) overlay.classList.remove('active');
    if (modal) modal.classList.remove('active');
    if (iframe) {
        iframe.removeAttribute('srcdoc');
        iframe.src = 'about:blank';
        iframe.setAttribute('sandbox', '');
    }
    clearFilePreviewBlobUrl();
};

document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('filePreviewCloseBtn');
    const overlay = document.getElementById('filePreviewModalOverlay');
    if (closeBtn) closeBtn.addEventListener('click', window.closeFilePreviewModal);
    if (overlay) overlay.addEventListener('click', window.closeFilePreviewModal);
});
