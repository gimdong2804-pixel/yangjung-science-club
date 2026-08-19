// Firebase 공통 초기화 및 전역 설정
// 전역 공유 변수 설정
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

const firebaseConfig = {
    apiKey: "AIzaSyAjYVdkxXL8Z0eaFGGtiwn3qIXUreD8_lc",
    authDomain: "yangjung-science.firebaseapp.com",
    projectId: "yangjung-science",
    storageBucket: "yangjung-science.firebasestorage.app",
    messagingSenderId: "949394294466",
    appId: "1:949394294466:web:663583e43bba46f9e05d5b"
};
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
window.db = firebase.firestore();
window.auth = firebase.auth();
window.storage = firebase.storage();
var db = window.db;
var auth = window.auth;
var storage = window.storage;

// 관리자 권한은 Firebase에 실제 로그인된 회장·사장 계정만 인정합니다.
const ADMIN_EMAILS = Object.freeze(['gimdong2804@gmail.com', 'sjh20110407@gmail.com']);

function isAdmin(email) {
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    return ADMIN_EMAILS.includes(normalizedEmail);
}

function hasAdminAccess(user = auth.currentUser) {
    return Boolean(user && isAdmin(user.email));
}

function showAdminAccessDenied() {
    if (typeof window.customAlert === 'function') {
        window.customAlert('접근 권한이 없습니다.', '관리자 모드');
    } else {
        alert('접근 권한이 없습니다.');
    }
}

function requireAdminAccess(showMessage = true) {
    if (hasAdminAccess()) return true;
    if (showMessage) showAdminAccessDenied();
    return false;
}

// 전역 커스텀 Confirm 모달 함수 (취소: 왼쪽, 확인: 오른쪽)
window.customConfirm = function (message, title = '확인') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('customConfirmModalOverlay');
        const modal = document.getElementById('customConfirmModal');
        const titleEl = document.getElementById('customConfirmTitle');
        const msgEl = document.getElementById('customConfirmMessage');
        const cancelBtn = document.getElementById('customConfirmCancel');
        const okBtn = document.getElementById('customConfirmOk');

        if (!overlay || !modal || !cancelBtn || !okBtn) {
            resolve(window.confirm(message));
            return;
        }

        if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="color: var(--accent-color);"></i> ${title}`;
        if (msgEl) msgEl.textContent = message;

        history.pushState({ modal: 'customConfirm' }, '', '');
        overlay.classList.add('active');
        modal.classList.add('active');

        const cleanup = (result, fromPopState) => {
            overlay.classList.remove('active');
            modal.classList.remove('active');
            cancelBtn.removeEventListener('click', onCancel);
            okBtn.removeEventListener('click', onOk);
            overlay.removeEventListener('click', onCancel);
            if (window._customConfirmPopHandler) {
                window.removeEventListener('popstate', window._customConfirmPopHandler);
                window._customConfirmPopHandler = null;
            }
            if (!fromPopState && history.state && history.state.modal === 'customConfirm') {
                window._isProgrammaticBack = true;
                history.back();
            }
            resolve(result);
        };

        const onCancel = () => cleanup(false, false);
        const onOk = () => cleanup(true, false);

        window._customConfirmPopHandler = () => {
            cleanup(false, true);
        };
        window.addEventListener('popstate', window._customConfirmPopHandler);

        cancelBtn.addEventListener('click', onCancel);
        okBtn.addEventListener('click', onOk);
        overlay.addEventListener('click', onCancel);
    });
};

// 전역 커스텀 Alert 경고 모달 함수 (독립 100% 경고 전용 모달 - 취소 버튼 물리적 존재 0%)
window.customAlert = function (message, title = '경고') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('customAlertModalOverlay');
        const modal = document.getElementById('customAlertModal');
        const titleEl = document.getElementById('customAlertTitle');
        const msgEl = document.getElementById('customAlertMessage');
        const okBtn = document.getElementById('customAlertOk');

        if (!overlay || !modal || !okBtn) {
            alert(message);
            resolve();
            return;
        }

        if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: #ff6b6b;"></i> ${title}`;
        if (msgEl) msgEl.textContent = message;

        history.pushState({ modal: 'customAlert' }, '', '');
        overlay.classList.add('active');
        modal.classList.add('active');

        const cleanup = (fromPopState) => {
            overlay.classList.remove('active');
            modal.classList.remove('active');
            okBtn.removeEventListener('click', onOk);
            overlay.removeEventListener('click', onOk);
            if (window._customAlertPopHandler) {
                window.removeEventListener('popstate', window._customAlertPopHandler);
                window._customAlertPopHandler = null;
            }
            if (!fromPopState && history.state && history.state.modal === 'customAlert') {
                window._isProgrammaticBack = true;
                history.back();
            }
            resolve();
        };

        const onOk = () => cleanup(false);

        okBtn.addEventListener('click', onOk);
        overlay.addEventListener('click', onOk);

        window._customAlertPopHandler = () => cleanup(true);
        window.addEventListener('popstate', window._customAlertPopHandler, { once: true });
    });
};

// 테마 토글 로직
const themeToggleBtn = document.getElementById('themeToggleBtn');
const rootElement = document.documentElement;

const ACCOUNT_SETTINGS_DEFAULTS = Object.freeze({
    theme: 'light',
    logoDisplayStyle: 'default',
    scrollHide: true,
    commentInputScrollHide: true,
    textSelectPrevent: true,
    settingsSyncEnabled: true
});

let activeAccountUserId = null;
let accountSettings = { ...ACCOUNT_SETTINGS_DEFAULTS };
let isLoadingAccountSettings = false;
let unsubscribeAccountSettings = null;

function getDeviceSettingsStorageKey(userId) {
    return `account_settings_${userId}`;
}

function getDeviceAccountSettings(userId) {
    try {
        const rawSettings = localStorage.getItem(getDeviceSettingsStorageKey(userId));
        return rawSettings ? JSON.parse(rawSettings) : null;
    } catch (error) {
        console.error('기기 설정 불러오기 오류:', error);
        return null;
    }
}

function saveDeviceAccountSettings(userId, settings) {
    if (!userId) return;
    try {
        localStorage.setItem(getDeviceSettingsStorageKey(userId), JSON.stringify(settings));
    } catch (error) {
        console.error('기기 설정 저장 오류:', error);
    }
}

function saveAccountSettings(changes) {
    accountSettings = { ...accountSettings, ...changes };
    const userId = activeAccountUserId;
    if (!userId || isLoadingAccountSettings) return;

    saveDeviceAccountSettings(userId, accountSettings);

    const syncStateChanged = Object.prototype.hasOwnProperty.call(changes, 'settingsSyncEnabled');
    if (!accountSettings.settingsSyncEnabled && !syncStateChanged) return;

    const settingsToSave = syncStateChanged && accountSettings.settingsSyncEnabled
        ? { ...accountSettings, settingsSyncEnabled: true }
        : syncStateChanged
            ? { settingsSyncEnabled: false }
            : { ...changes, settingsSyncEnabled: true };

    db.collection('users').doc(userId).collection('private').doc('settings').set({
        ...settingsToSave,
        updatedAt: Date.now()
    }, { merge: true }).catch((error) => {
        console.error('계정 설정 저장 오류:', error);
    });
}

function getSiteTheme() {
    return rootElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function setSiteTheme(theme, save = true) {
    const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
    if (normalizedTheme === 'dark') {
        rootElement.removeAttribute('data-theme');
    } else {
        rootElement.setAttribute('data-theme', 'light');
    }

    const darkModeSettingToggle = document.getElementById('darkModeSettingToggle');
    if (darkModeSettingToggle) {
        darkModeSettingToggle.checked = normalizedTheme === 'dark';
    }

    if (save) saveAccountSettings({ theme: normalizedTheme });
}

function setSettingsSyncEnabled(enabled, save = true) {
    const normalizedEnabled = Boolean(enabled);
    accountSettings = { ...accountSettings, settingsSyncEnabled: normalizedEnabled };

    const settingsSyncToggle = document.getElementById('settingsSyncToggle');
    if (settingsSyncToggle) settingsSyncToggle.checked = normalizedEnabled;

    if (save) saveAccountSettings({ settingsSyncEnabled: normalizedEnabled });
}

setSiteTheme(ACCOUNT_SETTINGS_DEFAULTS.theme, false);
window.setSiteTheme = setSiteTheme;
window.setSettingsSyncEnabled = setSettingsSyncEnabled;

if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        setSiteTheme(getSiteTheme() === 'light' ? 'dark' : 'light');
    });
}

function toggleProfileDetails() {
    const profileInfo = document.getElementById('userProfileInfo');
    if (profileInfo) {
        profileInfo.classList.toggle('expanded');
    }
}

// 사이드 드로어 제어 로직
const menuBtn = document.getElementById('menuBtn');
const sideDrawer = document.getElementById('sideDrawer');
const drawerOverlay = document.getElementById('drawerOverlay');
const drawerCloseBtn = document.getElementById('drawerCloseBtn');

function openDrawer() {
    history.pushState({ modal: 'drawer' }, '', '#drawer');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
        sideDrawer.classList.add('active');
        drawerOverlay.classList.add('active');
    });
}

function closeDrawer(e) {
    const fromPopState = (e === true);
    sideDrawer.classList.remove('active');
    drawerOverlay.classList.remove('active');
    document.body.style.overflow = '';
    if (fromPopState !== true && history.state && history.state.modal === 'drawer') {
        window._isProgrammaticBack = true;
        history.back();
    }
}

menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openDrawer();
});

drawerCloseBtn.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);

// ESC 키 입력 시 사이드 드로어 닫기
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeDrawer();
    }
});

// 아코디언 메뉴 개별 토글 (다중 열기 허용 및 부드러운 애니메이션 연동)
const categories = document.querySelectorAll('.menu-category');
categories.forEach(category => {
    category.querySelector('.category-header').addEventListener('click', () => {
        category.classList.toggle('active');
    });
});

// 페이지 전환 로직
const mainPage = document.getElementById('mainPage');
const greetingPage = document.getElementById('greetingPage');
const goalPage = document.getElementById('goalPage');
const greetingLink = document.getElementById('greetingLink');
const goalLink = document.getElementById('goalLink');
const backBtn = document.getElementById('backBtn');
const goalBackBtn = document.getElementById('goalBackBtn');
const siteFooter = document.querySelector('footer');
let currentPage = mainPage;

// 커스텀 스크롤바 제어 변수 및 함수
const customScrollbar = document.getElementById('customScrollbar');
const customScrollbarThumb = document.getElementById('customScrollbarThumb');
let scrollTimeout;
let isHoveringScrollbar = false;
let isDragging = false;
let startY = 0;
let startScrollTop = 0;

function updateScrollbar() {
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    const scrollTop = document.documentElement.scrollTop;

    // 스크롤바가 필요 없는 경우 또는 greetingPage가 비활성화 상태일 때는 숨김
    const isGreetingActive = !greetingPage.classList.contains('hidden') && greetingPage.classList.contains('fade-in');
    if (scrollHeight <= clientHeight || !isGreetingActive) {
        customScrollbar.classList.remove('visible');
        return;
    }

    // 헤더 높이를 구해 스크롤바 시작 지점을 헤더 바로 아래로 설정
    const header = document.querySelector('header');
    const headerHeight = header ? header.offsetHeight : 70;
    customScrollbar.style.top = `${headerHeight + 6}px`;

    // 스크롤바 트랙 여백(top/bottom 각 6px) 및 헤더 높이를 고려한 트랙 크기 계산
    const trackHeight = clientHeight - headerHeight - 12;

    // 썸 최소 높이 30px 설정
    const thumbHeight = Math.max(30, (clientHeight / scrollHeight) * trackHeight);
    const maxScrollTop = scrollHeight - clientHeight;
    const maxThumbTop = trackHeight - thumbHeight;

    const thumbTop = maxScrollTop > 0 ? (scrollTop / maxScrollTop) * maxThumbTop : 0;

    customScrollbarThumb.style.height = `${thumbHeight}px`;
    customScrollbarThumb.style.transform = `translateY(${thumbTop}px)`;

    // 스크롤 시 스크롤바를 보이게 함
    customScrollbar.classList.add('visible');

    // 타이머 재설정 (사용 중이 아닐 때 1.5초 후 페이드 아웃)
    clearTimeout(scrollTimeout);
    if (!isDragging && !isHoveringScrollbar) {
        scrollTimeout = setTimeout(() => {
            customScrollbar.classList.remove('visible');
        }, 1500);
    }
}

function showScrollbar() {
    // 레이아웃이 완전히 반영된 후 높이 체크 및 표시
    setTimeout(() => {
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = document.documentElement.clientHeight;
        if (scrollHeight > clientHeight) {
            updateScrollbar();
            customScrollbar.classList.add('visible');
        }
    }, 50);
}

function hideScrollbar() {
    customScrollbar.classList.remove('visible');
    clearTimeout(scrollTimeout);
}

// 스크롤 및 창 크기 변경 감지
window.addEventListener('scroll', updateScrollbar, { passive: true });
window.addEventListener('resize', () => {
    updateScrollbar();

    // 상세화면이 열려있을 때 화면 크기에 따라 DOM 위치를 보정합니다.
    if (currentPostId) {
        const sideDetailContainer = document.getElementById('sideDetailContainer');
        if (sideDetailContainer) {
            const isFullscreen = currentDetailMode === 'fullscreen';
            const isMobile = window.innerWidth <= 1023;
            if (isFullscreen || isMobile) {
                if (sideDetailContainer.parentElement !== document.body) {
                    document.body.appendChild(sideDetailContainer);
                }
                document.body.classList.add('detail-open');
            } else {
                const communityLayout = document.querySelector('.community-layout');
                if (communityLayout && sideDetailContainer.parentElement !== communityLayout) {
                    communityLayout.appendChild(sideDetailContainer);
                }
                document.body.classList.remove('detail-open');
            }
        }
    }
});

// 스크롤바 영역 마우스 호버 감지 (호버 시 계속 표시되도록 함)
customScrollbar.addEventListener('mouseenter', () => {
    isHoveringScrollbar = true;
    clearTimeout(scrollTimeout);
    customScrollbar.classList.add('visible');
});

customScrollbar.addEventListener('mouseleave', () => {
    isHoveringScrollbar = false;
    if (!isDragging) {
        scrollTimeout = setTimeout(() => {
            customScrollbar.classList.remove('visible');
        }, 1000); // 마우스가 벗어난 후 1초 뒤 숨김
    }
});

// 스크롤바 마우스 드래그 기능
customScrollbarThumb.addEventListener('mousedown', (e) => {
    isDragging = true;
    startY = e.clientY;
    startScrollTop = document.documentElement.scrollTop;
    document.body.style.userSelect = 'none';
    customScrollbarThumb.classList.add('dragging');
    clearTimeout(scrollTimeout);
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaY = e.clientY - startY;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    const thumbHeight = parseFloat(customScrollbarThumb.style.height);

    const header = document.querySelector('header');
    const headerHeight = header ? header.offsetHeight : 70;
    const trackHeight = clientHeight - headerHeight - 12;
    const maxScrollTop = scrollHeight - clientHeight;
    const maxThumbTop = trackHeight - thumbHeight;

    if (maxThumbTop > 0) {
        const scrollDelta = (deltaY / maxThumbTop) * maxScrollTop;
        document.documentElement.scrollTop = startScrollTop + scrollDelta;
    }
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        document.body.style.userSelect = '';
        customScrollbarThumb.classList.remove('dragging');

        // 마우스 드래그가 끝났을 때 호버 중이 아니라면 일정 시간 후 사라짐
        if (!isHoveringScrollbar) {
            scrollTimeout = setTimeout(() => {
                customScrollbar.classList.remove('visible');
            }, 1000);
        }
    }
});

function handlePageBack() {
    history.replaceState({ page: 'mainPage' }, '', '#/mainPage');
    switchPage(currentPage, mainPage, true);
}

const ADMIN_PAGE_IDS = new Set(['roleManagePage', 'updateRulesPage']);

function switchPage(fromPage, toPage, skipHistory = false, replaceState = false) {
    if (typeof fromPage === 'string') fromPage = document.getElementById(fromPage) || currentPage;
    if (typeof toPage === 'string') toPage = document.getElementById(toPage);
    if (!fromPage || !toPage) return;
    if (ADMIN_PAGE_IDS.has(toPage.id) && !requireAdminAccess()) return;
    if (fromPage === toPage) return; // 동일한 페이지로의 전환은 무시

    // 페이지 전환 시 다중선택 모드 해제
    if (window.isPostMultiSelectMode && typeof window.cancelPostMultiDelete === 'function') {
        window.cancelPostMultiDelete(true);
    }
    if (window.isMultiSelectMode && typeof window.cancelMultiDelete === 'function') {
        window.cancelMultiDelete(true);
    }

    if (toPage !== mainPage) {
        document.body.classList.remove('home-active');
    }

    if (!skipHistory) {
        const pageId = toPage.id || 'mainPage';
        if (replaceState) {
            history.replaceState({ page: pageId }, '', '#/' + pageId);
        } else {
            history.pushState({ page: pageId }, '', '#/' + pageId);
        }
    }

    // 현재 페이지 fade out (opacity만 사용하여 스크롤 위치 무관하게 동작)
    fromPage.classList.add('fade-out');
    fromPage.classList.remove('fade-in');

    // 메인 페이지에서 서브 페이지로 이동할 때 푸터 페이드 아웃 시작
    if (fromPage === mainPage) {
        siteFooter.classList.add('fade-out');
    }

    // 페이지가 바뀔 때 우선 스크롤바 숨기기
    hideScrollbar();

    setTimeout(() => {
        // 보여줄 페이지의 hidden을 먼저 해제하여 높이를 확보
        toPage.classList.remove('hidden');

        // 스크롤 리셋 (높이가 확보되었으므로 스크롤 리셋이 원활히 수행됨)
        window.scrollTo(0, 0);

        // 사라질 페이지를 hidden 처리
        fromPage.classList.add('hidden');

        // 메인 페이지로 완전히 전환되었을 때 비로소 overflow: hidden을 적용하여 스크롤 차단
        if (toPage === mainPage) {
            document.body.classList.add('home-active');
        }

        // 강제 리플로우를 발생시켜 display 상태의 변화를 인지하도록 처리
        toPage.offsetHeight;

        // 새 페이지 fade in
        requestAnimationFrame(() => {
            toPage.classList.remove('fade-out');
            toPage.classList.add('fade-in');

            if (toPage === mainPage) {
                // 메인 페이지로 돌아올 때는 푸터 display를 복원하고 페이드 인 적용
                siteFooter.style.display = '';
                siteFooter.offsetHeight; // 리플로우
                siteFooter.classList.remove('fade-out');
            } else {
                // 서브 페이지로 전환 완료 시점에는 푸터를 완전히 숨김
                siteFooter.style.display = 'none';
            }

            // 인사말 페이지로 왔을 때만 페이드 인으로 스크롤바 노출
            if (toPage === greetingPage) {
                showScrollbar();
            }

            // 현재 활성화된 페이지 상태 업데이트
            currentPage = toPage;

            // [수정] 작성 버튼 가시성 업데이트 (통합 함수 호출)
            if (typeof updateWriteButtonVisibility === 'function') {
                updateWriteButtonVisibility(toPage);
            }
        });
    }, 400);
}

// [추가] 작성 버튼 가시성 통합 제어 함수
function updateWriteButtonVisibility(page) {
    const btn = document.getElementById('writePostBtn');
    if (!btn) return;
    const targetPage = page || currentPage;
    const sideDetail = document.getElementById('sideDetailContainer');
    const isDetailHidden = !sideDetail || sideDetail.classList.contains('detail-hidden');
    const shouldShow = (targetPage === suggestionPage) && isDetailHidden;
    if (shouldShow) {
        btn.classList.remove('fab-hidden');
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
        btn.style.visibility = 'visible';
        btn.style.transform = 'scale(1)';
    } else {
        btn.classList.add('fab-hidden');
        btn.style.opacity = '0';
        btn.style.pointerEvents = 'none';
        btn.style.visibility = 'hidden';
        btn.style.transform = 'scale(0.6)';
    }
}

greetingLink.addEventListener('click', (e) => {
    e.preventDefault();
    closeDrawer(true);
    switchPage(currentPage, greetingPage, false, true);
});

const logoHomeBtn = document.getElementById('logoHomeBtn');
logoHomeBtn.addEventListener('click', () => {
    logoHomeBtn.classList.add('clicked');
    setTimeout(() => {
        logoHomeBtn.classList.remove('clicked');
    }, 200);

    if (currentPage !== mainPage) {
        switchPage(currentPage, mainPage);
    }
});

backBtn.addEventListener('click', handlePageBack);

goalLink.addEventListener('click', (e) => {
    e.preventDefault();
    closeDrawer(true);
    switchPage(currentPage, goalPage, false, true);
});

goalBackBtn.addEventListener('click', handlePageBack);

// 커뮤니티 라우팅
const suggestionLink = document.getElementById('suggestionLink');
const suggestionPage = document.getElementById('suggestionPage');
const suggestionBackBtn = document.getElementById('suggestionBackBtn');
suggestionLink.addEventListener('click', (e) => {
    e.preventDefault();
    closeDrawer(true);
    switchPage(currentPage, suggestionPage, false, true);
});

suggestionBackBtn.addEventListener('click', () => {
    closeSideDetail();
    handlePageBack();
});

// ==========================================
// 관리자 메뉴: 실제 로그인 계정에만 연결된 6회 터치 확인 동작
// ==========================================
const adminTriggerIcon = document.getElementById('adminTriggerIcon');
const adminCategory = document.getElementById('adminCategory');

// 예전 비밀번호 방식으로 남은 값은 더 이상 권한으로 사용하지 않습니다.
localStorage.removeItem('isAdminUnlocked');

function setAdminCategoryVisible(visible) {
    if (!adminCategory) return;
    adminCategory.style.display = visible ? 'block' : 'none';
    adminCategory.classList.remove('category-fade-in', 'category-fade-out');
}

function revokeAdminUi() {
    setAdminCategoryVisible(false);

    if (typeof stopRoleList === 'function') stopRoleList();
    if (window.isRoleMultiSelectMode && typeof window.cancelRoleMultiDelete === 'function') {
        window.cancelRoleMultiDelete();
    }

    const roleList = document.getElementById('roleListContainer');
    if (roleList) roleList.replaceChildren();

    const roleEditModalOverlay = document.getElementById('roleEditModalOverlay');
    const roleEditModal = document.getElementById('roleEditModal');
    if (roleEditModalOverlay) roleEditModalOverlay.classList.remove('active');
    if (roleEditModal) roleEditModal.classList.remove('active');

    const isAdminPageOpen = currentPage && ['roleManagePage', 'updateRulesPage'].includes(currentPage.id);
    if (isAdminPageOpen) {
        history.replaceState({ page: 'mainPage' }, '', '#/mainPage');
        switchPage(currentPage, mainPage, true);
    }
}

function syncAdminAccessUi(user = auth.currentUser) {
    if (hasAdminAccess(user)) {
        setAdminCategoryVisible(true);
    } else {
        revokeAdminUi();
    }
}

let adminClickCount = 0;
let adminLastClickTime = 0;

if (adminTriggerIcon) {
    adminTriggerIcon.addEventListener('click', () => {
        const currentTime = Date.now();
        if (currentTime - adminLastClickTime > 5000) adminClickCount = 0;

        adminClickCount += 1;
        adminLastClickTime = currentTime;

        if (adminClickCount < 6) return;
        adminClickCount = 0;

        if (!hasAdminAccess()) {
            showAdminAccessDenied();
            return;
        }

        setAdminCategoryVisible(true);
        const drawer = document.getElementById('sideDrawer');
        if (drawer) {
            drawer.scrollTo({ top: drawer.scrollHeight, behavior: 'smooth' });
        }
    });
}

// ==========================================
// 직책 관리 페이지 로직 (모달에서 변경)
// ==========================================
const roleManageMenuBtn = document.getElementById('roleManageMenuBtn');
const roleManagePage = document.getElementById('roleManagePage');
const roleTargetEmail = document.getElementById('roleTargetEmail');
const roleNameInput = document.getElementById('roleNameInput');
const roleManageBackBtn = document.getElementById('roleManageBackBtn');
const roleManageConfirmBtn = document.getElementById('roleManageConfirmBtn');

if (roleManageMenuBtn) {
    roleManageMenuBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!requireAdminAccess()) return;
        roleTargetEmail.value = '';
        roleNameInput.value = '';
        loadRoleList();
        closeDrawer(true);
        switchPage(currentPage, roleManagePage, false, true);
    });
}

if (roleManageBackBtn) {
    roleManageBackBtn.addEventListener('click', handlePageBack);
}

// ==========================================
// 업데이트 규칙 페이지 로직
// ==========================================
const updateRulesMenuBtn = document.getElementById('updateRulesMenuBtn');
const updateRulesPage = document.getElementById('updateRulesPage');
const updateRulesBackBtn = document.getElementById('updateRulesBackBtn');

if (updateRulesMenuBtn) {
    updateRulesMenuBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!requireAdminAccess()) return;
        closeDrawer(true);
        switchPage(currentPage, updateRulesPage, false, true);
    });
}

if (updateRulesBackBtn) {
    updateRulesBackBtn.addEventListener('click', handlePageBack);
}

// Auth 변경에 맞춘 관리자 메뉴 표시 리스너
auth.onAuthStateChanged(user => {
    syncAdminAccessUi(user);
});

if (roleManageConfirmBtn) {
    roleManageConfirmBtn.addEventListener('click', async () => {
        if (!requireAdminAccess()) return;

        const targetEmail = roleTargetEmail.value.trim();
        const roleName = roleNameInput.value.trim();

        if (!targetEmail || !roleName) {
            alert('이메일과 직책명을 모두 입력해주세요.');
            return;
        }

        roleTargetEmail.value = '';
        roleNameInput.value = '';
        roleTargetEmail.focus();

        try {
            await db.collection('userRoles').doc(targetEmail).set({
                roleName: roleName,
                timestamp: Date.now()
            });
        } catch (e) {
            console.error("Role setting error", e);
            alert('직책 부여 중 오류가 발생했습니다.');
        }
    });
}

// 엔터 키로 빠른 직책 부여 기능
const handleRoleEnterPress = (e) => {
    if (e.key === 'Enter') {
        const targetEmail = roleTargetEmail.value.trim();
        const roleName = roleNameInput.value.trim();
        if (targetEmail && roleName) {
            roleManageConfirmBtn.click();
        }
    }
};
if (roleTargetEmail) roleTargetEmail.addEventListener('keypress', handleRoleEnterPress);
if (roleNameInput) roleNameInput.addEventListener('keypress', handleRoleEnterPress);

// ==========================================
// 직책 관리 목록 및 다중 삭제/수정 로직
// ==========================================
let unsubscribeRoles = null;
const roleListContainer = document.getElementById('roleListContainer');
window.isRoleMultiSelectMode = false;
let roleMultiTimer;

let seenRoleEmails = new Set();
let isRoleInitialLoad = true;
let roleJustActivated = false;

function stopRoleList() {
    if (unsubscribeRoles) {
        unsubscribeRoles();
        unsubscribeRoles = null;
    }
}

function loadRoleList() {
    if (!requireAdminAccess(false)) {
        stopRoleList();
        if (roleListContainer) roleListContainer.replaceChildren();
        return;
    }

    stopRoleList();
    unsubscribeRoles = db.collection('userRoles').onSnapshot(snapshot => {
        if (!hasAdminAccess()) {
            stopRoleList();
            if (roleListContainer) roleListContainer.replaceChildren();
            return;
        }

        const roles = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            roles.push({
                email: doc.id,
                roleName: data.roleName,
                timestamp: data.timestamp || 0,
                pinned: data.pinned || false
            });
        });

        // 고정된 항목 먼저, 그 다음 최신 부여 순으로 정렬
        roles.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return b.timestamp - a.timestamp;
        });

        renderRoleList(roles);
    });
}

function renderRoleList(roles) {
    if (!roleListContainer) return;

    // 수동 삭제 직후에는 DOM이 이미 올바르므로 재구성 건너뜀
    if (window._skipNextRoleRender) {
        window._skipNextRoleRender = false;
        isRoleInitialLoad = false;
        return;
    }

    // 0. 진행 중인 FLIP 애니메이션 즉시 완료
    roleListContainer.querySelectorAll('.board-card.flipping').forEach(card => {
        const tid = card._flipTimerId;
        if (tid) { clearTimeout(tid); card._flipTimerId = null; }
        card.classList.remove('flipping');
        card.style.transition = 'none';
        card.style.transform = '';
        card.style.zIndex = '';
        card.offsetHeight;
        card.style.transition = '';
    });

    // 1. 이전 위치 저장 (FLIP의 First)
    const oldPositions = new Map();
    const oldData = new Map();
    roleListContainer.querySelectorAll('.board-card').forEach(card => {
        const email = card.getAttribute('data-email');
        if (!card.classList.contains('deleting')) {
            oldPositions.set(email, card.getBoundingClientRect());
            oldData.set(email, {
                pinned: card.classList.contains('pinned-state')
            });
        }
    });

    // 다중 선택 모드 중이면 체크된 이메일 목록을 저장
    const checkedEmails = new Set();
    if (window.isRoleMultiSelectMode) {
        document.querySelectorAll('.role-select-cb:checked').forEach(cb => {
            checkedEmails.add(cb.value);
        });
    }

    // 삭제 애니메이션 중인 이메일 목록
    const deletingEmails = new Set();
    roleListContainer.querySelectorAll('.board-card.deleting').forEach(card => {
        deletingEmails.add(card.getAttribute('data-email'));
    });



    roleListContainer.innerHTML = '';

    // 현재 roles에 포함된 이메일 목록
    const currentRoleEmails = new Set(roles.map(r => r.email));

    roles.forEach((role) => {
        // 삭제 애니메이션 중인 항목은 건너뜀
        if (deletingEmails.has(role.email)) return;

        const card = document.createElement('div');
        card.className = `board-card ${role.pinned ? 'pinned-state' : ''}`;
        card.style.position = 'relative';
        card.setAttribute('data-email', role.email);

        // 로딩 이후 새로운 요소에만 등장 애니메이션 적용
        const isNew = !isRoleInitialLoad && !seenRoleEmails.has(role.email);
        seenRoleEmails.add(role.email);

        const roleCheckbox = `
                    <label class="post-checkbox-wrapper" onclick="event.stopPropagation();">
                        <input type="checkbox" class="role-select-cb" value="${role.email}" onchange="updateRoleMultiDeleteUI()" style="width: 1.1rem; height: 1.1rem; accent-color: var(--accent-color); cursor: pointer;">
                    </label>
                `;

        card.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 0.8rem;">
                            ${roleCheckbox}
                            <div>
                                <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-primary);">${role.roleName}</h3>
                                <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">${role.email}</p>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <button type="button" class="board-action-btn pin-toggle-btn ${role.pinned ? 'active' : ''}" onclick="event.stopPropagation(); toggleRolePin('${role.email}', ${role.pinned || false})" title="${role.pinned ? '고정 해제' : '상단 고정'}">
                                <i class="fa-solid fa-thumbtack"></i>
                            </button>
                            <button type="button" class="board-action-btn delete-btn" onclick="event.stopPropagation(); deleteRoleWithAnim('${role.email}', this)" title="직책 삭제">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                            <button class="board-action-btn role-edit-btn" onclick="event.stopPropagation(); openRoleEditModal('${role.email}', '${role.roleName}')" title="직책 수정" style="padding: 0.5rem; display: flex; align-items: center; justify-content: center; color: #007bff !important;">
                                <i class="fa-solid fa-pen-to-square" style="color: #007bff !important;"></i>
                            </button>
                        </div>
                    </div>
                `;

        // 롱클릭(다중 선택) 이벤트
        card.addEventListener('pointerdown', (e) => handleRolePointerDown(e, role.email));
        card.addEventListener('pointerup', () => handleRolePointerUp());
        card.addEventListener('pointercancel', () => handleRolePointerUp());
        card.addEventListener('pointermove', handleRolePointerMove);
        card.addEventListener('contextmenu', (e) => {
            if (window.isRoleMultiSelectMode) { e.preventDefault(); }
        });

        card.addEventListener('click', (e) => {
            if (roleJustActivated) return;
            if (window.isRoleMultiSelectMode) {
                if (e.target.classList.contains('role-select-cb') || e.target.closest('label')) return;
                e.preventDefault();
                e.stopPropagation();
                const cb = card.querySelector('.role-select-cb');
                if (cb) {
                    cb.checked = !cb.checked;
                    updateRoleMultiDeleteUI();
                }
            }
        });

        roleListContainer.appendChild(card);
    });

    // 다중 선택 모드 중이었으면 체크 상태 복원
    if (checkedEmails.size > 0) {
        document.querySelectorAll('.role-select-cb').forEach(cb => {
            if (checkedEmails.has(cb.value)) {
                cb.checked = true;
            }
        });
        updateRoleMultiDeleteUI();
    }

    // 2. FLIP 애니메이션 실행 (Last → Invert → Play)
    const finalCards = roleListContainer.querySelectorAll('.board-card');
    finalCards.forEach(card => {
        const email = card.getAttribute('data-email');
        const oldPos = oldPositions.get(email);
        const isNew = !isRoleInitialLoad && !oldPos;

        if (oldPos) {
            const newPos = card.getBoundingClientRect();
            const dy = oldPos.top - newPos.top;
            const dx = oldPos.left - newPos.left;
            if (dx !== 0 || dy !== 0) {
                card.style.transition = 'none';
                card.style.transform = `translate(${dx}px, ${dy}px)`;
                card.classList.add('flipping');

                const oldState = oldData.get(email);
                if (oldState && oldState.pinned !== card.classList.contains('pinned-state')) {
                    card.style.zIndex = '20';
                }

                card.offsetHeight; // 리플로우
                card.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.5s ease';
                card.style.transform = 'translate(0, 0)';
                card._flipTimerId = setTimeout(() => {
                    card._flipTimerId = null;
                    card.classList.remove('flipping');
                    card.style.transition = '';
                    card.style.transform = '';
                    card.style.zIndex = '';
                }, 500);
            }
        } else if (isNew) {
            // 새 카드 등장 애니메이션
            card.style.opacity = '0';
            card.style.transform = 'translateY(15px)';
            card.offsetHeight;
            card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
            setTimeout(() => {
                card.style.transition = '';
                card.style.opacity = '';
                card.style.transform = '';
            }, 400);
        }
    });



    isRoleInitialLoad = false;
}

function handleRolePointerDown(e, email) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (window.isRoleMultiSelectMode) return;
    window.roleStartX = e.clientX;
    window.roleStartY = e.clientY;
    roleMultiTimer = setTimeout(() => {
        window.isRoleMultiSelectMode = true;
        roleJustActivated = true;
        setTimeout(() => { roleJustActivated = false; }, 300);
        if (navigator.vibrate) navigator.vibrate(50);
        document.body.classList.add('multi-select-mode');
        const card = document.querySelector(`.board-card[data-email="${email}"]`);
        if (card) {
            const cb = card.querySelector('.role-select-cb');
            if (cb) {
                cb.checked = true;
                updateRoleMultiDeleteUI();
            }
        }
    }, 600);
}
function handleRolePointerUp() { clearTimeout(roleMultiTimer); }
function handleRolePointerMove(e) {
    if (window.roleStartY !== undefined) {
        const dy = Math.abs(e.clientY - window.roleStartY);
        const dx = Math.abs(e.clientX - window.roleStartX);
        if (dy > 10 || dx > 10) clearTimeout(roleMultiTimer);
    } else {
        clearTimeout(roleMultiTimer);
    }
}

window.updateRoleMultiDeleteUI = function () {
    const bar = document.getElementById('roleMultiDeleteBar');
    const cntSpan = document.getElementById('roleMultiDeleteCount');
    const cbs = document.querySelectorAll('.role-select-cb:checked');
    if (cbs.length > 0) {
        window.isRoleMultiSelectMode = true;
        document.body.classList.add('multi-select-mode');
        cntSpan.innerText = cbs.length + '개 선택됨';
        bar.style.bottom = '20px';
    } else {
        if (window.isRoleMultiSelectMode) {
            cancelRoleMultiDelete();
        }
    }
};

window.cancelRoleMultiDelete = function () {
    window.isRoleMultiSelectMode = false;
    document.body.classList.remove('multi-select-mode');
    const bar = document.getElementById('roleMultiDeleteBar');
    if (bar) bar.style.bottom = '-250px';
    document.querySelectorAll('.role-select-cb').forEach(cb => cb.checked = false);
};

window.executeRoleMultiDelete = async function () {
    if (!requireAdminAccess()) return;
    const cbs = document.querySelectorAll('.role-select-cb:checked');
    if (cbs.length === 0) return;
    if (!await window.customConfirm(`선택한 ${cbs.length}명의 직책을 회수하시겠습니까?`, '직책 회수')) return;

    try {
        const batch = db.batch();
        cbs.forEach(cb => {
            const docRef = db.collection('userRoles').doc(cb.value);
            batch.delete(docRef);
        });
        await batch.commit();
        cancelRoleMultiDelete();
    } catch (e) {
        console.error(e);
        alert('직책 해제 중 오류가 발생했습니다.');
    }
};

// --- 직책 수정 모달 로직 ---
const roleEditModalOverlay = document.getElementById('roleEditModalOverlay');
const roleEditModal = document.getElementById('roleEditModal');
const roleEditTargetEmailText = document.getElementById('roleEditTargetEmailText');
const roleEditNameInput = document.getElementById('roleEditNameInput');
const roleEditModalCancel = document.getElementById('roleEditModalCancel');
const roleEditModalConfirm = document.getElementById('roleEditModalConfirm');
let currentEditRoleEmail = '';

window.openRoleEditModal = function (email, currentRoleName) {
    if (!requireAdminAccess()) return;
    currentEditRoleEmail = email;
    roleEditTargetEmailText.innerText = email;
    roleEditNameInput.value = currentRoleName;
    roleEditModalOverlay.classList.add('active');
    roleEditModal.classList.add('active');
};

if (roleEditModalCancel) {
    roleEditModalCancel.addEventListener('click', () => {
        roleEditModalOverlay.classList.remove('active');
        roleEditModal.classList.remove('active');
    });
}

if (roleEditModalConfirm) {
    roleEditModalConfirm.addEventListener('click', async () => {
        if (!requireAdminAccess()) return;

        const newRoleName = roleEditNameInput.value.trim();
        if (!newRoleName) {
            alert('새로운 직책명을 입력해주세요.');
            return;
        }
        try {
            await db.collection('userRoles').doc(currentEditRoleEmail).update({
                roleName: newRoleName
            });
            roleEditModalOverlay.classList.remove('active');
            roleEditModal.classList.remove('active');
        } catch (e) {
            console.error(e);
            alert('직책 수정 중 오류가 발생했습니다.');
        }
    });
}

// 직책 개별 삭제 (페이드 → 공간 접기 → Firestore 삭제)
window.deleteRoleWithAnim = async function (email, btnEl) {
    if (!requireAdminAccess()) return;
    if (!confirm(`'${email}'의 직책을 회수하시겠습니까?`)) return;

    const card = btnEl.closest('.board-card');
    if (card) {
        // 1단계: 페이드 아웃 (0.3초)
        card.classList.add('deleting');
        await new Promise(r => setTimeout(r, 300));

        // 2단계: 공간 부드럽게 접기 (0.3초)
        const cardHeight = card.offsetHeight;
        const parent = card.parentElement;
        let gapVal = 0;
        if (parent) {
            const gapStyle = window.getComputedStyle(parent).gap;
            if (gapStyle && gapStyle !== 'normal') {
                gapVal = parseFloat(gapStyle);
            }
        }
        card.style.height = cardHeight + 'px';
        card.style.overflow = 'hidden';
        card.offsetHeight; // 리플로우
        card.style.transition = 'height 0.3s ease, padding 0.3s ease, margin 0.3s ease, opacity 0s';
        card.style.height = '0';
        card.style.paddingTop = '0';
        card.style.paddingBottom = '0';
        card.style.border = 'none';
        card.style.marginBottom = gapVal > 0 ? `-${gapVal}px` : '0';
        await new Promise(r => setTimeout(r, 300));

        // 2.5단계: DOM에서 제거 (gap도 사라짐)
        card.remove();

        // onSnapshot 재구성 방지 (이미 DOM이 올바른 상태)
        window._skipNextRoleRender = true;

        // 3단계: Firestore 삭제
        try {
            await db.collection('userRoles').doc(email).delete();
            seenRoleEmails.delete(email);
        } catch (e) {
            console.error(e);
            alert('직책 삭제 중 오류가 발생했습니다.');
        }
    } else {
        try {
            await db.collection('userRoles').doc(email).delete();
            seenRoleEmails.delete(email);
        } catch (e) {
            console.error(e);
            alert('직책 삭제 중 오류가 발생했습니다.');
        }
    }
};

// 직책 개별 고정/해제 (커뮤니티와 동일한 애니메이션)
window.toggleRolePin = async function (email, currentPinned) {
    if (!requireAdminAccess()) return;
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
        await db.collection('userRoles').doc(email).update({ pinned: !isPinned });
    } catch (e) {
        console.error(e);
        if (btn) btn.classList.toggle('active', isPinned);
    }
};

// --- 설정 창 로직 ---
window.openSettingsModal = function (tabName = 'display') {
    const hadDrawer = (history.state && history.state.modal === 'drawer') || (sideDrawer && sideDrawer.classList.contains('active'));
    
    // 드로어에서 설정창으로 바로 진입할 때는 오버레이 블러를 끊김 없이 유지하기 위해 closeDrawer()로 오버레이를 끄지 않음
    if (sideDrawer) {
        sideDrawer.classList.add('drawer-hidden-by-settings');
        sideDrawer.classList.remove('active');
    }
    
    resetUsefulSettingsSubPage();
    resetDisplaySettingsSubPage();
    if (typeof resetUpdateTabViews === 'function') resetUpdateTabViews();

    if (settingsModalOverlay && settingsModal) {
        settingsModalOverlay.classList.add('active');
        settingsModal.classList.add('active');
        document.body.classList.add('settings-open');

        const navTab = document.querySelector(`.settings-nav-item[data-tab="${tabName}"]`);
        if (navTab) navTab.click();

        if (hadDrawer) {
            history.replaceState({ modal: 'settings' }, '', '#settings');
        } else {
            history.pushState({ modal: 'settings' }, '', '#settings');
        }
    }
};

window.closeSettingsModal = function (fromPopState = false) {
    if (typeof resetUpdateTabViews === 'function') resetUpdateTabViews();
    resetDisplaySettingsSubPage();
    resetUsefulSettingsSubPage();
    if (settingsModalOverlay && settingsModal) {
        settingsModalOverlay.classList.remove('active');
        settingsModal.classList.remove('active');
        settingsModal.classList.remove('update-tab-active');
        document.body.classList.remove('settings-open');
    }
    if (drawerOverlay) {
        drawerOverlay.classList.remove('active');
    }
    const sideDrawer = document.getElementById('sideDrawer');
    if (sideDrawer) {
        sideDrawer.classList.remove('drawer-hidden-by-settings');
        sideDrawer.classList.remove('active');
    }
    document.body.style.overflow = '';
    if (!fromPopState) {
        window._isProgrammaticBack = true;
        if (history.state && (history.state.modal === 'settings' || history.state.modal === 'drawer')) {
            history.back();
        }
        setTimeout(() => { window._isProgrammaticBack = false; }, 300);
    }
};

if (drawerSettingsBtn) {
    drawerSettingsBtn.addEventListener('click', () => window.openSettingsModal());
}
if (settingsModalCloseBtn) {
    settingsModalCloseBtn.addEventListener('click', () => window.closeSettingsModal());
}
if (settingsModalOverlay) {
    settingsModalOverlay.addEventListener('click', () => window.closeSettingsModal());
}

// --- 설정 창 탭 및 설정 관리 로직 ---
const settingsNavItems = document.querySelectorAll('.settings-nav-item');
const settingsTabContents = document.querySelectorAll('.settings-tab-content');

// 설정 서브 카테고리 (굿락 스타일) 전환 로직
const openTopButtonSettings = document.getElementById('openTopButtonSettings');
const backToUsefulCategoriesBtn = document.getElementById('backToUsefulCategoriesBtn');
const openCommentInputSettings = document.getElementById('openCommentInputSettings');
const backFromCommentInputBtn = document.getElementById('backFromCommentInputBtn');
const openTextSelectSettings = document.getElementById('openTextSelectSettings');
const backFromTextSelectBtn = document.getElementById('backFromTextSelectBtn');
const openDarkModeSettings = document.getElementById('openDarkModeSettings');
const backToDisplayCategoriesBtn = document.getElementById('backToDisplayCategoriesBtn');
const darkModeSettingToggle = document.getElementById('darkModeSettingToggle');
const openSettingsSync = document.getElementById('openSettingsSync');
const backFromSettingsSyncBtn = document.getElementById('backFromSettingsSyncBtn');
const settingsSyncToggle = document.getElementById('settingsSyncToggle');
const resetAllSettingsBtn = document.getElementById('resetAllSettingsBtn');

const usefulCategoryList = document.getElementById('usefulCategoryList');
const topButtonSettingsSubPage = document.getElementById('topButtonSettingsSubPage');
const commentInputSettingsSubPage = document.getElementById('commentInputSettingsSubPage');
const textSelectSettingsSubPage = document.getElementById('textSelectSettingsSubPage');
const displayCategoryList = document.getElementById('displayCategoryList');
const darkModeSettingsSubPage = document.getElementById('darkModeSettingsSubPage');
const settingsSyncSubPage = document.getElementById('settingsSyncSubPage');

window.isUsefulSubPageOpen = false;
window.currentSubPageId = null;

window.openUsefulSubPage = function (subPageId) {
    if (!usefulCategoryList) return;
    window.isUsefulSubPageOpen = true;
    window.currentSubPageId = subPageId;

    usefulCategoryList.style.display = 'none';
    const targetSubPage = document.getElementById(subPageId);
    if (targetSubPage) {
        targetSubPage.style.display = 'block';
        targetSubPage.classList.remove('sub-page-exit');
        targetSubPage.classList.add('sub-page-enter');
    }
    if (typeof updateCommentInputToggleUI === 'function') {
        updateCommentInputToggleUI();
    }

    // 히스토리에 서브페이지 상태 추가 (뒤로가기 지원)
    history.pushState({ modal: 'settings', subPage: subPageId }, '');
};

window.closeUsefulSubPage = function (fromPopState = false) {
    if (!usefulCategoryList || !window.isUsefulSubPageOpen) return;
    const activeSubPage = window.currentSubPageId ? document.getElementById(window.currentSubPageId) : null;
    window.isUsefulSubPageOpen = false;
    const closedSubPageId = window.currentSubPageId;
    window.currentSubPageId = null;

    if (activeSubPage) {
        activeSubPage.classList.remove('sub-page-enter');
        activeSubPage.classList.add('sub-page-exit');
    }

    setTimeout(() => {
        if (activeSubPage) {
            activeSubPage.style.display = 'none';
            activeSubPage.classList.remove('sub-page-exit');
        }

        usefulCategoryList.style.display = 'flex';
        usefulCategoryList.classList.remove('category-list-enter');
        void usefulCategoryList.offsetWidth; // 강제 리플로우
        usefulCategoryList.classList.add('category-list-enter');
    }, 200);

    if (!fromPopState && history.state && history.state.subPage === closedSubPageId) {
        window._isProgrammaticBack = true;
        history.back();
        setTimeout(() => { window._isProgrammaticBack = false; }, 50);
    }
};

window.resetUsefulSettingsSubPage = function () {
    window.isUsefulSubPageOpen = false;
    window.currentSubPageId = null;
    if (usefulCategoryList) {
        usefulCategoryList.style.display = 'flex';
        usefulCategoryList.classList.remove('category-list-enter');
    }
    if (topButtonSettingsSubPage) {
        topButtonSettingsSubPage.style.display = 'none';
        topButtonSettingsSubPage.classList.remove('sub-page-enter', 'sub-page-exit');
    }
    if (commentInputSettingsSubPage) {
        commentInputSettingsSubPage.style.display = 'none';
        commentInputSettingsSubPage.classList.remove('sub-page-enter', 'sub-page-exit');
    }
    if (textSelectSettingsSubPage) {
        textSelectSettingsSubPage.style.display = 'none';
        textSelectSettingsSubPage.classList.remove('sub-page-enter', 'sub-page-exit');
    }
    if (settingsSyncSubPage) {
        settingsSyncSubPage.style.display = 'none';
        settingsSyncSubPage.classList.remove('sub-page-enter', 'sub-page-exit');
    }
};

window.isDisplaySubPageOpen = false;
window.currentDisplaySubPage = null;

window.openDisplaySubPage = function (subPage, subPageId = 'darkModeSettingsSubPage') {
    if (!displayCategoryList || !subPage) return;
    window.isDisplaySubPageOpen = true;
    window.currentDisplaySubPage = subPage;

    displayCategoryList.style.display = 'none';
    subPage.style.display = 'block';
    subPage.classList.remove('sub-page-exit');
    subPage.classList.add('sub-page-enter');

    history.pushState({ modal: 'settings', subPage: subPageId }, '');
};

window.closeDisplaySubPage = function (subPage, fromPopState = false) {
    const targetSubPage = subPage || window.currentDisplaySubPage;
    if (!displayCategoryList || !targetSubPage || !window.isDisplaySubPageOpen) return;
    window.isDisplaySubPageOpen = false;
    window.currentDisplaySubPage = null;

    targetSubPage.classList.remove('sub-page-enter');
    targetSubPage.classList.add('sub-page-exit');

    setTimeout(() => {
        targetSubPage.style.display = 'none';
        targetSubPage.classList.remove('sub-page-exit');
        displayCategoryList.style.display = 'flex';
        displayCategoryList.classList.remove('category-list-enter');
        void displayCategoryList.offsetWidth;
        displayCategoryList.classList.add('category-list-enter');
    }, 200);

    if (!fromPopState && history.state && history.state.subPage) {
        window._isProgrammaticBack = true;
        history.back();
        setTimeout(() => { window._isProgrammaticBack = false; }, 50);
    }
};

window.resetDisplaySettingsSubPage = function () {
    window.isDisplaySubPageOpen = false;
    window.currentDisplaySubPage = null;
    if (displayCategoryList) {
        displayCategoryList.style.display = 'flex';
        displayCategoryList.classList.remove('category-list-enter');
    }
    if (darkModeSettingsSubPage) {
        darkModeSettingsSubPage.style.display = 'none';
        darkModeSettingsSubPage.classList.remove('sub-page-enter', 'sub-page-exit');
    }
};

if (openTopButtonSettings) {
    openTopButtonSettings.addEventListener('click', () => window.openUsefulSubPage('topButtonSettingsSubPage'));
}
if (backToUsefulCategoriesBtn) {
    backToUsefulCategoriesBtn.addEventListener('click', () => window.closeUsefulSubPage(false));
}
if (openCommentInputSettings) {
    openCommentInputSettings.addEventListener('click', () => window.openUsefulSubPage('commentInputSettingsSubPage'));
}
if (backFromCommentInputBtn) {
    backFromCommentInputBtn.addEventListener('click', () => window.closeUsefulSubPage(false));
}
if (openTextSelectSettings) {
    openTextSelectSettings.addEventListener('click', () => window.openUsefulSubPage('textSelectSettingsSubPage'));
}
if (backFromTextSelectBtn) {
    backFromTextSelectBtn.addEventListener('click', () => window.closeUsefulSubPage(false));
}
if (openDarkModeSettings) {
    openDarkModeSettings.addEventListener('click', () => window.openDisplaySubPage(darkModeSettingsSubPage));
}
if (backToDisplayCategoriesBtn) {
    backToDisplayCategoriesBtn.addEventListener('click', () => window.closeDisplaySubPage(darkModeSettingsSubPage, false));
}
if (darkModeSettingToggle) {
    darkModeSettingToggle.checked = getSiteTheme() === 'dark';
    darkModeSettingToggle.addEventListener('change', (event) => {
        setSiteTheme(event.target.checked ? 'dark' : 'light');
    });
}
if (openSettingsSync) {
    openSettingsSync.addEventListener('click', () => window.openUsefulSubPage('settingsSyncSubPage'));
}
if (backFromSettingsSyncBtn) {
    backFromSettingsSyncBtn.addEventListener('click', () => window.closeUsefulSubPage(false));
}
if (settingsSyncToggle) {
    settingsSyncToggle.checked = ACCOUNT_SETTINGS_DEFAULTS.settingsSyncEnabled;
    settingsSyncToggle.addEventListener('change', (event) => {
        setSettingsSyncEnabled(event.target.checked);
    });
}

if (settingsNavItems.length > 0) {
    settingsNavItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');

            settingsNavItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            if (settingsModal) {
                settingsModal.classList.toggle('update-tab-active', targetTab === 'update');
            }

            settingsTabContents.forEach(content => {
                if (content.id === `settingsTab-${targetTab}`) {
                    content.style.display = 'flex';
                } else {
                    content.style.display = 'none';
                }
            });

            // 탭을 전환할 때 서브페이지를 메인 카드 목록으로 초기화
            resetUsefulSettingsSubPage();
            resetDisplaySettingsSubPage();
            if (typeof resetUpdateTabViews === 'function') resetUpdateTabViews();
        });
    });
}

// 사이트 업데이트 정보: 다음 배포 시 이 값만 변경합니다.
const SITE_UPDATE_INFO = Object.freeze({
    oneUiVersion: 'One UI 1.0',
    buildNumber: '20260811.1',
    message: '우리 동아리 사이트의 첫 버전인 One UI 1.0입니다!'
});

const checkUpdateBtn = document.getElementById('checkUpdateBtn');
const openUpdateDetailsBtn = document.getElementById('openUpdateDetailsBtn');
const updateMainBackBtn = document.getElementById('updateMainBackBtn');
const updateMainView = document.getElementById('updateMainView');
const updateDetailsView = document.getElementById('updateDetailsView');
const closeUpdateDetailsInPageBtn = document.getElementById('closeUpdateDetailsInPageBtn');
const closeUpdateDetailsTopBtn = document.getElementById('closeUpdateDetailsTopBtn');

document.querySelectorAll('[data-current-one-ui-version]').forEach((element) => {
    if (element.tagName === 'svg' || element.tagName === 'SVG') {
        const versionNum = SITE_UPDATE_INFO.oneUiVersion.replace('One UI ', '');
        element.setAttribute('aria-label', SITE_UPDATE_INFO.oneUiVersion);
        const textEl = element.querySelector('.one-ui-version-number');
        if (textEl) textEl.textContent = versionNum;
    } else {
        element.textContent = SITE_UPDATE_INFO.oneUiVersion;
    }
});

document.querySelectorAll('[data-current-build-number]').forEach((element) => {
    element.textContent = `Build ${SITE_UPDATE_INFO.buildNumber}`;
});

document.querySelectorAll('[data-current-update-message]').forEach((element) => {
    element.textContent = SITE_UPDATE_INFO.message;
});

// 업데이트 서브 상태 Tracing ('pill' | 'details' | null)
window.updateSubState = null;

// "업데이트 내용 확인" 버튼 클릭 시 -> 알약 버튼과 메인 상단 "← 돌아가기" 버튼 표시
if (checkUpdateBtn && openUpdateDetailsBtn) {
    checkUpdateBtn.addEventListener('click', function () {
        if (checkUpdateBtn.classList.contains('hiding')) return;
        checkUpdateBtn.classList.add('hiding');

        window.updateSubState = 'pill';
        history.pushState({ modal: 'settings', updateSubState: 'pill' }, '');

        setTimeout(() => {
            checkUpdateBtn.style.display = 'none';
            checkUpdateBtn.classList.remove('hiding');

            openUpdateDetailsBtn.style.display = 'flex';
            openUpdateDetailsBtn.classList.add('showing');

            if (updateMainBackBtn) {
                updateMainBackBtn.style.display = 'inline-flex';
                updateMainBackBtn.classList.remove('hiding', 'showing');
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        updateMainBackBtn.classList.add('showing');
                    });
                });
            }
        }, 200);
    });
}

// 알약 상태에서 "← 돌아가기" 버튼 클릭 또는 뒤로가기 조작시 -> 다시 "업데이트 내용 확인" 버튼 상태로 복귀
window.resetUpdateCheckState = function (fromPopState = false) {
    window.updateSubState = null;

    if (openUpdateDetailsBtn) {
        openUpdateDetailsBtn.classList.remove('showing');
        openUpdateDetailsBtn.classList.add('hiding');
    }
    if (updateMainBackBtn) {
        updateMainBackBtn.classList.remove('showing');
        updateMainBackBtn.classList.add('hiding');
    }
    setTimeout(() => {
        if (openUpdateDetailsBtn) {
            openUpdateDetailsBtn.style.display = 'none';
            openUpdateDetailsBtn.classList.remove('hiding');
        }
        if (updateMainBackBtn) {
            updateMainBackBtn.style.display = 'none';
            updateMainBackBtn.classList.remove('hiding');
        }
        if (checkUpdateBtn) {
            checkUpdateBtn.style.display = '';
            checkUpdateBtn.classList.remove('hiding', 'showing');
            requestAnimationFrame(() => {
                checkUpdateBtn.classList.add('showing');
                setTimeout(() => {
                    checkUpdateBtn.classList.remove('showing');
                }, 300);
            });
        }
    }, 200);

    if (!fromPopState && history.state && history.state.updateSubState === 'pill') {
        window._isProgrammaticBack = true;
        history.back();
        setTimeout(() => { window._isProgrammaticBack = false; }, 50);
    }
};

if (updateMainBackBtn) {
    updateMainBackBtn.addEventListener('click', function () {
        window.resetUpdateCheckState(false);
    });
}

// "[현재 버전] One UI 1.0 >" 알약 버튼 클릭시 상세 업데이트 내역 화면으로 진입
window.showInPageUpdateDetails = function () {
    window.updateSubState = 'details';
    history.pushState({ modal: 'settings', updateSubState: 'details' }, '');

    if (updateMainView) updateMainView.classList.remove('active');
    if (updateDetailsView) updateDetailsView.classList.add('active');
};

// 상세 화면에서 "← 돌아가기" 버튼 클릭 시 -> 알약 상태가 보이는 메인 화면으로 복귀
window.hideInPageUpdateDetails = function (fromPopState = false) {
    window.updateSubState = 'pill';

    if (updateDetailsView) updateDetailsView.classList.remove('active');
    if (updateMainView) updateMainView.classList.add('active');
    if (openUpdateDetailsBtn) {
        openUpdateDetailsBtn.style.display = 'flex';
    }
    if (updateMainBackBtn) {
        updateMainBackBtn.style.display = 'inline-flex';
        updateMainBackBtn.classList.remove('hiding', 'showing');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                updateMainBackBtn.classList.add('showing');
            });
        });
    }
    if (checkUpdateBtn) {
        checkUpdateBtn.style.display = 'none';
    }

    if (!fromPopState && history.state && history.state.updateSubState === 'details') {
        window._isProgrammaticBack = true;
        history.back();
        setTimeout(() => { window._isProgrammaticBack = false; }, 50);
    }
};

window.resetUpdateTabViews = function () {
    window.updateSubState = null;
    if (updateDetailsView) updateDetailsView.classList.remove('active');
    if (updateMainView) updateMainView.classList.add('active');
    if (checkUpdateBtn) {
        checkUpdateBtn.style.display = '';
        checkUpdateBtn.classList.remove('hiding', 'showing');
    }
    if (openUpdateDetailsBtn) {
        openUpdateDetailsBtn.style.display = 'none';
        openUpdateDetailsBtn.classList.remove('showing', 'hiding');
    }
    if (updateMainBackBtn) {
        updateMainBackBtn.style.display = 'none';
        updateMainBackBtn.classList.remove('showing', 'hiding');
    }
};

if (openUpdateDetailsBtn) {
    openUpdateDetailsBtn.addEventListener('click', window.showInPageUpdateDetails);
}

if (closeUpdateDetailsInPageBtn) {
    closeUpdateDetailsInPageBtn.addEventListener('click', window.hideInPageUpdateDetails);
}

if (closeUpdateDetailsTopBtn) {
    closeUpdateDetailsTopBtn.addEventListener('click', window.hideInPageUpdateDetails);
}

const logoDisplayDropdown = document.getElementById('logoDisplayDropdown');
const logoDisplaySelected = document.getElementById('logoDisplaySelected');
const logoDisplayOptions = document.getElementById('logoDisplayOptions');
const logoDisplayOptionItems = document.querySelectorAll('#logoDisplayOptions .custom-dropdown-option');
const logoPreview = document.getElementById('logoPreview');

function applyLogoDisplaySettings(settingValue) {
    const applyToElement = (el) => {
        if (!el) return;
        const wasHidden = el.classList.contains('hidden');

        if (settingValue === 'hidden') {
            // 완전히 숨기기: 현재 모양을 유지한 채로 투명도만 0이 되도록 hidden만 추가
            el.classList.add('hidden');
        } else {
            if (wasHidden) {
                // 숨기기에서 돌아올 때: 페이드 인 되기 전에 모양(너비 등)을 즉시 변경
                el.classList.add('no-transition');
                if (settingValue === 'icon-only') el.classList.add('icon-only');
                else el.classList.remove('icon-only');

                // 강제 리플로우 (트랜지션 없이 즉시 적용되도록)
                void el.offsetWidth;

                el.classList.remove('no-transition');
                el.classList.remove('hidden'); // 이제 페이드 인
            } else {
                // 기본 <-> 아이콘 간의 전환: 정상적으로 트랜지션 됨
                el.classList.remove('hidden');
                if (settingValue === 'icon-only') el.classList.add('icon-only');
                else el.classList.remove('icon-only');
            }
        }
    };

    applyToElement(logoHomeBtn);
    applyToElement(logoPreview);
    // Update custom dropdown UI
    if (logoDisplaySelected && logoDisplayOptions) {
        const optionToSelect = document.querySelector(`#logoDisplayOptions .custom-dropdown-option[data-value="${settingValue}"]`);
        if (optionToSelect) {
            const textHTML = optionToSelect.innerHTML;
            document.querySelectorAll('#logoDisplayOptions .custom-dropdown-option').forEach(opt => opt.classList.remove('active'));
            optionToSelect.classList.add('active');
            logoDisplaySelected.innerHTML = `<span>${textHTML}</span> <i class="fa-solid fa-chevron-down arrow-icon"></i>`;
        }
    }
}

applyLogoDisplaySettings(ACCOUNT_SETTINGS_DEFAULTS.logoDisplayStyle);

if (logoDisplaySelected && logoDisplayOptions) {
    logoDisplaySelected.addEventListener('click', (e) => {
        e.stopPropagation();
        logoDisplayDropdown.classList.toggle('open');
    });

    logoDisplayOptionItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const value = item.getAttribute('data-value');
            applyLogoDisplaySettings(value);
            saveAccountSettings({ logoDisplayStyle: value });
            logoDisplayDropdown.classList.remove('open');
        });
    });

    document.addEventListener('click', (e) => {
        if (logoDisplayDropdown && !logoDisplayDropdown.contains(e.target)) {
            logoDisplayDropdown.classList.remove('open');
        }
    });
}

if (drawerSettingsBtn) {
    drawerSettingsBtn.addEventListener('click', () => {
        openSettingsModal();
    });
}
if (settingsModalCloseBtn) {
    settingsModalCloseBtn.addEventListener('click', () => {
        window.closeSettingsModal(false);
    });
}
if (settingsModalOverlay) {
    settingsModalOverlay.addEventListener('click', () => {
        window.closeSettingsModal(false);
    });
}

// 스크롤 시 상단 버튼 숨김/표시 (One UI 스타일)
let _lastScrollY = window.scrollY;
let _isScrollingDown = false;
let _isTopButtonsHidden = false;
let _scrollStopTimer = null;
let _isScrollHideEnabled = ACCOUNT_SETTINGS_DEFAULTS.scrollHide;

const _logoHomeBtn = document.getElementById('logoHomeBtn');
const _headerActions = document.querySelector('.header-actions');
const _writePostBtnGlob = document.getElementById('writePostBtn');

const scrollHideToggle = document.getElementById('scrollHideToggle');
if (scrollHideToggle) {
    scrollHideToggle.checked = _isScrollHideEnabled;
    scrollHideToggle.addEventListener('change', (e) => {
        setScrollHideEnabled(e.target.checked);
    });
}

function setScrollHideEnabled(enabled, save = true) {
    _isScrollHideEnabled = Boolean(enabled);
    if (scrollHideToggle) scrollHideToggle.checked = _isScrollHideEnabled;
    if (!_isScrollHideEnabled) _showTopButtons();
    if (save) saveAccountSettings({ scrollHide: _isScrollHideEnabled });
}

function _hideTopButtons() {
    if (!_isTopButtonsHidden) {
        if (_logoHomeBtn) {
            _logoHomeBtn.style.opacity = '0';
            _logoHomeBtn.style.pointerEvents = 'none';
        }
        if (_headerActions) {
            _headerActions.style.opacity = '0';
            _headerActions.style.pointerEvents = 'none';
        }
        if (_writePostBtnGlob) {
            _writePostBtnGlob.style.opacity = '0';
            _writePostBtnGlob.style.pointerEvents = 'none';
        }
                _isTopButtonsHidden = true;
    }
}

function _showTopButtons() {
    const sideDetail = document.getElementById('sideDetailContainer');
    const isDetailOpen = document.body.classList.contains('detail-open') ||
        (sideDetail && !sideDetail.classList.contains('detail-hidden'));

    // 모바일 게시물 상세 페이지 내부에서는 상단 로고/헤더 액션 버튼을 절대로 표시하지 않음
    if (isDetailOpen && window.innerWidth <= 1023) return;

    if (_logoHomeBtn) {
        _logoHomeBtn.style.opacity = '1';
        _logoHomeBtn.style.pointerEvents = 'auto';
        _logoHomeBtn.style.visibility = 'visible';
    }
    if (_headerActions) {
        _headerActions.style.opacity = '1';
        _headerActions.style.pointerEvents = 'auto';
        _headerActions.style.visibility = 'visible';
    }
    if (_writePostBtnGlob) {
        if (typeof updateWriteButtonVisibility === 'function') {
            updateWriteButtonVisibility(currentPage);
        } else {
            _writePostBtnGlob.style.opacity = '1';
            _writePostBtnGlob.style.pointerEvents = 'auto';
            _writePostBtnGlob.style.visibility = 'visible';
            _writePostBtnGlob.classList.remove('fab-hidden');
        }
    }
        _isTopButtonsHidden = false;
}

// --- 댓글 스크롤 시 입력창 자동 숨김 로직 (기본값: true / on) ---
let _isCommentInputScrollHideEnabled = ACCOUNT_SETTINGS_DEFAULTS.commentInputScrollHide;
let _isCommentInputHidden = false;
let _commentScrollStopTimer = null;
let _lastCommentScrollY = 0;

function updateCommentInputToggleUI() {
    const toggle = document.getElementById('commentInputScrollHideToggle');
    if (toggle) {
        toggle.checked = _isCommentInputScrollHideEnabled;
    }
}

// 이벤트 위임을 통해 토글 상태 변경 즉시 반영
document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'commentInputScrollHideToggle') {
        setCommentInputScrollHideEnabled(e.target.checked);
    }
});

function setCommentInputScrollHideEnabled(enabled, save = true) {
    _isCommentInputScrollHideEnabled = Boolean(enabled);
    updateCommentInputToggleUI();
    if (!_isCommentInputScrollHideEnabled) _showCommentInput();
    if (save) saveAccountSettings({ commentInputScrollHide: _isCommentInputScrollHideEnabled });
}

function _hideCommentInput() {
    const container = document.getElementById('commentInputContainer');
    const area = document.querySelector('.comment-input-area');
    const targetEl = container || area;

    if (targetEl && !_isCommentInputHidden) {
        targetEl.style.transition = 'opacity 0.35s ease';
        targetEl.style.opacity = '0';
        targetEl.style.pointerEvents = 'none';
        _isCommentInputHidden = true;
    }
}

function _showCommentInput() {
    const container = document.getElementById('commentInputContainer');
    const area = document.querySelector('.comment-input-area');
    const targetEl = container || area;

    if (targetEl && _isCommentInputHidden) {
        targetEl.style.transition = 'opacity 0.35s ease';
        targetEl.style.opacity = '';
        targetEl.style.pointerEvents = '';
        _isCommentInputHidden = false;
    }
}

window.addEventListener('scroll', (e) => {
    const target = e.target === document ? document.documentElement : e.target;

    // 상세 보기 모달 창이 열려 있는 상태에서의 댓글 스크롤 감지 (상단 버튼 스크롤과 동일 형식)
    const sideDetailContainer = document.getElementById('sideDetailContainer');
    const isDetailOpen = document.body.classList.contains('detail-open') ||
        (sideDetailContainer && !sideDetailContainer.classList.contains('detail-hidden'));

    if (isDetailOpen && _isCommentInputScrollHideEnabled) {
        const currentCommentScrollY = target.scrollTop || 0;
        const deltaCommentY = currentCommentScrollY - _lastCommentScrollY;

        if (currentCommentScrollY <= 30) {
            _showCommentInput();
        } else if (deltaCommentY > 5) {
            _hideCommentInput();
        } else if (deltaCommentY < -5) {
            _showCommentInput();
        }

        _lastCommentScrollY = currentCommentScrollY;

        if (_commentScrollStopTimer) clearTimeout(_commentScrollStopTimer);
        _commentScrollStopTimer = setTimeout(() => {
            _showCommentInput();
        }, 300);
    }

    // 페이지 스크롤이 아니면 무시 (드롭다운 등 다른 내부 스크롤 방지)
    if (target !== document.documentElement && (!target.classList || !target.classList.contains('page'))) {
        return;
    }

    if (!_isScrollHideEnabled) return;
    const currentScrollY = target.scrollTop || window.scrollY;
    const deltaY = currentScrollY - _lastScrollY;

    if (currentScrollY <= 50) {
        _showTopButtons();
    } else if (deltaY > 5) {
        _hideTopButtons();
    } else if (deltaY < -5) {
        _showTopButtons();
    }

    _lastScrollY = currentScrollY;

    if (_scrollStopTimer) clearTimeout(_scrollStopTimer);
    _scrollStopTimer = setTimeout(() => {
        _showTopButtons();
    }, 300);
}, { capture: true, passive: true });



// --- 텍스트 선택 방지 로직 (기본값: true / 켜짐) ---
let _isTextSelectPreventEnabled = ACCOUNT_SETTINGS_DEFAULTS.textSelectPrevent;

function updateTextSelectToggleUI() {
    const quickToggle = document.getElementById('textSelectPreventQuickToggle');
    const subToggle = document.getElementById('textSelectPreventToggle');
    if (quickToggle) quickToggle.checked = _isTextSelectPreventEnabled;
    if (subToggle) subToggle.checked = _isTextSelectPreventEnabled;

    if (_isTextSelectPreventEnabled) {
        document.body.classList.add('no-text-select');
    } else {
        document.body.classList.remove('no-text-select');
    }
}

// 초기 반영
updateTextSelectToggleUI();

document.addEventListener('change', (e) => {
    if (e.target && (e.target.id === 'textSelectPreventQuickToggle' || e.target.id === 'textSelectPreventToggle')) {
        setTextSelectPreventEnabled(e.target.checked);
    }
});

function setTextSelectPreventEnabled(enabled, save = true) {
    _isTextSelectPreventEnabled = Boolean(enabled);
    updateTextSelectToggleUI();
    if (save) saveAccountSettings({ textSelectPrevent: _isTextSelectPreventEnabled });
}

async function resetAllAccountSettings() {
    const confirmed = typeof window.customConfirm === 'function'
        ? await window.customConfirm('모든 설정을 기본값으로 되돌릴까요?\nAI 채팅은 삭제되지 않습니다.', '설정 초기화')
        : window.confirm('모든 설정을 기본값으로 되돌릴까요?\nAI 채팅은 삭제되지 않습니다.');
    if (!confirmed) return;

    const userId = activeAccountUserId;
    isLoadingAccountSettings = true;
    accountSettings = { ...ACCOUNT_SETTINGS_DEFAULTS };
    applyAccountSettings();
    if (userId) saveDeviceAccountSettings(userId, accountSettings);

    try {
        if (userId) {
            await db.collection('users').doc(userId).collection('private').doc('settings').set({
                ...ACCOUNT_SETTINGS_DEFAULTS,
                updatedAt: Date.now()
            }, { merge: true });
        }
    } catch (error) {
        console.error('설정 초기화 오류:', error);
        if (typeof window.customAlert === 'function') {
            await window.customAlert('설정을 초기화하지 못했습니다. 잠시 후 다시 시도해 주세요.', '설정 초기화');
        } else {
            alert('설정을 초기화하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }
    } finally {
        isLoadingAccountSettings = false;
    }
}

if (resetAllSettingsBtn) {
    resetAllSettingsBtn.addEventListener('click', () => {
        void resetAllAccountSettings();
    });
}

// '기본 설정 보기' details 부드러운 Fade In / Fade Out 애니메이션
document.addEventListener('click', (e) => {
    const summary = e.target.closest('.settings-defaults-details summary');
    if (!summary) return;
    const details = summary.closest('details');
    if (!details) return;

    if (details.open) {
        e.preventDefault();
        if (details.classList.contains('closing')) return;
        details.classList.add('closing');
        setTimeout(() => {
            details.removeAttribute('open');
            details.classList.remove('closing');
        }, 190);
    }
});
