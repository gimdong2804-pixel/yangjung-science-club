
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

        // 사이드 드로어 제어 로직
        const menuBtn = document.getElementById('menuBtn');
        const sideDrawer = document.getElementById('sideDrawer');
        const drawerOverlay = document.getElementById('drawerOverlay');
        const drawerCloseBtn = document.getElementById('drawerCloseBtn');

        function openDrawer() {
            sideDrawer.classList.add('active');
            drawerOverlay.classList.add('active');
        }

        function closeDrawer() {
            sideDrawer.classList.remove('active');
            drawerOverlay.classList.remove('active');
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
        window.addEventListener('resize', updateScrollbar);

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

        function switchPage(fromPage, toPage) {
            if (fromPage === toPage) return; // 동일한 페이지로의 전환은 무시
            
            // 현재 페이지 fade out
            fromPage.classList.add('fade-out');
            fromPage.classList.remove('fade-in');
            
            // 메인 페이지에서 서브 페이지로 이동할 때 푸터 페이드 아웃 시작
            if (fromPage === mainPage) {
                siteFooter.classList.add('fade-out');
            }
            
            // 페이지가 바뀔 때 우선 스크롤바 숨기기
            hideScrollbar();

            setTimeout(() => {
                fromPage.classList.add('hidden');
                toPage.classList.remove('hidden');
                
                // 강제 리플로우를 발생시켜 display 상태의 변화를 인지하도록 처리
                toPage.offsetHeight;
                
                // 스크롤 위로
                window.scrollTo({ top: 0, behavior: 'instant' });
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
                });
            }, 400);
        }

        greetingLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeDrawer();
            switchPage(currentPage, greetingPage);
        });

        backBtn.addEventListener('click', () => {
            switchPage(currentPage, mainPage);
        });

        goalLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeDrawer();
            switchPage(currentPage, goalPage);
        });

        goalBackBtn.addEventListener('click', () => {
            switchPage(currentPage, mainPage);
        });

        // 커뮤니티 라우팅
        const suggestionLink = document.getElementById('suggestionLink');
        const suggestionPage = document.getElementById('suggestionPage');
        const suggestionBackBtn = document.getElementById('suggestionBackBtn');
        const postDetailPage = document.getElementById('postDetailPage');
        const postDetailBackBtn = document.getElementById('postDetailBackBtn');

        suggestionLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeDrawer();
            switchPage(currentPage, suggestionPage);
        });

        suggestionBackBtn.addEventListener('click', () => {
            closeSideDetail();
            switchPage(currentPage, mainPage);
        });

        postDetailBackBtn.addEventListener('click', () => {
            switchPage(currentPage, suggestionPage);
        });

        // Firebase 연동 로직
        const firebaseConfig = {
            apiKey: "AIzaSyAjYVdkxXL8Z0eaFGGtiwn3qIXUreD8_lc",
            authDomain: "yangjung-science.firebaseapp.com",
            projectId: "yangjung-science",
            storageBucket: "yangjung-science.firebasestorage.app",
            messagingSenderId: "949394294466",
            appId: "1:949394294466:web:663583e43bba46f9e05d5b"
        };
        firebase.initializeApp(firebaseConfig);
        const db = firebase.firestore();
        const auth = firebase.auth();

        // 로그인 상태 변수
        let currentUser = null;

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
            if (error && error.code === 'auth/unauthorized-domain') {
                alert("로그인 중 오류가 발생했습니다: Firebase 인증 설정에서 현재 사이트 주소를 승인된 도메인에 추가해야 합니다.");
                return;
            }
            alert("로그인 중 오류가 발생했습니다: " + ((error && error.message) || "알 수 없는 오류"));
        }

        // 구글 로그인 연동
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

        // 로그아웃
        logoutBtn.addEventListener('click', async () => {
            try {
                await auth.signOut();
            } catch (error) {
                console.error("Sign-Out Error: ", error);
            }
        });

        // Auth 상태 리스너
        auth.onAuthStateChanged((user) => {
            const postAuthorInput = document.getElementById('postAuthor');
            if (user) {
                currentUser = user;
                // UI 업데이트 (애니메이션 적용)
                googleLoginBtn.classList.add('fade-out');
                setTimeout(() => {
                    googleLoginBtn.classList.add('hidden');
                    googleLoginBtn.classList.remove('fade-out');
                    
                    userProfileInfo.classList.remove('hidden');
                    userProfileInfo.classList.add('fade-out');
                    // 강제 리플로우
                    userProfileInfo.offsetHeight;
                    userProfileInfo.classList.remove('fade-out');
                }, 300);

                const isPresident = user.email === 'gimdong2804@gmail.com';
                userName.innerText = isPresident ? "회장 김동현" : user.displayName;
                userEmail.innerText = user.email;
                userAvatar.src = user.photoURL || '';

                if (postAuthorInput) {
                    postAuthorInput.value = isPresident ? "회장 김동현" : user.displayName;
                    postAuthorInput.placeholder = "작성자 이름";
                }
            } else {
                currentUser = null;
                // UI 업데이트 (애니메이션 적용)
                userProfileInfo.classList.add('fade-out');
                setTimeout(() => {
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
            }
        });

        // 페이지 및 글쓰기 관련 DOM
        const writePostPage = document.getElementById('writePostPage');
        const writePostBackBtn = document.getElementById('writePostBackBtn');
        const writePostBtn = document.getElementById('writePostBtn');
        const submitPostBtn = document.getElementById('submitPostBtn');
        const boardContainer = document.querySelector('.board-container');

        writePostBtn.addEventListener('click', () => {
            if (!currentUser) {
                alert('건의사항을 작성하시려면 먼저 Google 로그인을 해주세요!');
                openDrawer();
                return;
            }
            switchPage(currentPage, writePostPage);
        });

        function closeWritePage() {
            switchPage(currentPage, suggestionPage);
            document.getElementById('postTitle').value = '';
            document.getElementById('postBody').value = '';
        }
        writePostBackBtn.addEventListener('click', closeWritePage);

        // Firebase 데이터 등록 (글쓰기)
        submitPostBtn.addEventListener('click', async () => {
            if (!currentUser) {
                alert('로그인이 필요한 서비스입니다.');
                return;
            }
            const title = document.getElementById('postTitle').value.trim();
            const author = currentUser.email === 'gimdong2804@gmail.com' ? "회장 김동현" : currentUser.displayName;
            const body = document.getElementById('postBody').value.trim();

            if (!title || !body) {
                alert('제목과 내용을 모두 입력해주세요!');
                return;
            }

            submitPostBtn.innerText = '저장 중...';
            submitPostBtn.disabled = true;

            try {
                await db.collection('posts').add({
                    title: title,
                    author: author,
                    uid: currentUser.uid,
                    userPhoto: currentUser.photoURL || '',
                    email: currentUser.email,
                    body: body,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    views: 0,
                    likes: 0
                });
                closeWritePage();
            } catch (error) {
                console.error("Error adding post: ", error);
                alert('등록 중 오류가 발생했습니다.');
            } finally {
                submitPostBtn.innerText = '건의사항 등록하기';
                submitPostBtn.disabled = false;
            }
        });

        // Firebase 데이터 실시간 불러오기
        function formatDate(timestamp) {
            if (!timestamp) return '방금 전';
            try {
                if (typeof timestamp.toDate === 'function') {
                    const d = timestamp.toDate();
                    const ampm = d.getHours() < 12 ? '오전' : '오후';
                    const h = d.getHours() % 12 || 12;
                    const m = String(d.getMinutes()).padStart(2, '0');
                    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${ampm} ${h}:${m}`;
                }
                if (timestamp instanceof Date) {
                    const ampm = timestamp.getHours() < 12 ? '오전' : '오후';
                    const h = timestamp.getHours() % 12 || 12;
                    const m = String(timestamp.getMinutes()).padStart(2, '0');
                    return `${timestamp.getFullYear()}. ${timestamp.getMonth() + 1}. ${timestamp.getDate()}. ${ampm} ${h}:${m}`;
                }
                if (typeof timestamp.toMillis === 'function') {
                    const d = new Date(timestamp.toMillis());
                    const ampm = d.getHours() < 12 ? '오전' : '오후';
                    const h = d.getHours() % 12 || 12;
                    const m = String(d.getMinutes()).padStart(2, '0');
                    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${ampm} ${h}:${m}`;
                }
            } catch (e) {
                console.error(e);
            }
            return String(timestamp);
        }

        let currentPostId = null; // 상세 페이지용 전역 변수

        let postsUnsubscribe = null;
        let postUnsubscribe = null;

        function loadPosts(sortBy = 'latest') {
            if (postsUnsubscribe) {
                postsUnsubscribe();
            }

            // 복합 인덱스 에러 방지 및 클라이언트 측 정렬을 위해 단일 필드로 조회합니다.
            let query = db.collection('posts').orderBy('createdAt', 'desc');

            postsUnsubscribe = query.onSnapshot((snapshot) => {
                // 기존 카드 모두 지우기
                const cards = boardContainer.querySelectorAll('.board-card');
                cards.forEach(card => card.remove());

                // 총 글 개수 업데이트
                const headerSpan = document.querySelector('.board-header span');
                if(headerSpan) {
                    headerSpan.innerHTML = `전체 게시글 <span style="color: var(--accent-color); font-weight: bold;">${snapshot.size}</span>개`;
                }

                // 정렬 로직 (pinned 우선, 그 다음 sortBy 기준)
                const docs = [...snapshot.docs].sort((a, b) => {
                    const dataA = a.data();
                    const dataB = b.data();

                    const pinA = dataA.pinned ? 1 : 0;
                    const pinB = dataB.pinned ? 1 : 0;
                    
                    // 1. 상단 고정(pinned) 게시물 우선 정렬 (고정한 게시물이 항상 위)
                    if (pinB !== pinA) {
                        return pinB - pinA;
                    }

                    // 2. 고정 상태가 같은 경우 인기순(조회수 views 내림차순) 또는 최신순(작성일 createdAt 내림차순) 정렬
                    if (sortBy === 'popular') {
                        const viewsA = dataA.views || 0;
                        const viewsB = dataB.views || 0;
                        if (viewsB !== viewsA) {
                            return viewsB - viewsA;
                        }
                    }

                    // 최신순 (또는 인기순인데 조회수가 같을 때) 작성일 기준 내림차순
                    const timeA = (dataA.createdAt && typeof dataA.createdAt.toMillis === 'function') ? dataA.createdAt.toMillis() : (dataA.createdAt instanceof Date ? dataA.createdAt.getTime() : 0);
                    const timeB = (dataB.createdAt && typeof dataB.createdAt.toMillis === 'function') ? dataB.createdAt.toMillis() : (dataB.createdAt instanceof Date ? dataB.createdAt.getTime() : 0);
                    return timeB - timeA;
                });

                docs.forEach((doc) => {
                    const post = doc.data();
                    const timeStr = formatDate(post.createdAt);
                    const avatar = post.author ? post.author.substring(0, 1) : '?';
                    let avatarHtml = `<div class="board-author-avatar" style="background: hsl(${Math.random() * 360}, 60%, 50%)">${avatar}</div>`;
                    if (post.userPhoto) {
                        avatarHtml = `<img class="board-author-avatar" src="${post.userPhoto}" alt="${post.author}" style="object-fit: cover; border: 1px solid var(--glass-border);">`;
                    }

                    const pinBadge = post.pinned ? `<span style="background: var(--accent-color); color: #fff; font-size: 0.7rem; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: bold; margin-bottom: 0.5rem; display: inline-block;"><i class="fa-solid fa-thumbtack"></i> 상단 고정</span><br>` : '';
                    const isLiked = currentUser && post.likedUsers && post.likedUsers.includes(currentUser.uid);
                    const heartIcon = isLiked ? 'fa-solid fa-heart animate-heart' : 'fa-regular fa-heart';
                    const heartColor = isLiked ? 'color: #ff6b6b;' : '';
                    const cardStyle = post.pinned ? 'border: 1px solid var(--accent-color); background: rgba(59, 130, 246, 0.05);' : '';

                    const cardHtml = `
                        <div class="board-card" data-id="${doc.id}" style="${cardStyle}">
                            ${pinBadge}
                            <div class="board-card-header">
                                <div class="board-author">
                                    ${avatarHtml}
                                    <span class="board-author-name">${post.author}</span>
                                </div>
                                <span class="board-time">${timeStr}</span>
                            </div>
                            <h3 class="board-title">${post.title}</h3>
                            <p class="board-preview">${post.body}</p>
                            <div class="board-footer">
                                <span>조회 ${post.views}회</span>
                                <div class="board-stats">
                                    <span><i class="fa-regular fa-comment"></i> <span id="comment-cnt-${doc.id}">0</span></span>
                                    <span style="cursor: pointer; padding: 0.25rem 0.5rem; border-radius: 4px; transition: background 0.2s;" onclick="event.stopPropagation(); likePost('${doc.id}')" title="좋아요"><i class="${heartIcon}" style="${heartColor}"></i> ${post.likes || 0}</span>
                                </div>
                            </div>
                        </div>
                    `;
                    boardContainer.insertAdjacentHTML('beforeend', cardHtml);

                    const newCard = boardContainer.lastElementChild;
                    newCard.addEventListener('click', () => openPostDetail(doc.id, post, avatarHtml, timeStr));

                    // 댓글 수 불러오기
                    db.collection('posts').doc(doc.id).collection('comments').onSnapshot(snap => {
                        const el = document.getElementById(`comment-cnt-${doc.id}`);
                        if(el) el.innerText = snap.size;
                    });
                });
            });
        }

        // 초기 로드
        loadPosts('latest');

        // 커스텀 드롭다운 로직
        const customDropdownContainer = document.getElementById('customSortDropdown');
        const customSortSelected = document.getElementById('customSortSelected');
        const customSortOptions = document.getElementById('customSortOptions');
        const customSortOptionItems = document.querySelectorAll('.custom-dropdown-option');

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

        let commentUnsubscribe = null;

        // 상세 닫기 함수
        function closeSideDetail() {
            const sideDetailContainer = document.getElementById('sideDetailContainer');
            if (sideDetailContainer) {
                sideDetailContainer.classList.add('hidden');
            }
            if (postUnsubscribe) {
                postUnsubscribe();
                postUnsubscribe = null;
            }
            if (commentUnsubscribe) {
                commentUnsubscribe();
                commentUnsubscribe = null;
            }
            currentPostId = null;
        }

        // 상세 페이지 렌더링
        function openPostDetail(id, post, avatar, timeStr) {
            currentPostId = id;
            const area = document.getElementById('detailPostArea');
            
            // 조회수 증가
            db.collection('posts').doc(id).update({ views: firebase.firestore.FieldValue.increment(1) });

            if (postUnsubscribe) postUnsubscribe();
            postUnsubscribe = db.collection('posts').doc(id).onSnapshot(docSnap => {
                if (!docSnap.exists) return;
                const currentPost = docSnap.data();

                const isPresident = currentUser && currentUser.email === 'gimdong2804@gmail.com';
                const isAuthor = currentUser && (currentPost.uid === currentUser.uid || isPresident);
                
                // 삭제 버튼 (작성자 또는 회장)
                const deleteBtnHtml = isAuthor ? `
                    <button onclick="deletePost('${id}')" style="background: none; border: none; color: #ff6b6b; cursor: pointer; font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 0.25rem;" title="삭제하기">
                        <i class="fa-solid fa-trash-can"></i> 삭제
                    </button>
                ` : '';
                
                // 고정 버튼 (회장 전용)
                const pinBtnHtml = isPresident ? `
                    <button onclick="togglePin('${id}', ${currentPost.pinned || false})" style="background: none; border: none; color: ${currentPost.pinned ? 'var(--accent-color)' : 'var(--text-secondary)'}; cursor: pointer; font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 0.25rem; margin-right: 1rem;" title="${currentPost.pinned ? '고정 해제' : '상단 고정'}">
                        <i class="fa-solid fa-thumbtack"></i> ${currentPost.pinned ? '고정됨' : '고정하기'}
                    </button>
                ` : '';

                const isLiked = currentUser && currentPost.likedUsers && currentPost.likedUsers.includes(currentUser.uid);
                const heartIcon = isLiked ? 'fa-solid fa-heart animate-heart' : 'fa-regular fa-heart';
                const heartColor = isLiked ? 'color: #ff6b6b;' : 'color: var(--text-primary);';

                area.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <div style="color: var(--accent-color); font-size: 0.85rem; font-weight: 600;">건의방 · 제안</div>
                        <div style="display: flex; align-items: center;">
                            ${pinBtnHtml}
                            ${deleteBtnHtml}
                        </div>
                    </div>
                    <h2 class="post-body-title" style="margin-bottom: 0.5rem; font-size: 1.6rem; color: var(--text-primary);">${currentPost.title}</h2>
                    <div style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1.5rem;">
                        ${timeStr} &nbsp;|&nbsp; 조회 ${currentPost.views || 0}회
                    </div>
                    
                    <div class="board-card-header" style="margin-bottom: 2rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 1rem;">
                        <div class="board-author" style="flex: 1;">
                            ${avatar}
                            <span class="board-author-name" style="font-weight: 600; font-size: 1rem;">${currentPost.author}</span>
                        </div>
                        <div class="board-stats" style="font-size: 0.95rem;">
                            <span><i class="fa-regular fa-comment"></i> <span id="detailTopCommentCount">0</span></span>
                            <span style="cursor: pointer; transition: color 0.3s; ${heartColor}" onclick="likePost('${id}')" id="detailLikeBtn"><i class="${heartIcon}"></i> <span id="detailLikeCnt">${currentPost.likes || 0}</span></span>
                        </div>
                    </div>
                    
                    <div class="post-body" style="font-size: 1.05rem; line-height: 1.7; color: var(--text-primary); padding-bottom: 1rem;">
                        ${currentPost.body.replace(/\n/g, '<br>')}
                    </div>
                `;
            });

            // 댓글 실시간 렌더링
            const commentArea = document.getElementById('detailCommentArea');
            if (commentUnsubscribe) commentUnsubscribe();
            commentUnsubscribe = db.collection('posts').doc(id).collection('comments').onSnapshot(snap => {
                const topCountEl = document.getElementById('detailTopCommentCount');
                if (topCountEl) topCountEl.innerText = snap.size;

                // 클라이언트 단에서 정렬: pinned가 참이면 위로, 그 다음 작성일 순 정렬
                const sortedDocs = [...snap.docs].sort((a, b) => {
                    const pinA = a.data().pinned ? 1 : 0;
                    const pinB = b.data().pinned ? 1 : 0;
                    if (pinB !== pinA) {
                        return pinB - pinA; // 고정이 위로
                    }
                    const timeA = (a.data().createdAt && typeof a.data().createdAt.toMillis === 'function') ? a.data().createdAt.toMillis() : (a.data().createdAt instanceof Date ? a.data().createdAt.getTime() : 0);
                    const timeB = (b.data().createdAt && typeof b.data().createdAt.toMillis === 'function') ? b.data().createdAt.toMillis() : (b.data().createdAt instanceof Date ? b.data().createdAt.getTime() : 0);
                    return timeA - timeB; // 작성일 오름차순
                });

                const commentsHtml = sortedDocs.map(cDoc => {
                    const c = cDoc.data();
                    const cTime = formatDate(c.createdAt);
                    const isPresidentComment = c.author.includes('회장') || (c.email && c.email === 'gimdong2804@gmail.com');
                    const badge = isPresidentComment ? '<span class="official-badge" style="background: var(--accent-color); color: #fff; font-size: 0.75rem; padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: bold; margin-left: 0.5rem;">공식 답변</span>' : '';
                    
                    // 고정 댓글 뱃지
                    const cPinBadge = c.pinned ? '<span style="background: var(--accent-color); color: #fff; font-size: 0.7rem; padding: 0.1rem 0.3rem; border-radius: 4px; font-weight: bold; margin-left: 0.5rem;"><i class="fa-solid fa-thumbtack"></i> 고정됨</span>' : '';
                    
                    let cAvatarHtml = `<div class="board-author-avatar" style="background: ${isPresidentComment ? 'var(--accent-color)' : '#9ca3af'}; width: 32px; height: 32px; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #fff;">${isPresidentComment ? '<i class="fa-solid fa-crown" style="font-size: 0.6rem;"></i>' : c.author.substring(0,1)}</div>`;
                    if (c.userPhoto) {
                        cAvatarHtml = `<img class="board-author-avatar" src="${c.userPhoto}" alt="${c.author}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 50%; border: 1px solid var(--glass-border);">`;
                    }

                    const isCommentAuthor = currentUser && (c.uid === currentUser.uid || currentUser.email === 'gimdong2804@gmail.com');
                    const cDeleteBtn = isCommentAuthor ? `
                        <button onclick="deleteComment('${id}', '${cDoc.id}')" style="background: none; border: none; color: #ff6b6b; cursor: pointer; font-size: 0.8rem; margin-left: 0.5rem; display: flex; align-items: center; padding: 0.25rem;" title="댓글 삭제">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    ` : '';

                    // 회장 전용 댓글 고정 버튼
                    const isPresident = currentUser && currentUser.email === 'gimdong2804@gmail.com';
                    const cPinBtn = isPresident ? `
                        <button onclick="togglePinComment('${id}', '${cDoc.id}', ${c.pinned || false})" style="background: none; border: none; color: ${c.pinned ? 'var(--accent-color)' : 'var(--text-secondary)'}; cursor: pointer; font-size: 0.8rem; margin-left: auto; display: flex; align-items: center; padding: 0.25rem;" title="${c.pinned ? '댓글 고정 해제' : '댓글 고정'}">
                            <i class="fa-solid fa-thumbtack"></i>
                        </button>
                    ` : '';

                    // 고정 댓글 전용 배경 및 테두리 스타일
                    const cItemStyle = c.pinned ? 'border: 1px solid var(--accent-color); background: rgba(59, 130, 246, 0.05); border-radius: 12px; padding: 1rem;' : 'border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 1rem;';

                    return `
                        <div class="comment-item comment-slide-in" id="comment-${cDoc.id}" style="display: flex; align-items: flex-start; gap: 0.75rem; margin-bottom: 1.25rem; ${cItemStyle}">
                            ${cAvatarHtml}
                            <div class="comment-content" style="flex: 1; min-width: 0; padding-top: 0.2rem;">
                                <div class="comment-header" style="display: flex; align-items: center; gap: 0.5rem;">
                                    <span class="board-author-name" style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary);">${c.author}</span>
                                    ${badge}
                                    ${cPinBadge}
                                    <span class="comment-time" style="font-size: 0.75rem; color: var(--text-secondary); margin-left: 0.5rem;">${cTime}</span>
                                    ${cPinBtn}
                                    ${cDeleteBtn}
                                </div>
                                <div class="comment-text" style="margin-top: 0.3rem; font-size: 0.95rem; line-height: 1.5; color: var(--text-primary); word-break: break-all;">${c.body}</div>
                            </div>
                        </div>
                    `;
                }).join('');
                commentArea.innerHTML = `<h3 style="margin-bottom: 1.5rem; color: var(--text-primary); font-size: 1.1rem;">댓글 <span style="color: var(--accent-color);" id="detailCommentCount">${snap.size}</span></h3>` + commentsHtml;
            });

            const sideDetailContainer = document.getElementById('sideDetailContainer');
            if (sideDetailContainer) {
                sideDetailContainer.classList.remove('hidden');
                sideDetailContainer.scrollTop = 0;
            }
        }

        // 상세 닫기 이벤트 바인딩
        const closeSideDetailBtn = document.getElementById('closeSideDetailBtn');
        if (closeSideDetailBtn) {
            closeSideDetailBtn.addEventListener('click', closeSideDetail);
        }

        window.likePost = async function(id) {
            if (!currentUser) {
                alert('좋아요를 누르시려면 먼저 Google 로그인을 해주세요!');
                openDrawer();
                return;
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
            }
        };

        window.togglePin = async function(id, currentPinned) {
            if(!currentUser || currentUser.email !== 'gimdong2804@gmail.com') return;
            try {
                await db.collection('posts').doc(id).update({ pinned: !currentPinned });
            } catch(e) { console.error(e); }
        };

        window.togglePinComment = async function(postId, commentId, currentPinned) {
            if(!currentUser || currentUser.email !== 'gimdong2804@gmail.com') return;
            try {
                await db.collection('posts').doc(postId).collection('comments').doc(commentId).update({ pinned: !currentPinned });
            } catch(e) { console.error(e); }
        };

        window.deletePost = async function(id) {
            if (!confirm('정말로 이 건의사항을 삭제하시겠습니까?')) return;
            try {
                await db.collection('posts').doc(id).delete();
                alert('건의사항이 성공적으로 삭제되었습니다.');
                closeSideDetail();
            } catch (error) {
                console.error("Error deleting post: ", error);
                alert('삭제 중 오류가 발생했습니다.');
            }
        };

        window.deleteComment = async function(postId, commentId) {
            if (!confirm('정말로 이 댓글을 삭제하시겠습니까?')) return;
            const commentEl = document.getElementById(`comment-${commentId}`);
            
            if (commentEl) {
                commentEl.classList.remove('comment-slide-in');
                commentEl.classList.add('comment-fade-out');
                
                setTimeout(async () => {
                    try {
                        await db.collection('posts').doc(postId).collection('comments').doc(commentId).delete();
                    } catch (error) {
                        console.error("Error deleting comment: ", error);
                        alert('댓글 삭제 실패');
                    }
                }, 400);
            } else {
                try {
                    await db.collection('posts').doc(postId).collection('comments').doc(commentId).delete();
                } catch (error) {
                    console.error("Error deleting comment: ", error);
                    alert('댓글 삭제 실패');
                }
            }
        };

        // 댓글 작성 로직
        const commentSubmitBtn = document.querySelector('.side-detail-container .comment-submit-btn');
        const commentInput = document.querySelector('.side-detail-container .comment-input');
        if (commentSubmitBtn && commentInput) {
            commentSubmitBtn.addEventListener('click', async () => {
                if (!currentUser) {
                    alert('댓글을 작성하시려면 먼저 Google 로그인을 해주세요!');
                    openDrawer();
                    return;
                }
                if(!currentPostId) return;
                const body = commentInput.value.trim();
                if(body === '') return;

                try {
                    await db.collection('posts').doc(currentPostId).collection('comments').add({
                        author: currentUser.email === 'gimdong2804@gmail.com' ? "회장 김동현" : currentUser.displayName,
                        uid: currentUser.uid,
                        userPhoto: currentUser.photoURL || '',
                        email: currentUser.email,
                        body: body,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    commentInput.value = '';
                } catch(e) {
                    console.error(e);
                    alert('댓글 작성 실패');
                }
            });
            
            // 엔터키 지원 추가
            commentInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    commentSubmitBtn.click();
                }
            });
        }

        // 사이드 메뉴 아이템 클릭 시 알림 및 드로어 닫기 (인사말, 목표, 건의방 제외)
        document.querySelectorAll('.drawer-menu a:not(#greetingLink):not(#goalLink):not(#suggestionLink)').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const title = item.innerText.trim();
                alert(title + ' 페이지로 이동 기능은 아직 준비 중입니다.');
                closeDrawer();
            });
        });

    