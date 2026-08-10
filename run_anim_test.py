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
        await page.wait_for_timeout(1000)

        # 1. 건의사항 페이지로 전환 및 게시글 상세 열기
        await page.evaluate("""() => {
            if (typeof switchPage === 'function' && typeof suggestionPage !== 'undefined' && typeof mainPage !== 'undefined') {
                switchPage(mainPage, suggestionPage, true);
            }
            if (typeof openPostDetail === 'function') {
                openPostDetail('test-1', { title: '테스트 게시물', content: '테스트 내용' }, '', '방금 전');
            }
        }""")
        await page.wait_for_timeout(500)

        # 2. 상세 페이지 닫기 (목록 복귀 애니메이션 시작!)
        await page.evaluate("""() => {
            if (typeof closeSideDetail === 'function') {
                closeSideDetail();
            }
        }""")

        # 0.1초 후 (애니메이션 중간 프레임)
        await page.wait_for_timeout(100)
        mid_styles = await page.evaluate("""() => {
            const btn = document.getElementById('writePostBtn');
            const aiFab = document.getElementById('aiChatbotFab');
            return {
                writeBtn: { transform: window.getComputedStyle(btn).transform, opacity: window.getComputedStyle(btn).opacity },
                aiFab: { transform: window.getComputedStyle(aiFab).transform, opacity: window.getComputedStyle(aiFab).opacity }
            };
        }""")

        # 0.45초 후 (애니메이션 완료 상태)
        await page.wait_for_timeout(350)
        final_styles = await page.evaluate("""() => {
            const btn = document.getElementById('writePostBtn');
            const aiFab = document.getElementById('aiChatbotFab');
            return {
                writeBtn: { transform: window.getComputedStyle(btn).transform, opacity: window.getComputedStyle(btn).opacity, visibility: window.getComputedStyle(btn).visibility },
                aiFab: { transform: window.getComputedStyle(aiFab).transform, opacity: window.getComputedStyle(aiFab).opacity, visibility: window.getComputedStyle(aiFab).visibility }
            };
        }""")

        print("\n=== 건의사항 목록 복귀 FAB 애니메이션 측정 수치 ===")
        print(f"[0.10s 중간 진행] writePostBtn: {mid_styles['writeBtn']}")
        print(f"[0.10s 중간 진행] aiChatbotFab:  {mid_styles['aiFab']}")
        print(f"[0.45s 최종 완료] writePostBtn: {final_styles['writeBtn']}")
        print(f"[0.45s 최종 완료] aiChatbotFab:  {final_styles['aiFab']}")

        os.makedirs('gui-test-screenshots', exist_ok=True)
        screenshot_path = os.path.abspath('gui-test-screenshots/fab_anim_result.png')
        await page.screenshot(path=screenshot_path)
        print(f"\n복귀 애니메이션 완료 스크린샷 저장 완료: {screenshot_path}")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
