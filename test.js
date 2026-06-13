
        // ?Œë§ˆ ? ê? ë¡œì§
        const themeToggleBtn = document.getElementById('themeToggleBtn');
        const rootElement = document.documentElement;

        // ?€?¥ëœ ?Œë§ˆ ë¶ˆëŸ¬?¤ê¸° (ê¸°ë³¸ê°?dark)
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

        // ?¬ì´???œë¡œ???œì–´ ë¡œì§
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

        // ESC ???…ë ¥ ???¬ì´???œë¡œ???«ê¸°
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeDrawer();
            }
        });

        // ?„ì½”?”ì–¸ ë©”ë‰´ ê°œë³„ ? ê? (?¤ì¤‘ ?´ê¸° ?ˆìš© ë°?ë¶€?œëŸ¬??? ë‹ˆë©”ì´???°ë™)
        const categories = document.querySelectorAll('.menu-category');
        categories.forEach(category => {
            category.querySelector('.category-header').addEventListener('click', () => {
                category.classList.toggle('active');
            });
        });

        // ?˜ì´ì§€ ?„í™˜ ë¡œì§
        const mainPage = document.getElementById('mainPage');
        const greetingPage = document.getElementById('greetingPage');
        const goalPage = document.getElementById('goalPage');
        const greetingLink = document.getElementById('greetingLink');
        const goalLink = document.getElementById('goalLink');
        const backBtn = document.getElementById('backBtn');
        const goalBackBtn = document.getElementById('goalBackBtn');
        const siteFooter = document.querySelector('footer');
        let currentPage = mainPage;

        // ì»¤ìŠ¤?€ ?¤í¬ë¡¤ë°” ?œì–´ ë³€??ë°??¨ìˆ˜
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

            // ?¤í¬ë¡¤ë°”ê°€ ?„ìš” ?†ëŠ” ê²½ìš° ?ëŠ” greetingPageê°€ ë¹„í™œ?±í™” ?íƒœ???ŒëŠ” ?¨ê?
            const isGreetingActive = !greetingPage.classList.contains('hidden') && greetingPage.classList.contains('fade-in');
            if (scrollHeight <= clientHeight || !isGreetingActive) {
                customScrollbar.classList.remove('visible');
                return;
            }

            // ?¤ë” ?’ì´ë¥?êµ¬í•´ ?¤í¬ë¡¤ë°” ?œì‘ ì§€?ì„ ?¤ë” ë°”ë¡œ ?„ë˜ë¡??¤ì •
            const header = document.querySelector('header');
            const headerHeight = header ? header.offsetHeight : 70;
            customScrollbar.style.top = `${headerHeight + 6}px`;

            // ?¤í¬ë¡¤ë°” ?¸ë™ ?¬ë°±(top/bottom ê°?6px) ë°??¤ë” ?’ì´ë¥?ê³ ë ¤???¸ë™ ?¬ê¸° ê³„ì‚°
            const trackHeight = clientHeight - headerHeight - 12;
            
            // ??ìµœì†Œ ?’ì´ 30px ?¤ì •
            const thumbHeight = Math.max(30, (clientHeight / scrollHeight) * trackHeight);
            const maxScrollTop = scrollHeight - clientHeight;
            const maxThumbTop = trackHeight - thumbHeight;
            
            const thumbTop = maxScrollTop > 0 ? (scrollTop / maxScrollTop) * maxThumbTop : 0;

            customScrollbarThumb.style.height = `${thumbHeight}px`;
            customScrollbarThumb.style.transform = `translateY(${thumbTop}px)`;

            // ?¤í¬ë¡????¤í¬ë¡¤ë°”ë¥?ë³´ì´ê²???
            customScrollbar.classList.add('visible');

            // ?€?´ë¨¸ ?¬ì„¤??(?¬ìš© ì¤‘ì´ ?„ë‹ ??1.5ì´????˜ì´???„ì›ƒ)
            clearTimeout(scrollTimeout);
            if (!isDragging && !isHoveringScrollbar) {
                scrollTimeout = setTimeout(() => {
                    customScrollbar.classList.remove('visible');
                }, 1500);
            }
        }

        function showScrollbar() {
            // ?ˆì´?„ì›ƒ???„ì „??ë°˜ì˜?????’ì´ ì²´í¬ ë°??œì‹œ
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

        // ?¤í¬ë¡?ë°?ì°??¬ê¸° ë³€ê²?ê°ì?
        window.addEventListener('scroll', updateScrollbar, { passive: true });
        window.addEventListener('resize', () => {
            updateScrollbar();
            
            // ?ì„¸?”ë©´???´ë ¤?ˆì„ ???”ë©´ ?¬ê¸°???°ë¼ DOM ?„ì¹˜ë¥?ë³´ì •?©ë‹ˆ??
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

        // ?¤í¬ë¡¤ë°” ?ì—­ ë§ˆìš°???¸ë²„ ê°ì? (?¸ë²„ ??ê³„ì† ?œì‹œ?˜ë„ë¡???
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
                }, 1000); // ë§ˆìš°?¤ê? ë²—ì–´????1ì´????¨ê?
            }
        });

        // ?¤í¬ë¡¤ë°” ë§ˆìš°???œë˜ê·?ê¸°ëŠ¥
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
                
                // ë§ˆìš°???œë˜ê·¸ê? ?ë‚¬?????¸ë²„ ì¤‘ì´ ?„ë‹ˆ?¼ë©´ ?¼ì • ?œê°„ ???¬ë¼ì§?
                if (!isHoveringScrollbar) {
                    scrollTimeout = setTimeout(() => {
                        customScrollbar.classList.remove('visible');
                    }, 1000);
                }
            }
        });

        function switchPage(fromPage, toPage) {
            if (fromPage === toPage) return; // ?™ì¼???˜ì´ì§€ë¡œì˜ ?„í™˜?€ ë¬´ì‹œ
            
            // ?„ì¬ ?˜ì´ì§€ fade out
            fromPage.classList.add('fade-out');
            fromPage.classList.remove('fade-in');
            
            // ë©”ì¸ ?˜ì´ì§€?ì„œ ?œë¸Œ ?˜ì´ì§€ë¡??´ë™?????¸í„° ?˜ì´???„ì›ƒ ?œì‘
            if (fromPage === mainPage) {
                siteFooter.classList.add('fade-out');
            }
            
            // ?˜ì´ì§€ê°€ ë°”ë€????°ì„  ?¤í¬ë¡¤ë°” ?¨ê¸°ê¸?
            hideScrollbar();

            setTimeout(() => {
                fromPage.classList.add('hidden');
                toPage.classList.remove('hidden');
                
                // ê°•ì œ ë¦¬í”Œë¡œìš°ë¥?ë°œìƒ?œì¼œ display ?íƒœ??ë³€?”ë? ?¸ì??˜ë„ë¡?ì²˜ë¦¬
                toPage.offsetHeight;
                
                // ?¤í¬ë¡??„ë¡œ
                window.scrollTo({ top: 0, behavior: 'instant' });
                // ???˜ì´ì§€ fade in
                requestAnimationFrame(() => {
                    toPage.classList.remove('fade-out');
                    toPage.classList.add('fade-in');
                    
                    if (toPage === mainPage) {
                        // ë©”ì¸ ?˜ì´ì§€ë¡??Œì•„???ŒëŠ” ?¸í„° displayë¥?ë³µì›?˜ê³  ?˜ì´?????ìš©
                        siteFooter.style.display = '';
                        siteFooter.offsetHeight; // ë¦¬í”Œë¡œìš°
                        siteFooter.classList.remove('fade-out');
                    } else {
                        // ?œë¸Œ ?˜ì´ì§€ë¡??„í™˜ ?„ë£Œ ?œì ?ëŠ” ?¸í„°ë¥??„ì „???¨ê?
                        siteFooter.style.display = 'none';
                    }

                    // ?¸ì‚¬ë§??˜ì´ì§€ë¡??”ì„ ?Œë§Œ ?˜ì´???¸ìœ¼ë¡??¤í¬ë¡¤ë°” ?¸ì¶œ
                    if (toPage === greetingPage) {
                        showScrollbar();
                    }
                    
                    // ?„ì¬ ?œì„±?”ëœ ?˜ì´ì§€ ?íƒœ ?…ë°?´íŠ¸
                    currentPage = toPage;

                    // [?˜ì •] ?‘ì„± ë²„íŠ¼ ê°€?œì„± ?…ë°?´íŠ¸ (?µí•© ?¨ìˆ˜ ?¸ì¶œ)
                    if (typeof updateWriteButtonVisibility === 'function') {
                        updateWriteButtonVisibility(toPage);
                    }
                });
            }, 400);
        }

        // [ì¶”ê?] ?‘ì„± ë²„íŠ¼ ê°€?œì„± ?µí•© ?œì–´ ?¨ìˆ˜
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
                btn.style.transform = 'scale(1) rotate(0)';
            } else {
                btn.classList.add('fab-hidden');
                btn.style.opacity = '0';
                btn.style.pointerEvents = 'none';
                btn.style.visibility = 'hidden';
                btn.style.transform = 'scale(0.8) rotate(45deg)';
            }
        }

        greetingLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeDrawer();
            switchPage(currentPage, greetingPage);
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

        // ì»¤ë??ˆí‹° ?¼ìš°??
        const suggestionLink = document.getElementById('suggestionLink');
        const suggestionPage = document.getElementById('suggestionPage');
        const suggestionBackBtn = document.getElementById('suggestionBackBtn');
        suggestionLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeDrawer();
            switchPage(currentPage, suggestionPage);
        });

        suggestionBackBtn.addEventListener('click', () => {
            closeSideDetail();
            switchPage(currentPage, mainPage);
        });

        // Firebase ?°ë™ ë¡œì§
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

        // ë¡œê·¸???íƒœ ë³€??
        let currentUser = null;

        // êµ¬ê? ë¡œê·¸??ê´€??DOM
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
                alert("ë¡œê·¸??ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤: Firebase ?¸ì¦ ?¤ì •?ì„œ ?„ì¬ ?¬ì´??ì£¼ì†Œë¥??¹ì¸???„ë©”?¸ì— ì¶”ê??´ì•¼ ?©ë‹ˆ??");
                return;
            }
            alert("ë¡œê·¸??ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤: " + ((error && error.message) || "?????†ëŠ” ?¤ë¥˜"));
        }

        // êµ¬ê? ë¡œê·¸???°ë™
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

        // ë¡œê·¸?„ì›ƒ
        logoutBtn.addEventListener('click', async () => {
            try {
                await auth.signOut();
            } catch (error) {
                console.error("Sign-Out Error: ", error);
            }
        });

        // Auth ?íƒœ ë¦¬ìŠ¤??
        let authUITimeout;
        auth.onAuthStateChanged((user) => {
            clearTimeout(authUITimeout);
            const postAuthorInput = document.getElementById('postAuthor');
            if (user) {
                currentUser = user;
                // UI ?…ë°?´íŠ¸ (? ë‹ˆë©”ì´???ìš©)
                googleLoginBtn.classList.add('fade-out');
                authUITimeout = setTimeout(() => {
                    googleLoginBtn.classList.add('hidden');
                    googleLoginBtn.classList.remove('fade-out');
                    
                    userProfileInfo.classList.remove('hidden');
                    userProfileInfo.classList.add('fade-out');
                    // ê°•ì œ ë¦¬í”Œë¡œìš°
                    userProfileInfo.offsetHeight;
                    userProfileInfo.classList.remove('fade-out');
                }, 300);

                const isPresident = user.email === 'gimdong2804@gmail.com';
                userName.innerText = isPresident ? "?Œì¥ ê¹€?™í˜„" : user.displayName;
                userEmail.innerText = user.email;
                userAvatar.src = user.photoURL || '';

                if (postAuthorInput) {
                    postAuthorInput.value = isPresident ? "?Œì¥ ê¹€?™í˜„" : user.displayName;
                    postAuthorInput.placeholder = "?‘ì„±???´ë¦„";
                }

                // [ì¶”ê?] ë¡œê·¸???íƒœ???°ë¼ ê²Œì‹œê¸€ ëª©ë¡ ë¦¬ë¡œ??(ê³ ì • ë²„íŠ¼ ?œì‹œ/?¨ê???
                const currentSort = document.querySelector('.custom-dropdown-option.active')?.getAttribute('data-value') || 'latest';
                loadPosts(currentSort);
            } else {
                currentUser = null;
                // UI ?…ë°?´íŠ¸ (? ë‹ˆë©”ì´???ìš©)
                userProfileInfo.classList.add('fade-out');
                authUITimeout = setTimeout(() => {
                    userProfileInfo.classList.add('hidden');
                    userProfileInfo.classList.remove('fade-out');
                    
                    googleLoginBtn.classList.remove('hidden');
                    googleLoginBtn.classList.add('fade-out');
                    // ê°•ì œ ë¦¬í”Œë¡œìš°
                    googleLoginBtn.offsetHeight;
                    googleLoginBtn.classList.remove('fade-out');
                }, 300);
                
                if (postAuthorInput) {
                    postAuthorInput.value = '';
                    postAuthorInput.placeholder = "ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ??;
                }

                // [ì¶”ê?] ë¡œê·¸?„ì›ƒ ?œì—??ëª©ë¡ ë¦¬ë¡œ??(ê³ ì • ë²„íŠ¼ ?¨ê???
                const currentSort = document.querySelector('.custom-dropdown-option.active')?.getAttribute('data-value') || 'latest';
                loadPosts(currentSort);
            }
        });

        // ?˜ì´ì§€ ë°?ê¸€?°ê¸° ê´€??DOM
        const writePostPage = document.getElementById('writePostPage');
        const writePostBackBtn = document.getElementById('writePostBackBtn');
        const writePostBtn = document.getElementById('writePostBtn');
        const submitPostBtn = document.getElementById('submitPostBtn');
        const boardContainer = document.querySelector('.board-container');

        writePostBtn.addEventListener('click', () => {
            if (!currentUser) {
                alert('ê±´ì˜?¬í•­???‘ì„±?˜ì‹œ?¤ë©´ ë¨¼ì? Google ë¡œê·¸?¸ì„ ?´ì£¼?¸ìš”!');
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

        // ?´ë?ì§€ ?…ë¡œ??ë¡œì§
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

        if(imageFileInput) {
            imageFileInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                if (selectedImages.length + files.length > MAX_IMAGES) {
                    alert(`?¬ì§„?€ ìµœë? ${MAX_IMAGES}?¥ê¹Œì§€ë§?ì¶”ê??????ˆìŠµ?ˆë‹¤.`);
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
                imageCountInfo.textContent = `${selectedImages.length} / ${MAX_IMAGES}??;
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
                        <img src="${e.target.result}" alt="ë¯¸ë¦¬ë³´ê¸°" style="cursor: pointer;" onclick="openLightbox('${e.target.result}')">
                        <button class="image-preview-remove" onclick="removeImage(${index})"><i class="fa-solid fa-xmark"></i></button>
                    `;
                    imagePreviewContainer.appendChild(div);
                };
                reader.readAsDataURL(file);
            });
        }

        window.removeImage = function(index) {
            selectedImages.splice(index, 1);
            updateImagePreview();
        };

        // Firebase ?°ì´???±ë¡ (ê¸€?°ê¸°)
        submitPostBtn.addEventListener('click', async () => {
            if (!currentUser) {
                alert('ë¡œê·¸?¸ì´ ?„ìš”???œë¹„?¤ì…?ˆë‹¤.');
                return;
            }
            const title = document.getElementById('postTitle').value.trim();
            const author = currentUser.email === 'gimdong2804@gmail.com' ? "?Œì¥ ê¹€?™í˜„" : currentUser.displayName;
            const body = document.getElementById('postBody').value.trim();

            if (!title || !body) {
                alert('?œëª©ê³??´ìš©??ëª¨ë‘ ?…ë ¥?´ì£¼?¸ìš”!');
                return;
            }

            submitPostBtn.innerText = '?€??ì¤?..';
            submitPostBtn.disabled = true;

            try {
                const imageUrls = [];
                if (selectedImages.length > 0) {
                    submitPostBtn.innerText = '?´ë?ì§€ ?…ë¡œ??ì¤?..';
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
                            throw new Error('?´ë?ì§€ ?…ë¡œ???¤íŒ¨: ' + (data.error ? data.error.message : '?????†ëŠ” ?¤ë¥˜'));
                        }
                    }
                }
                
                submitPostBtn.innerText = 'ê²Œì‹œë¬??€??ì¤?..';
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
                selectedImages = [];
                updateImagePreview();
                closeWritePage();
            } catch (error) {
                console.error("Error adding post: ", error);
                alert('?…ë¡œ??ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤: ' + error.message);
            } finally {
                submitPostBtn.innerText = 'ê²Œì‹œê¸€ ?±ë¡?˜ê¸°';
                submitPostBtn.disabled = false;
            }
        });

        // Firebase ?°ì´???¤ì‹œê°?ë¶ˆëŸ¬?¤ê¸°
        function formatDate(timestamp) {
            if (!timestamp) return 'ë°©ê¸ˆ ??;
            try {
                if (typeof timestamp.toDate === 'function') {
                    const d = timestamp.toDate();
                    const ampm = d.getHours() < 12 ? '?¤ì „' : '?¤í›„';
                    const h = d.getHours() % 12 || 12;
                    const m = String(d.getMinutes()).padStart(2, '0');
                    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${ampm} ${h}:${m}`;
                }
                if (timestamp instanceof Date) {
                    const ampm = timestamp.getHours() < 12 ? '?¤ì „' : '?¤í›„';
                    const h = timestamp.getHours() % 12 || 12;
                    const m = String(timestamp.getMinutes()).padStart(2, '0');
                    return `${timestamp.getFullYear()}. ${timestamp.getMonth() + 1}. ${timestamp.getDate()}. ${ampm} ${h}:${m}`;
                }
                if (typeof timestamp.toMillis === 'function') {
                    const d = new Date(timestamp.toMillis());
                    const ampm = d.getHours() < 12 ? '?¤ì „' : '?¤í›„';
                    const h = d.getHours() % 12 || 12;
                    const m = String(d.getMinutes()).padStart(2, '0');
                    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${ampm} ${h}:${m}`;
                }
            } catch (e) {
                console.error(e);
            }
            return String(timestamp);
        }

        let currentPostId = null; // ?ì„¸ ?˜ì´ì§€???„ì—­ ë³€??

        let postsUnsubscribe = null;
        let postUnsubscribe = null;

        function loadPosts(sortBy = 'latest') {
            if (postsUnsubscribe) {
                postsUnsubscribe();
            }

            let query = db.collection('posts').orderBy('createdAt', 'desc');

            postsUnsubscribe = query.onSnapshot((snapshot) => {
                // 1. ?´ì „ ?„ì¹˜ ë°??°ì´???¤ëƒ…???€??
                const oldPositions = new Map();
                const oldData = new Map();
                boardContainer.querySelectorAll('.board-card').forEach(card => {
                    const id = card.getAttribute('data-id');
                    oldPositions.set(id, card.getBoundingClientRect());
                    // ?„ì¬ ?íƒœ ë°±ì—… (ê³ ì • ë°?ì¢‹ì•„???¬ë? ?•ì¸??
                    oldData.set(id, { 
                        pinned: card.classList.contains('pinned-state'),
                        liked: card.querySelector('.fa-heart') ? card.querySelector('.fa-heart').classList.contains('fa-solid') : false
                    });
                });

                // 2. ?„ì¬ ?¤ëƒ…?·ì˜ ID ëª©ë¡
                const currentIds = new Set(snapshot.docs.map(doc => doc.id));

                // 3. ?? œ??ì¹´ë“œ ?œê±° (? ë‹ˆë©”ì´???†ì´ ì¦‰ì‹œ ?œê±°?˜ê±°???„ìš”???˜ì´?œì•„??ì¶”ê? ê°€??
                boardContainer.querySelectorAll('.board-card').forEach(card => {
                    if (!currentIds.has(card.getAttribute('data-id'))) {
                        card.remove();
                    }
                });

                // ì´?ê¸€ ê°œìˆ˜ ?…ë°?´íŠ¸
                const headerSpan = document.querySelector('.board-header span');
                if(headerSpan) {
                    headerSpan.innerHTML = `?„ì²´ ê²Œì‹œê¸€ <span style="color: var(--accent-color); font-weight: bold;">${snapshot.size}</span>ê°?;
                }

                // 4. ?•ë ¬ ë¡œì§ (ê¸°ì¡´ê³??™ì¼)
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

                // 5. ?¤ë§ˆ??ë¦¬ë Œ?”ë§: ê¸°ì¡´ ì¹´ë“œ???…ë°?´íŠ¸?˜ê³  ?„ì¹˜ë§??´ë™
                docs.forEach((doc, index) => {
                    const post = doc.data();
                    const id = doc.id;
                    const timeStr = formatDate(post.createdAt);
                    const isPresident = currentUser && currentUser.email === 'gimdong2804@gmail.com';
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
                        <div class="pin-badge-wrapper ${wasPinned ? 'active' : ''}">
                            <span class="pin-badge-ui" style="background: var(--accent-color); color: #fff; font-size: 0.7rem; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: bold; display: inline-block;">
                                <i class="fa-solid fa-thumbtack"></i> ?ë‹¨ ê³ ì •
                            </span>
                        </div>
                    `;

                    const innerHtml = `
                        ${pinBadgeHtml}
                        <div class="board-card-header">
                            <div class="board-author" style="display: flex; align-items: center; gap: 0.5rem;">
                                ${avatarHtml}
                                <span class="board-author-name">${post.author}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                ${isPresident ? `
                                    <button type="button" class="board-action-btn pin-toggle-btn ${wasPinned ? 'active' : ''}"
                                            onclick="event.stopPropagation(); togglePin('${id}', ${post.pinned || false})"
                                            title="${post.pinned ? 'ê³ ì • ?´ì œ' : '?ë‹¨ ê³ ì •'}">
                                        <i class="fa-solid fa-thumbtack"></i>
                                    </button>` : ''}
                                ${isAuthor ? `
                                    <button type="button" class="board-action-btn delete-btn"
                                            onclick="event.stopPropagation(); deletePostWithAnim('${id}', this)"
                                            title="ê²Œì‹œê¸€ ?? œ">
                                        <i class="fa-solid fa-trash-can"></i>
                                    </button>` : ''}
                                <span class="board-time">${timeStr}</span>
                            </div>
                        </div>
                        <h3 class="board-title">${post.title}</h3>
                        <p class="board-preview">${post.body}</p>
                        <div class="board-footer">
                            <span>ì¡°íšŒ ${post.views}??/span>
                            <div class="board-stats">
                                <button type="button" class="board-action-btn board-comment-btn" title="?“ê? ë³´ê¸°">
                                    <i class="fa-regular fa-comment"></i> <span id="comment-cnt-${id}">0</span>
                                </button>
                                <button type="button" class="board-action-btn" onclick="event.stopPropagation(); likePost('${id}', this)">
                                    <i class="${isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart'} fa-fw" style="${isLiked ? 'color: #ff6b6b;' : ''}"></i> <span class="like-count">${post.likes || 0}</span>
                                </button>
                            </div>
                        </div>
                    `;

                    if (isNew) {
                        const cardElement = document.createElement('div');
                        cardElement.className = `board-card ${post.pinned ? 'pinned-state' : ''}`;
                        cardElement.setAttribute('data-id', id);
                        cardElement.innerHTML = innerHtml;
                        cardElement.style.order = index; // CSS Orderë¥??¬ìš©?˜ì—¬ ?œê°???œì„œ ?œì–´
                        boardContainer.appendChild(cardElement);
                        card = cardElement;

                        // ?´ë²¤??ë°”ì¸??
                        card.addEventListener('click', () => openPostDetail(id, card._latestPost || post, avatarHtml, timeStr, 'fullscreen'));
                        
                        if (post.pinned) {
                            card.offsetHeight; // ê°•ì œ ë¦¬í”Œë¡œìš°ë¡??Œë”ë§??€?´ë° ë³´ì¥
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
                            if(el) el.innerText = snap.size;
                        });
                    } else {
                        // Update latest post for the click listener
                        card._latestPost = post;
                        
                        const titleEl = card.querySelector('.board-title');
                        if (titleEl && titleEl.textContent !== post.title) titleEl.textContent = post.title;
                        
                        const previewEl = card.querySelector('.board-preview');
                        if (previewEl && previewEl.textContent !== post.body) previewEl.textContent = post.body;
                        
                        const viewsEl = card.querySelector('.board-footer > span');
                        if (viewsEl && !viewsEl.textContent.includes(post.views + 'íšŒ')) viewsEl.textContent = 'ì¡°íšŒ ' + post.views + 'íšŒ';
                        
                        const likeBtn = card.querySelector('.board-action-btn[onclick*="likePost"]');
                        if (likeBtn) {
                            const heartIcon = likeBtn.querySelector('i');
                            if (heartIcon) {
                                const isSolid = isLiked;
                                heartIcon.className = (isSolid ? 'fa-solid' : 'fa-regular') + ' fa-heart fa-fw';
                                heartIcon.style.color = isSolid ? '#ff6b6b' : 'var(--text-primary)';
                            }
                            const likeCountEl = likeBtn.querySelector('.like-count');
                            if (likeCountEl) {
                                likeCountEl.textContent = post.likes || 0;
                            }
                        }
                        
                        const pinBadge = card.querySelector('.pin-badge-wrapper');
                        if (pinBadge) pinBadge.className = 'pin-badge-wrapper ' + (post.pinned ? 'active' : '');
                        
                        const pinToggleBtn = card.querySelector('.pin-toggle-btn');
                        if (pinToggleBtn) pinToggleBtn.className = 'board-action-btn pin-toggle-btn ' + (post.pinned ? 'active' : '');

                        card.classList.toggle('pinned-state', post.pinned);
                        card.style.order = index;
                    }

                });

                // 6. FLIP ? ë‹ˆë©”ì´???¤í–‰ (ë¶€?œëŸ¬???´ë™)
                const finalCards = boardContainer.querySelectorAll('.board-card');
                finalCards.forEach(card => {
                    const id = card.getAttribute('data-id');
                    const oldPos = oldPositions.get(id);
                    if (oldPos) {
                        const newPos = card.getBoundingClientRect();
                        const dy = oldPos.top - newPos.top;
                        const dx = oldPos.left - newPos.left;
                        if (dx !== 0 || dy !== 0) {
                            card.style.transition = 'none';
                            card.style.transform = `translate(${dx}px, ${dy}px)`;
                            card.classList.add('flipping');
                            card.offsetHeight; // ë¦¬í”Œë¡œìš°
                            card.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.5s ease';
                            card.style.transform = 'translate(0, 0)';
                            setTimeout(() => {
                                card.classList.remove('flipping');
                            }, 500);
                        }
                    } else {
                        // ??ì¹´ë“œ ?±ì¥
                        card.style.opacity = '0';
                        card.style.transform = 'translateY(15px)';
                        card.offsetHeight;
                        card.style.transition = 'transform 0.5s cubic-bezier(0.2, 0, 0, 1), opacity 0.5s ease';
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                    }
                });
            }, (error) => {
                console.error("onSnapshot error: ", error);
            });
        }

        // ì´ˆê¸° ë¡œë“œ
        loadPosts('latest');

        // ì»¤ìŠ¤?€ ?œë¡­?¤ìš´ ë¡œì§
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
                    
                    // ?œì„±???œì‹œ ?…ë°?´íŠ¸
                    customSortOptionItems.forEach(opt => opt.classList.remove('active'));
                    item.classList.add('active');
                    
                    // ? íƒ???ìŠ¤??ë°??„ì´ì½??…ë°?´íŠ¸
                    customSortSelected.innerHTML = `<span>${textHTML}</span> <i class="fa-solid fa-chevron-down arrow-icon"></i>`;
                    customDropdownContainer.classList.remove('open');

                    // ?°ì´???ˆë¡œê³ ì¹¨
                    loadPosts(value);
                });
            });

            // ë°”ê¹¥ ?ì—­ ?´ë¦­ ???œë¡­?¤ìš´ ?«ê¸°
            document.addEventListener('click', (e) => {
                if (!customDropdownContainer.contains(e.target)) {
                    customDropdownContainer.classList.remove('open');
                }
            });
        }

        let commentUnsubscribe = null;
        let currentDetailMode = 'side';

        // ?ì„¸ ?«ê¸° ?¨ìˆ˜
        function closeSideDetail() {
            const sideDetailContainer = document.getElementById('sideDetailContainer');
            const writePostBtn = document.getElementById('writePostBtn');

            if (sideDetailContainer) {
                // 1. ë¨¼ì? ? ë‹ˆë©”ì´???´ë˜?¤ë? ì¶”ê??˜ì—¬ ?˜ì´???„ì›ƒ/?´ë™ ?œì‘
                sideDetailContainer.classList.add('detail-hidden');

                // ?‘ì„± ë²„íŠ¼ ?¤ì‹œ ?œì‹œ ?¬ë? ?ë‹¨ (?µí•© ?¨ìˆ˜ ?¸ì¶œ)
                updateWriteButtonVisibility();

                // 2. ? ë‹ˆë©”ì´??0.4s)???„ë£Œ?????ˆì´?„ì›ƒ???•ë¦¬?©ë‹ˆ??
                const closingPostId = currentPostId; // ?„ì¬ ?«ìœ¼?¤ëŠ” ID ë°±ì—…
                setTimeout(() => {
                    // ? ë‹ˆë©”ì´?˜ì´ ì§„í–‰?˜ëŠ” ?™ì•ˆ ?¤ë¥¸ ê²Œì‹œë¬¼ì´ ?´ë¦¬ì§€ ?Šì•˜???Œë§Œ ?•ë¦¬
                    if (currentPostId === closingPostId || currentPostId === null) {
                        sideDetailContainer.classList.remove('fullscreen-detail');
                        const communityLayout = document.querySelector('.community-layout');
                        if (communityLayout && sideDetailContainer.parentElement !== communityLayout) {
                            communityLayout.appendChild(sideDetailContainer);
                        }
                        document.body.classList.remove('detail-open');

                        // ? ë‹ˆë©”ì´?˜ì´ ?ë‚œ ??ID ì´ˆê¸°??
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
            // ì¦‰ì‹œ ì´ˆê¸°?”í•˜ì§€ ?Šê³  ? ë‹ˆë©”ì´??ì¢…ë£Œ ??ì²˜ë¦¬ (?„ì˜ setTimeout ?´ë?)
            // currentPostId = null;
            currentDetailMode = 'side';
        }

        // ?ì„¸ ?˜ì´ì§€ ?Œë”ë§?
        function openPostDetail(id, post, avatar, timeStr, mode = 'fullscreen') {
            const sideDetailContainer = document.getElementById('sideDetailContainer');
            if (!sideDetailContainer) return;

            // ?´ë? ê°™ì? ê²Œì‹œë¬¼ì´ ?´ë ¤?ˆë‹¤ë©?ë¬´ì‹œ (?„ìš”???…ë°?´íŠ¸ ë¡œì§ ì¶”ê?)
            if (currentPostId === id && !sideDetailContainer.classList.contains('detail-hidden')) return;

            currentPostId = id;
            currentDetailMode = mode;

            const isFullscreen = currentDetailMode === 'fullscreen';
            const isMobile = window.innerWidth <= 1023;

            // 1. ?„ì¬ ?´ë ¤?ˆëŠ” ?íƒœ?¼ë©´ ?¼ë‹¨ ?¨ê? ?íƒœë¡??œì‘?˜ì—¬ ë¶€?œëŸ½ê²??„í™˜
            sideDetailContainer.classList.add('detail-hidden');
            updateWriteButtonVisibility();

            // 2. DOM ?„ì¹˜ ì¡°ì • ë°??´ë˜???¤ì • (? ë‹ˆë©”ì´???†ì´ ì¦‰ì‹œ ë°˜ì˜?˜ëŠ” ?ì„±??
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
                    ? '<i class="fa-solid fa-file-lines"></i> ê±´ì˜ê¸€ ?ì„¸'
                    : '<i class="fa-regular fa-comments"></i> ?“ê? ë³´ê¸°';
            }

            // 3. ë¸Œë¼?°ì?ê°€ ?ˆì´?„ì›ƒ ë³€ê²½ì„ ?„ë£Œ?˜ë„ë¡?ì§§ì? ì§€????? ë‹ˆë©”ì´???œì‘
            requestAnimationFrame(() => {
                setTimeout(() => {
                    sideDetailContainer.classList.remove('detail-hidden');
                    sideDetailContainer.scrollTop = 0;
                }, 10);
            });

            const area = document.getElementById('detailPostArea');
            
            // ì¡°íšŒ??ì¦ê?
            db.collection('posts').doc(id).update({ views: firebase.firestore.FieldValue.increment(1) });

            if (postUnsubscribe) postUnsubscribe();
            postUnsubscribe = db.collection('posts').doc(id).onSnapshot(docSnap => {
                if (!docSnap.exists) return;
                const currentPost = docSnap.data();

                const isPresident = currentUser && currentUser.email === 'gimdong2804@gmail.com';
                const isAuthor = currentUser && (currentPost.uid === currentUser.uid || isPresident);
                
                // ?? œ ë²„íŠ¼ (?‘ì„±???ëŠ” ?Œì¥)
                const deleteBtnHtml = isAuthor ? `
                    <button class="board-action-btn delete-btn" onclick="deletePost('${id}')" title="?? œ?˜ê¸°">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                ` : '';
                
                // ê³ ì • ë²„íŠ¼ (?Œì¥ ?„ìš©)
                const pinBtnHtml = isPresident ? `
                    <button class="board-action-btn pin-toggle-btn ${currentPost.pinned ? 'active' : ''}" onclick="togglePin('${id}', ${currentPost.pinned || false})" title="${currentPost.pinned ? 'ê³ ì • ?´ì œ' : '?ë‹¨ ê³ ì •'}">
                        <i class="fa-solid fa-thumbtack"></i>
                    </button>
                ` : '';

                const isLiked = currentUser && currentPost.likedUsers && currentPost.likedUsers.includes(currentUser.uid);
                const heartClass = isLiked ? 'fa-solid fa-heart fa-fw' : 'fa-regular fa-heart fa-fw';
                const heartColor = isLiked ? 'color: #ff6b6b;' : 'color: var(--text-primary);';

                area.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <div style="color: var(--accent-color); font-size: 0.85rem; font-weight: 600;">ì»¤ë??ˆí‹° Â· ê²Œì‹œê¸€</div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            ${pinBtnHtml}
                            ${deleteBtnHtml}
                        </div>
                    </div>
                    <h2 class="post-body-title" style="margin-bottom: 0.5rem; font-size: 1.6rem; color: var(--text-primary);">${currentPost.title}</h2>
                    <div style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1.5rem;">
                        ${timeStr} &nbsp;|&nbsp; ì¡°íšŒ ${currentPost.views || 0}??
                    </div>
                    
                    <div class="board-card-header" style="margin-bottom: 2rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 1rem;">
                        <div class="board-author" style="flex: 1;">
                            ${avatar}
                            <span class="board-author-name" style="font-weight: 600; font-size: 1rem;">${currentPost.author}</span>
                        </div>
                        <div class="board-stats" style="font-size: 0.95rem;">
                            <span><i class="fa-regular fa-comment"></i> <span id="detailTopCommentCount">0</span></span>
                            <span style="cursor: pointer; transition: color 0.3s; ${heartColor}" onclick="likePost('${id}', this)" id="detailLikeBtn"><i class="${heartClass}"></i> <span id="detailLikeCnt">${currentPost.likes || 0}</span></span>
                        </div>
                    </div>
                    
                    <div class="post-body" style="font-size: 1.05rem; line-height: 1.7; color: var(--text-primary); padding-bottom: 1rem;">
                        ${currentPost.body.replace(/\n/g, '<br>')}
                    </div>
                    ${currentPost.images && currentPost.images.length > 0 ? `
                        <div class="post-image-gallery">
                            ${currentPost.images.map(url => `<img src="${url}" alt="ê²Œì‹œê¸€ ì²¨ë? ?¬ì§„" style="cursor: pointer;" onclick="openLightbox('${url}')">`).join('')}
                        </div>
                    ` : ''}
                `;
            });

            // ?“ê? ?¤ì‹œê°??Œë”ë§?
            const commentArea = document.getElementById('detailCommentArea');
            if (commentUnsubscribe) commentUnsubscribe();
            commentUnsubscribe = db.collection('posts').doc(id).collection('comments').onSnapshot(snap => {
                const topCountEl = document.getElementById('detailTopCommentCount');
                if (topCountEl) topCountEl.innerText = snap.size;

                // ?´ë¼?´ì–¸???¨ì—???•ë ¬: pinnedê°€ ì°¸ì´ë©??„ë¡œ, ê·??¤ìŒ ?‘ì„±?????•ë ¬
                const sortedDocs = [...snap.docs].sort((a, b) => {
                    const pinA = a.data().pinned ? 1 : 0;
                    const pinB = b.data().pinned ? 1 : 0;
                    if (pinB !== pinA) {
                        return pinB - pinA; // ê³ ì •???„ë¡œ
                    }
                    const timeA = (a.data().createdAt && typeof a.data().createdAt.toMillis === 'function') ? a.data().createdAt.toMillis() : (a.data().createdAt instanceof Date ? a.data().createdAt.getTime() : 0);
                    const timeB = (b.data().createdAt && typeof b.data().createdAt.toMillis === 'function') ? b.data().createdAt.toMillis() : (b.data().createdAt instanceof Date ? b.data().createdAt.getTime() : 0);
                    return timeA - timeB; // ?‘ì„±???¤ë¦„ì°¨ìˆœ
                });

                const commentsHtml = sortedDocs.map(cDoc => {
                    const c = cDoc.data();
                    const cTime = formatDate(c.createdAt);
                    const isPresidentComment = c.author.includes('?Œì¥') || (c.email && c.email === 'gimdong2804@gmail.com');
                    const badge = isPresidentComment ? '<span class="official-badge" style="background: var(--accent-color); color: #fff; font-size: 0.75rem; padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: bold; margin-left: 0.5rem;">ê³µì‹ ?µë?</span>' : '';
                    
                    // ê³ ì • ?“ê? ë±ƒì?
                    const cPinBadge = c.pinned ? '<span style="background: var(--accent-color); color: #fff; font-size: 0.7rem; padding: 0.1rem 0.3rem; border-radius: 4px; font-weight: bold; margin-left: 0.5rem; transition: opacity 0.3s ease;"><i class="fa-solid fa-thumbtack"></i> ê³ ì •??/span>' : '';
                    
                    let cAvatarHtml = `<div class="board-author-avatar" style="background: ${isPresidentComment ? 'var(--accent-color)' : '#9ca3af'}; width: 32px; height: 32px; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #fff;">${isPresidentComment ? '<i class="fa-solid fa-crown" style="font-size: 0.6rem;"></i>' : c.author.substring(0,1)}</div>`;
                    if (c.userPhoto) {
                        cAvatarHtml = `<img class="board-author-avatar" src="${c.userPhoto}" alt="${c.author}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 50%; border: 1px solid var(--glass-border);">`;
                    }

                    const isCommentAuthor = currentUser && (c.uid === currentUser.uid || currentUser.email === 'gimdong2804@gmail.com');
                    const cDeleteBtn = isCommentAuthor ? `
                        <button onclick="deleteComment('${id}', '${cDoc.id}')" style="background: none; border: none; color: #ff6b6b; cursor: pointer; font-size: 0.8rem; margin-left: 0.5rem; display: flex; align-items: center; padding: 0.25rem;" title="?“ê? ?? œ">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    ` : '';

                    // ?Œì¥ ?„ìš© ?“ê? ê³ ì • ë²„íŠ¼
                    const isPresident = currentUser && currentUser.email === 'gimdong2804@gmail.com';
                    const cPinBtn = isPresident ? `
                        <button onclick="togglePinComment('${id}', '${cDoc.id}', ${c.pinned || false})" style="background: none; border: none; color: ${c.pinned ? 'var(--accent-color)' : 'var(--text-secondary)'}; cursor: pointer; font-size: 0.8rem; margin-left: auto; display: flex; align-items: center; padding: 0.25rem; transition: color 0.3s ease;" title="${c.pinned ? '?“ê? ê³ ì • ?´ì œ' : '?“ê? ê³ ì •'}">
                            <i class="fa-solid fa-thumbtack" style="transition: transform 0.2s ease;"></i>
                        </button>
                    ` : '';

                    // ê³ ì • ?“ê? ?„ìš© ë°°ê²½ ë°??Œë‘ë¦??¤í???
                    const cItemStyle = c.pinned ? 'border: 1px solid var(--accent-color); background: rgba(59, 130, 246, 0.05); border-radius: 12px; padding: 1rem; transition: background 0.3s ease, border-color 0.3s ease;' : 'border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 1rem; transition: background 0.3s ease, border-color 0.3s ease;';

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
                commentArea.innerHTML = `<h3 style="margin-bottom: 1.5rem; color: var(--text-primary); font-size: 1.1rem;">?“ê? <span style="color: var(--accent-color);" id="detailCommentCount">${snap.size}</span></h3>` + commentsHtml;
            });

            // openPostDetail ?˜ë‹¨???ˆë˜ ì¤‘ë³µ hidden ?œê±° ë¡œì§?€ ?¨ìˆ˜ ?´ë?(?ë‹¨)ë¡???²¼?¼ë?ë¡??¬ê¸°?œëŠ” ?? œ?©ë‹ˆ??
        }

        // ?ì„¸ ?«ê¸° ?´ë²¤??ë°”ì¸??
        const closeSideDetailBtn = document.getElementById('closeSideDetailBtn');
        if (closeSideDetailBtn) {
            closeSideDetailBtn.addEventListener('click', closeSideDetail);
        }

        window.likePost = async function(id, btnEl) {
            if (!currentUser) {
                alert('ë¡œê·¸ì¸ì´ í•„ìš”í•œ ê¸°ëŠ¥ì…ë‹ˆë‹¤. Google ë¡œê·¸ì¸ í•´ì£¼ì„¸ìš”!');
                openDrawer();
                return;
            }
            
            if (btnEl) {
                const heartIcon = btnEl.querySelector('i');
                const likeCountEl = btnEl.querySelector('.like-count') || btnEl.querySelector('#detailLikeCnt');
                if (heartIcon) {
                    const currentlyLiked = heartIcon.classList.contains('fa-solid');
                    
                    heartIcon.classList.remove('animate-heart', 'animate-heart-cancel');
                    void heartIcon.offsetWidth; 
                    
                    if (currentlyLiked) {
                        heartIcon.className = 'fa-regular fa-heart fa-fw animate-heart-cancel';
                        heartIcon.style.color = 'var(--text-primary)';
                        if (likeCountEl) {
                            const cur = parseInt(likeCountEl.textContent) || 0;
                            likeCountEl.textContent = Math.max(0, cur - 1);
                        }
                    } else {
                        heartIcon.className = 'fa-solid fa-heart fa-fw animate-heart';
                        heartIcon.style.color = '#ff6b6b';
                        if (likeCountEl) {
                            const cur = parseInt(likeCountEl.textContent) || 0;
                            likeCountEl.textContent = cur + 1;
                        }
                    }
                    
                    heartIcon.addEventListener('animationend', () => {
                        heartIcon.classList.remove('animate-heart', 'animate-heart-cancel');
                    }, { once: true });
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

        window.deletePostWithAnim = async function(id, btn) {
            if (!confirm('?•ë§ ??ê²Œì‹œê¸€???? œ?˜ì‹œê² ìŠµ?ˆê¹Œ?')) return;
            const card = btn.closest('.board-card');
            if (card) {
                card.classList.add('deleting');
                setTimeout(async () => {
                    try {
                        await db.collection('posts').doc(id).delete();
                    } catch (error) {
                        console.error("Error deleting post: ", error);
                        alert('?? œ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.');
                    }
                }, 300);
            } else {
                deletePost(id);
            }
        };

        window.deletePost = async function(id) {
            if (!confirm('?•ë§ë¡???ê²Œì‹œê¸€???? œ?˜ì‹œê² ìŠµ?ˆê¹Œ?')) return;
            try {
                await db.collection('posts').doc(id).delete();
                alert('ê²Œì‹œê¸€???±ê³µ?ìœ¼ë¡??? œ?˜ì—ˆ?µë‹ˆ??');
                closeSideDetail();
            } catch (error) {
                console.error("Error deleting post: ", error);
                alert('?? œ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.');
            }
        };

        window.deleteComment = async function(postId, commentId) {
            if (!confirm('?•ë§ë¡????“ê????? œ?˜ì‹œê² ìŠµ?ˆê¹Œ?')) return;
            const commentEl = document.getElementById(`comment-${commentId}`);
            
            if (commentEl) {
                commentEl.classList.remove('comment-slide-in');
                commentEl.classList.add('comment-fade-out');
                
                setTimeout(async () => {
                    try {
                        await db.collection('posts').doc(postId).collection('comments').doc(commentId).delete();
                    } catch (error) {
                        console.error("Error deleting comment: ", error);
                        alert('?“ê? ?? œ ?¤íŒ¨');
                    }
                }, 400);
            } else {
                try {
                    await db.collection('posts').doc(postId).collection('comments').doc(commentId).delete();
                } catch (error) {
                    console.error("Error deleting comment: ", error);
                    alert('?“ê? ?? œ ?¤íŒ¨');
                }
            }
        };

        // ?“ê? ?‘ì„± ë¡œì§
        const commentSubmitBtn = document.querySelector('.side-detail-container .comment-submit-btn');
        const commentInput = document.querySelector('.side-detail-container .comment-input');
        if (commentSubmitBtn && commentInput) {
            commentSubmitBtn.addEventListener('click', async () => {
                if (!currentUser) {
                    alert('?“ê????‘ì„±?˜ì‹œ?¤ë©´ ë¨¼ì? Google ë¡œê·¸?¸ì„ ?´ì£¼?¸ìš”!');
                    openDrawer();
                    return;
                }
                if(!currentPostId) return;
                const body = commentInput.value.trim();
                if(body === '') return;

                try {
                    await db.collection('posts').doc(currentPostId).collection('comments').add({
                        author: currentUser.email === 'gimdong2804@gmail.com' ? "?Œì¥ ê¹€?™í˜„" : currentUser.displayName,
                        uid: currentUser.uid,
                        userPhoto: currentUser.photoURL || '',
                        email: currentUser.email,
                        body: body,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    commentInput.value = '';
                } catch(e) {
                    console.error(e);
                    alert('?“ê? ?‘ì„± ?¤íŒ¨');
                }
            });
            
            // ?”í„°??ì§€??ì¶”ê?
            commentInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    commentSubmitBtn.click();
                }
            });
        }

        // ?¬ì´??ë©”ë‰´ ?„ì´???´ë¦­ ???Œë¦¼ ë°??œë¡œ???«ê¸° (?¸ì‚¬ë§? ëª©í‘œ, ê±´ì˜ë°??œì™¸)
        document.querySelectorAll('.drawer-menu a:not(#greetingLink):not(#goalLink):not(#suggestionLink)').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const title = item.innerText.trim();
                alert(title + ' ?˜ì´ì§€ë¡??´ë™ ê¸°ëŠ¥?€ ?„ì§ ì¤€ë¹?ì¤‘ì…?ˆë‹¤.');
                closeDrawer();
            });
        });

        // --- ?´ë?ì§€ ?¼ì´?¸ë°•??ì¤?& ?¨ë‹ ê¸°ëŠ¥ ---
        const imageLightbox = document.getElementById('imageLightbox');
        const imageLightboxImg = document.getElementById('imageLightboxImg');
        const imageLightboxClose = document.getElementById('imageLightboxClose');
        
        let currentZoom = 1;
        let currentPanX = 0;
        let currentPanY = 0;
        
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let initialPinchDistance = null;

        function updateTransform(animate = false) {
            imageLightboxImg.style.transition = animate ? 'transform 0.1s ease-out' : 'none';
            imageLightboxImg.style.transform = `translate(${currentPanX}px, ${currentPanY}px) scale(${currentZoom})`;
        }

        window.openLightbox = function(url) {
            imageLightboxImg.src = url;
            imageLightbox.classList.add('active');
            currentZoom = 1; currentPanX = 0; currentPanY = 0;
            updateTransform(true);
        };

        function closeLightbox() {
            imageLightbox.classList.remove('active');
            setTimeout(() => { imageLightboxImg.src = ''; }, 300);
        }

        imageLightboxClose.addEventListener('click', closeLightbox);
        imageLightbox.addEventListener('click', (e) => {
            if (e.target === imageLightbox) closeLightbox();
        });

        // ?°ìŠ¤?¬íƒ‘ ë§ˆìš°?????•ë?/ì¶•ì†Œ
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

        // ?°ìŠ¤?¬íƒ‘ ë§ˆìš°???œë˜ê·??¨ë‹
        imageLightboxImg.addEventListener('mousedown', (e) => {
            if (currentZoom > 1) {
                isDragging = true;
                startX = e.clientX - currentPanX;
                startY = e.clientY - currentPanY;
                imageLightboxImg.style.cursor = 'grabbing';
                e.preventDefault();
            }
        });
        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            currentPanX = e.clientX - startX;
            currentPanY = e.clientY - startY;
            updateTransform(false);
        });
        window.addEventListener('mouseup', () => {
            isDragging = false;
            imageLightboxImg.style.cursor = 'pointer';
        });

        // ëª¨ë°”???ê????€ì¹? ?•ë?/ì¶•ì†Œ ë°??¨ë‹
        imageLightbox.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                initialPinchDistance = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
            } else if (e.touches.length === 1 && currentZoom > 1) {
                isDragging = true;
                startX = e.touches[0].pageX - currentPanX;
                startY = e.touches[0].pageY - currentPanY;
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
            } else if (e.touches.length === 1 && isDragging) {
                currentPanX = e.touches[0].pageX - startX;
                currentPanY = e.touches[0].pageY - startY;
                updateTransform(false);
            }
        }, { passive: false });

        imageLightbox.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) initialPinchDistance = null;
            if (e.touches.length === 0) {
                isDragging = false;
                imageLightboxImg.style.transition = 'transform 0.2s ease';
            }
        });

    
