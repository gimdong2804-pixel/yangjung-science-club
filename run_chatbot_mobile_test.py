import asyncio
import os
from playwright.async_api import async_playwright

async def run():
    video_dir = os.path.abspath('gui-test-screenshots/videos')
    os.makedirs(video_dir, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        device = p.devices['Galaxy S9+']
        context = await browser.new_context(
            **device,
            record_video_dir=video_dir,
            record_video_size={'width': 360, 'height': 740}
        )
        page = await context.new_page()

        html_path = os.path.abspath('index.html')
        await page.goto(f'file:///{html_path}', wait_until='domcontentloaded')
        await page.wait_for_timeout(800)

        # 제미나이 모달창 열기
        await page.evaluate("""() => {
            if (typeof openAiChatbotModal === 'function') {
                openAiChatbotModal();
            }
        }""")
        await page.wait_for_timeout(500)

        screenshot_path = os.path.abspath('gui-test-screenshots/chatbot_mobile_left_aligned_result.png')
        await page.screenshot(path=screenshot_path)
        print(f"좌측 정렬 헤더 스크린샷 저장 완료: {screenshot_path}")

        video = page.video
        await context.close()
        if video:
            video_path = await video.path()
            print(f"좌측 정렬 비디오 저장 완료: {video_path}")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
