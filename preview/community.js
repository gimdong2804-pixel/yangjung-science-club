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
let isAuthReady = false;

// Firestore 리스너 구독 해제 변수 (TDZ 방지를 위해 상단 선언)
var postsUnsubscribe = null;
var postUnsubscribe = null;
const postCommentCountUnsubscribes = new Map();

function comparableLikeFieldValue(value) {
    if (value === null || typeof value !== 'object') return value;
    if (value instanceof Date) return { date: value.getTime() };
    if (typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
        return { seconds: value.seconds, nanoseconds: value.nanoseconds };
    }
    if (Array.isArray(value)) return value.map(comparableLikeFieldValue);

    const normalized = {};
    Object.keys(value).sort().forEach((key) => {
        normalized[key] = comparableLikeFieldValue(value[key]);
    });
    return normalized;
}

window.hasSameNonLikeFields = function (before, after) {
    if (!before || !after) return false;
    const withoutLikes = (data) => {
        const fields = {};
        Object.keys(data).sort().forEach((key) => {
            if (key !== 'likes' && key !== 'likedUsers') {
                fields[key] = comparableLikeFieldValue(data[key]);
            }
        });
        return fields;
    };
    try {
        return JSON.stringify(withoutLikes(before)) === JSON.stringify(withoutLikes(after));
    } catch (error) {
        return false;
    }
};

function clearPostCommentCountSubscriptions(keepIds = null) {
    postCommentCountUnsubscribes.forEach((unsubscribe, postId) => {
        if (keepIds && keepIds.has(postId)) return;
        try {
            unsubscribe();
        } catch (error) {
            console.warn('댓글 수 구독 해제 실패:', error);
        }
        postCommentCountUnsubscribes.delete(postId);
    });
}

// 관리자 계정 판별 함수는 script.js에서 먼저 공통으로 정의합니다.
function getAdminName(email) {
    const names = { 'gimdong2804@gmail.com': '회장 김동현', 'sjh20110407@gmail.com': '사장' };
    return names[email] || null;
}

// 이전 공개 테스트 모드 기록은 실제 로그인 권한으로 오인되지 않도록 제거합니다.
localStorage.removeItem('dev_mode');
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
window.triggerGoogleLogin = async function () {
    try {
        if (googleLoginBtn) googleLoginBtn.disabled = true;
        await auth.signInWithPopup(googleProvider);
    } catch (error) {
        showLoginError(error);
    } finally {
        if (googleLoginBtn) googleLoginBtn.disabled = false;
    }
};

if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', () => {
        window.triggerGoogleLogin();
    });
}

// 로그아웃
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            if (typeof window.unregisterPushToken === 'function') {
                await window.unregisterPushToken();
            }
            await auth.signOut();
        } catch (error) {
            console.error("Sign-Out Error: ", error);
        }
    });
}

// Auth 상태 리스너
let authUITimeout;
auth.onAuthStateChanged((user) => {
    isAuthReady = true;
    clearTimeout(authUITimeout);
    const postAuthorInput = document.getElementById('postAuthor');
    if (user) {
        currentUser = user;

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
        const initialDisplayName = isPresident ? getAdminName(user.email) : (currentUserRole || user.displayName || '회원');
        userName.innerText = initialDisplayName;
        userEmail.innerText = user.email;
        userAvatar.src = user.photoURL || '';

        if (postAuthorInput) {
            postAuthorInput.value = initialDisplayName;
            postAuthorInput.placeholder = "작성자 이름";
        }

        // [추가] 로그인 즉시 게시글 목록 로드 (지연 없이 실행)
        const currentSort = document.querySelector('.custom-dropdown-option.active')?.getAttribute('data-value') || 'latest';
        loadPosts(currentSort);

        // 직책 정보 비동기 조회 (게시글 로드를 지연시키지 않음)
        db.collection('userRoles').doc(user.email).get().then(roleDoc => {
            if (roleDoc.exists) {
                currentUserRole = roleDoc.data().roleName;
            } else {
                currentUserRole = null;
            }
            if (currentUser && currentUser.email === user.email) {
                const finalDisplayName = isPresident ? getAdminName(user.email) : (currentUserRole || user.displayName || '회원');
                userName.innerText = finalDisplayName;
                if (postAuthorInput) postAuthorInput.value = finalDisplayName;
            }
        }).catch(e => {
            console.error("Failed to fetch user role", e);
            currentUserRole = null;
        });

        if (false && isAdmin(user.email)) {
            migrateLegacyCommunityIdentityFields().catch((error) => {
                sessionStorage.removeItem('community_privacy_cleanup_started');
                console.warn('기존 커뮤니티 개인정보 정리 실패:', error);
            });
        }
    } else {
        currentUser = null;
        if (typeof window.clearUserAccountData === 'function') {
            window.clearUserAccountData();
        }
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

// ==========================================================================
// 🏷️ 카테고리 (게시판 주제) 데이터 및 모달 핸들러 (삼성 멤버스 스타일)
// ==========================================================================
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeInlineJsString(value) {
    const escapedForJs = String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
    return escapeHtml(escapedForJs);
}

function safeNonNegativeInteger(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

function getSafeImageUrl(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (raw.startsWith('blob:') || raw.startsWith('data:image/')) return raw;
    try {
        const parsed = new URL(raw, window.location.href);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
    } catch (error) {
        return '';
    }
}

async function commitMigrationOperations(operations) {
    for (let start = 0; start < operations.length; start += 400) {
        const batch = db.batch();
        operations.slice(start, start + 400).forEach(({ ref, data }) => batch.update(ref, data));
        await batch.commit();
    }
}

async function migrateLegacyCommunityIdentityFields() {
    if (sessionStorage.getItem('community_privacy_cleanup_started') === 'true') return;
    sessionStorage.setItem('community_privacy_cleanup_started', 'true');
    const markerRef = db.collection('settings').doc('community_privacy_v1');
    const postsSnapshot = await db.collection('posts').get();
    const operations = [];

    for (const postDoc of postsSnapshot.docs) {
        const post = postDoc.data() || {};
        if (Object.prototype.hasOwnProperty.call(post, 'email')) {
            operations.push({
                ref: postDoc.ref,
                data: { email: firebase.firestore.FieldValue.delete() }
            });
        }

        const commentsSnapshot = await postDoc.ref.collection('comments').get();
        commentsSnapshot.forEach((commentDoc) => {
            const comment = commentDoc.data() || {};
            const update = {};
            let needsUpdate = false;

            if (Object.prototype.hasOwnProperty.call(comment, 'email')) {
                update.email = firebase.firestore.FieldValue.delete();
                needsUpdate = true;
            }
            if (typeof comment.official !== 'boolean') {
                update.official = typeof isAdmin === 'function' && isAdmin(comment.email || '');
                needsUpdate = true;
            }
            if (needsUpdate) operations.push({ ref: commentDoc.ref, data: update });
        });
    }

    await commitMigrationOperations(operations);
    await markerRef.set({
        completed: true,
        migratedDocuments: operations.length,
        completedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

const COMMUNITY_CATEGORIES = [
    {
        id: 'bug_report',
        name: '사이트 버그 문의',
        icon: 'fa-solid fa-bug',
        color: '#3b82f6',
        subCategories: [
            { name: '커뮤니티 창 관련 버그', icon: 'fa-solid fa-comments', color: '#60a5fa' },
            { name: '설정창 관련 버그', icon: 'fa-solid fa-gear', color: '#a78bfa' },
            { name: '알림 관련 버그', icon: 'fa-solid fa-bell', color: '#f43f5e' },
            { name: '인사말 창 관련 버그', icon: 'fa-solid fa-handshake', color: '#34d399' },
            { name: '기타 버그', icon: 'fa-solid fa-triangle-exclamation', color: '#f59e0b' }
        ]
    },
    {
        id: 'activity_inquiry',
        name: '과학 동아리 활동 관련 문의',
        icon: 'fa-solid fa-flask',
        color: 'var(--accent-color)',
        subCategories: [
            { name: '하고 싶은 새로운 활동 제안', icon: 'fa-solid fa-lightbulb', color: '#fbbf24' },
            { name: '예정되어 있는 활동 관련 문의', icon: 'fa-solid fa-calendar-check', color: '#38bdf8' }
        ]
    },
    {
        id: 'other_posts',
        name: '기타 게시글',
        icon: 'fa-solid fa-circle-question',
        color: '#8b5cf6',
        subCategories: [
            { name: '기타 게시글', icon: 'fa-solid fa-circle-question', color: '#a78bfa' }
        ]
    }
];

function getCategoryIcon(subName) {
    if (!subName) return 'fa-solid fa-tag';
    if (subName.includes('알림')) return 'fa-solid fa-bell';
    if (subName.includes('커뮤니티')) return 'fa-solid fa-comments';
    if (subName.includes('설정')) return 'fa-solid fa-gear';
    if (subName.includes('인사말')) return 'fa-solid fa-handshake';
    if (subName.includes('기타 게시글') || subName.includes('기타 문의') || subName.includes('문의')) return 'fa-solid fa-circle-question';
    if (subName.includes('기타 버그') || subName.includes('버그')) return 'fa-solid fa-triangle-exclamation';
    if (subName.includes('제안') || subName.includes('새로운') || subName.includes('건의')) return 'fa-solid fa-lightbulb';
    if (subName.includes('예정') || subName.includes('활동')) return 'fa-solid fa-calendar-check';
    return 'fa-solid fa-tag';
}
const RECENT_CATEGORIES_KEY = 'yangjung_recent_categories';

function getRecentCategories() {
    try {
        const stored = localStorage.getItem(RECENT_CATEGORIES_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
}

function saveRecentCategory(main, sub) {
    try {
        let list = getRecentCategories();
        list = list.filter(item => !(item.main === main && item.sub === sub));
        list.unshift({ main, sub });
        if (list.length > 5) list = list.slice(0, 5);
        localStorage.setItem(RECENT_CATEGORIES_KEY, JSON.stringify(list));
    } catch (e) { }
}

const openCategorySelectBtn = document.getElementById('openCategorySelectBtn');
const categorySelectModal = document.getElementById('categorySelectModal');
const categorySelectModalOverlay = document.getElementById('categorySelectModalOverlay');
const categorySelectModalCloseBtn = document.getElementById('categorySelectModalCloseBtn');
const categoryGroupList = document.getElementById('categoryGroupList');
const categoryRecentSection = document.getElementById('categoryRecentSection');
const categoryRecentList = document.getElementById('categoryRecentList');

function openCategorySelectModal() {
    renderCategoryModal();
    if (categorySelectModal && categorySelectModalOverlay) {
        categorySelectModal.classList.add('active');
        categorySelectModalOverlay.classList.add('active');
        setTimeout(updateCategoryModalScrollbar, 50);
        setTimeout(updateCategoryModalScrollbar, 250);
    }
}

function closeCategorySelectModal() {
    if (categorySelectModal && categorySelectModalOverlay) {
        categorySelectModal.classList.remove('active');
        categorySelectModalOverlay.classList.remove('active');
    }
}

function renderCategoryModal() {
    if (!categoryGroupList) return;
    const currentMain = document.getElementById('postCategoryMain')?.value || '';
    const currentSub = document.getElementById('postCategorySub')?.value || '';

    // 1. 최근 사용 렌더링
    const recents = getRecentCategories();
    if (recents.length > 0 && categoryRecentSection && categoryRecentList) {
        categoryRecentSection.style.display = 'block';
        categoryRecentList.innerHTML = recents.map(r => `
            <div class="recent-category-chip" onclick="window.selectCategory('${escapeInlineJsString(r.main)}', '${escapeInlineJsString(r.sub)}')">
                <i class="${getCategoryIcon(r.sub)}"></i>
                <span>${escapeHtml(r.main)} &gt; ${escapeHtml(r.sub)}</span>
            </div>
        `).join('');
    } else if (categoryRecentSection) {
        categoryRecentSection.style.display = 'none';
    }

    // 2. 대주제 / 소주제 목록 렌더링
    categoryGroupList.innerHTML = COMMUNITY_CATEGORIES.map((cat) => {
        const isOpen = true; // 기본 펼침 상태
        const subListHtml = cat.subCategories.map(subItem => {
            const subName = typeof subItem === 'string' ? subItem : subItem.name;
            const subIcon = (typeof subItem === 'object' && subItem.icon) ? subItem.icon : getCategoryIcon(subName);
            const subColor = (typeof subItem === 'object' && subItem.color) ? subItem.color : 'var(--accent-color)';
            const isSelected = (currentMain === cat.name && currentSub === subName);
            return `
                <div class="category-sub-item ${isSelected ? 'active' : ''}" onclick="window.selectCategory('${escapeInlineJsString(cat.name)}', '${escapeInlineJsString(subName)}')">
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                        <i class="${subIcon}" style="color: ${subColor}; font-size: 0.95rem; width: 18px; text-align: center;"></i>
                        <span>${escapeHtml(subName)}</span>
                    </div>
                    ${isSelected ? '<i class="fa-solid fa-check" style="color: var(--accent-color);"></i>' : '<i class="fa-solid fa-chevron-right" style="font-size: 0.8rem; opacity: 0.4;"></i>'}
                </div>
            `;
        }).join('');

        return `
            <div class="category-group-card ${isOpen ? 'open' : ''}" data-cat-id="${cat.id}">
                <div class="category-group-header" onclick="window.toggleCategoryGroup(this)">
                    <div class="category-group-title">
                        <i class="${cat.icon}" style="color: var(--accent-color);"></i>
                        <span>${escapeHtml(cat.name)}</span>
                    </div>
                    <i class="fa-solid fa-chevron-down category-group-arrow"></i>
                </div>
                <div class="category-sub-list">
                    ${subListHtml}
                </div>
            </div>
        `;
    }).join('');

    requestAnimationFrame(() => {
        updateCategoryModalScrollbar();
    });
}

let categoryAccordionAnimId = null;

window.toggleCategoryGroup = function (headerEl) {
    const card = headerEl.closest('.category-group-card');
    if (!card) return;
    const subList = card.querySelector('.category-sub-list');
    if (!subList) return;

    const willOpen = !card.classList.contains('open');

    if (willOpen) {
        card.classList.add('open');
        subList.style.maxHeight = '0px';
        void subList.offsetHeight; // 강제 리플로우
        subList.style.maxHeight = subList.scrollHeight + 'px';
        setTimeout(() => {
            if (card.classList.contains('open')) {
                subList.style.maxHeight = '';
            }
        }, 320);
    } else {
        subList.style.maxHeight = subList.scrollHeight + 'px';
        void subList.offsetHeight; // 강제 리플로우
        subList.style.maxHeight = '0px';
        card.classList.remove('open');
    }

    // 아코디언 높이 전환(0.35s) 동안 매 프레임 스크롤바를 갱신해 썸 크기/위치가 끊기지 않고 부드럽게 따라오도록 함
    if (categoryAccordionAnimId) cancelAnimationFrame(categoryAccordionAnimId);
    const startTime = performance.now();
    const duration = 350;
    const animateScrollbar = (now) => {
        updateCategoryModalScrollbar();
        if (now - startTime < duration) {
            categoryAccordionAnimId = requestAnimationFrame(animateScrollbar);
        } else {
            updateCategoryModalScrollbar();
            categoryAccordionAnimId = null;
        }
    };
    categoryAccordionAnimId = requestAnimationFrame(animateScrollbar);
};

window.selectCategory = function (main, sub) {
    const mainInput = document.getElementById('postCategoryMain');
    const subInput = document.getElementById('postCategorySub');
    const labelEl = document.getElementById('selectedCategoryText');

    if (mainInput) mainInput.value = main;
    if (subInput) subInput.value = sub;
    if (labelEl) {
        labelEl.className = 'category-select-placeholder selected';
        labelEl.innerHTML = `
            <span class="cat-main">${escapeHtml(main)}</span>
            <span class="cat-sep"><i class="fa-solid fa-chevron-right"></i></span>
            <span class="cat-sub">${escapeHtml(sub)}</span>
        `;
    }
    saveRecentCategory(main, sub);
    closeCategorySelectModal();
};

window.resetCategorySelect = function () {
    const mainInput = document.getElementById('postCategoryMain');
    const subInput = document.getElementById('postCategorySub');
    const labelEl = document.getElementById('selectedCategoryText');

    if (mainInput) mainInput.value = '';
    if (subInput) subInput.value = '';
    if (labelEl) {
        labelEl.className = 'category-select-placeholder';
        labelEl.textContent = '게시판 선택';
    }
};

if (openCategorySelectBtn) openCategorySelectBtn.addEventListener('click', openCategorySelectModal);
if (categorySelectModalCloseBtn) categorySelectModalCloseBtn.addEventListener('click', closeCategorySelectModal);
if (categorySelectModalOverlay) categorySelectModalOverlay.addEventListener('click', closeCategorySelectModal);

// 모달 커스텀 스크롤바 제어 로직 (인사말과 100% 동일한 메커니즘)
const categoryModalBody = document.getElementById('categoryModalBody');
const categoryModalScrollbar = document.getElementById('categoryModalScrollbar');
const categoryModalScrollbarThumb = document.getElementById('categoryModalScrollbarThumb');
let modalScrollTimeout;
let isHoveringModalScrollbar = false;
let isModalScrollDragging = false;
let modalStartY = 0;
let modalStartScrollTop = 0;

function updateCategoryModalScrollbar() {
    if (!categoryModalBody || !categoryModalScrollbar || !categoryModalScrollbarThumb) return;

    const modalHeader = document.querySelector('.category-modal-header');
    const headerHeight = modalHeader ? modalHeader.offsetHeight : (categoryModalBody.offsetTop || 72);
    categoryModalScrollbar.style.top = `${headerHeight + 6}px`;

    const scrollHeight = categoryModalBody.scrollHeight;
    const clientHeight = categoryModalBody.clientHeight;
    const scrollTop = categoryModalBody.scrollTop;

    const trackHeight = categoryModalScrollbar.clientHeight || Math.max(10, clientHeight - 16);

    if (scrollHeight <= clientHeight + 1) {
        categoryModalScrollbar.classList.remove('visible');
        categoryModalScrollbarThumb.style.height = `${trackHeight}px`;
        categoryModalScrollbarThumb.style.transform = 'translateY(0px)';
        return;
    }

    const thumbHeight = Math.max(30, (clientHeight / scrollHeight) * trackHeight);
    const maxScrollTop = scrollHeight - clientHeight;
    const maxThumbTop = Math.max(0, trackHeight - thumbHeight);

    const thumbTop = maxScrollTop > 0 ? (scrollTop / maxScrollTop) * maxThumbTop : 0;

    categoryModalScrollbarThumb.style.height = `${thumbHeight}px`;
    categoryModalScrollbarThumb.style.transform = `translateY(${thumbTop}px)`;

    categoryModalScrollbar.classList.add('visible');

    clearTimeout(modalScrollTimeout);
    if (!isModalScrollDragging && !isHoveringModalScrollbar) {
        modalScrollTimeout = setTimeout(() => {
            categoryModalScrollbar.classList.remove('visible');
        }, 1500);
    }
}

if (categoryModalBody) {
    categoryModalBody.addEventListener('scroll', updateCategoryModalScrollbar, { passive: true });
}

if (typeof ResizeObserver !== 'undefined' && categoryModalBody) {
    const categoryResizeObserver = new ResizeObserver(() => {
        updateCategoryModalScrollbar();
    });
    categoryResizeObserver.observe(categoryModalBody);
    if (categoryGroupList) categoryResizeObserver.observe(categoryGroupList);
}

if (categoryModalScrollbar) {
    categoryModalScrollbar.addEventListener('mouseenter', () => {
        isHoveringModalScrollbar = true;
        categoryModalScrollbar.classList.add('visible');
    });
    categoryModalScrollbar.addEventListener('mouseleave', () => {
        isHoveringModalScrollbar = false;
        if (!isModalScrollDragging) {
            modalScrollTimeout = setTimeout(() => {
                categoryModalScrollbar.classList.remove('visible');
            }, 1500);
        }
    });
}

if (categoryModalScrollbarThumb) {
    categoryModalScrollbarThumb.addEventListener('mousedown', (e) => {
        isModalScrollDragging = true;
        categoryModalScrollbarThumb.classList.add('dragging');
        modalStartY = e.clientY;
        modalStartScrollTop = categoryModalBody.scrollTop;
        document.body.style.userSelect = 'none';

        const onMouseMove = (moveEvent) => {
            if (!isModalScrollDragging) return;
            const deltaY = moveEvent.clientY - modalStartY;
            const scrollHeight = categoryModalBody.scrollHeight;
            const clientHeight = categoryModalBody.clientHeight;
            const trackHeight = categoryModalScrollbar.clientHeight || Math.max(10, clientHeight - 16);
            const thumbHeight = parseFloat(categoryModalScrollbarThumb.style.height) || 30;
            const maxThumbTop = trackHeight - thumbHeight;
            const maxScrollTop = scrollHeight - clientHeight;

            if (maxThumbTop > 0) {
                const scrollRatio = deltaY / maxThumbTop;
                categoryModalBody.scrollTop = modalStartScrollTop + (scrollRatio * maxScrollTop);
            }
        };

        const onMouseUp = () => {
            isModalScrollDragging = false;
            categoryModalScrollbarThumb.classList.remove('dragging');
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (!isHoveringModalScrollbar) {
                modalScrollTimeout = setTimeout(() => {
                    categoryModalScrollbar.classList.remove('visible');
                }, 1500);
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

// 카테고리 / 소주제 필터 드롭다운 상태 및 로직
let currentCategoryFilterType = 'all'; // 'all' | 'main' | 'sub'
let currentCategoryFilterValue = 'all';

function smoothlyUpdateDropdownSelected(selectedEl, textHTML) {
    if (!selectedEl) return;

    // On phones, let long category names wrap instead of animating past the viewport.
    if (window.matchMedia('(max-width: 600px)').matches) {
        selectedEl.innerHTML = `<span>${textHTML}</span> <i class="fa-solid fa-chevron-down arrow-icon"></i>`;
        selectedEl.style.width = 'auto';
        selectedEl.style.transition = '';
        return;
    }

    // 1. 현재 시작 너비 소수점까지 정밀 측정
    const startWidth = selectedEl.getBoundingClientRect().width;

    // 2. 가상 클론 요소를 오프스크린에 띄워 새 텍스트의 목표 너비(targetWidth) 측정
    const clone = selectedEl.cloneNode(true);
    clone.style.cssText = 'position: absolute !important; visibility: hidden !important; width: auto !important; max-width: none !important; pointer-events: none !important; transition: none !important; left: -9999px !important; top: -9999px !important;';
    clone.innerHTML = `<span>${textHTML}</span> <i class="fa-solid fa-chevron-down arrow-icon"></i>`;
    document.body.appendChild(clone);
    const targetWidth = clone.getBoundingClientRect().width;
    clone.remove();

    if (Math.abs(startWidth - targetWidth) < 1) {
        selectedEl.innerHTML = `<span>${textHTML}</span> <i class="fa-solid fa-chevron-down arrow-icon"></i>`;
        return;
    }

    // 3. 시작 너비 픽셀로 고정
    selectedEl.style.transition = 'none';
    selectedEl.style.width = startWidth + 'px';

    // 4. 내용물 교체 (줄바꿈 방지 상태)
    selectedEl.innerHTML = `<span>${textHTML}</span> <i class="fa-solid fa-chevron-down arrow-icon"></i>`;

    // 5. 강제 리플로우 후 목표 너비(targetWidth)로 부드럽게 transition 실행 (오른쪽 정렬 상태라 왼쪽으로 부드럽게 늘어남!)
    void selectedEl.offsetWidth;

    selectedEl.style.transition = 'width 0.35s cubic-bezier(0.25, 1, 0.5, 1), background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease';
    selectedEl.style.width = targetWidth + 'px';
}
function initCategoryFilterDropdown() {
    const dropdownContainer = document.getElementById('categoryFilterDropdown');
    const selectedEl = document.getElementById('categoryFilterSelected');
    const optionsEl = document.getElementById('categoryFilterOptions');
    if (!dropdownContainer || !selectedEl || !optionsEl) return;

    const optionItems = optionsEl.querySelectorAll('.custom-dropdown-option');

    selectedEl.addEventListener('click', (e) => {
        e.stopPropagation();
        // 다른 드롭다운이 열려있으면 닫기
        document.getElementById('customSortDropdown')?.classList.remove('open');
        dropdownContainer.classList.toggle('open');
    });

    // 1. 대주제 접기/펼치기 화살표 버튼 이벤트 (화살표 클릭 시 토글만 실행)
    optionsEl.querySelectorAll('.group-toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // 대주제 선택 및 드롭다운 닫힘 방지
            const headerLi = btn.closest('.dropdown-category-group-header');
            if (!headerLi) return;
            const groupId = headerLi.getAttribute('data-group-id');
            const isOpening = !headerLi.classList.contains('open');

            headerLi.classList.toggle('open', isOpening);
            optionsEl.querySelectorAll(`.dropdown-sub-option[data-group-id="${groupId}"]`).forEach(subEl => {
                subEl.classList.toggle('open', isOpening);
            });
        });
    });

    // 2. 옵션 클릭 이벤트 (화살표가 아닌 본체 클릭 시 필터링 적용)
    optionItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // 화살표 토글 버튼을 누른 경우는 대주제 선택 방지
            if (e.target.closest('.group-toggle-btn')) return;

            e.stopPropagation();
            const filterType = item.getAttribute('data-type') || 'all';
            const filterVal = item.getAttribute('data-value') || 'all';

            // 선택 버튼 텍스트 구성 (대주제일 경우 토글 버튼 제외하고 라벨만 추출)
            let textHTML = '';
            if (filterType === 'main') {
                const labelEl = item.querySelector('.group-main-label');
                textHTML = labelEl ? labelEl.innerHTML : item.innerHTML;
            } else if (filterType === 'sub') {
                const subIcon = item.querySelector('.sub-icon')?.outerHTML || '';
                textHTML = `${subIcon} ${escapeHtml(filterVal)}`;
            } else {
                textHTML = `<i class="fa-solid fa-layer-group"></i> 모든 게시글 (모든 주제)`;
            }

            optionItems.forEach(opt => opt.classList.remove('active'));
            item.classList.add('active');

            // 부드럽게 왼쪽으로 늘어나는 너비 전환 애니메이션 적용
            smoothlyUpdateDropdownSelected(selectedEl, textHTML);
            dropdownContainer.classList.remove('open');

            currentCategoryFilterType = filterType;
            currentCategoryFilterValue = filterVal;

            const currentSort = document.querySelector('#customSortOptions .custom-dropdown-option.active')?.getAttribute('data-value') || 'latest';
            if (lastPostsSnapshot && postsUnsubscribe) {
                renderPosts(lastPostsSnapshot, currentSort);
            } else {
                loadPosts(currentSort);
            }
        });
    });

    document.addEventListener('click', (e) => {
        if (!dropdownContainer.contains(e.target)) {
            dropdownContainer.classList.remove('open');
        }
    });
}
initCategoryFilterDropdown();

// 게시글 개수 변경 시 부드러운 페이드 애니메이션 함수
function updatePostCountUI(newCount) {
    const countEl = document.getElementById('totalPostCount');
    if (!countEl) return;
    const currentText = countEl.textContent.trim();
    const currentCount = parseInt(currentText, 10);

    if (isNaN(currentCount) || currentCount !== newCount) {
        countEl.classList.add('count-fade-out');
        setTimeout(() => {
            countEl.textContent = newCount;
            countEl.classList.remove('count-fade-out');
        }, 150);
    }
}
window.updatePostCountUI = updatePostCountUI;

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
        window._editingPostId = null;
        window.communityPolls?.setDraft('post');
        window._editingPostImages = [];
        window._editingPostAttachments = [];
        selectedImages = [];
        window.resetCategorySelect();
        document.getElementById('postTitle').value = '';
        document.getElementById('postBody').value = '';
        const pageTitle = document.querySelector('#writePostPage .greeting-title');
        if (pageTitle) pageTitle.innerText = '게시글 올리기';
        const submitBtnEl = document.getElementById('submitPostBtn');
        if (submitBtnEl) submitBtnEl.innerText = '게시글 등록하기';
        if (typeof window.updateImagePreview === 'function') window.updateImagePreview();

        history.pushState({ modal: 'writePage' }, '', '#write');
        switchPage(currentPage, writePostPage, true);
    });
}

function closeWritePage(e) {
    const fromPopState = (e === true);
    const wasEditFromDetail = window._editFromDetail;
    const editingId = window._editingPostId;

    // 수정 모드 상태 즉시 정리
    window._editingPostId = null;
    window.communityPolls?.setDraft('post');
    window._editingPostImages = [];
    window._editingPostAttachments = [];
    selectedImages = [];
    window._editFromDetail = false;

    if (wasEditFromDetail && editingId) {
        // 상세 보기에서 수정한 경우: 목록 화면으로의 400ms 지연 및 딜레이 애니메이션 없이 즉시 상세 페이지 열기
        switchPage(currentPage, suggestionPage, false);
        if (fromPopState !== true && history.state && history.state.modal === 'writePage') {
            window._isProgrammaticBack = true;
            history.back();
        }
        const card = document.querySelector(`.board-card[data-id="${editingId}"]`);
        if (card) {
            card.click();
        }
    } else {
        switchPage(currentPage, suggestionPage, true);
        if (fromPopState !== true && history.state && history.state.modal === 'writePage') {
            window._isProgrammaticBack = true;
            history.back();
        }
    }

    // 폼과 제목 리셋은 화면이 완전히 페이드 아웃된 후에 수행하여 깜빡임 방지
    setTimeout(() => {
        const writePage = document.getElementById('writePostPage');
        if (writePage && !writePage.classList.contains('active')) {
            window.resetCategorySelect();
            const pageTitle = document.querySelector('#writePostPage .greeting-title');
            if (pageTitle) pageTitle.innerText = '게시글 올리기';
            const submitBtnEl = document.getElementById('submitPostBtn');
            if (submitBtnEl) submitBtnEl.innerText = '게시글 등록하기';
            const postTitleInput = document.getElementById('postTitle');
            if (postTitleInput) postTitleInput.value = '';
            const postBodyInput = document.getElementById('postBody');
            if (postBodyInput) postBodyInput.value = '';
            if (typeof window.updateImagePreview === 'function') window.updateImagePreview();
        }
    }, 350);
}
if (writePostBackBtn) {
    writePostBackBtn.addEventListener('click', closeWritePage);
}

// 이미지 업로드 로직
let selectedImages = [];
const postImagePreviewCache = new WeakMap();
const imageFileInput = document.getElementById('imageFileInput');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imageCountInfo = document.getElementById('imageCountInfo');
const imagePreviewWrapper = document.getElementById('imagePreviewWrapper');
const imagePreviewInner = document.getElementById('imagePreviewInner');
const MAX_IMAGES = 40;
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
const MAX_FILES_PER_KIND = 10;

// 파일 선택창과 탐색기에서 끌어온 파일에 같은 종류 판정을 적용합니다.
window.getCommunityAttachmentKind = function (file) {
    if (!file) return null;
    const name = String(file.name || '').toLowerCase();
    const type = String(file.type || '').toLowerCase();
    let nameKind = null;
    if (/\.(png|jpe?g|gif|webp|svg|bmp|avif|heic|heif)$/i.test(name)) nameKind = 'image';
    else if (/\.pdf$/i.test(name)) nameKind = 'pdf';
    else if (/\.html?$/i.test(name)) nameKind = 'html';
    else if (/\.(mp3|wav|ogg|m4a|aac|flac|opus|wma)$/i.test(name)) nameKind = 'audio';
    else if (/\.(mp4|webm|mkv|mov|m4v|avi|ogv)$/i.test(name)) nameKind = 'video';

    let mimeKind = null;
    if (type.startsWith('image/')) mimeKind = 'image';
    else if (type === 'application/pdf') mimeKind = 'pdf';
    else if (type === 'text/html') mimeKind = 'html';
    else if (type.startsWith('audio/')) mimeKind = 'audio';
    else if (type.startsWith('video/')) mimeKind = 'video';
    // WebM/Ogg 파일은 오디오 전용이거나 동영상일 수 있습니다.
    if (name.endsWith('.webm') && mimeKind === 'audio') nameKind = 'audio';
    if (name.endsWith('.ogg') && mimeKind === 'video') nameKind = 'video';
    if (nameKind && mimeKind && nameKind !== mimeKind) return null;
    return nameKind || mimeKind;
};

window.reportCommunityAttachmentErrors = function (rejected) {
    if (!rejected.length) return;
    const message = '첨부하지 못한 파일:\n' + rejected.map(({ file, reason }) =>
        `• ${file?.name || '이름 없는 파일'}: ${reason}`).join('\n');
    if (typeof window.customAlert === 'function') return window.customAlert(message, '첨부파일 확인');
    alert(message);
};

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
        const total = (selectedImages ? selectedImages.length : 0) +
            ((window._editingPostImages && Array.isArray(window._editingPostImages)) ? window._editingPostImages.length : 0) +
            ((window._editingPostAttachments && Array.isArray(window._editingPostAttachments)) ? window._editingPostAttachments.length : 0);
        if (total > 0) {
            imagePreviewWrapper.style.height = imagePreviewInner.offsetHeight + 'px';
        } else {
            imagePreviewWrapper.style.height = '0px';
        }
    }).observe(imagePreviewInner);
}

const imageUploadArea = document.getElementById('imageUploadArea');
if (imageUploadArea && imageFileInput) {
    imageUploadArea.addEventListener('click', (e) => {
        if (e.target !== imageFileInput) {
            imageFileInput.click();
        }
    });
}

window.addPostFiles = function (fileList) {
    const files = Array.from(fileList || []);
    const accepted = [];
    const rejected = [];
    const counts = { image: 0, pdf: 0, html: 0, audio: 0 };
    const existingImages = Array.isArray(window._editingPostImages) ? window._editingPostImages : [];
    const existingAttachments = Array.isArray(window._editingPostAttachments) ? window._editingPostAttachments : [];
    counts.image += existingImages.length;
    existingAttachments.forEach(file => {
        const kind = window.getCommunityAttachmentKind(file);
        if (kind in counts) counts[kind]++;
    });
    selectedImages.forEach(file => {
        const kind = window.getCommunityAttachmentKind(file);
        if (kind in counts) counts[kind]++;
    });
    let totalCount = existingImages.length + existingAttachments.length + selectedImages.length;

    files.forEach(file => {
        const kind = window.getCommunityAttachmentKind(file);
        let reason = '';
        if (!kind) reason = '지원하지 않는 파일 종류예요.';
        else if (kind === 'video') reason = '동영상 파일은 첨부할 수 없어요. 본문에 유튜브 링크를 넣어 주세요.';
        else if (file.size > MAX_FILE_SIZE_BYTES) reason = '파일당 100MB를 넘었어요.';
        else if (counts[kind] >= MAX_FILES_PER_KIND) reason = '이 종류는 최대 10개까지 첨부할 수 있어요.';
        else if (totalCount >= MAX_IMAGES) reason = '게시글에는 전체 40개까지 첨부할 수 있어요.';
        if (reason) {
            rejected.push({ file, reason });
            return;
        }
        selectedImages.push(file);
        accepted.push(file);
        counts[kind]++;
        totalCount++;
    });
    if (accepted.length) updateImagePreview(accepted);
    window.reportCommunityAttachmentErrors(rejected);
    return { accepted, rejected };
};

if (imageFileInput) {
    imageFileInput.addEventListener('change', (e) => {
        window.addPostFiles(e.target.files);
        imageFileInput.value = '';
    });
}

function isImageFile(file) {
    return window.getCommunityAttachmentKind(file) === 'image';
}

function getFileIconInfo(file) {
    const name = typeof file === 'object' && file ? (file.name || '') : String(file || '');
    const type = typeof file === 'object' && file ? String(file.type || '') : '';

    if (type.includes('pdf') || /\.pdf$/i.test(name)) {
        return { icon: 'fa-solid fa-file-pdf', color: '#ea580c', label: 'PDF' };
    }
    if (type.includes('html') || /\.(html|htm)$/i.test(name)) {
        return { icon: 'fa-solid fa-file-code', color: '#7c3aed', label: 'HTML' };
    }
    if (type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(name)) {
        return { icon: 'fa-solid fa-file-audio', color: '#16a34a', label: '음성' };
    }
    if (type.startsWith('video/') || /\.(mp4|webm|mkv|mov)$/i.test(name)) {
        return { icon: 'fa-solid fa-file-video', color: '#dc2626', label: '동영상' };
    }
    return { icon: 'fa-solid fa-file-lines', color: '#2563eb', label: '문서' };
}


window.resetSelectedImages = function () {
    selectedImages = [];
    updateImagePreview();
};

window.removeExistingImage = function (index) {
    if (window._editingPostImages && Array.isArray(window._editingPostImages)) {
        window._editingPostImages.splice(index, 1);
        updateImagePreview();
    }
};

window.removeExistingAttachment = function (index) {
    if (window._editingPostAttachments && Array.isArray(window._editingPostAttachments)) {
        window._editingPostAttachments.splice(index, 1);
        updateImagePreview();
    }
};

window.updateImagePreview = function updateImagePreview(newFiles = []) {
    if (!imagePreviewContainer) return;
    imagePreviewContainer.innerHTML = '';
    const newlyAdded = new Set(newFiles);

    const existingImages = (window._editingPostImages && Array.isArray(window._editingPostImages)) ? window._editingPostImages : [];
    const existingAttachments = (window._editingPostAttachments && Array.isArray(window._editingPostAttachments)) ? window._editingPostAttachments : [];
    const totalCount = existingImages.length + existingAttachments.length + selectedImages.length;

    if (imagePreviewWrapper) {
        if (totalCount > 0) {
            imagePreviewWrapper.classList.add('has-images');
        } else {
            imagePreviewWrapper.classList.remove('has-images');
        }
    }
    if (imageCountInfo) {
        imageCountInfo.textContent = `첨부 파일 ${totalCount}개 / ${MAX_IMAGES}개`;
        if (totalCount >= MAX_IMAGES) {
            imageCountInfo.classList.add('warning');
        } else {
            imageCountInfo.classList.remove('warning');
        }
    }

    // 1. 기존 이미지 목록 렌더링
    existingImages.forEach((url, index) => {
        const safeUrl = getSafeImageUrl(typeof url === 'object' && url ? url.url : url);
        if (!safeUrl) return;
        const div = document.createElement('div');
        div.className = 'image-preview-item';
        div.innerHTML = `
            <img src="${escapeHtml(safeUrl)}" alt="기존 이미지" style="cursor: pointer;" onclick="openLightbox('${escapeInlineJsString(safeUrl)}')">
            <button type="button" class="image-preview-remove" onclick="removeExistingImage(${index})" title="삭제"><i class="fa-solid fa-xmark"></i></button>
        `;
        imagePreviewContainer.appendChild(div);
    });

    // 2. 기존 첨부파일 목록 렌더링
    existingAttachments.forEach((att, index) => {
        const div = document.createElement('div');
        div.className = 'image-preview-item';
        const attName = att.name || '첨부파일';
        const iconInfo = getFileIconInfo(att);

        div.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 0.5rem 0.4rem;
            background: var(--card-bg, rgba(255, 255, 255, 0.05));
            border: 1px solid var(--glass-border);
            border-radius: 12px;
            text-align: center;
            gap: 0.2rem;
            position: relative;
            min-height: 100px;
            box-sizing: border-box;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
        `;
        div.innerHTML = `
            <i class="${iconInfo.icon}" style="font-size: 1.65rem; color: ${iconInfo.color}; margin-bottom: 0.1rem; flex-shrink: 0;"></i>
            <span style="font-size: 0.72rem; font-weight: 600; color: var(--text-primary); width: 100%; max-width: 92px; word-break: break-all; white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.25; flex-shrink: 0;" title="${escapeHtml(attName)}">${escapeHtml(attName)}</span>
            <span style="font-size: 0.65rem; color: var(--text-secondary, #64748b); font-weight: 500; line-height: 1.2; flex-shrink: 0;">기존 첨부</span>
            <button type="button" class="image-preview-remove" onclick="removeExistingAttachment(${index})" title="삭제"><i class="fa-solid fa-xmark"></i></button>
        `;
        imagePreviewContainer.appendChild(div);
    });

    // 3. 신규 선택 파일 렌더링
    selectedImages.forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'image-preview-item';

        if (isImageFile(file)) {
            const showPreview = (safeUrl) => {
                div.innerHTML = `
                    <img src="${escapeHtml(safeUrl)}" alt="미리보기" style="cursor: pointer;" onclick="openLightbox('${escapeInlineJsString(safeUrl)}')">
                    <button type="button" class="image-preview-remove" onclick="removeImage(${index})" title="삭제"><i class="fa-solid fa-xmark"></i></button>
                `;
                if (newlyAdded.has(file)) div.classList.add('just-added');
            };
            const cachedUrl = postImagePreviewCache.get(file);
            if (cachedUrl) {
                showPreview(cachedUrl);
            } else {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const safeUrl = getSafeImageUrl(e.target.result);
                    postImagePreviewCache.set(file, safeUrl);
                    showPreview(safeUrl);
                };
                reader.readAsDataURL(file);
            }
        } else {
            const iconInfo = getFileIconInfo(file);
            div.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 0.5rem 0.4rem;
                background: var(--card-bg, rgba(255, 255, 255, 0.05));
                border: 1px solid var(--glass-border);
                border-radius: 12px;
                text-align: center;
                gap: 0.2rem;
                position: relative;
                min-height: 100px;
                box-sizing: border-box;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
            `;
            div.innerHTML = `
                <i class="${iconInfo.icon}" style="font-size: 1.65rem; color: ${iconInfo.color}; margin-bottom: 0.1rem; flex-shrink: 0;"></i>
                <span style="font-size: 0.72rem; font-weight: 600; color: var(--text-primary); width: 100%; max-width: 92px; word-break: break-all; white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.25; flex-shrink: 0;" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
                <span style="font-size: 0.65rem; color: var(--text-secondary, #64748b); font-weight: 500; line-height: 1.2; flex-shrink: 0;">${(file.size / 1024).toFixed(1)} KB</span>
                <button type="button" class="image-preview-remove" onclick="removeImage(${index})" title="삭제"><i class="fa-solid fa-xmark"></i></button>
            `;
            if (newlyAdded.has(file)) div.classList.add('just-added');
        }
        imagePreviewContainer.appendChild(div);
    });
};

window.removeImage = function (index) {
    selectedImages.splice(index, 1);
    updateImagePreview();
};

// Firebase 데이터 등록 (글쓰기)
if (submitPostBtn) {
    submitPostBtn.addEventListener('click', async () => {
        if (submitPostBtn.disabled) return;
        if (!currentUser) {
            alert('로그인이 필요한 서비스입니다.');
            return;
        }
        const title = document.getElementById('postTitle').value.trim();
        const author = isAdmin(currentUser.email) ? getAdminName(currentUser.email) : (currentUserRole || currentUser.displayName || '회원');
        const body = document.getElementById('postBody').value.trim();
        let poll = window.communityPolls?.getDraft('post');
        const submittingUid = currentUser.uid;
        const submittingEditId = window._editingPostId || null;
        const catMain = document.getElementById('postCategoryMain')?.value?.trim() || '';
        const catSub = document.getElementById('postCategorySub')?.value?.trim() || '';

        if (!catMain || !catSub) {
            alert('게시판 주제를 선택해주세요!');
            openCategorySelectModal();
            return;
        }

        if (!title || !body) {
            alert('제목과 내용을 모두 입력해주세요!');
            return;
        }

        const submitLabel = submitPostBtn.innerText;
        submitPostBtn.innerText = '저장 중...';
        submitPostBtn.disabled = true;

        try {
            poll = await window.communityPolls?.prepareForSubmit('post') || poll;
            const assertSubmission = () => {
                if (currentUser?.uid !== submittingUid || (window._editingPostId || null) !== submittingEditId) {
                    throw new Error('작성 상태가 바뀌었어요. 다시 등록해주세요.');
                }
            };
            assertSubmission();
            const imageUrls = [];
            const attachments = [];

            if (selectedImages.length > 0) {
                submitPostBtn.innerText = '파일 업로드 중...';
                for (const file of selectedImages) {
                    if (window.getCommunityAttachmentKind(file) === 'video') {
                        throw new Error('동영상 파일은 첨부할 수 없습니다. 본문에 유튜브 링크를 넣어 주세요.');
                    }
                    if (file.size > MAX_FILE_SIZE_BYTES) {
                        throw new Error(`'${file.name}' 파일이 100MB 제한을 초과합니다.`);
                    }
                    if (isImageFile(file)) {
                        // 이미지 파일: 기존 ImgBB API 전송
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
                    } else {
                        // 비이미지 파일 (HTML, PDF, 음성 등): 댓글 업로드와 동일한 uploadCommunityMedia 방식 적용
                        if (typeof window.uploadCommunityMedia !== 'function') {
                            throw new Error('공용 파일 저장소를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.');
                        }
                        const fileUrl = await window.uploadCommunityMedia(file);
                        if (!fileUrl || !/^https:\/\//i.test(fileUrl)) {
                            throw new Error(`'${file.name}' 파일을 공용 저장소에 올리지 못했습니다.`);
                        }
                        attachments.push({
                            name: file.name,
                            url: fileUrl,
                            type: file.type || file.name.split('.').pop(),
                            size: file.size
                        });
                    }
                }
            }

            submitPostBtn.innerText = '게시물 저장 중...';
            assertSubmission();

            // 수정 모드인 경우 기존 게시글 업데이트
            if (window._editingPostId) {
                const finalImages = [...(window._editingPostImages || []), ...imageUrls];
                const finalAttachments = [...(window._editingPostAttachments || []), ...attachments];
                const updateData = {
                    title: title,
                    body: body,
                    categoryMain: catMain,
                    categorySub: catSub,
                    images: finalImages,
                    attachments: finalAttachments
                };
                await db.collection('posts').doc(window._editingPostId).update(updateData);
            } else {
                const postData = {
                    title: title,
                    author: author,
                    uid: currentUser.uid,
                    userPhoto: currentUser.photoURL || '',
                    categoryMain: catMain,
                    categorySub: catSub,
                    body: body,
                    images: imageUrls,
                    attachments: attachments,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    views: 0,
                    viewedBy: [],
                    likes: 0,
                    likedUsers: []
                };
                let createdPostRef;
                if (poll) postData.poll = poll;
                try {
                    createdPostRef = window.communityPolls?.createWithFiles
                        ? await window.communityPolls.createWithFiles(db.collection('posts'), postData, assertSubmission)
                        : await db.collection('posts').add(postData);
                } catch (createError) {
                    // 이전 Firestore 규칙은 email 필드를 필수로 요구합니다. 규칙 배포 전
                    // GitHub 사이트가 먼저 갱신되어도 글쓰기가 끊기지 않도록 한 번만 호환 재시도합니다.
                    if (createError?.code !== 'permission-denied') throw createError;
                    if (poll?.optionAttachments || poll?.questionAttachments || poll?.optionAttachmentCounts || poll?.questionAttachmentCount) throw createError;
                    assertSubmission();
                    createdPostRef = await db.collection('posts').add({ ...postData, email: currentUser.email });
                }
                if (createdPostRef && window.clubNotifications?.isConfigured()) {
                    window.clubNotifications.notifyPostCreated(createdPostRef.id)
                        .then((result) => console.log('새 게시글 알림 발송 결과:', result))
                        .catch((error) => console.error('새 게시글 알림 전송 오류:', error));
                }
            }
            selectedImages = [];
            window._editingPostImages = [];
            window._editingPostAttachments = [];
            updateImagePreview();
            closeWritePage();
        } catch (error) {
            console.error("Error adding post: ", error);
            alert(window.communityPolls?.submissionErrorMessage(error, 'post')
                || '게시글 저장 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
        } finally {
            submitPostBtn.disabled = false;
            submitPostBtn.innerText = submitLabel;
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
    return escapeHtml(String(timestamp));
}

// window.currentPostId 공유 사용

// 캐시된 최신 게시글 스냅샷 및 정렬 상태
let lastPostsSnapshot = null;
let currentSortOrder = 'latest';
let postRenderGeneration = 0;

// 게시판 헤더(주제/정렬) 가시성 및 페이드 제어
function setBoardHeaderVisible(visible, animated = true) {
    const boardHeader = boardContainer ? boardContainer.querySelector('.board-header') : null;
    if (!boardHeader) return;

    if (boardHeader._animTimer) clearTimeout(boardHeader._animTimer);

    if (visible) {
        boardHeader.classList.remove('header-hidden');
        if (animated) {
            boardHeader.classList.add('header-fade-out');
            void boardHeader.offsetWidth; // 리플로우
            boardHeader.classList.remove('header-fade-out');
            boardHeader.classList.add('header-fade-in');
            boardHeader._animTimer = setTimeout(() => {
                boardHeader.classList.remove('header-fade-in');
                boardHeader._animTimer = null;
            }, 300);
        } else {
            boardHeader.classList.remove('header-fade-out', 'header-fade-in');
        }
    } else {
        if (animated) {
            boardHeader.classList.remove('header-fade-in');
            boardHeader.classList.add('header-fade-out');
            boardHeader._animTimer = setTimeout(() => {
                boardHeader.classList.add('header-hidden');
                boardHeader.classList.remove('header-fade-out');
                boardHeader._animTimer = null;
            }, 250);
        } else {
            boardHeader.classList.add('header-hidden');
            boardHeader.classList.remove('header-fade-out', 'header-fade-in');
        }
    }
}

// 비로그인 상태 안내 박스 부드러운 전환 (헤더는 절대 삭제하지 않고 숨김)
function showLoginRequiredState(animated = true) {
    if (!boardContainer) return;

    // 헤더(주제 및 정렬 버튼) 부드럽게 숨김
    setBoardHeaderVisible(false, animated);

    // 기존 게시글 카드들 및 일반 빈 메시지 탐색
    const existingCards = boardContainer.querySelectorAll('.board-card');
    const existingNotice = boardContainer.querySelector('.empty-board-message:not(.login-required-message)');
    let currentNotice = boardContainer.querySelector('.login-required-message');

    const renderNotice = () => {
        // 기존 카드들과 일반 빈 메시지만 안전하게 제거 (헤더는 보존!)
        existingCards.forEach(card => card.remove());
        if (existingNotice) existingNotice.remove();

        if (!currentNotice) {
            currentNotice = document.createElement('div');
            currentNotice.className = 'empty-board-message login-required-message' + (animated ? ' message-fade-in' : '');
            currentNotice.innerHTML = `
                <div style="margin-bottom: 0.8rem;">게시글을 보려면 Google 로그인을 해주세요.</div>
                <button type="button" class="board-login-btn" onclick="triggerGoogleLogin()">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" style="width: 18px; height: 18px; vertical-align: middle; margin-right: 6px;">
                    Google 계정으로 로그인
                </button>
            `;
            boardContainer.appendChild(currentNotice);
        } else {
            currentNotice.classList.remove('message-fade-out');
            if (animated) currentNotice.classList.add('message-fade-in');
        }
    };

    if (animated && (existingCards.length > 0 || existingNotice)) {
        // 기존 요소들 페이드 아웃 후 교체
        existingCards.forEach(card => {
            card.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
            card.style.opacity = '0';
            card.style.transform = 'translateY(-6px)';
        });
        if (existingNotice) {
            existingNotice.classList.add('message-fade-out');
        }
        setTimeout(renderNotice, 180);
    } else {
        renderNotice();
    }

    updatePostCountUI(0);
}

// 빈 게시판 안내 메시지 부드러운 업데이트 함수 (깜빡임 완전 방지)
function updateEmptyBoardMessage(text) {
    if (!boardContainer) return;

    // 로그인 필요 안내 박스가 남아있다면 제거
    boardContainer.querySelectorAll('.login-required-message').forEach(el => el.remove());

    let notice = boardContainer.querySelector('.empty-board-message:not(.login-required-message)');

    if (notice) {
        let textEl = notice.querySelector('.empty-notice-text');
        if (!textEl) {
            const currentContent = notice.textContent;
            notice.textContent = '';
            textEl = document.createElement('span');
            textEl.className = 'empty-notice-text';
            textEl.textContent = currentContent;
            notice.appendChild(textEl);
        }

        if (textEl.textContent.trim() === text.trim()) {
            return;
        }

        // 텍스트만 부드럽게 페이드 전환
        textEl.classList.add('message-fade-out');
        if (notice._fadeTimer) clearTimeout(notice._fadeTimer);
        notice._fadeTimer = setTimeout(() => {
            textEl.textContent = text;
            textEl.classList.remove('message-fade-out');
            textEl.classList.add('message-fade-in');
            notice._fadeTimer = setTimeout(() => {
                textEl.classList.remove('message-fade-in');
                notice._fadeTimer = null;
            }, 180);
        }, 120);
    } else {
        notice = document.createElement('div');
        notice.className = 'empty-board-message message-fade-in';
        const textEl = document.createElement('span');
        textEl.className = 'empty-notice-text';
        textEl.textContent = text;
        notice.appendChild(textEl);
        boardContainer.appendChild(notice);
        setTimeout(() => {
            notice.classList.remove('message-fade-in');
        }, 200);
    }
}
window.updateEmptyBoardMessage = updateEmptyBoardMessage;

function clearEmptyBoardMessage() {
    if (!boardContainer) return;
    const notice = boardContainer.querySelector('.empty-board-message:not(.login-required-message)');
    if (notice) {
        notice.remove();
    }
}

function renderPosts(snapshot, sortBy = currentSortOrder) {
    if (!snapshot || !boardContainer) return;
    const renderGeneration = ++postRenderGeneration;
    currentSortOrder = sortBy;

    // 로그인 상태이므로 헤더(주제/정렬 드롭다운)를 부드럽게 복원/표시!
    setBoardHeaderVisible(true, true);

    // 로그인 필요 안내 박스가 남아있다면 부드럽게 페이드 아웃 후 제거
    const prevLoginNotice = boardContainer.querySelector('.login-required-message');
    if (prevLoginNotice) {
        prevLoginNotice.classList.add('message-fade-out');
        setTimeout(() => {
            prevLoginNotice.remove();
        }, 180);
    }
        // 이전 렌더의 예약된 프레임이 새 스냅샷 상태를 덮어쓰지 못하게 합니다.
        boardContainer.querySelectorAll('.board-card').forEach(card => {
            const hadPendingFrame = !!(card._flipFrame1 || card._flipFrame2);
            if (card._flipFrame1) cancelAnimationFrame(card._flipFrame1);
            if (card._flipFrame2) cancelAnimationFrame(card._flipFrame2);
            card._flipFrame1 = null;
            card._flipFrame2 = null;
            if (typeof card._renderedPinned === 'boolean') {
                card.classList.toggle('pinned-state', card._renderedPinned);
                const renderedBadge = card.querySelector('.pin-badge-wrapper');
                if (renderedBadge) renderedBadge.classList.toggle('active', card._renderedPinned);
            }
            const tid = card._flipTimerId;
            if (tid) { clearTimeout(tid); card._flipTimerId = null; }
            if (!card.classList.contains('flipping') && !hadPendingFrame) return;
            card.classList.remove('flipping');
            card.style.transition = 'none';
            card.style.transform = '';
            card.style.zIndex = '';
            const pb = card.querySelector('.pin-badge-wrapper');
            if (pb) pb.style.transition = '';
            card.offsetHeight;
            card.style.transition = '';
        });

        // 1. 이전 위치 저장 (고정 여부의 기준은 DOM이 아닌 Firestore 스냅샷)
        const oldPositions = new Map();
        const oldData = new Map();
        boardContainer.querySelectorAll('.board-card').forEach(card => {
            const id = card.getAttribute('data-id');
            oldPositions.set(id, card.getBoundingClientRect());
            oldData.set(id, {
                pinned: typeof card._renderedPinned === 'boolean'
                    ? card._renderedPinned
                    : card.classList.contains('pinned-state')
            });
        });

        // 2. 카테고리 / 소주제 필터 적용
        let docs = [...snapshot.docs];
        if (currentCategoryFilterType === 'sub') {
            docs = docs.filter(d => {
                const data = d.data();
                return data.categorySub === currentCategoryFilterValue;
            });
        } else if (currentCategoryFilterType === 'main') {
            docs = docs.filter(d => {
                const data = d.data();
                return data.categoryMain === currentCategoryFilterValue;
            });
        }

        // 3. 필터링된 ID 목록에 없는 카드 DOM에서 부드러운 애니메이션 후 제거 (FLIP 공간 즉시 양보)
        const filteredIds = new Set(docs.map(doc => doc.id));
        clearPostCommentCountSubscriptions(filteredIds);
        const containerRect = boardContainer.getBoundingClientRect();
        let hasOutgoingCards = false;
        boardContainer.querySelectorAll('.board-card').forEach(card => {
            const id = card.getAttribute('data-id');
            if (filteredIds.has(id) && card.classList.contains('deleting') && card.dataset.localDelete !== 'true') {
                if (card._removalTimerId) clearTimeout(card._removalTimerId);
                card._removalTimerId = null;
                card.classList.remove('deleting');
                card.style.position = '';
                card.style.top = '';
                card.style.left = '';
                card.style.width = '';
                card.style.zIndex = '';
                card.style.animation = '';
            }
            if (!filteredIds.has(id)) {
                hasOutgoingCards = true;
                if (card.classList.contains('deleting')) {
                    // 이미 삭제 중이던 카드는 새 데이터 도착 시 즉시 DOM에서 완전 제거
                    if (card._removalTimerId) clearTimeout(card._removalTimerId);
                    card.remove();
                } else {
                    const oldPos = oldPositions.get(id) || card.getBoundingClientRect();
                    card.style.position = 'absolute';
                    card.style.top = (oldPos.top - containerRect.top) + 'px';
                    card.style.left = (oldPos.left - containerRect.left) + 'px';
                    card.style.width = oldPos.width + 'px';
                    card.style.zIndex = '11';
                    card.classList.add('deleting');
                    card._removalTimerId = setTimeout(() => {
                        card._removalTimerId = null;
                        if (card.parentNode) card.remove();
                    }, 300);
                }
            }
        });

        // 총 글 개수 업데이트 (One UI 페이드 애니메이션)
        updatePostCountUI(docs.length);

        // 게시글이 0개일 때: 부드러운 빈 안내 문구 표시 (깜빡임 0)
        if (docs.length === 0) {
            let emptyText = '등록된 게시글이 없습니다. 첫 번째 글을 작성해보세요!';
            if (currentCategoryFilterValue && currentCategoryFilterValue !== '전체' && currentCategoryFilterValue !== 'all') {
                emptyText = `'${currentCategoryFilterValue}' 카테고리에 등록된 게시글이 없습니다.`;
            }
            updateEmptyBoardMessage(emptyText);
            return;
        }

        // 게시글이 존재하면 빈 화면 안내 제거
        clearEmptyBoardMessage();

        // 4. 정렬 로직 (기존과 동일)
        docs.sort((a, b) => {
            const dataA = a.data();
            const dataB = b.data();
            const pinA = dataA.pinned === true ? 1 : 0;
            const pinB = dataB.pinned === true ? 1 : 0;
            if (pinB !== pinA) return pinB - pinA;
            if (sortBy === 'popular') {
                const viewsA = safeNonNegativeInteger(dataA.views);
                const viewsB = safeNonNegativeInteger(dataB.views);
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
            const isPinned = post.pinned === true;
            const safeId = escapeInlineJsString(id);
            const safeViews = safeNonNegativeInteger(post.views);
            const safeLikes = safeNonNegativeInteger(post.likes);

            let card = Array.from(boardContainer.querySelectorAll('.board-card')).find(item => item.dataset.id === id) || null;
            const isNew = !card;

            const authorText = String(post.author || '사용자');
            const avatar = authorText.substring(0, 1) || '?';
            const safeUserPhoto = getSafeImageUrl(post.userPhoto);
            let avatarHtml = safeUserPhoto
                ? `<img class="board-author-avatar" src="${escapeHtml(safeUserPhoto)}" alt="${escapeHtml(authorText)}" style="object-fit: cover; border: 1px solid var(--glass-border);">`
                : `<div class="board-author-avatar" style="background: hsl(${(id.charCodeAt(0) * 137) % 360}, 60%, 50%)">${escapeHtml(avatar)}</div>`;

            const pinBadgeHtml = `
                        <div class="pin-badge-wrapper ${isPinned ? 'active' : ''}">
                            <span class="pin-badge-ui" style="background: var(--accent-color); color: #fff; font-size: 0.7rem; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: bold; display: inline-block;">
                                <i class="fa-solid fa-thumbtack"></i> 상단 고정
                            </span>
                        </div>
                    `;

            const categoryBadgeHtml = (post.categoryMain && post.categorySub)
                ? `<span class="post-category-badge" title="${escapeHtml(post.categoryMain)} &gt; ${escapeHtml(post.categorySub)}"><i class="${getCategoryIcon(post.categorySub)}"></i> ${escapeHtml(post.categorySub)}</span>`
                : '';
            const authorInnerHtml = `${avatarHtml}<span class="board-author-name">${escapeHtml(authorText)}</span>${categoryBadgeHtml}`;
            const identitySignature = JSON.stringify([authorText, safeUserPhoto, post.categoryMain || '', post.categorySub || '']);

            const postCheckbox = (isAuthor || isPresident) ? `
                        <label class="post-checkbox-wrapper" style="align-items: center; margin-right: 0;" onclick="event.stopPropagation();">
                            <input type="checkbox" class="post-select-cb" value="${escapeHtml(id)}" onchange="updatePostMultiDeleteUI()" style="width: 1.1rem; height: 1.1rem; accent-color: var(--accent-color); cursor: pointer;">
                        </label>
                    ` : '';

            const innerHtml = `
                        ${pinBadgeHtml}
                        <div class="board-card-header">
                            <div style="display: flex; align-items: center;">
                                ${postCheckbox}
                                <div class="board-author" style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                                    ${authorInnerHtml}
                                </div>
                            </div>
                            <div class="board-card-actions" style="display: flex; align-items: center; gap: 0.5rem;">
                                ${isPresident ? `
                                    <button type="button" class="board-action-btn pin-toggle-btn ${isPinned ? 'active' : ''}"
                                            onclick="event.stopPropagation(); togglePin('${safeId}', ${isPinned}, this)"
                                            title="${isPinned ? '고정 해제' : '상단 고정'}">
                                        <i class="fa-solid fa-thumbtack"></i>
                                    </button>` : ''}
                                ${isAuthor ? `
                                    <button type="button" class="board-action-btn delete-btn"
                                            onclick="event.stopPropagation(); deletePostWithAnim('${safeId}', this)"
                                            title="게시글 삭제">
                                        <i class="fa-solid fa-trash-can"></i>
                                    </button>
                                    <button type="button" class="board-action-btn edit-btn role-edit-btn"
                                            onclick="event.stopPropagation(); editPost('${safeId}')"
                                            title="게시글 수정"
                                            style="color: #007bff !important;">
                                        <i class="fa-solid fa-pen-to-square" style="color: #007bff !important;"></i>
                                    </button>` : ''}
                                ${(isPresident || isAuthor) ? communityMobileMoreButton() : ''}
                                <span class="board-time">${timeStr}</span>
                            </div>
                        </div>
                        <h3 class="board-title">${escapeHtml(post.title || '')}</h3>
                        <p class="board-preview">${escapeHtml(post.body || '')}</p>
                        <div class="board-footer">
                            <span>조회 ${safeViews}회</span>
                            <div class="board-stats">
                                <button type="button" class="board-action-btn board-comment-btn" title="댓글 보기">
                                    <i class="fa-regular fa-comment"></i> <span class="comment-count">0</span>
                                </button>
                                <button type="button" class="board-action-btn" onclick="event.stopPropagation(); likePost('${safeId}', this)">
                                    <i class="${isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart'}" style="${isLiked ? 'color: #ff6b6b;' : ''}"></i> <span class="like-count">${safeLikes}</span>
                                </button>
                            </div>
                        </div>
                    `;

            if (isNew) {
                const cardElement = document.createElement('div');
                cardElement.className = `board-card ${isPinned ? 'pinned-state' : ''}`;
                cardElement.setAttribute('data-id', id);
                cardElement.innerHTML = innerHtml;
                cardElement.style.order = index; // CSS Order를 사용하여 시각적 순서 제어
                boardContainer.appendChild(cardElement);
                card = cardElement;
                card._latestPost = post;
                card._latestAvatarHtml = avatarHtml;
                card._latestTimeStr = timeStr;
                card._identitySignature = identitySignature;
                card._renderedPinned = isPinned;

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
                        if (e.target.closest('button, a, label, input')) return;
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
                        if (typeof window.schedulePostCardOpen === 'function') {
                            window.schedulePostCardOpen(card, () => openPostDetail(id, card._latestPost, card._latestAvatarHtml, card._latestTimeStr, 'fullscreen'), e);
                        } else {
                            openPostDetail(id, card._latestPost, card._latestAvatarHtml, card._latestTimeStr, 'fullscreen');
                        }
                    });
                } else {
                    card.addEventListener('click', (e) => {
                        if (e.target.closest('button, a, label, input')) return;
                        const openDetail = () => openPostDetail(id, card._latestPost, card._latestAvatarHtml, card._latestTimeStr, 'fullscreen');
                        if (typeof window.schedulePostCardOpen === 'function') {
                            window.schedulePostCardOpen(card, openDetail, e);
                        } else {
                            openDetail();
                        }
                    });
                }

                if (isPinned) {
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
                        openPostDetail(id, card._latestPost, card._latestAvatarHtml, card._latestTimeStr, 'side');
                    });
                }

            } else {
                // Update latest post for the click listener
                card._latestPost = post;
                card._latestAvatarHtml = avatarHtml;
                card._latestTimeStr = timeStr;
                if (card._identitySignature !== identitySignature) {
                    const authorEl = card.querySelector('.board-author');
                    if (authorEl) authorEl.innerHTML = authorInnerHtml;
                    card._identitySignature = identitySignature;
                }

                const timeEl = card.querySelector('.board-card-actions .board-time');
                if (timeEl && timeEl.innerHTML !== timeStr) timeEl.innerHTML = timeStr;

                const titleEl = card.querySelector('.board-title');
                if (titleEl && titleEl.textContent !== post.title) titleEl.textContent = post.title;

                const previewEl = card.querySelector('.board-preview');
                if (previewEl && previewEl.textContent !== post.body) previewEl.textContent = post.body;

                const viewsEl = card.querySelector('.board-footer > span');
                if (viewsEl && !viewsEl.textContent.includes(safeViews + '회')) viewsEl.textContent = '조회 ' + safeViews + '회';

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
                        likeCountEl.textContent = safeLikes;
                    }
                }

                const pinBadge = card.querySelector('.pin-badge-wrapper');
                if (pinBadge) {
                    pinBadge.className = 'pin-badge-wrapper ' + (isPinned ? 'active' : '');
                    pinBadge.style.transition = '';
                }

                const pinToggleBtn = card.querySelector('.pin-toggle-btn');
                if (pinToggleBtn) {
                    pinToggleBtn.classList.toggle('active', isPinned);
                    pinToggleBtn.setAttribute('onclick', `event.stopPropagation(); togglePin('${safeId}', ${isPinned}, this)`);
                    pinToggleBtn.setAttribute('title', isPinned ? '고정 해제' : '상단 고정');
                }

                card.classList.toggle('pinned-state', isPinned);
                card._renderedPinned = isPinned;
                card.style.order = index;
            }

            if (!postCommentCountUnsubscribes.has(id)) {
                const unsubscribe = db.collection('posts').doc(id).collection('comments').onSnapshot(snap => {
                    const currentCard = Array.from(boardContainer.querySelectorAll('.board-card')).find(item => item.dataset.id === id) || null;
                    const el = currentCard ? currentCard.querySelector('.comment-count') : null;
                    if (el) el.innerText = snap.docs.filter(commentDoc => !commentDoc.data().deleted).length;
                }, (error) => {
                    console.warn('댓글 수 불러오기 실패:', error);
                });
                postCommentCountUnsubscribes.set(id, unsubscribe);
            }

        });

        // 6. FLIP 애니메이션 실행 (부드러운 이동)
        const finalCards = boardContainer.querySelectorAll('.board-card:not(.deleting)');
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
                        const previousBadge = card.querySelector('.pin-badge-wrapper');
                        if (previousBadge) {
                            previousBadge.classList.toggle('active', oldState.pinned);
                            previousBadge.style.transition = 'none';
                        }
                    }
                    card.style.transition = 'none';
                    card.style.transform = `translate(${dx}px, ${dy}px)`;
                    card.offsetHeight; // 리플로우

                    card._flipFrame1 = requestAnimationFrame(() => {
                        card._flipFrame1 = null;
                        if (renderGeneration !== postRenderGeneration || !card.isConnected) return;
                        card._flipFrame2 = requestAnimationFrame(() => {
                            card._flipFrame2 = null;
                            if (renderGeneration !== postRenderGeneration || !card.isConnected) return;
                            card.classList.add('flipping');
                            if (pinnedChanged) {
                                card.style.zIndex = '20';
                                card.classList.toggle('pinned-state', isPinnedNow);
                                const nextBadge = card.querySelector('.pin-badge-wrapper');
                                if (nextBadge) {
                                    nextBadge.classList.toggle('active', isPinnedNow);
                                    nextBadge.style.transition = '';
                                }
                            }
                            // transition을 먼저 활성화한 후 transform을 원래대로 복구하여 부드럽게 비행
                            card.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.5s ease, padding-left 0.3s ease, background 0.3s ease, border-color 0.3s ease';
                            card.style.transform = '';

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
                    });
                }
            } else {
                if (!hasOutgoingCards) {
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(15px)';
                    card.offsetHeight;
                    card.style.transition = 'transform 0.5s cubic-bezier(0.2, 0, 0, 1), opacity 0.5s ease, border-color 0.3s ease, box-shadow 0.3s ease';
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                    setTimeout(() => {
                        card.style.transition = '';
                        card.style.opacity = '';
                        card.style.transform = '';
                    }, 500);
                }
            }
        });
}

function syncPostLikeChanges(changes) {
    if (!boardContainer) return;
    const uid = (auth.currentUser || currentUser)?.uid;
    changes.forEach((change) => {
        const data = change.doc.data();
        const liked = !!(uid && Array.isArray(data.likedUsers) && data.likedUsers.includes(uid));
        boardContainer.querySelectorAll('.board-card[data-id]').forEach((card) => {
            if (card.getAttribute('data-id') !== change.doc.id) return;
            const button = card.querySelector('.board-action-btn[onclick*="likePost"]');
            if (typeof applyLikeButtonState === 'function') {
                applyLikeButtonState(button, liked, data.likes);
            }
            if (card._latestPost) {
                card._latestPost = { ...card._latestPost, likes: data.likes, likedUsers: data.likedUsers };
            }
        });
    });
}

function loadPosts(sortBy = 'latest') {
    currentSortOrder = sortBy;
    if (postsUnsubscribe) {
        postsUnsubscribe();
        postsUnsubscribe = null;
    }
    clearPostCommentCountSubscriptions();

    const loggedInUser = auth.currentUser || currentUser;

    // Firebase Auth 인증 상태 확인 전에는 로그인 요구 문구를 표시하지 않음
    if (!isAuthReady) {
        return;
    }

    if (!loggedInUser) {
        showLoginRequiredState(true);
        return;
    }

    // 로그인된 상태라면 헤더 보이기 및 로그인 안내 박스 제거
    setBoardHeaderVisible(true, true);
    const loginNotice = boardContainer ? boardContainer.querySelector('.login-required-message') : null;
    if (loginNotice) {
        loginNotice.classList.add('message-fade-out');
        setTimeout(() => {
            loginNotice.remove();
        }, 180);
    }

    let query = db.collection('posts').orderBy('createdAt', 'desc');

    postsUnsubscribe = query.onSnapshot((snapshot) => {
        const previousSnapshot = lastPostsSnapshot;
        lastPostsSnapshot = snapshot;
        const currentLoggedInUser = auth.currentUser || currentUser;
        if (!currentLoggedInUser) {
            loadPosts(sortBy);
            return;
        }

        const changes = snapshot.docChanges();
        if (typeof applyLikeButtonState === 'function' && previousSnapshot && changes.length > 0 && changes.every((change) => {
            if (change.type !== 'modified') return false;
            const previousDoc = previousSnapshot.docs.find((doc) => doc.id === change.doc.id);
            return previousDoc && window.hasSameNonLikeFields(previousDoc.data(), change.doc.data());
        })) {
            syncPostLikeChanges(changes);
            return;
        }

        renderPosts(snapshot, sortBy);
    }, (error) => {
        console.error("onSnapshot error: ", error);
    });
}

// 초기 로드: auth.onAuthStateChanged에서 인증 확인 후 호출되며, 이미 인증된 경우에만 즉시 호출
if (auth.currentUser) {
    isAuthReady = true;
    loadPosts('latest');
}

// 커스텀 드롭다운 로직
const customDropdownContainer = document.getElementById('customSortDropdown');
const customSortSelected = document.getElementById('customSortSelected');
const customSortOptions = document.getElementById('customSortOptions');
const customSortOptionItems = document.querySelectorAll('#customSortOptions .custom-dropdown-option');

if (customSortSelected && customSortOptions) {
    customSortSelected.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('categoryFilterDropdown')?.classList.remove('open');
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

            // 선택된 텍스트 및 아이콘 업데이트 (부드러운 너비 전환)
            const sortSpanEl = customSortSelected.querySelector('span');
            if (sortSpanEl) sortSpanEl.innerHTML = textHTML;
            else customSortSelected.innerHTML = `<span>${textHTML}</span> <i class="fa-solid fa-chevron-down arrow-icon"></i>`;
            customDropdownContainer.classList.remove('open');

            // 데이터 새로고침
            if (lastPostsSnapshot && postsUnsubscribe) {
                renderPosts(lastPostsSnapshot, value);
            } else {
                loadPosts(value);
            }
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

            const spanEl = commentSortSelected.querySelector('span');
            if (spanEl) spanEl.innerHTML = textHTML;
            else commentSortSelected.innerHTML = `<span>${textHTML}</span> <i class="fa-solid fa-chevron-down arrow-icon"></i>`;
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
