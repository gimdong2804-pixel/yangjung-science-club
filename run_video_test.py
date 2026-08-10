import asyncio
import os
from playwright.async_api import async_playwright

async def run():
    video_dir = os.path.abspath('gui-test-screenshots/videos')
    os.makedirs(video_dir, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 390, 'height': 844},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
            record_video_dir=video_dir,
            record_video_size={'width': 390, 'height': 844}
        )
        page = await context.new_page()

        html_path = os.path.abspath('index.html')
        await page.goto(f'file:///{html_path}')
        await page.wait_for_timeout(1000)

        # 1. 건의사항 페이지로 이동 및 상세 열기
        await page.evaluate("""() => {
            if (typeof switchPage === 'function' && typeof suggestionPage !== 'undefined' && typeof mainPage !== 'undefined') {
                switchPage(mainPage, suggestionPage, true);
            }
            if (typeof openPostDetail === 'function') {
                openPostDetail('test-1', { title: '테스트 게시물', content: '테스트 내용' }, '', '방금 전');
            }
        }""")
        await page.wait_for_timeout(600)

        # 2. 상세 페이지 닫기 (실시간 FAB 나타남 애니메이션 발생 과정 녹화!)
        await page.evaluate("""() => {
            if (typeof closeSideDetail === 'function') {
                closeSideDetail();
            }
        }""")

        # 실시간 애니메이션 재생 시간 1.5초 대기
        await page.wait_for_timeout(1500)

        # 3. 비디오 저장 및 경로 취득
        video = page.video
        await context.close()
        video_path = await video.path()

        print(f"\n=== Playwright 실시간 애니메이션 녹화 완료 ===")
        print(f"녹화 파일 경로: {video_path}")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
