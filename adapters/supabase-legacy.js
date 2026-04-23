/* JustANotepad — Supabase Legacy Storage Adapter
 *
 * 기존 단일 블롭 (user_data 테이블의 JSONB) 구조를 어댑터 인터페이스로 감싼다.
 *   - list/read/write 를 파일 단위 API 로 제공하지만
 *     실제로는 메모리 내 블롭을 가상 파일 맵으로 펼쳐서 다룸.
 *   - write 시 debounced 로 upsert 한 번에 밀어넣음.
 *
 * 이 어댑터의 존재 이유:
 *   1) 기존 사용자가 기존 데이터를 계속 쓸 수 있도록 호환
 *   2) 새 구조로의 마이그레이션 소스
 *   3) BYOC 가 부담스러운 사용자를 위한 "관리형 백엔드" 옵션
 */
(function () {
  'use strict';
  if (!window.JANStorage || !window.JANStorage.Adapter) return;

  const DataMap = window.JANStorage.DataMap;

  class SupabaseLegacyAdapter extends window.JANStorage.Adapter {
    constructor() {
      super('supabase');
      this._supabase = null;
      this._session = null;
      this._files = {};          // 가상 파일 맵 (경로 → 문자열)
      this._pendingWrite = null; // debounced flush timer
      this._lastPulledAt = 0;
    }

    _getSupabase() {
      // sync.js 가 초기화한 client 재사용
      if (window.JANSync && typeof window.JANSync.getSupabase === 'function') {
        return window.JANSync.getSupabase();
      }
      return null;
    }

    _getSession() {
      if (window.JANSync && typeof window.JANSync.getSession === 'function') {
        return window.JANSync.getSession();
      }
      return null;
    }

    async init() {
      this._supabase = this._getSupabase();
      this._session = this._getSession();
      if (!this._supabase) throw new Error('Supabase client 가 초기화되지 않았습니다 (sync.js 로딩 필요)');
      if (!this._session) {
        this._setStatus({ connected: false, error: 'not-signed-in' });
        throw new Error('Supabase: 로그인되지 않음');
      }
      await this._pull();
      this._setStatus({ connected: true, identity: this._session.user.email || this._session.user.id, error: null });
    }

    async _pull() {
      const r = await this._supabase.from('user_data')
        .select('data, updated_at')
        .eq('user_id', this._session.user.id)
        .maybeSingle();
      if (r.error) throw r.error;
      const blob = (r.data && r.data.data) || null;
      this._files = blob ? DataMap.blobToFiles(blob) : {};
      this._lastPulledAt = Date.now();
    }

    async _pushSoon() {
      clearTimeout(this._pendingWrite);
      this._pendingWrite = setTimeout(() => this._flush().catch(e => console.warn('[SupabaseLegacy] flush err', e)), 2000);
    }

    async _flush() {
      const blob = DataMap.filesToBlob(this._files);
      const r = await this._supabase.from('user_data').upsert({
        user_id: this._session.user.id,
        data: blob,
        updated_at: new Date().toISOString()
      });
      if (r.error) throw r.error;
    }

    async list(prefix = '') {
      return Object.keys(this._files)
        .filter(p => p.startsWith(prefix))
        .map(p => ({ path: p, size: this._files[p].length, mtime: this._lastPulledAt }));
    }

    async read(path) {
      if (!(path in this._files)) return null;
      return { data: this._files[path], mtime: this._lastPulledAt };
    }

    async write(path, data /* , mtime */) {
      this._files[path] = (data instanceof Uint8Array)
        ? new TextDecoder().decode(data)
        : String(data);
      await this._pushSoon();
      return { ok: true };
    }

    async delete(path) {
      if (path in this._files) {
        delete this._files[path];
        await this._pushSoon();
      }
    }

    async watch(onChange) {
      // realtime: sync.js 가 이미 채널을 구독하고 있으니, 그 이벤트를 받아 pull → diff → 알림.
      const handler = async () => {
        const prev = { ...this._files };
        try { await this._pull(); } catch { return; }
        const keys = new Set([...Object.keys(prev), ...Object.keys(this._files)]);
        for (const k of keys) {
          if (!(k in prev)) onChange({ type: 'add', path: k });
          else if (!(k in this._files)) onChange({ type: 'delete', path: k });
          else if (prev[k] !== this._files[k]) onChange({ type: 'modify', path: k });
        }
      };
      window.addEventListener('jan-sync-remote-change', handler);
      return () => window.removeEventListener('jan-sync-remote-change', handler);
    }

    async disconnect() {
      clearTimeout(this._pendingWrite);
      this._setStatus({ connected: false });
    }

    async flushNow() {
      clearTimeout(this._pendingWrite);
      await this._flush();
    }

    isConfigured() { return !!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY); }
  }

  const inst = new SupabaseLegacyAdapter();
  window.JANStorage.register(inst);
  window.JANStorage.adapters = window.JANStorage.adapters || {};
  window.JANStorage.adapters.supabase = inst;
})();
