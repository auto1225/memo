/**
 * JustANotepad — IndexedDB Blob Store
 * --------------------------------------------------------------------------
 * Why this exists:
 *   localStorage is capped at 5~10MB per origin by most browsers, and is
 *   shared with small-state bookkeeping. Large base64 images (pasted photos,
 *   business-card scans, clipboard screenshots) rapidly exhaust it.
 *   IndexedDB, by contrast, gets disk-bound quota (often hundreds of MB to
 *   several GB on desktop browsers, gigabytes when installed as a PWA).
 *
 * Design:
 *   - Single object store `blobs` keyed by content-address (first 16 hex
 *     chars of SHA-256 of the data URL). Content-addressable means the same
 *     image pasted into 5 tabs stores ONCE.
 *   - In-memory cache (Map) to avoid repeat IDB reads for recently used ids.
 *   - `externalizeState` scans `state.tabs[].html` and `state.businessCards[]
 *     .photoBase64` for inline base64 data URLs > minBytes threshold, moves
 *     them to IDB, and replaces with `idb://<id>` references.
 *   - `rehydrateState` walks the same shape reversing the transformation
 *     (for in-memory use / backup export / cloud sync).
 *   - `gcUnusedBlobs` collects all `idb://...` references currently in state
 *     and deletes any orphan blobs.
 *
 * Privacy:
 *   - 100% on-device. No network calls. No references to our server.
 *   - Namespaced under `justanotepad` DB, origin-scoped by the browser.
 *
 * Fallback:
 *   - If IDB is unavailable or any call throws, the helpers return the input
 *     unchanged (data stays inline). The app continues to work, just without
 *     the size benefit.
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.__idbStore) return;

  const DB_NAME = 'justanotepad';
  const DB_VERSION = 1;
  const STORE = 'blobs';
  const DEFAULT_MIN_BYTES = 10 * 1024; // 10KB — below this, leave inline

  /* -------- DB open (lazy, cached) -------- */
  let dbPromise = null;
  function openDb() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB not supported'));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IDB open blocked'));
    });
    return dbPromise;
  }

  async function tx(mode) {
    const db = await openDb();
    const t = db.transaction(STORE, mode);
    return t.objectStore(STORE);
  }

  /* -------- Core CRUD -------- */
  async function putBlob(id, dataUrl) {
    const s = await tx('readwrite');
    return new Promise((res, rej) => {
      const r = s.put(dataUrl, id);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  }
  async function getBlob(id) {
    if (readCache.has(id)) return readCache.get(id);
    const s = await tx('readonly');
    return new Promise((res, rej) => {
      const r = s.get(id);
      r.onsuccess = () => {
        if (r.result) readCache.set(id, r.result);
        res(r.result || null);
      };
      r.onerror = () => rej(r.error);
    });
  }
  async function delBlob(id) {
    readCache.delete(id);
    const s = await tx('readwrite');
    return new Promise((res, rej) => {
      const r = s.delete(id);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  }
  async function listIds() {
    const s = await tx('readonly');
    return new Promise((res, rej) => {
      const r = s.getAllKeys();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  }

  /* Read cache — avoid redundant IDB reads when rendering multiple tabs/cards */
  const readCache = new Map();

  /* -------- Content hashing -------- */
  async function hashDataUrl(dataUrl) {
    try {
      const enc = new TextEncoder().encode(dataUrl);
      const buf = await crypto.subtle.digest('SHA-256', enc);
      return Array.from(new Uint8Array(buf).slice(0, 8))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback non-crypto hash (should never be hit in modern browsers)
      let h = 0;
      for (let i = 0; i < dataUrl.length; i++) { h = ((h << 5) - h + dataUrl.charCodeAt(i)) | 0; }
      return (h >>> 0).toString(16).padStart(16, '0');
    }
  }

  /* -------- HTML transforms -------- */
  // Match data:<mime>;base64,<payload>. Greedy on payload — we split on known delimiters.
  const RX_DATA_URL = /data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)/g;
  const RX_IDB_REF = /idb:\/\/([a-f0-9]+)/g;

  async function externalizeHtml(html, minBytes) {
    if (!html || typeof html !== 'string' || !html.includes('data:')) return html;
    const thresh = minBytes || DEFAULT_MIN_BYTES;
    const matches = [...html.matchAll(RX_DATA_URL)];
    if (!matches.length) return html;
    let out = html;
    for (const m of matches) {
      const full = m[0];
      if (full.length < thresh) continue;
      try {
        const id = await hashDataUrl(full);
        await putBlob(id, full);
        readCache.set(id, full);
        // Split-join is safer than regex for potentially-malformed payloads
        out = out.split(full).join('idb://' + id);
      } catch (e) {
        // IDB put failed — keep inline rather than corrupting content
        console.warn('[idb] externalize failed, keeping inline', e);
      }
    }
    return out;
  }

  async function rehydrateHtml(html) {
    if (!html || typeof html !== 'string' || !html.includes('idb://')) return html;
    const ids = new Set([...html.matchAll(RX_IDB_REF)].map(m => m[1]));
    if (!ids.size) return html;
    let out = html;
    for (const id of ids) {
      try {
        const dataUrl = await getBlob(id);
        if (dataUrl) out = out.split('idb://' + id).join(dataUrl);
      } catch {}
    }
    return out;
  }

  /* -------- DOM live-patching (after setting innerHTML) -------- */
  // Walk a DOM subtree and replace any src="idb://xxx" with the real data URL.
  // Used as a fallback when pageEl.innerHTML is set from state with unresolved refs.
  async function resolveIdbRefsInDom(root) {
    if (!root || !root.querySelectorAll) return;
    const els = root.querySelectorAll('img[src^="idb://"], audio[src^="idb://"], video[src^="idb://"]');
    for (const el of els) {
      const id = (el.getAttribute('src') || '').slice(6);
      if (!/^[a-f0-9]+$/.test(id)) continue;
      try {
        const url = await getBlob(id);
        if (url) el.src = url;
      } catch {}
    }
    // Also handle background-image: inline style refs
    const bgEls = root.querySelectorAll('[style*="idb://"]');
    for (const el of bgEls) {
      const m = (el.getAttribute('style') || '').match(/idb:\/\/([a-f0-9]+)/);
      if (!m) continue;
      try {
        const url = await getBlob(m[1]);
        if (url) el.style.cssText = el.style.cssText.replace('idb://' + m[1], url);
      } catch {}
    }
  }

  /* -------- State-level transforms -------- */
  async function externalizeState(state, opts) {
    opts = opts || {};
    const minBytes = opts.minBytes || DEFAULT_MIN_BYTES;
    // Deep clone via JSON — our state is JSON-serializable by design.
    let s;
    try { s = JSON.parse(JSON.stringify(state)); }
    catch { return state; }
    if (Array.isArray(s.tabs)) {
      for (const t of s.tabs) {
        if (t && t.html) t.html = await externalizeHtml(t.html, minBytes);
      }
    }
    if (Array.isArray(s.businessCards)) {
      for (const c of s.businessCards) {
        if (!c) continue;
        const p = c.photoBase64;
        if (typeof p === 'string' && p.startsWith('data:') && p.length >= minBytes) {
          try {
            const id = await hashDataUrl(p);
            await putBlob(id, p);
            readCache.set(id, p);
            c.photoBase64 = 'idb://' + id;
          } catch {}
        }
      }
    }
    // History & trash entries also carry tab.html — externalize those too
    for (const bucket of ['history', 'trash']) {
      if (Array.isArray(s[bucket])) {
        for (const entry of s[bucket]) {
          if (entry && entry.html) entry.html = await externalizeHtml(entry.html, minBytes);
          if (entry && Array.isArray(entry.tabs)) {
            for (const t of entry.tabs) {
              if (t && t.html) t.html = await externalizeHtml(t.html, minBytes);
            }
          }
        }
      }
    }
    return s;
  }

  async function rehydrateState(state) {
    if (!state) return state;
    if (Array.isArray(state.tabs)) {
      for (const t of state.tabs) {
        if (t && t.html) t.html = await rehydrateHtml(t.html);
      }
    }
    if (Array.isArray(state.businessCards)) {
      for (const c of state.businessCards) {
        if (c && typeof c.photoBase64 === 'string' && c.photoBase64.startsWith('idb://')) {
          try {
            const id = c.photoBase64.slice(6);
            const url = await getBlob(id);
            if (url) c.photoBase64 = url;
          } catch {}
        }
      }
    }
    for (const bucket of ['history', 'trash']) {
      if (Array.isArray(state[bucket])) {
        for (const entry of state[bucket]) {
          if (entry && entry.html) entry.html = await rehydrateHtml(entry.html);
          if (entry && Array.isArray(entry.tabs)) {
            for (const t of entry.tabs) {
              if (t && t.html) t.html = await rehydrateHtml(t.html);
            }
          }
        }
      }
    }
    return state;
  }

  /* -------- GC -------- */
  function collectRefs(state) {
    const used = new Set();
    const scanString = (s) => {
      if (typeof s !== 'string') return;
      const m = s.matchAll(RX_IDB_REF);
      for (const x of m) used.add(x[1]);
    };
    if (Array.isArray(state.tabs)) state.tabs.forEach(t => scanString(t?.html));
    if (Array.isArray(state.businessCards)) {
      state.businessCards.forEach(c => {
        const p = c?.photoBase64;
        if (typeof p === 'string' && p.startsWith('idb://')) used.add(p.slice(6));
      });
    }
    for (const bucket of ['history', 'trash']) {
      if (Array.isArray(state[bucket])) {
        state[bucket].forEach(entry => {
          scanString(entry?.html);
          if (Array.isArray(entry?.tabs)) entry.tabs.forEach(t => scanString(t?.html));
        });
      }
    }
    return used;
  }

  async function gcUnusedBlobs(state) {
    try {
      const used = collectRefs(state || {});
      const all = await listIds();
      const toDelete = all.filter(id => !used.has(id));
      for (const id of toDelete) await delBlob(id);
      return { kept: used.size, deleted: toDelete.length, total: all.length };
    } catch {
      return { kept: 0, deleted: 0, total: 0, error: true };
    }
  }

  /* -------- Stats -------- */
  async function getStats() {
    try {
      const ids = await listIds();
      let bytes = 0;
      for (const id of ids.slice(0, 1000)) {  // cap for perf
        const blob = await getBlob(id);
        if (typeof blob === 'string') bytes += blob.length;
      }
      const est = (navigator.storage && navigator.storage.estimate)
        ? await navigator.storage.estimate().catch(() => null)
        : null;
      return {
        blobCount: ids.length,
        blobBytesSampled: bytes,
        blobSampleSize: Math.min(ids.length, 1000),
        quota: est?.quota || null,
        usage: est?.usage || null,
      };
    } catch { return null; }
  }

  window.__idbStore = {
    openDb, putBlob, getBlob, delBlob, listIds,
    externalizeHtml, rehydrateHtml,
    externalizeState, rehydrateState,
    resolveIdbRefsInDom,
    gcUnusedBlobs, getStats,
    collectRefs,
    _DEFAULT_MIN_BYTES: DEFAULT_MIN_BYTES,
  };
})();
