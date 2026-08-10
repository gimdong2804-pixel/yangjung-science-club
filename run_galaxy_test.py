import asyncio
import os
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # 1. 삼성 갤럭시 S22/S23/S24 뷰포트 (412 x 915)
        context_galaxy = await browser.new_context(
            viewport={'width': 412, 'height': 915},
            user_agent='Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36'
        )
        page = await context_galaxy.new_page()
        html_path = os.path.abspath('index.html')
        await page.goto(f'file:///{html_path}')
        await page.wait_for_timeout(500)

        await page.evaluate("""() => {
            if (typeof openPostDetail === 'function') {
                openPostDetail('test-galaxy', { title: '갤럭시 테스트', content: '내용' }, '', '방금 전');
            } else {
                document.body.classList.add('detail-open');
                const sideDetail = document.getElementById('sideDetailContainer');
                if (sideDetail) sideDetail.classList.remove('detail-hidden');
            }
        }""")
        await page.wait_for_timeout(500)

        res_galaxy = await page.evaluate("""() => {
            const gRect = document.getElementById('commentGeminiBtn')?.getBoundingClientRect();
            const sRect = document.querySelector('.comment-submit-btn')?.getBoundingClientRect();
            const cRect = document.getElementById('commentInputContainer')?.getBoundingClientRect();

            return {
                gemini: gRect ? { x: Math.round(gRect.x), y: Math.round(gRect.y), w: Math.round(gRect.width), h: Math.round(gRect.height) } : null,
                send: sRect ? { x: Math.round(sRect.x), y: Math.round(sRect.y), w: Math.round(sRect.width), h: Math.round(sRect.height) } : null,
                container: cRect ? { x: Math.round(cRect.x), y: Math.round(cRect.y), w: Math.round(cRect.width), h: Math.round(cRect.height) } : null,
                isGeminiInsideContainer: (gRect && cRect) ? (gRect.right <= cRect.right + 2 && gRect.left >= cRect.left - 2) : false
            };
        }""")

        print("\n=== 삼성 갤럭시 (412px) Playwright UI 테스트 결과 ===")
        print(f"Gemini 버튼 크기 & 위치: {res_galaxy['gemini']}")
        print(f"보내기 버튼 크기 & 위치: {res_galaxy['send']}")
        print(f"댓글 캡슐 바 위치 & 너비: {res_galaxy['container']}")
        print(f"두 버튼 사이 간격: {res_galaxy['send']['x'] - (res_galaxy['gemini']['x'] + res_galaxy['gemini']['w'])}px")
        print(f"Gemini 버튼이 캡슐 바 내부에 안착했는가?: {res_galaxy['isGeminiInsideContainer']}")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
