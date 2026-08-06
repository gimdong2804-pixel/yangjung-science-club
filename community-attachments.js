// 댓글·답글 첨부파일 선택, 제한 확인, 업로드와 등록 기능
// 이미지 고화질 유지 및 용량 최적화 함수
async function compressImage(file, maxWidth = 1920, maxHeight = 1920, quality = 0.90) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth || height > maxHeight) {
                    if (width / height > maxWidth / maxHeight) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = Math.round((img.height * width) / img.width);
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                // 고화질 선명도를 유지하면서 전송 제한 용량만 스마트하게 맞춤
                let curQuality = quality;
                let dataUrl = canvas.toDataURL('image/jpeg', curQuality);

                while (dataUrl.length > 900000 && curQuality > 0.6) {
                    curQuality -= 0.05;
                    dataUrl = canvas.toDataURL('image/jpeg', curQuality);
                }

                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
            img.src = e.target.result;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
}

// 댓글/답글 첨부파일 데이터 상태
let commentAttachedImages = [];
let commentAttachedVideos = [];
let commentAttachedAudios = [];
let commentAttachedPdfs = [];
let commentAttachedHtmls = [];

const commentAttachBtn = document.getElementById('commentAttachBtn');
const commentAttachMenu = document.getElementById('commentAttachMenu');
const commentAttachImageBtn = document.getElementById('commentAttachImageBtn');
const commentAttachVideoBtn = document.getElementById('commentAttachVideoBtn');
const commentAttachAudioBtn = document.getElementById('commentAttachAudioBtn');
const commentAttachPdfBtn = document.getElementById('commentAttachPdfBtn');
const commentAttachHtmlBtn = document.getElementById('commentAttachHtmlBtn');

const commentImageInput = document.getElementById('commentImageInput');
const commentVideoInput = document.getElementById('commentVideoInput');
const commentAudioInput = document.getElementById('commentAudioInput');
const commentPdfInput = document.getElementById('commentPdfInput');
const commentHtmlInput = document.getElementById('commentHtmlInput');

const commentImagePreviewContainer = document.getElementById('commentImagePreviewContainer');

if (commentAttachBtn) {
    commentAttachBtn.addEventListener('click', () => {
        commentAttachBtn.classList.toggle('open');
        if (commentAttachMenu) commentAttachMenu.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (commentAttachBtn && commentAttachMenu && !commentAttachBtn.contains(e.target) && !commentAttachMenu.contains(e.target)) {
            commentAttachBtn.classList.remove('open');
            commentAttachMenu.classList.remove('active');
        }
    });
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = err => reject(err);
        reader.readAsDataURL(file);
    });
}

// 1. 이미지 첨부 (최대 10개)
if (commentAttachImageBtn && commentImageInput) {
    commentAttachImageBtn.addEventListener('click', () => {
        if (commentAttachedImages.length >= 10) {
            alert('이미지는 최대 10개까지만 첨부할 수 있습니다.');
            return;
        }
        commentImageInput.click();
        if (commentAttachMenu) commentAttachMenu.classList.remove('active');
        if (commentAttachBtn) commentAttachBtn.classList.remove('open');
    });

    commentImageInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        if (commentAttachedImages.length + files.length > 10) {
            alert('이미지는 최대 10개까지만 첨부할 수 있습니다.');
            return;
        }

        try {
            for (const file of files) {
                if (commentAttachedImages.length >= 10) break;
                if (file.size > COMMENT_ATTACHMENT_SIZE_LIMITS.image) {
                    showAttachmentSizeAlert(file, '이미지', COMMENT_ATTACHMENT_SIZE_LIMITS.image);
                    continue;
                }
                const compressedDataUrl = await compressImage(file, 1600, 1600, 0.85);
                commentAttachedImages.push({
                    file: file,
                    dataUrl: compressedDataUrl
                });
            }
            renderCommentAttachmentPreview();
        } catch (err) {
            console.error("이미지 압축 실패:", err);
            alert("이미지 처리 중 오류가 발생했습니다.");
        } finally {
            commentImageInput.value = '';
        }
    });
}

// --- 100% 무료 내장 대용량 미디어 엔지니어링 (신용카드/결제 0원) ---
const MAX_COMMENT_ATTACHMENTS = 10;
const COMMENT_ATTACHMENT_SIZE_LIMITS = {
    image: 100 * 1024 * 1024,
    video: 1024 * 1024 * 1024,
    audio: 100 * 1024 * 1024,
    pdf: 50 * 1024 * 1024,
    html: 10 * 1024 * 1024
};

function showAttachmentCountAlert(typeName) {
    alert(`${typeName}은(는) 최대 ${MAX_COMMENT_ATTACHMENTS}개까지 첨부할 수 있습니다.`);
}

function showAttachmentSizeAlert(file, typeName, limitBytes) {
    const limitMB = limitBytes / 1024 / 1024;
    alert(`'${file.name}' 파일이 ${typeName} 용량 제한(${limitMB}MB)을 초과했습니다.\n파일 크기를 줄인 뒤 다시 선택해 주세요.`);
}

const DB_NAME = 'ClubMediaStorageDB';
const STORE_NAME = 'mediaFiles';

function openMediaDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

async function saveMediaFileLocally(file) {
    const fileId = 'media_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    try {
        const db = await openMediaDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(file, fileId);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
        return 'localmedia://' + fileId;
    } catch (e) {
        console.warn("로컬 미디어 DB 저장 실패, fallback:", e);
        if (file.size <= 400 * 1024) {
            return await readFileAsDataURL(file);
        }
        return '';
    }
}

function dataURLtoBlob(dataurl) {
    try {
        const arr = dataurl.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'video/mp4';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    } catch (e) {
        console.error("dataURLtoBlob 변환 에러:", e);
        return null;
    }
}

window.resolveMediaUrl = async function (rawUrl) {
    if (!rawUrl) return '';
    if (rawUrl.startsWith('localmedia://')) {
        const fileId = rawUrl.replace('localmedia://', '');
        try {
            const db = await openMediaDB();
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get(fileId);
                req.onsuccess = () => {
                    if (req.result) {
                        resolve(URL.createObjectURL(req.result));
                    } else {
                        resolve('');
                    }
                };
                req.onerror = () => resolve('');
            });
        } catch (e) {
            return '';
        }
    }

    if (rawUrl.startsWith('data:video/')) {
        try {
            const blob = dataURLtoBlob(rawUrl);
            if (blob) {
                return URL.createObjectURL(blob);
            }
        } catch (e) {
            console.warn("Base64 video Blob 변환 실패:", e);
        }
    }

    return rawUrl;
};

function withTimeout(promise, ms = 15000, label = '작업') {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`[타임아웃] ${label} (${ms / 1000}초 제한 초과)`));
        }, ms);
    });

    return Promise.race([
        promise,
        timeoutPromise
    ]).finally(() => {
        clearTimeout(timeoutId);
    });
}

async function uploadFileToTmpFiles(file) {
    console.log(`[tmpfiles.org] 업로드 시도: ${file.name || '파일'}, 크기: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
    try {
        const task = (async () => {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('https://tmpfiles.org/api/v1/upload', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const json = await res.json();
                if (json && json.status === 'success' && json.data && json.data.url) {
                    const rawUrl = json.data.url;
                    // https://tmpfiles.org/12345/video.mp4 -> https://tmpfiles.org/dl/12345/video.mp4
                    const directUrl = rawUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
                    console.log(`[tmpfiles.org] 업로드 성공: ${directUrl}`);
                    return directUrl;
                }
            }
            return null;
        })();

        return await withTimeout(task, 30000, 'tmpfiles.org 업로드');
    } catch (e) {
        console.warn("[tmpfiles.org] 업로드 예외:", e.message || e);
        return null;
    }
}

async function uploadFileToFirebaseStorage(file, folder = 'comments/videos') {
    if (typeof firebase !== 'undefined' && firebase.storage) {
        console.log(`[Firebase Storage] 업로드 시작: ${file.name || '파일'}, 크기: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
        try {
            const uploadTask = (async () => {
                let storageRef;
                try {
                    storageRef = firebase.storage().ref();
                } catch (err) {
                    storageRef = firebase.app().storage('gs://yangjung-science.appspot.com').ref();
                }
                const ext = (file.name || 'video.mp4').split('.').pop() || 'mp4';
                const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
                const fileRef = storageRef.child(fileName);

                const snapshot = await fileRef.put(file);
                const downloadUrl = await snapshot.ref.getDownloadURL();
                return downloadUrl || null;
            })();

            const url = await withTimeout(uploadTask, 45000, 'Firebase Storage 업로드');
            if (url) {
                console.log(`[Firebase Storage] 업로드 완료: ${url}`);
                return url;
            }
        } catch (e) {
            console.warn("[Firebase Storage] 업로드 예외/타임아웃:", e.message || e);
        }
    }
    return null;
}

async function uploadFileToActualCloud(file) {
    console.log(`[클라우드 파이프라인 시작] 파일: ${file.name || '미상'}, 용량: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

    // 0. Google Cloud CDN 기반 Firebase Storage 0순위 시도 (초고속 CDN 스트리밍 지원, 25초 제한)
    try {
        console.log(`[클라우드 파이프라인 0순위] Firebase Storage (Google Cloud CDN) 업로드 시도...`);
        const fbUrl = await uploadFileToFirebaseStorage(file, 'comments/cloud');
        if (fbUrl && fbUrl.startsWith('http')) {
            console.log(`[클라우드 파이프라인 성공] Firebase Storage 완료 -> 초고속 스트리밍 준비 완료`);
            return fbUrl;
        }
    } catch (e) {
        console.warn("[클라우드 파이프라인] Firebase Storage 건너뜀:", e.message || e);
    }

    // 1. tmpfiles.org 시도 (15초 제한)
    try {
        console.log(`[클라우드 파이프라인 1순위] tmpfiles.org 시도...`);
        const tmpUrl = await uploadFileToTmpFiles(file);
        if (tmpUrl && tmpUrl.startsWith('http')) {
            console.log(`[클라우드 파이프라인 성공] tmpfiles.org 완료`);
            return tmpUrl;
        }
    } catch (e) {
        console.warn("[클라우드 파이프라인] tmpfiles.org 건너뜀:", e.message || e);
    }

    // 2. Litterbox Direct API (15초 제한)
    try {
        console.log(`[클라우드 파이프라인 2순위] Litterbox 업로드 시도...`);
        const lbTask = (async () => {
            const formData = new FormData();
            formData.append('reqtype', 'fileupload');
            formData.append('time', '72h');
            formData.append('fileToUpload', file);

            const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const url = await res.text();
                if (url && url.trim().startsWith('http')) {
                    return url.trim();
                }
            }
            return null;
        })();

        const lbUrl = await withTimeout(lbTask, 15000, 'Litterbox 업로드');
        if (lbUrl) {
            console.log(`[클라우드 파이프라인 성공] Litterbox 완료: ${lbUrl}`);
            return lbUrl;
        }
    } catch (e) {
        console.warn("[클라우드 파이프라인] Litterbox 실패:", e.message || e);
    }

    // 3. Catbox Direct API (15초 제한)
    try {
        console.log(`[클라우드 파이프라인 3순위] Catbox 업로드 시도...`);
        const cbTask = (async () => {
            const formData = new FormData();
            formData.append('reqtype', 'fileupload');
            formData.append('fileToUpload', file);

            const res = await fetch('https://catbox.moe/user/api.php', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const url = await res.text();
                if (url && url.trim().startsWith('http')) {
                    return url.trim();
                }
            }
            return null;
        })();

        const cbUrl = await withTimeout(cbTask, 15000, 'Catbox 업로드');
        if (cbUrl) {
            console.log(`[클라우드 파이프라인 성공] Catbox 완료: ${cbUrl}`);
            return cbUrl;
        }
    } catch (e) {
        console.warn("[클라우드 파이프라인] Catbox 실패:", e.message || e);
    }

    // 3. 400KB 이하 소형 파일 인라인
    if (file.size <= 400 * 1024) {
        try {
            console.log(`[클라우드 파이프라인] 400KB 이하 소형 파일 DataURL 처리`);
            return await readFileAsDataURL(file);
        } catch (e) {
            console.warn("[클라우드 파이프라인] readFileAsDataURL 실패:", e);
        }
    }

    // 4. 로컬 미디어 저장소 (IndexedDB) fallback
    console.log(`[클라우드 파이프라인] 로컬 저장소(IndexedDB) Fallback 실행`);
    return await saveMediaFileLocally(file);
}

// Files recorded in Firestore must always point to shared storage.  The former
// device-local fallback (localmedia://) can only be opened on the uploader's
// browser, which is why videos were unavailable on other phones and laptops.
function getUploadContentType(file) {
    if (file.type) return file.type;
    const extension = (file.name || '').split('.').pop().toLowerCase();
    const types = {
        mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
        m4v: 'video/x-m4v', ogv: 'video/ogg', mp3: 'audio/mpeg',
        m4a: 'audio/mp4', wav: 'audio/wav', pdf: 'application/pdf'
    };
    return types[extension] || 'application/octet-stream';
}

function getMediaFolder(file) {
    if (file.type.startsWith('video/')) return 'comments/videos';
    if (file.type.startsWith('audio/')) return 'comments/audios';
    if (file.type.startsWith('image/')) return 'comments/images';
    return 'comments/files';
}

function updateCommentUploadProgress(file, transferred, total) {
    if (!commentSubmitBtn || !total) return;
    const progress = Math.min(100, Math.round((transferred / total) * 100));
    commentSubmitBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i><span>${progress}%</span>`;
    commentSubmitBtn.title = `${file.name || '파일'} 업로드 ${progress}%`;
}
window.updateCommentUploadProgress = updateCommentUploadProgress;

async function uploadFileToFirebaseStorage(file, folder = getMediaFolder(file)) {
    if (typeof firebase === 'undefined' || !firebase.storage) {
        throw new Error('Shared media storage is unavailable.');
    }

    const storageRef = (window.storage || firebase.storage()).ref();
    const extension = (file.name || 'file').split('.').pop().toLowerCase() || 'bin';
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${extension}`;
    const metadata = {
        contentType: getUploadContentType(file),
        contentDisposition: 'inline',
        cacheControl: 'public,max-age=31536000,immutable'
    };
    const task = storageRef.child(fileName).put(file, metadata);

    return new Promise((resolve, reject) => {
        task.on('state_changed',
            snapshot => updateCommentUploadProgress(file, snapshot.bytesTransferred, snapshot.totalBytes),
            error => reject(error),
            async () => {
                try {
                    const url = await task.snapshot.ref.getDownloadURL();
                    if (!url || !url.startsWith('https://')) throw new Error('Could not create a shared media URL.');
                    resolve(url);
                } catch (error) {
                    reject(error);
                }
            }
        );
    });
}

async function uploadFileToActualCloud(file) {
    if (file && typeof window.uploadCommunityMedia === 'function') {
        return window.uploadCommunityMedia(file);
    }
    return uploadFileToFirebaseStorage(file);
}

function getMediaUploadFailureMessage(error) {
    const code = error && error.code ? error.code : '';
    if (code === 'storage/quota-exceeded') {
        return '동영상 저장소가 현재 무료 요금제 제한으로 비활성화되어 업로드할 수 없습니다. Firebase 프로젝트를 Blaze 요금제로 전환한 뒤 다시 시도해 주세요.';
    }
    if (code === 'storage/unauthorized' || code === 'storage/unauthenticated') {
        return '동영상 저장 권한이 없습니다. Firebase Storage 규칙에서 로그인한 사용자의 comments/videos 업로드를 허용해야 합니다.';
    }
    if (code === 'storage/bucket-not-found' || code === 'storage/no-default-bucket') {
        return 'Firebase Storage가 아직 만들어지지 않았거나 저장소 주소가 잘못되었습니다. Firebase 콘솔에서 Storage를 활성화해 주세요.';
    }
    if (code === 'storage/retry-limit-exceeded') {
        return '네트워크 연결이 끊겨 동영상 업로드가 중단되었습니다. Wi-Fi 또는 안정적인 데이터 연결에서 다시 시도해 주세요.';
    }
    if (code === 'cloudinary/upload-failed') {
        return error.message || '무료 동영상 저장소에 업로드하지 못했습니다. 잠시 후 다시 시도해 주세요.';
    }
    return `동영상을 공용 저장소에 업로드하지 못했습니다${code ? ` (${code})` : ''}. 잠시 후 다시 시도해 주세요.`;
}

async function uploadFileToStorage(file, folder = 'comments') {
    return await uploadFileToActualCloud(file);
}

async function uploadFileToStorageWithRollover(file, folder = 'comments') {
    return await uploadFileToStorage(file, folder);
}

function isCrossDeviceVideoFile(file) {
    const extension = (file.name || '').split('.').pop().toLowerCase();
    return file.type === 'video/mp4' || file.type === 'video/webm' || extension === 'mp4' || extension === 'webm';
}

// 2. 동영상 (유튜브 모달 오픈 및 파일 선택창 실행 금지)
if (commentVideoInput) {
    commentVideoInput.disabled = true;
    commentVideoInput.addEventListener('click', (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
        return false;
    }, true);
}

if (commentAttachVideoBtn) {
    const handleVideoBtnClick = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
        if (typeof window.openYoutubeSelectModal === 'function') {
            window.openYoutubeSelectModal();
        } else {
            const modal = document.getElementById('youtubeSelectModal');
            const overlay = document.getElementById('youtubeSelectOverlay');
            if (modal && overlay) {
                modal.classList.add('active');
                overlay.classList.add('active');
            } else {
                window.open('https://www.youtube.com/channel/UCKtLefVrKe2C7BwhbXb2lSA', '_blank', 'noopener,noreferrer');
            }
        }
        if (commentAttachMenu) commentAttachMenu.classList.remove('active');
        if (commentAttachBtn) commentAttachBtn.classList.remove('open');
        return false;
    };

    commentAttachVideoBtn.addEventListener('click', handleVideoBtnClick, true);
    commentAttachVideoBtn.onclick = handleVideoBtnClick;
}

    commentVideoInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        if (commentAttachedVideos.length + files.length > MAX_COMMENT_ATTACHMENTS) {
            showAttachmentCountAlert('동영상');
            commentVideoInput.value = '';
            return;
            if (typeof window.customAlert === 'function') {
                await window.customAlert('동영상은 최대 5개까지만 첨부할 수 있습니다.', '첨부 제한 초과');
            } else {
                alert('동영상은 최대 5개까지만 첨부할 수 있습니다.');
            }
            commentVideoInput.value = '';
            return;
        }

        const maxSizeBytes = typeof window.getCommunityVideoLimit === 'function'
            ? window.getCommunityVideoLimit()
            : 100 * 1024 * 1024;
        const oversizedFiles = files.filter(f => f.size > maxSizeBytes);
        const validFiles = files.filter(f => f.size <= maxSizeBytes);
        const unsupportedFiles = validFiles.filter(f => !isCrossDeviceVideoFile(f));
        const uploadableFiles = validFiles.filter(isCrossDeviceVideoFile);

        if (oversizedFiles.length > 0) {
            let msg = '';
            if (oversizedFiles.length === 1) {
                msg = `"${oversizedFiles[0].name}" 파일 크기가 제한 용량(1GB)을 초과합니다.\n1GB 이하의 동영상만 선택해 주세요.`;
            } else {
                const namesList = oversizedFiles.map(f => `• ${f.name}`).join('\n');
                msg = `아래 ${oversizedFiles.length}개 파일 크기가 제한 용량(1GB)을 초과합니다:\n${namesList}\n\n1GB 이하의 동영상만 선택해 주세요.`;
            }

            if (typeof window.customAlert === 'function') {
                await window.customAlert(msg, '용량 제한 초과');
            } else {
                alert(msg);
            }
        }

        if (unsupportedFiles.length > 0) {
            const names = unsupportedFiles.map(f => `• ${f.name}`).join('\n');
            const message = `아래 파일은 모든 휴대폰과 노트북에서 재생을 보장할 수 없어 첨부하지 않았습니다.\n${names}\n\nMP4(H.264/AAC) 또는 WebM 파일로 변환한 뒤 다시 선택해 주세요.`;
            if (typeof window.customAlert === 'function') {
                await window.customAlert(message, '지원하지 않는 동영상 형식');
            } else {
                alert(message);
            }
        }

        for (const file of uploadableFiles) {
            if (commentAttachedVideos.length >= MAX_COMMENT_ATTACHMENTS) break;
            try {
                commentAttachedVideos.push({
                    file: file,
                    dataUrl: URL.createObjectURL(file),
                    name: file.name
                });
            } catch (err) {
                console.error("동영상 첨부 오류:", err);
            }
        }
        renderCommentAttachmentPreview();
        commentVideoInput.value = '';
    });
}

// 3. 음성 파일 첨부
if (commentAttachAudioBtn && commentAudioInput) {
    commentAttachAudioBtn.addEventListener('click', () => {
        if (commentAttachedAudios.length >= MAX_COMMENT_ATTACHMENTS) {
            showAttachmentCountAlert('음성/오디오 파일');
            return;
            alert('음성 파일은 최대 5개까지만 첨부할 수 있습니다.');
            return;
        }
        commentAudioInput.click();
        if (commentAttachMenu) commentAttachMenu.classList.remove('active');
        if (commentAttachBtn) commentAttachBtn.classList.remove('open');
    });

    commentAudioInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        if (commentAttachedAudios.length + files.length > MAX_COMMENT_ATTACHMENTS) {
            showAttachmentCountAlert('음성/오디오 파일');
            commentAudioInput.value = '';
            return;
        }

        for (const file of files) {
            if (commentAttachedAudios.length >= MAX_COMMENT_ATTACHMENTS) break;
            if (file.size > 100 * 1024 * 1024) {
                showAttachmentSizeAlert(file, '음성/오디오 파일', COMMENT_ATTACHMENT_SIZE_LIMITS.audio);
                continue;
            }
            try {
                const dataUrl = file.size > 15 * 1024 * 1024 ? '' : await readFileAsDataURL(file);
                commentAttachedAudios.push({
                    file: file,
                    dataUrl: dataUrl,
                    name: file.name
                });
            } catch (err) {
                console.error("음성 파일 읽기 오류:", err);
            }
        }
        renderCommentAttachmentPreview();
        commentAudioInput.value = '';
    });
}

// 4. PDF 파일 첨부
if (commentAttachPdfBtn && commentPdfInput) {
    commentAttachPdfBtn.addEventListener('click', () => {
        if (commentAttachedPdfs.length >= MAX_COMMENT_ATTACHMENTS) {
            showAttachmentCountAlert('PDF 파일');
            return;
            alert('PDF 파일은 최대 5개까지만 첨부할 수 있습니다.');
            return;
        }
        commentPdfInput.click();
        if (commentAttachMenu) commentAttachMenu.classList.remove('active');
        if (commentAttachBtn) commentAttachBtn.classList.remove('open');
    });

    commentPdfInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        if (commentAttachedPdfs.length + files.length > MAX_COMMENT_ATTACHMENTS) {
            showAttachmentCountAlert('PDF 파일');
            commentPdfInput.value = '';
            return;
        }

        for (const file of files) {
            if (commentAttachedPdfs.length >= MAX_COMMENT_ATTACHMENTS) break;
            if (file.size > COMMENT_ATTACHMENT_SIZE_LIMITS.pdf) {
                showAttachmentSizeAlert(file, 'PDF 파일', COMMENT_ATTACHMENT_SIZE_LIMITS.pdf);
                continue;
            }
            try {
                const dataUrl = file.size > 15 * 1024 * 1024 ? '' : await readFileAsDataURL(file);
                commentAttachedPdfs.push({
                    file: file,
                    dataUrl: dataUrl,
                    name: file.name
                });
            } catch (err) {
                console.error("PDF 파일 읽기 오류:", err);
            }
        }
        renderCommentAttachmentPreview();
        commentPdfInput.value = '';
    });
}

// 5. HTML 파일 첨부
if (commentAttachHtmlBtn && commentHtmlInput) {
    commentAttachHtmlBtn.addEventListener('click', () => {
        if (commentAttachedHtmls.length >= MAX_COMMENT_ATTACHMENTS) {
            showAttachmentCountAlert('HTML 파일');
            return;
            alert('HTML 파일은 최대 5개까지만 첨부할 수 있습니다.');
            return;
        }
        commentHtmlInput.click();
        if (commentAttachMenu) commentAttachMenu.classList.remove('active');
        if (commentAttachBtn) commentAttachBtn.classList.remove('open');
    });

    commentHtmlInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        if (commentAttachedHtmls.length + files.length > MAX_COMMENT_ATTACHMENTS) {
            showAttachmentCountAlert('HTML 파일');
            commentHtmlInput.value = '';
            return;
        }

        for (const file of files) {
            if (commentAttachedHtmls.length >= MAX_COMMENT_ATTACHMENTS) break;
            if (file.size > COMMENT_ATTACHMENT_SIZE_LIMITS.html) {
                showAttachmentSizeAlert(file, 'HTML 파일', COMMENT_ATTACHMENT_SIZE_LIMITS.html);
                continue;
            }
            try {
                const dataUrl = file.size > 15 * 1024 * 1024 ? '' : await readFileAsDataURL(file);
                commentAttachedHtmls.push({
                    file: file,
                    dataUrl: dataUrl,
                    name: file.name
                });
            } catch (err) {
                console.error("HTML 파일 읽기 오류:", err);
            }
        }
        renderCommentAttachmentPreview();
        commentHtmlInput.value = '';
    });
}

function renderCommentAttachmentPreview() {
    const commentInputContainer = document.getElementById('commentInputContainer');
    const container = document.getElementById('commentImagePreviewContainer');
    if (!container) return;

    const totalCount = commentAttachedImages.length + commentAttachedVideos.length + commentAttachedAudios.length + commentAttachedPdfs.length + commentAttachedHtmls.length;

    if (totalCount > 0) {
        if (commentInputContainer && !commentInputContainer.classList.contains('has-images')) {
            const actualRadius = Math.min(9999, commentInputContainer.offsetHeight / 2) + 'px';
            commentInputContainer.classList.add('has-images');
            commentInputContainer.animate([
                { borderRadius: actualRadius },
                { borderRadius: '22px' }
            ], { duration: 200, easing: 'ease' });
        }

        let html = '';

        // 이미지
        commentAttachedImages.forEach((img, index) => {
            html += `
                <div class="comment-image-preview-item">
                    <img src="${img.dataUrl}" alt="첨부 이미지" style="cursor: pointer;" onclick="openLightbox('${img.dataUrl}', {preUpload:true, imageIndex:${index}})">
                    <button type="button" class="remove-btn" onclick="removeCommentAttachedItem('image', ${index})" title="삭제">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
        });

        // 동영상
        commentAttachedVideos.forEach((vid, index) => {
            html += `
                <div class="attachment-preview-card">
                    <i class="fa-solid fa-video" style="color: #ff6b6b; font-size: 1.1rem;"></i>
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px;">${escapeHtml(vid.name)}</span>
                    <button type="button" class="attachment-preview-remove" onclick="removeCommentAttachedItem('video', ${index})" title="삭제">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
        });

        // 음성
        commentAttachedAudios.forEach((aud, index) => {
            html += `
                <div class="attachment-preview-card">
                    <i class="fa-solid fa-microphone" style="color: #51cf66; font-size: 1.1rem;"></i>
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px;">${escapeHtml(aud.name)}</span>
                    <button type="button" class="attachment-preview-remove" onclick="removeCommentAttachedItem('audio', ${index})" title="삭제">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
        });

        // PDF
        commentAttachedPdfs.forEach((pdf, index) => {
            html += `
                <div class="attachment-preview-card">
                    <i class="fa-solid fa-file-pdf" style="color: #ff922b; font-size: 1.1rem;"></i>
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px;">${escapeHtml(pdf.name)}</span>
                    <button type="button" class="attachment-preview-remove" onclick="removeCommentAttachedItem('pdf', ${index})" title="삭제">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
        });

        // HTML
        commentAttachedHtmls.forEach((h, index) => {
            html += `
                <div class="attachment-preview-card">
                    <i class="fa-solid fa-file-code" style="color: #cc5de8; font-size: 1.1rem;"></i>
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px;">${escapeHtml(h.name)}</span>
                    <button type="button" class="attachment-preview-remove" onclick="removeCommentAttachedItem('html', ${index})" title="삭제">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
        });

        container.innerHTML = html;
    } else {
        if (commentInputContainer) commentInputContainer.classList.remove('has-images');
        container.innerHTML = '';
    }
}

function renderCommentImagePreview() {
    renderCommentAttachmentPreview();
}

window.removeCommentAttachedItem = function (type, index) {
    if (type === 'image') commentAttachedImages.splice(index, 1);
    else if (type === 'video') commentAttachedVideos.splice(index, 1);
    else if (type === 'audio') commentAttachedAudios.splice(index, 1);
    else if (type === 'pdf') commentAttachedPdfs.splice(index, 1);
    else if (type === 'html') commentAttachedHtmls.splice(index, 1);
    renderCommentAttachmentPreview();
};

window.removeCommentAttachedImage = function (index) {
    removeCommentAttachedItem('image', index);
};

const commentSubmitBtn = document.querySelector('.side-detail-container .comment-submit-btn');
const commentInput = document.querySelector('.side-detail-container .comment-input');
if (commentSubmitBtn && commentInput) {
    commentSubmitBtn.addEventListener('click', async () => {
        if (!currentUser) {
            alert('댓글을 작성하시려면 먼저 Google 로그인을 해주세요!');
            openDrawer();
            return;
        }
        if (!currentPostId) return;
        const body = commentInput.value.trim();
        const totalAttachments = commentAttachedImages.length + commentAttachedVideos.length + commentAttachedAudios.length + commentAttachedPdfs.length + commentAttachedHtmls.length;
        if (body === '' && totalAttachments === 0) return;

        console.log(`[댓글 제출 시작] 내용: "${body}", 첨부파일 총 ${totalAttachments}개`);

        commentSubmitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        commentSubmitBtn.disabled = true;

        try {
            console.log(`[댓글 제출] 이미지 첨부 처리 중... (${commentAttachedImages.length}개)`);
            const commentImageUrls = await Promise.all(commentAttachedImages.map(async img => {
                if (img.file) {
                    try {
                        return await uploadFileToActualCloud(img.file);
                    } catch (e) {
                        console.warn("이미지 업로드 예외:", e);
                    }
                }
                return img.dataUrl || '';
            }));

            console.log(`[댓글 제출] 동영상 첨부 처리 중... (${commentAttachedVideos.length}개)`);
            const commentVideoItems = await Promise.all(commentAttachedVideos.map(async v => {
                let url = '';
                let uploadError = null;
                if (v.file) {
                    try {
                        url = await uploadFileToActualCloud(v.file);
                    } catch (e) {
                        uploadError = e;
                        console.warn("비디오 업로드 예외:", e);
                    }
                } else if (v.dataUrl && !v.dataUrl.startsWith('blob:')) {
                    url = v.dataUrl;
                }
                if (!url) {
                    throw new Error(getMediaUploadFailureMessage(uploadError));
                }
                return { url: url || '', name: v.name || '동영상' };
            }));

            console.log(`[댓글 제출] 음성 첨부 처리 중... (${commentAttachedAudios.length}개)`);
            const commentAudioItems = await Promise.all(commentAttachedAudios.map(async a => {
                let url = '';
                if (a.file) {
                    try {
                        url = await uploadFileToActualCloud(a.file);
                    } catch (e) {
                        console.warn("음성 업로드 예외:", e);
                    }
                }
                if (!url) url = a.dataUrl || '';
                return { url: url || '', name: a.name || '음성 파일' };
            }));

            console.log(`[댓글 제출] PDF 첨부 처리 중... (${commentAttachedPdfs.length}개)`);
            const commentPdfItems = await Promise.all(commentAttachedPdfs.map(async p => {
                let url = '';
                if (p.file) {
                    try {
                        url = await uploadFileToActualCloud(p.file);
                    } catch (e) {
                        console.warn("PDF 업로드 예외:", e);
                    }
                }
                if (!url) url = p.dataUrl || '';
                return { url: url || '', name: p.name || 'PDF 문서' };
            }));

            console.log(`[댓글 제출] HTML 첨부 처리 중... (${commentAttachedHtmls.length}개)`);
            const commentHtmlItems = await Promise.all(commentAttachedHtmls.map(async h => {
                let url = '';
                if (h.file) {
                    try {
                        url = await uploadFileToActualCloud(h.file);
                    } catch (e) {
                        console.warn("HTML 업로드 예외:", e);
                    }
                }
                if (!url) url = h.dataUrl || '';
                return { url: url || '', name: h.name || 'HTML 문서' };
            }));

            function sanitizeForFirestore(items) {
                if (!items) return [];
                const flatItems = Array.isArray(items) ? items.flat(Infinity) : [items];
                return flatItems.map(item => {
                    if (item === undefined || item === null) return '';
                    if (typeof item === 'string') return item;
                    if (typeof item === 'number' || typeof item === 'boolean') return String(item);
                    if (typeof item === 'object') {
                        try {
                            return JSON.stringify({
                                url: item.url || item.dataUrl || '',
                                name: item.name || ''
                            });
                        } catch (e) {
                            return String(item.url || item.name || '');
                        }
                    }
                    return String(item || '');
                }).filter(s => s !== '');
            }

            const cleanImages = sanitizeForFirestore(commentImageUrls);
            const cleanVideos = sanitizeForFirestore(commentVideoItems);
            const cleanAudios = sanitizeForFirestore(commentAudioItems);
            const cleanPdfs = sanitizeForFirestore(commentPdfItems);
            const cleanHtmls = sanitizeForFirestore(commentHtmlItems);

            console.log(`[댓글 DB 전송 준비 완료] DB 저장 진행 중...`);

            if (window.editTarget) {
                await db.collection('posts').doc(currentPostId)
                    .collection('comments').doc(window.editTarget.id).update({
                        body: body,
                        images: cleanImages,
                        videos: cleanVideos,
                        audios: cleanAudios,
                        pdfs: cleanPdfs,
                        htmls: cleanHtmls,
                        edited: true,
                        editedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                window.editTarget = null;
                console.log(`[댓글 수정 성공] DB 업데이트 완료`);
            } else {
                const parentId = (window.replyTarget && window.replyTarget.postId === currentPostId) ? window.replyTarget.id : null;

                const imgDescs = {};
                commentAttachedImages.forEach((img, idx) => {
                    if (img.description) imgDescs[String(idx)] = img.description;
                });

                await db.collection('posts').doc(currentPostId).collection('comments').add({
                    author: isAdmin(currentUser.email) ? getAdminName(currentUser.email) : currentUser.displayName,
                    uid: currentUser.uid,
                    userPhoto: currentUser.photoURL || '',
                    email: currentUser.email,
                    body: body,
                    images: cleanImages,
                    videos: cleanVideos,
                    audios: cleanAudios,
                    pdfs: cleanPdfs,
                    htmls: cleanHtmls,
                    imageDescriptions: imgDescs,
                    parentId: parentId,
                    replyToAuthor: parentId && window.replyTarget ? window.replyTarget.author : '',
                    pinned: false,
                    likes: 0,
                    likedUsers: [],
                    deleted: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                if (parentId) {
                    window.expandCommentLineage(parentId);
                }
                console.log(`[댓글 작성 성공] DB 등록 완료`);
            }

            commentInput.value = '';
            commentAttachedImages = [];
            commentAttachedVideos = [];
            commentAttachedAudios = [];
            commentAttachedPdfs = [];
            commentAttachedHtmls = [];
            renderCommentAttachmentPreview();
            window.replyTarget = null;
            updateReplyTargetUI('');
        } catch (e) {
            console.error("댓글 작성/수정 실패 예외 처리:", e);
            alert(e.message || '댓글 작성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
            updateReplyTargetUI('');
        } finally {
            commentSubmitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
            commentSubmitBtn.disabled = false;
            commentSubmitBtn.removeAttribute('title');
            console.log(`[댓글 제출 완료] 파란색 스피너 해제 및 버튼 상태 복구 완료`);
        }
    });

    // 엔터키 지원 추가
    commentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            commentSubmitBtn.click();
        }
    });
}

