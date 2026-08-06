// 커뮤니티 핵심: 로그인, 글 작성, 게시글 목록과 정렬
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
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imageCountInfo = document.getElementById('imageCountInfo');
const imagePreviewWrapper = document.getElementById('imagePreviewWrapper');
const imagePreviewInner = document.getElementById('imagePreviewInner');
const MAX_IMAGES = 40;
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

// 첨부 기준 안내 모달 이벤트
const attachGuideBtn = document.getElementById('attachGuideBtn');
const attachGuideModal = document.getElementById('attachGuideModal');
const attachGuideOverlay = document.getElementById('attachGuideOverlay');
const attachGuideCloseBtn = document.getElementById('attachGuideCloseBtn');

function openAttachGuideModal() {
    if (attachGuideModal && attachGuideOverlay) {
        attachGuideModal.classList.add('active');
        attachGuideOverlay.classList.add('active');
    }
}
function closeAttachGuideModal() {
    if (attachGuideModal && attachGuideOverlay) {
        attachGuideModal.classList.remove('active');
        attachGuideOverlay.classList.remove('active');
    }
}

if (attachGuideBtn) attachGuideBtn.addEventListener('click', openAttachGuideModal);
if (attachGuideCloseBtn) attachGuideCloseBtn.addEventListener('click', closeAttachGuideModal);
if (attachGuideOverlay) attachGuideOverlay.addEventListener('click', closeAttachGuideModal);

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
            alert(`첨부파일은 최대 ${MAX_IMAGES}개까지만 추가할 수 있습니다.`);
            return;
        }
        files.forEach(file => {
            selectedImages.push(file);
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
        imageCountInfo.textContent = `첨부 파일 ${selectedImages.length}개 / ${MAX_IMAGES}개`;
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

