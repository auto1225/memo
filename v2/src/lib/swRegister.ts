/**
 * Phase 7 — Service Worker 등록.
 * 앱 부팅 시 호출. /v2/sw-v2.js 를 / scope 으로 등록.
 */
export function registerV2ServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  if (location.hostname === 'localhost' && location.protocol !== 'https:') {
    // 로컬 개발 모드 — SW 비활성
    return
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/v2/sw-v2.js', { scope: '/v2/' })
      .then((reg) => {
        // 새 버전 감지 시 자동 활성화
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing
          if (!nw) return
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              nw.postMessage({ type: 'JAN_SKIP_WAITING' })
            }
          })
        })
      })
      .catch((e) => console.warn('[SW v2] register failed', e))
  })
}
