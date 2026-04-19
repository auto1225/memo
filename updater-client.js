/**
 * JustANotepad - Auto-Update Client (Tauri desktop only)
 * --------------------------------------------------------------------------
 * Works with the tauri-plugin-updater plugin bundled into v1.0.3+.
 * On startup:
 *   1. Checks GitHub Releases `latest.json` via the plugin endpoint.
 *   2. If an update is available, shows a non-blocking toast with a button.
 *   3. User clicks → downloads, verifies signature, installs, relaunches.
 *
 * Older binaries (v1.0.2 and below) don't ship with the updater plugin, so
 * the calls are wrapped in try/catch and fail silently there.
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.__jnpUpdater__) return;
  window.__jnpUpdater__ = true;

  // Flip to true via `?jnp_debug=1` URL flag for on-demand diagnostics.
  const JNP_DEBUG = /[?&]jnp_debug=1\b/.test(location.search);
  // Desktop app only
  const isTauri = !!(window.__TAURI__ || window.__TAURI_INTERNALS__);
  JNP_DEBUG && console.log('[JNP-UPDATER] boot',
    { isTauri, hasTauri: !!window.__TAURI__,
      tauriKeys: window.__TAURI__ ? Object.keys(window.__TAURI__) : [] });
  if (!isTauri) return;

  const CSS = `
    .jnp-upd-toast {
      position: fixed; right: 16px; bottom: 16px; z-index: 2147483400;
      display: none; align-items: center; gap: 10px;
      background: #1f2329; color: #fff; border-radius: 10px;
      padding: 10px 12px 10px 14px; box-shadow: 0 10px 28px rgba(0,0,0,.35);
      font: 500 13px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI",
             "Apple SD Gothic Neo", "Noto Sans KR", Roboto, sans-serif;
      max-width: 340px;
      transform: translateY(8px); opacity: 0;
      transition: transform 160ms ease, opacity 160ms ease;
    }
    .jnp-upd-toast.show { display: flex; transform: translateY(0); opacity: 1; }
    .jnp-upd-toast .title { display: block; font-weight: 600; margin-bottom: 2px; }
    .jnp-upd-toast .hint  { display: block; color: #a9b0bc; font-size: 11px; }
    .jnp-upd-toast button {
      border: 0; border-radius: 7px; padding: 7px 12px; cursor: pointer;
      font: inherit; font-weight: 600;
    }
    .jnp-upd-install { background: #FAE100; color: #222; }
    .jnp-upd-later   { background: transparent; color: #a9b0bc; padding: 6px 8px; }
    .jnp-upd-later:hover { color: #fff; }
    .jnp-upd-progress {
      height: 3px; background: #FAE100; width: 0%;
      transition: width 120ms linear;
      position: absolute; bottom: 0; left: 0; border-radius: 0 0 10px 10px;
    }
  `;
  const style = document.createElement('style');
  style.setAttribute('data-jnp-updater', '');
  style.textContent = CSS;
  document.head.appendChild(style);

  const toast = document.createElement('div');
  toast.className = 'jnp-upd-toast';
  toast.innerHTML = `
    <div style="position:relative;flex:1;min-width:0;">
      <span class="title">업데이트 가능</span>
      <span class="hint"></span>
    </div>
    <button class="jnp-upd-install" type="button">지금 설치</button>
    <button class="jnp-upd-later"   type="button" aria-label="나중에">나중에</button>
    <div class="jnp-upd-progress"></div>
  `;
  document.body.appendChild(toast);

  const hintEl     = toast.querySelector('.hint');
  const installBtn = toast.querySelector('.jnp-upd-install');
  const laterBtn   = toast.querySelector('.jnp-upd-later');
  const progressEl = toast.querySelector('.jnp-upd-progress');

  laterBtn.addEventListener('click', () => toast.classList.remove('show'));

  async function callCheck() {
    // Try every known shape of the updater plugin API in Tauri v2.
    const T = window.__TAURI__;
    JNP_DEBUG && console.log('[JNP-UPDATER] T keys:', T ? Object.keys(T) : null,
      'PLUGIN_UPDATER:', !!window.__TAURI_PLUGIN_UPDATER__);

    // 1) window.__TAURI__.updater.check
    if (T && T.updater && typeof T.updater.check === 'function') {
      JNP_DEBUG && console.log('[JNP-UPDATER] using T.updater.check');
      return await T.updater.check();
    }
    // 2) window.__TAURI_PLUGIN_UPDATER__.check
    if (window.__TAURI_PLUGIN_UPDATER__ && typeof window.__TAURI_PLUGIN_UPDATER__.check === 'function') {
      JNP_DEBUG && console.log('[JNP-UPDATER] using __TAURI_PLUGIN_UPDATER__.check');
      return await window.__TAURI_PLUGIN_UPDATER__.check();
    }
    // 3) Direct invoke RPC
    if (T && T.core && typeof T.core.invoke === 'function') {
      JNP_DEBUG && console.log('[JNP-UPDATER] using core.invoke("plugin:updater|check")');
      return await T.core.invoke('plugin:updater|check');
    }
    throw new Error('No updater API found on window.__TAURI__');
  }

  async function checkAndOffer() {
    JNP_DEBUG && console.log('[JNP-UPDATER] checkAndOffer start');
    let update;
    try {
      update = await callCheck();
      JNP_DEBUG && console.log('[JNP-UPDATER] check result:', update);
    } catch (e) {
      JNP_DEBUG && console.warn('[JNP-UPDATER] check failed:', e && e.message);
      return;
    }
    if (!update) { JNP_DEBUG && console.log('[JNP-UPDATER] no update object'); return; }
    // Normalize various API shapes
    const available = update.available !== undefined
      ? update.available
      : (update.shouldUpdate !== undefined ? update.shouldUpdate : !!update.version);
    if (!available) { JNP_DEBUG && console.log('[JNP-UPDATER] no update available'); return; }

    hintEl.textContent =
      `v${update.version}` +
      (update.date ? ' · ' + update.date.slice(0, 10) : '') +
      (update.body  ? ' · ' + String(update.body).split('\n')[0].slice(0, 60) : '');

    installBtn.onclick = async () => {
      installBtn.disabled = true;
      installBtn.textContent = '다운로드 중…';
      let total = 0, got = 0;
      try {
        await update.downloadAndInstall((event) => {
          if (event.event === 'Started') {
            total = event.data.contentLength || 0;
          } else if (event.event === 'Progress') {
            got += event.data.chunkLength || 0;
            if (total) progressEl.style.width = Math.min(100, (got / total) * 100) + '%';
          } else if (event.event === 'Finished') {
            progressEl.style.width = '100%';
            installBtn.textContent = '재시작 중…';
          }
        });
        // Relaunch the app
        try {
          const proc = window.__TAURI__ && window.__TAURI__.process;
          if (proc && typeof proc.relaunch === 'function') {
            await proc.relaunch();
          }
        } catch (e) { JNP_DEBUG && console.warn('[updater] relaunch failed:', e); }
      } catch (e) {
        installBtn.disabled = false;
        installBtn.textContent = '다시 시도';
        hintEl.textContent = '설치 실패: ' + (e && e.message ? e.message : e);
      }
    };

    toast.classList.add('show');
  }

  // Delay the check a bit so it doesn't compete with app startup.
  setTimeout(() => { checkAndOffer().catch(() => {}); }, 2500);
})();
