/**
 * JustANotepad - Super-admin CMS shortcut in topbar
 * --------------------------------------------------------------------------
 * Watches the current Supabase session. When the signed-in email matches the
 * super-admin allowlist, injects a purple "CMS" button into the app's topbar
 * that jumps to /admin. For everyone else, the button stays hidden — regular
 * users never see CMS machinery.
 *
 * The matching rule is intentionally strict: exact email compare against
 * SUPER_ADMINS. Even an admin-role profile won't see this — only the
 * owner's personal email does.
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.__jnpSuperAdminLink__) return;
  window.__jnpSuperAdminLink__ = true;

  const SUPER_ADMINS = ['auto0104@gmail.com'];

  // Inject CSS once
  const style = document.createElement('style');
  style.setAttribute('data-jnp-super-admin', '');
  style.textContent = `
    #jnpCmsBtn {
      background: linear-gradient(135deg, #7e57c2, #5e35b1) !important;
      color: #fff !important;
      border-radius: 6px !important;
      padding: 4px 10px !important;
      width: auto !important;
      font-weight: 700 !important;
      font-size: 11px !important;
      margin: 0 4px !important;
      letter-spacing: 0.04em !important;
      box-shadow: 0 2px 6px rgba(94,53,177,.35);
      opacity: 1 !important;
      display: none;
      align-items: center;
      gap: 5px;
      text-decoration: none;
    }
    #jnpCmsBtn.show { display: inline-flex; }
    #jnpCmsBtn:hover { filter: brightness(1.1); }
    #jnpCmsBtn svg { width: 13px; height: 13px; }
  `;
  document.head.appendChild(style);

  function ensureButton() {
    let btn = document.getElementById('jnpCmsBtn');
    if (btn) return btn;
    const topbar = document.getElementById('topbar') || document.querySelector('.topbar');
    if (!topbar) return null;
    btn = document.createElement('a');
    btn.id = 'jnpCmsBtn';
    btn.href = '/admin';
    btn.title = 'CMS 관리자 페이지 (Super Admin 전용)';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
      </svg>
      <span>CMS</span>
    `;
    // Insert before the close/minimize cluster — or at the end if we can't find them
    const before = topbar.querySelector('#helpBtn, #authBtn, #minBtn, #closeBtn');
    if (before) topbar.insertBefore(btn, before);
    else        topbar.appendChild(btn);
    return btn;
  }

  function updateVisibility(email) {
    const btn = ensureButton();
    if (!btn) return;
    if (email && SUPER_ADMINS.includes(String(email).toLowerCase())) {
      btn.classList.add('show');
    } else {
      btn.classList.remove('show');
    }
  }

  async function attach() {
    // Wait for sync.js's Supabase client to be ready
    for (let i = 0; i < 40; i++) {
      if (window.JANSync && typeof window.JANSync.getSupabase === 'function') break;
      await new Promise((r) => setTimeout(r, 250));
    }
    const sb = window.JANSync && window.JANSync.getSupabase && window.JANSync.getSupabase();

    // If Supabase isn't wired up at all (config missing), just hide — no CMS.
    if (!sb || !sb.auth) {
      ensureButton();
      return;
    }

    // Initial check
    try {
      const { data: { session } } = await sb.auth.getSession();
      updateVisibility(session && session.user && session.user.email);
    } catch {}

    // React to sign-in / sign-out
    sb.auth.onAuthStateChange((_event, session) => {
      updateVisibility(session && session.user && session.user.email);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
})();
