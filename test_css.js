const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'style.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

console.log("=== CSS 검증 테스트 ===");

// 1. body.detail-open 셀렉터 존재 여부
const hasDetailOpenFab = cssContent.includes('body.detail-open .ai-chatbot-fab');
console.log("1. body.detail-open .ai-chatbot-fab 표준 셀렉터 존재 여부:", hasDetailOpenFab ? "PASS" : "FAIL");

// 2. 44px 크기 동기화 검증
const matches44px = cssContent.includes('width: 44px !important;') && cssContent.includes('height: 44px !important;');
console.log("2. 44px 크기 동기화 규칙:", matches44px ? "PASS" : "FAIL");

// 3. right offset 위치 계산식 검증 (calc(1.5rem + 0.6rem + 44px + 8px))
const matchesRightCalc = cssContent.includes('right: calc(1.5rem + 0.6rem + 44px + 8px) !important;');
console.log("3. 보내기 버튼 좌측 8px 오프셋 계산식:", matchesRightCalc ? "PASS" : "FAIL");

// 4. bottom offset 세로 정렬 검증 (calc(1rem + 0.4rem))
const matchesBottomCalc = cssContent.includes('bottom: calc(1rem + 0.4rem) !important;');
console.log("4. 보내기 버튼 y축 높이 100% 동일 정렬:", matchesBottomCalc ? "PASS" : "FAIL");

if (hasDetailOpenFab && matches44px && matchesRightCalc && matchesBottomCalc) {
    console.log("\n모든 CSS 검증 테스트를 통과했습니다!");
} else {
    console.error("\n테스트 실패!");
    process.exit(1);
}
