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
        await page.goto(f'file:///{html_path}')
        await page.wait_for_timeout(500)

        # 라이트 모드 설정
        await page.evaluate("""() => {
            document.documentElement.setAttribute('data-theme', 'light');
            if (typeof openPostDetail === 'function') {
                openPostDetail('test-1', { title: '테스트 게시물', content: '테스트 내용' }, '', '방금 전');
            } else {
                document.body.classList.add('detail-open');
                const sideDetail = document.getElementById('sideDetailContainer');
                if (sideDetail) sideDetail.classList.remove('detail-hidden');
            }
        }""")
        await page.wait_for_timeout(500)

        os.makedirs('gui-test-screenshots', exist_ok=True)
        screenshot_path = os.path.abspath('gui-test-screenshots/mobile_ui_light_result.png')
        await page.screenshot(path=screenshot_path)
        print(f"\n라이트모드 스크린샷 저장 완료: {screenshot_path}")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
