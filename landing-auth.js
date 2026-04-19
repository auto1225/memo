/**
 * JustANotepad landing-page auth
 * --------------------------------------------------------------------------
 * Intercepts clicks on "로그인" / "무료 가입" anchors that used to navigate
 * to /app?signin=1. Instead opens a login modal right on the landing page
 * with Google / GitHub / Kakao OAuth buttons. After successful sign-in the
 * session is persisted by Supabase + our login-persist.js, and the user
 * stays on the landing page with a floating "앱 열기 →" CTA.
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.__jnpLandingAuth__) return;
  window.__jnpLandingAuth__ = true;

  const url  = window.SUPABASE_URL;
  const anon = window.SUPABASE_ANON_KEY;
  if (!url || !anon || !window.supabase || typeof window.supabase.createClient !== 'function') {
    // Supabase client not available — fall back to the /app redirect.
    return;
  }

  const sb = window.supabase.createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  // ---- CSS ----------------------------------------------------------
  const css = `
    .jnp-auth-backdrop {
      position: fixed; inset: 0; background: rgba(15,15,20,.45);
      backdrop-filter: blur(2px); z-index: 2147483400;
      display: none; align-items: center; justify-content: center;
    }
    .jnp-auth-backdrop.open { display: flex; }
    .jnp-auth-card {
      background: #fff; border-radius: 14px; padding: 28px 28px 22px;
      width: min(380px, 92vw); text-align: center;
      box-shadow: 0 18px 48px rgba(0,0,0,.25);
      font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI",
        "Apple SD Gothic Neo", "Noto Sans KR", Roboto, sans-serif;
    }
    .jnp-auth-card h2 { margin: 0 0 6px; font-size: 18px; }
    .jnp-auth-card p  { color: #666; margin: 0 0 18px; font-size: 13px; }
    .jnp-auth-btn {
      width: 100%; padding: 12px 14px; border-radius: 9px;
      border: 1px solid #e5e7eb; background: #fff; color: #1f2937;
      font-size: 14px; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 10px;
      margin-bottom: 10px; transition: background .15s;
    }
    .jnp-auth-btn:hover { background: #f9fafb; }
    .jnp-auth-btn .ico { width: 18px; height: 18px; }
    .jnp-auth-btn.google { border-color: #dbe2ea; }
    .jnp-auth-btn.github { background:#24292f; color:#fff; border-color:#24292f; }
    .jnp-auth-btn.github:hover { background:#1a1f25; }
    .jnp-auth-btn.kakao  { background:#fee500; color:#1f1f1f; border-color:#fee500; }
    .jnp-auth-btn.kakao:hover { background:#f8d800; }
    .jnp-auth-btn.email  { border-color:#e5e7eb; }
    .jnp-auth-cancel {
      margin-top: 4px; background: transparent; color: #888; border: 0;
      padding: 8px; font-size: 13px; cursor: pointer;
    }
    .jnp-auth-email-field {
      display: none; margin: 0 0 12px;
    }
    .jnp-auth-email-field input {
      width: 100%; padding: 10px 12px; border: 1px solid #e5e7eb;
      border-radius: 8px; font-size: 14px; box-sizing: border-box;
    }
    .jnp-auth-footer {
      margin-top: 14px; padding-top: 14px; border-top: 1px solid #f0f0f0;
      color: #888; font-size: 12px;
    }

    /* Signed-in CTA floating bottom-right */
    .jnp-auth-fab {
      position: fixed; right: 16px; bottom: 16px; z-index: 2147483200;
      background: linear-gradient(135deg,#FAE100,#f5c800);
      color: #1f1f1f; border: 0; border-radius: 999px;
      padding: 12px 18px; font-weight: 700; font-size: 14px;
      box-shadow: 0 10px 24px rgba(245,200,0,.35);
      display: none; align-items: center; gap: 8px; cursor: pointer;
      text-decoration: none;
    }
    .jnp-auth-fab.show { display: inline-flex; }
    .jnp-auth-fab:hover { filter: brightness(1.04); }
  `;
  const style = document.createElement('style');
  style.setAttribute('data-jnp-landing-auth', '');
  style.textContent = css;
  document.head.appendChild(style);

  // ---- Modal --------------------------------------------------------
  const backdrop = document.createElement('div');
  backdrop.className = 'jnp-auth-backdrop';
  backdrop.innerHTML = `
    <div class="jnp-auth-card" role="dialog" aria-modal="true" aria-label="로그인">
      <h2 id="jnpAuthTitle">로그인</h2>
      <p id="jnpAuthSub">가입한 적 없어도 괜찮아요. 처음 로그인 시 자동으로 계정이 생깁니다.</p>
      <button type="button" class="jnp-auth-btn google" data-provider="google">
        <svg class="ico" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        Google로 계속하기
      </button>
      <button type="button" class="jnp-auth-btn kakao" data-provider="kakao">
        <svg class="ico" viewBox="0 0 24 24"><path fill="#1f1f1f" d="M12 3C6.48 3 2 6.58 2 11c0 2.86 1.87 5.37 4.68 6.81l-1.2 4.37c-.09.33.27.61.56.44L11.3 19.6c.23.02.46.03.7.03 5.52 0 10-3.58 10-8S17.52 3 12 3z"/></svg>
        카카오로 계속하기
      </button>
      <button type="button" class="jnp-auth-btn github" data-provider="github">
        <svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/></svg>
        GitHub로 계속하기
      </button>
      <button type="button" class="jnp-auth-btn email" id="jnpAuthShowEmail">✉️ 이메일로 로그인</button>
      <div class="jnp-auth-email-field" id="jnpAuthEmailRow">
        <input type="email" id="jnpAuthEmail" placeholder="your@email.com" autocomplete="email">
        <button type="button" class="jnp-auth-btn" id="jnpAuthEmailSubmit" style="margin-top:8px;background:#FAE100;border-color:#FAE100;color:#1f1f1f;">매직 링크 받기</button>
      </div>
      <button type="button" class="jnp-auth-cancel" id="jnpAuthCancel">취소</button>
      <div class="jnp-auth-footer">로그인은 기기 간 동기화용입니다. 로그인 없이도 브라우저에 저장됩니다.</div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const appFab = document.createElement('a');
  appFab.className = 'jnp-auth-fab';
  appFab.href = '/app';
  appFab.innerHTML = '앱 열기 →';
  document.body.appendChild(appFab);

  // ---- Helpers ------------------------------------------------------
  function openModal(mode) {
    backdrop.classList.add('open');
    document.getElementById('jnpAuthTitle').textContent = mode === 'signup' ? '무료 가입' : '로그인';
    document.getElementById('jnpAuthEmailRow').style.display = 'none';
    document.getElementById('jnpAuthShowEmail').style.display = '';
  }
  function closeModal() { backdrop.classList.remove('open'); }
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
  document.getElementById('jnpAuthCancel').addEventListener('click', closeModal);

  async function oauth(provider) {
    try {
      await sb.auth.signInWithOAuth({
        provider,
        options: { redirectTo: location.origin + '/' },
      });
    } catch (e) {
      alert('로그인 실패: ' + (e?.message || e));
    }
  }
  backdrop.querySelectorAll('[data-provider]').forEach((btn) => {
    btn.addEventListener('click', () => oauth(btn.dataset.provider));
  });

  document.getElementById('jnpAuthShowEmail').addEventListener('click', () => {
    document.getElementById('jnpAuthShowEmail').style.display = 'none';
    document.getElementById('jnpAuthEmailRow').style.display = 'block';
    document.getElementById('jnpAuthEmail').focus();
  });
  document.getElementById('jnpAuthEmailSubmit').addEventListener('click', async () => {
    const email = document.getElementById('jnpAuthEmail').value.trim();
    if (!email) return;
    try {
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.origin + '/' },
      });
      if (error) throw error;
      alert('이메일을 확인하세요. 매직 링크를 보냈습니다.');
      closeModal();
    } catch (e) {
      alert('이메일 전송 실패: ' + (e?.message || e));
    }
  });

  // ---- Intercept landing page links --------------------------------
  function hookLinks() {
    const sel = 'a[href="/app?signin=1"], a[href="/app?signup=1"], a[href^="/app?signin"], a[href^="/app?signup"]';
    document.querySelectorAll(sel).forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(a.getAttribute('href').includes('signup') ? 'signup' : 'signin');
      });
    });
  }

  // ---- Session badge → 앱 열기 CTA --------------------------------
  async function syncSessionUI() {
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session && session.user) {
        appFab.classList.add('show');
        appFab.textContent = (session.user.email ? (session.user.email.split('@')[0] + ' · ') : '') + '앱 열기 →';
      } else {
        appFab.classList.remove('show');
      }
    } catch {}
  }

  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') {
      closeModal();
      syncSessionUI();
    }
    if (event === 'SIGNED_OUT') syncSessionUI();
  });

  function boot() {
    hookLinks();
    syncSessionUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
