/**
 * justanotepad · JustPin Autostart UI (v1.0)
 * --------------------------------------------------------------------------
 * Tauri 환경에서 "재부팅 후 앱 없이도 JustPin 자동 복원"을 ON/OFF 하는 UI.
 *
 * 동작:
 *   1. 웹 환경이면 무시 (Tauri 전용 기능)
 *   2. JustPin이 생성되면 Rust 측이 자동시작을 자동 활성화.
 *   3. 사용자가 수동으로 토글하려면 Command Palette 에서
 *      "자동시작 켜기 / 끄기" 선택.
 *   4. 현재 상태 확인: 하단 상태바의 "자동시작: ON" 배지.
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (!window.__TAURI__) return;                    // Tauri 아닐 때 전부 패스
  if (window.__postitAutostartApplied) return;
  window.__postitAutostartApplied = true;

  const invoke = async (cmd, args) => {
    try { return await window.__TAURI__.core.invoke(cmd, args); }
    catch (e) { console.warn('[autostart invoke]', cmd, e); return null; }
  };

  async function getState() {
    const v = await invoke('autostart_get');
    return !!v;
  }
  async function setState(enabled) {
    const res = await invoke('autostart_set', { enabled });
    return !!res;
  }

  // Command Palette 등록
  function tryRegister() {
    const pal = window.justanotepadPalette;
    if (!pal?.register) return false;
    pal.register({
      id: 'postit.autostart.on',
      title: '자동시작 켜기 (재부팅해도 JustPin 유지)',
      hint: 'PC 로그인 시 백그라운드로 자동 실행됩니다',
      keywords: ['자동시작','autostart','JustPin','justpin','포스트잇','재부팅','startup'],
      run: async () => {
        const ok = await setState(true);
        if (typeof window.toast === 'function') {
          window.toast(ok ? '자동시작 ON — 이제 재부팅해도 JustPin이 그대로 뜹니다' : '자동시작 설정 실패');
        }
      }
    });
    pal.register({
      id: 'postit.autostart.off',
      title: '자동시작 끄기',
      hint: 'PC 로그인 시 자동 실행하지 않음',
      keywords: ['자동시작','autostart','끄기','off'],
      run: async () => {
        const ok = await setState(false);
        if (typeof window.toast === 'function') {
          window.toast(!ok ? '자동시작 OFF' : '자동시작 해제 실패');
        }
      }
    });
    pal.register({
      id: 'postit.autostart.status',
      title: '자동시작 상태 확인',
      run: async () => {
        const enabled = await getState();
        alert(enabled
          ? '자동시작: ON\n\n재부팅 후 PC 로그인 시 JustANotepad 가 백그라운드에서 시작되어 JustPin이 자동 복원됩니다.'
          : '자동시작: OFF\n\n재부팅 후엔 JustANotepad 를 수동으로 실행해야 JustPin이 나타납니다.'
        );
      }
    });
    return true;
  }

  // 부팅
  function boot() {
    tryRegister() || setTimeout(tryRegister, 800);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // 전역 API
  window.jnpAutostart = { get: getState, set: setState };
  console.info('[postit-autostart] ready — jnpAutostart.get()/set(true|false)');
})();
