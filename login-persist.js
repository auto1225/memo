/**
 * JustANotepad - Login Persistence
 * --------------------------------------------------------------------------
 * Once the user signs in (Supabase OAuth: Google/Kakao/GitHub), persist the
 * session across restarts so they never have to log in again. Works on:
 *   - Web / PWA (localStorage via @supabase/supabase-js default)
 *   - Capacitor Android/iOS (Preferences plugin, survives app kill)
 *   - Tauri desktop (localStorage of WebView2)
 *
 * The default Supabase JS client already persists to localStorage in browsers.
 * On Capacitor Android, localStorage can be cleared by Android at any time.
 * This file bridges Supabase's session events to @capacitor/preferences so
 * the session is stored in proper native storage.
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.__jnpLoginPersist__) return;
  window.__jnpLoginPersist__ = true;

  const C = window.Capacitor;
  const isCapacitor = !!(C && C.isNativePlatform && C.isNativePlatform());

  const SESSION_KEY = 'jnp.supabase.session';

  async function readPersisted() {
    try {
      if (isCapacitor && C.Plugins && C.Plugins.Preferences) {
        const { value } = await C.Plugins.Preferences.get({ key: SESSION_KEY });
        return value ? JSON.parse(value) : null;
      }
    } catch {}
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {}
    return null;
  }

  async function writePersisted(session) {
    const payload = session ? JSON.stringify(session) : '';
    try {
      if (isCapacitor && C.Plugins && C.Plugins.Preferences) {
        if (session) {
          await C.Plugins.Preferences.set({ key: SESSION_KEY, value: payload });
        } else {
          await C.Plugins.Preferences.remove({ key: SESSION_KEY });
        }
      }
    } catch {}
    try {
      if (session) localStorage.setItem(SESSION_KEY, payload);
      else         localStorage.removeItem(SESSION_KEY);
    } catch {}
  }

  // Wait for app's Supabase client to be ready, then hook into auth events.
  async function attach() {
    // sync.js exposes window.JANSync with getSupabase
    for (let i = 0; i < 40; i++) {
      if (window.JANSync && typeof window.JANSync.getSupabase === 'function') break;
      await new Promise((r) => setTimeout(r, 250));
    }
    const sb = window.JANSync && window.JANSync.getSupabase && window.JANSync.getSupabase();
    if (!sb || !sb.auth) return;

    // Restore any persisted session on startup before the app tries to call APIs.
    try {
      const persisted = await readPersisted();
      if (persisted && persisted.access_token && persisted.refresh_token) {
        await sb.auth.setSession({
          access_token: persisted.access_token,
          refresh_token: persisted.refresh_token,
        });
      }
    } catch (e) { console.warn('[JNP-LOGIN] restore failed:', e && e.message); }

    // Save on every auth state change (sign-in, token refresh, sign-out).
    sb.auth.onAuthStateChange(async (_event, session) => {
      await writePersisted(session);
    });

    // Also save the currently-active session (covers cases where the app loads
    // signed-in via normal cookie flow).
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session) await writePersisted(session);
    } catch {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
})();
