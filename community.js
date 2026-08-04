// 커뮤니티 전용 모듈
var db = window.db || firebase.firestore();
var auth = window.auth || firebase.auth();

if (!window.hasOwnProperty('_currentPostId')) {
    window._currentPostId = null;
    try {
        Object.defineProperty(window, 'currentPostId', {
            get() { return window._currentPostId; },
            set(val) { window._currentPostId = val; },
            configurable: true,
            enumerable: true
        });
    } catch (e) {
        console.warn(e);
    }
}

// 로그인 상태 변수
let currentUser = null;

// Firestore 리스너 구독 해제 변수 (TDZ 방지를 위해 상단 선언)
var postsUnsubscribe = null;
var postUnsubscribe = null;

// 관리자 이메일 목록 (회장 + 사장)
const ADMIN_EMAILS = ['gimdong2804@gmail.com', 'sjh20110407@gmail.com'];
function isAdmin(email) { return ADMIN_EMAILS.includes(email); }
function getAdminName(email) {
    const names = { 'gimdong2804@gmail.com': '회장 김동현', 'sjh20110407@gmail.com': '사장' };
    return names[email] || null;
}

// 개발 모드: URL에 ?dev=true 붙이거나 localStorage 설정 시 로그인 없이 테스트 가능
let isDevMode = new URLSearchParams(window.location.search).get('dev') === 'true' || localStorage.getItem('dev_mode') === 'true';
if (isDevMode) {
    currentUser = {
        uid: 'dev-test-president',
        email: 'gimdong2804@gmail.com',
        displayName: '회장 김동현',
        photoURL: '',
    };
    console.log('%c[개발/테스트 모드] 회장 계정으로 접속 중', 'color: #10b981; font-weight: bold;');
}
// 구글 로그인 관련 DOM
const googleLoginBtn = document.getElementById('googleLoginBtn');
const userProfileInfo = document.getElementById('userProfileInfo');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const logoutBtn = document.getElementById('logoutBtn');

const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

function showLoginError(error) {
    console.error("Google Sign-In Error: ", error);
    if (error && (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request')) {
        return;
    }
    if (error && error.code === 'auth/unauthorized-domain') {
        alert(`[Firebase 승인 도메인 설정 필요]\n\n현재 사이트 도메인(${window.location.hostname})이 Firebase 인증의 Authorized Domains에 등록되어 있지 않습니다.\n\nFirebase 콘솔 > Authentication > Settings > Authorized domains 에 아래 도메인을 추가해주세요:\n${window.location.hostname}`);
        return;
    }
    alert("로그인 중 오류가 발생했습니다: " + ((error && error.message) || "알 수 없는 오류"));
}

// 구글 로그인 연동
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
        try {
            googleLoginBtn.disabled = true;
            await auth.signInWithPopup(googleProvider);
            googleLoginBtn.disabled = false;
        } catch (error) {
            googleLoginBtn.disabled = false;
            showLoginError(error);
        }
    });
}

// 로그아웃
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            if (isDevMode) {
                localStorage.removeItem('dev_mode');
                const url = new URL(window.location.href);
                url.searchParams.delete('dev');
                window.location.href = url.pathname;
                return;
            }
            await auth.signOut();
        } catch (error) {
            console.error("Sign-Out Error: ", error);
        }
    });
}

// Auth 상태 리스너
let authUITimeout;
auth.onAuthStateChanged(async (user) => {
    // 개발 모드에서는 Auth 리스너가 currentUser를 덮어쓰지 않음
    if (isDevMode) {
        // 개발 모드 UI: 로그인 버튼 숨기고 프로필 표시
        googleLoginBtn.classList.add('hidden');
        userProfileInfo.classList.remove('hidden');
        userName.innerText = '회장 김동현';
        userEmail.innerText = 'gimdong2804@gmail.com';
        userAvatar.src = '';
        const postAuthorInput = document.getElementById('postAuthor');
        if (postAuthorInput) {
            postAuthorInput.value = '회장 김동현';
            postAuthorInput.placeholder = '작성자 이름';
        }
        const currentSort = document.querySelector('.custom-dropdown-option.active')?.getAttribute('data-value') || 'latest';
        loadPosts(currentSort);
        return;
    }
    clearTimeout(authUITimeout);
    const postAuthorInput = document.getElementById('postAuthor');
    if (user) {
        currentUser = user;

        // 직책 정보 조회
        try {
            const roleDoc = await db.collection('userRoles').doc(user.email).get();
            if (roleDoc.exists) {
                currentUserRole = roleDoc.data().roleName;
            } else {
                currentUserRole = null;
            }
        } catch (e) {
            console.error("Failed to fetch user role", e);
            currentUserRole = null;
        }

        // UI 업데이트 (애니메이션 적용)
        googleLoginBtn.classList.add('fade-out');
        authUITimeout = setTimeout(() => {
            googleLoginBtn.classList.add('hidden');
            googleLoginBtn.classList.remove('fade-out');

            userProfileInfo.classList.remove('hidden');
            userProfileInfo.classList.add('fade-out');
            // 강제 리플로우
            userProfileInfo.offsetHeight;
            userProfileInfo.classList.remove('fade-out');
        }, 300);

        const isPresident = isAdmin(user.email);
        const displayName = isPresident ? getAdminName(user.email) : (currentUserRole || user.displayName);
        userName.innerText = displayName;
        userEmail.innerText = user.email;
        userAvatar.src = user.photoURL || '';

        if (postAuthorInput) {
            postAuthorInput.value = displayName;
            postAuthorInput.placeholder = "작성자 이름";
        }

        // [추가] 로그인 상태에 따라 게시글 목록 리로드 (고정 버튼 표시/숨김용)
        const currentSort = document.querySelector('.custom-dropdown-option.active')?.getAttribute('data-value') || 'latest';
        loadPosts(currentSort);
    } else {
        currentUser = null;
        // UI 업데이트 (애니메이션 적용)
        userProfileInfo.classList.add('fade-out');
        authUITimeout = setTimeout(() => {
            userProfileInfo.classList.add('hidden');
            userProfileInfo.classList.remove('fade-out');

            googleLoginBtn.classList.remove('hidden');
            googleLoginBtn.classList.add('fade-out');
            // 강제 리플로우
            googleLoginBtn.offsetHeight;
            googleLoginBtn.classList.remove('fade-out');
        }, 300);

        if (postAuthorInput) {
            postAuthorInput.value = '';
            postAuthorInput.placeholder = "로그인이 필요합니다";
        }

        // [추가] 로그아웃 시에도 목록 리로드 (고정 버튼 숨김용)
        const currentSort = document.querySelector('.custom-dropdown-option.active')?.getAttribute('data-value') || 'latest';
        loadPosts(currentSort);
    }
});

// 페이지 및 글쓰기 관련 DOM
const writePostPage = document.getElementById('writePostPage');
const writePostBackBtn = document.getElementById('writePostBackBtn');
const writePostBtn = document.getElementById('writePostBtn');
const submitPostBtn = document.getElementById('submitPostBtn');
const boardContainer = document.querySelector('.board-container');

if (writePostBtn) {
    writePostBtn.addEventListener('click', () => {
        if (!currentUser) {
            alert('게시글을 작성하려면 로그인이 필요합니다. Google 계정으로 로그인해주세요.');
            openDrawer();
            return;
        }
        history.pushState({ modal: 'writePage' }, '', '#write');
        switchPage(currentPage, writePostPage, true);
    });
}

function closeWritePage(e) {
    const fromPopState = (e === true);
    const wasEditFromDetail = window._editFromDetail;
    const editingId = window._editingPostId;

    // 수정 모드 리셋
    window._editingPostId = null;
    window._editingPostImages = null;
    window._editFromDetail = false;
    const pageTitle = document.querySelector('#writePostPage .greeting-title');
    if (pageTitle) pageTitle.innerText = '새 건의사항 작성';
    const submitBtnEl = document.getElementById('submitPostBtn');
    if (submitBtnEl) submitBtnEl.innerText = '게시글 등록하기';
    document.getElementById('postTitle').value = '';
    document.getElementById('postBody').value = '';

    switchPage(currentPage, suggestionPage, true);
    if (fromPopState !== true && history.state && history.state.modal === 'writePage') {
        window._isProgrammaticBack = true;
        history.back();
    }

    // 상세 보기에서 수정한 경우: 수정된 게시글 상세를 다시 열기
    if (wasEditFromDetail && editingId) {
        setTimeout(() => {
            const card = document.querySelector(`.board-card[data-id="${editingId}"]`);
            if (card) card.click();
        }, 400);
    }
}
if (writePostBackBtn) {
    writePostBackBtn.addEventListener('click', closeWritePage);
}

// 이미지 업로드 로직
let selectedImages = [];
const imageFileInput = document.getElementById('imageFileInput');
const imageUploadArea = document.getElementById('imageUploadArea');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imageCountInfo = document.getElementById('imageCountInfo');
const imagePreviewWrapper = document.getElementById('imagePreviewWrapper');
const imagePreviewInner = document.getElementById('imagePreviewInner');
const MAX_IMAGES = 10;

if (imagePreviewWrapper && imagePreviewInner) {
    new ResizeObserver(() => {
        if (selectedImages.length > 0) {
            imagePreviewWrapper.style.height = imagePreviewInner.offsetHeight + 'px';
        } else {
            imagePreviewWrapper.style.height = '0px';
        }
    }).observe(imagePreviewInner);
}

if (imageFileInput) {
    imageFileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (selectedImages.length + files.length > MAX_IMAGES) {
            alert(`사진은 최대 ${MAX_IMAGES}장까지만 추가할 수 있습니다.`);
            return;
        }
        files.forEach(file => {
            if (file.type.startsWith('image/')) {
                selectedImages.push(file);
            }
        });
        updateImagePreview();
        imageFileInput.value = '';
    });
}

function updateImagePreview() {
    if (!imagePreviewContainer) return;
    imagePreviewContainer.innerHTML = '';

    if (imagePreviewWrapper) {
        if (selectedImages.length > 0) {
            imagePreviewWrapper.classList.add('has-images');
        } else {
            imagePreviewWrapper.classList.remove('has-images');
        }
    }
    if (imageCountInfo) {
        imageCountInfo.textContent = `${selectedImages.length} / ${MAX_IMAGES}장`;
        if (selectedImages.length >= MAX_IMAGES) {
            imageCountInfo.classList.add('warning');
        } else {
            imageCountInfo.classList.remove('warning');
        }
    }

    selectedImages.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const div = document.createElement('div');
            div.className = 'image-preview-item';
            div.innerHTML = `
                        <img src="${e.target.result}" alt="미리보기" style="cursor: pointer;" onclick="openLightbox('${e.target.result}')">
                        <button class="image-preview-remove" onclick="removeImage(${index})"><i class="fa-solid fa-xmark"></i></button>
                    `;
            imagePreviewContainer.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

window.removeImage = function (index) {
    selectedImages.splice(index, 1);
    updateImagePreview();
};

// Firebase 데이터 등록 (글쓰기)
if (submitPostBtn) {
    submitPostBtn.addEventListener('click', async () => {
        if (!currentUser) {
            alert('로그인이 필요한 서비스입니다.');
            return;
        }
        const title = document.getElementById('postTitle').value.trim();
        const author = isAdmin(currentUser.email) ? getAdminName(currentUser.email) : (currentUserRole || currentUser.displayName);
        const body = document.getElementById('postBody').value.trim();

        if (!title || !body) {
            alert('제목과 내용을 모두 입력해주세요!');
            return;
        }

        submitPostBtn.innerText = '저장 중...';
        submitPostBtn.disabled = true;

        try {
            const imageUrls = [];
            if (selectedImages.length > 0) {
                submitPostBtn.innerText = '이미지 업로드 중...';
                for (const file of selectedImages) {
                    const formData = new FormData();
                    formData.append('image', file);
                    const response = await fetch('https://api.imgbb.com/1/upload?key=2109abd69ec35602a17f2ba6f108d511', {
                        method: 'POST',
                        body: formData
                    });
                    const data = await response.json();
                    if (data.success) {
                        imageUrls.push(data.data.url);
                    } else {
                        throw new Error('이미지 업로드 실패: ' + (data.error ? data.error.message : '알 수 없는 오류'));
                    }
                }
            }

            submitPostBtn.innerText = '게시물 저장 중...';

            // 수정 모드인 경우 기존 게시글 업데이트
            if (window._editingPostId) {
                const updateData = { title: title, body: body };
                if (imageUrls.length > 0) {
                    updateData.images = [...(window._editingPostImages || []), ...imageUrls];
                }
                await db.collection('posts').doc(window._editingPostId).update(updateData);
            } else {
                await db.collection('posts').add({
                    title: title,
                    author: author,
                    uid: currentUser.uid,
                    userPhoto: currentUser.photoURL || '',
                    email: currentUser.email,
                    body: body,
                    images: imageUrls,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    views: 0,
                    likes: 0
                });
            }
            selectedImages = [];
            updateImagePreview();
            closeWritePage();
        } catch (error) {
            console.error("Error adding post: ", error);
            alert('업로드 중 오류가 발생했습니다: ' + error.message);
        } finally {
            submitPostBtn.innerText = '게시글 등록하기';
            submitPostBtn.disabled = false;
        }
    });
}

// Firebase 데이터 실시간 불러오기
function formatDate(timestamp) {
    if (!timestamp) return '방금 전';
    try {
        if (typeof timestamp.toDate === 'function') {
            const d = timestamp.toDate();
            const ampm = d.getHours() < 12 ? '오전' : '오후';
            const h = d.getHours() % 12 || 12;
            const m = String(d.getMinutes()).padStart(2, '0');
            const year = String(d.getFullYear());
            return `<span class="year-prefix">${year.substring(0, 2)}</span>${year.substring(2)}. ${d.getMonth() + 1}. ${d.getDate()}. ${ampm} ${h}:${m}`;
        }
        if (timestamp instanceof Date) {
            const ampm = timestamp.getHours() < 12 ? '오전' : '오후';
            const h = timestamp.getHours() % 12 || 12;
            const m = String(timestamp.getMinutes()).padStart(2, '0');
            const year = String(timestamp.getFullYear());
            return `<span class="year-prefix">${year.substring(0, 2)}</span>${year.substring(2)}. ${timestamp.getMonth() + 1}. ${timestamp.getDate()}. ${ampm} ${h}:${m}`;
        }
        if (typeof timestamp.toMillis === 'function') {
            const d = new Date(timestamp.toMillis());
            const ampm = d.getHours() < 12 ? '오전' : '오후';
            const h = d.getHours() % 12 || 12;
            const m = String(d.getMinutes()).padStart(2, '0');
            const year = String(d.getFullYear());
            return `<span class="year-prefix">${year.substring(0, 2)}</span>${year.substring(2)}. ${d.getMonth() + 1}. ${d.getDate()}. ${ampm} ${h}:${m}`;
        }
    } catch (e) {
        console.error(e);
    }
    return String(timestamp);
}

// window.currentPostId 공유 사용

function loadPosts(sortBy = 'latest') {
    if (postsUnsubscribe) {
        postsUnsubscribe();
    }

    let query = db.collection('posts').orderBy('createdAt', 'desc');

    postsUnsubscribe = query.onSnapshot((snapshot) => {
        // 0. 진행 중인 FLIP 애니메이션 즉시 완료 (연속 snapshot 뚝뚝거림 방지)
        boardContainer.querySelectorAll('.board-card.flipping').forEach(card => {
            const tid = card._flipTimerId;
            if (tid) { clearTimeout(tid); card._flipTimerId = null; }
            card.classList.remove('flipping');
            card.style.transition = 'none';
            card.style.transform = '';
            card.style.zIndex = '';
            const pb = card.querySelector('.pin-badge-wrapper');
            if (pb) pb.style.transition = '';
            card.offsetHeight;
            card.style.transition = '';
        });

        // 1. 이전 위치 및 데이터 스냅샷 저장
        const oldPositions = new Map();
        const oldData = new Map();
        boardContainer.querySelectorAll('.board-card').forEach(card => {
            const id = card.getAttribute('data-id');
            oldPositions.set(id, card.getBoundingClientRect());
            // 현재 상태 백업 (고정 및 좋아요 여부 확인용)
            oldData.set(id, {
                pinned: card.classList.contains('pinned-state'),
                liked: card.querySelector('.fa-heart') ? card.querySelector('.fa-heart').classList.contains('fa-solid') : false
            });
        });

        // 2. 현재 스냅샷의 ID 목록
        const currentIds = new Set(snapshot.docs.map(doc => doc.id));

        // 3. 삭제된 카드 제거 (애니메이션 없이 즉시 제거하거나 필요시 페이드아웃 추가 가능)
        boardContainer.querySelectorAll('.board-card').forEach(card => {
            if (!currentIds.has(card.getAttribute('data-id'))) {
                card.remove();
            }
        });

        // 총 글 개수 업데이트
        const headerSpan = document.querySelector('.board-header span');
        if (headerSpan) {
            headerSpan.innerHTML = `전체 게시글 <span style="color: var(--accent-color); font-weight: bold;">${snapshot.size}</span>개`;
        }

        // 4. 정렬 로직 (기존과 동일)
        const docs = [...snapshot.docs].sort((a, b) => {
            const dataA = a.data();
            const dataB = b.data();
            const pinA = dataA.pinned ? 1 : 0;
            const pinB = dataB.pinned ? 1 : 0;
            if (pinB !== pinA) return pinB - pinA;
            if (sortBy === 'popular') {
                const viewsA = dataA.views || 0;
                const viewsB = dataB.views || 0;
                if (viewsB !== viewsA) return viewsB - viewsA;
            }
            const timeA = (dataA.createdAt && typeof dataA.createdAt.toMillis === 'function') ? dataA.createdAt.toMillis() : (dataA.createdAt instanceof Date ? dataA.createdAt.getTime() : 0);
            const timeB = (dataB.createdAt && typeof dataB.createdAt.toMillis === 'function') ? dataB.createdAt.toMillis() : (dataB.createdAt instanceof Date ? dataB.createdAt.getTime() : 0);
            return timeB - timeA;
        });

        // 5. 스마트 리렌더링: 기존 카드는 업데이트하고 위치만 이동
        docs.forEach((doc, index) => {
            const post = doc.data();
            const id = doc.id;
            const timeStr = formatDate(post.createdAt);
            const isPresident = currentUser && isAdmin(currentUser.email);
            const isAuthor = currentUser && (post.uid === currentUser.uid || isPresident);
            const isLiked = currentUser && Array.isArray(post.likedUsers) && post.likedUsers.includes(currentUser.uid);

            let card = boardContainer.querySelector(`.board-card[data-id="${id}"]`);
            const isNew = !card;

            const wasPinned = oldData.get(id) ? oldData.get(id).pinned : false;
            const wasLiked = oldData.get(id) ? oldData.get(id).liked : false;

            const avatar = post.author ? post.author.substring(0, 1) : '?';
            let avatarHtml = post.userPhoto
                ? `<img class="board-author-avatar" src="${post.userPhoto}" alt="${post.author}" style="object-fit: cover; border: 1px solid var(--glass-border);">`
                : `<div class="board-author-avatar" style="background: hsl(${(id.charCodeAt(0) * 137) % 360}, 60%, 50%)">${avatar}</div>`;

            const pinBadgeHtml = `
                        <div class="pin-badge-wrapper ${post.pinned ? 'active' : ''}">
                            <span class="pin-badge-ui" style="background: var(--accent-color); color: #fff; font-size: 0.7rem; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: bold; display: inline-block;">
                                <i class="fa-solid fa-thumbtack"></i> 상단 고정
                            </span>
                        </div>
                    `;

            const postCheckbox = (isAuthor || isPresident) ? `
                        <label class="post-checkbox-wrapper" style="align-items: center; margin-right: 0;" onclick="event.stopPropagation();">
                            <input type="checkbox" class="post-select-cb" value="${id}" onchange="updatePostMultiDeleteUI()" style="width: 1.1rem; height: 1.1rem; accent-color: var(--accent-color); cursor: pointer;">
                        </label>
                    ` : '';

            const innerHtml = `
                        ${pinBadgeHtml}
                        <div class="board-card-header">
                            <div style="display: flex; align-items: center;">
                                ${postCheckbox}
                                <div class="board-author" style="display: flex; align-items: center; gap: 0.5rem;">
                                    ${avatarHtml}
                                    <span class="board-author-name">${post.author}</span>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                ${isPresident ? `
                                    <button type="button" class="board-action-btn pin-toggle-btn ${post.pinned ? 'active' : ''}"
                                            onclick="event.stopPropagation(); togglePin('${id}', ${post.pinned || false})"
                                            title="${post.pinned ? '고정 해제' : '상단 고정'}">
                                        <i class="fa-solid fa-thumbtack"></i>
                                    </button>` : ''}
                                ${isAuthor ? `
                                    <button type="button" class="board-action-btn delete-btn"
                                            onclick="event.stopPropagation(); deletePostWithAnim('${id}', this)"
                                            title="게시글 삭제">
                                        <i class="fa-solid fa-trash-can"></i>
                                    </button>
                                    <button type="button" class="board-action-btn edit-btn role-edit-btn"
                                            onclick="event.stopPropagation(); editPost('${id}')"
                                            title="게시글 수정"
                                            style="color: #007bff !important;">
                                        <i class="fa-solid fa-pen-to-square" style="color: #007bff !important;"></i>
                                    </button>` : ''}
                                <span class="board-time">${timeStr}</span>
                            </div>
                        </div>
                        <h3 class="board-title">${post.title}</h3>
                        <p class="board-preview">${post.body}</p>
                        <div class="board-footer">
                            <span>조회 ${post.views}회</span>
                            <div class="board-stats">
                                <button type="button" class="board-action-btn board-comment-btn" title="댓글 보기">
                                    <i class="fa-regular fa-comment"></i> <span id="comment-cnt-${id}">0</span>
                                </button>
                                <button type="button" class="board-action-btn" onclick="event.stopPropagation(); likePost('${id}', this)">
                                    <i class="${isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart'}" style="${isLiked ? 'color: #ff6b6b;' : ''}"></i> <span class="like-count">${post.likes || 0}</span>
                                </button>
                            </div>
                        </div>
                    `;

            if (isNew) {
                const cardElement = document.createElement('div');
                cardElement.className = `board-card ${post.pinned ? 'pinned-state' : ''}`;
                cardElement.setAttribute('data-id', id);
                cardElement.innerHTML = innerHtml;
                cardElement.style.order = index; // CSS Order를 사용하여 시각적 순서 제어
                boardContainer.appendChild(cardElement);
                card = cardElement;

                // 이벤트 바인딩
                if (isAuthor || isPresident) {
                    card.addEventListener('pointerdown', (e) => window.handlePostPointerDown(e, id));
                    card.addEventListener('pointerup', () => window.handlePostPointerUp());
                    card.addEventListener('pointercancel', () => window.handlePostPointerUp());
                    card.addEventListener('pointermove', (e) => window.handlePostPointerMove(e));
                    card.addEventListener('contextmenu', (e) => {
                        if (window.isPostMultiSelectMode) { e.preventDefault(); }
                    });
                    card.addEventListener('click', (e) => {
                        if (window.ignoreNextPostClick) {
                            window.ignoreNextPostClick = false;
                            e.preventDefault();
                            e.stopPropagation();
                            return;
                        }
                        if (window.isPostMultiSelectMode) {
                            if (e.target.classList.contains('post-select-cb') || e.target.closest('label')) {
                                return;
                            }
                            e.preventDefault();
                            e.stopPropagation();
                            const cb = card.querySelector('.post-select-cb');
                            if (cb) {
                                cb.checked = !cb.checked;
                                updatePostMultiDeleteUI();
                            }
                            return;
                        }
                        openPostDetail(id, card._latestPost || post, avatarHtml, timeStr, 'fullscreen');
                    });
                } else {
                    card.addEventListener('click', () => openPostDetail(id, card._latestPost || post, avatarHtml, timeStr, 'fullscreen'));
                }

                if (post.pinned) {
                    card.offsetHeight; // 강제 리플로우로 렌더링 타이밍 보장
                    const badge = card.querySelector('.pin-badge-wrapper');
                    const btn = card.querySelector('.pin-toggle-btn');
                    if (badge) badge.classList.add('active');
                    if (btn) btn.classList.add('active');
                }
                // We insert listeners into the isNew block right above the else!
                const commentBtn = card.querySelector('.board-comment-btn');
                if (commentBtn) {
                    commentBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openPostDetail(id, card._latestPost || post, avatarHtml, timeStr, 'side');
                    });
                }

                db.collection('posts').doc(id).collection('comments').onSnapshot(snap => {
                    const el = card.querySelector(`#comment-cnt-${id}`);
                    if (el) el.innerText = snap.docs.filter(doc => !doc.data().deleted).length;
                });
            } else {
                // Update latest post for the click listener
                card._latestPost = post;

                const titleEl = card.querySelector('.board-title');
                if (titleEl && titleEl.textContent !== post.title) titleEl.textContent = post.title;

                const previewEl = card.querySelector('.board-preview');
                if (previewEl && previewEl.textContent !== post.body) previewEl.textContent = post.body;

                const viewsEl = card.querySelector('.board-footer > span');
                if (viewsEl && !viewsEl.textContent.includes(post.views + '회')) viewsEl.textContent = '조회 ' + post.views + '회';

                const likeBtn = card.querySelector('.board-action-btn[onclick*="likePost"]');
                if (likeBtn) {
                    const heartIcon = likeBtn.querySelector('i');
                    if (heartIcon) {
                        if (!heartIcon.classList.contains('animate-heart') && !heartIcon.classList.contains('animate-heart-cancel')) {
                            const isSolid = isLiked;
                            if (isSolid) {
                                heartIcon.classList.remove('fa-regular');
                                heartIcon.classList.add('fa-solid');
                                heartIcon.style.color = '#ff6b6b';
                            } else {
                                heartIcon.classList.remove('fa-solid');
                                heartIcon.classList.add('fa-regular');
                                heartIcon.style.color = 'var(--text-primary)';
                            }
                        }
                    }
                    const likeCountEl = likeBtn.querySelector('.like-count');
                    if (likeCountEl) {
                        likeCountEl.textContent = post.likes || 0;
                    }
                }

                const pinBadge = card.querySelector('.pin-badge-wrapper');
                if (pinBadge) {
                    // 뱃지 크기 변화가 FLIP 위치 계산에 포함되도록 transition 없이 즉시 적용
                    pinBadge.style.transition = 'none';
                    pinBadge.className = 'pin-badge-wrapper ' + (post.pinned ? 'active' : '');
                    pinBadge.offsetHeight; // 즉시 레이아웃 반영
                }

                const pinToggleBtn = card.querySelector('.pin-toggle-btn');
                if (pinToggleBtn) {
                    pinToggleBtn.classList.toggle('active', !!post.pinned);
                    pinToggleBtn.setAttribute('onclick', `event.stopPropagation(); togglePin('${id}', ${post.pinned || false})`);
                    pinToggleBtn.setAttribute('title', post.pinned ? '고정 해제' : '상단 고정');
                }

                card.classList.toggle('pinned-state', !!post.pinned);
                card.style.order = index;
            }

        });

        // 6. FLIP 애니메이션 실행 (부드러운 이동)
        const finalCards = boardContainer.querySelectorAll('.board-card');
        finalCards.forEach(card => {
            const id = card.getAttribute('data-id');
            const oldPos = oldPositions.get(id);
            if (oldPos) {
                const newPos = card.getBoundingClientRect();
                const oldState = oldData.get(id);
                const isPinnedNow = card.classList.contains('pinned-state');
                const pinnedChanged = oldState && oldState.pinned !== isPinnedNow;
                const dy = oldPos.top - newPos.top;
                const dx = oldPos.left - newPos.left;

                if (dx !== 0 || dy !== 0 || pinnedChanged) {
                    if (pinnedChanged) {
                        card.classList.toggle('pinned-state', oldState.pinned);
                        const pb = card.querySelector('.pin-badge-wrapper');
                        if (pb) {
                            pb.classList.toggle('active', oldState.pinned);
                            pb.style.transition = 'none';
                        }
                    }

                    card.style.transition = 'none';
                    card.style.transform = `translate(${dx}px, ${dy}px)`;
                    card.offsetHeight; // 리플로우

                    requestAnimationFrame(() => {
                        card.classList.add('flipping');
                        card.style.transform = '';

                        if (pinnedChanged) {
                            card.style.zIndex = '20'; // 고정/해제된 카드는 무조건 최상단 위로 비행
                            card.classList.toggle('pinned-state', isPinnedNow);
                            const pb = card.querySelector('.pin-badge-wrapper');
                            if (pb) {
                                pb.classList.toggle('active', isPinnedNow);
                                pb.style.transition = '';
                            }
                        }

                        card.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.5s ease, padding-left 0.3s ease, background 0.3s ease, border-color 0.3s ease';

                        card._flipTimerId = setTimeout(() => {
                            card._flipTimerId = null;
                            card.classList.remove('flipping');
                            card.style.transition = '';
                            card.style.transform = '';
                            card.style.zIndex = '';

                            // 뱃지의 transition 복원
                            const pb = card.querySelector('.pin-badge-wrapper');
                            if (pb) pb.style.transition = '';
                        }, 500);
                    });
                }
            } else {
                // 새 카드 등장
                card.style.opacity = '0';
                card.style.transform = 'translateY(15px)';
                card.offsetHeight;
                card.style.transition = 'transform 0.5s cubic-bezier(0.2, 0, 0, 1), opacity 0.5s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
                setTimeout(() => {
                    card.style.transition = '';
                    card.style.transform = '';
                    card.style.opacity = '';
                }, 500);
            }
        });
    }, (error) => {
        console.error("onSnapshot error: ", error);
    });
}

// 초기 로드
loadPosts('latest');

// 커스텀 드롭다운 로직
const customDropdownContainer = document.getElementById('customSortDropdown');
const customSortSelected = document.getElementById('customSortSelected');
const customSortOptions = document.getElementById('customSortOptions');
const customSortOptionItems = document.querySelectorAll('#customSortOptions .custom-dropdown-option');

if (customSortSelected && customSortOptions) {
    customSortSelected.addEventListener('click', (e) => {
        e.stopPropagation();
        customDropdownContainer.classList.toggle('open');
    });

    customSortOptionItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const value = item.getAttribute('data-value');
            const textHTML = item.innerHTML;

            // 활성화 표시 업데이트
            customSortOptionItems.forEach(opt => opt.classList.remove('active'));
            item.classList.add('active');

            // 선택된 텍스트 및 아이콘 업데이트
            customSortSelected.innerHTML = `<span>${textHTML}</span> <i class="fa-solid fa-chevron-down arrow-icon"></i>`;
            customDropdownContainer.classList.remove('open');

            // 데이터 새로고침
            loadPosts(value);
        });
    });

    // 바깥 영역 클릭 시 드롭다운 닫기
    document.addEventListener('click', (e) => {
        if (!customDropdownContainer.contains(e.target)) {
            customDropdownContainer.classList.remove('open');
        }
    });
}

window.currentCommentSort = 'latest';
const commentSortDropdown = document.getElementById('commentSortDropdown');
const commentSortSelected = document.getElementById('commentSortSelected');
const commentSortOptions = document.getElementById('commentSortOptions');
const commentSortOptionItems = document.querySelectorAll('#commentSortOptions .custom-dropdown-option');

if (commentSortSelected && commentSortOptions) {
    commentSortSelected.addEventListener('click', (e) => {
        e.stopPropagation();
        commentSortDropdown.classList.toggle('open');
    });

    commentSortOptionItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const value = item.getAttribute('data-value');
            const textHTML = item.innerHTML;

            commentSortOptionItems.forEach(opt => opt.classList.remove('active'));
            item.classList.add('active');

            commentSortSelected.innerHTML = `<span>${textHTML}</span> <i class="fa-solid fa-chevron-down arrow-icon"></i>`;
            commentSortDropdown.classList.remove('open');

            window.currentCommentSort = value;
            if (currentPostId) {
                window.renderCurrentComments(currentPostId);
            }
        });
    });

    document.addEventListener('click', (e) => {
        if (commentSortDropdown && !commentSortDropdown.contains(e.target)) {
            commentSortDropdown.classList.remove('open');
        }
    });
}

let commentUnsubscribe = null;
let currentDetailMode = 'side';
const PRESIDENT_EMAIL = 'gimdong2804@gmail.com';
window.expandedCommentIds = new Set();
window.currentCommentDocs = [];
window.replyTarget = null;

function isPresidentUser(user = currentUser) {
    return !!(user && isAdmin(user.email));
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function toJsString(value) {
    return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function commentTimeValue(comment) {
    const createdAt = comment.createdAt;
    if (createdAt && typeof createdAt.toMillis === 'function') return createdAt.toMillis();
    if (createdAt && typeof createdAt.toDate === 'function') return createdAt.toDate().getTime();
    if (createdAt instanceof Date) return createdAt.getTime();
    return Date.now();
}

function normalizeCommentDoc(doc) {
    const data = doc.data();
    return Object.assign({}, data, {
        id: doc.id,
        parentId: data.parentId || null
    });
}

function buildCommentTree(comments) {
    const byId = new Map(comments.map(comment => [comment.id, comment]));
    const childrenMap = new Map();

    comments.forEach(comment => {
        const parentId = comment.parentId && byId.has(comment.parentId) ? comment.parentId : null;
        if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
        childrenMap.get(parentId).push(comment);
    });

    childrenMap.forEach(children => {
        children.sort((a, b) => {
            const pinA = a.pinned ? 1 : 0;
            const pinB = b.pinned ? 1 : 0;
            if (pinB !== pinA) return pinB - pinA;
            if (window.currentCommentSort === 'popular') {
                const likesA = a.likes || 0;
                const likesB = b.likes || 0;
                if (likesA !== likesB) return likesB - likesA;
            }
            return commentTimeValue(b) - commentTimeValue(a);
        });
    });

    const countCache = new Map();
    const countDescendants = (commentId) => {
        if (countCache.has(commentId)) return countCache.get(commentId);
        const children = childrenMap.get(commentId) || [];
        const count = children.reduce((sum, child) => {
            const selfCount = child.deleted ? 0 : 1;
            return sum + selfCount + countDescendants(child.id);
        }, 0);
        countCache.set(commentId, count);
        return count;
    };

    const flatDescendants = (commentId) => {
        const result = [];
        const collect = (id) => {
            const kids = childrenMap.get(id) || [];
            kids.forEach(child => {
                result.push(child);
                collect(child.id);
            });
        };
        collect(commentId);
        result.sort((a, b) => {
            const pinA = a.pinned && !a.deleted ? 1 : 0;
            const pinB = b.pinned && !b.deleted ? 1 : 0;
            if (pinB !== pinA) return pinB - pinA;
            if (window.currentCommentSort === 'popular') {
                const likesA = a.likes || 0;
                const likesB = b.likes || 0;
                if (likesA !== likesB) return likesB - likesA;
            }
            return commentTimeValue(b) - commentTimeValue(a);
        });
        return result;
    };

    return { byId, childrenMap, countDescendants, flatDescendants };
}

function getCommentAvatar(comment, isPresidentComment, isDeleted) {
    if (isDeleted) {
        return `<div class="board-author-avatar" style="background: #64748b; width: 32px; height: 32px; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #fff;"><i class="fa-solid fa-minus"></i></div>`;
    }
    if (comment.userPhoto) {
        return `<img class="board-author-avatar" src="${escapeHtml(comment.userPhoto)}" alt="${escapeHtml(comment.author || '사용자')}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 50%; border: 1px solid var(--glass-border);" decoding="sync">`;
    }
    const initial = (comment.author || '?').substring(0, 1);
    return `<div class="board-author-avatar" style="background: ${isPresidentComment ? 'var(--accent-color)' : '#9ca3af'}; width: 32px; height: 32px; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #fff;">${isPresidentComment ? '<i class="fa-solid fa-crown" style="font-size: 0.6rem;"></i>' : escapeHtml(initial)}</div>`;
}

function parseAttachmentItem(item, defaultName = '파일') {
    if (!item) return { url: '', name: defaultName };
    if (typeof item === 'object' && item !== null) {
        return { url: item.url || item.dataUrl || '', name: item.name || defaultName };
    }
    if (typeof item === 'string') {
        const trimmed = item.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                const parsed = JSON.parse(trimmed);
                return { url: parsed.url || parsed.dataUrl || '', name: parsed.name || defaultName };
            } catch (e) { }
        }
        return { url: trimmed, name: defaultName };
    }
    return { url: String(item), name: defaultName };
}

function renderCommentAttachmentsHtml(comment, safePostId, safeCommentId, isDeleted) {
    if (isDeleted) return '';
    let html = '';

    if (comment.images && Array.isArray(comment.images) && comment.images.length > 0) {
        html += `<div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap;">`;
        comment.images.forEach((imgUrl, imgIdx) => {
            html += `<img src="${escapeHtml(imgUrl)}" alt="첨부 이미지" style="max-width: 150px; max-height: 150px; border-radius: 8px; object-fit: cover; border: 1px solid var(--glass-border); cursor: pointer;" onclick="event.stopPropagation(); openLightbox('${escapeHtml(imgUrl)}', {postId:'${safePostId}', commentId:'${safeCommentId}', authorUid:'${escapeHtml(comment.uid || '')}', imageIndex:${imgIdx}})">`;
        });
        html += `</div>`;
    }

    if (comment.videos && Array.isArray(comment.videos) && comment.videos.length > 0) {
        html += `<div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">`;
        comment.videos.forEach((v, vIdx) => {
            const parsed = parseAttachmentItem(v, '동영상');
            const rawUrl = parsed.url;
            const vidId = `c-vid-${safeCommentId}-${vIdx}`;
            if (rawUrl) {
                let mimeType = 'video/mp4';
                const lower = rawUrl.toLowerCase();
                if (lower.includes('.webm')) mimeType = 'video/webm';
                else if (lower.includes('.mov')) mimeType = 'video/quicktime';
                else if (lower.includes('.ogg')) mimeType = 'video/ogg';

                html += `
                    <div class="comment-video-wrapper" style="width: 100%;">
                        <video id="${vidId}" controls playsinline preload="metadata" style="max-width: 100%; max-height: 320px; border-radius: 8px; border: 1px solid var(--glass-border); background: #000;">
                            <source id="${vidId}-src" src="" type="${mimeType}">
                            <p style="color: var(--text-secondary); font-size: 0.85rem; padding: 0.5rem;">웹 브라우저가 이 동영상을 재생할 수 없습니다.</p>
                        </video>
                    </div>
                `;

                const tryLoadMedia = async (attempts = 0) => {
                    const el = document.getElementById(vidId);
                    const srcEl = document.getElementById(`${vidId}-src`);
                    if (el) {
                        const finalUrl = await window.resolveMediaUrl(rawUrl);
                        if (finalUrl) {
                            if (srcEl) {
                                srcEl.src = finalUrl;
                            } else {
                                el.src = finalUrl;
                            }
                            el.load();
                        } else if (rawUrl.startsWith('localmedia://')) {
                            const wrapper = el.closest('.comment-video-wrapper');
                            if (wrapper) {
                                wrapper.innerHTML = `<div style="padding: 0.75rem; background: rgba(255, 107, 107, 0.1); border: 1px solid rgba(255, 107, 107, 0.3); border-radius: 8px; color: #ff6b6b; font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem;"><i class="fa-solid fa-triangle-exclamation"></i> <span>작성자 스마트폰의 로컬 저장소에만 저장된 동영상입니다. (클라우드 전송 실패)</span></div>`;
                            }
                        }
                    } else if (attempts < 15) {
                        setTimeout(() => tryLoadMedia(attempts + 1), 30);
                    }
                };
                setTimeout(() => tryLoadMedia(0), 10);
            }
        });
        html += `</div>`;
    }

    if (comment.audios && Array.isArray(comment.audios) && comment.audios.length > 0) {
        html += `<div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">`;
        comment.audios.forEach(a => {
            const parsed = parseAttachmentItem(a, '음성 파일');
            const url = parsed.url;
            const name = parsed.name;
            if (url) {
                html += `<div style="display:flex; align-items:center; gap:0.5rem;"><i class="fa-solid fa-microphone" style="color:#51cf66;"></i><span style="font-size:0.85rem;">${escapeHtml(name)}</span><audio src="${escapeHtml(url)}" controls style="height:32px; max-width:240px;"></audio></div>`;
            }
        });
        html += `</div>`;
    }

    if (comment.pdfs && Array.isArray(comment.pdfs) && comment.pdfs.length > 0) {
        html += `<div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">`;
        comment.pdfs.forEach(p => {
            const parsed = parseAttachmentItem(p, 'PDF 문서');
            const url = parsed.url;
            const name = parsed.name;
            if (url) {
                html += `<a href="${escapeHtml(url)}" target="_blank" download="${escapeHtml(name)}" style="display:inline-flex; align-items:center; gap:0.4rem; padding:0.4rem 0.8rem; background:var(--card-bg, rgba(255,255,255,0.05)); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-primary); text-decoration:none; font-size:0.85rem;"><i class="fa-solid fa-file-pdf" style="color:#ff922b;"></i> ${escapeHtml(name)}</a>`;
            }
        });
        html += `</div>`;
    }

    if (comment.htmls && Array.isArray(comment.htmls) && comment.htmls.length > 0) {
        html += `<div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">`;
        comment.htmls.forEach(h => {
            const parsed = parseAttachmentItem(h, 'HTML 문서');
            const url = parsed.url;
            const name = parsed.name;
            if (url) {
                html += `<a href="${escapeHtml(url)}" target="_blank" download="${escapeHtml(name)}" style="display:inline-flex; align-items:center; gap:0.4rem; padding:0.4rem 0.8rem; background:var(--card-bg, rgba(255,255,255,0.05)); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-primary); text-decoration:none; font-size:0.85rem;"><i class="fa-solid fa-file-code" style="color:#cc5de8;"></i> ${escapeHtml(name)}</a>`;
            }
        });
        html += `</div>`;
    }

    return html;
}

function renderFlatReply(comment, tree, postId, depth = 1) {
    const isDeleted = !!comment.deleted;
    const isPresidentComment = !isDeleted && ((comment.author || '').includes('회장') || isAdmin(comment.email));
    const isPresident = isPresidentUser();
    const canDelete = !!(currentUser && !isDeleted && (isPresident || comment.uid === currentUser.uid));
    const canPin = !!(isPresident && !isDeleted);
    const isLiked = !!(comment.likedUsers && currentUser && comment.likedUsers.includes(currentUser.uid));
    const safePostId = toJsString(postId);
    const safeCommentId = toJsString(comment.id);
    const pinned = !!(comment.pinned && !isDeleted);
    const authorName = isDeleted ? '삭제된 댓글' : (comment.author || '사용자');
    const cTime = formatDate(comment.createdAt) + (comment.edited && !isDeleted ? ' <span style="font-size: 0.8em; color: var(--text-secondary);">(수정됨)</span>' : '');
    const badge = isPresidentComment ? '<span class="official-badge" style="background: var(--accent-color); color: #fff; font-size: 0.7rem; padding: 0.08rem 0.35rem; border-radius: 4px; font-weight: bold; margin-left: 0.4rem; white-space: nowrap; flex-shrink: 0;">공식 답변</span>' : '';
    let depthIcon = '';
    if (depth >= 4) {
        const arrowCount = depth - 3;
        const arrowText = '&#x21B3; X' + arrowCount;
        depthIcon = `<span style="color: #9ca3af; font-size: 0.9rem; margin-right: 0.4rem; font-weight: bold; line-height: 1;">${arrowText}</span>`;
    }
    const parentComment = comment.parentId ? tree.byId.get(comment.parentId) : null;
    const mentionHtml = (parentComment && !isDeleted) ? `<span class="flat-reply-mention">@${escapeHtml(parentComment.author || '사용자')}</span> ` : '';
    const bodyHtml = isDeleted
        ? '<span class="comment-deleted-text">삭제된 댓글입니다.</span>'
        : mentionHtml + escapeHtml(comment.body || '').replace(/\n/g, '<br>');

    const attachmentsHtml = renderCommentAttachmentsHtml(comment, safePostId, safeCommentId, isDeleted);

    const deleteBtn = canDelete ? `<button type="button" class="board-action-btn delete-btn" onclick="event.stopPropagation(); deleteComment('${safePostId}', '${safeCommentId}', true)" title="답글 삭제"><i class="fa-solid fa-trash-can"></i></button>` : '';
    const editBtn = canDelete ? `<button type="button" class="board-action-btn edit-btn role-edit-btn" onclick="event.stopPropagation(); editComment('${safePostId}', '${safeCommentId}')" title="답글 수정" style="color: #007bff !important;"><i class="fa-solid fa-pen-to-square" style="color: #007bff !important;"></i></button>` : '';
    const pinBtn = canPin ? `<button type="button" class="board-action-btn pin-toggle-btn ${pinned ? 'active' : ''}" onclick="togglePinComment('${safePostId}', '${safeCommentId}', ${pinned})" title="${pinned ? '댓글 고정 해제' : '댓글 고정'}"><i class="fa-solid fa-thumbtack"></i></button>` : '';
    const replyBtn = !isDeleted ? `<button type="button" class="reply-action-btn" onclick="startReplyTarget('${safePostId}', '${safeCommentId}')" title="답글"><i class="fa-regular fa-comment-dots"></i> 답글</button>` : '';
    const heartClass = isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    const likeBtn = !isDeleted ? `<button type="button" class="board-action-btn c-like-btn" onclick="toggleLikeComment('${safePostId}', '${safeCommentId}', this, ${isLiked})" title="좋아요"><i class="${heartClass}" style="${isLiked ? 'color: #ff6b6b;' : ''}"></i> <span class="c-like-cnt like-count" style="margin-left: 0.1rem;">${comment.likes || 0}</span></button>` : '';

    const isExpanded = window.expandedCommentIds.has(comment.id);
    const isJustExpanded = window.justExpandedCommentId === comment.id;
    const expandedClass = isExpanded && !isJustExpanded ? 'expanded' : '';
    const replyCount = tree.countDescendants(comment.id);
    const isHiddenToggle = replyCount === 0;
    const toggleText = replyCount > 0 ? `답글 ${replyCount}개` : `답글 0개`;
    const replyToggleBtn = `
                <button type="button" class="reply-toggle-btn ${expandedClass} ${isHiddenToggle ? 'hidden-toggle' : ''}" ${isJustExpanded ? 'data-should-expand="true"' : ''} onclick="toggleCommentReplies('${safeCommentId}')" title="${isExpanded ? '답글 접기' : '답글 보기'}">
                    <i class="fa-solid fa-chevron-down reply-arrow-icon"></i> ${toggleText}
                </button>
            `;

    const kids = tree.childrenMap.get(comment.id) || [];
    let childRepliesHtml = '';
    if (isExpanded && kids.length > 0) {
        const sortedKids = [...kids].sort((a, b) => {
            const pinA = a.pinned && !a.deleted ? 1 : 0;
            const pinB = b.pinned && !b.deleted ? 1 : 0;
            if (pinB !== pinA) return pinB - pinA;
            if (window.currentCommentSort === 'popular') {
                const likesA = a.likes || 0;
                const likesB = b.likes || 0;
                if (likesA !== likesB) return likesB - likesA;
            }
            return commentTimeValue(b) - commentTimeValue(a);
        });
        const isMaxDepth = depth >= 3;
        const containerStyle = isMaxDepth ? `margin-left: 0; padding-left: 0; border-left: none; margin-top: 0;` : ``;
        childRepliesHtml = `<div class="comment-replies-flat ${isJustExpanded ? 'just-expanded' : ''}" style="${containerStyle}">${sortedKids.map(r => renderFlatReply(r, tree, postId, depth + 1)).join('')}</div>`;
    }

    return `
                <div class="comment-flat-reply" id="comment-${escapeHtml(comment.id)}" data-id="${escapeHtml(comment.id)}" data-can-delete="${canDelete ? 'true' : 'false'}" data-reply-count="${replyCount}" data-pinned="${pinned ? 'true' : 'false'}">
                    ${getCommentAvatar(comment, isPresidentComment, isDeleted)}
                    <div class="flat-reply-content">
                        <div class="flat-reply-header">
                            <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                                ${depthIcon}
                                <span class="board-author-name" style="font-weight: 600; font-size: 0.88rem; color: var(--text-primary);">${escapeHtml(authorName)}</span>
                                ${badge}
                            </div>
                            <div class="comment-actions" style="display: flex; align-items: center; gap: 0.5rem;">
                                <div class="mobile-hide" style="display: flex; align-items: center; gap: 0.5rem;">
                                    ${pinBtn}
                                    ${deleteBtn}
                                    ${editBtn}
                                </div>
                                <span class="board-time" style="font-weight: 400;">${cTime}</span>
                            </div>
                        </div>
                        <div class="flat-reply-body">${bodyHtml}${attachmentsHtml}</div>
                        <div class="flat-reply-footer ${replyCount > 0 ? 'has-replies' : ''}" style="display: flex; justify-content: space-between; align-items: center; width: 100%; flex-wrap: nowrap;">
                            <div class="hide-scrollbar" style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: nowrap; overflow-x: auto; flex: 1; min-width: 0;">
                                ${replyBtn}
                                ${replyToggleBtn}
                                <div class="mobile-show" style="display: none; align-items: center; gap: 0.5rem; flex-shrink: 0;">
                                    ${pinBtn}
                                    ${deleteBtn}
                                    ${editBtn}
                                </div>
                            </div>
                            <div style="margin-left: auto; flex-shrink: 0;">${likeBtn}</div>
                        </div>
                    </div>
                </div>
                ${childRepliesHtml}
            `;
}

function renderCommentBranch(comment, depth, tree, postId) {
    const isDeleted = !!comment.deleted;
    const isPresidentComment = !isDeleted && ((comment.author || '').includes('회장') || isAdmin(comment.email));
    const isPresident = isPresidentUser();
    const canDelete = !!(currentUser && !isDeleted && (isPresident || comment.uid === currentUser.uid));
    const canPin = !!(isPresident && !isDeleted);
    const isLiked = !!(comment.likedUsers && currentUser && comment.likedUsers.includes(currentUser.uid));
    const replyCount = tree.countDescendants(comment.id);
    const isExpanded = window.expandedCommentIds.has(comment.id);
    const isJustExpanded = window.justExpandedCommentId === comment.id;
    const expandedClass = isExpanded && !isJustExpanded ? 'expanded' : '';
    const safePostId = toJsString(postId);
    const safeCommentId = toJsString(comment.id);
    const pinned = !!(comment.pinned && !isDeleted);
    const authorName = isDeleted ? '삭제된 댓글' : (comment.author || '사용자');
    const cTime = formatDate(comment.createdAt) + (comment.edited && !isDeleted ? ' <span style="font-size: 0.8em; color: var(--text-secondary);">(수정됨)</span>' : '');
    const badge = isPresidentComment ? '<span class="official-badge" style="background: var(--accent-color); color: #fff; font-size: 0.75rem; padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: bold; margin-left: 0.5rem; white-space: nowrap; flex-shrink: 0;">공식 답변</span>' : '';
    const pinBadge = `<div class="pin-badge-wrapper ${pinned ? 'active' : ''}">
                                <span class="pin-badge-ui" style="background: var(--accent-color); color: #fff; font-size: 0.7rem; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: bold; display: inline-block;">
                                    <i class="fa-solid fa-thumbtack"></i> 상단 고정
                                </span>
                            </div>`;
    const checkbox = canDelete ? `
                <label class="comment-checkbox-wrapper" style="align-items: center; margin-top: 0.2rem; padding-right: 0;">
                    <input type="checkbox" class="comment-select-cb" value="${escapeHtml(comment.id)}" onchange="updateMultiDeleteUI()" style="width: 1.1rem; height: 1.1rem; accent-color: var(--accent-color); cursor: pointer;">
                </label>
            ` : '';
    const deleteBtn = canDelete ? `
                <button type="button" class="board-action-btn delete-btn" onclick="event.stopPropagation(); deleteComment('${safePostId}', '${safeCommentId}')" title="댓글 삭제">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            ` : '';
    const editBtn = canDelete ? `
                <button type="button" class="board-action-btn edit-btn role-edit-btn" onclick="event.stopPropagation(); editComment('${safePostId}', '${safeCommentId}')" title="답글 수정" style="color: #007bff !important;">
                    <i class="fa-solid fa-pen-to-square" style="color: #007bff !important;"></i>
                </button>
            ` : '';
    const pinBtn = canPin ? `
                <button type="button" class="board-action-btn pin-toggle-btn ${pinned ? 'active' : ''}" onclick="togglePinComment('${safePostId}', '${safeCommentId}', ${pinned})" title="${pinned ? '댓글 고정 해제' : '댓글 고정'}">
                    <i class="fa-solid fa-thumbtack"></i>
                </button>
            ` : '';
    const replyBtn = !isDeleted ? `
                <button type="button" class="reply-action-btn" onclick="startReplyTarget('${safePostId}', '${safeCommentId}')" title="답글">
                    <i class="fa-regular fa-comment-dots"></i> 답글
                </button>
            ` : '';
    const isHiddenToggle = replyCount === 0;
    const toggleText = replyCount > 0 ? `답글 ${replyCount}개` : `답글 0개`;
    const replyToggleBtn = `
                <button type="button" class="reply-toggle-btn ${expandedClass} ${isHiddenToggle ? 'hidden-toggle' : ''}" ${isJustExpanded ? 'data-should-expand="true"' : ''} onclick="toggleCommentReplies('${safeCommentId}')" title="${isExpanded ? '답글 접기' : '답글 보기'}">
                    <i class="fa-solid fa-chevron-down reply-arrow-icon"></i> ${toggleText}
                </button>
            `;
    const heartClass = isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    const likeBtn = !isDeleted ? `
                <button type="button" class="board-action-btn c-like-btn" onclick="toggleLikeComment('${safePostId}', '${safeCommentId}', this, ${isLiked})" title="좋아요">
                    <i class="${heartClass}" style="${isLiked ? 'color: #ff6b6b;' : ''}"></i> <span class="c-like-cnt like-count" style="margin-left: 0.1rem;">${comment.likes || 0}</span>
                </button>
            ` : '';
    const itemStyle = '';
    const bodyHtml = isDeleted
        ? '<span class="comment-deleted-text">삭제된 댓글입니다.</span>'
        : escapeHtml(comment.body || '').replace(/\n/g, '<br>');

    const attachmentsHtml = renderCommentAttachmentsHtml(comment, safePostId, safeCommentId, isDeleted);

    let repliesHtml = '';
    if (isExpanded) {
        const immediateReplies = tree.childrenMap.get(comment.id) || [];
        if (immediateReplies.length > 0) {
            const sortedReplies = [...immediateReplies].sort((a, b) => {
                const pinA = a.pinned && !a.deleted ? 1 : 0;
                const pinB = b.pinned && !b.deleted ? 1 : 0;
                if (pinB !== pinA) return pinB - pinA;
                if (window.currentCommentSort === 'popular') {
                    const likesA = a.likes || 0;
                    const likesB = b.likes || 0;
                    if (likesA !== likesB) return likesB - likesA;
                }
                return commentTimeValue(b) - commentTimeValue(a);
            });
            repliesHtml = `<div class="comment-replies-flat ${isJustExpanded ? 'just-expanded' : ''}">${sortedReplies.map(r => renderFlatReply(r, tree, postId, 1)).join('')}</div>`;
        }
    }

    return `
                <div class="comment-node">
                    <div id="comment-${escapeHtml(comment.id)}" class="comment-item ${isDeleted ? 'comment-deleted' : ''} ${isPresidentComment ? 'official' : ''}" data-id="${escapeHtml(comment.id)}" data-can-delete="${canDelete ? 'true' : 'false'}" data-reply-count="${replyCount}" data-pinned="${pinned ? 'true' : 'false'}" style="${itemStyle}">
                        ${pinBadge}
                        <div style="display: flex; align-items: flex-start; width: 100%;">
                            ${checkbox}
                            ${getCommentAvatar(comment, isPresidentComment, isDeleted)}
                            <div class="comment-content" style="flex: 1; min-width: 0; padding-top: 0.2rem; margin-left: 0.75rem;">
                                <div class="comment-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: nowrap; margin-bottom: 0.4rem;">
                                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: nowrap; min-width: 0;">
                                        <span class="board-author-name" style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(authorName)}</span>
                                        ${badge}
                                    </div>
                                    <div class="comment-actions" style="display: flex; align-items: center; gap: 0.5rem;">
                                        <div class="mobile-hide" style="display: flex; align-items: center; gap: 0.5rem;">
                                            ${pinBtn}
                                            ${deleteBtn}
                                            ${editBtn}
                                        </div>
                                        <span class="board-time" style="font-weight: 400;">${cTime}</span>
                                    </div>
                                </div>
                                <div class="comment-text" style="font-size: 0.95rem; line-height: 1.5; color: var(--text-primary); word-break: break-all; margin-bottom: 0.8rem;">${bodyHtml}${attachmentsHtml}</div>
                                <div class="comment-footer ${replyCount > 0 ? 'has-replies' : ''}" style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: nowrap; width: 100%;">
                                    <div class="hide-scrollbar" style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: nowrap; overflow-x: auto; flex: 1; min-width: 0;">
                                        ${replyBtn}
                                        ${replyToggleBtn}
                                        <div class="mobile-show" style="display: none; align-items: center; gap: 0.5rem; flex-shrink: 0;">
                                            ${pinBtn}
                                            ${deleteBtn}
                                            ${editBtn}
                                        </div>
                                    </div>
                                    <div class="board-stats" style="margin-left: auto; flex-shrink: 0;">
                                        ${likeBtn}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    ${repliesHtml}
                </div>
            `;
}

function attachCommentItemEvents() {
    document.querySelectorAll('#detailCommentList .comment-item, #detailCommentList .comment-flat-reply').forEach(item => {
        const cid = item.getAttribute('data-id');
        const canDelete = item.getAttribute('data-can-delete') === 'true';

        if (canDelete) {
            item.addEventListener('pointerdown', (e) => window.handleCommentPointerDown(e, cid));
            item.addEventListener('pointerup', window.handleCommentPointerUp);
            item.addEventListener('pointercancel', window.handleCommentPointerUp);
            item.addEventListener('pointerleave', window.handleCommentPointerUp);
            item.addEventListener('contextmenu', (e) => {
                if (window.isMultiSelectMode) e.preventDefault();
            });
        }

        item.addEventListener('click', (e) => {
            if (e.target.closest('.comment-item') !== item && e.target.closest('.comment-flat-reply') !== item) return;
            if (window.ignoreNextCommentClick) {
                window.ignoreNextCommentClick = false;
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (e.target.closest('button') || e.target.closest('a') || e.target.closest('label') || e.target.closest('input')) return;

            if (window.isMultiSelectMode) {
                e.preventDefault();
                e.stopPropagation();
                const cb = item.querySelector('.comment-select-cb');
                if (cb) {
                    cb.checked = !cb.checked;
                    updateMultiDeleteUI();
                }
                return;
            }

            const replyCount = parseInt(item.getAttribute('data-reply-count') || '0', 10);
            if (replyCount > 0) {
                window.toggleCommentReplies(cid);
            }
        });
    });
}

window.renderCurrentComments = function (postId = currentPostId) {
    if (!postId || postId !== currentPostId) return;
    const commentList = document.getElementById('detailCommentList');
    if (!commentList) return;

    const oldPositions = new Map();
    commentList.querySelectorAll('.comment-item, .comment-flat-reply').forEach(item => {
        const opacity = window.getComputedStyle(item).opacity;
        const toggleBtn = item.querySelector('.reply-toggle-btn');
        const cid = item.getAttribute('data-id');
        const preTop = (window.preDeletePositions && window.preDeletePositions.has(cid))
            ? window.preDeletePositions.get(cid)
            : item.getBoundingClientRect().top;

        oldPositions.set(cid, {
            rect: { top: preTop },
            opacity: opacity,
            isPinned: item.getAttribute('data-pinned') === 'true',
            hadReplies: toggleBtn && !toggleBtn.classList.contains('hidden-toggle')
        });
    });
    window.preDeletePositions = null;

    const comments = window.currentCommentDocs || [];
    const tree = buildCommentTree(comments);
    const visibleCount = comments.filter(comment => !comment.deleted).length;
    const topCountEl = document.getElementById('detailTopCommentCount');
    if (topCountEl) topCountEl.innerText = visibleCount;
    const detailCommentCount = document.getElementById('detailCommentCount');
    if (detailCommentCount) detailCommentCount.innerText = visibleCount;

    if (window.replyTarget && (!tree.byId.has(window.replyTarget.id) || tree.byId.get(window.replyTarget.id).deleted)) {
        window.replyTarget = null;
        updateReplyTargetUI();
    }

    const roots = tree.childrenMap.get(null) || [];
    if (roots.length === 0) {
        commentList.innerHTML = '<div class="comment-empty-state">아직 댓글이 없습니다.</div>';
        return;
    }

    // 모바일에서는 가상 키보드 작동으로 뷰포트가 실시간 축소될 때 이전 측정 높이(minHeight)가 댓글을 강제 팽창시키는 것을 완벽히 방지합니다.
    if (window.innerWidth >= 1024) {
        const currentHeight = commentList.getBoundingClientRect().height;
        if (currentHeight > 0) {
            commentList.style.minHeight = `${currentHeight}px`;
        }
    }

    const html = roots.map(comment => renderCommentBranch(comment, 0, tree, postId)).join('');
    const temp = document.createElement('div');
    temp.innerHTML = html;
    commentList.replaceChildren(...temp.childNodes);

    window.justExpandedCommentId = null;
    requestAnimationFrame(() => {
        commentList.querySelectorAll('.reply-toggle-btn[data-should-expand="true"]').forEach(btn => {
            btn.classList.add('expanded');
            btn.removeAttribute('data-should-expand');
        });
    });

    attachCommentItemEvents();

    // 만약 skipCommentFlip 이 true면 즉시 새 코멘트를 보여주고 끝냄
    if (window.skipCommentFlip) {
        commentList.querySelectorAll('.comment-item, .comment-flat-reply').forEach(item => {
            item.style.opacity = '';
            item.style.transform = '';
            item.style.transition = '';
        });
        setTimeout(() => {
            commentList.style.minHeight = '';
        }, 450);
        return;
    }

    // 1. 화면 깜빡임(팝핑) 방지: 브라우저가 화면을 그리기 전에 새 요소들을 투명하게 만듦
    commentList.querySelectorAll('.comment-item, .comment-flat-reply').forEach(item => {
        if (!oldPositions.has(item.getAttribute('data-id'))) {
            item.style.opacity = '0';
            item.style.transform = 'scale(0.95)';
            item.style.transition = 'none';
        }
    });

    // 2. 답글 보기/접기(.comment-replies-flat) 확장 애니메이션 처리
    commentList.querySelectorAll('.comment-replies-flat.just-expanded').forEach(container => {
        container.classList.remove('just-expanded');
        const fullHeight = container.offsetHeight;
        container.style.height = '0px';
        container.style.opacity = '0';
        container.style.overflow = 'hidden';
        container.style.transition = 'none';
        container.offsetHeight; // force reflow

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                container.style.transition = 'height 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease';
                container.style.height = fullHeight + 'px';
                container.style.opacity = '1';
            });
        });

        setTimeout(() => {
            container.style.height = '';
            container.style.opacity = '';
            container.style.overflow = '';
            container.style.transition = '';
        }, 350);
    });

    // 3. FLIP 및 새 댓글 등장 애니메이션 시작
    requestAnimationFrame(() => {
        commentList.querySelectorAll('.comment-item, .comment-flat-reply').forEach(item => {
            const cid = item.getAttribute('data-id');
            const oldData = oldPositions.get(cid);
            const toggleBtn = item.querySelector('.reply-toggle-btn');

            // 3-1. 답글 갯수 버튼이 0 -> >0 / >0 -> 0 으로 바뀔 때의 마진/너비 애니메이션
            if (oldData && toggleBtn) {
                const hasRepliesNow = !toggleBtn.classList.contains('hidden-toggle');
                if (!oldData.hadReplies && hasRepliesNow) {
                    toggleBtn.classList.add('no-transition');
                    toggleBtn.classList.add('hidden-toggle');
                    void toggleBtn.offsetWidth; // force reflow
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            toggleBtn.classList.remove('no-transition');
                            toggleBtn.classList.remove('hidden-toggle');
                        });
                    });
                } else if (oldData.hadReplies && !hasRepliesNow) {
                    toggleBtn.classList.add('no-transition');
                    toggleBtn.classList.remove('hidden-toggle');
                    void toggleBtn.offsetWidth; // force reflow
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            toggleBtn.classList.remove('no-transition');
                            toggleBtn.classList.add('hidden-toggle');
                        });
                    });
                }
            }

            // 3-2. 기존 댓글의 위치 이동 애니메이션 (FLIP)
            if (oldData) {
                const newRect = item.getBoundingClientRect();
                const deltaY = oldData.rect.top - newRect.top;
                const isPinnedNow = item.getAttribute('data-pinned') === 'true';
                const pinnedChanged = oldData.isPinned !== isPinnedNow;

                if (parseFloat(oldData.opacity) < 1) {
                    item.style.opacity = oldData.opacity;
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            item.style.transition = 'opacity 0.4s ease';
                            item.style.opacity = '1';
                        });
                    });
                }

                if (Math.abs(deltaY) > 1 || pinnedChanged) {
                    if (pinnedChanged) {
                        item.setAttribute('data-pinned', oldData.isPinned ? 'true' : 'false');
                        const pb = item.querySelector('.pin-badge-wrapper');
                        if (pb) {
                            pb.classList.toggle('active', oldData.isPinned);
                            pb.style.transition = 'none';
                        }
                    }

                    if (Math.abs(deltaY) > 1) {
                        item.style.transform = `translateY(${deltaY}px)`;
                    }
                    item.style.transition = 'none';
                    item.offsetHeight; // force reflow

                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            item.classList.add('flipping');
                            item.style.transition = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
                            item.style.transform = '';

                            if (pinnedChanged) {
                                item.setAttribute('data-pinned', isPinnedNow ? 'true' : 'false');
                                const pb = item.querySelector('.pin-badge-wrapper');
                                if (pb) {
                                    pb.classList.toggle('active', isPinnedNow);
                                    pb.style.transition = '';
                                }
                            }

                            setTimeout(() => {
                                item.classList.remove('flipping');
                                item.style.transition = '';
                            }, 450);
                        });
                    });
                }
            } else {
                // 3-3. 새 댓글/답글 등장 애니메이션
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        item.style.opacity = '1';
                        item.style.transform = 'scale(1)';
                        item.style.transition = 'opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
                        setTimeout(() => {
                            item.style.transition = '';
                            item.style.transform = '';
                        }, 350);
                    });
                });
            }
        });
    });

    setTimeout(() => {
        commentList.style.minHeight = '';
    }, 450);
};

window.toggleCommentReplies = function (commentId) {
    if (window.expandedCommentIds.has(commentId)) {
        let parentItem = document.querySelector(`.comment-item[data-id="${commentId}"]`) ||
            document.querySelector(`.comment-flat-reply[data-id="${commentId}"]`);

        if (parentItem && parentItem.nextElementSibling && parentItem.nextElementSibling.classList.contains('comment-replies-flat')) {
            const repliesContainer = parentItem.nextElementSibling;
            const height = repliesContainer.offsetHeight;

            const toggleBtn = parentItem.querySelector('.reply-toggle-btn');
            if (toggleBtn) toggleBtn.classList.remove('expanded');

            repliesContainer.style.height = height + 'px';
            repliesContainer.style.overflow = 'hidden';
            repliesContainer.offsetHeight; // 플로우 강제 리페인트

            repliesContainer.style.transition = 'height 0.3s ease, opacity 0.3s ease, margin 0.3s ease, padding 0.3s ease';
            repliesContainer.style.height = '0px';
            repliesContainer.style.opacity = '0';
            repliesContainer.style.marginTop = '0';
            repliesContainer.style.marginBottom = '0';
            repliesContainer.style.paddingTop = '0';
            repliesContainer.style.paddingBottom = '0';
            repliesContainer.style.border = 'none';

            setTimeout(() => {
                window.expandedCommentIds.delete(commentId);
                window.renderCurrentComments();
            }, 300);
            return;
        }

        window.expandedCommentIds.delete(commentId);
    } else {
        window.expandedCommentIds.add(commentId);
        window.justExpandedCommentId = commentId;
    }
    window.renderCurrentComments();
};

window.expandCommentLineage = function (commentId) {
    const byId = new Map((window.currentCommentDocs || []).map(comment => [comment.id, comment]));
    let currentId = commentId;
    while (currentId) {
        window.expandedCommentIds.add(currentId);
        const currentComment = byId.get(currentId);
        currentId = currentComment ? currentComment.parentId : null;
    }
};

function updateReplyTargetUI(newValue = undefined, focusAfter = false) {
    const input = document.querySelector('.side-detail-container .comment-input');
    const cancelBtn = document.getElementById('cancelReplyBtn');
    const submitBtn = document.querySelector('.side-detail-container .comment-submit-btn');
    if (!input || !cancelBtn) return;

    input.classList.add('text-fade');
    setTimeout(() => {
        if (window.editTarget) {
            input.placeholder = '댓글을 수정하세요...';
            cancelBtn.classList.add('active');
            cancelBtn.title = '수정 취소';
            if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
        } else if (window.replyTarget) {
            input.placeholder = `${window.replyTarget.author}님에게 답글 작성 중...`;
            cancelBtn.classList.add('active');
            cancelBtn.title = '답글 취소';
            if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
        } else {
            input.placeholder = '댓글을 입력하세요...';
            cancelBtn.classList.remove('active');
            cancelBtn.title = '답글 취소';
            if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
        }

        if (newValue !== undefined) {
            input.value = newValue;
        }

        input.classList.remove('text-fade');
        if (focusAfter) {
            input.focus();
        }
    }, 300);
}

window.startReplyTarget = function (postId, commentId) {
    if (!currentUser) {
        alert('답글을 작성하시려면 먼저 Google 로그인을 해주세요!');
        openDrawer();
        return;
    }
    const target = (window.currentCommentDocs || []).find(comment => comment.id === commentId);
    if (!target || target.deleted) return;
    window.replyTarget = {
        postId,
        id: commentId,
        author: target.author || '사용자'
    };
    window.editTarget = null;
    window.expandCommentLineage(commentId);
    updateReplyTargetUI(undefined, true);
};

window.cancelReplyTarget = function () {
    let newValue = undefined;
    if (window.editTarget) {
        window.editTarget = null;
        newValue = '';
        if (typeof commentAttachedImages !== 'undefined') {
            commentAttachedImages = [];
            if (typeof renderCommentImagePreview === 'function') {
                renderCommentImagePreview();
            }
        }
    }
    window.replyTarget = null;
    updateReplyTargetUI(newValue);
};

// 상세 닫기 함수
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

        // 작성 버튼 다시 표시 여부 판단 (통합 함수 호출)
        updateWriteButtonVisibility();

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
        }, 10);
    });

    const area = document.getElementById('detailPostArea');

    // 조회수 증가 (계정 당 1회 또는 브라우저 당 1회)
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
                            ${currentPost.body.replace(/\n/g, '<br>')}
                        </div>
                        ${currentPost.images && currentPost.images.length > 0 ? `
                            <div class="post-image-gallery">
                                ${currentPost.images.map((url, imgIdx) => `<img src="${url}" alt="게시글 첨부 사진" style="cursor: pointer;" onclick="openLightbox('${url}', {postId:'${currentPostId}', commentId:null, authorUid:'${currentPost.uid || ''}', imageIndex:${imgIdx}})">`).join('')}
                            </div>
                        ` : ''}

                        ${window.aiConfig && window.aiConfig.enabled && window.aiConfig.summaryEnabled && window.aiConfig.apiKey ? `
                            <div class="ai-analysis-container" style="margin-top: 2rem; padding: 1.25rem; border-radius: 16px; background: rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.2); display: flex; flex-direction: column; gap: 0.75rem;">
                                <div style="display: flex; align-items: center; justify-content: space-between;">
                                    <div style="display: flex; align-items: center; gap: 0.5rem; font-weight: bold; color: var(--accent-color); font-size: 1rem;">
                                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                                        <span>AI 건의 분석 및 피드백</span>
                                    </div>
                                    <span style="font-size: 0.75rem; color: var(--text-secondary); background: rgba(59, 130, 246, 0.15); padding: 0.2rem 0.5rem; border-radius: 999px;">Gemini 2.5 Flash</span>
                                </div>
                                <div id="aiAnalysisContent-${id}" style="font-size: 0.95rem; line-height: 1.6; color: var(--text-primary);">
                                    ${currentPost.aiSummary ? currentPost.aiSummary.replace(/\n/g, '<br>') : `
                                        <div style="display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding: 1rem 0;" id="aiGenBox-${id}">
                                            <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">아직 생성된 AI 분석 조언이 없습니다.</p>
                                            <button type="button" class="ai-analysis-generate-btn" onclick="generateAiSummary('${id}')" style="background: var(--accent-color); color: white; border: none; padding: 0.5rem 1.2rem; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; transition: background 0.2s;">
                                                <i class="fa-solid fa-wand-magic-sparkles"></i> AI 분석 요약 받기
                                            </button>
                                        </div>
                                    `}
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
            const isPresident = currentUser && isAdmin(currentUser.email);
            const canDelete = isPresident || isCommentAuthor;

            const cCheckbox = canDelete ? `
                        <label class="comment-checkbox-wrapper" style="align-items: center; margin-top: 0.2rem; padding-right: 0;">
                            <input type="checkbox" class="comment-select-cb" value="${cid}" onchange="updateMultiDeleteUI()" style="width: 1.1rem; height: 1.1rem; accent-color: var(--accent-color); cursor: pointer;">
                        </label>
                    ` : '';

            const cDeleteBtn = isCommentAuthor ? `
                        <button type="button" class="board-action-btn delete-btn" onclick="deleteComment('${id}', '${cid}')" title="댓글 삭제">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    ` : '';
            const cEditBtn = isCommentAuthor ? `
                        <button type="button" class="board-action-btn edit-btn role-edit-btn" onclick="event.stopPropagation(); editComment('${id}', '${cid}')" title="답글 수정" style="color: #007bff !important;">
                            <i class="fa-solid fa-pen-to-square" style="color: #007bff !important;"></i>
                        </button>
                    ` : '';

            const cPinBtn = isPresident ? `
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
        window._editingPostImages = post.images || [];

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

        if (typeof commentAttachedImages !== 'undefined') {
            commentAttachedImages = (comment.images || []).map(imgUrl => ({ file: null, dataUrl: imgUrl }));
            commentAttachedVideos = (comment.videos || []).map(v => typeof v === 'string' ? { file: null, dataUrl: v, name: '동영상' } : { file: null, dataUrl: v.url, name: v.name || '동영상' });
            commentAttachedAudios = (comment.audios || []).map(a => typeof a === 'string' ? { file: null, dataUrl: a, name: '음성 파일' } : { file: null, dataUrl: a.url, name: a.name || '음성 파일' });
            commentAttachedPdfs = (comment.pdfs || []).map(p => typeof p === 'string' ? { file: null, dataUrl: p, name: 'PDF 문서' } : { file: null, dataUrl: p.url, name: p.name || 'PDF 문서' });
            commentAttachedHtmls = (comment.htmls || []).map(h => typeof h === 'string' ? { file: null, dataUrl: h, name: 'HTML 문서' } : { file: null, dataUrl: h.url, name: h.name || 'HTML 문서' });

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
    if (!currentUser || !isAdmin(currentUser.email)) return;
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

// 이미지 고화질 유지 및 용량 최적화 함수
async function compressImage(file, maxWidth = 1920, maxHeight = 1920, quality = 0.90) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth || height > maxHeight) {
                    if (width / height > maxWidth / maxHeight) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = Math.round((img.height * width) / img.width);
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                // 고화질 선명도를 유지하면서 전송 제한 용량만 스마트하게 맞춤
                let curQuality = quality;
                let dataUrl = canvas.toDataURL('image/jpeg', curQuality);

                while (dataUrl.length > 900000 && curQuality > 0.6) {
                    curQuality -= 0.05;
                    dataUrl = canvas.toDataURL('image/jpeg', curQuality);
                }

                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
            img.src = e.target.result;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
}

// 댓글/답글 첨부파일 데이터 상태
let commentAttachedImages = [];
let commentAttachedVideos = [];
let commentAttachedAudios = [];
let commentAttachedPdfs = [];
let commentAttachedHtmls = [];

const commentAttachBtn = document.getElementById('commentAttachBtn');
const commentAttachMenu = document.getElementById('commentAttachMenu');
const commentAttachImageBtn = document.getElementById('commentAttachImageBtn');
const commentAttachVideoBtn = document.getElementById('commentAttachVideoBtn');
const commentAttachAudioBtn = document.getElementById('commentAttachAudioBtn');
const commentAttachPdfBtn = document.getElementById('commentAttachPdfBtn');
const commentAttachHtmlBtn = document.getElementById('commentAttachHtmlBtn');

const commentImageInput = document.getElementById('commentImageInput');
const commentVideoInput = document.getElementById('commentVideoInput');
const commentAudioInput = document.getElementById('commentAudioInput');
const commentPdfInput = document.getElementById('commentPdfInput');
const commentHtmlInput = document.getElementById('commentHtmlInput');

const commentImagePreviewContainer = document.getElementById('commentImagePreviewContainer');

if (commentAttachBtn) {
    commentAttachBtn.addEventListener('click', () => {
        commentAttachBtn.classList.toggle('open');
        if (commentAttachMenu) commentAttachMenu.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (commentAttachBtn && commentAttachMenu && !commentAttachBtn.contains(e.target) && !commentAttachMenu.contains(e.target)) {
            commentAttachBtn.classList.remove('open');
            commentAttachMenu.classList.remove('active');
        }
    });
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = err => reject(err);
        reader.readAsDataURL(file);
    });
}

// 1. 이미지 첨부 (최대 10개)
if (commentAttachImageBtn && commentImageInput) {
    commentAttachImageBtn.addEventListener('click', () => {
        if (commentAttachedImages.length >= 10) {
            alert('이미지는 최대 10개까지만 첨부할 수 있습니다.');
            return;
        }
        commentImageInput.click();
        if (commentAttachMenu) commentAttachMenu.classList.remove('active');
        if (commentAttachBtn) commentAttachBtn.classList.remove('open');
    });

    commentImageInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        if (commentAttachedImages.length + files.length > 10) {
            alert('이미지는 최대 10개까지만 첨부할 수 있습니다.');
            return;
        }

        try {
            for (const file of files) {
                if (commentAttachedImages.length >= 10) break;
                const compressedDataUrl = await compressImage(file, 1600, 1600, 0.85);
                commentAttachedImages.push({
                    file: file,
                    dataUrl: compressedDataUrl
                });
            }
            renderCommentAttachmentPreview();
        } catch (err) {
            console.error("이미지 압축 실패:", err);
            alert("이미지 처리 중 오류가 발생했습니다.");
        } finally {
            commentImageInput.value = '';
        }
    });
}

// --- 100% 무료 내장 대용량 미디어 엔지니어링 (신용카드/결제 0원) ---
const DB_NAME = 'ClubMediaStorageDB';
const STORE_NAME = 'mediaFiles';

function openMediaDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

async function saveMediaFileLocally(file) {
    const fileId = 'media_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    try {
        const db = await openMediaDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(file, fileId);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
        return 'localmedia://' + fileId;
    } catch (e) {
        console.warn("로컬 미디어 DB 저장 실패, fallback:", e);
        if (file.size <= 400 * 1024) {
            return await readFileAsDataURL(file);
        }
        return '';
    }
}

function dataURLtoBlob(dataurl) {
    try {
        const arr = dataurl.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'video/mp4';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    } catch (e) {
        console.error("dataURLtoBlob 변환 에러:", e);
        return null;
    }
}

window.resolveMediaUrl = async function (rawUrl) {
    if (!rawUrl) return '';
    if (rawUrl.startsWith('localmedia://')) {
        const fileId = rawUrl.replace('localmedia://', '');
        try {
            const db = await openMediaDB();
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get(fileId);
                req.onsuccess = () => {
                    if (req.result) {
                        resolve(URL.createObjectURL(req.result));
                    } else {
                        resolve('');
                    }
                };
                req.onerror = () => resolve('');
            });
        } catch (e) {
            return '';
        }
    }

    if (rawUrl.startsWith('data:video/')) {
        try {
            const blob = dataURLtoBlob(rawUrl);
            if (blob) {
                return URL.createObjectURL(blob);
            }
        } catch (e) {
            console.warn("Base64 video Blob 변환 실패:", e);
        }
    }

    return rawUrl;
};

function withTimeout(promise, ms = 15000, label = '작업') {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`[타임아웃] ${label} (${ms / 1000}초 제한 초과)`));
        }, ms);
    });

    return Promise.race([
        promise,
        timeoutPromise
    ]).finally(() => {
        clearTimeout(timeoutId);
    });
}

async function uploadFileToTmpFiles(file) {
    console.log(`[tmpfiles.org] 업로드 시도: ${file.name || '파일'}, 크기: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
    try {
        const task = (async () => {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('https://tmpfiles.org/api/v1/upload', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const json = await res.json();
                if (json && json.status === 'success' && json.data && json.data.url) {
                    const rawUrl = json.data.url;
                    // https://tmpfiles.org/12345/video.mp4 -> https://tmpfiles.org/dl/12345/video.mp4
                    const directUrl = rawUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
                    console.log(`[tmpfiles.org] 업로드 성공: ${directUrl}`);
                    return directUrl;
                }
            }
            return null;
        })();

        return await withTimeout(task, 30000, 'tmpfiles.org 업로드');
    } catch (e) {
        console.warn("[tmpfiles.org] 업로드 예외:", e.message || e);
        return null;
    }
}

async function uploadFileToFirebaseStorage(file, folder = 'comments/videos') {
    if (typeof firebase !== 'undefined' && firebase.storage) {
        console.log(`[Firebase Storage] 업로드 시작: ${file.name || '파일'}, 크기: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
        try {
            const uploadTask = (async () => {
                let storageRef;
                try {
                    storageRef = firebase.storage().ref();
                } catch (err) {
                    storageRef = firebase.app().storage('gs://yangjung-science.appspot.com').ref();
                }
                const ext = (file.name || 'video.mp4').split('.').pop() || 'mp4';
                const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
                const fileRef = storageRef.child(fileName);

                const snapshot = await fileRef.put(file);
                const downloadUrl = await snapshot.ref.getDownloadURL();
                return downloadUrl || null;
            })();

            const url = await withTimeout(uploadTask, 45000, 'Firebase Storage 업로드');
            if (url) {
                console.log(`[Firebase Storage] 업로드 완료: ${url}`);
                return url;
            }
        } catch (e) {
            console.warn("[Firebase Storage] 업로드 예외/타임아웃:", e.message || e);
        }
    }
    return null;
}

async function uploadFileToActualCloud(file) {
    console.log(`[클라우드 파이프라인 시작] 파일: ${file.name || '미상'}, 용량: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

    // 0. tmpfiles.org 시도 (CORS 완전 허용 미디어 클라우드, 30초 제한)
    try {
        const tmpUrl = await uploadFileToTmpFiles(file);
        if (tmpUrl && tmpUrl.startsWith('http')) {
            console.log(`[클라우드 파이프라인 성공] tmpfiles.org 완료`);
            return tmpUrl;
        }
    } catch (e) {
        console.warn("[클라우드 파이프라인] tmpfiles.org 건너뜀:", e.message || e);
    }

    // 1. Firebase Storage 시도 (45초 제한)
    try {
        const fbUrl = await uploadFileToFirebaseStorage(file, 'comments/cloud');
        if (fbUrl && fbUrl.startsWith('http')) {
            console.log(`[클라우드 파이프라인 성공] Firebase Storage 완료`);
            return fbUrl;
        }
    } catch (e) {
        console.warn("[클라우드 파이프라인] Firebase Storage 건너뜀:", e.message || e);
    }

    // 2. Litterbox Direct API (20초 제한)
    try {
        console.log(`[클라우드 파이프라인] Litterbox 업로드 시도...`);
        const lbTask = (async () => {
            const formData = new FormData();
            formData.append('reqtype', 'fileupload');
            formData.append('time', '72h');
            formData.append('fileToUpload', file);

            const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const url = await res.text();
                if (url && url.trim().startsWith('http')) {
                    return url.trim();
                }
            }
            return null;
        })();

        const lbUrl = await withTimeout(lbTask, 20000, 'Litterbox 업로드');
        if (lbUrl) {
            console.log(`[클라우드 파이프라인 성공] Litterbox 완료: ${lbUrl}`);
            return lbUrl;
        }
    } catch (e) {
        console.warn("[클라우드 파이프라인] Litterbox 실패:", e.message || e);
    }

    // 3. Catbox Direct API (20초 제한)
    try {
        console.log(`[클라우드 파이프라인] Catbox 업로드 시도...`);
        const cbTask = (async () => {
            const formData = new FormData();
            formData.append('reqtype', 'fileupload');
            formData.append('fileToUpload', file);

            const res = await fetch('https://catbox.moe/user/api.php', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const url = await res.text();
                if (url && url.trim().startsWith('http')) {
                    return url.trim();
                }
            }
            return null;
        })();

        const cbUrl = await withTimeout(cbTask, 20000, 'Catbox 업로드');
        if (cbUrl) {
            console.log(`[클라우드 파이프라인 성공] Catbox 완료: ${cbUrl}`);
            return cbUrl;
        }
    } catch (e) {
        console.warn("[클라우드 파이프라인] Catbox 실패:", e.message || e);
    }

    // 3. 400KB 이하 소형 파일 인라인
    if (file.size <= 400 * 1024) {
        try {
            console.log(`[클라우드 파이프라인] 400KB 이하 소형 파일 DataURL 처리`);
            return await readFileAsDataURL(file);
        } catch (e) {
            console.warn("[클라우드 파이프라인] readFileAsDataURL 실패:", e);
        }
    }

    // 4. 로컬 미디어 저장소 (IndexedDB) fallback
    console.log(`[클라우드 파이프라인] 로컬 저장소(IndexedDB) Fallback 실행`);
    return await saveMediaFileLocally(file);
}

async function uploadFileToStorage(file, folder = 'comments') {
    return await uploadFileToActualCloud(file);
}

async function uploadFileToStorageWithRollover(file, folder = 'comments') {
    return await uploadFileToStorage(file, folder);
}

// 2. 동영상 첨부 (최대 5개)
if (commentAttachVideoBtn && commentVideoInput) {
    commentAttachVideoBtn.addEventListener('click', async () => {
        if (commentAttachedVideos.length >= 5) {
            if (typeof window.customAlert === 'function') {
                await window.customAlert('동영상은 최대 5개까지만 첨부할 수 있습니다.', '첨부 제한 초과');
            } else {
                alert('동영상은 최대 5개까지만 첨부할 수 있습니다.');
            }
            return;
        }
        commentVideoInput.click();
        if (commentAttachMenu) commentAttachMenu.classList.remove('active');
        if (commentAttachBtn) commentAttachBtn.classList.remove('open');
    });

    commentVideoInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        if (commentAttachedVideos.length + files.length > 5) {
            if (typeof window.customAlert === 'function') {
                await window.customAlert('동영상은 최대 5개까지만 첨부할 수 있습니다.', '첨부 제한 초과');
            } else {
                alert('동영상은 최대 5개까지만 첨부할 수 있습니다.');
            }
            commentVideoInput.value = '';
            return;
        }

        const maxSizeBytes = 1024 * 1024 * 1024; // 1GB (1,073,741,824 bytes)
        const oversizedFiles = files.filter(f => f.size > maxSizeBytes);
        const validFiles = files.filter(f => f.size <= maxSizeBytes);

        if (oversizedFiles.length > 0) {
            let msg = '';
            if (oversizedFiles.length === 1) {
                msg = `"${oversizedFiles[0].name}" 파일 크기가 제한 용량(1GB)을 초과합니다.\n1GB 이하의 동영상만 선택해 주세요.`;
            } else {
                const namesList = oversizedFiles.map(f => `• ${f.name}`).join('\n');
                msg = `아래 ${oversizedFiles.length}개 파일 크기가 제한 용량(1GB)을 초과합니다:\n${namesList}\n\n1GB 이하의 동영상만 선택해 주세요.`;
            }

            if (typeof window.customAlert === 'function') {
                await window.customAlert(msg, '용량 제한 초과');
            } else {
                alert(msg);
            }
        }

        for (const file of validFiles) {
            if (commentAttachedVideos.length >= 5) break;
            try {
                commentAttachedVideos.push({
                    file: file,
                    dataUrl: URL.createObjectURL(file),
                    name: file.name
                });
            } catch (err) {
                console.error("동영상 첨부 오류:", err);
            }
        }
        renderCommentAttachmentPreview();
        commentVideoInput.value = '';
    });
}

// 3. 음성 파일 첨부
if (commentAttachAudioBtn && commentAudioInput) {
    commentAttachAudioBtn.addEventListener('click', () => {
        if (commentAttachedAudios.length >= 5) {
            alert('음성 파일은 최대 5개까지만 첨부할 수 있습니다.');
            return;
        }
        commentAudioInput.click();
        if (commentAttachMenu) commentAttachMenu.classList.remove('active');
        if (commentAttachBtn) commentAttachBtn.classList.remove('open');
    });

    commentAudioInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        for (const file of files) {
            if (commentAttachedAudios.length >= 5) break;
            if (file.size > 100 * 1024 * 1024) {
                alert(`'${file.name}' 파일이 제한 용량(100MB)을 초과하여 제외되었습니다.`);
                continue;
            }
            try {
                const dataUrl = file.size > 15 * 1024 * 1024 ? '' : await readFileAsDataURL(file);
                commentAttachedAudios.push({
                    file: file,
                    dataUrl: dataUrl,
                    name: file.name
                });
            } catch (err) {
                console.error("음성 파일 읽기 오류:", err);
            }
        }
        renderCommentAttachmentPreview();
        commentAudioInput.value = '';
    });
}

// 4. PDF 파일 첨부
if (commentAttachPdfBtn && commentPdfInput) {
    commentAttachPdfBtn.addEventListener('click', () => {
        if (commentAttachedPdfs.length >= 5) {
            alert('PDF 파일은 최대 5개까지만 첨부할 수 있습니다.');
            return;
        }
        commentPdfInput.click();
        if (commentAttachMenu) commentAttachMenu.classList.remove('active');
        if (commentAttachBtn) commentAttachBtn.classList.remove('open');
    });

    commentPdfInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        for (const file of files) {
            if (commentAttachedPdfs.length >= 5) break;
            if (file.size > 100 * 1024 * 1024) {
                alert(`'${file.name}' 파일이 제한 용량(100MB)을 초과하여 제외되었습니다.`);
                continue;
            }
            try {
                const dataUrl = file.size > 15 * 1024 * 1024 ? '' : await readFileAsDataURL(file);
                commentAttachedPdfs.push({
                    file: file,
                    dataUrl: dataUrl,
                    name: file.name
                });
            } catch (err) {
                console.error("PDF 파일 읽기 오류:", err);
            }
        }
        renderCommentAttachmentPreview();
        commentPdfInput.value = '';
    });
}

// 5. HTML 파일 첨부
if (commentAttachHtmlBtn && commentHtmlInput) {
    commentAttachHtmlBtn.addEventListener('click', () => {
        if (commentAttachedHtmls.length >= 5) {
            alert('HTML 파일은 최대 5개까지만 첨부할 수 있습니다.');
            return;
        }
        commentHtmlInput.click();
        if (commentAttachMenu) commentAttachMenu.classList.remove('active');
        if (commentAttachBtn) commentAttachBtn.classList.remove('open');
    });

    commentHtmlInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        for (const file of files) {
            if (commentAttachedHtmls.length >= 5) break;
            if (file.size > 50 * 1024 * 1024) {
                alert(`'${file.name}' 파일이 제한 용량(50MB)을 초과하여 제외되었습니다.`);
                continue;
            }
            try {
                const dataUrl = file.size > 15 * 1024 * 1024 ? '' : await readFileAsDataURL(file);
                commentAttachedHtmls.push({
                    file: file,
                    dataUrl: dataUrl,
                    name: file.name
                });
            } catch (err) {
                console.error("HTML 파일 읽기 오류:", err);
            }
        }
        renderCommentAttachmentPreview();
        commentHtmlInput.value = '';
    });
}

function renderCommentAttachmentPreview() {
    const commentInputContainer = document.getElementById('commentInputContainer');
    const container = document.getElementById('commentImagePreviewContainer');
    if (!container) return;

    const totalCount = commentAttachedImages.length + commentAttachedVideos.length + commentAttachedAudios.length + commentAttachedPdfs.length + commentAttachedHtmls.length;

    if (totalCount > 0) {
        if (commentInputContainer && !commentInputContainer.classList.contains('has-images')) {
            const actualRadius = Math.min(9999, commentInputContainer.offsetHeight / 2) + 'px';
            commentInputContainer.classList.add('has-images');
            commentInputContainer.animate([
                { borderRadius: actualRadius },
                { borderRadius: '22px' }
            ], { duration: 200, easing: 'ease' });
        }

        let html = '';

        // 이미지
        commentAttachedImages.forEach((img, index) => {
            html += `
                <div class="comment-image-preview-item">
                    <img src="${img.dataUrl}" alt="첨부 이미지" style="cursor: pointer;" onclick="openLightbox('${img.dataUrl}', {preUpload:true, imageIndex:${index}})">
                    <button type="button" class="remove-btn" onclick="removeCommentAttachedItem('image', ${index})" title="삭제">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
        });

        // 동영상
        commentAttachedVideos.forEach((vid, index) => {
            html += `
                <div class="attachment-preview-card">
                    <i class="fa-solid fa-video" style="color: #ff6b6b; font-size: 1.1rem;"></i>
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px;">${escapeHtml(vid.name)}</span>
                    <button type="button" class="attachment-preview-remove" onclick="removeCommentAttachedItem('video', ${index})" title="삭제">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
        });

        // 음성
        commentAttachedAudios.forEach((aud, index) => {
            html += `
                <div class="attachment-preview-card">
                    <i class="fa-solid fa-microphone" style="color: #51cf66; font-size: 1.1rem;"></i>
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px;">${escapeHtml(aud.name)}</span>
                    <button type="button" class="attachment-preview-remove" onclick="removeCommentAttachedItem('audio', ${index})" title="삭제">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
        });

        // PDF
        commentAttachedPdfs.forEach((pdf, index) => {
            html += `
                <div class="attachment-preview-card">
                    <i class="fa-solid fa-file-pdf" style="color: #ff922b; font-size: 1.1rem;"></i>
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px;">${escapeHtml(pdf.name)}</span>
                    <button type="button" class="attachment-preview-remove" onclick="removeCommentAttachedItem('pdf', ${index})" title="삭제">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
        });

        // HTML
        commentAttachedHtmls.forEach((h, index) => {
            html += `
                <div class="attachment-preview-card">
                    <i class="fa-solid fa-file-code" style="color: #cc5de8; font-size: 1.1rem;"></i>
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px;">${escapeHtml(h.name)}</span>
                    <button type="button" class="attachment-preview-remove" onclick="removeCommentAttachedItem('html', ${index})" title="삭제">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
        });

        container.innerHTML = html;
    } else {
        if (commentInputContainer) commentInputContainer.classList.remove('has-images');
        container.innerHTML = '';
    }
}

function renderCommentImagePreview() {
    renderCommentAttachmentPreview();
}

window.removeCommentAttachedItem = function (type, index) {
    if (type === 'image') commentAttachedImages.splice(index, 1);
    else if (type === 'video') commentAttachedVideos.splice(index, 1);
    else if (type === 'audio') commentAttachedAudios.splice(index, 1);
    else if (type === 'pdf') commentAttachedPdfs.splice(index, 1);
    else if (type === 'html') commentAttachedHtmls.splice(index, 1);
    renderCommentAttachmentPreview();
};

window.removeCommentAttachedImage = function (index) {
    removeCommentAttachedItem('image', index);
};

const commentSubmitBtn = document.querySelector('.side-detail-container .comment-submit-btn');
const commentInput = document.querySelector('.side-detail-container .comment-input');
if (commentSubmitBtn && commentInput) {
    commentSubmitBtn.addEventListener('click', async () => {
        if (!currentUser) {
            alert('댓글을 작성하시려면 먼저 Google 로그인을 해주세요!');
            openDrawer();
            return;
        }
        if (!currentPostId) return;
        const body = commentInput.value.trim();
        const totalAttachments = commentAttachedImages.length + commentAttachedVideos.length + commentAttachedAudios.length + commentAttachedPdfs.length + commentAttachedHtmls.length;
        if (body === '' && totalAttachments === 0) return;

        console.log(`[댓글 제출 시작] 내용: "${body}", 첨부파일 총 ${totalAttachments}개`);

        commentSubmitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        commentSubmitBtn.disabled = true;

        try {
            console.log(`[댓글 제출] 이미지 첨부 처리 중... (${commentAttachedImages.length}개)`);
            const commentImageUrls = await Promise.all(commentAttachedImages.map(async img => {
                if (img.file) {
                    try {
                        return await uploadFileToActualCloud(img.file);
                    } catch (e) {
                        console.warn("이미지 업로드 예외:", e);
                    }
                }
                return img.dataUrl || '';
            }));

            console.log(`[댓글 제출] 동영상 첨부 처리 중... (${commentAttachedVideos.length}개)`);
            const commentVideoItems = await Promise.all(commentAttachedVideos.map(async v => {
                let url = '';
                if (v.file) {
                    try {
                        url = await uploadFileToActualCloud(v.file);
                    } catch (e) {
                        console.warn("비디오 업로드 예외:", e);
                    }
                } else if (v.dataUrl && !v.dataUrl.startsWith('blob:')) {
                    url = v.dataUrl;
                }
                if (!url && v.file) {
                    url = await saveMediaFileLocally(v.file) || v.dataUrl || '';
                }
                return { url: url || '', name: v.name || '동영상' };
            }));

            console.log(`[댓글 제출] 음성 첨부 처리 중... (${commentAttachedAudios.length}개)`);
            const commentAudioItems = await Promise.all(commentAttachedAudios.map(async a => {
                let url = '';
                if (a.file) {
                    try {
                        url = await uploadFileToActualCloud(a.file);
                    } catch (e) {
                        console.warn("음성 업로드 예외:", e);
                    }
                }
                if (!url) url = a.dataUrl || '';
                return { url: url || '', name: a.name || '음성 파일' };
            }));

            console.log(`[댓글 제출] PDF 첨부 처리 중... (${commentAttachedPdfs.length}개)`);
            const commentPdfItems = await Promise.all(commentAttachedPdfs.map(async p => {
                let url = '';
                if (p.file) {
                    try {
                        url = await uploadFileToActualCloud(p.file);
                    } catch (e) {
                        console.warn("PDF 업로드 예외:", e);
                    }
                }
                if (!url) url = p.dataUrl || '';
                return { url: url || '', name: p.name || 'PDF 문서' };
            }));

            console.log(`[댓글 제출] HTML 첨부 처리 중... (${commentAttachedHtmls.length}개)`);
            const commentHtmlItems = await Promise.all(commentAttachedHtmls.map(async h => {
                let url = '';
                if (h.file) {
                    try {
                        url = await uploadFileToActualCloud(h.file);
                    } catch (e) {
                        console.warn("HTML 업로드 예외:", e);
                    }
                }
                if (!url) url = h.dataUrl || '';
                return { url: url || '', name: h.name || 'HTML 문서' };
            }));

            function sanitizeForFirestore(items) {
                if (!items) return [];
                const flatItems = Array.isArray(items) ? items.flat(Infinity) : [items];
                return flatItems.map(item => {
                    if (item === undefined || item === null) return '';
                    if (typeof item === 'string') return item;
                    if (typeof item === 'number' || typeof item === 'boolean') return String(item);
                    if (typeof item === 'object') {
                        try {
                            return JSON.stringify({
                                url: item.url || item.dataUrl || '',
                                name: item.name || ''
                            });
                        } catch (e) {
                            return String(item.url || item.name || '');
                        }
                    }
                    return String(item || '');
                }).filter(s => s !== '');
            }

            const cleanImages = sanitizeForFirestore(commentImageUrls);
            const cleanVideos = sanitizeForFirestore(commentVideoItems);
            const cleanAudios = sanitizeForFirestore(commentAudioItems);
            const cleanPdfs = sanitizeForFirestore(commentPdfItems);
            const cleanHtmls = sanitizeForFirestore(commentHtmlItems);

            console.log(`[댓글 DB 전송 준비 완료] DB 저장 진행 중...`);

            if (window.editTarget) {
                await db.collection('posts').doc(currentPostId)
                    .collection('comments').doc(window.editTarget.id).update({
                        body: body,
                        images: cleanImages,
                        videos: cleanVideos,
                        audios: cleanAudios,
                        pdfs: cleanPdfs,
                        htmls: cleanHtmls,
                        edited: true,
                        editedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                window.editTarget = null;
                console.log(`[댓글 수정 성공] DB 업데이트 완료`);
            } else {
                const parentId = (window.replyTarget && window.replyTarget.postId === currentPostId) ? window.replyTarget.id : null;

                const imgDescs = {};
                commentAttachedImages.forEach((img, idx) => {
                    if (img.description) imgDescs[String(idx)] = img.description;
                });

                await db.collection('posts').doc(currentPostId).collection('comments').add({
                    author: isAdmin(currentUser.email) ? getAdminName(currentUser.email) : currentUser.displayName,
                    uid: currentUser.uid,
                    userPhoto: currentUser.photoURL || '',
                    email: currentUser.email,
                    body: body,
                    images: cleanImages,
                    videos: cleanVideos,
                    audios: cleanAudios,
                    pdfs: cleanPdfs,
                    htmls: cleanHtmls,
                    imageDescriptions: imgDescs,
                    parentId: parentId,
                    replyToAuthor: parentId && window.replyTarget ? window.replyTarget.author : '',
                    pinned: false,
                    likes: 0,
                    likedUsers: [],
                    deleted: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                if (parentId) {
                    window.expandCommentLineage(parentId);
                }
                console.log(`[댓글 작성 성공] DB 등록 완료`);
            }

            commentInput.value = '';
            commentAttachedImages = [];
            commentAttachedVideos = [];
            commentAttachedAudios = [];
            commentAttachedPdfs = [];
            commentAttachedHtmls = [];
            renderCommentAttachmentPreview();
            window.replyTarget = null;
            updateReplyTargetUI('');
        } catch (e) {
            console.error("댓글 작성/수정 실패 예외 처리:", e);
            alert(e.message || '댓글 작성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
            updateReplyTargetUI('');
        } finally {
            commentSubmitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
            commentSubmitBtn.disabled = false;
            console.log(`[댓글 제출 완료] 파란색 스피너 해제 및 버튼 상태 복구 완료`);
        }
    });

    // 엔터키 지원 추가
    commentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            commentSubmitBtn.click();
        }
    });
}

// 사이드 메뉴 아이템 클릭 시 알림 및 드로어 닫기 (인사말, 목표, 건의방, 직책 관리, AI 설정, 클라우드 계정 관리 제외)
document.querySelectorAll('.drawer-menu a:not(#greetingLink):not(#goalLink):not(#suggestionLink):not(#roleManageMenuBtn):not(#aiSettingsMenuBtn):not(#cloudAccountManageMenuBtn)').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const title = item.innerText.trim();
        alert(title + ' 페이지로 이동 기능은 아직 준비 중입니다.');
        closeDrawer();
    });
});

// 클라우드 계정 관리 메뉴 클릭 연동 (독립 페이지 전환)
const cloudAccountBtn = document.getElementById('cloudAccountManageMenuBtn');
if (cloudAccountBtn) {
    cloudAccountBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof closeDrawer === 'function') closeDrawer();
        const targetPage = document.getElementById('cloudAccountSettingsPage');
        const fromPage = window.currentPage || document.getElementById('mainPage');
        if (targetPage && typeof window.switchPage === 'function') {
            window.switchPage(fromPage, targetPage);
        }
    });
}

// --- 이미지 라이트박스 줌 & 패닝 기능 ---
const imageLightbox = document.getElementById('imageLightbox');
const imageLightboxImg = document.getElementById('imageLightboxImg');
const imageLightboxClose = document.getElementById('imageLightboxClose');

let currentZoom = 1;
let currentPanX = 0;
let currentPanY = 0;

let isLightboxDragging = false;
let lightboxStartX = 0;
let lightboxStartY = 0;
let initialPinchDistance = null;

function updateTransform(animate = false) {
    imageLightboxImg.style.transition = animate ? 'transform 0.1s ease-out' : 'none';
    imageLightboxImg.style.transform = `translate(${currentPanX}px, ${currentPanY}px) scale(${currentZoom})`;
}

let lightboxMeta = {};

window.openLightbox = function (url, meta) {
    if (!meta) meta = {};
    history.pushState({ modal: 'lightbox' }, '', '#lightbox');
    imageLightboxImg.src = url;
    imageLightbox.classList.add('active');
    currentZoom = 1; currentPanX = 0; currentPanY = 0;
    updateTransform(true);

    // 설명 보기 버튼 처리
    lightboxMeta = meta;
    const descBtn = document.getElementById('lightboxDescBtn');

    if ((meta.postId && meta.imageIndex !== undefined) || (meta.preUpload && meta.imageIndex !== undefined)) {
        descBtn.style.display = '';
    } else {
        descBtn.style.display = 'none';
    }
};

async function loadImageDescription(meta) {
    try {
        let docRef;
        if (meta.commentId) {
            docRef = db.collection('posts').doc(meta.postId)
                .collection('comments').doc(meta.commentId);
        } else {
            docRef = db.collection('posts').doc(meta.postId);
        }
        const doc = await docRef.get();
        if (doc.exists) {
            const descriptions = doc.data().imageDescriptions || {};
            return descriptions[String(meta.imageIndex)] || '';
        }
        return '';
    } catch (e) {
        console.error('사진 설명 불러오기 실패', e);
        return '';
    }
}

async function saveImageDescription(meta, description) {
    try {
        let docRef;
        if (meta.commentId) {
            docRef = db.collection('posts').doc(meta.postId)
                .collection('comments').doc(meta.commentId);
        } else {
            docRef = db.collection('posts').doc(meta.postId);
        }
        await docRef.update({
            [`imageDescriptions.${meta.imageIndex}`]: description
        });
        return true;
    } catch (e) {
        console.error('사진 설명 저장 실패', e);
        return false;
    }
}

// 설명 모달 열기/닫기
function openDescModal() {
    document.getElementById('lightboxDescOverlay').classList.add('active');
    document.getElementById('lightboxDescModal').classList.add('active');
}

function closeDescModal() {
    document.getElementById('lightboxDescOverlay').classList.remove('active');
    document.getElementById('lightboxDescModal').classList.remove('active');
    // 편집 영역 숨기기
    const ea = document.getElementById('lightboxDescEditArea');
    ea.style.display = 'none';
    document.getElementById('lightboxDescText').style.display = '';
    document.getElementById('lightboxDescEditBtn').style.display =
        document.getElementById('lightboxDescEditBtn').dataset.canEdit === 'true' ? '' : 'none';
}

// 설명 보기 버튼 클릭
document.getElementById('lightboxDescBtn').addEventListener('click', async (e) => {
    e.stopPropagation();
    const descText = document.getElementById('lightboxDescText');
    const editBtn = document.getElementById('lightboxDescEditBtn');
    const editArea = document.getElementById('lightboxDescEditArea');

    editArea.style.display = 'none';
    descText.style.display = '';

    if (lightboxMeta.preUpload) {
        const desc = commentAttachedImages[lightboxMeta.imageIndex]?.description || '';
        descText.textContent = desc || '설명이 없습니다.';
        descText.className = 'lightbox-desc-text' + (desc ? '' : ' empty');
        editBtn.style.display = '';
        editBtn.dataset.canEdit = 'true';
        openDescModal();
    } else if (lightboxMeta.postId) {
        const desc = await loadImageDescription(lightboxMeta);
        descText.textContent = desc || '설명이 없습니다.';
        descText.className = 'lightbox-desc-text' + (desc ? '' : ' empty');
        const canEdit = currentUser && (
            lightboxMeta.authorUid === currentUser.uid || isAdmin(currentUser.email)
        );
        editBtn.style.display = canEdit ? '' : 'none';
        editBtn.dataset.canEdit = canEdit ? 'true' : 'false';
        openDescModal();
    }
});

// 설명 모달 X 버튼
document.getElementById('lightboxDescCloseBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    closeDescModal();
});

// 오버레이 클릭
document.getElementById('lightboxDescOverlay').addEventListener('click', (e) => {
    e.stopPropagation();
    closeDescModal();
});

// 모달 본문 높이 전환 (FLIP)
function transitionModalBody(prepare) {
    const body = document.getElementById('lightboxDescModal');
    const oldH = body.offsetHeight;
    prepare();
    const newH = body.offsetHeight;
    body.style.overflow = 'hidden';
    const anim = body.animate([
        { height: oldH + 'px' },
        { height: newH + 'px' }
    ], { duration: 280, easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)' });

    anim.onfinish = () => {
        body.style.overflow = '';
        body.style.height = '';
    };
}

// 수정 버튼
document.getElementById('lightboxDescEditBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const editArea = document.getElementById('lightboxDescEditArea');
    const input = document.getElementById('lightboxDescInput');
    const currentText = document.getElementById('lightboxDescText').textContent;
    input.value = (currentText === '설명이 없습니다.' || currentText === '불러오는 중...') ? '' : currentText;

    transitionModalBody(() => {
        document.getElementById('lightboxDescText').style.display = 'none';
        document.getElementById('lightboxDescEditBtn').style.display = 'none';
        editArea.style.display = 'block';
    });
    setTimeout(() => input.focus(), 300);
});

// 편집→보기 전환
function switchToView() {
    const editArea = document.getElementById('lightboxDescEditArea');
    const editBtn = document.getElementById('lightboxDescEditBtn');
    transitionModalBody(() => {
        editArea.style.display = 'none';
        document.getElementById('lightboxDescText').style.display = '';
        if (editBtn.dataset.canEdit === 'true') {
            editBtn.style.display = '';
        }
    });
}

// 저장 버튼
document.getElementById('lightboxDescSave').addEventListener('click', async (e) => {
    e.stopPropagation();
    const desc = document.getElementById('lightboxDescInput').value.trim();
    const saveBtn = document.getElementById('lightboxDescSave');

    if (lightboxMeta.preUpload) {
        if (commentAttachedImages[lightboxMeta.imageIndex]) {
            commentAttachedImages[lightboxMeta.imageIndex].description = desc;
        }
        const descText = document.getElementById('lightboxDescText');
        descText.textContent = desc || '설명이 없습니다.';
        descText.className = 'lightbox-desc-text' + (desc ? '' : ' empty');
        switchToView();
        return;
    }

    saveBtn.textContent = '저장 중...';
    saveBtn.disabled = true;
    const success = await saveImageDescription(lightboxMeta, desc);
    if (success) {
        const descText = document.getElementById('lightboxDescText');
        descText.textContent = desc || '설명이 없습니다.';
        descText.className = 'lightbox-desc-text' + (desc ? '' : ' empty');
        switchToView();
    } else {
        alert('저장 실패');
    }
    saveBtn.textContent = '저장';
    saveBtn.disabled = false;
});

// 취소 버튼
document.getElementById('lightboxDescCancel').addEventListener('click', (e) => {
    e.stopPropagation();
    switchToView();
});

function closeLightbox(e) {
    const fromPopState = (e === true);
    imageLightbox.classList.remove('active');
    closeDescModal();
    setTimeout(() => {
        imageLightboxImg.src = '';
        lightboxMeta = {};
    }, 300);
    if (fromPopState !== true && history.state && history.state.modal === 'lightbox') {
        window._isProgrammaticBack = true;
        history.back();
    }
}

imageLightboxClose.addEventListener('click', closeLightbox);
imageLightbox.addEventListener('click', (e) => {
    if (e.target === imageLightbox) closeLightbox();
});

// 데스크탑 마우스 휠 확대/축소
imageLightbox.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
        currentZoom = Math.min(currentZoom + 0.15, 5);
    } else {
        currentZoom = Math.max(currentZoom - 0.15, 1);
        if (currentZoom === 1) { currentPanX = 0; currentPanY = 0; }
    }
    updateTransform(true);
}, { passive: false });

// 데스크탑 마우스 드래그 패닝
imageLightboxImg.addEventListener('mousedown', (e) => {
    if (currentZoom > 1) {
        isLightboxDragging = true;
        lightboxStartX = e.clientX - currentPanX;
        lightboxStartY = e.clientY - currentPanY;
        imageLightboxImg.style.cursor = 'grabbing';
        e.preventDefault();
    }
});
window.addEventListener('mousemove', (e) => {
    if (!isLightboxDragging) return;
    currentPanX = e.clientX - lightboxStartX;
    currentPanY = e.clientY - lightboxStartY;
    updateTransform(false);
});
window.addEventListener('mouseup', () => {
    isLightboxDragging = false;
    imageLightboxImg.style.cursor = 'pointer';
});

// 모바일 손가락(핀치) 확대/축소 및 패닝
imageLightbox.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
        initialPinchDistance = Math.hypot(
            e.touches[0].pageX - e.touches[1].pageX,
            e.touches[0].pageY - e.touches[1].pageY
        );
    } else if (e.touches.length === 1 && currentZoom > 1) {
        isLightboxDragging = true;
        lightboxStartX = e.touches[0].pageX - currentPanX;
        lightboxStartY = e.touches[0].pageY - currentPanY;
    }
});

imageLightbox.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 2 && initialPinchDistance !== null) {
        const currentDistance = Math.hypot(
            e.touches[0].pageX - e.touches[1].pageX,
            e.touches[0].pageY - e.touches[1].pageY
        );
        const ratio = currentDistance / initialPinchDistance;
        currentZoom = Math.min(Math.max(currentZoom * ratio, 1), 5);
        if (currentZoom === 1) { currentPanX = 0; currentPanY = 0; }
        initialPinchDistance = currentDistance;
        updateTransform(false);
    } else if (e.touches.length === 1 && isLightboxDragging) {
        currentPanX = e.touches[0].pageX - lightboxStartX;
        currentPanY = e.touches[0].pageY - lightboxStartY;
        updateTransform(false);
    }
}, { passive: false });

imageLightbox.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) initialPinchDistance = null;
    if (e.touches.length === 0) {
        isLightboxDragging = false;
        imageLightboxImg.style.transition = 'transform 0.2s ease';
    }
});


// Post Multi Select Variables
window.isPostMultiSelectMode = false;
let postPressTimer = null;
let isPostPressing = false;
let postStartY = 0;
let postStartX = 0;
window.ignoreNextPostClick = false;

window.handlePostPointerDown = function (e, postId) {
    if (e.button === 2) return;
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input') || e.target.closest('.board-author')) return;

    isPostPressing = true;
    postStartY = e.clientY || (e.touches && e.touches[0].clientY);
    postStartX = e.clientX || (e.touches && e.touches[0].clientX);

    postPressTimer = setTimeout(() => {
        if (isPostPressing && !window.isPostMultiSelectMode) {
            if (navigator.vibrate) navigator.vibrate(50);
            window.ignoreNextPostClick = true;
            enterPostMultiSelectMode(postId);
        }
    }, 600);
};

window.handlePostPointerMove = function (e) {
    if (!isPostPressing) return;
    const currentY = e.clientY || (e.touches && e.touches[0].clientY);
    const currentX = e.clientX || (e.touches && e.touches[0].clientX);
    if (Math.abs(currentY - postStartY) > 10 || Math.abs(currentX - postStartX) > 10) {
        clearTimeout(postPressTimer);
        isPostPressing = false;
    }
};

window.handlePostPointerUp = function () {
    clearTimeout(postPressTimer);
    isPostPressing = false;
};

window.enterPostMultiSelectMode = function (targetId) {
    window.isPostMultiSelectMode = true;
    history.pushState({ modal: 'postMultiSelect' }, '', '');
    document.body.classList.add('post-multi-select-active');
    const cb = document.querySelector(`.post-select-cb[value="${targetId}"]`);
    if (cb) {
        cb.checked = true;
    }
    updatePostMultiDeleteUI();
};

window.updatePostMultiDeleteUI = function () {
    const checkboxes = document.querySelectorAll('.post-select-cb:checked');
    const bar = document.getElementById('postMultiDeleteBar');
    const cntSpan = document.getElementById('postMultiDeleteCount');
    const pinBtn = document.getElementById('postMultiPinBtn');
    if (pinBtn) pinBtn.style.display = (currentUser && isAdmin(currentUser.email)) ? 'block' : 'none';
    if (checkboxes.length > 0) {
        cntSpan.textContent = `${checkboxes.length}개 선택됨`;
        bar.style.bottom = '100px';
    } else {
        bar.style.bottom = '-250px';
    }
};

window.executePostMultiPin = async function () {
    if (!currentUser || !isAdmin(currentUser.email)) return;
    const checkboxes = document.querySelectorAll('.post-select-cb:checked');
    if (checkboxes.length === 0) return;
    if (!await window.customConfirm(`선택한 ${checkboxes.length}개의 게시물 고정 상태를 전환하시겠습니까?`, '게시물 고정 설정')) return;

    try {
        for (let cb of checkboxes) {
            const pid = cb.value;
            const doc = await db.collection('posts').doc(pid).get();
            if (doc.exists) {
                const currentPinned = doc.data().pinned || false;
                await db.collection('posts').doc(pid).update({ pinned: !currentPinned });
            }
        }
        cancelPostMultiDelete();
    } catch (e) {
        console.error("Multi pin post error", e);
        alert('게시물 고정 중 오류가 발생했습니다.');
    }
};

window.cancelPostMultiDelete = function (fromPopState = false) {
    window.isPostMultiSelectMode = false;
    document.body.classList.remove('post-multi-select-active');
    document.querySelectorAll('.post-select-cb').forEach(cb => cb.checked = false);
    updatePostMultiDeleteUI();
    if (!fromPopState && history.state && history.state.modal === 'postMultiSelect') {
        window._isProgrammaticBack = true;
        history.back();
    }
};

window.executePostMultiDelete = async function () {
    const checkboxes = document.querySelectorAll('.post-select-cb:checked');
    if (checkboxes.length === 0) return;
    if (!await window.customConfirm(`선택한 ${checkboxes.length}개의 게시물을 삭제하시겠습니까?`, '게시물 삭제')) return;

    try {
        for (let cb of checkboxes) {
            const pid = cb.value;
            await db.collection('posts').doc(pid).delete();
        }
        cancelPostMultiDelete();
    } catch (e) {
        console.error("Multi delete post error", e);
        alert('게시물 삭제 중 오류가 발생했습니다.');
    }
};

window.addEventListener('popstate', (e) => {
    if (window._isProgrammaticBack) {
        setTimeout(() => { window._isProgrammaticBack = false; }, 200);
        return;
    }

    // 관리자 비밀번호 모달
    const adminModal = document.getElementById('adminModal');
    if (adminModal && adminModal.classList.contains('active')) {
        if (typeof window.closeAdminModal === 'function') window.closeAdminModal(true);
        return;
    }
    // 관리자 비활성화 모달
    const adminDeactivateModal = document.getElementById('adminDeactivateModal');
    if (adminDeactivateModal && adminDeactivateModal.classList.contains('active')) {
        if (typeof window.closeAdminDeactivateModal === 'function') window.closeAdminDeactivateModal(true);
        return;
    }
    // 커스텀 확인 모달 (삭제 확인 등) - 자체 popstate 핸들러가 있으므로 여기서는 fallback
    const customConfirmModal = document.getElementById('customConfirmModal');
    if (customConfirmModal && customConfirmModal.classList.contains('active')) {
        return; // customConfirm 자체 popstate 핸들러가 처리
    }

    // 댓글/답글 다중선택 모드
    if (window.isMultiSelectMode) {
        window.cancelMultiDelete(true);
        return;
    }
    // 게시물 다중선택 모드
    if (window.isPostMultiSelectMode) {
        window.cancelPostMultiDelete(true);
        return;
    }

    const lightbox = document.getElementById('imageLightbox');
    if (lightbox && lightbox.classList.contains('active')) {
        closeLightbox(true);
        return;
    }
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal && settingsModal.classList.contains('active')) {
        if (window.isUsefulSubPageOpen && typeof window.closeUsefulSubPage === 'function') {
            window.closeUsefulSubPage(true);
        } else if (typeof window.closeSettingsModal === 'function') {
            window.closeSettingsModal(true);
        }
        return;
    }
    const sideDrawer = document.getElementById('sideDrawer');
    if (sideDrawer && sideDrawer.classList.contains('active')) {
        closeDrawer(true);
        return;
    }
    const writePostPage = document.getElementById('writePostPage');
    if (writePostPage && writePostPage.classList.contains('active')) {
        closeWritePage(true);
        return;
    }
    const sideDetailContainer = document.getElementById('sideDetailContainer');
    if (sideDetailContainer && !sideDetailContainer.classList.contains('detail-hidden')) {
        closeSideDetail(true);
        return;
    }

    // [추가] 탭 네비게이션 복구 처리 (시스템 뒤로 가기 시 페이지 전환)
    if (e.state && e.state.page) {
        const targetPage = document.getElementById(e.state.page);
        if (targetPage) switchPage(currentPage, targetPage, true);
    } else {
        if (currentPage !== mainPage) switchPage(currentPage, mainPage, true);
    }
});
// 초기 상태 히스토리 설정
window.addEventListener('DOMContentLoaded', () => {
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    if (!history.state || !history.state.page) {
        history.replaceState({ page: 'mainPage' }, '', '#/mainPage');
    }
});

// PWA 설정
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => {
            console.error('ServiceWorker registration failed: ', err);
        });
    });
}

