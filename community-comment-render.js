// 댓글·답글 목록을 만들고 화면에 표시하는 기능
let commentUnsubscribe = null;
let currentDetailMode = 'side';
const PRESIDENT_EMAIL = 'gimdong2804@gmail.com';
window.expandedCommentIds = new Set();
window.currentCommentDocs = [];
window.replyTarget = null;

function isPresidentUser(user = currentUser) {
    return !!(user && isAdmin(user.email));
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function toJsString(value) {
    return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function commentTimeValue(comment) {
    const createdAt = comment.createdAt;
    if (createdAt && typeof createdAt.toMillis === 'function') return createdAt.toMillis();
    if (createdAt && typeof createdAt.toDate === 'function') return createdAt.toDate().getTime();
    if (createdAt instanceof Date) return createdAt.getTime();
    return Date.now();
}

function normalizeCommentDoc(doc) {
    const data = doc.data();
    return Object.assign({}, data, {
        id: doc.id,
        parentId: data.parentId || null
    });
}

function buildCommentTree(comments) {
    const byId = new Map(comments.map(comment => [comment.id, comment]));
    const childrenMap = new Map();

    comments.forEach(comment => {
        const parentId = comment.parentId && byId.has(comment.parentId) ? comment.parentId : null;
        if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
        childrenMap.get(parentId).push(comment);
    });

    childrenMap.forEach(children => {
        children.sort((a, b) => {
            const pinA = a.pinned ? 1 : 0;
            const pinB = b.pinned ? 1 : 0;
            if (pinB !== pinA) return pinB - pinA;
            if (window.currentCommentSort === 'popular') {
                const likesA = a.likes || 0;
                const likesB = b.likes || 0;
                if (likesA !== likesB) return likesB - likesA;
            }
            return commentTimeValue(b) - commentTimeValue(a);
        });
    });

    const countCache = new Map();
    const countDescendants = (commentId) => {
        if (countCache.has(commentId)) return countCache.get(commentId);
        const children = childrenMap.get(commentId) || [];
        const count = children.reduce((sum, child) => {
            const selfCount = child.deleted ? 0 : 1;
            return sum + selfCount + countDescendants(child.id);
        }, 0);
        countCache.set(commentId, count);
        return count;
    };

    const flatDescendants = (commentId) => {
        const result = [];
        const collect = (id) => {
            const kids = childrenMap.get(id) || [];
            kids.forEach(child => {
                result.push(child);
                collect(child.id);
            });
        };
        collect(commentId);
        result.sort((a, b) => {
            const pinA = a.pinned && !a.deleted ? 1 : 0;
            const pinB = b.pinned && !b.deleted ? 1 : 0;
            if (pinB !== pinA) return pinB - pinA;
            if (window.currentCommentSort === 'popular') {
                const likesA = a.likes || 0;
                const likesB = b.likes || 0;
                if (likesA !== likesB) return likesB - likesA;
            }
            return commentTimeValue(b) - commentTimeValue(a);
        });
        return result;
    };

    return { byId, childrenMap, countDescendants, flatDescendants };
}

function getCommentAvatar(comment, isPresidentComment, isDeleted) {
    if (isDeleted) {
        return `<div class="board-author-avatar" style="background: #64748b; width: 32px; height: 32px; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #fff;"><i class="fa-solid fa-minus"></i></div>`;
    }
    if (comment.userPhoto) {
        return `<img class="board-author-avatar" src="${escapeHtml(comment.userPhoto)}" alt="${escapeHtml(comment.author || '사용자')}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 50%; border: 1px solid var(--glass-border);" decoding="sync">`;
    }
    const initial = (comment.author || '?').substring(0, 1);
    return `<div class="board-author-avatar" style="background: ${isPresidentComment ? 'var(--accent-color)' : '#9ca3af'}; width: 32px; height: 32px; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #fff;">${isPresidentComment ? '<i class="fa-solid fa-crown" style="font-size: 0.6rem;"></i>' : escapeHtml(initial)}</div>`;
}

function parseAttachmentItem(item, defaultName = '파일') {
    if (!item) return { url: '', name: defaultName };
    if (typeof item === 'object' && item !== null) {
        return { url: item.url || item.dataUrl || '', name: item.name || defaultName };
    }
    if (typeof item === 'string') {
        const trimmed = item.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                const parsed = JSON.parse(trimmed);
                return { url: parsed.url || parsed.dataUrl || '', name: parsed.name || defaultName };
            } catch (e) { }
        }
        return { url: trimmed, name: defaultName };
    }
    return { url: String(item), name: defaultName };
}

function renderCommentAttachmentsHtml(comment, safePostId, safeCommentId, isDeleted) {
    if (isDeleted) return '';
    let html = '';

    if (comment.images && Array.isArray(comment.images) && comment.images.length > 0) {
        html += `<div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap;">`;
        comment.images.forEach((imgUrl, imgIdx) => {
            html += `<img src="${escapeHtml(imgUrl)}" alt="첨부 이미지" style="max-width: 150px; max-height: 150px; border-radius: 8px; object-fit: cover; border: 1px solid var(--glass-border); cursor: pointer;" onclick="event.stopPropagation(); openLightbox('${escapeHtml(imgUrl)}', {postId:'${safePostId}', commentId:'${safeCommentId}', authorUid:'${escapeHtml(comment.uid || '')}', imageIndex:${imgIdx}})">`;
        });
        html += `</div>`;
    }

    if (comment.videos && Array.isArray(comment.videos) && comment.videos.length > 0) {
        html += `<div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">`;
        comment.videos.forEach((v, vIdx) => {
            const parsed = parseAttachmentItem(v, '동영상');
            const rawUrl = parsed.url;
            const vidId = `c-vid-${safeCommentId}-${vIdx}`;
            if (rawUrl) {
                let mimeType = 'video/mp4';
                const lower = rawUrl.toLowerCase();
                if (lower.includes('.webm')) mimeType = 'video/webm';
                else if (lower.includes('.mov')) mimeType = 'video/quicktime';
                else if (lower.includes('.ogg')) mimeType = 'video/ogg';

                html += `
                    <div class="comment-video-wrapper" style="width: 100%;">
                        <video id="${vidId}" controls playsinline preload="metadata" style="max-width: 100%; max-height: 320px; border-radius: 8px; border: 1px solid var(--glass-border); background: #000;">
                            <source id="${vidId}-src" src="">
                            <p style="color: var(--text-secondary); font-size: 0.85rem; padding: 0.5rem;">웹 브라우저가 이 동영상을 재생할 수 없습니다.</p>
                        </video>
                    </div>
                `;

                const tryLoadMedia = async (attempts = 0) => {
                    const el = document.getElementById(vidId);
                    const srcEl = document.getElementById(`${vidId}-src`);
                    if (el) {
                        const finalUrl = await window.resolveMediaUrl(rawUrl);
                        if (finalUrl) {
                            // Firebase serves the original Content-Type. Leaving the
                            // source type unset lets each browser choose its native
                            // decoder instead of incorrectly forcing every upload to MP4.
                            if (srcEl) {
                                srcEl.src = finalUrl;
                            } else {
                                el.src = finalUrl;
                            }
                            el.load();
                        } else if (rawUrl.startsWith('localmedia://')) {
                            const wrapper = el.closest('.comment-video-wrapper');
                            if (wrapper) {
                                wrapper.innerHTML = `<div style="padding: 0.75rem; background: rgba(255, 107, 107, 0.1); border: 1px solid rgba(255, 107, 107, 0.3); border-radius: 8px; color: #ff6b6b; font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem;"><i class="fa-solid fa-triangle-exclamation"></i> <span>작성자 스마트폰의 로컬 저장소에만 저장된 동영상입니다. (클라우드 전송 실패)</span></div>`;
                            }
                        }
                    } else if (attempts < 15) {
                        setTimeout(() => tryLoadMedia(attempts + 1), 30);
                    }
                };
                setTimeout(() => tryLoadMedia(0), 10);
            }
        });
        html += `</div>`;
    }

    if (comment.audios && Array.isArray(comment.audios) && comment.audios.length > 0) {
        html += `<div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">`;
        comment.audios.forEach(a => {
            const parsed = parseAttachmentItem(a, '음성 파일');
            const url = parsed.url;
            const name = parsed.name;
            if (url) {
                html += `
                    <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; padding: 0.4rem 0.6rem; background: var(--card-bg, rgba(255,255,255,0.05)); border: 1px solid var(--glass-border); border-radius: 8px;">
                        <i class="fa-solid fa-microphone" style="color:#51cf66;"></i>
                        <span style="font-size:0.85rem; font-weight: 500; color: var(--text-primary); flex: 1; min-width: 100px;">${escapeHtml(name)}</span>
                        <audio src="${escapeHtml(url)}" controls style="height:32px; max-width:220px;"></audio>
                        <button type="button" onclick="event.stopPropagation(); downloadFileAttachment('${toJsString(url)}', '${toJsString(name)}')" style="padding: 0.25rem 0.5rem; border: none; border-radius: 6px; background: rgba(59,130,246,0.2); color: var(--accent-color); font-size: 0.75rem; font-weight: bold; cursor: pointer;" title="다운로드"><i class="fa-solid fa-download"></i></button>
                    </div>
                `;
            }
        });
        html += `</div>`;
    }

    if (comment.pdfs && Array.isArray(comment.pdfs) && comment.pdfs.length > 0) {
        html += `<div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">`;
        comment.pdfs.forEach(p => {
            const parsed = parseAttachmentItem(p, 'PDF 문서');
            const url = parsed.url;
            const name = parsed.name;
            if (url) {
                html += `
                    <div style="display:inline-flex; align-items:center; gap:0.6rem; padding:0.55rem 0.9rem; background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; color:#0f172a; font-size:0.88rem; box-shadow:0 2px 6px rgba(0,0,0,0.04);">
                        <i class="fa-solid fa-file-pdf" style="color:#ea580c; font-size: 1.1rem;"></i>
                        <span style="font-weight: 600; color: #0f172a;">${escapeHtml(name)}</span>
                        <button type="button" onclick="event.stopPropagation(); openPdfPreviewModal('${toJsString(url)}', '${toJsString(name)}')" style="padding: 0.3rem 0.65rem; border: none; border-radius: 6px; background: #ea580c; color: #ffffff; font-size: 0.78rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 0.25rem;"><i class="fa-solid fa-eye"></i> 미리보기</button>
                        <button type="button" onclick="event.stopPropagation(); downloadFileAttachment('${toJsString(url)}', '${toJsString(name)}')" style="padding: 0.3rem 0.65rem; border: none; border-radius: 6px; background: #2563eb; color: #ffffff; font-size: 0.78rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 0.25rem;"><i class="fa-solid fa-download"></i> 다운로드</button>
                    </div>
                `;
            }
        });
        html += `</div>`;
    }

    if (comment.htmls && Array.isArray(comment.htmls) && comment.htmls.length > 0) {
        html += `<div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">`;
        comment.htmls.forEach(h => {
            const parsed = parseAttachmentItem(h, 'HTML 문서');
            const url = parsed.url;
            const name = parsed.name;
            if (url) {
                html += `
                    <div style="display:inline-flex; align-items:center; gap:0.6rem; padding:0.55rem 0.9rem; background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; color:#0f172a; font-size:0.88rem; box-shadow:0 2px 6px rgba(0,0,0,0.04);">
                        <i class="fa-solid fa-file-code" style="color:#7c3aed; font-size: 1.1rem;"></i>
                        <span style="font-weight: 600; color: #0f172a;">${escapeHtml(name)}</span>
                        <button type="button" onclick="event.stopPropagation(); openHtmlPreviewModal('${toJsString(url)}', '${toJsString(name)}')" style="padding: 0.3rem 0.65rem; border: none; border-radius: 6px; background: #7c3aed; color: #ffffff; font-size: 0.78rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 0.25rem;"><i class="fa-solid fa-eye"></i> 미리보기</button>
                        <button type="button" onclick="event.stopPropagation(); downloadFileAttachment('${toJsString(url)}', '${toJsString(name)}')" style="padding: 0.3rem 0.65rem; border: none; border-radius: 6px; background: #2563eb; color: #ffffff; font-size: 0.78rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 0.25rem;"><i class="fa-solid fa-download"></i> 다운로드</button>
                    </div>
                `;
            }
        });
        html += `</div>`;
    }

    return html;
}

function renderFlatReply(comment, tree, postId, depth = 1) {
    const isDeleted = !!comment.deleted;
    const isPresidentComment = !isDeleted && ((comment.author || '').includes('회장') || isAdmin(comment.email));
    const isPresident = isPresidentUser();
    const canDelete = !!(currentUser && !isDeleted && (isPresident || comment.uid === currentUser.uid));
    const canPin = !!(isPresident && !isDeleted);
    const isLiked = !!(comment.likedUsers && currentUser && comment.likedUsers.includes(currentUser.uid));
    const safePostId = toJsString(postId);
    const safeCommentId = toJsString(comment.id);
    const pinned = !!(comment.pinned && !isDeleted);
    const authorName = isDeleted ? '삭제된 댓글' : (comment.author || '사용자');
    const cTime = formatDate(comment.createdAt) + (comment.edited && !isDeleted ? ' <span style="font-size: 0.8em; color: var(--text-secondary);">(수정됨)</span>' : '');
    const badge = isPresidentComment ? '<span class="official-badge" style="background: var(--accent-color); color: #fff; font-size: 0.7rem; padding: 0.08rem 0.35rem; border-radius: 4px; font-weight: bold; margin-left: 0.4rem; white-space: nowrap; flex-shrink: 0;">공식 답변</span>' : '';
    let depthIcon = '';
    if (depth >= 4) {
        const arrowCount = depth - 3;
        const arrowText = '&#x21B3; X' + arrowCount;
        depthIcon = `<span style="color: #9ca3af; font-size: 0.9rem; margin-right: 0.4rem; font-weight: bold; line-height: 1;">${arrowText}</span>`;
    }
    const parentComment = comment.parentId ? tree.byId.get(comment.parentId) : null;
    const mentionHtml = (parentComment && !isDeleted) ? `<span class="flat-reply-mention">@${escapeHtml(parentComment.author || '사용자')}</span> ` : '';
    const bodyHtml = isDeleted
        ? '<span class="comment-deleted-text">삭제된 댓글입니다.</span>'
        : mentionHtml + (typeof window.renderTextWithYoutubeLinks === 'function'
            ? window.renderTextWithYoutubeLinks(escapeHtml(comment.body || '').replace(/\n/g, '<br>'))
            : escapeHtml(comment.body || '').replace(/\n/g, '<br>'));

    const attachmentsHtml = renderCommentAttachmentsHtml(comment, safePostId, safeCommentId, isDeleted);

    const deleteBtn = canDelete ? `<button type="button" class="board-action-btn delete-btn" onclick="event.stopPropagation(); deleteComment('${safePostId}', '${safeCommentId}', true)" title="답글 삭제"><i class="fa-solid fa-trash-can"></i></button>` : '';
    const editBtn = canDelete ? `<button type="button" class="board-action-btn edit-btn role-edit-btn" onclick="event.stopPropagation(); editComment('${safePostId}', '${safeCommentId}')" title="답글 수정" style="color: #007bff !important;"><i class="fa-solid fa-pen-to-square" style="color: #007bff !important;"></i></button>` : '';
    const pinBtn = canPin ? `<button type="button" class="board-action-btn pin-toggle-btn ${pinned ? 'active' : ''}" onclick="togglePinComment('${safePostId}', '${safeCommentId}', ${pinned})" title="${pinned ? '댓글 고정 해제' : '댓글 고정'}"><i class="fa-solid fa-thumbtack"></i></button>` : '';
    const replyBtn = !isDeleted ? `<button type="button" class="reply-action-btn" onclick="startReplyTarget('${safePostId}', '${safeCommentId}')" title="답글"><i class="fa-regular fa-comment-dots"></i> 답글</button>` : '';
    const heartClass = isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    const likeBtn = !isDeleted ? `<button type="button" class="board-action-btn c-like-btn" onclick="toggleLikeComment('${safePostId}', '${safeCommentId}', this, ${isLiked})" title="좋아요"><i class="${heartClass}" style="${isLiked ? 'color: #ff6b6b;' : ''}"></i> <span class="c-like-cnt like-count" style="margin-left: 0.1rem;">${comment.likes || 0}</span></button>` : '';

    const isExpanded = window.expandedCommentIds.has(comment.id);
    const isJustExpanded = window.justExpandedCommentId === comment.id;
    const expandedClass = isExpanded && !isJustExpanded ? 'expanded' : '';
    const replyCount = tree.countDescendants(comment.id);
    const isHiddenToggle = replyCount === 0;
    const toggleText = replyCount > 0 ? `답글 ${replyCount}개` : `답글 0개`;
    const replyToggleBtn = `
                <button type="button" class="reply-toggle-btn ${expandedClass} ${isHiddenToggle ? 'hidden-toggle' : ''}" ${isJustExpanded ? 'data-should-expand="true"' : ''} onclick="toggleCommentReplies('${safeCommentId}')" title="${isExpanded ? '답글 접기' : '답글 보기'}">
                    <i class="fa-solid fa-chevron-down reply-arrow-icon"></i> ${toggleText}
                </button>
            `;

    const kids = tree.childrenMap.get(comment.id) || [];
    let childRepliesHtml = '';
    if (isExpanded && kids.length > 0) {
        const sortedKids = [...kids].sort((a, b) => {
            const pinA = a.pinned && !a.deleted ? 1 : 0;
            const pinB = b.pinned && !b.deleted ? 1 : 0;
            if (pinB !== pinA) return pinB - pinA;
            if (window.currentCommentSort === 'popular') {
                const likesA = a.likes || 0;
                const likesB = b.likes || 0;
                if (likesA !== likesB) return likesB - likesA;
            }
            return commentTimeValue(b) - commentTimeValue(a);
        });
        const isMaxDepth = depth >= 3;
        const containerStyle = isMaxDepth ? `margin-left: 0; padding-left: 0; border-left: none; margin-top: 0;` : ``;
        childRepliesHtml = `<div class="comment-replies-flat ${isJustExpanded ? 'just-expanded' : ''}" style="${containerStyle}">${sortedKids.map(r => renderFlatReply(r, tree, postId, depth + 1)).join('')}</div>`;
    }

    return `
                <div class="comment-flat-reply" id="comment-${escapeHtml(comment.id)}" data-id="${escapeHtml(comment.id)}" data-can-delete="${canDelete ? 'true' : 'false'}" data-reply-count="${replyCount}" data-pinned="${pinned ? 'true' : 'false'}">
                    ${getCommentAvatar(comment, isPresidentComment, isDeleted)}
                    <div class="flat-reply-content">
                        <div class="flat-reply-header">
                            <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                                ${depthIcon}
                                <span class="board-author-name" style="font-weight: 600; font-size: 0.88rem; color: var(--text-primary);">${escapeHtml(authorName)}</span>
                                ${badge}
                            </div>
                            <div class="comment-actions" style="display: flex; align-items: center; gap: 0.5rem;">
                                <div class="mobile-hide" style="display: flex; align-items: center; gap: 0.5rem;">
                                    ${pinBtn}
                                    ${deleteBtn}
                                    ${editBtn}
                                </div>
                                <span class="board-time" style="font-weight: 400;">${cTime}</span>
                            </div>
                        </div>
                        <div class="flat-reply-body">${bodyHtml}${attachmentsHtml}</div>
                        <div class="flat-reply-footer ${replyCount > 0 ? 'has-replies' : ''}" style="display: flex; justify-content: space-between; align-items: center; width: 100%; flex-wrap: nowrap;">
                            <div class="hide-scrollbar" style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: nowrap; overflow-x: auto; flex: 1; min-width: 0;">
                                ${replyBtn}
                                ${replyToggleBtn}
                                <div class="mobile-show" style="display: none; align-items: center; gap: 0.5rem; flex-shrink: 0;">
                                    ${pinBtn}
                                    ${deleteBtn}
                                    ${editBtn}
                                </div>
                            </div>
                            <div style="margin-left: auto; flex-shrink: 0;">${likeBtn}</div>
                        </div>
                    </div>
                </div>
                ${childRepliesHtml}
            `;
}

function renderCommentBranch(comment, depth, tree, postId) {
    const isDeleted = !!comment.deleted;
    const isPresidentComment = !isDeleted && ((comment.author || '').includes('회장') || isAdmin(comment.email));
    const isPresident = isPresidentUser();
    const canDelete = !!(currentUser && !isDeleted && (isPresident || comment.uid === currentUser.uid));
    const canPin = !!(isPresident && !isDeleted);
    const isLiked = !!(comment.likedUsers && currentUser && comment.likedUsers.includes(currentUser.uid));
    const replyCount = tree.countDescendants(comment.id);
    const isExpanded = window.expandedCommentIds.has(comment.id);
    const isJustExpanded = window.justExpandedCommentId === comment.id;
    const expandedClass = isExpanded && !isJustExpanded ? 'expanded' : '';
    const safePostId = toJsString(postId);
    const safeCommentId = toJsString(comment.id);
    const pinned = !!(comment.pinned && !isDeleted);
    const authorName = isDeleted ? '삭제된 댓글' : (comment.author || '사용자');
    const cTime = formatDate(comment.createdAt) + (comment.edited && !isDeleted ? ' <span style="font-size: 0.8em; color: var(--text-secondary);">(수정됨)</span>' : '');
    const badge = isPresidentComment ? '<span class="official-badge" style="background: var(--accent-color); color: #fff; font-size: 0.75rem; padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: bold; margin-left: 0.5rem; white-space: nowrap; flex-shrink: 0;">공식 답변</span>' : '';
    const pinBadge = `<div class="pin-badge-wrapper ${pinned ? 'active' : ''}">
                                <span class="pin-badge-ui" style="background: var(--accent-color); color: #fff; font-size: 0.7rem; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: bold; display: inline-block;">
                                    <i class="fa-solid fa-thumbtack"></i> 상단 고정
                                </span>
                            </div>`;
    const checkbox = canDelete ? `
                <label class="comment-checkbox-wrapper" style="align-items: center; margin-top: 0.2rem; padding-right: 0;">
                    <input type="checkbox" class="comment-select-cb" value="${escapeHtml(comment.id)}" onchange="updateMultiDeleteUI()" style="width: 1.1rem; height: 1.1rem; accent-color: var(--accent-color); cursor: pointer;">
                </label>
            ` : '';
    const deleteBtn = canDelete ? `
                <button type="button" class="board-action-btn delete-btn" onclick="event.stopPropagation(); deleteComment('${safePostId}', '${safeCommentId}')" title="댓글 삭제">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            ` : '';
    const editBtn = canDelete ? `
                <button type="button" class="board-action-btn edit-btn role-edit-btn" onclick="event.stopPropagation(); editComment('${safePostId}', '${safeCommentId}')" title="답글 수정" style="color: #007bff !important;">
                    <i class="fa-solid fa-pen-to-square" style="color: #007bff !important;"></i>
                </button>
            ` : '';
    const pinBtn = canPin ? `
                <button type="button" class="board-action-btn pin-toggle-btn ${pinned ? 'active' : ''}" onclick="togglePinComment('${safePostId}', '${safeCommentId}', ${pinned})" title="${pinned ? '댓글 고정 해제' : '댓글 고정'}">
                    <i class="fa-solid fa-thumbtack"></i>
                </button>
            ` : '';
    const replyBtn = !isDeleted ? `
                <button type="button" class="reply-action-btn" onclick="startReplyTarget('${safePostId}', '${safeCommentId}')" title="답글">
                    <i class="fa-regular fa-comment-dots"></i> 답글
                </button>
            ` : '';
    const isHiddenToggle = replyCount === 0;
    const toggleText = replyCount > 0 ? `답글 ${replyCount}개` : `답글 0개`;
    const replyToggleBtn = `
                <button type="button" class="reply-toggle-btn ${expandedClass} ${isHiddenToggle ? 'hidden-toggle' : ''}" ${isJustExpanded ? 'data-should-expand="true"' : ''} onclick="toggleCommentReplies('${safeCommentId}')" title="${isExpanded ? '답글 접기' : '답글 보기'}">
                    <i class="fa-solid fa-chevron-down reply-arrow-icon"></i> ${toggleText}
                </button>
            `;
    const heartClass = isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    const likeBtn = !isDeleted ? `
                <button type="button" class="board-action-btn c-like-btn" onclick="toggleLikeComment('${safePostId}', '${safeCommentId}', this, ${isLiked})" title="좋아요">
                    <i class="${heartClass}" style="${isLiked ? 'color: #ff6b6b;' : ''}"></i> <span class="c-like-cnt like-count" style="margin-left: 0.1rem;">${comment.likes || 0}</span>
                </button>
            ` : '';
    const itemStyle = '';
    const bodyHtml = isDeleted
        ? '<span class="comment-deleted-text">삭제된 댓글입니다.</span>'
        : (typeof window.renderTextWithYoutubeLinks === 'function'
            ? window.renderTextWithYoutubeLinks(escapeHtml(comment.body || '').replace(/\n/g, '<br>'))
            : escapeHtml(comment.body || '').replace(/\n/g, '<br>'));

    const attachmentsHtml = renderCommentAttachmentsHtml(comment, safePostId, safeCommentId, isDeleted);

    let repliesHtml = '';
    if (isExpanded) {
        const immediateReplies = tree.childrenMap.get(comment.id) || [];
        if (immediateReplies.length > 0) {
            const sortedReplies = [...immediateReplies].sort((a, b) => {
                const pinA = a.pinned && !a.deleted ? 1 : 0;
                const pinB = b.pinned && !b.deleted ? 1 : 0;
                if (pinB !== pinA) return pinB - pinA;
                if (window.currentCommentSort === 'popular') {
                    const likesA = a.likes || 0;
                    const likesB = b.likes || 0;
                    if (likesA !== likesB) return likesB - likesA;
                }
                return commentTimeValue(b) - commentTimeValue(a);
            });
            repliesHtml = `<div class="comment-replies-flat ${isJustExpanded ? 'just-expanded' : ''}">${sortedReplies.map(r => renderFlatReply(r, tree, postId, 1)).join('')}</div>`;
        }
    }

    return `
                <div class="comment-node">
                    <div id="comment-${escapeHtml(comment.id)}" class="comment-item ${isDeleted ? 'comment-deleted' : ''} ${isPresidentComment ? 'official' : ''}" data-id="${escapeHtml(comment.id)}" data-can-delete="${canDelete ? 'true' : 'false'}" data-reply-count="${replyCount}" data-pinned="${pinned ? 'true' : 'false'}" style="${itemStyle}">
                        ${pinBadge}
                        <div style="display: flex; align-items: flex-start; width: 100%;">
                            ${checkbox}
                            ${getCommentAvatar(comment, isPresidentComment, isDeleted)}
                            <div class="comment-content" style="flex: 1; min-width: 0; padding-top: 0.2rem; margin-left: 0.75rem;">
                                <div class="comment-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: nowrap; margin-bottom: 0.4rem;">
                                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: nowrap; min-width: 0;">
                                        <span class="board-author-name" style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(authorName)}</span>
                                        ${badge}
                                    </div>
                                    <div class="comment-actions" style="display: flex; align-items: center; gap: 0.5rem;">
                                        <div class="mobile-hide" style="display: flex; align-items: center; gap: 0.5rem;">
                                            ${pinBtn}
                                            ${deleteBtn}
                                            ${editBtn}
                                        </div>
                                        <span class="board-time" style="font-weight: 400;">${cTime}</span>
                                    </div>
                                </div>
                                <div class="comment-text" style="font-size: 0.95rem; line-height: 1.5; color: var(--text-primary); word-break: break-all; margin-bottom: 0.8rem;">${bodyHtml}${attachmentsHtml}</div>
                                <div class="comment-footer ${replyCount > 0 ? 'has-replies' : ''}" style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: nowrap; width: 100%;">
                                    <div class="hide-scrollbar" style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: nowrap; overflow-x: auto; flex: 1; min-width: 0;">
                                        ${replyBtn}
                                        ${replyToggleBtn}
                                        <div class="mobile-show" style="display: none; align-items: center; gap: 0.5rem; flex-shrink: 0;">
                                            ${pinBtn}
                                            ${deleteBtn}
                                            ${editBtn}
                                        </div>
                                    </div>
                                    <div class="board-stats" style="margin-left: auto; flex-shrink: 0;">
                                        ${likeBtn}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    ${repliesHtml}
                </div>
            `;
}

function attachCommentItemEvents() {
    document.querySelectorAll('#detailCommentList .comment-item, #detailCommentList .comment-flat-reply').forEach(item => {
        const cid = item.getAttribute('data-id');
        const canDelete = item.getAttribute('data-can-delete') === 'true';

        if (canDelete) {
            item.addEventListener('pointerdown', (e) => window.handleCommentPointerDown(e, cid));
            item.addEventListener('pointerup', window.handleCommentPointerUp);
            item.addEventListener('pointercancel', window.handleCommentPointerUp);
            item.addEventListener('pointerleave', window.handleCommentPointerUp);
            item.addEventListener('contextmenu', (e) => {
                if (window.isMultiSelectMode) e.preventDefault();
            });
        }

        item.addEventListener('click', (e) => {
            if (e.target.closest('.comment-item') !== item && e.target.closest('.comment-flat-reply') !== item) return;
            if (window.ignoreNextCommentClick) {
                window.ignoreNextCommentClick = false;
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (e.target.closest('button') || e.target.closest('a') || e.target.closest('label') || e.target.closest('input')) return;

            if (window.isMultiSelectMode) {
                e.preventDefault();
                e.stopPropagation();
                const cb = item.querySelector('.comment-select-cb');
                if (cb) {
                    cb.checked = !cb.checked;
                    updateMultiDeleteUI();
                }
                return;
            }

            const replyCount = parseInt(item.getAttribute('data-reply-count') || '0', 10);
            if (replyCount > 0) {
                window.toggleCommentReplies(cid);
            }
        });
    });
}

window.renderCurrentComments = function (postId = currentPostId) {
    if (!postId || postId !== currentPostId) return;
    const commentList = document.getElementById('detailCommentList');
    if (!commentList) return;

    const oldPositions = new Map();
    commentList.querySelectorAll('.comment-item, .comment-flat-reply').forEach(item => {
        const opacity = window.getComputedStyle(item).opacity;
        const toggleBtn = item.querySelector('.reply-toggle-btn');
        const cid = item.getAttribute('data-id');
        const preTop = (window.preDeletePositions && window.preDeletePositions.has(cid))
            ? window.preDeletePositions.get(cid)
            : item.getBoundingClientRect().top;

        oldPositions.set(cid, {
            rect: { top: preTop },
            opacity: opacity,
            isPinned: item.getAttribute('data-pinned') === 'true',
            hadReplies: toggleBtn && !toggleBtn.classList.contains('hidden-toggle')
        });
    });
    window.preDeletePositions = null;

    const comments = window.currentCommentDocs || [];
    const tree = buildCommentTree(comments);
    const visibleCount = comments.filter(comment => !comment.deleted).length;
    const topCountEl = document.getElementById('detailTopCommentCount');
    if (topCountEl) topCountEl.innerText = visibleCount;
    const detailCommentCount = document.getElementById('detailCommentCount');
    if (detailCommentCount) detailCommentCount.innerText = visibleCount;

    if (window.replyTarget && (!tree.byId.has(window.replyTarget.id) || tree.byId.get(window.replyTarget.id).deleted)) {
        window.replyTarget = null;
        updateReplyTargetUI();
    }

    const roots = tree.childrenMap.get(null) || [];
    if (roots.length === 0) {
        commentList.innerHTML = '<div class="comment-empty-state">아직 댓글이 없습니다.</div>';
        return;
    }

    // 모바일에서는 가상 키보드 작동으로 뷰포트가 실시간 축소될 때 이전 측정 높이(minHeight)가 댓글을 강제 팽창시키는 것을 완벽히 방지합니다.
    if (window.innerWidth >= 1024) {
        const currentHeight = commentList.getBoundingClientRect().height;
        if (currentHeight > 0) {
            commentList.style.minHeight = `${currentHeight}px`;
        }
    }

    const html = roots.map(comment => renderCommentBranch(comment, 0, tree, postId)).join('');
    const temp = document.createElement('div');
    temp.innerHTML = html;
    commentList.replaceChildren(...temp.childNodes);

    window.justExpandedCommentId = null;
    requestAnimationFrame(() => {
        commentList.querySelectorAll('.reply-toggle-btn[data-should-expand="true"]').forEach(btn => {
            btn.classList.add('expanded');
            btn.removeAttribute('data-should-expand');
        });
    });

    attachCommentItemEvents();

    // 만약 skipCommentFlip 이 true면 즉시 새 코멘트를 보여주고 끝냄
    if (window.skipCommentFlip) {
        commentList.querySelectorAll('.comment-item, .comment-flat-reply').forEach(item => {
            item.style.opacity = '';
            item.style.transform = '';
            item.style.transition = '';
        });
        setTimeout(() => {
            commentList.style.minHeight = '';
        }, 450);
        return;
    }

    // 1. 화면 깜빡임(팝핑) 방지: 브라우저가 화면을 그리기 전에 새 요소들을 투명하게 만듦
    commentList.querySelectorAll('.comment-item, .comment-flat-reply').forEach(item => {
        if (!oldPositions.has(item.getAttribute('data-id'))) {
            item.style.opacity = '0';
            item.style.transform = 'scale(0.95)';
            item.style.transition = 'none';
        }
    });

    // 2. 답글 보기/접기(.comment-replies-flat) 확장 애니메이션 처리
    commentList.querySelectorAll('.comment-replies-flat.just-expanded').forEach(container => {
        container.classList.remove('just-expanded');
        const fullHeight = container.offsetHeight;
        container.style.height = '0px';
        container.style.opacity = '0';
        container.style.overflow = 'hidden';
        container.style.transition = 'none';
        container.offsetHeight; // force reflow

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                container.style.transition = 'height 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease';
                container.style.height = fullHeight + 'px';
                container.style.opacity = '1';
            });
        });

        setTimeout(() => {
            container.style.height = '';
            container.style.opacity = '';
            container.style.overflow = '';
            container.style.transition = '';
        }, 350);
    });

    // 3. FLIP 및 새 댓글 등장 애니메이션 시작
    requestAnimationFrame(() => {
        commentList.querySelectorAll('.comment-item, .comment-flat-reply').forEach(item => {
            const cid = item.getAttribute('data-id');
            const oldData = oldPositions.get(cid);
            const toggleBtn = item.querySelector('.reply-toggle-btn');

            // 3-1. 답글 갯수 버튼이 0 -> >0 / >0 -> 0 으로 바뀔 때의 마진/너비 애니메이션
            if (oldData && toggleBtn) {
                const hasRepliesNow = !toggleBtn.classList.contains('hidden-toggle');
                if (!oldData.hadReplies && hasRepliesNow) {
                    toggleBtn.classList.add('no-transition');
                    toggleBtn.classList.add('hidden-toggle');
                    void toggleBtn.offsetWidth; // force reflow
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            toggleBtn.classList.remove('no-transition');
                            toggleBtn.classList.remove('hidden-toggle');
                        });
                    });
                } else if (oldData.hadReplies && !hasRepliesNow) {
                    toggleBtn.classList.add('no-transition');
                    toggleBtn.classList.remove('hidden-toggle');
                    void toggleBtn.offsetWidth; // force reflow
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            toggleBtn.classList.remove('no-transition');
                            toggleBtn.classList.add('hidden-toggle');
                        });
                    });
                }
            }

            // 3-2. 기존 댓글의 위치 이동 애니메이션 (FLIP)
            if (oldData) {
                const newRect = item.getBoundingClientRect();
                const deltaY = oldData.rect.top - newRect.top;
                const isPinnedNow = item.getAttribute('data-pinned') === 'true';
                const pinnedChanged = oldData.isPinned !== isPinnedNow;

                if (parseFloat(oldData.opacity) < 1) {
                    item.style.opacity = oldData.opacity;
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            item.style.transition = 'opacity 0.4s ease';
                            item.style.opacity = '1';
                        });
                    });
                }

                if (Math.abs(deltaY) > 1 || pinnedChanged) {
                    if (pinnedChanged) {
                        item.setAttribute('data-pinned', oldData.isPinned ? 'true' : 'false');
                        const pb = item.querySelector('.pin-badge-wrapper');
                        if (pb) {
                            pb.classList.toggle('active', oldData.isPinned);
                            pb.style.transition = 'none';
                        }
                    }

                    if (Math.abs(deltaY) > 1) {
                        item.style.transform = `translateY(${deltaY}px)`;
                    }
                    item.style.transition = 'none';
                    item.offsetHeight; // force reflow

                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            item.classList.add('flipping');
                            item.style.transition = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
                            item.style.transform = '';

                            if (pinnedChanged) {
                                item.setAttribute('data-pinned', isPinnedNow ? 'true' : 'false');
                                const pb = item.querySelector('.pin-badge-wrapper');
                                if (pb) {
                                    pb.classList.toggle('active', isPinnedNow);
                                    pb.style.transition = '';
                                }
                            }

                            setTimeout(() => {
                                item.classList.remove('flipping');
                                item.style.transition = '';
                            }, 450);
                        });
                    });
                }
            } else {
                // 3-3. 새 댓글/답글 등장 애니메이션
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        item.style.opacity = '1';
                        item.style.transform = 'scale(1)';
                        item.style.transition = 'opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
                        setTimeout(() => {
                            item.style.transition = '';
                            item.style.transform = '';
                        }, 350);
                    });
                });
            }
        });
    });

    setTimeout(() => {
        commentList.style.minHeight = '';
    }, 450);
};

window.toggleCommentReplies = function (commentId) {
    if (window.expandedCommentIds.has(commentId)) {
        let parentItem = document.querySelector(`.comment-item[data-id="${commentId}"]`) ||
            document.querySelector(`.comment-flat-reply[data-id="${commentId}"]`);

        if (parentItem && parentItem.nextElementSibling && parentItem.nextElementSibling.classList.contains('comment-replies-flat')) {
            const repliesContainer = parentItem.nextElementSibling;
            const height = repliesContainer.offsetHeight;

            const toggleBtn = parentItem.querySelector('.reply-toggle-btn');
            if (toggleBtn) toggleBtn.classList.remove('expanded');

            repliesContainer.style.height = height + 'px';
            repliesContainer.style.overflow = 'hidden';
            repliesContainer.offsetHeight; // 플로우 강제 리페인트

            repliesContainer.style.transition = 'height 0.3s ease, opacity 0.3s ease, margin 0.3s ease, padding 0.3s ease';
            repliesContainer.style.height = '0px';
            repliesContainer.style.opacity = '0';
            repliesContainer.style.marginTop = '0';
            repliesContainer.style.marginBottom = '0';
            repliesContainer.style.paddingTop = '0';
            repliesContainer.style.paddingBottom = '0';
            repliesContainer.style.border = 'none';

            setTimeout(() => {
                window.expandedCommentIds.delete(commentId);
                window.renderCurrentComments();
            }, 300);
            return;
        }

        window.expandedCommentIds.delete(commentId);
    } else {
        window.expandedCommentIds.add(commentId);
        window.justExpandedCommentId = commentId;
    }
    window.renderCurrentComments();
};

window.expandCommentLineage = function (commentId) {
    const byId = new Map((window.currentCommentDocs || []).map(comment => [comment.id, comment]));
    let currentId = commentId;
    while (currentId) {
        window.expandedCommentIds.add(currentId);
        const currentComment = byId.get(currentId);
        currentId = currentComment ? currentComment.parentId : null;
    }
};

function updateReplyTargetUI(newValue = undefined, focusAfter = false) {
    const input = document.querySelector('.side-detail-container .comment-input');
    const cancelBtn = document.getElementById('cancelReplyBtn');
    const submitBtn = document.querySelector('.side-detail-container .comment-submit-btn');
    if (!input || !cancelBtn) return;

    input.classList.add('text-fade');
    setTimeout(() => {
        if (window.editTarget) {
            input.placeholder = '댓글을 수정하세요...';
            cancelBtn.classList.add('active');
            cancelBtn.title = '수정 취소';
            if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
        } else if (window.replyTarget) {
            input.placeholder = `${window.replyTarget.author}님에게 답글 작성 중...`;
            cancelBtn.classList.add('active');
            cancelBtn.title = '답글 취소';
            if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
        } else {
            input.placeholder = '댓글을 입력하세요...';
            cancelBtn.classList.remove('active');
            cancelBtn.title = '답글 취소';
            if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
        }

        if (newValue !== undefined) {
            input.value = newValue;
        }

        input.classList.remove('text-fade');
        if (focusAfter) {
            input.focus();
        }
    }, 300);
}

window.startReplyTarget = function (postId, commentId) {
    if (!currentUser) {
        alert('답글을 작성하시려면 먼저 Google 로그인을 해주세요!');
        openDrawer();
        return;
    }
    const target = (window.currentCommentDocs || []).find(comment => comment.id === commentId);
    if (!target || target.deleted) return;
    window.replyTarget = {
        postId,
        id: commentId,
        author: target.author || '사용자'
    };
    window.editTarget = null;
    window.expandCommentLineage(commentId);
    updateReplyTargetUI(undefined, true);
};

window.cancelReplyTarget = function () {
    let newValue = undefined;
    if (window.editTarget) {
        window.editTarget = null;
        newValue = '';
        if (typeof commentAttachedImages !== 'undefined') {
            commentAttachedImages = [];
            if (typeof renderCommentImagePreview === 'function') {
                renderCommentImagePreview();
            }
        }
    }
    window.replyTarget = null;
    updateReplyTargetUI(newValue);
};

// 상세 닫기 함수
