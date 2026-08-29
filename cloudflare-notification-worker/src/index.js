import webpush from 'web-push';
import {
  cleanText,
  commentPreview,
  decodeFirestoreDocument,
  findRootCommentId,
  getCommentUid,
  personName,
  quotedTitle,
  uniqueUserIds
} from './logic.js';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function requireAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!origin) return '';
  if (!allowedOrigins(env).includes(origin)) {
    throw new HttpError(403, '허용되지 않은 사이트 주소입니다.');
  }
  return origin;
}

function corsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin'
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(origin)
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, '요청 내용이 올바른 JSON이 아닙니다.');
  }
}

function requireId(value, label) {
  const id = String(value || '').trim();
  if (!id || id.length > 200 || id.includes('/')) {
    throw new HttpError(400, `${label}이 올바르지 않습니다.`);
  }
  return id;
}

function getBearerToken(request) {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    throw new HttpError(401, '로그인이 필요합니다.');
  }
  return authorization.slice(7).trim();
}

async function verifyFirebaseUser(request, env) {
  const idToken = getBearerToken(request);
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    }
  );

  if (!response.ok) throw new HttpError(401, '로그인 정보가 만료됐습니다. 다시 로그인해 주세요.');
  const data = await response.json();
  const account = Array.isArray(data.users) ? data.users[0] : null;
  if (!account?.localId) throw new HttpError(401, '로그인 계정을 확인할 수 없습니다.');

  return {
    uid: account.localId,
    email: String(account.email || '').toLowerCase(),
    displayName: account.displayName || account.email || '회원',
    idToken
  };
}

function adminEmails(env) {
  return String(env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isAdmin(user, env) {
  return Boolean(user?.email && adminEmails(env).includes(user.email));
}

function adminDisplayNames(env) {
  try {
    return JSON.parse(env.ADMIN_DISPLAY_NAMES || '{}');
  } catch {
    return {};
  }
}

function actionDisplayName(user, env) {
  if (isAdmin(user, env)) return adminDisplayNames(env)[user.email] || user.displayName || '관리자';
  return user.displayName || user.email || '회원';
}

function firestoreBaseUrl(env) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents`;
}

function firestorePathUrl(env, pathParts) {
  return `${firestoreBaseUrl(env)}/${pathParts.map((part) => encodeURIComponent(part)).join('/')}`;
}

async function firestoreRequest(url, idToken, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${idToken}`);
  if (options.body) headers.set('Content-Type', 'application/json');
  return fetch(url, { ...options, headers });
}

async function getFirestoreDocument(env, idToken, pathParts) {
  const response = await firestoreRequest(firestorePathUrl(env, pathParts), idToken);
  if (response.status === 404) return null;
  if (!response.ok) throw new HttpError(response.status === 403 ? 403 : 502, 'Firebase 데이터를 확인하지 못했습니다.');
  return decodeFirestoreDocument(await response.json());
}

async function listPostComments(env, idToken, postId) {
  const comments = [];
  let pageToken = '';

  do {
    const url = new URL(firestorePathUrl(env, ['posts', postId, 'comments']));
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await firestoreRequest(url.href, idToken);
    if (!response.ok) throw new HttpError(response.status === 403 ? 403 : 502, '댓글 목록을 확인하지 못했습니다.');
    const data = await response.json();
    (data.documents || []).forEach((document) => {
      const decoded = decodeFirestoreDocument(document);
      if (decoded) comments.push(decoded);
    });
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  return comments;
}

async function deleteFirestorePost(env, idToken, postId) {
  const response = await firestoreRequest(firestorePathUrl(env, ['posts', postId]), idToken, {
    method: 'DELETE'
  });
  if (!response.ok) {
    if (response.status === 403) throw new HttpError(403, '게시물을 삭제할 권한이 없습니다.');
    if (response.status === 404) throw new HttpError(404, '게시물이 이미 삭제됐습니다.');
    throw new HttpError(502, 'Firebase 게시물 삭제에 실패했습니다.');
  }
}

async function endpointId(endpoint) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function validateSubscription(subscription) {
  if (!subscription || typeof subscription !== 'object') throw new HttpError(400, '푸시 구독 정보가 없습니다.');
  const endpoint = String(subscription.endpoint || '');
  const p256dh = String(subscription.keys?.p256dh || '');
  const auth = String(subscription.keys?.auth || '');
  if (!endpoint.startsWith('https://') || !p256dh || !auth) {
    throw new HttpError(400, '푸시 구독 정보가 올바르지 않습니다.');
  }
  return { endpoint, p256dh, auth };
}

async function saveSubscription(env, user, subscription, userAgent = '') {
  const normalized = validateSubscription(subscription);
  const id = await endpointId(normalized.endpoint);
  const now = Date.now();
  await env.DB.prepare(`
    INSERT INTO push_subscriptions
      (id, uid, endpoint, p256dh, auth, user_agent, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      uid = excluded.uid,
      endpoint = excluded.endpoint,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent = excluded.user_agent,
      updated_at = excluded.updated_at
  `).bind(
    id,
    user.uid,
    normalized.endpoint,
    normalized.p256dh,
    normalized.auth,
    cleanText(userAgent, 300),
    now,
    now
  ).run();
}

async function removeSubscription(env, user, subscription) {
  const normalized = validateSubscription(subscription);
  const id = await endpointId(normalized.endpoint);
  await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ? AND uid = ?')
    .bind(id, user.uid)
    .run();
}

async function getSubscriptionRows(env, recipientUids = null, excludedUid = '') {
  const result = await env.DB.prepare(
    'SELECT id, uid, endpoint, p256dh, auth FROM push_subscriptions'
  ).all();
  const recipientSet = recipientUids ? new Set(recipientUids) : null;
  return (result.results || []).filter((row) => {
    if (!row.uid || row.uid === excludedUid) return false;
    return !recipientSet || recipientSet.has(row.uid);
  });
}

async function claimEvent(env, eventId, eventType) {
  const now = Date.now();
  await env.DB.prepare('DELETE FROM processed_events WHERE created_at < ?')
    .bind(now - 45 * 24 * 60 * 60 * 1000)
    .run();
  const result = await env.DB.prepare(
    'INSERT OR IGNORE INTO processed_events (event_id, event_type, created_at) VALUES (?, ?, ?)'
  ).bind(eventId, eventType, now).run();
  return Number(result.meta?.changes || 0) > 0;
}

function requireVapid(env) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    throw new HttpError(503, 'Web Push 키가 아직 설정되지 않았습니다.');
  }
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
}

async function sendPushes(env, rows, payload) {
  if (!rows.length) return;
  requireVapid(env);

  const sendOne = async (row) => {
    const subscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth }
    };

    try {
      await webpush.sendNotification(subscription, JSON.stringify({
        ...payload,
        recipientUid: row.uid
      }), {
        TTL: 24 * 60 * 60,
        urgency: 'high'
      });
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(row.id).run();
        return;
      }
      console.error('Web Push 전송 실패', error?.statusCode || error?.message || error);
    }
  };

  for (let index = 0; index < rows.length; index += 5) {
    await Promise.all(rows.slice(index, index + 5).map(sendOne));
  }
}

function notificationPayload({ notificationId, type, title, body, target = 'community', postId = '', commentId = '', buildNumber = '' }) {
  return {
    notificationId,
    type,
    title,
    body,
    target,
    postId,
    commentId,
    buildNumber
  };
}

async function handleSubscribe(request, env, origin) {
  const user = await verifyFirebaseUser(request, env);
  requireVapid(env);
  const body = await readJson(request);
  await saveSubscription(env, user, body.subscription, request.headers.get('User-Agent') || '');
  return json({ ok: true }, 200, origin);
}

async function handleUnsubscribe(request, env, origin) {
  const user = await verifyFirebaseUser(request, env);
  const body = await readJson(request);
  await removeSubscription(env, user, body.subscription);
  return json({ ok: true }, 200, origin);
}

async function handleCommentEvent(request, env, ctx, origin) {
  const user = await verifyFirebaseUser(request, env);
  const body = await readJson(request);
  const postId = requireId(body.postId, '게시물 ID');
  const commentId = requireId(body.commentId, '댓글 ID');
  const eventId = `comment:${postId}:${commentId}`;

  const [post, comment] = await Promise.all([
    getFirestoreDocument(env, user.idToken, ['posts', postId]),
    getFirestoreDocument(env, user.idToken, ['posts', postId, 'comments', commentId])
  ]);

  if (!post || !comment) throw new HttpError(404, '게시물 또는 댓글을 찾을 수 없습니다.');
  if (getCommentUid(comment) !== user.uid) throw new HttpError(403, '본인이 작성한 댓글만 알림으로 보낼 수 있습니다.');
  if (comment.deleted) throw new HttpError(409, '삭제된 댓글은 알림으로 보낼 수 없습니다.');
  if (!await claimEvent(env, eventId, comment.parentId ? 'new_reply' : 'new_comment')) {
    return json({ ok: true, duplicate: true }, 200, origin);
  }

  const actor = personName(comment.author || user.displayName);
  const commentText = cleanText(comment?.body || comment?.content || '', 40);
  let rows;
  let payload;

  if (!comment.parentId) {
    rows = await getSubscriptionRows(env, null, user.uid);
    payload = notificationPayload({
      notificationId: eventId,
      type: 'new_comment',
      title: `${actor}: ${commentText ? `“${commentText}”` : '새 댓글을 남겼어요'}`,
      body: `${quotedTitle(post.title)} 게시물의 새 댓글`,
      target: 'post',
      postId,
      commentId
    });
  } else {
    const comments = await listPostComments(env, user.idToken, postId);
    const commentsById = new Map(comments.map((item) => [item.id, item]));
    commentsById.set(commentId, comment);
    const rootCommentId = findRootCommentId(commentId, commentsById);
    const participantUids = [];
    commentsById.forEach((candidate, candidateId) => {
      if (findRootCommentId(candidateId, commentsById) === rootCommentId) {
        participantUids.push(getCommentUid(candidate));
      }
    });
    participantUids.push(post.uid || post.authorUid || '');
    const recipients = uniqueUserIds(participantUids, user.uid);
    rows = await getSubscriptionRows(env, recipients);
    const parent = commentsById.get(comment.parentId) || {};
    const repliedTo = personName(comment.replyToAuthor || parent.author || '다른 회원');
    payload = notificationPayload({
      notificationId: eventId,
      type: 'new_reply',
      title: `${actor}: ${commentText ? `“${commentText}”` : '새 답글을 남겼어요'}`,
      body: `${repliedTo}의 댓글에 남긴 답글 (${quotedTitle(post.title)})`,
      target: 'post',
      postId,
      commentId
    });
  }

  ctx.waitUntil(sendPushes(env, rows, payload));
  return json({ ok: true, recipientDevices: rows.length }, 202, origin);
}

async function handleCommentPinEvent(request, env, ctx, origin) {
  const user = await verifyFirebaseUser(request, env);
  const body = await readJson(request);
  const postId = requireId(body.postId, '게시물 ID');
  const commentId = requireId(body.commentId, '댓글 ID');
  const pinned = Boolean(body.pinned);

  const [post, comment] = await Promise.all([
    getFirestoreDocument(env, user.idToken, ['posts', postId]),
    getFirestoreDocument(env, user.idToken, ['posts', postId, 'comments', commentId])
  ]);
  if (!post || !comment) throw new HttpError(404, '게시물 또는 댓글을 찾을 수 없습니다.');
  const ownsPost = post.uid === user.uid || post.authorUid === user.uid || post.email === user.email;
  if (!ownsPost && !isAdmin(user, env)) throw new HttpError(403, '댓글을 고정할 권한이 없습니다.');
  if (Boolean(comment.pinned) !== pinned) throw new HttpError(409, 'Firebase의 실제 고정 상태와 일치하지 않습니다.');

  const previous = await env.DB.prepare(
    'SELECT pinned FROM comment_pin_state WHERE post_id = ? AND comment_id = ?'
  ).bind(postId, commentId).first();
  await env.DB.prepare(`
    INSERT INTO comment_pin_state (post_id, comment_id, pinned, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(post_id, comment_id) DO UPDATE SET
      pinned = excluded.pinned,
      updated_at = excluded.updated_at
  `).bind(postId, commentId, pinned ? 1 : 0, Date.now()).run();

  if (!pinned || Number(previous?.pinned || 0) === 1) {
    return json({ ok: true, notified: false }, 200, origin);
  }

  const recipientUid = getCommentUid(comment);
  if (!recipientUid || recipientUid === user.uid) {
    return json({ ok: true, notified: false }, 200, origin);
  }

  const rows = await getSubscriptionRows(env, [recipientUid]);
  const isReply = Boolean(comment.parentId);
  const itemLabel = isReply ? '답글' : '댓글';
  const eventId = `pin:${postId}:${commentId}:${Date.now()}`;
  const payload = notificationPayload({
    notificationId: eventId,
    type: isReply ? 'reply_pinned' : 'comment_pinned',
    title: `${itemLabel}이 고정됐어요`,
    body: `${personName(actionDisplayName(user, env))}이 내 ${itemLabel}을 상단 고정했어요.`,
    target: 'post',
    postId,
    commentId
  });
  ctx.waitUntil(sendPushes(env, rows, payload));
  return json({ ok: true, notified: true, recipientDevices: rows.length }, 202, origin);
}

async function handleDeletePost(request, env, ctx, origin) {
  const user = await verifyFirebaseUser(request, env);
  const body = await readJson(request);
  const postId = requireId(body.postId, '게시물 ID');
  const post = await getFirestoreDocument(env, user.idToken, ['posts', postId]);
  if (!post) throw new HttpError(404, '게시물이 이미 삭제됐습니다.');

  const ownsPost = post.uid === user.uid || post.authorUid === user.uid || post.email === user.email;
  const moderatorDelete = !ownsPost && isAdmin(user, env);
  if (!ownsPost && !moderatorDelete) throw new HttpError(403, '게시물을 삭제할 권한이 없습니다.');

  await deleteFirestorePost(env, user.idToken, postId);

  const recipientUid = post.uid || post.authorUid || '';
  if (moderatorDelete && recipientUid && recipientUid !== user.uid) {
    const rows = await getSubscriptionRows(env, [recipientUid]);
    const eventId = `delete:${postId}:${crypto.randomUUID()}`;
    const payload = notificationPayload({
      notificationId: eventId,
      type: 'post_deleted',
      title: '게시물이 삭제됐어요',
      body: `${personName(actionDisplayName(user, env))}이 내 게시물 ${quotedTitle(post.title)}을 삭제했어요.`,
      target: 'community',
      postId
    });
    ctx.waitUntil(sendPushes(env, rows, payload));
  }

  return json({ ok: true, deleted: true }, 200, origin);
}

async function handleSiteUpdate(request, env, ctx, origin) {
  const user = await verifyFirebaseUser(request, env);
  if (!isAdmin(user, env)) throw new HttpError(403, '관리자만 업데이트 알림을 보낼 수 있습니다.');
  const body = await readJson(request);
  const oneUiVersion = cleanText(body.oneUiVersion, 30) || '사이트';
  const buildNumber = cleanText(body.buildNumber, 30);
  const message = cleanText(body.message, 100);
  if (!buildNumber) throw new HttpError(400, 'Build 번호가 필요합니다.');

  const eventId = `site-update:${buildNumber}`;
  if (!await claimEvent(env, eventId, 'site_update')) {
    return json({ ok: true, duplicate: true }, 200, origin);
  }

  const rows = await getSubscriptionRows(env);
  const bodyParts = [`Build ${buildNumber}`];
  if (message) bodyParts.push(message);
  const payload = notificationPayload({
    notificationId: eventId,
    type: 'site_update',
    title: `${oneUiVersion} 업데이트`,
    body: bodyParts.join(' · '),
    target: 'update',
    buildNumber
  });
  ctx.waitUntil(sendPushes(env, rows, payload));
  return json({ ok: true, recipientDevices: rows.length }, 202, origin);
}

export default {
  async fetch(request, env, ctx) {
    let origin = '';
    try {
      origin = requireAllowedOrigin(request, env);
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });

      const url = new URL(request.url);
      if (request.method === 'GET' && url.pathname === '/health') {
        return json({ ok: true, service: 'yangjung-science-notifications' }, 200, origin);
      }
      if (request.method === 'GET' && url.pathname === '/vapid-public-key') {
        if (!env.VAPID_PUBLIC_KEY) throw new HttpError(503, 'Web Push 공개 키가 아직 설정되지 않았습니다.');
        return json({ publicKey: env.VAPID_PUBLIC_KEY }, 200, origin);
      }
      if (request.method === 'POST' && url.pathname === '/subscriptions') {
        return await handleSubscribe(request, env, origin);
      }
      if (request.method === 'DELETE' && url.pathname === '/subscriptions') {
        return await handleUnsubscribe(request, env, origin);
      }
      if (request.method === 'POST' && url.pathname === '/events/comment') {
        return await handleCommentEvent(request, env, ctx, origin);
      }
      if (request.method === 'POST' && url.pathname === '/events/comment-pin') {
        return await handleCommentPinEvent(request, env, ctx, origin);
      }
      if (request.method === 'POST' && url.pathname === '/actions/delete-post') {
        return await handleDeletePost(request, env, ctx, origin);
      }
      if (request.method === 'POST' && url.pathname === '/events/site-update') {
        return await handleSiteUpdate(request, env, ctx, origin);
      }

      return json({ error: '요청한 알림 기능을 찾을 수 없습니다.' }, 404, origin);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status >= 500) console.error('알림 Worker 오류', error);
      return json({ error: error.message || '알림 서버 오류가 발생했습니다.' }, status, origin);
    }
  }
};
