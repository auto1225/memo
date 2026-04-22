/**
 * justanotepad · Service Worker refresh helper (v2)
 * ---------------------------------------------
 * Service Worker 가 옛날 파일을 계속 캐시해서 새 배포가 반영 안 되는 문제를 해결.
 *
 * 전략:
 *   1. 페이지 로드 시마다 SW 에 update() 요청 → 서버에 변경이 있으면 새 버전 설치
 *      (활성 앱에서도 최신 배포 반영)
 *   2. 새 SW 가 waiting 상태면 자동 skipWaiting 명령 + 페이지 자동 새로고침
 *   3. Command Palette 에 "앱 강제 업데이트" / "캐시 비우고 새로고침" 등록
 *   4. 기존 24h interval throttle 제거 — 매 로드마다 확인. 네트워크 비용 미미.
 */
(() => {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  if (window.__swRefreshApplied) return;
  window.__swRefreshApplied = true;

  async function refreshSW(force = false) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return false;

      await reg.update();

      if (reg.waiting) {
        console.info('[sw-refresh] new SW waiting → skipWaiting');
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!window.__swReloadDone) {
            window.__swReloadDone = true;
            console.info('[sw-refresh] controller changed → reload');
            location.reload();
          }
        }, { once: true });
        return true;
      }
      return false;
    } catch (e) { console.warn('[sw-refresh]', e); return false; }
  }

  // 캐시 전체 비우고 새로고침 — "강제 업데이트" 시도에도 안 될 때의 최후 수단
  async function hardReset() {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
        console.info('[sw-refresh] cache cleared:', keys.length);
      }
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) { await reg.unregister(); console.info('[sw-refresh] SW unregistered'); }
    } catch (e) { console.warn('[sw-refresh hardReset]', e); }
    location.reload();
  }

  // 매 로드마다 체크 (페이지 열자마자 1.5초 후)
  setTimeout(() => refreshSW(), 1500);

  // 수동 호출 API
  window.__refreshApp = () => refreshSW(true);
  window.__hardResetApp = () => hardReset();

  // Command Palette 등록
  function registerCommands() {
    const attempt = () => {
      // COMMANDS 배열이 있으면 거기에
      if (typeof window.COMMANDS !== 'undefined' && Array.isArray(window.COMMANDS)) {
        const has = window.COMMANDS.some(c => c && c.name === '앱 강제 업데이트');
        if (!has) {
          window.COMMANDS.push(
            { ico:'i-refresh', name:'앱 강제 업데이트', desc:'서비스 워커 갱신 + 최신 버전 반영', run: async () => {
              const did = await refreshSW(true);
              if (!did && typeof window.toast === 'function') {
                window.toast('이미 최신 버전입니다. 완전히 재설정하려면 "캐시 비우고 새로고침"을 선택하세요.');
              }
            }},
            { ico:'i-refresh', name:'캐시 비우고 새로고침', desc:'모든 캐시 삭제 후 페이지 새로고침', run: () => {
              if (confirm('모든 로컬 캐시를 삭제하고 새로고침합니다. 로컬 저장된 메모·설정은 안전합니다(캐시만 제거). 계속할까요?')) {
                hardReset();
              }
            }}
          );
        }
      }
      // justanotepadPalette 방식 (sticky-notes.js 와 같은 경로)
      const pal = window.justanotepadPalette;
      if (pal?.register) {
        pal.register({ id: 'app.refresh', title: '앱 강제 업데이트', keywords:['refresh','update','sw','reload','새로고침','업데이트'], run: async () => {
          const did = await refreshSW(true);
          if (!did && typeof window.toast === 'function') window.toast('이미 최신 버전입니다.');
        }});
        pal.register({ id: 'app.hardReset', title: '캐시 비우고 새로고침', keywords:['cache','clear','reset','new','초기화','캐시'], run: () => {
          if (confirm('모든 로컬 캐시 삭제 후 새로고침합니다. 메모는 안전합니다. 계속할까요?')) hardReset();
        }});
      }
    };
    attempt();
    setTimeout(attempt, 1500);
    setTimeout(attempt, 3500);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerCommands, { once: true });
  } else {
    registerCommands();
  }
})();
