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
        await page.wait_for_timeout(1200)

        # 1. 제미나이 챗봇 FAB 버튼 기본 켜짐(display: flex) 상태로 임의 활성화 (Firestore 설정 온 가정)
        await page.evaluate("""() => {
            const aiFab = document.getElementById('aiChatbotFab');
            if (aiFab) {
                aiFab.style.display = 'flex';
                aiFab.style.opacity = '1';
                aiFab.style.visibility = 'visible';
            }
            if (typeof switchPage === 'function' && typeof suggestionPage !== 'undefined' && typeof mainPage !== 'undefined') {
                switchPage(mainPage, suggestionPage, true);
            }
        }""")
        await page.wait_for_timeout(500)

        # 2. 건의글 클릭하여 게시물 상세 열기
        await page.evaluate("""() => {
            if (typeof openPostDetail === 'function') {
                openPostDetail('test-1', { title: '테스트 게시물', content: '테스트 내용' }, '', '방금 전');
            }
        }""")
        await page.wait_for_timeout(600)

        # 3. 게시물 상세 닫기 (목록 복귀!)
        await page.evaluate("""() => {
            if (typeof closeSideDetail === 'function') {
                closeSideDetail();
            }
        }""")
        await page.wait_for_timeout(800)

        # 4. 목록 복귀 직후 상단 로고, 헤더 액션, 글쓰기 버튼, 제미나이 FAB 버튼 4개 요소 상태 측정!
        restored_all = await page.evaluate("""() => {
            const logo = document.getElementById('logoHomeBtn');
            const actions = document.querySelector('.header-actions');
            const writeBtn = document.getElementById('writePostBtn');
            const aiFab = document.getElementById('aiChatbotFab');

            const getS = (el) => {
                if (!el) return null;
                const s = window.getComputedStyle(el);
                return { opacity: s.opacity, visibility: s.visibility, display: s.display, transform: s.transform };
            };

            return {
                logo: getS(logo),
                actions: getS(actions),
                writeBtn: getS(writeBtn),
                aiFab: getS(aiFab)
            };
        }""")

        print("\n=== 게시물 복귀 후 전체 UI 요소 복원 측정 리포트 ===")
        print(f"1. 상단 로고 버튼: {restored_all['logo']}")
        print(f"2. 상단 헤더 액션: {restored_all['actions']}")
        print(f"3. 글쓰기 FAB 버튼: {restored_all['writeBtn']}")
        print(f"4. 제미나이 FAB 버튼: {restored_all['aiFab']}")

        screenshot_path = os.path.abspath('gui-test-screenshots/all_restored_result.png')
        await page.screenshot(path=screenshot_path)
        print(f"\n전체 복원 스크린샷 저장 완료: {screenshot_path}")

        video = page.video
        await context.close()
        video_path = await video.path()
        print(f"전체 복원 실시간 비디오 저장 완료: {video_path}")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
