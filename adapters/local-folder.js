/* JustANotepad — LocalFolder Storage Adapter
 *
 * 두 가지 환경을 지원:
 *   (a) Tauri 데스크톱 — @tauri-apps/plugin-fs 로 임의 경로 read/write
 *   (b) 웹 (Chrome/Edge) — File System Access API:
 *       showDirectoryPicker() → FileSystemDirectoryHandle → IndexedDB 저장
 *
 * 사용 패턴:
 *   Dropbox/OneDrive/Google Drive 의 데스크톱 앱이 특정 폴더를
 *   자동 동기화하므로, 그 폴더 하위를 선택하면 "파일만 쓰면
 *   자동으로 클라우드 동기화" 되는 효과를 얻는다.
 */
(function () {
  'use strict';

  if (!window.JANStorage || !window.JANStorage.Adapter) {
    console.warn('[LocalFolder] storage-adapter.js 선행 로딩 필요');
    return;
  }

  const IDB_NAME = 'jan-storage-handles';
  const IDB_STORE = 'handles';
  const HANDLE_KEY = 'localFolderRoot';
  const POLL_INTERVAL_MS = 5000;

  /* ==== IndexedDB 작은 헬퍼 (FSA 핸들 영속화) ==== */
  function idbOpen() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbPut(key, val) {
    const db = await idbOpen();
    return new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(val, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }
  async function idbGet(key) {
    const db = await idbOpen();
    return new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const rq = tx.objectStore(IDB_STORE).get(key);
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
  }
  async function idbDel(key) {
    const db = await idbOpen();
    return new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  /* ==== Tauri 감지 & FS API 래핑 ==== */
  function isTauri() {
    return !!(window.__TAURI__ || window.__TAURI_INTERNALS__ || window.__TAURI_METADATA__);
  }
  async function tauriFs() {
    if (!isTauri()) return null;
    try {
      // Tauri v2 plugin-fs 는 window.__TAURI__.fs 로 노출됨
      if (window.__TAURI__ && window.__TAURI__.fs) return window.__TAURI__.fs;
      // 동적 import (Tauri 번들 환경)
      const mod = await import('@tauri-apps/plugin-fs').catch(() => null);
      return mod;
    } catch { return null; }
  }

  /* ==== FSA — 디렉터리 핸들 헬퍼 ==== */
  async function ensureWritePermission(handle) {
    try {
      const opts = { mode: 'readwrite' };
      if ((await handle.queryPermission(opts)) === 'granted') return true;
      return (await handle.requestPermission(opts)) === 'granted';
    } catch (e) {
      console.warn('[LocalFolder] permission err', e);
      return false;
    }
  }

  async function getSubdirHandle(root, segments, create = true) {
    let h = root;
    for (const seg of segments) {
      if (!seg) continue;
      h = await h.getDirectoryHandle(seg, { create });
    }
    return h;
  }

  function splitPath(path) {
    const parts = String(path).split('/').filter(Boolean);
    const file = parts.pop();
    return { dirs: parts, file };
  }

  /* ==== 어댑터 구현 ==== */
  class LocalFolderAdapter extends window.JANStorage.Adapter {
    constructor() {
      super('local');
      this._root = null;        // FSA: FileSystemDirectoryHandle, Tauri: string (절대경로)
      this._mode = null;        // 'fsa' | 'tauri'
      this._pollTimer = null;
      this._mtimeCache = new Map();  // path -> mtime (polling 비교용)
      this._watchCb = null;
    }

    async init(/* config */) {
      if (isTauri()) {
        this._mode = 'tauri';
        // Tauri 는 고정 폴더 (Documents/JustANotepad) 기본값.
        // 향후 picker 연결 가능.
        const saved = localStorage.getItem('jan.storage.local.tauriRoot');
        this._root = saved || null;
        if (!this._root) {
          throw new Error('Tauri: 폴더가 선택되지 않았습니다. promptPickFolder() 를 먼저 호출하세요.');
        }
        const fs = await tauriFs();
        if (!fs) throw new Error('Tauri: plugin-fs 사용 불가');
        await fs.mkdir(this._root, { recursive: true }).catch(() => {});
        this._setStatus({ connected: true, identity: this._root, error: null });
        return;
      }
      // Web — FSA 복원
      if (!('showDirectoryPicker' in window)) {
        throw new Error('이 브라우저는 File System Access API 를 지원하지 않습니다 (Chrome/Edge 필요). Dropbox 방식을 써주세요.');
      }
      this._mode = 'fsa';
      const handle = await idbGet(HANDLE_KEY);
      if (!handle) {
        throw new Error('폴더가 선택되지 않았습니다. promptPickFolder() 호출 필요.');
      }
      const ok = await ensureWritePermission(handle);
      if (!ok) {
        throw new Error('폴더 접근 권한이 거부되었습니다.');
      }
      this._root = handle;
      this._setStatus({ connected: true, identity: handle.name, error: null });
    }

    /**
     * 사용자에게 폴더 선택 요청. 한 번 성공하면 IndexedDB 에 저장돼
     * 다음 실행 시 자동 복원.
     */
    async promptPickFolder() {
      if (this._mode === null) this._mode = isTauri() ? 'tauri' : 'fsa';
      if (this._mode === 'tauri') {
        const dialog = window.__TAURI__ && window.__TAURI__.dialog;
        if (!dialog) throw new Error('Tauri dialog plugin 없음');
        const picked = await dialog.open({ directory: true, multiple: false, title: 'JustANotepad 저장 폴더 선택' });
        if (!picked) throw new Error('사용자가 폴더 선택을 취소했습니다');
        localStorage.setItem('jan.storage.local.tauriRoot', picked);
        this._root = picked;
        this._setStatus({ connected: true, identity: picked });
        return picked;
      }
      // FSA
      if (!('showDirectoryPicker' in window)) {
        throw new Error('이 브라우저는 File System Access API 를 지원하지 않습니다.');
      }
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite',
        id: 'justanotepad-root'
      });
      await idbPut(HANDLE_KEY, handle);
      this._root = handle;
      this._setStatus({ connected: true, identity: handle.name });
      return handle.name;
    }

    async isReady() { return !!this._root; }

    /* ---- read ---- */
    async read(path) {
      if (!this._root) throw new Error('not-initialized');
      if (this._mode === 'tauri') {
        const fs = await tauriFs();
        const abs = this._root.replace(/\/+$/, '') + '/' + path;
        try {
          const text = await fs.readTextFile(abs);
          let mtime = 0;
          try { const st = await fs.stat(abs); mtime = (st.mtime && new Date(st.mtime).getTime()) || 0; } catch {}
          return { data: text, mtime };
        } catch (e) {
          if (String(e).match(/No such file|not found|ENOENT/i)) return null;
          throw e;
        }
      }
      // FSA
      try {
        const { dirs, file } = splitPath(path);
        const dir = await getSubdirHandle(this._root, dirs, false);
        const fh = await dir.getFileHandle(file, { create: false });
        const f = await fh.getFile();
        const text = await f.text();
        return { data: text, mtime: f.lastModified || 0 };
      } catch (e) {
        if (e && (e.name === 'NotFoundError' || /not found/i.test(e.message))) return null;
        throw e;
      }
    }

    /* ---- write ---- */
    async write(path, data /* , mtime */) {
      if (!this._root) throw new Error('not-initialized');
      if (this._mode === 'tauri') {
        const fs = await tauriFs();
        const abs = this._root.replace(/\/+$/, '') + '/' + path;
        const { dirs } = splitPath(path);
        if (dirs.length) {
          const parentAbs = this._root.replace(/\/+$/, '') + '/' + dirs.join('/');
          await fs.mkdir(parentAbs, { recursive: true }).catch(() => {});
        }
        if (data instanceof Uint8Array) {
          await fs.writeFile(abs, data);
        } else {
          await fs.writeTextFile(abs, String(data));
        }
        return { ok: true };
      }
      // FSA
      const { dirs, file } = splitPath(path);
      const dir = await getSubdirHandle(this._root, dirs, true);
      const fh = await dir.getFileHandle(file, { create: true });
      const w = await fh.createWritable();
      try {
        if (data instanceof Uint8Array) await w.write(data);
        else await w.write(String(data));
      } finally {
        await w.close();
      }
      return { ok: true };
    }

    /* ---- delete ---- */
    async delete(path) {
      if (!this._root) throw new Error('not-initialized');
      if (this._mode === 'tauri') {
        const fs = await tauriFs();
        const abs = this._root.replace(/\/+$/, '') + '/' + path;
        try { await fs.remove(abs); } catch (e) { if (!/not found|ENOENT/i.test(String(e))) throw e; }
        return;
      }
      const { dirs, file } = splitPath(path);
      try {
        const dir = await getSubdirHandle(this._root, dirs, false);
        await dir.removeEntry(file);
      } catch (e) {
        if (e && e.name !== 'NotFoundError') throw e;
      }
    }

    /* ---- list (prefix) ---- */
    async list(prefix = '') {
      if (!this._root) throw new Error('not-initialized');
      const out = [];
      if (this._mode === 'tauri') {
        const fs = await tauriFs();
        const baseAbs = this._root.replace(/\/+$/, '') + (prefix ? '/' + prefix.replace(/\/+$/, '') : '');
        async function walk(abs, rel) {
          let entries;
          try { entries = await fs.readDir(abs); } catch { return; }
          for (const e of entries) {
            const childAbs = abs.replace(/\/+$/, '') + '/' + e.name;
            const childRel = rel ? rel + '/' + e.name : e.name;
            if (e.isDirectory || e.children) {
              await walk(childAbs, childRel);
            } else {
              let size = 0, mtime = 0;
              try { const st = await fs.stat(childAbs); size = st.size || 0; mtime = (st.mtime && new Date(st.mtime).getTime()) || 0; } catch {}
              out.push({ path: (prefix ? prefix.replace(/\/+$/, '') + '/' : '') + childRel, size, mtime });
            }
          }
        }
        await walk(baseAbs, '');
        return out;
      }
      // FSA — 재귀 순회
      async function walk(dirH, rel) {
        for await (const [name, h] of dirH.entries()) {
          const childRel = rel ? rel + '/' + name : name;
          if (h.kind === 'directory') {
            await walk(h, childRel);
          } else {
            try {
              const f = await h.getFile();
              out.push({ path: childRel, size: f.size, mtime: f.lastModified || 0 });
            } catch {}
          }
        }
      }
      const startDir = prefix
        ? await getSubdirHandle(this._root, prefix.split('/').filter(Boolean), false).catch(() => null)
        : this._root;
      if (!startDir) return [];
      await walk(startDir, prefix ? prefix.replace(/\/+$/, '') : '');
      return out;
    }

    /* ---- watch (polling) ----
     * Tauri plugin-fs 에 watch API 가 있으나 Linux/Win 지원 편차 있어 단순 폴링.
     */
    async watch(onChange) {
      this._watchCb = onChange;
      if (this._pollTimer) clearInterval(this._pollTimer);
      const tick = async () => {
        if (!this._root) return;
        try {
          const items = await this.list('');
          const seen = new Set();
          for (const it of items) {
            seen.add(it.path);
            const prev = this._mtimeCache.get(it.path);
            if (prev == null) {
              this._mtimeCache.set(it.path, it.mtime);
              if (onChange) onChange({ type: 'add', path: it.path, mtime: it.mtime });
            } else if (prev !== it.mtime) {
              this._mtimeCache.set(it.path, it.mtime);
              if (onChange) onChange({ type: 'modify', path: it.path, mtime: it.mtime });
            }
          }
          // 삭제 감지
          for (const [p] of this._mtimeCache) {
            if (!seen.has(p)) {
              this._mtimeCache.delete(p);
              if (onChange) onChange({ type: 'delete', path: p });
            }
          }
        } catch (e) { /* 폴링 오류는 무시 */ }
      };
      tick();  // 초기 baseline
      this._pollTimer = setInterval(tick, POLL_INTERVAL_MS);
      return () => { clearInterval(this._pollTimer); this._pollTimer = null; this._watchCb = null; };
    }

    async disconnect() {
      if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
      this._mtimeCache.clear();
      this._setStatus({ connected: false });
    }

    /* 유틸 — 핸들 완전 해제 (외부에서 "연결 해제" 버튼용) */
    async forgetFolder() {
      await this.disconnect();
      if (this._mode === 'fsa') await idbDel(HANDLE_KEY);
      else localStorage.removeItem('jan.storage.local.tauriRoot');
      this._root = null;
      this._setStatus({ connected: false, identity: null });
    }
  }

  // 등록
  const inst = new LocalFolderAdapter();
  window.JANStorage.register(inst);
  window.JANStorage.adapters = window.JANStorage.adapters || {};
  window.JANStorage.adapters.local = inst;
})();
