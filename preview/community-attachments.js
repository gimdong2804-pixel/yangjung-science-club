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

// 댓글/답글 첨부파일 데이터 상태 (전역 공유 지원)
window.commentAttachedImages = window.commentAttachedImages || [];
window.commentAttachedVideos = window.commentAttachedVideos || [];
window.commentAttachedAudios = window.commentAttachedAudios || [];
window.commentAttachedPdfs = window.commentAttachedPdfs || [];
window.commentAttachedHtmls = window.commentAttachedHtmls || [];

var commentAttachedImages = window.commentAttachedImages;
var commentAttachedVideos = window.commentAttachedVideos;
var commentAttachedAudios = window.commentAttachedAudios;
var commentAttachedPdfs = window.commentAttachedPdfs;
var commentAttachedHtmls = window.commentAttachedHtmls;

// 외부 파일에서 첨부파일 상태를 안전하게 설정하는 헬퍼
window.setCommentAttachments = function (attachments = {}) {
    window.commentAttachedImages = (attachments.images || []).map(img => typeof img === 'string' ? { file: null, dataUrl: img } : img);
    window.commentAttachedVideos = (attachments.videos || []).map(v => typeof v === 'string' ? { file: null, dataUrl: v, name: '동영상' } : (v.dataUrl ? v : { file: null, dataUrl: v.url, name: v.name || '동영상' }));
    window.commentAttachedAudios = (attachments.audios || []).map(a => typeof a === 'string' ? { file: null, dataUrl: a, name: '음성 파일' } : (a.dataUrl ? a : { file: null, dataUrl: a.url, name: a.name || '음성 파일' }));
    window.commentAttachedPdfs = (attachments.pdfs || []).map(p => typeof p === 'string' ? { file: null, dataUrl: p, name: 'PDF 문서' } : (p.dataUrl ? p : { file: null, dataUrl: p.url, name: p.name || 'PDF 문서' }));
    window.commentAttachedHtmls = (attachments.htmls || []).map(h => typeof h === 'string' ? { file: null, dataUrl: h, name: 'HTML 문서' } : (h.dataUrl ? h : { file: null, dataUrl: h.url, name: h.name || 'HTML 문서' }));

    commentAttachedImages = window.commentAttachedImages;
    commentAttachedVideos = window.commentAttachedVideos;
    commentAttachedAudios = window.commentAttachedAudios;
    commentAttachedPdfs = window.commentAttachedPdfs;
    commentAttachedHtmls = window.commentAttachedHtmls;

    if (typeof renderCommentAttachmentPreview === 'function') {
        renderCommentAttachmentPreview();
    }
};

function revokeAttachmentPreview(item) {
    const previewUrl = item && (item.dataUrl || item.url);
    if (typeof previewUrl === 'string' && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
    }
}

window.clearCommentAttachments = function () {
    [
        ...window.commentAttachedImages,
        ...window.commentAttachedVideos,
        ...window.commentAttachedAudios,
        ...window.commentAttachedPdfs,
        ...window.commentAttachedHtmls
    ].forEach(revokeAttachmentPreview);

    window.commentAttachedImages = [];
    window.commentAttachedVideos = [];
    window.commentAttachedAudios = [];
    window.commentAttachedPdfs = [];
    window.commentAttachedHtmls = [];

    commentAttachedImages = window.commentAttachedImages;
    commentAttachedVideos = window.commentAttachedVideos;
    commentAttachedAudios = window.commentAttachedAudios;
    commentAttachedPdfs = window.commentAttachedPdfs;
    commentAttachedHtmls = window.commentAttachedHtmls;

    if (typeof renderCommentAttachmentPreview === 'function') {
        renderCommentAttachmentPreview();
    }
};

const commentAttachBtn = document.getElementById('commentAttachBtn');
const commentAttachMenu = document.getElementById('commentAttachMenu');
const commentAttachImageBtn = document.getElementById('commentAttachImageBtn');
const commentAttachVideoBtn = document.getElementById('commentAttachVideoBtn');
const commentAttachAudioBtn = document.getElementById('commentAttachAudioBtn');
const commentAttachPdfBtn = document.getElementById('commentAttachPdfBtn');
const commentAttachHtmlBtn = document.getElementById('commentAttachHtmlBtn');
const commentImageInput = document.getElementById('commentImageInput');
const commentAudioInput = document.getElementById('commentAudioInput');
const commentPdfInput = document.getElementById('commentPdfInput');
const commentHtmlInput = document.getElementById('commentHtmlInput');

const commentImagePreviewContainer = document.getElementById('commentImagePreviewContainer');

window.closeCommentAttachMenu = function () {
    if (commentAttachBtn) commentAttachBtn.classList.remove('open');
    if (commentAttachMenu) commentAttachMenu.classList.remove('active');
};

function updateCommentAttachMenuPosition() {
    if (!commentAttachBtn || !commentAttachMenu) return;
    if (commentAttachMenu.parentElement !== document.body) {
        document.body.appendChild(commentAttachMenu);
    }
    const rect = commentAttachBtn.getBoundingClientRect();
    const menuHeight = commentAttachMenu.offsetHeight || 220;
    const menuWidth = commentAttachMenu.offsetWidth || 280;

    let top = rect.top - menuHeight - 16;
    let left = rect.left;

    if (top < 10) top = rect.bottom + 16;
    const viewportPadding = 8;
    const maxLeft = Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding);
    left = Math.max(viewportPadding, Math.min(left, maxLeft));

    commentAttachMenu.style.position = 'fixed';
    commentAttachMenu.style.top = `${top}px`;
    commentAttachMenu.style.left = `${left}px`;
    commentAttachMenu.style.bottom = 'auto';
    commentAttachMenu.style.right = 'auto';
    commentAttachMenu.style.zIndex = '99999';
}

if (commentAttachBtn) {
    commentAttachBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCurrentlyActive = commentAttachMenu && commentAttachMenu.classList.contains('active');

        if (isCurrentlyActive) {
            commentAttachBtn.classList.remove('open');
            if (commentAttachMenu) commentAttachMenu.classList.remove('active');
        } else {
            commentAttachBtn.classList.add('open');
            if (commentAttachMenu) {
                updateCommentAttachMenuPosition();
                requestAnimationFrame(() => {
                    commentAttachMenu.classList.add('active');
                });
            }
        }
    });

    document.addEventListener('click', (e) => {
        if (commentAttachBtn && commentAttachMenu && !commentAttachBtn.contains(e.target) && !commentAttachMenu.contains(e.target)) {
            commentAttachBtn.classList.remove('open');
            commentAttachMenu.classList.remove('active');
        }
    });

    window.addEventListener('scroll', () => {
        if (commentAttachMenu && commentAttachMenu.classList.contains('active')) {
            updateCommentAttachMenuPosition();
        }
    }, true);

    window.addEventListener('resize', () => {
        if (commentAttachMenu && commentAttachMenu.classList.contains('active')) {
            updateCommentAttachMenuPosition();
        }
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
        commentImageInput.value = '';
        await window.addCommentFiles(files, 'image');
    });
}

// --- 100% 무료 내장 대용량 미디어 엔지니어링 (신용카드/결제 0원) ---
const MAX_COMMENT_ATTACHMENTS = 10;
const COMMENT_ATTACHMENT_SIZE_LIMITS = {
    image: 100 * 1024 * 1024,
    audio: 100 * 1024 * 1024,
    pdf: 100 * 1024 * 1024,
    html: 100 * 1024 * 1024
};

const COMMENT_FILE_ARRAYS = {
    image: () => commentAttachedImages,
    audio: () => commentAttachedAudios,
    pdf: () => commentAttachedPdfs,
    html: () => commentAttachedHtmls
};
let commentFileQueue = Promise.resolve();

// 선택창과 드롭은 이 함수에서 동일하게 종류·개수·크기를 검사합니다.
window.addCommentFiles = function (fileList, expectedKind = null) {
    const files = Array.from(fileList || []);
    const operation = commentFileQueue.then(async () => {
        const accepted = [];
        const rejected = [];
        const newItems = [];
        for (const file of files) {
            const kind = window.getCommunityAttachmentKind(file);
            let reason = '';
            if (kind === 'video') reason = '댓글 동영상은 유튜브 링크로 첨부해 주세요.';
            else if (!kind || !COMMENT_FILE_ARRAYS[kind]) reason = '지원하지 않는 파일 종류예요.';
            else if (expectedKind && kind !== expectedKind) reason = '선택한 첨부 종류와 파일 종류가 달라요.';
            else if (file.size > COMMENT_ATTACHMENT_SIZE_LIMITS[kind]) reason = '파일당 100MB를 넘었어요.';
            else if (COMMENT_FILE_ARRAYS[kind]().length >= MAX_COMMENT_ATTACHMENTS) reason = '이 종류는 최대 10개까지 첨부할 수 있어요.';
            if (reason) {
                rejected.push({ file, reason });
                continue;
            }

            try {
                const item = kind === 'image'
                    ? { file, dataUrl: await compressImage(file, 1600, 1600, 0.85) }
                    : { file, dataUrl: URL.createObjectURL(file), name: file.name };
                COMMENT_FILE_ARRAYS[kind]().push(item);
                newItems.push(item);
                accepted.push(file);
            } catch (error) {
                console.error('첨부파일 미리보기 준비 실패:', error);
                rejected.push({ file, reason: '미리보기를 준비하지 못했어요.' });
            }
        }
        if (newItems.length) renderCommentAttachmentPreview(newItems);
        window.reportCommunityAttachmentErrors(rejected);
        return { accepted, rejected };
    });
    commentFileQueue = operation.catch(() => {});
    return operation;
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

// Files recorded in Firestore must always point to shared storage.  The former
// device-local fallback (localmedia://) can only be opened on the uploader's
// browser, which is why videos were unavailable on other phones and laptops.
function getUploadContentType(file) {
    const extension = (file.name || '').split('.').pop().toLowerCase();
    const types = {
        mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
        m4v: 'video/x-m4v', ogv: 'video/ogg', mp3: 'audio/mpeg',
        m4a: 'audio/mp4', wav: 'audio/wav', pdf: 'application/pdf'
    };
    if (types[extension]) return types[extension];
    if (file.type) return file.type;
    return 'application/octet-stream';
}

function getMediaFolder(file) {
    const type = file?.type || '';
    const extension = (file?.name || '').split('.').pop().toLowerCase();
    if (extension === 'pdf' || type === 'application/pdf') return 'comments/pdfs';
    if (type.startsWith('video/')) return 'comments/videos';
    if (type.startsWith('audio/')) return 'comments/audios';
    if (type.startsWith('image/')) return 'comments/images';
    return 'comments/files';
}

function isPdfAttachmentFile(file) {
    return Boolean(file && (
        file.type === 'application/pdf'
        || /\.pdf$/i.test(file.name || '')
    ));
}

function updateCommentUploadProgress(file, transferred, total) {
    if (!commentSubmitBtn) return;
    commentSubmitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
    if (total) {
        const progress = Math.min(100, Math.round((transferred / total) * 100));
        commentSubmitBtn.title = `${file.name || '파일'} 업로드 중... (${progress}%)`;
    }
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
        try {
            return await window.uploadCommunityMedia(file);
        } catch (mediaError) {
            console.warn('uploadCommunityMedia 업로드 실패, 보조 저장소 시도:', mediaError);
        }
    }
    if (isPdfAttachmentFile(file)) {
        return uploadFileToFirebaseStorage(file, 'comments/pdfs');
    }
    return uploadFileToFirebaseStorage(file);
}

// 동영상 버튼은 파일 선택창 대신 기존 유튜브 화면만 엽니다.
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

// 3. 음성 파일 첨부
if (commentAttachAudioBtn && commentAudioInput) {
    commentAttachAudioBtn.addEventListener('click', () => {
        if (commentAttachedAudios.length >= MAX_COMMENT_ATTACHMENTS) {
            showAttachmentCountAlert('음성/오디오 파일');
            return;
        }
        commentAudioInput.click();
        if (commentAttachMenu) commentAttachMenu.classList.remove('active');
        if (commentAttachBtn) commentAttachBtn.classList.remove('open');
    });

    commentAudioInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        commentAudioInput.value = '';
        await window.addCommentFiles(files, 'audio');
    });
}

// 4. PDF 파일 첨부
if (commentAttachPdfBtn && commentPdfInput) {
    commentAttachPdfBtn.addEventListener('click', () => {
        if (commentAttachedPdfs.length >= MAX_COMMENT_ATTACHMENTS) {
            showAttachmentCountAlert('PDF 파일');
            return;
        }
        commentPdfInput.click();
        if (commentAttachMenu) commentAttachMenu.classList.remove('active');
        if (commentAttachBtn) commentAttachBtn.classList.remove('open');
    });

    commentPdfInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        commentPdfInput.value = '';
        await window.addCommentFiles(files, 'pdf');
    });
}

// 5. HTML 파일 첨부
if (commentAttachHtmlBtn && commentHtmlInput) {
    commentAttachHtmlBtn.addEventListener('click', () => {
        if (commentAttachedHtmls.length >= MAX_COMMENT_ATTACHMENTS) {
            showAttachmentCountAlert('HTML 파일');
            return;
        }
        commentHtmlInput.click();
        if (commentAttachMenu) commentAttachMenu.classList.remove('active');
        if (commentAttachBtn) commentAttachBtn.classList.remove('open');
    });

    commentHtmlInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        commentHtmlInput.value = '';
        await window.addCommentFiles(files, 'html');
    });
}

function renderCommentAttachmentPreview(newItems = []) {
    const commentInputContainer = document.getElementById('commentInputContainer');
    const container = document.getElementById('commentImagePreviewContainer');
    if (!container) return;

    const totalCount = commentAttachedImages.length + commentAttachedVideos.length + commentAttachedAudios.length + commentAttachedPdfs.length + commentAttachedHtmls.length;
    const newlyAdded = new Set(newItems);

    if (totalCount > 0) {
        if (commentInputContainer && !commentInputContainer.classList.contains('has-images')) {
            const actualRadius = Math.min(9999, commentInputContainer.offsetHeight / 2) + 'px';
            commentInputContainer.classList.add('has-images');
            if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                commentInputContainer.animate([
                    { borderRadius: actualRadius },
                    { borderRadius: '22px' }
                ], { duration: 200, easing: 'ease' });
            }
        }

        let html = '';

        // 이미지
        commentAttachedImages.forEach((img, index) => {
            html += `
                <div class="comment-image-preview-item${newlyAdded.has(img) ? ' just-added' : ''}">
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
                <div class="attachment-preview-card${newlyAdded.has(vid) ? ' just-added' : ''}">
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
                <div class="attachment-preview-card${newlyAdded.has(aud) ? ' just-added' : ''}">
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
                <div class="attachment-preview-card${newlyAdded.has(pdf) ? ' just-added' : ''}">
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
                <div class="attachment-preview-card${newlyAdded.has(h) ? ' just-added' : ''}">
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
    let removed = [];
    if (type === 'image') removed = commentAttachedImages.splice(index, 1);
    else if (type === 'video') removed = commentAttachedVideos.splice(index, 1);
    else if (type === 'audio') removed = commentAttachedAudios.splice(index, 1);
    else if (type === 'pdf') removed = commentAttachedPdfs.splice(index, 1);
    else if (type === 'html') removed = commentAttachedHtmls.splice(index, 1);
    removed.forEach(revokeAttachmentPreview);
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
        if (commentSubmitBtn.disabled) return;
        const submittingPostId = currentPostId;
        commentSubmitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        commentSubmitBtn.disabled = true;
        await commentFileQueue;
        if (currentPostId !== submittingPostId) {
            commentSubmitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
            commentSubmitBtn.disabled = false;
            return;
        }
        const body = commentInput.value.trim();
        let poll = window.communityPolls?.getDraft('comment');
        const submittingUid = currentUser.uid;
        const submittingReplyId = window.replyTarget?.id || null;
        const submittingEditId = window.editTarget?.id || null;
        const totalAttachments = commentAttachedImages.length + commentAttachedVideos.length + commentAttachedAudios.length + commentAttachedPdfs.length + commentAttachedHtmls.length;
        if (body === '' && totalAttachments === 0 && !poll) {
            commentSubmitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
            commentSubmitBtn.disabled = false;
            return;
        }

        console.log(`[댓글 제출 시작] 내용: "${body}", 첨부파일 총 ${totalAttachments}개`);

        commentSubmitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        commentSubmitBtn.disabled = true;

        try {
            poll = await window.communityPolls?.prepareForSubmit('comment') || poll;
            const assertSubmission = () => {
                if (currentUser?.uid !== submittingUid || currentPostId !== submittingPostId
                    || (window.replyTarget?.id || null) !== submittingReplyId || (window.editTarget?.id || null) !== submittingEditId) {
                    throw new Error('작성 대상이 바뀌었어요. 다시 등록해주세요.');
                }
            };
            assertSubmission();
            console.log(`[댓글 제출] 이미지 첨부 처리 중... (${commentAttachedImages.length}개)`);
            const commentImageUrls = await Promise.all(commentAttachedImages.map(async img => {
                if (img.file) {
                    const url = await uploadFileToActualCloud(img.file);
                    if (!url || !/^https:\/\//i.test(url)) throw new Error(`'${img.file.name}' 이미지를 공용 저장소에 올리지 못했습니다.`);
                    return url;
                }
                return img.dataUrl || '';
            }));

            console.log(`[댓글 제출] 동영상 첨부 처리 중... (${commentAttachedVideos.length}개)`);
            const commentVideoItems = await Promise.all(commentAttachedVideos.map(async v => {
                if (v.file) {
                    throw new Error('동영상 파일은 댓글에 첨부할 수 없습니다. 유튜브 링크를 이용해 주세요.');
                }
                const url = v.dataUrl && !v.dataUrl.startsWith('blob:') ? v.dataUrl : '';
                if (!url) throw new Error(`'${v.name || '동영상'}' 파일 주소를 찾지 못했습니다.`);
                return { url, name: v.name || '동영상' };
            }));

            console.log(`[댓글 제출] 음성 첨부 처리 중... (${commentAttachedAudios.length}개)`);
            const commentAudioItems = await Promise.all(commentAttachedAudios.map(async a => {
                let url = '';
                if (a.file) {
                    url = await uploadFileToActualCloud(a.file);
                }
                if (!a.file) url = a.dataUrl || '';
                if (!url || (a.file && !/^https:\/\//i.test(url))) throw new Error(`'${a.name || '음성 파일'}' 파일을 공용 저장소에 올리지 못했습니다.`);
                return { url: url || '', name: a.name || '음성 파일' };
            }));

            console.log(`[댓글 제출] PDF 첨부 처리 중... (${commentAttachedPdfs.length}개)`);
            const commentPdfItems = await Promise.all(commentAttachedPdfs.map(async p => {
                let url = '';
                if (p.file) {
                    url = await uploadFileToActualCloud(p.file);
                }
                if (!p.file) url = p.dataUrl || '';
                if (!url || (p.file && !/^https:\/\//i.test(url))) throw new Error(`'${p.name || 'PDF 문서'}' 파일을 공용 저장소에 올리지 못했습니다.`);
                return { url: url || '', name: p.name || 'PDF 문서' };
            }));

            console.log(`[댓글 제출] HTML 첨부 처리 중... (${commentAttachedHtmls.length}개)`);
            const commentHtmlItems = await Promise.all(commentAttachedHtmls.map(async h => {
                let url = '';
                if (h.file) {
                    url = await uploadFileToActualCloud(h.file);
                }
                if (!h.file) url = h.dataUrl || '';
                if (!url || (h.file && !/^https:\/\//i.test(url))) throw new Error(`'${h.name || 'HTML 문서'}' 파일을 공용 저장소에 올리지 못했습니다.`);
                return { url: url || '', name: h.name || 'HTML 문서' };
            }));

            assertSubmission();
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

                const commentData = {
                    author: isAdmin(currentUser.email) ? getAdminName(currentUser.email) : (currentUser.displayName || '회원'),
                    uid: currentUser.uid,
                    userPhoto: currentUser.photoURL || '',
                    official: isAdmin(currentUser.email),
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
                };
                let createdCommentRef;
                if (poll) commentData.poll = poll;
                try {
                    createdCommentRef = window.communityPolls?.createWithFiles
                        ? await window.communityPolls.createWithFiles(db.collection('posts').doc(currentPostId).collection('comments'), commentData, assertSubmission)
                        : await db.collection('posts').doc(currentPostId).collection('comments').add(commentData);
                } catch (createError) {
                    // 이전 Firestore 규칙과 새 사이트가 잠시 함께 동작하는 배포 구간을 지원합니다.
                    if (createError?.code !== 'permission-denied') throw createError;
                    if (poll?.optionAttachments || poll?.questionAttachments || poll?.optionAttachmentCounts || poll?.questionAttachmentCount) throw createError;
                    assertSubmission();
                    createdCommentRef = await db.collection('posts').doc(currentPostId).collection('comments').add({
                        ...commentData,
                        email: currentUser.email
                    });
                }
                if (parentId) {
                    window.expandCommentLineage(parentId);
                }
                if (window.clubNotifications?.isConfigured()) {
                    window.clubNotifications.notifyCommentCreated(currentPostId, createdCommentRef.id)
                        .then((result) => console.log('댓글 알림 발송 결과:', result))
                        .catch((error) => console.error('댓글 알림 전송 오류:', error));
                }
                console.log(`[댓글 작성 성공] DB 등록 완료`);
            }

            commentInput.value = '';
            window.communityPolls?.resetComment();
            if (typeof window.clearCommentAttachments === 'function') {
                window.clearCommentAttachments();
            } else {
                commentAttachedImages = [];
                commentAttachedVideos = [];
                commentAttachedAudios = [];
                commentAttachedPdfs = [];
                commentAttachedHtmls = [];
                renderCommentAttachmentPreview();
            }
            window.replyTarget = null;
            updateReplyTargetUI('');
        } catch (e) {
            console.error("댓글 작성/수정 실패 예외 처리:", e);
            alert(window.communityPolls?.submissionErrorMessage(e, 'comment')
                || '댓글 저장 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
            updateReplyTargetUI('');
        } finally {
            commentSubmitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
            commentSubmitBtn.disabled = false;
            commentSubmitBtn.title = window.communityPolls?.getDraft('comment') ? '댓글과 투표 게시하기' : '댓글 전송';
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

