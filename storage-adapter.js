/* JustANotepad — Storage Adapter Layer
 *
 * 사용자 자체 클라우드 동기화 (BYOC) 를 위한 어댑터 패턴 기반 추상화.
 *
 * 모든 어댑터는 StorageAdapter 계약을 만족해야 한다:
 *   - path: 상대경로 ("notes/abc.json", "calendar/events.json")
 *   - data: string | Uint8Array
 *
 * 외부에서는 StorageManager.getActive() 로 활성 어댑터를 얻어 사용.
 * 활성 어댑터 선택은 localStorage['jan.storage.provider'] 에 저장.
 *   'local' | 'dropbox' | 'supabase' | 'gdrive' | 'onedrive' | 'none'
 *
 * 데이터 파일 구조 (모든 어댑터 공통):
 *   JustANotepad/
 *   ├── _meta.json
 *   ├── notes/<id>.json
 *   ├── calendar/events.json
 *   ├── todos/tasks.json
 *   └── settings.json
 */
(function () {
  'use strict';

  const STORAGE_SCHEMA_VERSION = '1.0';
  const STORAGE_SCHEMA_NAME = 'jan-v1';
  const ACTIVE_PROVIDER_KEY = 'jan.storage.provider';
  const DEVICE_ID_KEY = 'jan.storage.deviceId';

  /**
   * 베이스 클래스 — 모든 어댑터가 구현해야 할 인터페이스.
   */
  class StorageAdapter {
    constructor(name) {
      this.name = name;          // 'local' | 'dropbox' | 'supabase-legacy' | ...
      this._status = {
        connected: false,
        provider: name,
        identity: null,
        error: null
      };
    }
    async init(/* config */) { throw new Error(this.name + ': init() not implemented'); }
    async isReady() { return this._status.connected; }
    async list(/* prefix */) { throw new Error(this.name + ': list() not implemented'); }
    async read(/* path */) { throw new Error(this.name + ': read() not implemented'); }
    async write(/* path, data, mtime */) { throw new Error(this.name + ': write() not implemented'); }
    async delete(/* path */) { throw new Error(this.name + ': delete() not implemented'); }
    async watch(/* onChange */) { /* noop by default */ return () => {}; }
    async disconnect() { this._status.connected = false; }
    getStatus() { return { ...this._status }; }

    // 유틸 — 구현체가 쓸 수 있도록
    _setStatus(patch) { this._status = { ...this._status, ...patch }; }
  }

  /**
   * StorageManager 싱글톤
   *   - 어댑터 등록 / 활성 어댑터 교체 / 이벤트 버스
   */
  class StorageManager {
    constructor() {
      this._adapters = new Map();     // name -> adapter instance
      this._active = null;            // 현재 활성 어댑터 인스턴스
      this._listeners = new Set();    // change listener functions
    }

    register(adapter) {
      if (!(adapter instanceof StorageAdapter)) {
        throw new Error('register: not a StorageAdapter instance');
      }
      this._adapters.set(adapter.name, adapter);
      return adapter;
    }

    list() {
      return Array.from(this._adapters.keys());
    }

    get(name) {
      return this._adapters.get(name) || null;
    }

    getActive() {
      return this._active;
    }

    getActiveName() {
      try { return localStorage.getItem(ACTIVE_PROVIDER_KEY) || 'none'; }
      catch { return 'none'; }
    }

    async setActive(name, config) {
      const next = this._adapters.get(name);
      if (!next && name !== 'none') {
        throw new Error('Unknown storage provider: ' + name);
      }
      // disconnect previous
      if (this._active && this._active !== next) {
        try { await this._active.disconnect(); } catch (e) { console.warn('[Storage] disconnect err', e); }
      }
      try { localStorage.setItem(ACTIVE_PROVIDER_KEY, name); } catch {}
      if (name === 'none') {
        this._active = null;
        this._emit({ type: 'active-changed', provider: 'none' });
        return null;
      }
      this._active = next;
      try { await next.init(config || {}); }
      catch (e) {
        console.warn('[Storage] init failed for', name, e);
        next._setStatus({ connected: false, error: e && e.message });
        this._emit({ type: 'active-changed', provider: name, error: e && e.message });
        throw e;
      }
      this._emit({ type: 'active-changed', provider: name });
      return next;
    }

    on(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
    _emit(evt) { for (const fn of this._listeners) { try { fn(evt); } catch {} } }

    // Device ID — 충돌·병합용
    getDeviceId() {
      let id = null;
      try { id = localStorage.getItem(DEVICE_ID_KEY); } catch {}
      if (!id) {
        id = 'd_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
        try { localStorage.setItem(DEVICE_ID_KEY, id); } catch {}
      }
      return id;
    }

    // 메타파일 기본값
    defaultMeta() {
      return {
        version: STORAGE_SCHEMA_VERSION,
        schema: STORAGE_SCHEMA_NAME,
        lastSync: 0,
        deviceId: this.getDeviceId()
      };
    }
  }

  /**
   * 데이터 포맷 유틸 — legacy sticky-memo-v4 블롭 → 파일 단위 분리
   *   notes/<id>.json, calendar/events.json, todos/tasks.json, settings.json
   */
  const DataMap = {
    /**
     * legacy blob → virtual file map { path: data }
     */
    blobToFiles(blob) {
      const files = {};
      if (!blob || typeof blob !== 'object') return files;

      // Notes — 키 이름이 과거에 여러 가지로 쓰였을 수 있어 폭넓게 수용
      const notes = Array.isArray(blob.notes) ? blob.notes
                  : Array.isArray(blob.memos) ? blob.memos
                  : Array.isArray(blob.tabs)  ? blob.tabs
                  : [];
      for (const n of notes) {
        const id = n && (n.id || n.uuid || n.key);
        if (!id) continue;
        files['notes/' + sanitizeId(id) + '.json'] = JSON.stringify(n);
      }

      // Calendar
      if (blob.calendar || blob.events || blob.calendarEvents) {
        const ev = blob.calendar || blob.events || blob.calendarEvents;
        files['calendar/events.json'] = JSON.stringify(ev);
      }
      // Todos / tasks
      if (blob.todos || blob.tasks) {
        files['todos/tasks.json'] = JSON.stringify(blob.todos || blob.tasks);
      }
      // Settings — 알려진 설정 키들
      const settings = {};
      const settingKeys = ['showLunar', 'theme', 'lang', 'fontSize', 'autoSave'];
      for (const k of settingKeys) if (k in blob) settings[k] = blob[k];
      if (Object.keys(settings).length) {
        files['settings.json'] = JSON.stringify(settings);
      }
      return files;
    },

    /**
     * virtual file map → legacy blob
     */
    filesToBlob(files) {
      const blob = { notes: [] };
      for (const [p, raw] of Object.entries(files)) {
        try {
          const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (p.startsWith('notes/')) {
            blob.notes.push(obj);
          } else if (p === 'calendar/events.json') {
            blob.calendar = obj;
          } else if (p === 'todos/tasks.json') {
            blob.todos = obj;
          } else if (p === 'settings.json') {
            Object.assign(blob, obj);
          }
        } catch (e) { console.warn('[DataMap] parse fail', p, e); }
      }
      return blob;
    }
  };

  function sanitizeId(raw) {
    // 한글·특수문자 안전하게 — path 는 UUID/slug 기반으로
    return String(raw).replace(/[^\w\-]/g, '_').slice(0, 80);
  }

  // 전역 노출
  const mgr = new StorageManager();
  window.JANStorage = {
    Adapter: StorageAdapter,
    Manager: mgr,
    DataMap,
    schemaVersion: STORAGE_SCHEMA_VERSION,
    // 편의 함수
    register: (a) => mgr.register(a),
    getActive: () => mgr.getActive(),
    getActiveName: () => mgr.getActiveName(),
    setActive: (n, c) => mgr.setActive(n, c),
    on: (fn) => mgr.on(fn),
    deviceId: () => mgr.getDeviceId(),
    defaultMeta: () => mgr.defaultMeta()
  };
})();
