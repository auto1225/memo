/**
 * justanotepad · Service Worker refresh helper
 * ---------------------------------------------
 * Service Worker 가 옛날 파일을 계속 캐시해서 새 배포가 반영 안 되는 문제를 해결.
 *
 * 전략:
 *   1. 페이지 로드 시 SW 에 update() 요청 → 바뀐 게 있으면 새 버전을 바로 설치
 *   2. 새 SW 가 waiting 상태면 자동 skipWaiting 명령 + 페이지 자동 새로고침
 *   3. lecture-mode / storage-quota-patch / 기타 앱 스크립트가 최신 버전으로
 *      보장됨 (하루 1회 체크).
 */
(() => {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  if (window.__swRefreshApplied) return;
  window.__swRefreshApplied = true;

  const DAY = 24 * 60 * 60 * 1000;
  const LAST_CHECK_KEY = 'jnp-sw-last-check';

  async function refreshSW(force = false) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;

      // update() 호출로 새 SW 다운로드 시도
      await reg.update();

      // waiting 이 있으면 즉시 activate
      if (reg.waiting) {
        console.info('[sw-refresh] new SW waiting → skipWaiting');
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        // 활성화 후 자동 새로고침
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!window.__swReloadDone) {
            window.__swReloadDone = true;
            console.info('[sw-refresh] controller changed → reload');
            location.reload();
          }
        }, { once: true });
      }

      localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
    } catch (e) { console.warn('[sw-refresh]', e); }
  }

  // 부팅 시 1회 + 24시간 간격
  const last = parseInt(localStorage.getItem(LAST_CHECK_KEY) || '0', 10);
  const shouldCheck = !last || (Date.now() - last) > DAY;
  if (shouldCheck) {
    setTimeout(() => refreshSW(), 1500);
  }

  // 수동 호출
  window.__refreshApp = () => refreshSW(true);
})();
