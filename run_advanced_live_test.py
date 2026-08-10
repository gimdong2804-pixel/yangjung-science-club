import asyncio
import os
import json
from playwright.async_api import async_playwright

async def run():
    video_dir = os.path.abspath('gui-test-screenshots/videos')
    os.makedirs(video_dir, exist_ok=True)

    async with async_playwright() as p:
        # 실제 갤럭시 디바이스 환경 에뮬레이션
        browser = await p.chromium.launch(headless=True)
        device = p.devices['Galaxy S9+']
        context = await browser.new_context(
            **device,
            record_video_dir=video_dir,
            record_video_size={'width': 360, 'height': 740}
        )
        page = await context.new_page()

        # 1. 실제 인터넷 라이브 서버 주소로 직접 접속!
        live_url = "https://gimdong2804-pixel.github.io/yangjung-science-club/"
        print(f"\n[새로운 테스트 방식 1] 실제 라이브 배포 주소 직접 접속: {live_url}")
        
        try:
            response = await page.goto(live_url, wait_until='networkidle', timeout=15000)
            print(f"라이브 서버 응답 코드: {response.status}")
        except Exception as e:
            print(f"라이브 서버 접속 시도 중 (로컬 서버 기반으로 교차 검증 진행): {e}")
            html_path = os.path.abspath('index.html')
            await page.goto(f'file:///{html_path}')

        await page.wait_for_timeout(1500)

        # 2. 터치(Touch) 이벤트로 커뮤니티(건의사항) 탭 터치 이동 및 게시글 터치 진입 시뮬레이션
        print("\n[새로운 테스트 방식 2] 모바일 실제 터치(Touch) 및 스크롤 인터랙션 수행")
        
        # 제미나이 챗봇 활성화 상태 임의 부여
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

        # 터치 스크롤 이벤트 발생 시켜 스크롤 감지기 작동 테스트
        await page.touchscreen.tap(200, 300)
        await page.evaluate("window.scrollTo(0, 100)")
        await page.wait_for_timeout(200)

        # 게시물 터치 열기
        await page.evaluate("""() => {
            if (typeof openPostDetail === 'function') {
                openPostDetail('test-1', { title: '터치 검증 게시물', content: '터치 테스트 내용' }, '', '방금 전');
            }
        }""")
        await page.wait_for_timeout(600)

        print("\n[새로운 테스트 방식 3] 실시간 DOM Computed Style 50ms 타임라인 스트리밍 트레이스 시작")
        
        # 3. 게시물 닫기(복귀) 수행하면서 50ms 마다 4개 UI 요소의 컴퓨티드 스타일 타임라인 트레이싱!
        await page.evaluate("""() => {
            if (typeof closeSideDetail === 'function') {
                closeSideDetail();
            }
        }""")

        timeline_logs = []
        for ms in [0, 50, 100, 200, 350, 500]:
            await page.wait_for_timeout(50 if ms > 0 else 0)
            status = await page.evaluate("""() => {
                const logo = document.getElementById('logoHomeBtn');
                const actions = document.querySelector('.header-actions');
                const writeBtn = document.getElementById('writePostBtn');
                const aiFab = document.getElementById('aiChatbotFab');

                const getInfo = (el) => {
                    if (!el) return 'NULL';
                    const s = window.getComputedStyle(el);
                    return `opacity:${s.opacity} | vis:${s.visibility} | disp:${s.display} | right:${s.right}`;
                };

                return {
                    logo: getInfo(logo),
                    actions: getInfo(actions),
                    writeBtn: getInfo(writeBtn),
                    aiFab: getInfo(aiFab)
                };
            }""")
            timeline_logs.append((ms, status))

        print("\n=== 50ms 타임라인 트레이스 결과 ===")
        for ms, st in timeline_logs:
            print(f"[{ms:3d}ms] 로고: {st['logo']} | 헤더: {st['actions']} | 글쓰기: {st['writeBtn']} | 제미나이: {st['aiFab']}")

        screenshot_path = os.path.abspath('gui-test-screenshots/advanced_touch_result.png')
        await page.screenshot(path=screenshot_path)
        print(f"\n새로운 방식 최종 검증 스크린샷 저장: {screenshot_path}")

        video = page.video
        await context.close()
        video_path = await video.path()
        print(f"새로운 방식 실시간 터치 비디오 저장: {video_path}")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
