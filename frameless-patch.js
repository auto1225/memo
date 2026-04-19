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
    document.addEventListener('click', (e) => {
      const close = e.target.closest && e.target.closest('#closeBtn');
      if (close) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const win = getWin();
        if (win && typeof win.close === 'function') {
          win.close().catch(() => {});
        }
        return;
      }
      const min = e.target.closest && e.target.closest('#minBtn');
      if (min) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const win = getWin();
        if (win && typeof win.minimize === 'function') {
          win.minimize().catch(() => {});
        }
        return;
      }
    }, true); // capture phase — runs before any app-level listener
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
    // Only apply transparent + rounded-corner CSS inside Tauri. The web
    // version (justanotepad.com/app) keeps its normal page background.
    if (isTauri) {
      document.documentElement.classList.add('jnp-tauri');
      // Force the window to be frameless at runtime. This works even on
      // legacy binaries shipped with decorations:true.
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
