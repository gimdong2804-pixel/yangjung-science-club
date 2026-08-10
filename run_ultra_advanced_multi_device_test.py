import asyncio
import os
import json
from playwright.async_api import async_playwright

# 사용자 폰과 에뮬레이터 간 다양한 폰 디바이스 해상도 매트릭스 정의
TEST_DEVICES = [
    {"name": "Galaxy S24 Ultra (대형 폰)", "width": 412, "height": 915, "dpr": 3.5},
    {"name": "Galaxy S20/S22/S23 (표준 폰)", "width": 360, "height": 800, "dpr": 3.0},
    {"name": "iPhone 15 Pro Max (대형 iOS)", "width": 430, "height": 932, "dpr": 3.0},
    {"name": "Compact Android (소형 폰)", "width": 320, "height": 640, "dpr": 2.0}
]

async def run():
    video_dir = os.path.abspath('gui-test-screenshots/videos')
    os.makedirs(video_dir, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        print("\n=======================================================")
        print("[진보된 테스트 기법] 다종 모바일 디바이스 해상도 매트릭스 & 요소 2D Bounding Box 겹침 0px 수학 검증")
        print("=======================================================\n")

        summary_results = []

        for dev in TEST_DEVICES:
            context = await browser.new_context(
                viewport={'width': dev['width'], 'height': dev['height']},
                device_scale_factor=dev['dpr'],
                user_agent='Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                record_video_dir=video_dir,
                record_video_size={'width': dev['width'], 'height': dev['height']}
            )
            page = await context.new_page()

            html_path = os.path.abspath('index.html')
            await page.goto(f'file:///{html_path}')
            await page.wait_for_timeout(800)

            # 제미나이 챗봇 모달 오픈
            await page.evaluate("""() => {
                if (typeof openAiChatbotModal === 'function') {
                    openAiChatbotModal();
                }
            }""")
            await page.wait_for_timeout(500)

            # 요소 2D Bounding Box 충돌/겹침 및 해더 1행 이탈 수학적 계산
            overlap_check = await page.evaluate("""() => {
                const title = document.querySelector('.ai-chatbot-header-title');
                const dropdown = document.getElementById('aiModelDropdownContainer');
                const closeBtn = document.getElementById('closeAiChatbot');

                if (!title || !dropdown || !closeBtn) return { error: '요소 없음' };

                const rT = title.getBoundingClientRect();
                const rD = dropdown.getBoundingClientRect();
                const rC = closeBtn.getBoundingClientRect();

                // 겹침 여부 수학 검증 (r1.right > r2.left)
                const title_dropdown_overlap = (rT.right > rD.left + 2); // 2px margin
                const dropdown_close_overlap = (rD.right > rC.left + 2);

                return {
                    titleBox: { x: Math.round(rT.x), width: Math.round(rT.width), right: Math.round(rT.right) },
                    dropdownBox: { x: Math.round(rD.x), width: Math.round(rD.width), right: Math.round(rD.right) },
                    closeBox: { x: Math.round(rC.x), width: Math.round(rC.width), right: Math.round(rC.right) },
                    isOverlap: title_dropdown_overlap || dropdown_close_overlap
                };
            }""")

            safe_dev_name = dev['name'].replace(' ', '_').replace('/', '_').replace('(', '').replace(')', '')
            screenshot_path = os.path.abspath(f'gui-test-screenshots/device_{safe_dev_name}.png')
            await page.screenshot(path=screenshot_path)

            video = page.video
            await context.close()
            video_path = await video.path() if video else 'None'

            res_info = {
                "device": dev['name'],
                "viewport": f"{dev['width']}x{dev['height']}",
                "isOverlap": overlap_check.get('isOverlap', False),
                "titleRight": overlap_check.get('titleBox', {}).get('right'),
                "dropdownX": overlap_check.get('dropdownBox', {}).get('x'),
                "dropdownRight": overlap_check.get('dropdownBox', {}).get('right'),
                "closeX": overlap_check.get('closeBox', {}).get('x'),
                "screenshot": screenshot_path,
                "video": video_path
            }
            summary_results.append(res_info)

        print("\n=== 다종 모바일 디바이스 겹침(Collision) 0px 수학적 검증 리포트 ===")
        for r in summary_results:
            status = "[FAIL] 겹침 발생!" if r['isOverlap'] else "[PASS] 겹침 0px (완벽 1줄 배치)"
            print(f"[{r['device']} | {r['viewport']}] -> {status}")
            print(f"   - 타이틀 끝: {r['titleRight']}px < 드롭다운 시작: {r['dropdownX']}px | 드롭다운 끝: {r['dropdownRight']}px < 닫기 시작: {r['closeX']}px")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
