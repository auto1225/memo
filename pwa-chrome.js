/**
 * JustANotepad - PWA Chrome Enhancer
 * --------------------------------------------------------------------------
 * Drop-in script. Handles the browser-chrome problem on the web:
 *
 *   1. Shows a small "앱으로 설치" button whenever the PWA is installable
 *      (listens to `beforeinstallprompt`). One click → native browser prompt.
 *   2. Adds a fullscreen toggle (F11 key or Cmd+Ctrl+F) that uses the
 *      Fullscreen API to hide browser UI entirely. Works cross-OS.
 *   3. When running in Window Controls Overlay mode (`display-mode:
 *      window-controls-overlay`), extends the yellow `.topbar` into the OS
 *      title-bar area by honoring `env(titlebar-area-*)` insets. Also marks
 *      that region as draggable (`-webkit-app-region: drag`) so users can
 *      move the PWA window by dragging the header.
 *   4. Adds a "명령 팔레트" entry for toggling fullscreen (if the command
 *      palette is loaded).
 *   5. No-op inside Tauri desktop app (there it would conflict with the
 *      native frameless logic in frameless-patch.js).
 *
 * Integration: this file is auto-loaded by app.html.
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.__jnpPwaChrome__) return;
  window.__jnpPwaChrome__ = true;

  // Skip entirely when running inside the Tauri desktop shell — the native
  // frameless logic owns the window in that environment.
  if (window.__TAURI__ || window.__TAURI_INTERNALS__) return;

  // -------------------------------------------------------------------
  // Detection helpers
  // -------------------------------------------------------------------
  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    // iOS Safari
    (typeof navigator !== 'undefined' && navigator.standalone === true);

  const isWCO = () =>
    window.matchMedia('(display-mode: window-controls-overlay)').matches;

  // -------------------------------------------------------------------
  // CSS (injected once)
  // -------------------------------------------------------------------
  const CSS = `
    /* Window Controls Overlay: let the yellow header extend into the OS
       title-bar region and stay draggable. Applies only in PWA WCO mode. */
    @media (display-mode: window-controls-overlay) {
      #topbar, .topbar {
        padding-top: env(titlebar-area-y, 8px) !important;
        padding-left: calc(env(titlebar-area-x, 0px) + 10px) !important;
        padding-right: calc(100% - env(titlebar-area-width, 100%) - env(titlebar-area-x, 0px) + 14px) !important;
        -webkit-app-region: drag;
        app-region: drag;
      }
      #topbar button, #topbar input, #topbar select, #topbar a,
      .topbar button, .topbar input, .topbar select, .topbar a {
        -webkit-app-region: no-drag;
        app-region: no-drag;
      }
    }

    /* Install prompt bubble (auto-dismisses, never blocks content) */
    .jnp-install-bubble {
      position: fixed; right: 16px; bottom: 16px; z-index: 2147483500;
      display: flex; align-items: center; gap: 10px;
      background: #222; color: #fff; border-radius: 10px;
      padding: 10px 12px 10px 14px; box-shadow: 0 10px 28px rgba(0,0,0,.35);
      font: 500 13px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI",
             "Apple SD Gothic Neo", "Noto Sans KR", Roboto, sans-serif;
      transform: translateY(8px); opacity: 0;
      transition: transform 160ms ease, opacity 160ms ease;
      max-width: 320px;
    }
    .jnp-install-bubble.show { transform: translateY(0); opacity: 1; }
    .jnp-install-bubble .jnp-ib-text strong { display:block; margin-bottom:2px; }
    .jnp-install-bubble .jnp-ib-text small { color:#bbb; font-size:11px; }
    .jnp-install-bubble button {
      border: 0; border-radius: 7px; padding: 7px 12px; cursor: pointer;
      font: inherit; font-weight: 600;
    }
    .jnp-ib-install { background: #FAE100; color: #222; }
    .jnp-ib-close { background: transparent; color: #aaa; padding: 6px 8px; }
    .jnp-ib-close:hover { color: #fff; }
  `;
  const style = document.createElement('style');
  style.setAttribute('data-jnp-pwa-chrome', '');
  style.textContent = CSS;
  document.head.appendChild(style);

  // -------------------------------------------------------------------
  // Install prompt handling
  // -------------------------------------------------------------------
  let deferredPrompt = null;
  let bubbleEl = null;

  const INSTALL_DISMISSED_KEY = 'jnp:installDismissedAt';
  const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

  function wasRecentlyDismissed() {
    try {
      const at = Number(localStorage.getItem(INSTALL_DISMISSED_KEY) || 0);
      return at && Date.now() - at < DISMISS_COOLDOWN_MS;
    } catch { return false; }
  }

  function rememberDismissal() {
    try { localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now())); } catch {}
  }

  function showInstallBubble() {
    if (bubbleEl || !deferredPrompt) return;
    if (isStandalone()) return;
    if (wasRecentlyDismissed()) return;

    bubbleEl = document.createElement('div');
    bubbleEl.className = 'jnp-install-bubble';
    bubbleEl.innerHTML = `
      <div class="jnp-ib-text">
        <strong>앱으로 설치</strong>
        <small>브라우저 창 없이 독립 앱으로 사용하기</small>
      </div>
      <button class="jnp-ib-install" type="button">설치</button>
      <button class="jnp-ib-close" type="button" aria-label="닫기">✕</button>
    `;
    document.body.appendChild(bubbleEl);
    requestAnimationFrame(() => bubbleEl.classList.add('show'));

    bubbleEl.querySelector('.jnp-ib-install').addEventListener('click', async () => {
      if (!deferredPrompt) return;
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') hideInstallBubble();
      } catch { /* ignore */ }
      deferredPrompt = null;
    });

    bubbleEl.querySelector('.jnp-ib-close').addEventListener('click', () => {
      rememberDismissal();
      hideInstallBubble();
    });
  }

  function hideInstallBubble() {
    if (!bubbleEl) return;
    bubbleEl.classList.remove('show');
    const el = bubbleEl;
    bubbleEl = null;
    setTimeout(() => el.remove(), 200);
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Give the user a moment before nudging them.
    setTimeout(showInstallBubble, 3000);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallBubble();
  });

  // -------------------------------------------------------------------
  // Fullscreen toggle (F11 on Windows/Linux, F11 or ⌃⌘F on macOS)
  // -------------------------------------------------------------------
  function toggleFullscreen() {
    const doc = document;
    const el = document.documentElement;
    const isFs = doc.fullscreenElement || doc.webkitFullscreenElement;
    if (isFs) {
      (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
    } else {
      (el.requestFullscreen || el.webkitRequestFullscreen).call(el).catch(() => {});
    }
  }

  window.addEventListener('keydown', (e) => {
    // F11
    if (e.key === 'F11') {
      e.preventDefault();
      toggleFullscreen();
      return;
    }
    // macOS: Ctrl+Cmd+F (matches system "Enter Full Screen")
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    if (isMac && e.ctrlKey && e.metaKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      toggleFullscreen();
    }
  });

  // -------------------------------------------------------------------
  // Register commands with the command palette (if loaded)
  // -------------------------------------------------------------------
  function registerPaletteActions() {
    const pal = window.justanotepadPalette;
    if (!pal || typeof pal.register !== 'function') return;

    pal.register({
      id: 'fullscreen-toggle',
      title: '전체화면 전환',
      hint: 'F11 — 브라우저 UI 숨기기',
      keywords: ['fullscreen', 'f11', '전체화면', '풀스크린'],
      run: () => toggleFullscreen(),
    });

    pal.register({
      id: 'install-as-app',
      title: '앱으로 설치 (PWA)',
      hint: '브라우저 창 없이 독립 앱으로 실행',
      keywords: ['install', 'pwa', '설치', '앱'],
      run: async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          try { await deferredPrompt.userChoice; } catch {}
          deferredPrompt = null;
        } else if (isStandalone()) {
          alert('이미 앱으로 실행 중입니다.');
        } else {
          alert(
            '브라우저 주소창의 설치 아이콘을 눌러 앱으로 설치할 수 있어요.\n' +
            '(Chrome/Edge 기준: 주소창 오른쪽 + 아이콘)'
          );
        }
      },
    });
  }

  // Palette may load after us (type="module"); poll briefly.
  let tries = 0;
  const regTimer = setInterval(() => {
    if (window.justanotepadPalette || ++tries > 40) {
      clearInterval(regTimer);
      registerPaletteActions();
    }
  }, 250);
})();
