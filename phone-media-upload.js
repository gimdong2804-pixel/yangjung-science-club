// 100MB를 넘는 MP4/WebM 영상을 폰 서버에 8MB씩 나누어 보내는 기능
(function () {
    const CLOUDINARY_VIDEO_LIMIT_BYTES = 100 * 1024 * 1024;
    const ONE_GB = 1024 * 1024 * 1024;
    const DEFAULT_CHUNK_SIZE_BYTES = 8 * 1024 * 1024;

    function getConfig() {
        const raw = window.phoneMediaServerConfig || {};
        const baseUrl = String(raw.baseUrl || '').replace(/\/$/, '');
        const enabled = raw.enabled === true && /^https?:\/\//i.test(baseUrl);
        const maxVideoSizeBytes = Math.min(Number(raw.maxVideoSizeBytes) || ONE_GB, ONE_GB);
        const chunkSizeBytes = Math.min(Math.max(Number(raw.chunkSizeBytes) || DEFAULT_CHUNK_SIZE_BYTES, 5 * 1024 * 1024), 50 * 1024 * 1024);
        return { enabled, baseUrl, maxVideoSizeBytes, chunkSizeBytes };
    }

    function createUploadError(message) {
        const error = new Error(message);
        error.code = 'phone-server/upload-failed';
        return error;
    }

    function updateProgress(file, transferred, total) {
        if (typeof window.updateCommentUploadProgress === 'function') {
            window.updateCommentUploadProgress(file, transferred, total);
        }
    }

    async function getLoginToken() {
        const user = window.auth && window.auth.currentUser;
        if (!user) throw createUploadError('대용량 영상을 올리려면 먼저 Google 로그인을 해주세요.');
        return user.getIdToken();
    }

    async function requestToPhoneServer(route, options = {}) {
        const config = getConfig();
        if (!config.enabled) {
            throw createUploadError('대용량 영상 저장소가 아직 연결되지 않았습니다. 현재는 100MB 이하 영상만 올릴 수 있습니다.');
        }

        const token = await getLoginToken();
        const response = await fetch(`${config.baseUrl}${route}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(options.headers || {})
            }
        });
        const text = await response.text();
        let body = {};
        try { body = JSON.parse(text || '{}'); } catch (_) { body = {}; }
        if (!response.ok) {
            throw createUploadError(body.error || `폰 서버가 업로드를 받지 못했습니다. (${response.status})`);
        }
        return body;
    }

    window.isPhoneMediaServerReady = function () {
        return getConfig().enabled;
    };

    window.getPhoneMediaServerVideoLimit = function () {
        const config = getConfig();
        return config.enabled ? config.maxVideoSizeBytes : 0;
    };

    window.uploadVideoToPhoneServer = async function (file) {
        const config = getConfig();
        if (!config.enabled) {
            throw createUploadError('대용량 영상 저장소가 아직 연결되지 않았습니다. 현재는 100MB 이하 영상만 올릴 수 있습니다.');
        }
        if (!file || file.size < 1) throw createUploadError('동영상 파일을 찾지 못했습니다.');
        if (file.size > config.maxVideoSizeBytes) {
            throw createUploadError(`대용량 영상은 파일당 ${Math.round(config.maxVideoSizeBytes / 1024 / 1024)}MB까지 올릴 수 있습니다.`);
        }
        if (file.size <= CLOUDINARY_VIDEO_LIMIT_BYTES) {
            throw createUploadError('100MB 이하 영상은 일반 저장소로 올려야 합니다.');
        }

        const startResult = await requestToPhoneServer('/api/uploads/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, size: file.size, mimeType: file.type })
        });
        const uploadId = startResult.uploadId;
        const chunkSize = Math.min(Number(startResult.chunkSizeBytes) || config.chunkSizeBytes, config.chunkSizeBytes);
        if (!uploadId || chunkSize < 1) throw createUploadError('폰 서버가 업로드 준비 정보를 올바르게 보내지 않았습니다.');

        let start = 0;
        while (start < file.size) {
            const end = Math.min(start + chunkSize, file.size);
            await requestToPhoneServer(`/api/uploads/${uploadId}/chunks/${Math.floor(start / chunkSize)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Content-Range': `bytes ${start}-${end - 1}/${file.size}`
                },
                body: file.slice(start, end)
            });
            start = end;
            updateProgress(file, start, file.size);
        }

        const completed = await requestToPhoneServer(`/api/uploads/${uploadId}/complete`, { method: 'POST' });
        if (!completed.url) throw createUploadError('폰 서버가 재생 주소를 보내지 않았습니다.');
        updateProgress(file, file.size, file.size);
        return completed.url;
    };

    function updateVideoLimitLabel() {
        const label = document.getElementById('commentVideoLimitLabel');
        if (!label) return;
        label.textContent = '동영상 (유튜브로)';
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateVideoLimitLabel, { once: true });
    } else {
        updateVideoLimitLabel();
    }
})();
