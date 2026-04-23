/* JustANotepad Service Worker v2
   - HTML / JS / CSS 는 절대 캐시 안 함 (항상 fresh)
   - 이미지·폰트 등 바이너리만 네트워크 first + 캐시 폴백 (오프라인 지원)
   - 활성화 시 기존 캐시 전부 비움 (옛 HTML/JS 제거)
*/
const CACHE_VERSION = 'v2-no-code-cache';
const CACHE_NAME = 'justanotepad-' + CACHE_VERSION;

self.addEventListener('install', (event) => {
  // 새 SW 즉시 활성화 — 옛 SW 가 잡고 있는 캐시 빨리 정리
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // 옛 버전 캐시 전부 삭제
      caches.keys().then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )),
      // 활성화 시 모든 열린 클라이언트에 핫리로드 힌트
      self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
        clients.forEach(c => {
          try { c.postMessage({ type: 'JAN_RELOAD_HINT', ts: Date.now() }); } catch {}
        });
      })
    ])
  );
});

// 코드 (HTML/JS/CSS) 는 절대 캐시 안 함 → 새 배포가 즉시 반영
// 자산 (이미지/폰트) 은 네트워크 first + 실패 시 캐시 (오프라인 폴백)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  const isCode = /\.(html?|js|css|mjs|json)(\?|$)/.test(url.pathname) ||
                 url.pathname === '/app' ||
                 url.pathname === '/';
  if (isCode) {
    // 캐시 건너뛰고 항상 네트워크. 실패해도 옛 HTML 대신 그냥 에러 — 재시도 유도.
    event.respondWith(fetch(req, { cache: 'no-store' }).catch(() =>
      new Response('Offline', { status: 503, statusText: 'Offline' })
    ));
    return;
  }

  // 자산: 네트워크 first, 실패 시 캐시
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone).catch(() => {}));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting' || event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  // 클라이언트가 보내는 캐시 비움 요청
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
