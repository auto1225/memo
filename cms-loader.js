/**
 * JustANotepad - CMS Content Loader (landing page)
 * --------------------------------------------------------------------------
 * Fetches every row from public.cms_content in Supabase and applies the
 * values to DOM elements tagged with [data-cms="key"]. Supports four
 * content kinds:
 *   kind='text'  →  element.innerText = value
 *   kind='html'  →  element.innerHTML = value   (trust DB — admin only)
 *   kind='image' →  element.src       = value   (img/video elements)
 *   kind='url'   →  element.href      = value   (anchor)
 *
 * Falls back silently if Supabase / config is unavailable so the hard-coded
 * HTML still renders. Uses the anonymous key (read-only public policy).
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.__jnpCmsLoader__) return;
  window.__jnpCmsLoader__ = true;

  const url  = window.SUPABASE_URL;
  const anon = window.SUPABASE_ANON_KEY;
  if (!url || !anon || !window.supabase || !window.supabase.createClient) return;

  const sb = window.supabase.createClient(url, anon);

  async function load() {
    const { data, error } = await sb.from('cms_content').select('key,value,kind');
    if (error || !data) return;
    const map = {};
    data.forEach((r) => { map[r.key] = r; });
    apply(map);
    // Also cache in sessionStorage so the next nav in-session is instant
    try { sessionStorage.setItem('jnp.cms.cache', JSON.stringify(map)); } catch {}
  }

  function apply(map) {
    document.querySelectorAll('[data-cms]').forEach((el) => {
      const key = el.getAttribute('data-cms');
      const row = map[key];
      if (!row || row.value == null) return;
      switch (row.kind) {
        case 'html':  el.innerHTML = row.value; break;
        case 'image': if ('src'  in el) el.src  = row.value; break;
        case 'url':   if ('href' in el) el.href = row.value; break;
        default:      el.innerText = row.value;
      }
    });
  }

  // Warm start from cache so the user doesn't see a flash of original text
  try {
    const cached = JSON.parse(sessionStorage.getItem('jnp.cms.cache') || 'null');
    if (cached) apply(cached);
  } catch {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
