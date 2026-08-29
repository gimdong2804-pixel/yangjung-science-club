const CACHE_NAME = 'yangjung-science-club-v37';
const NOTIFICATION_AUTH_CACHE = 'yangjung-notification-auth-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

function normalizeNotificationData(data = {}) {
  return {
    notificationId: String(data.notificationId || ''),
    recipientUid: String(data.recipientUid || ''),
    type: String(data.type || 'notice'),
    title: String(data.title || '양중과학동아리'),
    body: String(data.body || '새 알림이 있어요.'),
    target: String(data.target || 'community'),
    postId: String(data.postId || ''),
    commentId: String(data.commentId || ''),
    buildNumber: String(data.buildNumber || '')
  };
}

function notificationAuthRequest() {
  return new Request(new URL('__notification_auth__', self.registration.scope).href);
}

async function setNotificationAuthUid(uid) {
  const cache = await caches.open(NOTIFICATION_AUTH_CACHE);
  if (!uid) {
    await cache.delete(notificationAuthRequest());
    return;
  }
  await cache.put(notificationAuthRequest(), new Response(String(uid)));
}

async function getNotificationAuthUid() {
  const cache = await caches.open(NOTIFICATION_AUTH_CACHE);
  const response = await cache.match(notificationAuthRequest());
  return response ? response.text() : '';
}

self.addEventListener('message', event => {
  if (!event.data || event.data.type !== 'SET_NOTIFICATION_AUTH_STATE') return;
  event.waitUntil(setNotificationAuthUid(event.data.uid || ''));
});

self.addEventListener('push', event => {
  if (!event.data) return;

  event.waitUntil((async () => {
    let rawData;
    try {
      rawData = event.data.json();
    } catch {
      rawData = { body: event.data.text() };
    }

    const data = normalizeNotificationData(rawData);
    const loggedInUid = await getNotificationAuthUid();
    if (!loggedInUid || (data.recipientUid && data.recipientUid !== loggedInUid)) return;

    const windowClients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    const focusedClient = windowClients.find(client => client.visibilityState === 'visible' && client.focused);

    if (focusedClient) {
      focusedClient.postMessage({
        type: 'SHOW_SITE_NOTIFICATION',
        notification: data
      });
      return;
    }

    const iconUrl = new URL('logo-192.png', self.registration.scope).href;
    await self.registration.showNotification(data.title, {
      body: data.body,
      icon: iconUrl,
      badge: iconUrl,
      tag: data.notificationId || undefined,
      renotify: false,
      data
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const notification = normalizeNotificationData(event.notification.data || {});

  event.waitUntil((async () => {
    const loggedInUid = await getNotificationAuthUid();
    if (!loggedInUid || (notification.recipientUid && notification.recipientUid !== loggedInUid)) return;

    const windowClients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    const existingClient = windowClients.find(client => client.url.startsWith(self.registration.scope));
    if (existingClient) {
      await existingClient.focus();
      existingClient.postMessage({
        type: 'OPEN_NOTIFICATION_TARGET',
        notification
      });
      return;
    }

    const targetUrl = new URL('index.html', self.registration.scope);
    targetUrl.searchParams.set('notificationType', notification.type);
    targetUrl.searchParams.set('notificationTarget', notification.target);
    if (notification.recipientUid) targetUrl.searchParams.set('notificationRecipient', notification.recipientUid);
    if (notification.postId) targetUrl.searchParams.set('notificationPost', notification.postId);
    if (notification.commentId) targetUrl.searchParams.set('notificationComment', notification.commentId);
    if (notification.buildNumber) targetUrl.searchParams.set('notificationBuild', notification.buildNumber);
    await self.clients.openWindow(targetUrl.href);
  })());
});

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.map(cacheName => {
        if (cacheName !== CACHE_NAME && cacheName !== NOTIFICATION_AUTH_CACHE) {
          return caches.delete(cacheName);
        }
        return undefined;
      })
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).then(response => {
      if (response && response.status === 200) {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});

