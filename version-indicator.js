/**
 * JustANotepad - Version & Environment Indicator
 * --------------------------------------------------------------------------
 * Adds a small footer at the bottom of #sidebar showing:
 *   v1.0.6 · Desktop   (Tauri app)
 *   v1.0.6 · PWA       (installed webapp)
 *   v1.0.6 · Web       (regular browser tab)
 *
 * Desktop version is read via Tauri's app.getVersion() when available.
 * Web/PWA version is fetched from /version.json (kept in sync by release
 * commits). Falls back gracefully if anything is unavailable.
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.__jnpVersionIndicator__) return;
  window.__jnpVersionIndicator__ = true;

  // ---- environment detection ----------------------------------------
  function detectEnv() {
    if (window.__TAURI__ || window.__TAURI_INTERNALS__) return 'Desktop';
    try {
      if (window.matchMedia('(display-mode: standalone)').matches) return 'PWA';
      if (window.matchMedia('(display-mode: window-controls-overlay)').matches) return 'PWA';
      if (window.matchMedia('(display-mode: minimal-ui)').matches) return 'PWA';
      if (window.matchMedia('(display-mode: fullscreen)').matches) return 'PWA';
    } catch {}
    if (typeof navigator !== 'undefined' && navigator.standalone === true) return 'PWA';
    return 'Web';
  }

  // ---- version source -----------------------------------------------
  async function getVersion(env) {
    // Desktop: ask Tauri directly
    if (env === 'Desktop') {
      try {
        const T = window.__TAURI__;
        if (T && T.app && typeof T.app.getVersion === 'function') {
          const v = await T.app.getVersion();
          if (v) return v;
        }
        // Fallback via core.invoke
        if (T && T.core && typeof T.core.invoke === 'function') {
          const v = await T.core.invoke('plugin:app|version');
          if (v) return v;
        }
      } catch (e) { /* fall through */ }
    }
    // Web / PWA / Desktop fallback: fetch version.json
    try {
      const res = await fetch('/version.json', { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        if (j && j.version) return j.version;
      }
    } catch {}
    return '?';
  }

  // ---- styles -------------------------------------------------------
  const CSS = `
    .jnp-version-indicator {
      margin-top: 18px; padding: 10px 14px 12px;
      border-top: 1px solid rgba(0,0,0,.08);
      font-size: 11px; line-height: 1.4;
      color: var(--ink-soft, #888);
      display: flex; align-items: center; justify-content: space-between;
      gap: 8px; opacity: .85;
    }
    .jnp-version-indicator .jnp-vi-ver {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-weight: 600; letter-spacing: 0.02em;
    }
    .jnp-version-indicator .jnp-vi-env {
      font-size: 10px;
      padding: 2px 7px; border-radius: 999px;
      background: rgba(0,0,0,.06);
      letter-spacing: 0.04em; text-transform: uppercase;
    }
    .jnp-version-indicator .jnp-vi-env.jnp-env-desktop { background:#d6f5e0; color:#1c6b3a; }
    .jnp-version-indicator .jnp-vi-env.jnp-env-pwa     { background:#ffe7b3; color:#8a5a00; }
    .jnp-version-indicator .jnp-vi-env.jnp-env-web     { background:#e2e8f0; color:#495567; }
    /* Fallback fixed-position version badge when sidebar isn't found */
    .jnp-version-indicator.jnp-vi-floating {
      position: fixed; left: 10px; bottom: 10px; z-index: 2147483300;
      margin: 0; padding: 5px 10px; border-top: 0;
      background: rgba(255,255,255,.9);
      border: 1px solid rgba(0,0,0,.08);
      border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,.06);
    }
  `;
  const style = document.createElement('style');
  style.setAttribute('data-jnp-version', '');
  style.textContent = CSS;
  document.head.appendChild(style);

  // ---- render -------------------------------------------------------
  async function render() {
    // Remove any old instance (in case of rerender)
    document.querySelectorAll('.jnp-version-indicator').forEach(el => el.remove());

    const env = detectEnv();
    const version = await getVersion(env);

    const el = document.createElement('div');
    el.className = 'jnp-version-indicator';
    const envClass = 'jnp-env-' + env.toLowerCase();
    el.innerHTML = `
      <span class="jnp-vi-ver">v${escapeHtml(version)}</span>
      <span class="jnp-vi-env ${envClass}">${escapeHtml(env)}</span>
    `;

    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.appendChild(el);
    } else {
      el.classList.add('jnp-vi-floating');
      document.body.appendChild(el);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c]));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }

  // Re-render once more after a beat, in case the sidebar is built lazily.
  setTimeout(render, 1500);
})();
