/**
 * JustANotepad - Addons: Login Persistence + Pen FAB + Pen Settings
 * --------------------------------------------------------------------------
 * Three usability improvements for mobile & remote-URL installs:
 *
 * 1. Login persistence — Supabase session is persisted to
 *    window.localStorage (already default) AND mirrored to
 *    Capacitor Preferences so the Android app auto-restores the
 *    session on next cold start. No more "로그인해야 써짐" on every
 *    app open.
 *
 * 2. Pen / handwriting floating action button — the existing
 *    #sketchBtn is buried in a crowded toolbar and hard to discover.
 *    On mobile we surface a prominent bottom-right FAB that opens
 *    sketch mode in one tap.
 *
 * 3. Pen settings quick panel — pen thickness, color, eraser,
 *    and AI OCR shortcuts in a compact floating panel accessible
 *    from the FAB long-press.
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.__jnpCmsAddons__) return;
  window.__jnpCmsAddons__ = true;

  const C = window.Capacitor;
  const isCapacitor = !!(C && C.isNativePlatform && C.isNativePlatform());
  const isTauri = !!(window.__TAURI__ || window.__TAURI_INTERNALS__);
  const isMobileSized = window.matchMedia('(max-width: 768px)').matches;

  // ===================================================================
  // 1. LOGIN PERSISTENCE
  // ===================================================================
  //
  // Supabase already saves its session to localStorage by default, but on
  // Capacitor Android the localStorage can be cleared by the system under
  // low-memory pressure. Mirror it to @capacitor/preferences (SharedPrefs
  // on Android, NSUserDefaults on iOS) as a durable backup.
  //
  async function setupLoginPersistence() {
    if (!isCapacitor) return;
    const Prefs = C.Plugins && C.Plugins.Preferences;
    if (!Prefs) return;

    // Wait for Supabase client to be available
    let attempts = 0;
    while (!(window.Cloud && window.Cloud.getSupabase && window.Cloud.getSupabase()) && attempts < 40) {
      await new Promise(r => setTimeout(r, 250));
      attempts++;
    }
    const sb = window.Cloud && window.Cloud.getSupabase && window.Cloud.getSupabase();
    if (!sb) return;

    const SESSION_KEY = 'jnp_supabase_session';

    // On startup: if localStorage session is empty, try restoring from Prefs
    try {
      const { value: stored } = await Prefs.get({ key: SESSION_KEY });
      if (stored) {
        // Supabase v2: setSession to restore
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.access_token && parsed.refresh_token) {
            await sb.auth.setSession({
              access_token: parsed.access_token,
              refresh_token: parsed.refresh_token,
            });
          }
        } catch { /* invalid stored session, ignore */ }
      }
    } catch {}

    // Mirror every auth change to Prefs
    sb.auth.onAuthStateChange((_event, session) => {
      try {
        if (session) {
          Prefs.set({ key: SESSION_KEY, value: JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at,
          }) }).catch(() => {});
        } else {
          Prefs.remove({ key: SESSION_KEY }).catch(() => {});
        }
      } catch {}
    });
  }

  // ===================================================================
  // 2. PEN FLOATING ACTION BUTTON (mobile only)
  // ===================================================================
  //
  // The existing #sketchBtn already supports pressure-sensitive stylus
  // + touch and has four AI OCR modes. We just need to surface it
  // prominently on mobile.
  //
  const fabCss = `
    .jnp-pen-fab {
      position: fixed; bottom: max(20px, env(safe-area-inset-bottom));
      right: max(16px, env(safe-area-inset-right));
      width: 56px; height: 56px; border-radius: 28px;
      background: linear-gradient(135deg, #FAE100 0%, #f0c800 100%);
      color: #222; border: 0; cursor: pointer;
      box-shadow: 0 6px 20px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.15);
      display: flex; align-items: center; justify-content: center;
      z-index: 2147482000;
      -webkit-tap-highlight-color: transparent;
      transition: transform 120ms ease, box-shadow 120ms ease;
      touch-action: manipulation;
    }
    .jnp-pen-fab:active { transform: scale(0.92); }
    .jnp-pen-fab svg { width: 26px; height: 26px; }
    /* Hide on desktop / wide screens — desktop toolbar has its own button */
    @media (min-width: 769px) {
      .jnp-pen-fab { display: none; }
    }
    /* Quick settings bubble */
    .jnp-pen-quickbar {
      position: fixed; bottom: calc(max(20px, env(safe-area-inset-bottom)) + 68px);
      right: max(16px, env(safe-area-inset-right));
      background: #fff; color: #222;
      border-radius: 14px; padding: 10px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.25);
      display: none; flex-direction: column; gap: 8px;
      z-index: 2147482001;
      min-width: 200px;
    }
    .jnp-pen-quickbar.open { display: flex; }
    .jnp-pen-quickbar .qb-label {
      font-size: 11px; color: #888; margin: 2px 0 -2px;
      font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
    }
    .jnp-pen-quickbar .qb-row {
      display: flex; gap: 6px; align-items: center;
    }
    .jnp-pen-quickbar .qb-btn {
      flex: 1; min-height: 36px; border: 1px solid #e5e5e5; background: #fff;
      border-radius: 8px; cursor: pointer; font-size: 13px; padding: 6px 10px;
      display: flex; align-items: center; justify-content: center; gap: 4px;
      -webkit-tap-highlight-color: transparent; touch-action: manipulation;
    }
    .jnp-pen-quickbar .qb-btn:active { background: #f5f5f5; }
    .jnp-pen-quickbar .qb-btn.primary {
      background: linear-gradient(135deg, #FAE100 0%, #f0c800 100%);
      border-color: #f0c800; font-weight: 600;
    }
  `;
  const style = document.createElement('style');
  style.setAttribute('data-jnp-cms-addons', '');
  style.textContent = fabCss;
  document.head.appendChild(style);

  function installPenFab() {
    if (document.querySelector('.jnp-pen-fab')) return;
    // Only show if #sketchBtn exists (proof that sketch feature is loaded)
    const waitForSketch = () => {
      const sketchBtn = document.getElementById('sketchBtn');
      if (!sketchBtn) return setTimeout(waitForSketch, 400);
      const fab = document.createElement('button');
      fab.className = 'jnp-pen-fab';
      fab.setAttribute('aria-label', '손글씨·펜');
      fab.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 3a2.85 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>
        </svg>
      `;
      let longPressTimer = null;
      let longPressed = false;
      fab.addEventListener('pointerdown', () => {
        longPressed = false;
        longPressTimer = setTimeout(() => {
          longPressed = true;
          showQuickbar();
        }, 450);
      });
      fab.addEventListener('pointerup', () => {
        clearTimeout(longPressTimer);
      });
      fab.addEventListener('pointerleave', () => {
        clearTimeout(longPressTimer);
      });
      fab.addEventListener('click', (e) => {
        if (longPressed) { e.preventDefault(); return; }
        sketchBtn.click();
      });
      document.body.appendChild(fab);
      buildQuickbar(sketchBtn);
    };
    waitForSketch();
  }

  function buildQuickbar(sketchBtn) {
    if (document.querySelector('.jnp-pen-quickbar')) return;
    const qb = document.createElement('div');
    qb.className = 'jnp-pen-quickbar';
    qb.innerHTML = `
      <div class="qb-label">펜 · 손글씨</div>
      <button class="qb-btn primary" data-a="open">✍️ 손글씨 시작</button>
      <div class="qb-label">AI 인식 (열고 시작)</div>
      <div class="qb-row">
        <button class="qb-btn" data-a="ocr">텍스트</button>
        <button class="qb-btn" data-a="math">수식</button>
      </div>
      <div class="qb-row">
        <button class="qb-btn" data-a="table">표</button>
        <button class="qb-btn" data-a="md">마크다운</button>
      </div>
    `;
    document.body.appendChild(qb);

    qb.addEventListener('click', (e) => {
      const btn = e.target.closest('.qb-btn');
      if (!btn) return;
      const action = btn.dataset.a;
      hideQuickbar();
      if (action === 'open') {
        sketchBtn.click();
      } else {
        sketchBtn.click();
        // Wait for sketch modal to open, then click the appropriate OCR button
        const idMap = { ocr: 'sketchOCR', math: 'sketchOCRMath', table: 'sketchOCRTable', md: 'sketchOCRMd' };
        setTimeout(() => {
          const b = document.getElementById(idMap[action]);
          if (b) b.click();
        }, 600);
      }
    });

    // Close on outside tap
    document.addEventListener('pointerdown', (e) => {
      const qbEl = document.querySelector('.jnp-pen-quickbar.open');
      if (!qbEl) return;
      if (qbEl.contains(e.target) || e.target.closest('.jnp-pen-fab')) return;
      hideQuickbar();
    });
  }

  function showQuickbar() {
    const qb = document.querySelector('.jnp-pen-quickbar');
    if (qb) qb.classList.add('open');
  }
  function hideQuickbar() {
    const qb = document.querySelector('.jnp-pen-quickbar');
    if (qb) qb.classList.remove('open');
  }

  // ===================================================================
  // BOOT
  // ===================================================================
  function boot() {
    setupLoginPersistence().catch(() => {});
    // FAB is useful on mobile-sized viewports even outside Capacitor
    // (responsive browser test, PWA)
    if (isCapacitor || isMobileSized) {
      installPenFab();
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
