export function cleanText(value, maxLength = 120) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function personName(value, fallback = '회원') {
  const name = cleanText(value, 40) || fallback;
  return name.endsWith('님') ? name : `${name}님`;
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

