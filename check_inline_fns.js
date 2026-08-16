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

const allCode = jsFiles.map(f => fs.readFileSync(path.join(baseDir, f), 'utf8')).join('\n');

const functionsToCheck = [
    'executeMultiPin',
    'executeMultiDelete',
    'cancelMultiDelete',
    'executePostMultiPin',
    'executePostMultiDelete',
    'cancelPostMultiDelete',
    'executeRoleMultiDelete',
    'cancelRoleMultiDelete',
    'closeSettingsModal',
    'toggleProfileDetails',
    'openLightbox',
    'cancelReplyTarget',
    'closeHtmlViewerModal',
    'removeAiAttachedFile',
    'generateAiSummary',
    'toggleRolePin',
    'deleteRoleWithAnim',
    'openRoleEditModal',
    'switchAiChatSession',
    'toggleAiChatSessionMenu',
    'togglePinAiChatSession',
    'renameAiChatSession',
    'deleteAiChatSession',
    'selectSearchResultSession',
    'removeExistingImage',
    'removeExistingAttachment',
    'removeImage',
    'closeAllAiChatSessionMenus'
];

console.log('=== Checking Inline Function Definitions ===');
functionsToCheck.forEach(fn => {
    // Check `function fn(` or `window.fn =` or `const fn =` or `var fn =` or `let fn =`
    const regex1 = new RegExp(`function\\s+${fn}\\s*\\(`, 'g');
    const regex2 = new RegExp(`window\\.${fn}\\s*=`, 'g');
    const regex3 = new RegExp(`(?:const|let|var)\\s+${fn}\\s*=`, 'g');
    
    const hasDef = regex1.test(allCode) || regex2.test(allCode) || regex3.test(allCode);
    if (!hasDef) {
        console.log(`[MISSING FUNCTION] ${fn} is NOT defined in any JS file!`);
    } else {
        console.log(`[OK] ${fn} is defined.`);
    }
});
