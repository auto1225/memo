/* JustANotepad Service Worker
   - 정적 자산 캐시 (오프라인 지원)
   - 새 버전 감지 → 클라이언트에 알림
   - Network First 전략 (최신 우선, 실패시 캐시)
*/
const CACHE_VERSION = 'v1';
const CACHE_NAME = 'justanotepad-' + CACHE_VERSION;
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/logo.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('[SW] Precache 실패:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys => Promise.all(
        keys
          .filter(k => k.startsWith('justanotepad-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      ))
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 외부 도메인(API, AI 등)은 캐시하지 않음
  if (url.origin !== location.origin) return;
  // Supabase 등 외부 API 호출은 네트워크 통과
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(req)
      .then(res => {
        // HTML만 캐시 업데이트 (index.html 등)
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone).catch(() => {}));
        }
        return res;
      })
      .catch(() => caches.match(req).then(cached => cached || caches.match('/index.html')))
  );
});

// 클라이언트에서 'skipWaiting' 메시지를 보내면 즉시 활성화
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting' || event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
