// 대용량 영상 폰 서버의 공개 주소를 여기에 한 번만 적습니다.
// 서버를 아직 만들기 전에는 enabled를 false로 둡니다.
window.phoneMediaServerConfig = {
    enabled: false,
    baseUrl: '',
    maxVideoSizeBytes: 1024 * 1024 * 1024,
    chunkSizeBytes: 8 * 1024 * 1024
};
