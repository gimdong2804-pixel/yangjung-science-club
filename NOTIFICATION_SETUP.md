# 무료 알림 서버 연결 안내

이 사이트의 알림은 Firebase Cloud Functions나 Blaze 요금제를 사용하지 않습니다.
Cloudflare Workers Free와 표준 Web Push를 사용합니다.

## 비용 안전 기준

- Workers Free만 사용합니다.
- 유료 Workers Paid로 업그레이드하지 않습니다.
- 무료 한도는 하루 100,000회이며 매일 오전 9시(한국 시간)에 초기화됩니다.
- 한도를 넘으면 그날 알림 서버가 멈출 뿐 자동 결제되지 않습니다.

## 배포 전에 필요한 값

- 무료 Cloudflare 계정
- D1 데이터베이스 ID
- 배포된 Worker 주소
- Web Push VAPID 공개 키와 비공개 키
- 실제 사이트 주소

VAPID 비공개 키는 Cloudflare Secret에만 저장하고 채팅이나 GitHub에 올리지 않습니다.

## 현재 배포 상태

- Worker: `https://yangjung-science-notifications.wowkim77777.workers.dev`
- D1 데이터베이스: `yangjung-science-notifications`
- Worker Secret(VAPID 공개 키·비공개 키·subject): 등록 완료
- Worker health, VAPID 공개 키, CORS, 로그인 필수 응답: 확인 완료

Cloudflare 쪽 배포는 끝났습니다. 사이트 파일은 GitHub Pages에 직접 커밋·푸시해야 실제 사이트에서 연결됩니다.

## 작업 순서

1. `cloudflare-notification-worker` 폴더에서 무료 Cloudflare 로그인을 연결합니다.
2. `yangjung-science-notifications` D1 데이터베이스를 생성합니다.
3. `schema.sql`을 D1에 적용합니다.
4. VAPID 키를 생성해 Cloudflare Secret에 저장합니다.
5. `wrangler.jsonc`에 D1 ID와 실제 사이트 주소를 입력합니다.
6. Worker를 배포합니다.
7. 받은 `workers.dev` 주소를 `notification-worker-config.js`에 입력합니다.
8. 로컬·실제 기기에서 로그인 계정별 푸시를 검사한 뒤 Git 배포합니다.

외부 계정 생성, Secret 등록, Worker 배포는 사용자 확인 후에만 실행합니다.
