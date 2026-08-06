// Shared Cloudinary uploader for community attachments. No API secret is stored here.
(function () {
    const CLOUDINARY_CLOUD_NAME = 'fsfobwwl';
    const CLOUDINARY_UPLOAD_PRESET = 'club_video_upload';
    // Cloudinary 무료 요금제의 동영상 1개당 실제 한도입니다.
    const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

    function createUploadError(message, status) {
        const error = new Error(message);
        error.code = 'cloudinary/upload-failed';
        error.status = status || 0;
        return error;
    }

    function isVideo(file) {
        return (file.type || '').startsWith('video/') || /\.(mp4|webm)$/i.test(file.name || '');
    }

    function getResourceType(file) {
        const type = file.type || '';
        if (type.startsWith('image/') || type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) return 'image';
        if (type.startsWith('video/') || type.startsWith('audio/')) return 'video';
        return 'raw';
    }

    function getUploadUrl(file) {
        return `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${getResourceType(file)}/upload`;
    }

    function createFormData(filePart, name) {
        const formData = new FormData();
        formData.append('file', filePart, name);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        formData.append('folder', 'club-community-files');
        return formData;
    }

    function updateProgress(file, transferred, total) {
        if (typeof window.updateCommentUploadProgress === 'function') {
            window.updateCommentUploadProgress(file, transferred, total);
        }
    }

    function parseResponse(responseText) {
        try {
            return JSON.parse(responseText || '{}');
        } catch (e) {
            return {};
        }
    }

    function uploadDirectly(file) {
        return new Promise((resolve, reject) => {
            const request = new XMLHttpRequest();
            request.open('POST', getUploadUrl(file), true);
            request.responseType = 'json';
            request.upload.onprogress = (event) => {
                if (event.lengthComputable) updateProgress(file, event.loaded, event.total);
            };
            request.onerror = () => reject(createUploadError('인터넷 연결 때문에 업로드를 시작하지 못했습니다.'));
            request.onabort = () => reject(createUploadError('업로드가 취소되었습니다.'));
            request.onload = () => {
                const result = request.response || parseResponse(request.responseText);
                if (request.status < 200 || request.status >= 300 || !result.secure_url) {
                    const detail = result && result.error && result.error.message;
                    reject(createUploadError(detail || '첨부파일 업로드에 실패했습니다.', request.status));
                    return;
                }
                updateProgress(file, file.size, file.size);
                resolve(result.secure_url);
            };
            request.send(createFormData(file, file.name));
        });
    }

    window.getCommunityVideoLimit = function () {
        const phoneServerLimit = typeof window.getPhoneMediaServerVideoLimit === 'function'
            ? Number(window.getPhoneMediaServerVideoLimit())
            : 0;
        return phoneServerLimit > MAX_VIDEO_SIZE_BYTES ? phoneServerLimit : MAX_VIDEO_SIZE_BYTES;
    };

    window.uploadCommunityMedia = function (file) {
        if (!file) return Promise.reject(createUploadError('첨부파일을 찾을 수 없습니다.'));
        if (isVideo(file)) {
            const videoLimit = window.getCommunityVideoLimit();
            if (file.size > videoLimit) {
                return Promise.reject(createUploadError(`동영상은 파일당 ${Math.round(videoLimit / 1024 / 1024)}MB까지 업로드할 수 있습니다.`));
            }
            if (file.size > MAX_VIDEO_SIZE_BYTES) {
                if (typeof window.uploadVideoToPhoneServer === 'function') {
                    return window.uploadVideoToPhoneServer(file);
                }
                return Promise.reject(createUploadError('대용량 영상 저장소가 아직 연결되지 않았습니다. 현재는 100MB 이하 영상만 올릴 수 있습니다.'));
            }
        }
        return uploadDirectly(file);
    };

    window.uploadCommunityVideo = window.uploadCommunityMedia;
})();
