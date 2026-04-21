/**
 * JustANotepad - Frameless Window Patch
 * --------------------------------------------------------------------------
 * Drop-in script. Pairs with tauri.conf.json "decorations": false.
 *
 * What it does:
 *   1. Makes the yellow .topbar a native drag region (so you can move the
 *      window by dragging it, replacing the removed OS title bar).
 *   2. Wires minimize / maximize / close buttons to the Tauri window API.
 *      - Auto-discovers common selectors AND any element with
 *        `data-window-action="minimize|maximize|close"`.
 *   3. Fixes the topbar badges (#cardsTopBadge, #roleDashBadge, etc.) that
 *      were clipping outside the header — moves them inside the button.
 *   4. Adds 4px invisible edge resize handles around the window so users
 *      can resize even without OS chrome.
 *   5. In browser (non-Tauri) context this script is a no-op for window
 *      control, but still applies the badge/CSS fix safely.
 *
 * Integration: add ONE line near the end of app.html, before </body>:
 *     <script src="./frameless-patch.js"></script>
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.__justanotepadFramelessPatch__) return;
  window.__justanotepadFramelessPatch__ = true;

  // Flip to true for debugging via DevTools Console.
  const JNP_DEBUG = /[?&]jnp_debug=1\b/.test(location.search);
  const isTauri = !!(window.__TAURI__ || window.__TAURI_INTERNALS__);
  // Any native wrapper (Tauri desktop, Capacitor mobile, generic webview).
  // When true, the yellow .pad card should fill the entire viewport and the
  // close-button plumbing needs to hit native APIs instead of window.close().
  const isCapacitor = !!(window.Capacitor || window.capacitorBridge);
  const isStandalonePWA = (typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches);
  const isNativeWrapper = isTauri || isCapacitor ||
    (typeof navigator !== 'undefined' && / wv\)/.test(navigator.userAgent));
  // Verbose diagnostic so we can see what's going on from the user side
  try {
    JNP_DEBUG && console.log('[JNP-FRAMELESS] boot',
      { isTauri,
        hasTauri: !!window.__TAURI__,
        hasInternals: !!window.__TAURI_INTERNALS__,
        tauriKeys: window.__TAURI__ ? Object.keys(window.__TAURI__) : [],
        ua: navigator.userAgent.slice(0,60) });
  } catch (e) {}

  // ---- CSS overrides (injected once) ---------------------------------
  //
  // OS-parity notes:
  //   - The html/body background becomes transparent in Tauri so the window's
  //     rounded corners (12px) show through uniformly on Windows/macOS/Linux.
  //     On the web (non-Tauri) context we skip this so the page still has its
  //     normal background.
  //   - Radius is applied via CSS and matches across all platforms because the
  //     underlying window has `transparent: true` and no decorations.
  //
  // Windows 11 auto-rounds undecorated windows; we skip CSS radius to avoid
  // the "transparent+decorations:false" combo that Windows 11 handles badly.
  const css = `
    /* Kill the default 8px body margin (and any padding) INSIDE the Tauri
       shell. Without this, the solid white window backgroundColor bleeds
       around the app's yellow header and looks like an external frame.
       On the web / PWA we leave the browser defaults alone. */
    html.jnp-tauri, html.jnp-tauri body {
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden;
      min-height: 100vh;
      background: transparent;
    }
    /* The app's main container .pad is hard-coded to 480px wide + 24px
       inset. In the desktop shell we override it to fill the whole window
       so no dead white space appears around the content. */
    html.jnp-tauri .pad,
    html.jnp-tauri #pad {
      position: static !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      max-width: 100vw !important;
      height: 100vh !important;
      min-height: 100vh !important;
      border-radius: 0 !important;
      box-shadow: none !important;
    }

    /* Make the topbar act as the title bar */
    #topbar, .topbar {
      -webkit-app-region: drag;
      app-region: drag;
      cursor: default;
      padding-right: 14px;
    }
    /* Anything interactive inside must opt-out of drag */
    #topbar button,
    #topbar input,
    #topbar select,
    #topbar a,
    #topbar [role="button"],
    .topbar button,
    .topbar input,
    .topbar select,
    .topbar a,
    .topbar [role="button"] {
      -webkit-app-region: no-drag;
      app-region: no-drag;
    }
    /* Pull badges INSIDE the button so they never clip on the window edge */
    .topbar-badge {
      top: 2px !important;
      right: 2px !important;
    }
    /* Invisible edge resize handles (only meaningful inside Tauri) */
    .jnp-resize-handle {
      position: fixed; z-index: 2147483600;
      -webkit-app-region: no-drag; app-region: no-drag;
    }
    .jnp-resize-handle.n  { top: 0;    left: 6px;  right: 6px;  height: 4px; cursor: ns-resize; }
    .jnp-resize-handle.s  { bottom: 0; left: 6px;  right: 6px;  height: 4px; cursor: ns-resize; }
    .jnp-resize-handle.e  { top: 6px;  right: 0;   bottom: 6px; width: 4px;  cursor: ew-resize; }
    .jnp-resize-handle.w  { top: 6px;  left: 0;    bottom: 6px; width: 4px;  cursor: ew-resize; }
    .jnp-resize-handle.ne { top: 0;    right: 0;   width: 8px;  height: 8px; cursor: nesw-resize; }
    .jnp-resize-handle.nw { top: 0;    left: 0;    width: 8px;  height: 8px; cursor: nwse-resize; }
    .jnp-resize-handle.se { bottom: 0; right: 0;   width: 8px;  height: 8px; cursor: nwse-resize; }
    .jnp-resize-handle.sw { bottom: 0; left: 0;    width: 8px;  height: 8px; cursor: nesw-resize; }
  `;
  const styleEl = document.createElement('style');
  styleEl.setAttribute('data-jnp-frameless', '');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ---- Tauri window helpers ------------------------------------------
  function getWin() {
    if (!isTauri) return null;
    const w = window.__TAURI__ && window.__TAURI__.window;
    if (!w) return null;
    // Tauri v2
    if (typeof w.getCurrentWindow === 'function') return w.getCurrentWindow();
    // Tauri v1 fallback
    if (typeof w.getCurrent === 'function') return w.getCurrent();
    if (w.appWindow) return w.appWindow;
    return null;
  }

  const actions = {
    minimize: (win) => win && win.minimize && win.minimize(),
    maximize: async (win) => {
      if (!win) return;
      if (typeof win.toggleMaximize === 'function') return win.toggleMaximize();
      if (typeof win.isMaximized === 'function') {
        const max = await win.isMaximized();
        return max ? win.unmaximize() : win.maximize();
      }
      return win.maximize && win.maximize();
    },
    close: (win) => win && win.close && win.close(),
  };

  // ---- Runtime frameless enforcement ---------------------------------
  //
  // Even if the installed Tauri binary was built with `decorations: true`
  // (older versions), we can flip it off at runtime here. This means the
  // user does NOT need to reinstall the desktop app for the outer OS frame
  // to disappear — restarting the app is enough, because the app loads
  // this file fresh from the web on every launch.
  //
  async function enforceFrameless() {
    const win = getWin();
    JNP_DEBUG && console.log('[JNP-FRAMELESS] enforceFrameless() — win=', !!win,
      win ? 'methods=' + Object.keys(Object.getPrototypeOf(win) || {}).slice(0, 15) : '');
    if (!win) {
      // Fallback: try direct invoke of window commands
      try {
        const invoke = window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke;
        if (invoke) {
          JNP_DEBUG && console.log('[JNP-FRAMELESS] trying invoke fallback');
          await invoke('plugin:window|set_decorations', { label: 'main', value: false });
        }
      } catch (e) { JNP_DEBUG && console.warn('[JNP-FRAMELESS] invoke fallback failed:', e && e.message); }
      return;
    }
    try {
      if (typeof win.setDecorations === 'function') {
        JNP_DEBUG && console.log('[JNP-FRAMELESS] calling setDecorations(false)');
        await win.setDecorations(false);
        JNP_DEBUG && console.log('[JNP-FRAMELESS] setDecorations OK');
      } else {
        JNP_DEBUG && console.warn('[JNP-FRAMELESS] win.setDecorations not a function');
      }
    } catch (e) { JNP_DEBUG && console.warn('[JNP-FRAMELESS] setDecorations failed:', e && e.message); }
    try {
      if (typeof win.setShadow === 'function') {
        await win.setShadow(true);
      }
    } catch (e) { /* noop */ }
  }

  // ---- Wire up buttons -----------------------------------------------
  const selectorMap = {
    minimize: [
      '[data-window-action="minimize"]',
      '#tbMinBtn', '#minBtn', '#winMinimize', '.win-min', '.btn-min', '.minimize-btn',
    ],
    maximize: [
      '[data-window-action="maximize"]',
      '#tbMaxBtn', '#maxBtn', '#winMaximize', '.win-max', '.btn-max', '.maximize-btn',
    ],
    close: [
      '[data-window-action="close"]',
      '#tbCloseBtn', '#closeBtn', '#winClose', '.win-close', '.btn-close', '.close-btn',
    ],
  };

  function bindControls() {
    const win = getWin();
    if (!win) return; // non-Tauri context
    Object.keys(selectorMap).forEach((kind) => {
      const seen = new Set();
      for (const sel of selectorMap[kind]) {
        document.querySelectorAll(sel).forEach((el) => {
          if (seen.has(el)) return;
          seen.add(el);
          // Avoid double-binding
          if (el.dataset.jnpBound === '1') return;
          el.dataset.jnpBound = '1';
          el.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            Promise.resolve(actions[kind](win)).catch(() => {});
          });
        });
      }
    });
  }

  // ---- Capture-phase override of in-app close/min buttons ------------
  //
  // app.html's own handlers call window.close() (doesn't work in Tauri
  // WebView2) and toggle a CSS class (doesn't minimize the OS window).
  // We intercept the click BEFORE the app's handler runs and route it
  // to the real Tauri window API instead. Works for every future
  // version of the app without touching its own code.
  //
  function installCaptureOverrides() {
    if (!isTauri) return;

    // Try every known path to close the current window. Whichever one the
    // runtime exposes will win. Returns a report array for on-screen display.
    async function forceCloseWindow(trigger) {
      const T = window.__TAURI__ || {};
      const C = window.Capacitor;

      // ── 포스트잇 보호 가드 ──
      // 데스크톱 포스트잇이 하나라도 열려 있으면, 메인 창은 hide 만 하고
      // 프로세스는 유지. 이렇게 해야 커스텀 X 가 invoke/event/process-exit
      // 어떤 경로를 타도 포스트잇이 같이 죽지 않는다.
      try {
        let hasPostit = false;
        try {
          const list = await (T.core && T.core.invoke && T.core.invoke('postit_list'));
          if (Array.isArray(list) && list.length > 0) hasPostit = true;
        } catch {}
        if (hasPostit) {
          try {
            const w = T.window && T.window.getCurrentWindow && T.window.getCurrentWindow();
            if (w && typeof w.hide === 'function') {
              await w.hide();
              return [{ name: 'main-hidden-to-tray (postit-guard)', ok: true }];
            }
          } catch (e) { console.warn('[postit-guard] hide failed', e); }
        }
      } catch {}

      const attempts = [
        ['T.window.getCurrentWindow().close',       async () => T.window && T.window.getCurrentWindow && T.window.getCurrentWindow().close()],
        ['T.webviewWindow.getCurrentWebviewWindow().close', async () => T.webviewWindow && T.webviewWindow.getCurrentWebviewWindow && T.webviewWindow.getCurrentWebviewWindow().close()],
        ['T.window.getCurrent().close',             async () => T.window && T.window.getCurrent && T.window.getCurrent().close()],
        ['T.core.invoke plugin:webview|close',      async () => T.core && T.core.invoke && T.core.invoke('plugin:webview|close', { label: 'main' })],
        ['T.core.invoke plugin:window|close',       async () => T.core && T.core.invoke && T.core.invoke('plugin:window|close', { label: 'main' })],
        ['T.core.invoke force_quit (custom cmd)',   async () => T.core && T.core.invoke && T.core.invoke('force_quit')],
        ['T.invoke force_quit (direct)',            async () => T.invoke && T.invoke('force_quit')],
        ['T.event.emit jnp://force-quit',           async () => T.event && T.event.emit && T.event.emit('jnp://force-quit')],
        ['T.process.exit(0)',                       async () => T.process && T.process.exit && T.process.exit(0)],
        ['Capacitor App.exitApp',                   async () => C && C.Plugins && C.Plugins.App && C.Plugins.App.exitApp && C.Plugins.App.exitApp()],
        ['Capacitor App.minimizeApp',               async () => C && C.Plugins && C.Plugins.App && C.Plugins.App.minimizeApp && C.Plugins.App.minimizeApp()],
      ];
      const report = [];
      for (const [name, fn] of attempts) {
        try {
          const ret = await fn();
          report.push({ name, ok: true, ret: ret === undefined ? '—' : String(ret).slice(0, 40) });
        } catch (e) {
          report.push({ name, ok: false, err: (e && e.message ? e.message : String(e)).slice(0, 60) });
        }
      }
      return report;
    }
    window.jnpCloseNow = () => forceCloseWindow('manual');

    // Replace the app's closeBtn handler entirely. cloneNode strips all
    // existing listeners; we then add a single listener that calls
    // forceCloseWindow directly. No window.close() involvement at all.
    function rebindCloseBtn() {
      const btn = document.getElementById('closeBtn');
      if (!btn || btn.dataset.jnpRebound === '1') return;
      const fresh = btn.cloneNode(true);
      fresh.dataset.jnpRebound = '1';
      btn.parentNode.replaceChild(fresh, btn);
      fresh.addEventListener('click', async () => {
        // X 버튼은 즉시 동작.
        // - 포스트잇 있으면: 메인 창만 hide 하고 프로세스 유지 (포스트잇 보존)
        // - 포스트잇 없으면: forceCloseWindow → 프로세스 종료 가능
        //
        // ⚠ 과거엔 window.confirm() 다이얼로그로 먼저 묻고 OK 때만 hide 했는데,
        // Tauri v2 WebView2 에서 confirm 이 blocking 되면 아무 반응 없이
        // "X 버튼이 안 눌린다" 는 버그처럼 보였음. 다이얼로그 제거하고 즉시 동작.
        // 대신 트레이 알림 토스트로 사용자에게 피드백.
        const T = window.__TAURI__ || {};

        // Tauri invoke 는 network 보다 느릴 때가 있어 timeout 으로 감싼다.
        // 1초 안에 응답 없으면 "포스트잇 없다" 로 간주 → 정상 종료 시도.
        const withTimeout = (p, ms, fallback) => Promise.race([
          p,
          new Promise(r => setTimeout(() => r(fallback), ms)),
        ]);

        let hasPostit = false;
        try {
          const list = await withTimeout(
            (T.core && T.core.invoke) ? T.core.invoke('postit_list') : Promise.resolve(null),
            1000,
            null
          );
          hasPostit = Array.isArray(list) && list.length > 0;
        } catch {}

        if (hasPostit) {
          // 단순 hide 로 끝 — 다이얼로그 없음
          try {
            const w = T.window && T.window.getCurrentWindow && T.window.getCurrentWindow();
            if (w && typeof w.hide === 'function') {
              await w.hide();
              // 사용자가 "뭐 일어났지?" 안 되도록 작은 알림 (Tauri notification API)
              try {
                const N = T.notification;
                if (N && N.sendNotification) {
                  N.sendNotification({
                    title: 'JustANotepad',
                    body: '트레이로 숨김. 포스트잇은 유지됩니다.',
                  });
                }
              } catch {}
              return;
            }
          } catch (e) { console.warn('[X btn] hide 실패', e); }
          // hide 실패 → forceCloseWindow 로 fallback
        }

        // 포스트잇 없거나 hide 실패 → 정상 종료 시도
        const report = await forceCloseWindow('X btn');
        // 500ms 안에 앱이 없어지지 않으면 — 진단 표시
        setTimeout(() => {
          if (document.hidden) return;
          const tauriKeys = Object.keys(T).sort().join(', ') || '(none)';
          const windowKeys = T.window ? Object.keys(T.window).sort().join(', ') : '(no T.window)';
          const lines = report.map(r =>
            (r.ok ? '✓ ' : '✗ ') + r.name + (r.err ? '  → ' + r.err : (r.ret ? '  → ok' : ''))
          ).join('\n');
          console.warn('[X btn] 창 닫기 실패 진단:\n' +
            '__TAURI__ keys: ' + tauriKeys + '\n' +
            '__TAURI__.window keys: ' + windowKeys + '\n' +
            lines);
          // console 에만 로그. 모달 alert 은 또 사용자 gesture 필요라 생략.
        }, 500);
      });
    }
    rebindCloseBtn();
    // Some UI paths render the topbar late; retry once.
    setTimeout(rebindCloseBtn, 1500);

    // Also nuke window.close — if anything in app.html still calls it,
    // route to the same path.
    window.close = () => forceCloseWindow('window.close shim');

    // Ctrl+Q escape hatch in case every UI button is borked.
    window.addEventListener('keydown', (e) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && (e.key === 'q' || e.key === 'Q')) {
        e.preventDefault();
        forceCloseWindow('Ctrl+Q');
      }
    });

    // Real OS-level minimize when the in-app minimize button is pressed.
    // app.html only toggles a CSS class; we also minimize the OS window.
    const minBtn = document.getElementById('minBtn');
    if (minBtn && !minBtn.dataset.jnpMinBound) {
      minBtn.dataset.jnpMinBound = '1';
      minBtn.addEventListener('click', () => {
        const T = window.__TAURI__ || {};
        try { T.window && T.window.getCurrentWindow && T.window.getCurrentWindow().minimize(); } catch {}
      });
    }
  }

  // ---- Drag region ----------------------------------------------------
  function markDragRegion() {
    const bar = document.getElementById('topbar') || document.querySelector('.topbar');
    if (!bar) return;
    bar.setAttribute('data-tauri-drag-region', '');

    // Uniform double-click-to-maximize across all OSes.
    // macOS users expect this; Windows/Linux users expect it for AeroSnap-like
    // behavior. Implementing it here guarantees identical behavior everywhere.
    if (!bar.dataset.jnpDblBound) {
      bar.dataset.jnpDblBound = '1';
      bar.addEventListener('dblclick', (e) => {
        // Ignore double-clicks that land on interactive children
        if (e.target.closest('button, input, select, a, [role="button"]')) return;
        const win = getWin();
        if (!win) return;
        actions.maximize(win);
      });
    }
  }

  // ---- Resize handles -------------------------------------------------
  function installResizeHandles() {
    if (!isTauri) return;
    if (document.querySelector('.jnp-resize-handle')) return;
    const win = getWin();
    if (!win || typeof win.startResizeDragging !== 'function') {
      // Best-effort API detection; if unavailable, try ResizeDirection enum path
    }

    const dirs = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
    const map = {
      n: 'North', s: 'South', e: 'East', w: 'West',
      ne: 'NorthEast', nw: 'NorthWest', se: 'SouthEast', sw: 'SouthWest',
    };
    dirs.forEach((d) => {
      const el = document.createElement('div');
      el.className = 'jnp-resize-handle ' + d;
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const w = getWin();
        if (!w) return;
        // Tauri v2 API
        if (typeof w.startResizeDragging === 'function') {
          w.startResizeDragging(map[d]).catch(() => {});
        }
      });
      document.body.appendChild(el);
    });
  }

  // ---- Postit-window helpers -----------------------------------------
  // Postits open at ?mode=postit and have no OS chrome. Give them an
  // escape hatch: Esc or Ctrl+W closes the current window.
  function installPostitShortcuts() {
    const isPostit = /(\?|&)mode=postit\b/.test(location.search);
    if (!isPostit || !isTauri) return;
    window.addEventListener('keydown', (e) => {
      const wantsClose =
        e.key === 'Escape' ||
        (e.key === 'w' && (e.ctrlKey || e.metaKey));
      if (!wantsClose) return;
      e.preventDefault();
      const win = getWin();
      if (win && typeof win.close === 'function') {
        win.close().catch(() => {});
      }
    });
  }

  // ---- Boot -----------------------------------------------------------
  function init() {
    // Apply full-viewport layout on ANY native wrapper — Tauri desktop,
    // Capacitor Android/iOS, or standalone PWA. All share the same .pad
    // problem: it's hard-coded to 480px with a 24px inset, which shows
    // as white frame on every native wrapper that gives the page a
    // larger viewport.
    if (isNativeWrapper || isStandalonePWA) {
      document.documentElement.classList.add('jnp-tauri');
      document.documentElement.classList.add('jnp-native');
    }
    if (isTauri) {
      enforceFrameless();
    }

    markDragRegion();
    bindControls();
    installCaptureOverrides();
    installResizeHandles();
    installPostitShortcuts();

    // Re-bind on DOM mutations for dynamically-inserted buttons (rare but safe)
    const mo = new MutationObserver(() => { bindControls(); markDragRegion(); });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
