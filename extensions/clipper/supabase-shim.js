/**
 * Minimal Supabase wrapper for the web clipper.
 * We avoid pulling the full supabase-js lib (~50KB) and just do REST calls.
 * Auth: PKCE-less flow — user signs in via justanotepad.com, and the
 * clipper uses a session token stored in chrome.storage.local after login.
 */

import { SUPABASE_URL, SUPABASE_ANON } from './config.js';

export async function getAccessToken() {
  const got = await chrome.storage.local.get(['jnp_access_token', 'jnp_refresh_token', 'jnp_expires_at']);
  const now = Math.floor(Date.now() / 1000);
  if (got.jnp_access_token && got.jnp_expires_at && got.jnp_expires_at > now + 30) {
    return got.jnp_access_token;
  }
  // Token stale — try refresh
  if (got.jnp_refresh_token) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: got.jnp_refresh_token }),
    });
    if (r.ok) {
      const j = await r.json();
      await chrome.storage.local.set({
        jnp_access_token:  j.access_token,
        jnp_refresh_token: j.refresh_token,
        jnp_expires_at:    now + (j.expires_in || 3600),
        jnp_user_email:    j.user?.email || got.jnp_user_email || null,
      });
      return j.access_token;
    }
  }
  return null;
}

export async function saveClip({ url, title, html, text, excerpt, tags }) {
  const token = await getAccessToken();
  if (!token) throw new Error('NOT_SIGNED_IN');

  const body = [{
    url, title, html, text, excerpt,
    tags: tags || [],
    imported: false,
  }];

  const r = await fetch(`${SUPABASE_URL}/rest/v1/cms_clips`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`HTTP ${r.status}: ${errText}`);
  }
  const rows = await r.json();
  return rows[0];
}

export async function isSignedIn() {
  const t = await getAccessToken();
  return !!t;
}

export async function getUserEmail() {
  const got = await chrome.storage.local.get(['jnp_user_email']);
  return got.jnp_user_email || null;
}

export async function signOut() {
  await chrome.storage.local.remove(['jnp_access_token','jnp_refresh_token','jnp_expires_at','jnp_user_email']);
}
