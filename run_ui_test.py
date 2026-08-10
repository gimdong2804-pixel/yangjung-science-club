import asyncio
import os
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 390, 'height': 844},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
        )
        page = await context.new_page()

        html_path = os.path.abspath('index.html')
        file_url = f'file:///{html_path}'
        print(f"Loading page: {file_url}")
        await page.goto(file_url)
        await page.wait_for_timeout(1000)

        # 실제 openPostDetail 실행
        await page.evaluate("""() => {
            if (typeof openPostDetail === 'function') {
                openPostDetail('test-1', { title: '테스트 게시물', content: '테스트 내용' }, '', '방금 전');
            } else {
                document.body.classList.add('detail-open');
                const sideDetail = document.getElementById('sideDetailContainer');
                if (sideDetail) {
                    sideDetail.classList.remove('detail-hidden');
                }
            }
        }""")
        await page.wait_for_timeout(1000)

        # UI 요소 위치 및 너비 측정
        res = await page.evaluate("""() => {
            const geminiBtn = document.getElementById('commentGeminiBtn');
            const sendBtn = document.querySelector('.comment-submit-btn');
            const container = document.getElementById('commentInputContainer');
            
            const gRect = geminiBtn ? geminiBtn.getBoundingClientRect() : null;
            const sRect = sendBtn ? sendBtn.getBoundingClientRect() : null;
            const cRect = container ? container.getBoundingClientRect() : null;

            return {
                gemini: gRect ? { x: Math.round(gRect.x), y: Math.round(gRect.y), w: Math.round(gRect.width), h: Math.round(gRect.height) } : null,
                send: sRect ? { x: Math.round(sRect.x), y: Math.round(sRect.y), w: Math.round(sRect.width), h: Math.round(sRect.height) } : null,
                container: cRect ? { x: Math.round(cRect.x), y: Math.round(cRect.y), w: Math.round(cRect.width), h: Math.round(cRect.height) } : null,
                isGeminiInsideContainer: (gRect && cRect) ? (gRect.right <= cRect.right + 2 && gRect.left >= cRect.left - 2 && gRect.top >= cRect.top - 2 && gRect.bottom <= cRect.bottom + 2) : false
            };
        }""")

        print("\n=== Playwright UI 테스트 측정 결과 ===")
        print(f"Gemini 버튼 크기 & 위치: {res['gemini']}")
        print(f"보내기 버튼 크기 & 위치: {res['send']}")
        print(f"댓글 캡슐 바 위치 & 너비: {res['container']}")
        print(f"Gemini 버튼이 캡슐 바 완전 내부에 들어갔는가?: {res['isGeminiInsideContainer']}")

        os.makedirs('gui-test-screenshots', exist_ok=True)
        screenshot_path = os.path.abspath('gui-test-screenshots/mobile_ui_result.png')
        await page.screenshot(path=screenshot_path)
        print(f"\n스크린샷 저장 완료: {screenshot_path}")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
