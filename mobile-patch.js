/**
 * JustANotepad - Mobile / Capacitor Native Feel Patch
 * --------------------------------------------------------------------------
 * Makes the web app feel less "browser-ish" when loaded inside the Capacitor
 * Android/iOS shell. All web-only; no APK rebuild required.
 *
 * 1. Touch-optimized CSS: 44px+ hit targets, no text selection on UI
 *    chrome, no tap highlight, smooth momentum scrolling.
 * 2. Android hardware back button: close sidebar → close modal →
 *    go back one tab → minimize app (NOT exit).
 * 3. Disable pull-to-refresh / overscroll bounce so a stray swipe
 *    doesn't reload the webapp.
 * 4. Respect iOS notch / Android cutout via safe-area-inset padding.
 * 5. Keep the soft keyboard from pushing the whole layout up
 *    awkwardly (works with @capacitor/keyboard resize:body).
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.__jnpMobilePatch__) return;
  window.__jnpMobilePatch__ = true;

  const C = window.Capacitor;
  const isCapacitor = !!(C && C.isNativePlatform && C.isNativePlatform());
  const isIOS = isCapacitor && C.getPlatform && C.getPlatform() === 'ios';
  const isAndroid = isCapacitor && C.getPlatform && C.getPlatform() === 'android';

  if (!isCapacitor) return;

  document.documentElement.classList.add('jnp-mobile');
  if (isIOS)     document.documentElement.classList.add('jnp-ios');
  if (isAndroid) document.documentElement.classList.add('jnp-android');

  // ---- Touch-friendly CSS -------------------------------------------
  const css = `
    /* Apply only inside the Capacitor shell so desktop/web are unaffected */
    html.jnp-mobile {
      -webkit-text-size-adjust: 100%;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      overscroll-behavior: contain;
    }
    html.jnp-mobile body {
      overscroll-behavior-y: contain;
      -webkit-overflow-scrolling: touch;
    }
    /* Topbar, sidebar, tab list: no text selection / drag / context menu */
    html.jnp-mobile #topbar, html.jnp-mobile .topbar,
    html.jnp-mobile #sidebar, html.jnp-mobile .sidebar,
    html.jnp-mobile .tabs, html.jnp-mobile .tab {
      -webkit-user-select: none;
      user-select: none;
      -webkit-touch-callout: none;
    }
    /* Guarantee 44×44pt minimum tap target on every topbar button */
    html.jnp-mobile #topbar button,
    html.jnp-mobile .topbar button {
      min-width: 44px;
      min-height: 44px;
    }
    /* Sidebar items too */
    html.jnp-mobile #sidebar .item,
    html.jnp-mobile .sidebar .item {
      min-height: 44px;
      padding-top: 10px;
      padding-bottom: 10px;
    }
    /* Respect notches / cutouts */
    html.jnp-mobile #topbar, html.jnp-mobile .topbar {
      padding-top: max(8px, env(safe-area-inset-top)) !important;
    }
    html.jnp-mobile .sidebar {
      padding-top: max(8px, env(safe-area-inset-top));
      padding-bottom: max(8px, env(safe-area-inset-bottom));
    }
    /* Editor content gets bottom inset so it doesn't hide behind nav bar */
    html.jnp-mobile .pad .content,
    html.jnp-mobile #pad .content {
      padding-bottom: max(12px, env(safe-area-inset-bottom));
    }
    /* Smooth momentum scroll inside scrollable regions */
    html.jnp-mobile .scrollable,
    html.jnp-mobile .editor-scroll,
    html.jnp-mobile .sidebar > div {
      -webkit-overflow-scrolling: touch;
    }
    /* Bigger text-input font so iOS doesn't zoom in on focus */
    html.jnp-mobile input[type="text"],
    html.jnp-mobile input[type="search"],
    html.jnp-mobile input:not([type]),
    html.jnp-mobile textarea,
    html.jnp-mobile [contenteditable="true"] {
      font-size: max(16px, 1em);
    }
  `;
  const style = document.createElement('style');
  style.setAttribute('data-jnp-mobile', '');
  style.textContent = css;
  document.head.appendChild(style);

  // ---- Block page-level swipe-to-refresh ----------------------------
  // (Only when the swipe starts near the top and content is already at top.)
  let startY = 0;
  document.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (window.scrollY > 0) return;
    const y = e.touches[0].clientY;
    if (y - startY > 10) {
      // Swipe down at top — stop browser refresh behavior
      if (e.cancelable) e.preventDefault();
    }
  }, { passive: false });

  // ---- Android hardware back button ---------------------------------
  async function registerBackHandler() {
    if (!isAndroid) return;
    try {
      // @capacitor/app exposes addListener via the bridge
      const App = C.Plugins && C.Plugins.App;
      if (!App || typeof App.addListener !== 'function') return;
      App.addListener('backButton', (event) => {
        // Priority chain:
        // 1) Open modal? close it
        const modal = document.querySelector('.modal-backdrop.open, .modal.open');
        if (modal) {
          modal.classList.remove('open');
          return;
        }
        // 2) Sidebar open? close it
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
          sidebar.classList.remove('open');
          return;
        }
        // 3) Command palette / popup?
        const palette = document.querySelector('.jnp-palette-backdrop.open, .palette.open');
        if (palette) {
          palette.classList.remove('open');
          return;
        }
        // 4) At root: minimize rather than exit (preserves app state)
        if (App.minimizeApp) {
          App.minimizeApp().catch(() => {});
        } else if (event && event.canGoBack) {
          window.history.back();
        } else if (App.exitApp) {
          // last resort
          App.exitApp().catch(() => {});
        }
      });
    } catch { /* plugin unavailable */ }
  }
  registerBackHandler();

  // ---- Haptic feedback on primary buttons (optional, only if plugin) --
  try {
    const Haptics = C.Plugins && C.Plugins.Haptics;
    if (Haptics && typeof Haptics.impact === 'function') {
      document.addEventListener('click', (e) => {
        const btn = e.target && e.target.closest && e.target.closest(
          '#topbar button, .topbar button, .tab, #newNoteBtn, #sideBtn'
        );
        if (btn) {
          Haptics.impact({ style: 'Light' }).catch(() => {});
        }
      }, true);
    }
  } catch { /* noop */ }
})();
