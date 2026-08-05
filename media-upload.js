// Community video uploader: Cloudinary free plan (no API secret is used here).
(function () {
    const CLOUDINARY_CLOUD_NAME = 'fsfobwwl';
    const CLOUDINARY_VIDEO_PRESET = 'club_video_upload';
    const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

    function createUploadError(message, status) {
        const error = new Error(message);
        error.code = 'cloudinary/upload-failed';
        error.status = status || 0;
        return error;
    }

    window.getCommunityVideoLimit = function () {
        return MAX_VIDEO_SIZE_BYTES;
    };

    function getResourceType(file) {
        const type = file.type || '';
        if (type.startsWith('image/')) return 'image';
        if (type.startsWith('video/') || type.startsWith('audio/')) return 'video';
        return 'raw';
    }

    window.uploadCommunityMedia = function (file) {
        if (!file) {
            return Promise.reject(createUploadError('동영상 파일을 찾을 수 없습니다.'));
        }
        if (file.size > MAX_VIDEO_SIZE_BYTES) {
            return Promise.reject(createUploadError('무료 첨부파일은 파일당 100MB까지 가능합니다.'));
        }

        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_VIDEO_PRESET);
            formData.append('folder', 'club-community-videos');

            const request = new XMLHttpRequest();
            request.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${getResourceType(file)}/upload`, true);
            request.responseType = 'json';

            request.upload.onprogress = (event) => {
                if (event.lengthComputable && typeof window.updateCommentUploadProgress === 'function') {
                    window.updateCommentUploadProgress(file, event.loaded, event.total);
                }
            };

            request.onerror = () => reject(createUploadError('인터넷 연결 때문에 동영상 업로드를 시작하지 못했습니다.'));
            request.onabort = () => reject(createUploadError('동영상 업로드가 취소되었습니다.'));
            request.onload = () => {
                const result = request.response || {};
                if (request.status < 200 || request.status >= 300 || !result.secure_url) {
                    const detail = result && result.error && result.error.message;
                    reject(createUploadError(detail || '동영상 업로드에 실패했습니다.', request.status));
                    return;
                }
                resolve(result.secure_url);
            };

            request.send(formData);
        });
    };

    window.uploadCommunityVideo = window.uploadCommunityMedia;
})();
