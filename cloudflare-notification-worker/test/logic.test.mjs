import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeFirestoreDocument,
  findRootCommentId,
  personName,
  pushErrorDisposition,
  uniqueUserIds
} from '../src/logic.js';

test('같은 답글 줄의 루트 댓글을 찾는다', () => {
  const comments = new Map([
    ['root', { parentId: null }],
    ['reply-a', { parentId: 'root' }],
    ['reply-b', { parentId: 'reply-a' }]
  ]);

  assert.equal(findRootCommentId('root', comments), 'root');
  assert.equal(findRootCommentId('reply-a', comments), 'root');
  assert.equal(findRootCommentId('reply-b', comments), 'root');
});

test('답글 작성자를 제외하고 중복 수신자를 제거한다', () => {
  assert.deepEqual(uniqueUserIds(['A', 'B', 'C', 'B', 'D'], 'B'), ['A', 'C', 'D']);
});

test('Firestore REST 문서를 일반 객체로 바꾼다', () => {
  const decoded = decodeFirestoreDocument({
    name: 'projects/demo/databases/(default)/documents/posts/post-1',
    fields: {
      title: { stringValue: '실험 준비물' },
      pinned: { booleanValue: true },
      likes: { integerValue: '3' }
    }
  });

  assert.deepEqual(decoded, {
    id: 'post-1',
    title: '실험 준비물',
    pinned: true,
    likes: 3
  });
});

test('이름에는 님을 한 번만 붙인다', () => {
  assert.equal(personName('회장 김동현'), '회장 김동현님');
  assert.equal(personName('사장님'), '사장님');
});

test('일시적인 푸시 오류만 재시도하고 만료된 구독은 제거한다', () => {
  assert.equal(pushErrorDisposition(undefined), 'retry');
  assert.equal(pushErrorDisposition(429), 'retry');
  assert.equal(pushErrorDisposition(503), 'retry');
  assert.equal(pushErrorDisposition(404), 'remove');
  assert.equal(pushErrorDisposition(410), 'remove');
  assert.equal(pushErrorDisposition(403), 'fail');
});
