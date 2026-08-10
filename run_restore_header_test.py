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

        # 1. 건의사항 페이지로 이동 및 게시물 상세 열기
        await page.evaluate("""() => {
            if (typeof switchPage === 'function' && typeof suggestionPage !== 'undefined' && typeof mainPage !== 'undefined') {
                switchPage(mainPage, suggestionPage, true);
            }
            if (typeof openPostDetail === 'function') {
                openPostDetail('test-1', { title: '테스트 게시물', content: '테스트 내용' }, '', '방금 전');
            }
        }""")
        await page.wait_for_timeout(500)

        # 2. 상세 페이지 닫기 (목록으로 복귀!)
        await page.evaluate("""() => {
            if (typeof closeSideDetail === 'function') {
                closeSideDetail();
            }
        }""")
        await page.wait_for_timeout(600)

        # 3. 목록으로 복귀한 뒤 상단 로고 및 헤더 액션 버튼 표시 상태 측정
        restored_status = await page.evaluate("""() => {
            const logo = document.getElementById('logoHomeBtn');
            const actions = document.querySelector('.header-actions');
            const logoStyle = window.getComputedStyle(logo);
            const actionsStyle = window.getComputedStyle(actions);

            return {
                logoOpacity: logoStyle.opacity,
                logoVisibility: logoStyle.visibility,
                logoDisplay: logoStyle.display,
                actionsOpacity: actionsStyle.opacity,
                actionsVisibility: actionsStyle.visibility,
                actionsDisplay: actionsStyle.display
            };
        }""")

        print("\n=== 게시물 닫기 후 목록 복귀 시 상단 헤더 버튼 복원 측정 수치 ===")
        print(f"상단 로고 버튼 opacity: {restored_status['logoOpacity']}, visibility: {restored_status['logoVisibility']}, display: {restored_status['logoDisplay']}")
        print(f"상단 헤더 액션 opacity: {restored_status['actionsOpacity']}, visibility: {restored_status['actionsVisibility']}, display: {restored_status['actionsDisplay']}")

        screenshot_path = os.path.abspath('gui-test-screenshots/header_restored_result.png')
        await page.screenshot(path=screenshot_path)
        print(f"\n헤더 복원 최종 검증 스크린샷 저장 완료: {screenshot_path}")

        video = page.video
        await context.close()
        video_path = await video.path()
        print(f"헤더 복원 실시간 비디오 저장 완료: {video_path}")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
