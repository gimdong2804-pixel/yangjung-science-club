const fs = require('fs');
const path = require('path');

const baseDir = path.resolve('동아리 관련 사이트');
const html = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');

// 1. Check inline event handlers in index.html (onclick, onchange, etc.)
const inlineHandlers = [];
const handlerRegex = /\s(on[a-z]+)=["']([^"']+)["']/gi;
let hm;
while ((hm = handlerRegex.exec(html)) !== null) {
    inlineHandlers.push({ event: hm[1], call: hm[2] });
}

console.log('=== 1. Inline Event Handlers in index.html ===');
console.log(`Found ${inlineHandlers.length} inline handlers:`);
inlineHandlers.forEach(h => {
    console.log(`  ${h.event}="${h.call}"`);
});

// 2. Check all IDs in JS and whether they are attached event listeners or manipulated without null checks
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

console.log('\n=== 2. Checking getElementById calls without null checks ===');
const idRegex = /id=["']([^"']+)["']/g;
const htmlIds = new Set();
let im;
while ((im = idRegex.exec(html)) !== null) {
    htmlIds.add(im[1]);
}

jsFiles.forEach(file => {
    const code = fs.readFileSync(path.join(baseDir, file), 'utf8');
    const lines = code.split('\n');
    lines.forEach((line, idx) => {
        // e.g. document.getElementById('xyz').addEventListener
        const directAccess = /document\.getElementById\(['"`]([^'"`]+)['"`]\)\.([a-zA-Z0-9_$]+)/g;
        let dm;
        while ((dm = directAccess.exec(line)) !== null) {
            const id = dm[1];
            const prop = dm[2];
            if (!htmlIds.has(id)) {
                console.log(`[${file}:${idx + 1}] Direct access on non-existent element: document.getElementById('${id}').${prop}`);
            }
        }
    });
});
