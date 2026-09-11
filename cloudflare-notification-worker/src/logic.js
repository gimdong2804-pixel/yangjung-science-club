export function cleanText(value, maxLength = 120) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function personName(value, fallback = '회원') {
  const name = cleanText(value, 40) || fallback;
  return name.endsWith('님') ? name : `${name}님`;
}

export function senderTitle(value, fallback = '회원') {
  return cleanText(value, 40) || fallback;
}

export function quotedTitle(value) {
  return `“${cleanText(value, 34) || '제목 없는 게시물'}”`;
}

export function commentPreview(comment) {
  const preview = cleanText(comment?.body || comment?.content || '', 52);
  return preview ? ` “${preview}”` : '';
}

export function decodeFirestoreValue(value) {
  if (!value || typeof value !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(value, 'nullValue')) return null;
  if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) return value.stringValue;
  if (Object.prototype.hasOwnProperty.call(value, 'booleanValue')) return value.booleanValue;
  if (Object.prototype.hasOwnProperty.call(value, 'integerValue')) return Number(value.integerValue);
  if (Object.prototype.hasOwnProperty.call(value, 'doubleValue')) return Number(value.doubleValue);
  if (Object.prototype.hasOwnProperty.call(value, 'timestampValue')) return value.timestampValue;
  if (Object.prototype.hasOwnProperty.call(value, 'referenceValue')) return value.referenceValue;
  if (Object.prototype.hasOwnProperty.call(value, 'geoPointValue')) return value.geoPointValue;
  if (Object.prototype.hasOwnProperty.call(value, 'bytesValue')) return value.bytesValue;
  if (Object.prototype.hasOwnProperty.call(value, 'arrayValue')) {
    return (value.arrayValue.values || []).map(decodeFirestoreValue);
  }
  if (Object.prototype.hasOwnProperty.call(value, 'mapValue')) {
    return decodeFirestoreFields(value.mapValue.fields || {});
  }
  return null;
}

export function decodeFirestoreFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)])
  );
}

export function decodeFirestoreDocument(document) {
  if (!document || !document.name) return null;
  return {
    id: document.name.split('/').pop(),
    ...decodeFirestoreFields(document.fields || {})
  };
}

export function getCommentUid(comment) {
  return comment?.uid || comment?.authorUid || '';
}

export function ownsDocument(document, uid) {
  return Boolean(uid && document && (document.uid === uid || document.authorUid === uid));
}

export function deletionNotificationRecipient(comment, actorUid) {
  const recipientUid = getCommentUid(comment);
  return recipientUid && recipientUid !== actorUid ? recipientUid : '';
}

export function isRecentTimestamp(value, now = Date.now(), maxAgeMs = 15 * 60 * 1000) {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp)
    && timestamp <= now + 60 * 1000
    && timestamp >= now - maxAgeMs;
}

export function findRootCommentId(commentId, commentsById) {
  let currentId = commentId;
  const visited = new Set();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const current = commentsById.get(currentId);
    if (!current || !current.parentId) return currentId;
    currentId = current.parentId;
  }

  return currentId || commentId;
}

export function uniqueUserIds(values, excludedUid = '') {
  return [...new Set(values.filter(Boolean))].filter((uid) => uid !== excludedUid);
}

export function pushErrorDisposition(statusCode) {
  const status = Number(statusCode || 0);
  if (status === 404 || status === 410) return 'remove';
  if (!status || status === 408 || status === 425 || status === 429 || status >= 500) return 'retry';
  return 'fail';
}
