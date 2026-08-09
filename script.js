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

// 저장된 테마 불러오기 (기본값 dark)
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
    rootElement.setAttribute('data-theme', 'light');
}

themeToggleBtn.addEventListener('click', () => {
    if (rootElement.getAttribute('data-theme') === 'light') {
        rootElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'dark');
    } else {
        rootElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
    }
});

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
    sideDrawer.classList.add('active');
    drawerOverlay.classList.add('active');
}

function closeDrawer(e) {
    const fromPopState = (e === true);
    document.body.style.overflow = '';
    sideDrawer.classList.remove('active');
    drawerOverlay.classList.remove('active');
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

function switchPage(fromPage, toPage, skipHistory = false, replaceState = false) {
    if (typeof fromPage === 'string') fromPage = document.getElementById(fromPage) || currentPage;
    if (typeof toPage === 'string') toPage = document.getElementById(toPage);
    if (!fromPage || !toPage) return;
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
    const aiFab = document.getElementById('aiChatbotFab');
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
        if (aiFab) aiFab.classList.add('shift-left');
    } else {
        btn.classList.add('fab-hidden');
        btn.style.opacity = '0';
        btn.style.pointerEvents = 'none';
        btn.style.visibility = 'hidden';
        btn.style.transform = 'scale(0.6)';
        if (aiFab) aiFab.classList.remove('shift-left');
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
// 관리자 모드 이스터에그 로직 추가
// ==========================================
const adminTriggerIcon = document.getElementById('adminTriggerIcon');
const adminModalOverlay = document.getElementById('adminModalOverlay');
const adminModal = document.getElementById('adminModal');
const adminPwdInput = document.getElementById('adminPwdInput');
const adminModalCancel = document.getElementById('adminModalCancel');
const adminModalConfirm = document.getElementById('adminModalConfirm');
const adminCategory = document.getElementById('adminCategory');
const adminDeactivateModal = document.getElementById('adminDeactivateModal');
const adminDeactivateCancel = document.getElementById('adminDeactivateCancel');
const adminDeactivateConfirm = document.getElementById('adminDeactivateConfirm');

const adminNavTab = document.getElementById('adminNavTab');
function updateAdminNavTab() {
    if (adminNavTab) {
        if (localStorage.getItem('isAdminUnlocked') === 'true') {
            adminNavTab.style.display = 'inline-flex';
        } else {
            adminNavTab.style.display = 'none';
        }
    }
}
updateAdminNavTab();

// 새로고침해도 관리자 모드 유지
if (localStorage.getItem('isAdminUnlocked') === 'true') {
    adminCategory.style.display = 'block';
}

let adminClickCount = 0;
let adminLastClickTime = 0;

adminTriggerIcon.addEventListener('click', (e) => {
    const currentTime = new Date().getTime();
    if (currentTime - adminLastClickTime > 5000) {
        adminClickCount = 0;
    }
    adminClickCount++;
    adminLastClickTime = currentTime;

    if (adminClickCount >= 5) {
        adminClickCount = 0;
        if (localStorage.getItem('isAdminUnlocked') === 'true') {
            history.pushState({ modal: 'adminDeactivate' }, '', '');
            adminModalOverlay.classList.add('active');
            adminDeactivateModal.classList.add('active');
        } else {
            history.pushState({ modal: 'adminAuth' }, '', '');
            adminModalOverlay.classList.add('active');
            adminModal.classList.add('active');
            adminPwdInput.value = '';
            setTimeout(() => adminPwdInput.focus(), 300);
        }
    }
});

window.closeAdminModal = function (fromPopState = false) {
    adminModalOverlay.classList.remove('active');
    adminModal.classList.remove('active');
    if (!fromPopState && history.state && history.state.modal === 'adminAuth') {
        window._isProgrammaticBack = true;
        history.back();
    }
};
adminModalCancel.addEventListener('click', () => window.closeAdminModal(false));

window.closeAdminDeactivateModal = function (fromPopState = false) {
    adminModalOverlay.classList.remove('active');
    adminDeactivateModal.classList.remove('active');
    if (!fromPopState && history.state && history.state.modal === 'adminDeactivate') {
        window._isProgrammaticBack = true;
        history.back();
    }
};
adminDeactivateCancel.addEventListener('click', () => window.closeAdminDeactivateModal(false));

adminDeactivateConfirm.addEventListener('click', () => {
    localStorage.removeItem('isAdminUnlocked');
    adminCategory.classList.remove('category-fade-in');
    adminCategory.classList.add('category-fade-out');
    setTimeout(() => {
        adminCategory.style.display = 'none';
        adminCategory.classList.remove('category-fade-out');
    }, 400);
    window.closeAdminDeactivateModal(false);
});

function checkAdminPassword() {
    if (adminPwdInput.value === '110420') {
        localStorage.setItem('isAdminUnlocked', 'true');
        adminCategory.style.display = 'block';
        window.closeAdminModal(false);
        adminCategory.classList.remove('category-fade-out');
        adminCategory.classList.add('category-fade-in');

        const drawer = document.getElementById('sideDrawer');
        drawer.scrollTo({
            top: drawer.scrollHeight,
            behavior: 'smooth'
        });
    } else {
        adminModal.classList.add('shake-animation');
        adminPwdInput.value = '';
        adminPwdInput.focus();
        setTimeout(() => {
            adminModal.classList.remove('shake-animation');
        }, 400);
    }
}

adminModalConfirm.addEventListener('click', checkAdminPassword);
adminPwdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        checkAdminPassword();
    }
});

// ==========================================
// AI 설정 및 챗봇 연동 로직
// ==========================================
window.aiConfig = {
    apiKey: '',
    model: 'gemini-3.6-flash',
    enabled: false,
    chatbotEnabled: false,
    summaryEnabled: false
};

const aiSettingsMenuBtn = document.getElementById('aiSettingsMenuBtn');
const aiSettingsPage = document.getElementById('aiSettingsPage');
const aiSettingsBackBtn = document.getElementById('aiSettingsBackBtn');
const aiApiKeyInput = document.getElementById('aiApiKeyInput');
const aiModelSelect = document.getElementById('aiModelSelect');
const toggleApiKeyVisibility = document.getElementById('toggleApiKeyVisibility');
const aiEnabledCheckbox = document.getElementById('aiEnabledCheckbox');
const aiChatbotEnabledCheckbox = document.getElementById('aiChatbotEnabledCheckbox');
const aiSummaryEnabledCheckbox = document.getElementById('aiSummaryEnabledCheckbox');
const aiSaveBtn = document.getElementById('aiSaveBtn');
const aiTestBtn = document.getElementById('aiTestBtn');
const aiTestResult = document.getElementById('aiTestResult');

const aiChatbotFab = document.getElementById('aiChatbotFab');
const aiChatbotWindow = document.getElementById('aiChatbotWindow');
const aiChatbotMessages = document.getElementById('aiChatbotMessages');
const aiChatbotInput = document.getElementById('aiChatbotInput');
const aiChatbotSendBtn = document.getElementById('aiChatbotSendBtn');
const closeAiChatbot = document.getElementById('closeAiChatbot');

const aiModelDropdownContainer = document.getElementById('aiModelDropdownContainer');
const aiModelSelected = document.getElementById('aiModelSelected');
const aiModelOptions = document.getElementById('aiModelOptions');
const aiModelOptionItems = document.querySelectorAll('#aiModelOptions .custom-dropdown-option');

function updateAiModelSelectedDisplay(title, animate = true) {
    const aiModelSelected = document.getElementById('aiModelSelected');
    if (!aiModelSelected) return;
    const selectedHTML = `<img src="gemini-color.svg" style="width: 18px; height: 18px; vertical-align: middle; object-fit: contain; margin-right: 6px;" alt="Gemini"> ${title}`;

    let textSpan = aiModelSelected.querySelector('#aiModelSelectedText');
    if (!textSpan) {
        aiModelSelected.innerHTML = `<span id="aiModelSelectedText">${selectedHTML}</span> <i class="fa-solid fa-chevron-down arrow-icon"></i>`;
        textSpan = aiModelSelected.querySelector('#aiModelSelectedText');
    } else {
        textSpan.innerHTML = selectedHTML;
    }

    if (animate && textSpan) {
        textSpan.classList.remove('text-change-anim');
        void textSpan.offsetWidth;
        textSpan.classList.add('text-change-anim');
    }
}

if (aiModelSelected && aiModelOptions) {
    aiModelSelected.addEventListener('click', (e) => {
        e.stopPropagation();
        aiModelDropdownContainer.classList.toggle('open');
    });

    aiModelOptionItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const value = item.getAttribute('data-value');
            const title = item.getAttribute('data-title') || item.querySelector('.model-title')?.textContent || 'Gemini 3.6 Flash';

            aiModelOptionItems.forEach(opt => opt.classList.remove('active'));
            item.classList.add('active');

            updateAiModelSelectedDisplay(title, true);
            aiModelDropdownContainer.classList.remove('open');

            if (aiModelSelect) aiModelSelect.value = value;
            if (window.aiConfig) window.aiConfig.model = value;
        });
    });

    document.addEventListener('click', (e) => {
        if (aiModelDropdownContainer && !aiModelDropdownContainer.contains(e.target)) {
            aiModelDropdownContainer.classList.remove('open');
        }
    });
}

// Firestore에서 AI 설정 로드하는 함수
async function loadAiConfig() {
    try {
        const doc = await db.collection('settings').doc('ai_config').get();
        if (doc.exists) {
            const data = doc.data();
            let modelValue = data.model || 'gemini-3.6-flash';
            if (modelValue === 'gemini-3.1-flash-lite' || modelValue === 'gemini-3.5-flash' || modelValue === 'gemini-3.1-pro-preview') {
                modelValue = 'gemini-3.5-flash-lite';
            }
            const allowedModels = ['gemini-3.6-flash', 'gemini-3.5-flash-lite'];
            if (!allowedModels.includes(modelValue)) {
                modelValue = 'gemini-3.6-flash';
            }
            window.aiConfig = {
                apiKey: data.apiKey || '',
                model: modelValue,
                enabled: data.enabled || false,
                chatbotEnabled: data.chatbotEnabled || false,
                summaryEnabled: data.summaryEnabled || false
            };
        }
        updateAiFeaturesUI();
    } catch (e) {
        console.error("AI 설정 로드 에러", e);
    }
}

// 설정에 맞춰 AI UI 요소(챗봇 등) 활성화/비활성화 처리
function updateAiFeaturesUI() {
    if (window.aiConfig && window.aiConfig.enabled && window.aiConfig.chatbotEnabled && window.aiConfig.apiKey) {
        aiChatbotFab.style.display = 'flex';
    } else {
        aiChatbotFab.style.display = 'none';
        aiChatbotWindow.classList.add('hidden');
    }
}

// Auth 변경에 맞춘 AI 설정 리로드 바인딩
firebase.auth().onAuthStateChanged((user) => {
    loadAiConfig();
});

// 클라우드 계정 관리 메뉴 클릭 (독립 페이지 전환)
const cloudAccountManageMenuBtn = document.getElementById('cloudAccountManageMenuBtn');
const cloudAccountSettingsBackBtn = document.getElementById('cloudAccountSettingsBackBtn');

if (cloudAccountManageMenuBtn) {
    cloudAccountManageMenuBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof window.closeDrawer === 'function') window.closeDrawer();
        const targetPage = document.getElementById('cloudAccountSettingsPage');
        const fromPage = window.currentPage || document.getElementById('mainPage');
        if (targetPage && typeof window.switchPage === 'function') {
            window.switchPage(fromPage, targetPage);
        }
    });
}

if (cloudAccountSettingsBackBtn) {
    cloudAccountSettingsBackBtn.addEventListener('click', () => {
        if (typeof window.handlePageBack === 'function') {
            window.handlePageBack();
        }
    });
}

// AI 설정 메뉴 클릭
if (aiSettingsMenuBtn) {
    aiSettingsMenuBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!currentUser || !isAdmin(currentUser.email)) {
            alert('회장 및 사장만 접근 가능합니다.');
            return;
        }

        // 설정값 채우기
        aiApiKeyInput.value = window.aiConfig.apiKey;
        if (aiModelSelect) {
            let modelValue = window.aiConfig.model || 'gemini-3.6-flash';
            if (modelValue === 'gemini-3.1-flash-lite' || modelValue === 'gemini-3.5-flash' || modelValue === 'gemini-3.1-pro-preview') {
                modelValue = 'gemini-3.5-flash-lite';
            }
            const allowedModels = ['gemini-3.6-flash', 'gemini-3.5-flash-lite'];
            if (!allowedModels.includes(modelValue)) {
                modelValue = 'gemini-3.6-flash';
            }
            aiModelSelect.value = modelValue;
            const aiModelOptionItems = document.querySelectorAll('#aiModelOptions .custom-dropdown-option');
            aiModelOptionItems.forEach(opt => {
                if (opt.getAttribute('data-value') === modelValue) {
                    opt.classList.add('active');
                    const title = opt.getAttribute('data-title') || opt.querySelector('.model-title')?.textContent || 'Gemini 3.6 Flash';
                    updateAiModelSelectedDisplay(title, false);
                } else {
                    opt.classList.remove('active');
                }
            });
        }
        aiEnabledCheckbox.checked = window.aiConfig.enabled;
        aiChatbotEnabledCheckbox.checked = window.aiConfig.chatbotEnabled;
        aiSummaryEnabledCheckbox.checked = window.aiConfig.summaryEnabled;

        aiTestResult.style.display = 'none';
        aiApiKeyInput.classList.add('secure-mask');
        const eyeIcon = toggleApiKeyVisibility.querySelector('i');
        eyeIcon.className = 'fa-regular fa-eye';

        closeDrawer(true);
        switchPage(currentPage, aiSettingsPage, false, true);
    });
}

if (aiSettingsBackBtn) {
    aiSettingsBackBtn.addEventListener('click', handlePageBack);
}

// API Key 눈 모양 보이기/숨기기 토글
if (toggleApiKeyVisibility) {
    let isTransitioning = false;
    toggleApiKeyVisibility.addEventListener('click', () => {
        if (isTransitioning) return;
        isTransitioning = true;

        aiApiKeyInput.classList.add('mask-transitioning');

        setTimeout(() => {
            if (aiApiKeyInput.classList.contains('secure-mask')) {
                aiApiKeyInput.classList.remove('secure-mask');
            } else {
                aiApiKeyInput.classList.add('secure-mask');
            }

            setTimeout(() => {
                aiApiKeyInput.classList.remove('mask-transitioning');
                isTransitioning = false;
            }, 50); // Small buffer before starting fade-back-in
        }, 150); // Matches the CSS transition duration
    });
}

// 저장하기
if (aiSaveBtn) {
    aiSaveBtn.addEventListener('click', async () => {
        if (!currentUser || !isAdmin(currentUser.email)) return;

        const apiKey = aiApiKeyInput.value.trim();
        const model = aiModelSelect ? aiModelSelect.value : 'gemini-3.6-flash';
        const enabled = aiEnabledCheckbox.checked;
        const chatbotEnabled = aiChatbotEnabledCheckbox.checked;
        const summaryEnabled = aiSummaryEnabledCheckbox.checked;

        aiSaveBtn.disabled = true;
        aiSaveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 저장 중...';

        try {
            await db.collection('settings').doc('ai_config').set({
                apiKey: apiKey,
                model: model,
                enabled: enabled,
                chatbotEnabled: chatbotEnabled,
                summaryEnabled: summaryEnabled,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            window.aiConfig = { apiKey, model, enabled, chatbotEnabled, summaryEnabled };
            updateAiFeaturesUI();

            alert('AI 설정이 성공적으로 저장되었습니다!');
        } catch (e) {
            console.error("AI 설정 저장 중 오류", e);
            alert('설정 저장 중 오류가 발생했습니다: ' + e.message);
        } finally {
            aiSaveBtn.disabled = false;
            aiSaveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> 저장하기';
        }
    });
}

// Gemini API 호출 헬퍼 (단일 텍스트 프롬프트 및 멀티모달 parts 지원)
async function callGeminiAPI(apiKey, promptOrParts) {
    const model = window.aiConfig.model || 'gemini-3.6-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    let parts = [];
    if (typeof promptOrParts === 'string') {
        parts = [{ text: promptOrParts }];
    } else if (Array.isArray(promptOrParts)) {
        parts = promptOrParts;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: parts }]
        })
    });
    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.error?.message || response.statusText;
        throw new Error(errMsg);
    }
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// 연결 테스트
if (aiTestBtn) {
    aiTestBtn.addEventListener('click', async () => {
        const key = aiApiKeyInput.value.trim();
        if (!key) {
            alert('연결 테스트를 수행하려면 API Key를 먼저 입력해 주세요.');
            return;
        }

        aiTestResult.style.display = 'block';
        aiTestResult.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        aiTestResult.style.borderColor = 'var(--glass-border)';
        aiTestResult.style.color = 'var(--text-primary)';
        aiTestResult.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Gemini API에 연결 중입니다. 잠시만 기다려 주세요...';

        try {
            const reply = await callGeminiAPI(key, "Hello, standard test connection check. Respond with 'SUCCESS'.");
            aiTestResult.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
            aiTestResult.style.borderColor = '#10b981';
            aiTestResult.style.color = '#34d399';
            aiTestResult.innerHTML = `<strong><i class="fa-solid fa-circle-check"></i> 연결 성공!</strong><br>Gemini API가 정상적으로 연동되었습니다.<br>응답 내용: "${reply.trim()}"`;
        } catch (e) {
            aiTestResult.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            aiTestResult.style.borderColor = '#ef4444';
            aiTestResult.style.color = '#f87171';
            aiTestResult.innerHTML = `<strong><i class="fa-solid fa-circle-xmark"></i> 연결 실패</strong><br>에러 발생: ${e.message}`;
        }
    });
}

// AI 챗봇 첨부파일 상태 관리 & 파일 업로드 핸들러
let aiAttachedFiles = [];

const aiChatbotAttachBtn = document.getElementById('aiChatbotAttachBtn');
const aiChatbotAttachMenu = document.getElementById('aiChatbotAttachMenu');
const aiChatbotPreviewContainer = document.getElementById('aiChatbotPreviewContainer');

const aiAttachImageBtn = document.getElementById('aiAttachImageBtn');
const aiAttachPdfBtn = document.getElementById('aiAttachPdfBtn');
const aiAttachAudioBtn = document.getElementById('aiAttachAudioBtn');
const aiAttachHtmlBtn = document.getElementById('aiAttachHtmlBtn');
const aiAttachVideoBtn = document.getElementById('aiAttachVideoBtn');

const aiImageInput = document.getElementById('aiImageInput');
const aiPdfInput = document.getElementById('aiPdfInput');
const aiAudioInput = document.getElementById('aiAudioInput');
const aiHtmlInput = document.getElementById('aiHtmlInput');
const aiVideoInput = document.getElementById('aiVideoInput');

if (aiChatbotAttachBtn) {
    aiChatbotAttachBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        aiChatbotAttachBtn.classList.toggle('open');
        if (aiChatbotAttachMenu) aiChatbotAttachMenu.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (aiChatbotAttachBtn && aiChatbotAttachMenu && !aiChatbotAttachBtn.contains(e.target) && !aiChatbotAttachMenu.contains(e.target)) {
            aiChatbotAttachBtn.classList.remove('open');
            aiChatbotAttachMenu.classList.remove('active');
        }
    });
}

function handleAiFileSelect(inputElement, fileType) {
    if (!inputElement) return;
    inputElement.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        if (aiAttachedFiles.length + files.length > 10) {
            alert('첨부파일은 최대 10개까지 첨부할 수 있습니다.');
            inputElement.value = '';
            return;
        }

        for (const file of files) {
            if (file.size > 100 * 1024 * 1024) {
                alert(`파일 "${file.name}"이 100MB를 초과합니다.`);
                continue;
            }

            try {
                const dataUrl = await readFileAsDataURL(file);
                aiAttachedFiles.push({
                    id: 'aifile-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                    name: file.name,
                    size: formatAiFileSize(file.size),
                    type: fileType,
                    mimeType: file.type || getAiMimeTypeFromExtension(file.name, fileType),
                    dataUrl: dataUrl
                });
            } catch (err) {
                console.error('AI 첨부파일 읽기 오류:', err);
            }
        }

        inputElement.value = '';
        if (aiChatbotAttachBtn) aiChatbotAttachBtn.classList.remove('open');
        if (aiChatbotAttachMenu) aiChatbotAttachMenu.classList.remove('active');
        renderAiAttachedFiles();
    });
}

function getAiMimeTypeFromExtension(fileName, fileType) {
    const ext = fileName.split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'application/pdf';
    if (ext === 'html' || ext === 'htm') return 'text/html';
    if (ext === 'txt') return 'text/plain';
    if (fileType === 'image') return 'image/jpeg';
    if (fileType === 'audio') return 'audio/mp3';
    if (fileType === 'video') return 'video/mp4';
    return 'application/octet-stream';
}

function formatAiFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeAiHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

if (aiAttachImageBtn && aiImageInput) {
    aiAttachImageBtn.addEventListener('click', () => aiImageInput.click());
    handleAiFileSelect(aiImageInput, 'image');
}
if (aiAttachPdfBtn && aiPdfInput) {
    aiAttachPdfBtn.addEventListener('click', () => aiPdfInput.click());
    handleAiFileSelect(aiPdfInput, 'pdf');
}
if (aiAttachAudioBtn && aiAudioInput) {
    aiAttachAudioBtn.addEventListener('click', () => aiAudioInput.click());
    handleAiFileSelect(aiAudioInput, 'audio');
}
if (aiAttachHtmlBtn && aiHtmlInput) {
    aiAttachHtmlBtn.addEventListener('click', () => aiHtmlInput.click());
    handleAiFileSelect(aiHtmlInput, 'html');
}
if (aiAttachVideoBtn && aiVideoInput) {
    aiAttachVideoBtn.addEventListener('click', () => aiVideoInput.click());
    handleAiFileSelect(aiVideoInput, 'video');
}

function renderAiAttachedFiles() {
    if (!aiChatbotPreviewContainer) return;

    if (aiAttachedFiles.length === 0) {
        aiChatbotPreviewContainer.style.display = 'none';
        aiChatbotPreviewContainer.innerHTML = '';
        return;
    }

    aiChatbotPreviewContainer.style.display = 'flex';
    aiChatbotPreviewContainer.innerHTML = aiAttachedFiles.map((file, idx) => {
        let iconHtml = '<i class="fa-solid fa-file" style="color: #60a5fa;"></i>';
        if (file.type === 'image') {
            iconHtml = `<img src="${file.dataUrl}" class="thumb" alt="미리보기" />`;
        } else if (file.type === 'pdf') {
            iconHtml = '<i class="fa-regular fa-file-pdf" style="font-size: 1.3rem; color: #ff922b;"></i>';
        } else if (file.type === 'audio') {
            iconHtml = '<i class="fa-solid fa-microphone" style="font-size: 1.3rem; color: #51cf66;"></i>';
        } else if (file.type === 'html') {
            iconHtml = '<i class="fa-solid fa-file-code" style="font-size: 1.3rem; color: #cc5de8;"></i>';
        } else if (file.type === 'video') {
            iconHtml = '<i class="fa-regular fa-file-video" style="font-size: 1.3rem; color: #f76707;"></i>';
        }

        return `
            <div class="ai-preview-card">
                ${iconHtml}
                <div class="ai-preview-card-info">
                    <span class="ai-preview-card-name">${escapeAiHtml(file.name)}</span>
                    <span class="ai-preview-card-size">${file.size}</span>
                </div>
                <button type="button" class="ai-preview-card-remove" onclick="removeAiAttachedFile(${idx})" aria-label="삭제">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;
    }).join('');
}

window.removeAiAttachedFile = function (index) {
    if (index >= 0 && index < aiAttachedFiles.length) {
        aiAttachedFiles.splice(index, 1);
        renderAiAttachedFiles();
    }
};

// AI 챗봇 클라이언트 인터랙션 (설정 모달과 동일한 사이즈 및 오버레이 모달)
const aiChatbotModalOverlay = document.getElementById('aiChatbotModalOverlay');
const aiChatbotScrollbar = document.getElementById('aiChatbotScrollbar');
const aiChatbotScrollbarThumb = document.getElementById('aiChatbotScrollbarThumb');

let aiScrollTimeout;
let isHoveringAiScrollbar = false;
let isAiDragging = false;
let aiStartY = 0;
let aiStartScrollTop = 0;

function updateAiChatbotScrollbar() {
    if (!aiChatbotMessages || !aiChatbotScrollbar || !aiChatbotScrollbarThumb) return;

    const scrollHeight = aiChatbotMessages.scrollHeight;
    const clientHeight = aiChatbotMessages.clientHeight;
    const scrollTop = aiChatbotMessages.scrollTop;

    // AI 챗봇 모달이 비활성화 상태이거나 내용이 적어 스크롤이 불필요하면 숨김
    if (!aiChatbotWindow || !aiChatbotWindow.classList.contains('active') || scrollHeight <= clientHeight) {
        aiChatbotScrollbar.classList.remove('visible');
        return;
    }

    const trackHeight = aiChatbotScrollbar.clientHeight;
    // 썸 최소 높이 30px 설정
    const thumbHeight = Math.max(30, (clientHeight / scrollHeight) * trackHeight);
    const maxScrollTop = scrollHeight - clientHeight;
    const maxThumbTop = trackHeight - thumbHeight;

    const thumbTop = maxScrollTop > 0 ? (scrollTop / maxScrollTop) * maxThumbTop : 0;

    aiChatbotScrollbarThumb.style.height = `${thumbHeight}px`;
    aiChatbotScrollbarThumb.style.transform = `translateY(${thumbTop}px)`;

    // 스크롤 시 보이게 함
    aiChatbotScrollbar.classList.add('visible');

    // 타이머 재설정 (사용 중이 아닐 때 1.5초 후 페이드 아웃)
    clearTimeout(aiScrollTimeout);
    if (!isAiDragging && !isHoveringAiScrollbar) {
        aiScrollTimeout = setTimeout(() => {
            aiChatbotScrollbar.classList.remove('visible');
        }, 1500);
    }
}

if (aiChatbotMessages) {
    aiChatbotMessages.addEventListener('scroll', updateAiChatbotScrollbar, { passive: true });
}

if (aiChatbotScrollbar) {
    aiChatbotScrollbar.addEventListener('mouseenter', () => {
        isHoveringAiScrollbar = true;
        updateAiChatbotScrollbar();
    });
    aiChatbotScrollbar.addEventListener('mouseleave', () => {
        isHoveringAiScrollbar = false;
        if (!isAiDragging) {
            clearTimeout(aiScrollTimeout);
            aiScrollTimeout = setTimeout(() => {
                aiChatbotScrollbar.classList.remove('visible');
            }, 1500);
        }
    });
}

if (aiChatbotScrollbarThumb) {
    aiChatbotScrollbarThumb.addEventListener('mousedown', (e) => {
        isAiDragging = true;
        aiStartY = e.clientY;
        aiStartScrollTop = aiChatbotMessages.scrollTop;
        aiChatbotScrollbarThumb.classList.add('dragging');
        document.body.style.userSelect = 'none';

        const onMouseMove = (moveEvent) => {
            if (!isAiDragging) return;
            const deltaY = moveEvent.clientY - aiStartY;
            const trackHeight = aiChatbotScrollbar.clientHeight;
            const thumbHeight = parseFloat(aiChatbotScrollbarThumb.style.height) || 30;
            const maxScrollTop = aiChatbotMessages.scrollHeight - aiChatbotMessages.clientHeight;
            const maxThumbTop = trackHeight - thumbHeight;

            if (maxThumbTop > 0) {
                const scrollDelta = (deltaY / maxThumbTop) * maxScrollTop;
                aiChatbotMessages.scrollTop = aiStartScrollTop + scrollDelta;
            }
        };

        const onMouseUp = () => {
            isAiDragging = false;
            aiChatbotScrollbarThumb.classList.remove('dragging');
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            if (!isHoveringAiScrollbar) {
                clearTimeout(aiScrollTimeout);
                aiScrollTimeout = setTimeout(() => {
                    aiChatbotScrollbar.classList.remove('visible');
                }, 1500);
            }
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    });
}

window.openAiChatbotModal = function () {
    if (aiChatbotModalOverlay && aiChatbotWindow) {
        history.pushState({ modal: 'aiChatbotModal' }, '', '');
        aiChatbotModalOverlay.classList.add('active');
        aiChatbotWindow.classList.add('active');
        if (aiChatbotInput) aiChatbotInput.focus();
        if (aiChatbotMessages) aiChatbotMessages.scrollTop = aiChatbotMessages.scrollHeight;
        setTimeout(updateAiChatbotScrollbar, 100);
    }
};

window.closeAiChatbotModal = function (popHistory = true) {
    if (aiChatbotModalOverlay && aiChatbotWindow) {
        aiChatbotModalOverlay.classList.remove('active');
        aiChatbotWindow.classList.remove('active');
        if (aiChatbotScrollbar) aiChatbotScrollbar.classList.remove('visible');
        if (popHistory && history.state && history.state.modal === 'aiChatbotModal') {
            history.back();
        }
    }
};

if (aiChatbotFab) {
    aiChatbotFab.addEventListener('click', () => {
        if (aiChatbotWindow && aiChatbotWindow.classList.contains('active')) {
            window.closeAiChatbotModal();
        } else {
            window.openAiChatbotModal();
        }
    });
}

const commentGeminiBtn = document.getElementById('commentGeminiBtn');
if (commentGeminiBtn) {
    commentGeminiBtn.addEventListener('click', () => {
        if (aiChatbotWindow && aiChatbotWindow.classList.contains('active')) {
            window.closeAiChatbotModal();
        } else {
            window.openAiChatbotModal();
        }
    });
}

if (closeAiChatbot) {
    closeAiChatbot.addEventListener('click', () => window.closeAiChatbotModal());
}

if (aiChatbotModalOverlay) {
    aiChatbotModalOverlay.addEventListener('click', () => window.closeAiChatbotModal());
}

window.addEventListener('resize', () => {
    updateScrollbar();
    updateAiChatbotScrollbar();
});

async function sendChatbotMessage() {
    const message = aiChatbotInput.value.trim();
    if (!message && aiAttachedFiles.length === 0) return;

    // 사용자 화면 메시지 HTML 생성
    let userMsgHtml = '';
    if (message) {
        userMsgHtml += escapeAiHtml(message).replace(/\n/g, '<br>');
    }

    if (aiAttachedFiles.length > 0) {
        const attachCardsHtml = aiAttachedFiles.map(file => {
            if (file.type === 'image') {
                return `<div style="margin-top: 6px;"><img src="${file.dataUrl}" style="max-width: 100%; max-height: 220px; border-radius: 8px; object-fit: contain; border: 1px solid rgba(255,255,255,0.15);" /></div>`;
            } else {
                let fileIcon = 'fa-file';
                if (file.type === 'pdf') fileIcon = 'fa-file-pdf';
                if (file.type === 'audio') fileIcon = 'fa-microphone';
                if (file.type === 'html') fileIcon = 'fa-file-code';
                if (file.type === 'video') fileIcon = 'fa-file-video';

                return `<div style="margin-top: 6px; display: inline-flex; align-items: center; gap: 6px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.1); padding: 5px 10px; border-radius: 8px; font-size: 0.82rem;">
                    <i class="fa-solid ${fileIcon}"></i> ${escapeAiHtml(file.name)} (${file.size})
                </div>`;
            }
        }).join('');

        userMsgHtml += `<div style="margin-top: 4px;">${attachCardsHtml}</div>`;
    }

    const currentFiles = [...aiAttachedFiles];
    aiAttachedFiles = [];
    renderAiAttachedFiles();

    aiChatbotInput.value = '';
    aiChatbotInput.focus();

    appendChatbotMessage('user', userMsgHtml);

    const loadingId = appendChatbotMessage('assistant', '<i class="fa-solid fa-circle-notch fa-spin"></i> AI 비서가 분석 후 고민하고 있습니다...');

    try {
        const parts = [];
        let systemPromptText = `너는 양중과학동아리의 AI 비서/도우미야. 부원들이 과학 원리를 묻거나 첨부된 사진, 문서, 자료에 대해 이야기하면 친절하고 유머러스하게 중학생 눈높이에서 답변해줘. 마크다운 기호 없이 가독성 좋고 깔끔한 줄바꿈으로 한국어로 답변해줘.`;
        if (message) {
            systemPromptText += `\n사용자 질문: ${message}`;
        } else {
            systemPromptText += `\n사용자가 첨부파일을 전송했습니다. 첨부된 파일 내용을 확인하고 친절하게 설명해줘.`;
        }

        parts.push({ text: systemPromptText });

        // Gemini 멀티모달 inlineData 구조체 생성
        currentFiles.forEach(f => {
            const base64Match = f.dataUrl.match(/^data:(.*?);base64,(.*)$/);
            if (base64Match) {
                parts.push({
                    inlineData: {
                        mimeType: base64Match[1] || f.mimeType,
                        data: base64Match[2]
                    }
                });
            }
        });

        const reply = await callGeminiAPI(window.aiConfig.apiKey, parts);
        removeChatbotMessage(loadingId);
        appendChatbotMessage('assistant', reply.replace(/\n/g, '<br>'));
    } catch (e) {
        removeChatbotMessage(loadingId);
        appendChatbotMessage('assistant', `<span style="color: #f87171;"><i class="fa-solid fa-triangle-exclamation"></i> 에러 발생: ${e.message}<br>API 키 만료나 파일 형식, 네트워크 환경을 확인해 주세요.</span>`);
    }
}

function appendChatbotMessage(sender, text) {
    const msgId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    const msgDiv = document.createElement('div');
    msgDiv.className = `ai-message ${sender}`;
    msgDiv.id = msgId;
    msgDiv.innerHTML = text;
    aiChatbotMessages.appendChild(msgDiv);
    aiChatbotMessages.scrollTop = aiChatbotMessages.scrollHeight;
    setTimeout(updateAiChatbotScrollbar, 50);
    return msgId;
}

function removeChatbotMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
    setTimeout(updateAiChatbotScrollbar, 50);
}

if (aiChatbotSendBtn) {
    aiChatbotSendBtn.addEventListener('click', sendChatbotMessage);
}

if (aiChatbotInput) {
    aiChatbotInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatbotMessage();
        }
    });
}

// 건의사항 AI 요약 분석 생성 함수
window.generateAiSummary = async function (postId) {
    const genBox = document.getElementById('aiGenBox-' + postId);
    if (!genBox) return;

    genBox.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem; color: var(--accent-color);">
                    <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 1.5rem;"></i>
                    <span style="font-size: 0.9rem; font-weight: 500;">Gemini AI가 이 건의 내용을 핵심 요약하고 최적의 해결 방안을 기안 중입니다...</span>
                </div>
            `;

    try {
        const postSnap = await db.collection('posts').doc(postId).get();
        if (!postSnap.exists) {
            throw new Error('게시글을 찾을 수 없습니다.');
        }
        const postData = postSnap.data();

        const prompt = `너는 중학교 과학동아리 회장과 사장의 건의사항 분석을 돕는 'AI 정책 기획 보좌관'이야. 아래 제공되는 동아리 부원의 건의사항(제목 및 내용)을 다각도로 분석하여 요약하고 해결 가이드라인을 작성해줘. 중학생들이 실현 가능한 수준으로 재미있고 명료하게 3가지 포인트로 정리해줘:
1. 📌 건의 핵심 내용 (한 줄 요약)
2. 💡 AI가 제안하는 기발하고 합리적인 해결 방안 (동아리 부 예산이나 상황에 맞게 중학생 수준에서 제안)
3. 🛠️ 회장/사장이 취해야 할 즉각적인 Action Step 조언

건의 제목: "${postData.title}"
건의 본문 내용: "${postData.body}"

답변은 마크다운 기호 없이 깔끔하고 예쁘게 줄바꿈하여 완성도 높게 한국어로 정성스레 작성해줘.`;

        const aiSummary = await callGeminiAPI(window.aiConfig.apiKey, prompt);

        await db.collection('posts').doc(postId).update({
            aiSummary: aiSummary
        });
    } catch (e) {
        console.error("AI 요약 생성 에러", e);
        genBox.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem; color: #f87171;">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size: 1.5rem;"></i>
                        <span style="font-size: 0.9rem; font-weight: 500;">AI 요약 생성 중 에러 발생: ${e.message}</span>
                        <button type="button" onclick="generateAiSummary('${postId}')" style="margin-top: 0.5rem; background: var(--accent-color); color: white; border: none; padding: 0.4rem 1rem; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 0.8rem;">다시 시도</button>
                    </div>
                `;
    }
};

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
        if (!currentUser || !isAdmin(currentUser.email)) {
            alert('회장만 접근 가능한 페이지입니다.');
            return;
        }
        roleTargetEmail.value = '';
        roleNameInput.value = '';
        closeDrawer(true);
        switchPage(currentPage, roleManagePage, false, true);
    });
}

if (roleManageBackBtn) {
    roleManageBackBtn.addEventListener('click', handlePageBack);
}

if (roleManageConfirmBtn) {
    roleManageConfirmBtn.addEventListener('click', async () => {
        if (!currentUser || !isAdmin(currentUser.email)) return;

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

function loadRoleList() {
    if (unsubscribeRoles) unsubscribeRoles();
    unsubscribeRoles = db.collection('userRoles').onSnapshot(snapshot => {
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
    if (!currentUser || !isAdmin(currentUser.email)) return;
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
    if (!currentUser || !isAdmin(currentUser.email)) return;
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

// 직책 관리 메뉴 버튼 클릭 시에 loadRoleList 실행
if (roleManageMenuBtn) {
    roleManageMenuBtn.addEventListener('click', () => {
        loadRoleList();
    });
}

// 직책 개별 삭제 (페이드 → 공간 접기 → Firestore 삭제)
window.deleteRoleWithAnim = async function (email, btnEl) {
    if (!currentUser || !isAdmin(currentUser.email)) return;
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
        await db.collection('userRoles').doc(email).update({ pinned: !isPinned });
    } catch (e) {
        console.error(e);
        if (btn) btn.classList.toggle('active', isPinned);
    }
};

// --- 설정 창 로직 ---
window.openSettingsModal = function (tabName = 'general') {
    if (typeof window.closeDrawer === 'function') window.closeDrawer();
    if (settingsModalOverlay && settingsModal) {
        history.pushState({ modal: 'settingsModal' }, '', '');
        settingsModalOverlay.classList.add('active');
        settingsModal.classList.add('active');

        const navTab = document.querySelector(`.settings-nav-item[data-tab="${tabName}"]`);
        if (navTab) navTab.click();
    }
};

window.closeSettingsModal = function (popHistory = true) {
    if (settingsModalOverlay && settingsModal) {
        settingsModalOverlay.classList.remove('active');
        settingsModal.classList.remove('active');
        if (popHistory && history.state && history.state.modal === 'settingsModal') {
            history.back();
        }
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

const usefulCategoryList = document.getElementById('usefulCategoryList');
const topButtonSettingsSubPage = document.getElementById('topButtonSettingsSubPage');
const commentInputSettingsSubPage = document.getElementById('commentInputSettingsSubPage');
const textSelectSettingsSubPage = document.getElementById('textSelectSettingsSubPage');

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

if (settingsNavItems.length > 0) {
    settingsNavItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');

            settingsNavItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            settingsTabContents.forEach(content => {
                if (content.id === `settingsTab-${targetTab}`) {
                    content.style.display = 'flex';
                } else {
                    content.style.display = 'none';
                }
            });

            // 탭을 전환할 때 서브페이지를 메인 카드 목록으로 초기화
            resetUsefulSettingsSubPage();
        });
    });
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

const savedLogoSetting = localStorage.getItem('logoDisplayStyle') || 'default';
applyLogoDisplaySettings(savedLogoSetting);

if (logoDisplaySelected && logoDisplayOptions) {
    logoDisplaySelected.addEventListener('click', (e) => {
        e.stopPropagation();
        logoDisplayDropdown.classList.toggle('open');
    });

    logoDisplayOptionItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const value = item.getAttribute('data-value');
            localStorage.setItem('logoDisplayStyle', value);
            applyLogoDisplaySettings(value);
            logoDisplayDropdown.classList.remove('open');
        });
    });

    document.addEventListener('click', (e) => {
        if (logoDisplayDropdown && !logoDisplayDropdown.contains(e.target)) {
            logoDisplayDropdown.classList.remove('open');
        }
    });
}

window.openSettingsModal = function () {
    resetUsefulSettingsSubPage();
    settingsModalOverlay.classList.add('active');
    settingsModal.classList.add('active');
    const sideDrawer = document.getElementById('sideDrawer');
    if (sideDrawer) {
        sideDrawer.classList.add('drawer-hidden-by-settings');
    }
    history.pushState({ modal: 'settings' }, '');
};

window.closeSettingsModal = function (fromPopState = false) {
    settingsModalOverlay.classList.remove('active');
    settingsModal.classList.remove('active');
    const sideDrawer = document.getElementById('sideDrawer');
    if (sideDrawer) {
        sideDrawer.classList.remove('drawer-hidden-by-settings');
    }
    if (!fromPopState) {
        window._isProgrammaticBack = true;
        if (history.state && history.state.modal === 'settings') {
            history.back();
        } else {
            setTimeout(() => { window._isProgrammaticBack = false; }, 300);
        }
    }
};

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
let _isScrollHideEnabled = localStorage.getItem('setting_scroll_hide') !== 'false';

const _logoHomeBtn = document.getElementById('logoHomeBtn');
const _headerActions = document.querySelector('.header-actions');
const _writePostBtnGlob = document.getElementById('writePostBtn');
const _aiChatbotFabGlob = document.getElementById('aiChatbotFab');

const scrollHideToggle = document.getElementById('scrollHideToggle');
if (scrollHideToggle) {
    scrollHideToggle.checked = _isScrollHideEnabled;
    scrollHideToggle.addEventListener('change', (e) => {
        _isScrollHideEnabled = e.target.checked;
        localStorage.setItem('setting_scroll_hide', _isScrollHideEnabled);
        if (!_isScrollHideEnabled) {
            _showTopButtons();
        }
    });
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
        if (_aiChatbotFabGlob) {
            _aiChatbotFabGlob.style.opacity = '0';
            _aiChatbotFabGlob.style.pointerEvents = 'none';
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
        _writePostBtnGlob.style.opacity = '1';
        _writePostBtnGlob.style.pointerEvents = 'auto';
        _writePostBtnGlob.style.visibility = 'visible';
        _writePostBtnGlob.classList.remove('fab-hidden');
    }
    if (_aiChatbotFabGlob) {
        _aiChatbotFabGlob.style.opacity = '1';
        _aiChatbotFabGlob.style.pointerEvents = 'auto';
        _aiChatbotFabGlob.style.visibility = 'visible';
        _aiChatbotFabGlob.classList.add('shift-left');
    }
    _isTopButtonsHidden = false;
}

// --- 댓글 스크롤 시 입력창 자동 숨김 로직 (기본값: false / off) ---
let _isCommentInputScrollHideEnabled = localStorage.getItem('setting_comment_input_scroll_hide') === 'true';
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
        _isCommentInputScrollHideEnabled = e.target.checked;
        localStorage.setItem('setting_comment_input_scroll_hide', _isCommentInputScrollHideEnabled);
        if (!_isCommentInputScrollHideEnabled) {
            _showCommentInput();
        }
    }
});

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
let _isTextSelectPreventEnabled = localStorage.getItem('setting_text_select_prevent') !== 'false';

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
        _isTextSelectPreventEnabled = e.target.checked;
        localStorage.setItem('setting_text_select_prevent', _isTextSelectPreventEnabled);
        updateTextSelectToggleUI();
    }
});
