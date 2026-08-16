const fs = require('fs');
const path = require('path');

const baseDir = path.resolve('동아리 관련 사이트');
const jsFiles = [
    'script.js',
    'youtube-utils.js',
    'community.js',
    'community-comment-render.js',
    'community-post-detail.js',
    'media-upload.js',
    'community-attachments.js',
    'community-ui.js',
    'community-interactions.js'
];

// 간단한 JS 파서/정규식으로 전역 선언(function, const, let, var, window.xxx)과 호출 수집
const declaredGlobals = new Set([
    // Browser built-ins
    'window', 'document', 'console', 'localStorage', 'sessionStorage', 'fetch', 'setTimeout', 'clearTimeout',
    'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'history', 'location',
    'navigator', 'alert', 'confirm', 'prompt', 'JSON', 'Math', 'Date', 'Array', 'Object', 'String', 'Number',
    'Boolean', 'RegExp', 'Error', 'Promise', 'Set', 'Map', 'WeakMap', 'WeakSet', 'FormData', 'FileReader',
    'Blob', 'File', 'URL', 'Image', 'Audio', 'SpeechRecognition', 'webkitSpeechRecognition',
    'speechSynthesis', 'SpeechSynthesisUtterance', 'MutationObserver', 'IntersectionObserver',
    'CustomEvent', 'Event', 'EventTarget', 'encodeURIComponent', 'decodeURIComponent', 'parseInt', 'parseFloat',
    'isNaN', 'isFinite', 'btoa', 'atob', 'crypto', 'screen', 'performance',
    // Firebase
    'firebase', 'db', 'auth', 'storage',
    // External libs from HTML
    'marked'
]);

// 1. 모든 파일에서 정의된 전역 변수/함수 수집
jsFiles.forEach(file => {
    const code = fs.readFileSync(path.join(baseDir, file), 'utf8');
    
    // function foo(...) {
    const funcMatches = code.matchAll(/(?:^|\n)\s*function\s+([a-zA-Z0-9_$]+)\s*\(/g);
    for (const m of funcMatches) declaredGlobals.add(m[1]);

    // window.foo = ...
    const winMatches = code.matchAll(/window\.([a-zA-Z0-9_$]+)\s*=/g);
    for (const m of winMatches) declaredGlobals.add(m[1]);

    // top-level var/let/const
    const topVarMatches = code.matchAll(/(?:^|\n)(?:var|let|const)\s+([a-zA-Z0-9_$]+)\s*=/g);
    for (const m of topVarMatches) declaredGlobals.add(m[1]);
});

console.log(`Total collected declared globals: ${declaredGlobals.size}`);

// 2. 각 파일별로 window.xxx 또는 전역 함수 호출 중 미정의된 것 확인
console.log('\n=== Checking function calls ===');
jsFiles.forEach(file => {
    const code = fs.readFileSync(path.join(baseDir, file), 'utf8');
    
    // Check window.someMethod(...) calls
    const winCallMatches = code.matchAll(/window\.([a-zA-Z0-9_$]+)\s*\(/g);
    for (const m of winCallMatches) {
        const fnName = m[1];
        if (!declaredGlobals.has(fnName)) {
            console.log(`[${file}] Unknown window method call: window.${fnName}()`);
        }
    }
});
