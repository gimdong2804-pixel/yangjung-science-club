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

        # 1. 건의사항 페이지로 이동
        await page.evaluate("""() => {
            if (typeof switchPage === 'function' && typeof suggestionPage !== 'undefined' && typeof mainPage !== 'undefined') {
                switchPage(mainPage, suggestionPage, true);
            }
        }""")
        await page.wait_for_timeout(500)

        # 2. 게시글에 빠르게 5번 들어갔다 나왔다 반복 클릭 시뮬레이션!
        for i in range(5):
            await page.evaluate(f"""() => {{
                if (typeof openPostDetail === 'function') {{
                    openPostDetail('test-1', {{ title: '테스트 게시물 {i}', content: '테스트 내용' }}, '', '방금 전');
                }}
            }}""")
            await page.wait_for_timeout(100) # 빠르게 100ms 만에 들어감

            # 3. 상세 진입 상태에서 상단 로고 및 헤더 액션 버튼 상태 체크
            header_status = await page.evaluate("""() => {
                const logo = document.getElementById('logoHomeBtn');
                const actions = document.querySelector('.header-actions');
                const logoStyle = window.getComputedStyle(logo);
                const actionsStyle = window.getComputedStyle(actions);

                return {
                    logoOpacity: logoStyle.opacity,
                    logoVisibility: logoStyle.visibility,
                    actionsOpacity: actionsStyle.opacity,
                    actionsVisibility: actionsStyle.visibility
                };
            }""")
            print(f"[{i+1}회차 빠른 진입] 상단 로고 opacity: {header_status['logoOpacity']}, visibility: {header_status['logoVisibility']}")
            print(f"[{i+1}회차 빠른 진입] 상단 헤더 opacity: {header_status['actionsOpacity']}, visibility: {header_status['actionsVisibility']}")

            await page.evaluate("""() => {
                if (typeof closeSideDetail === 'function') {
                    closeSideDetail();
                }
            }""")
            await page.wait_for_timeout(100) # 빠르게 100ms 만에 나옴

        # 마지막 6회차 진입 후 0.5초 대기 (스크롤 타이머 300ms 만료 시점 관찰)
        await page.evaluate("""() => {
            if (typeof openPostDetail === 'function') {
                openPostDetail('test-1', { title: '최종 진입 게시물', content: '테스트 내용' }, '', '방금 전');
            }
        }""")
        await page.wait_for_timeout(500) # 500ms 지난 후 잔여 스크롤 타이머 동작 여부 확인

        final_header_status = await page.evaluate("""() => {
            const logo = document.getElementById('logoHomeBtn');
            const actions = document.querySelector('.header-actions');
            return {
                logoOpacity: window.getComputedStyle(logo).opacity,
                logoVisibility: window.getComputedStyle(logo).visibility,
                actionsOpacity: window.getComputedStyle(actions).opacity,
                actionsVisibility: window.getComputedStyle(actions).visibility
            };
        }""")

        print(f"\n=== 6회차 최종 진입 (500ms 지남) ===")
        print(f"상단 로고 opacity: {final_header_status['logoOpacity']} (0이어야 함), visibility: {final_header_status['logoVisibility']} (hidden이어야 함)")
        print(f"상단 헤더 opacity: {final_header_status['actionsOpacity']} (0이어야 함), visibility: {final_header_status['actionsVisibility']} (hidden이어야 함)")

        screenshot_path = os.path.abspath('gui-test-screenshots/fast_click_header_result.png')
        await page.screenshot(path=screenshot_path)
        print(f"\n빠른 연타 최종 검증 스크린샷 저장 완료: {screenshot_path}")

        video = page.video
        await context.close()
        video_path = await video.path()
        print(f"빠른 연타 실시간 비디오 저장 완료: {video_path}")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
