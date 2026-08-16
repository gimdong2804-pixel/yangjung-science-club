// 게시글 상세 화면과 좋아요·수정·삭제, 댓글 관리 기능
function closeSideDetail(e) {
    const fromPopState = (e === true);
    const sideDetailContainer = document.getElementById('sideDetailContainer');
    const writePostBtn = document.getElementById('writePostBtn');

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
            ? '<i class="fa-solid fa-file-lines"></i> 건의글 상세'
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
        const viewedBy = post.viewedBy || [];
        if (!viewedBy.includes(currentUser.uid)) {
            db.collection('posts').doc(id).update({
                views: firebase.firestore.FieldValue.increment(1),
                viewedBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
            });
        }
    } else {
        const viewedPosts = JSON.parse(localStorage.getItem('viewedPosts') || '[]');
        if (!viewedPosts.includes(id)) {
            viewedPosts.push(id);
            localStorage.setItem('viewedPosts', JSON.stringify(viewedPosts));
            db.collection('posts').doc(id).update({ views: firebase.firestore.FieldValue.increment(1) });
        }
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

            // 삭제 버튼 (작성자 또는 회장)
            const deleteBtnHtml = isAuthor ? `
                        <button type="button" class="board-action-btn delete-btn" onclick="event.stopPropagation(); deletePost('${id}')" title="삭제하기">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    ` : '';

            // 수정 버튼 (작성자 또는 회장)
            const editBtnHtml = isAuthor ? `
                        <button type="button" class="board-action-btn edit-btn role-edit-btn" onclick="event.stopPropagation(); editPost('${id}')" title="수정하기" style="color: #007bff !important;">
                            <i class="fa-solid fa-pen-to-square" style="color: #007bff !important;"></i>
                        </button>
                    ` : '';

            // 고정 버튼 (회장, 사장 전용)
            const pinBtnHtml = isPresident ? `
                        <button type="button" class="board-action-btn pin-toggle-btn ${currentPost.pinned ? 'active' : ''}" onclick="event.stopPropagation(); togglePin('${id}', ${currentPost.pinned || false})" title="${currentPost.pinned ? '고정 해제' : '상단 고정'}">
                            <i class="fa-solid fa-thumbtack"></i>
                        </button>
                    ` : '';

            const isLiked = currentUser && currentPost.likedUsers && currentPost.likedUsers.includes(currentUser.uid);
            const existingTopCountEl = document.getElementById('detailTopCommentCount');
            const currentTopCount = existingTopCountEl ? existingTopCountEl.innerText : '0';

            const heartClass = isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
            const heartColor = isLiked ? 'color: #ff6b6b;' : 'color: var(--text-primary);';

            // 첨부파일 및 이미지 자동 분류 및 정제
            const rawImages = currentPost.images || [];
            const rawAttachments = currentPost.attachments || [];

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
                    name = img.name || '첨부파일';
                    type = img.type || '';
                }

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
                    name = att.name || '첨부파일';
                    type = att.type || '';
                }

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

            area.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <div style="color: var(--accent-color); font-size: 0.85rem; font-weight: 600;">커뮤니티 · 게시글</div>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                ${pinBtnHtml}
                                ${deleteBtnHtml}
                                ${editBtnHtml}
                            </div>
                        </div>
                        <h2 class="post-body-title" style="margin-bottom: 0.5rem; font-size: 1.6rem; color: var(--text-primary); word-break: break-word; overflow-wrap: anywhere;">${currentPost.title}</h2>
                        <div style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1.5rem;">
                            ${timeStr} &nbsp;|&nbsp; 조회 ${currentPost.views || 0}회
                        </div>
                        
                        <div class="board-card-header" style="margin-bottom: 2rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 1rem;">
                            <div class="board-author" style="flex: 1;">
                                ${avatar}
                                <span class="board-author-name" style="font-weight: 600; font-size: 1rem;">${currentPost.author}</span>
                            </div>
                            <div class="board-stats" style="font-size: 0.95rem;">
                                <span style="cursor: default; user-select: none; margin-right: 0.8rem;"><i class="fa-regular fa-comment"></i> <span id="detailTopCommentCount">${currentTopCount}</span></span>
                                <button type="button" class="board-action-btn" onclick="likePost('${id}', this)" id="detailLikeBtn" title="좋아요">
                                    <i class="${heartClass}" style="${isLiked ? 'color: #ff6b6b;' : ''}"></i> <span id="detailLikeCnt" class="like-count">${currentPost.likes || 0}</span>
                                </button>
                            </div>
                        </div>
                        
                        <div class="post-body" style="font-size: 1.05rem; line-height: 1.7; color: var(--text-primary); padding-bottom: 1rem;">
                            ${typeof window.renderTextWithYoutubeLinks === 'function' ? window.renderTextWithYoutubeLinks(currentPost.body.replace(/\n/g, '<br>')) : currentPost.body.replace(/\n/g, '<br>')}
                        </div>

                        ${displayImages.length > 0 ? `
                            <div class="post-image-gallery">
                                ${displayImages.map((imgObj, imgIdx) => `<img src="${escapeHtml(imgObj.url)}" alt="게시글 첨부 사진" style="cursor: pointer;" onclick="openLightbox('${toJsString(imgObj.url)}', {postId:'${currentPostId}', commentId:null, authorUid:'${currentPost.uid || ''}', imageIndex:${imgIdx}})">`).join('')}
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

                const attName = att.name || '첨부파일';
                const lowerAttName = attName.toLowerCase();
                const lowerAttUrl = (att.url || '').toLowerCase();
                const type = (att.type || '').toLowerCase();

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

        const topCountEl = document.getElementById('detailTopCommentCount');
        if (topCountEl) topCountEl.innerText = snap.size;
        const detailCommentCount = document.getElementById('detailCommentCount');
        if (detailCommentCount) detailCommentCount.innerText = snap.size;

        const commentList = document.getElementById('detailCommentList');
        if (!commentList) return;

        // 1. 이전 위치 백업
        const oldPositions = new Map();
        commentList.querySelectorAll('.comment-item').forEach(item => {
            const cid = item.getAttribute('data-id');
            const opacity = window.getComputedStyle(item).opacity;
            oldPositions.set(cid, { rect: item.getBoundingClientRect(), opacity });
        });

        // 2. 현재 스냅샷 ID 목록
        const currentIds = new Set(snap.docs.map(doc => doc.id));

        // 3. 삭제된 댓글 제거 (애니메이션)
        const itemsToDelete = [];
        commentList.querySelectorAll('.comment-item').forEach(item => {
            if (!currentIds.has(item.getAttribute('data-id')) && !item.classList.contains('deleting')) {
                item.classList.add('deleting');
                item.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                item.style.opacity = '0';
                item.style.transform = 'scale(0.95)';
                itemsToDelete.push(item);
            }
        });

        if (itemsToDelete.length > 0) {
            setTimeout(() => {
                // 지워지기 직전 남아있는 아이템들의 위치 백업
                const beforeRemovePositions = new Map();
                commentList.querySelectorAll('.comment-item:not(.deleting)').forEach(el => {
                    beforeRemovePositions.set(el.getAttribute('data-id'), el.getBoundingClientRect());
                });

                itemsToDelete.forEach(item => item.remove()); // DOM에서 일괄 제거

                // 제거 후 남아있는 아이템들이 빈 공간으로 자연스럽게 밀려 올라가는 애니메이션 (FLIP)
                requestAnimationFrame(() => {
                    commentList.querySelectorAll('.comment-item:not(.deleting)').forEach(el => {
                        const id = el.getAttribute('data-id');
                        const oldR = beforeRemovePositions.get(id);
                        if (oldR) {
                            const newR = el.getBoundingClientRect();
                            const deltaY = oldR.top - newR.top;
                            if (Math.abs(deltaY) > 1) {
                                el.style.transform = `translateY(${deltaY}px)`;
                                el.style.transition = 'none';
                                el.offsetHeight; // 플로우 강제 리페인트 (버그 수정)

                                // 거리 비례 속도 자동 조절 (최소 0.35초 ~ 최대 1.0초)
                                const distance = Math.abs(deltaY);
                                const duration = Math.min(Math.max(0.35, distance / 600), 1.0);

                                requestAnimationFrame(() => {
                                    el.style.transform = '';
                                    el.style.transition = `transform ${duration}s cubic-bezier(0.16, 1, 0.3, 1)`;
                                });
                            }
                        }
                    });
                });
            }, 300);
        }

        // 클라이언트 단에서 정렬: pinned가 참이면 위로, 그 다음 작성일 순 정렬
        const sortedDocs = [...snap.docs].sort((a, b) => {
            const pinA = a.data().pinned ? 1 : 0;
            const pinB = b.data().pinned ? 1 : 0;
            if (pinB !== pinA) {
                return pinB - pinA; // 고정이 위로
            }
            const timeA = (a.data().createdAt && typeof a.data().createdAt.toMillis === 'function') ? a.data().createdAt.toMillis() : (a.data().createdAt instanceof Date ? a.data().createdAt.getTime() : Date.now());
            const timeB = (b.data().createdAt && typeof b.data().createdAt.toMillis === 'function') ? b.data().createdAt.toMillis() : (b.data().createdAt instanceof Date ? b.data().createdAt.getTime() : Date.now());
            return timeB - timeA; // 작성일 내림차순 (최신순)
        });

        sortedDocs.forEach((cDoc, index) => {
            const c = cDoc.data();
            const cid = cDoc.id;
            const cTime = formatDate(c.createdAt) + (c.edited && !c.deleted ? ' <span style="font-size: 0.8em; color: var(--text-secondary);">(수정됨)</span>' : '');
            const isPresidentComment = c.author.includes('회장') || (c.email && isAdmin(c.email));
            const badge = isPresidentComment ? '<span class="official-badge" style="background: var(--accent-color); color: #fff; font-size: 0.75rem; padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: bold; margin-left: 0.5rem; white-space: nowrap; flex-shrink: 0;">공식 답변</span>' : '';

            const cPinBadge = `<div class="pin-badge-wrapper ${c.pinned ? 'active' : ''}">
                                        <span class="pin-badge-ui" style="background: var(--accent-color); color: #fff; font-size: 0.7rem; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: bold; display: inline-block;">
                                            <i class="fa-solid fa-thumbtack"></i> 상단 고정
                                        </span>
                                    </div>`;

            let cAvatarHtml = `<div class="board-author-avatar" style="background: ${isPresidentComment ? 'var(--accent-color)' : '#9ca3af'}; width: 32px; height: 32px; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #fff;">${isPresidentComment ? '<i class="fa-solid fa-crown" style="font-size: 0.6rem;"></i>' : c.author.substring(0, 1)}</div>`;
            if (c.userPhoto) {
                cAvatarHtml = `<img class="board-author-avatar" src="${c.userPhoto}" alt="${c.author}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 50%; border: 1px solid var(--glass-border);" decoding="sync">`;
            }

            const isCommentAuthor = currentUser && (c.uid === currentUser.uid || isAdmin(currentUser.email));
            const isPresident = typeof isPresidentUser === 'function' ? isPresidentUser() : (currentUser && isAdmin(currentUser.email));
            const isPostAuthor = currentUser && window.currentPostData && (window.currentPostData.uid === currentUser.uid || window.currentPostData.email === currentUser.email);
            const canDelete = isPresident || isCommentAuthor;
            const canEdit = isPresident || isCommentAuthor;
            const canPin = !c.deleted && (isPresident || isPostAuthor);

            const cCheckbox = canDelete ? `
                        <label class="comment-checkbox-wrapper" style="align-items: center; margin-top: 0.2rem; padding-right: 0;">
                            <input type="checkbox" class="comment-select-cb" value="${cid}" onchange="updateMultiDeleteUI()" style="width: 1.1rem; height: 1.1rem; accent-color: var(--accent-color); cursor: pointer;">
                        </label>
                    ` : '';

            const cDeleteBtn = canDelete ? `
                        <button type="button" class="board-action-btn delete-btn" onclick="deleteComment('${id}', '${cid}')" title="댓글 삭제" style="color: #ff6b6b !important;">
                            <i class="fa-solid fa-trash-can" style="color: #ff6b6b !important;"></i>
                        </button>
                    ` : '';
            const cEditBtn = canEdit ? `
                        <button type="button" class="board-action-btn edit-btn role-edit-btn" onclick="event.stopPropagation(); editComment('${id}', '${cid}')" title="댓글 수정" style="color: #007bff !important;">
                            <i class="fa-solid fa-pen-to-square" style="color: #007bff !important;"></i>
                        </button>
                    ` : '';

            const cPinBtn = canPin ? `
                        <button type="button" class="board-action-btn pin-toggle-btn ${c.pinned ? 'active' : ''}" onclick="togglePinComment('${id}', '${cid}', ${c.pinned || false})" title="${c.pinned ? '댓글 고정 해제' : '댓글 고정'}">
                            <i class="fa-solid fa-thumbtack"></i>
                        </button>
                    ` : '';

            const isLiked = c.likedUsers && currentUser ? c.likedUsers.includes(currentUser.uid) : false;
            const cLikeClass = isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
            const cLikeBtn = `
                        <button type="button" class="board-action-btn c-like-btn" onclick="toggleLikeComment('${id}', '${cid}', this, ${isLiked})" title="좋아요">
                            <i class="${cLikeClass}" style="${isLiked ? 'color: #ff6b6b;' : ''}"></i> <span class="c-like-cnt like-count" style="margin-left: 0.1rem;">${c.likes || 0}</span>
                        </button>
                    `;

            const cItemStyle = 'border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 1rem; transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, padding-left 0.3s ease, border-radius 0.3s ease;';

            let item = commentList.querySelector(`.comment-item[data-id="${cid}"]`);
            const isNew = !item;

            if (isNew) {
                const innerHtml = `
                            ${cPinBadge}
                            <div style="display: flex; align-items: flex-start; width: 100%;">
                                ${cCheckbox}
                                ${cAvatarHtml}
                                <div class="comment-content" style="flex: 1; min-width: 0; padding-top: 0.2rem; margin-left: 0.75rem;">
                                    <div class="comment-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: nowrap; margin-bottom: 0.4rem;">
                                        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: nowrap; min-width: 0;">
                                            <span class="board-author-name" style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.author}</span>
                                            ${badge}
                                        </div>
                                        <div class="comment-actions" style="display: flex; align-items: center; gap: 0.5rem;">
                                            <div class="mobile-hide" style="display: flex; align-items: center; gap: 0.5rem;">
                                                ${cPinBtn}
                                                ${cDeleteBtn}
                                                ${cEditBtn}
                                            </div>
                                            <span class="board-time" style="font-weight: 400;">${cTime}</span>
                                        </div>
                                    </div>
                                    <div class="comment-text" style="font-size: 0.95rem; line-height: 1.5; color: var(--text-primary); word-break: break-all; margin-bottom: 0.8rem;">${c.body}</div>
                                    <div class="comment-footer" style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: nowrap; width: 100%;">
                                        <div class="mobile-show" style="display: none; align-items: center; gap: 0.5rem; flex-shrink: 0;">
                                            ${cPinBtn}
                                            ${cDeleteBtn}
                                            ${cEditBtn}
                                        </div>
                                        <div class="board-stats" style="margin-left: auto; flex-shrink: 0;">
                                            ${cLikeBtn}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                item = document.createElement('div');
                item.className = 'comment-item new-comment-flip';
                item.setAttribute('data-id', cid);
                item.setAttribute('data-pinned', c.pinned ? 'true' : 'false');
                item.style.cssText = `margin-bottom: 1.25rem; ${cItemStyle}`;
                item.innerHTML = innerHtml;
                item.style.order = index;

                // 다중 선택(꾹 누르기) 이벤트 등록
                if (canDelete) {
                    item.addEventListener('pointerdown', (e) => window.handleCommentPointerDown(e, cid));
                    item.addEventListener('pointerup', window.handleCommentPointerUp);
                    item.addEventListener('pointercancel', window.handleCommentPointerUp);
                    item.addEventListener('pointerleave', window.handleCommentPointerUp);
                    item.addEventListener('contextmenu', (e) => {
                        if (window.isMultiSelectMode) {
                            e.preventDefault();
                        }
                    });
                    item.addEventListener('click', (e) => {
                        if (window.ignoreNextCommentClick) {
                            window.ignoreNextCommentClick = false;
                            e.preventDefault();
                            e.stopPropagation();
                            return;
                        }
                        if (window.isMultiSelectMode) {
                            if (e.target.classList.contains('comment-select-cb') || e.target.closest('label')) {
                                return;
                            }
                            e.preventDefault();
                            e.stopPropagation();
                            const cb = item.querySelector('.comment-select-cb');
                            if (cb) {
                                cb.checked = !cb.checked;
                                updateMultiDeleteUI();
                            }
                        }
                    });
                }

                commentList.appendChild(item);
            } else {
                const wasPinned = item.getAttribute('data-pinned') === 'true';
                if (wasPinned !== !!c.pinned) {
                    item.style.cssText = `margin-bottom: 1.25rem; ${cItemStyle}`;
                    item.setAttribute('data-pinned', c.pinned ? 'true' : 'false');
                }

                if (item.style.order !== String(index)) {
                    item.style.order = index;
                }

                const pinBadgeEl = item.querySelector('.pin-badge-wrapper');
                if (pinBadgeEl) {
                    pinBadgeEl.className = 'pin-badge-wrapper ' + (c.pinned ? 'active' : '');
                }

                const pinBtnEls = item.querySelectorAll('.pin-toggle-btn');
                pinBtnEls.forEach(pinBtnEl => {
                    pinBtnEl.classList.toggle('active', !!c.pinned);
                    pinBtnEl.title = c.pinned ? '댓글 고정 해제' : '댓글 고정';
                    pinBtnEl.setAttribute('onclick', `togglePinComment('${id}', '${cid}', ${c.pinned || false})`);
                });

                const likeBtnEl = item.querySelector('.c-like-btn');
                if (likeBtnEl) {
                    const isLiked = c.likedUsers && currentUser ? c.likedUsers.includes(currentUser.uid) : false;
                    const icon = likeBtnEl.querySelector('i');
                    const cnt = likeBtnEl.querySelector('.c-like-cnt');
                    if (icon) {
                        if (!icon.classList.contains('animate-heart') && !icon.classList.contains('animate-heart-cancel')) {
                            if (isLiked) {
                                icon.classList.remove('fa-regular');
                                icon.classList.add('fa-solid');
                                icon.style.color = '#ff6b6b';
                            } else {
                                icon.classList.remove('fa-solid');
                                icon.classList.add('fa-regular');
                                icon.style.color = '';
                            }
                        }
                    }
                    if (cnt) cnt.textContent = c.likes || 0;
                    likeBtnEl.setAttribute('onclick', `toggleLikeComment('${id}', '${cid}', this, ${isLiked})`);
                }
            }
        });

        // 5. FLIP 애니메이션 실행 (선택 해제 중에는 건너뛰기)
        if (window.skipCommentFlip) return;
        requestAnimationFrame(() => {
            commentList.querySelectorAll('.comment-item').forEach(item => {
                const cid = item.getAttribute('data-id');
                const oldData = oldPositions.get(cid);
                if (oldData) {
                    const newRect = item.getBoundingClientRect();
                    const deltaY = oldData.rect.top - newRect.top;

                    if (parseFloat(oldData.opacity) < 1) {
                        item.style.opacity = oldData.opacity;
                        requestAnimationFrame(() => {
                            item.style.transition = 'opacity 0.4s ease';
                            item.style.opacity = '1';
                        });
                    }

                    if (Math.abs(deltaY) > 1) {
                        item.style.transform = `translateY(${deltaY}px)`;
                        item.style.transition = 'none';
                        item.offsetHeight; // 플로우 강제 리페인트 (버그 수정)
                        requestAnimationFrame(() => {
                            item.classList.add('flipping');
                            item.style.transform = '';
                            item.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s ease, border-color 0.3s ease, box-shadow 0.4s ease, border-radius 0.3s ease';
                            setTimeout(() => {
                                item.classList.remove('flipping');
                                item.style.transition = '';
                            }, 400);
                        });
                    }
                } else if (item.classList.contains('new-comment-flip')) {
                    // 기존 댓글들이 먼저 내려가서 빈 공간을 만든 뒤에 나타나도록 지연(delay) 적용
                    item.style.opacity = '0';
                    item.style.transform = 'scale(0.95)';
                    item.style.transition = 'none';
                    item.offsetHeight; // 플로우 강제 리페인트 (버그 수정)

                    requestAnimationFrame(() => {
                        item.style.opacity = '1';
                        item.style.transform = 'scale(1)';
                        item.style.transition = 'opacity 0.3s ease 0.2s, transform 0.3s ease 0.2s';
                        item.classList.remove('new-comment-flip');
                    });
                }
            });
        });
    });

    // openPostDetail 하단에 있던 중복 hidden 제거 로직은 함수 내부(상단)로 옮겼으므로 여기서는 삭제합니다.
}

// 상세 닫기 이벤트 바인딩
const closeSideDetailBtn = document.getElementById('closeSideDetailBtn');
if (closeSideDetailBtn) {
    closeSideDetailBtn.addEventListener('click', closeSideDetail);
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
        const doc = await postRef.get();
        if (doc.exists) {
            const postData = doc.data();
            const likedUsers = postData.likedUsers || [];
            const isLiked = likedUsers.includes(currentUser.uid);

            if (isLiked) {
                await postRef.update({
                    likes: firebase.firestore.FieldValue.increment(-1),
                    likedUsers: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
                });
            } else {
                await postRef.update({
                    likes: firebase.firestore.FieldValue.increment(1),
                    likedUsers: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                });
            }
        }
    } catch (error) {
        console.error("Error toggling like: ", error);
    } finally {
        if (btnEl) {
            delete btnEl.dataset.processing;
        }
    }
};

window.togglePin = async function (id, currentPinned) {
    if (!currentUser || !isAdmin(currentUser.email)) return;
    const btn = window.event ? (window.event.currentTarget || window.event.target.closest('.pin-toggle-btn')) : null;
    let isPinned = currentPinned;
    if (btn) {
        isPinned = btn.classList.contains('active');
        btn.classList.toggle('active', !isPinned);
        btn.classList.remove('animate-pin-action');
        void btn.offsetWidth;
        btn.classList.add('animate-pin-action');
        btn.title = !isPinned ? '고정 해제' : '상단 고정';
    }
    try {
        await db.collection('posts').doc(id).update({ pinned: !isPinned });
    } catch (e) { console.error(e); }
};

window.togglePinComment = async function (postId, commentId, currentPinned) {
    const isPresident = typeof isPresidentUser === 'function' ? isPresidentUser() : (currentUser && isAdmin(currentUser.email));
    const isPostAuthor = currentUser && window.currentPostData && (window.currentPostData.uid === currentUser.uid || window.currentPostData.email === currentUser.email);
    if (!currentUser || (!isPresident && !isPostAuthor)) return;
    const btn = window.event ? (window.event.currentTarget || window.event.target.closest('.pin-toggle-btn')) : null;
    let isPinned = currentPinned;
    if (btn) {
        isPinned = btn.classList.contains('active');
        btn.classList.toggle('active', !isPinned);
        btn.classList.remove('animate-pin-action');
        void btn.offsetWidth;
        btn.classList.add('animate-pin-action');
        btn.title = !isPinned ? '고정 해제' : '상단 고정';
    }
    try {
        await db.collection('posts').doc(postId).collection('comments').doc(commentId).update({ pinned: !isPinned });
    } catch (e) { console.error(e); }
};

window.deletePostWithAnim = async function (id, btn) {
    if (!await window.customConfirm('정말 이 게시글을 삭제하시겠습니까?', '게시글 삭제')) return;
    const card = btn.closest('.board-card');
    if (card) {
        card.classList.add('deleting');
        setTimeout(async () => {
            try {
                await db.collection('posts').doc(id).delete();
            } catch (error) {
                console.error("Error deleting post: ", error);
                alert('삭제 중 오류가 발생했습니다.');
            }
        }, 300);
    } else {
        deletePost(id);
    }
};

window.deletePost = async function (id) {
    if (!await window.customConfirm('정말로 이 게시글을 삭제하시겠습니까?', '게시글 삭제')) return;
    try {
        await db.collection('posts').doc(id).delete();
        alert('게시글이 성공적으로 삭제되었습니다.');
        closeSideDetail();
    } catch (error) {
        console.error("Error deleting post: ", error);
        alert('삭제 중 오류가 발생했습니다.');
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

    // DB 업데이트
    try {
        const commentRef = db.collection('posts').doc(postId).collection('comments').doc(commentId);
        const doc = await commentRef.get();
        if (doc.exists) {
            const commentData = doc.data();
            const likedUsers = commentData.likedUsers || [];
            const actualIsLiked = likedUsers.includes(currentUser.uid);

            if (actualIsLiked) {
                await commentRef.update({
                    likes: firebase.firestore.FieldValue.increment(-1),
                    likedUsers: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
                });
            } else {
                await commentRef.update({
                    likes: firebase.firestore.FieldValue.increment(1),
                    likedUsers: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                });
            }
        }
    } catch (error) {
        console.error("Error toggling comment like: ", error);
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
    const isPostAuthor = currentUser && window.currentPostData && (window.currentPostData.uid === currentUser.uid || window.currentPostData.email === currentUser.email);
    if (!currentUser || (!isPresident && !isPostAuthor)) return;
    const checkboxes = document.querySelectorAll('.comment-select-cb:checked');
    if (checkboxes.length === 0) return;
    if (!await window.customConfirm(`선택한 ${checkboxes.length}개의 댓글 고정 상태를 전환하시겠습니까?`, '댓글 고정 설정')) return;

    try {
        window.skipCommentFlip = true;
        const batch = db.batch();
        for (let cb of checkboxes) {
            const cid = cb.value;
            const ref = db.collection('posts').doc(currentPostId).collection('comments').doc(cid);
            const doc = await ref.get();
            if (doc.exists) {
                const currentPinned = doc.data().pinned || false;
                batch.update(ref, { pinned: !currentPinned });
            }
        }
        await batch.commit();
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
    const batch = db.batch();
    let blockedCount = 0;
    let changedCount = 0;

    const toDelete = new Set();

    selectedIds.forEach(commentId => {
        const comment = byId.get(commentId);
        if (!comment) return;

        const canDelete = isPresidentUser() || comment.uid === currentUser.uid;
        if (!canDelete) {
            blockedCount += 1;
            return;
        }

        // 권한이 있는 경우, 해당 댓글과 모든 대댓글을 삭제 목록에 추가
        const queue = [commentId];
        while (queue.length > 0) {
            const currentId = queue.shift();
            if (!toDelete.has(currentId)) {
                toDelete.add(currentId);
                const kids = childrenMap.get(currentId) || [];
                kids.forEach(k => queue.push(k.id));
            }
        }
    });

    toDelete.forEach(commentId => {
        batch.delete(commentsRef.doc(commentId));
        changedCount += 1;
    });

    if (changedCount > 0) await batch.commit();
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
    if (!url) return;
    try {
        if (url.startsWith('data:') || url.startsWith('blob:')) {
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else if (url.startsWith('http')) {
            fetch(url)
                .then(res => res.blob())
                .then(blob => {
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
                    window.open(url, '_blank');
                });
        } else {
            window.open(url, '_blank');
        }
    } catch (e) {
        console.error('Download error:', e);
        window.open(url, '_blank');
    }
};

window.openHtmlPreviewModal = function (url, filename = 'HTML 문서') {
    const overlay = document.getElementById('filePreviewModalOverlay');
    const modal = document.getElementById('filePreviewModal');
    const titleEl = document.getElementById('filePreviewTitle');
    const iconEl = document.getElementById('filePreviewIcon');
    const iframe = document.getElementById('filePreviewIframe');
    const downloadBtn = document.getElementById('filePreviewDownloadBtn');

    if (!overlay || !modal || !iframe) return;

    if (titleEl) titleEl.textContent = filename || 'HTML 미리보기';
    if (iconEl) iconEl.className = 'fa-solid fa-file-code';
    if (iconEl) iconEl.style.color = '#7c3aed';

    if (downloadBtn) {
        downloadBtn.onclick = () => window.downloadFileAttachment(url, filename);
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

    if (url.startsWith('data:')) {
        const htmlText = parseDataUrlToText(url);
        if (htmlText) {
            iframe.srcdoc = htmlText;
        } else {
            iframe.srcdoc = '<div style="padding:2rem; font-family:sans-serif; color:#475569;">HTML 문서 내용을 표시할 수 없습니다.</div>';
        }
    } else if (url.startsWith('http')) {
        fetch(url)
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
                iframe.src = url;
            });
    } else {
        iframe.removeAttribute('srcdoc');
        iframe.src = url;
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

    if (titleEl) titleEl.textContent = filename || 'PDF 미리보기';
    if (iconEl) iconEl.className = 'fa-solid fa-file-pdf';
    if (iconEl) iconEl.style.color = '#ea580c';

    if (downloadBtn) {
        downloadBtn.onclick = () => window.downloadFileAttachment(url, filename);
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

    if (url.startsWith('data:')) {
        try {
            const arr = url.split(',');
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) u8arr[n] = bstr.charCodeAt(n);
            const blob = new Blob([u8arr], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);
            iframe.removeAttribute('srcdoc');
            iframe.src = blobUrl;
        } catch (e) {
            iframe.removeAttribute('srcdoc');
            iframe.src = url;
        }
    } else if (url.startsWith('http')) {
        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error('PDF fetch error');
                return res.blob();
            })
            .then(blob => {
                const pdfBlob = new Blob([blob], { type: 'application/pdf' });
                const blobUrl = URL.createObjectURL(pdfBlob);
                iframe.removeAttribute('srcdoc');
                iframe.src = blobUrl;
            })
            .catch(err => {
                console.warn('PDF fetch preview error:', err);
                iframe.removeAttribute('srcdoc');
                iframe.src = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
            });
    } else {
        iframe.removeAttribute('srcdoc');
        iframe.src = url;
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
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('filePreviewCloseBtn');
    const overlay = document.getElementById('filePreviewModalOverlay');
    if (closeBtn) closeBtn.addEventListener('click', window.closeFilePreviewModal);
    if (overlay) overlay.addEventListener('click', window.closeFilePreviewModal);
});


