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

  const isTauri = !!(window.__TAURI__ || window.__TAURI_INTERNALS__);

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
  const WIN_RADIUS = 12;
  const css = `
    /* Unified rounded window corners on all OSes (Tauri context only) */
    html.jnp-tauri, html.jnp-tauri body {
      background: transparent !important;
    }
    html.jnp-tauri body {
      border-radius: ${WIN_RADIUS}px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.18);
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
    if (!win) return;
    try {
      if (typeof win.setDecorations === 'function') {
        await win.setDecorations(false);
      }
    } catch (e) { /* platform may refuse; ignore */ }
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
    installResizeHandles();

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
