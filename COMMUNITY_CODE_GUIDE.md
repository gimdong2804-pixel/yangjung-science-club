# 커뮤니티 코드 안내

`community.js` 하나에 있던 기능을 역할별로 분리했습니다. HTML에서는 아래 순서로 불러오므로, 파일 이름이나 순서를 바꿀 때는 주의하세요.

| 파일 | 담당 기능 |
| --- | --- |
| `community.js` | 로그인 상태, 글 작성, 게시글 목록과 정렬 |
| `community-comment-render.js` | 댓글·답글 목록을 화면에 그리기, 답글 선택 |
| `community-post-detail.js` | 게시글 상세 화면, 좋아요·수정·삭제, 댓글 관리 |
| `media-upload.js` | Cloudinary로 실제 파일을 전송하고 진행률 표시 |
| `community-attachments.js` | 이미지·동영상·오디오·PDF·HTML 선택, 용량/개수 경고, 댓글 등록 |
| `community-ui.js` | 사이드 메뉴 연결, 이미지 크게 보기와 확대/이동 |
| `community-interactions.js` | 게시글 다중 선택, 휴대폰 뒤로가기 처리, PWA 설정 |

파일 업로드 관련 수정은 먼저 `community-attachments.js`를 보고, 실제 클라우드 전송 방식 수정이 필요할 때만 `media-upload.js`를 수정하면 됩니다.

현재 첨부 파일 공통 개수 제한은 종류별 최대 10개입니다. 파일당 용량 제한은 이미지 20MB, 동영상 1GB, 오디오 100MB, PDF 50MB, HTML 10MB입니다.
