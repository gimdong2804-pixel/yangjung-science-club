// Static preview UI access gate. Production files and Firebase roles are unchanged.
(() => {
    'use strict';
    const ownerEmail = 'gimdong2804@gmail.com';
    const appMode = Boolean(document.querySelector('script[data-preview-app]'));
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.PREVIEW_FIREBASE_CONFIG);
    const auth = app.auth();
    const allowed = user => Boolean(user && user.emailVerified && (user.email || '').toLowerCase() === ownerEmail);
    let starting = false;

    async function loadApp() {
        if (starting) return;
        starting = true;
        if (document.readyState === 'loading') await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once:true }));
        const domCallbacks = [], loadCallbacks = [];
        const documentAdd = document.addEventListener, windowAdd = window.addEventListener;
        // The original classic scripts expect parser-time DOM/load registration.
        // Replay just their startup callbacks after the authenticated load.
        document.addEventListener = function(type, callback, options) {
            if (type === 'DOMContentLoaded') { domCallbacks.push(callback); return; }
            return documentAdd.call(this, type, callback, options);
        };
        window.addEventListener = function(type, callback, options) {
            if (type === 'load') { loadCallbacks.push(callback); return; }
            return windowAdd.call(this, type, callback, options);
        };
        try {
            for (const placeholder of document.querySelectorAll('[data-preview-src]')) {
                if (!allowed(auth.currentUser)) throw new Error('preview-access-changed');
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = placeholder.dataset.previewSrc;
                    script.onload = resolve; script.onerror = () => reject(new Error('preview-script-load'));
                    document.body.append(script);
                });
            }
        } finally {
            document.addEventListener = documentAdd; window.addEventListener = windowAdd;
        }
        if (!allowed(auth.currentUser)) throw new Error('preview-access-changed');
        for (const callback of domCallbacks) callback.call(document, new Event('DOMContentLoaded'));
        for (const callback of loadCallbacks) callback.call(window, new Event('load'));
        document.getElementById('previewAccessHide')?.remove();
    }

    auth.onAuthStateChanged(user => {
        if (appMode) {
            if (!allowed(user)) { document.documentElement.style.visibility = 'hidden'; location.replace('./'); return; }
            void loadApp().catch(() => {
                document.getElementById('previewAccessHide')?.remove();
                document.body.replaceChildren();
                const message = document.createElement('p'); message.textContent = '개발 화면을 불러오지 못했어. 새로고침해서 다시 열어줘.';
                const link = document.createElement('a'); link.href = './'; link.textContent = '개발 버전 로그인으로 돌아가기';
                document.body.append(message, link);
            });
            return;
        }
        const status = document.getElementById('previewStatus'), login = document.getElementById('previewLogin');
        if (allowed(user)) { location.replace('./app.html'); return; }
        status.textContent = user ? '이 개발 버전은 동현 계정에서만 사용할 수 있어.' : 'Google 계정으로 로그인해줘.';
        login.disabled = false;
    });

    document.getElementById('previewLogin')?.addEventListener('click', async () => {
        const button = document.getElementById('previewLogin'); button.disabled = true;
        try {
            const provider = new firebase.auth.GoogleAuthProvider(); provider.setCustomParameters({ prompt:'select_account' });
            await auth.signInWithPopup(provider);
        } catch (error) {
            if (error.code !== 'auth/popup-closed-by-user') document.getElementById('previewStatus').textContent = '로그인하지 못했어. 잠시 후 다시 시도해줘.';
        } finally { button.disabled = false; }
    });
})();
