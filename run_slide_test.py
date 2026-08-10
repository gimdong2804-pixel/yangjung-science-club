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
        await page.goto(f'file:///{html_path}')
        await page.wait_for_timeout(1000)

        # 제미나이 FAB 버튼 활성화
        await page.evaluate("""() => {
            const aiFab = document.getElementById('aiChatbotFab');
            if (aiFab) {
                aiFab.style.display = 'flex';
                aiFab.style.opacity = '1';
                aiFab.style.visibility = 'visible';
            }
        }""")
        await page.wait_for_timeout(300)

        print("\n=== 홈(인사말) -> 커뮤니티(건의사항) 탭 전환 시 제미나이 버튼 슬라이딩 이동 검증 ===")
        # 1. 홈 -> 커뮤니티 탭 전환 수행! (글쓰기 버튼이 나타나면서 제미나이 버튼이 right: 2rem -> right: 6.5rem 으로 0.4초 슬라이딩 이동!)
        await page.evaluate("""() => {
            if (typeof switchPage === 'function' && typeof suggestionPage !== 'undefined' && typeof mainPage !== 'undefined') {
                switchPage(mainPage, suggestionPage, true);
            }
        }""")

        slide_timeline_1 = []
        for ms in [0, 100, 200, 300, 400]:
            await page.wait_for_timeout(100 if ms > 0 else 0)
            right_val = await page.evaluate("""() => {
                const aiFab = document.getElementById('aiChatbotFab');
                return window.getComputedStyle(aiFab).right;
            }""")
            slide_timeline_1.append((ms, right_val))

        print("[홈 -> 커뮤니티 슬라이딩 right 위치 타임라인]")
        for ms, r in slide_timeline_1:
            print(f"[{ms:3d}ms] aiChatbotFab right: {r}")

        # 2. 커뮤니티 -> 홈 탭 복귀! (글쓰기 버튼이 사라지면서 제미나이 버튼이 right: 6.5rem -> right: 2rem 으로 0.4초 슬라이딩 복귀!)
        print("\n=== 커뮤니티(건의사항) -> 홈(인사말) 탭 복귀 시 제미나이 버튼 슬라이딩 복귀 검증 ===")
        await page.evaluate("""() => {
            if (typeof switchPage === 'function' && typeof suggestionPage !== 'undefined' && typeof mainPage !== 'undefined') {
                switchPage(suggestionPage, mainPage, true);
            }
        }""")

        slide_timeline_2 = []
        for ms in [0, 100, 200, 300, 400]:
            await page.wait_for_timeout(100 if ms > 0 else 0)
            right_val = await page.evaluate("""() => {
                const aiFab = document.getElementById('aiChatbotFab');
                return window.getComputedStyle(aiFab).right;
            }""")
            slide_timeline_2.append((ms, right_val))

        print("[커뮤니티 -> 홈 슬라이딩 right 위치 타임라인]")
        for ms, r in slide_timeline_2:
            print(f"[{ms:3d}ms] aiChatbotFab right: {r}")

        screenshot_path = os.path.abspath('gui-test-screenshots/slide_result.png')
        await page.screenshot(path=screenshot_path)

        video = page.video
        await context.close()
        video_path = await video.path()
        print(f"\n제미나이 버튼 좌우 슬라이딩 실시간 비디오 저장 완료: {video_path}")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
