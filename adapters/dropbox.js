/* JustANotepad — Dropbox Storage Adapter
 *
 * OAuth 2.0 PKCE flow (client secret 노출 없이 브라우저에서 안전).
 * 앱 폴더 타입 권한 → /Apps/JustANotepad/ 하위에만 접근.
 *
 * 설정:
 *   window.DROPBOX_CLIENT_ID = 'xxxxxxx';  // config.js 또는 build-time 주입
 *   미설정 시 MVP placeholder 로 동작 — UI flow 는 시연 가능, 실제 토큰 교환은 실패.
 *
 * 리다이렉트 URL (Dropbox App Console 에 등록):
 *   - https://justanotepad.com/oauth/dropbox/callback
 *   - justanotepad://oauth/dropbox/callback  (Tauri deep link)
 */
(function () {
  'use strict';
  if (!window.JANStorage || !window.JANStorage.Adapter) {
    console.warn('[Dropbox] storage-adapter.js 선행 로딩 필요'); return;
  }

  const TOKEN_KEY = 'jan.dropbox.token';
  const REFRESH_KEY = 'jan.dropbox.refresh';
  const EXPIRES_KEY = 'jan.dropbox.expires';
  const PKCE_KEY = 'jan.dropbox.pkce';
  const APP_FOLDER_PREFIX = '';  // 앱 폴더 권한 — 루트가 곧 /Apps/JustANotepad

  const CLIENT_ID_PLACEHOLDER = 'DROPBOX_CLIENT_ID_PLACEHOLDER';

  function getClientId() {
    return (window.DROPBOX_CLIENT_ID || '').trim() || CLIENT_ID_PLACEHOLDER;
  }

  function getRedirectUri() {
    // Tauri 환경은 deep link 사용
    if (window.__TAURI__ || window.__TAURI_INTERNALS__) {
      return 'justanotepad://oauth/dropbox/callback';
    }
    return location.origin + '/oauth/dropbox/callback';
  }

  /* ==== PKCE 헬퍼 ==== */
  function randomString(len) {
    const bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => ('0' + b.toString(16)).slice(-2)).join('');
  }
  async function sha256b64url(str) {
    const buf = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    const arr = new Uint8Array(hash);
    let bin = '';
    for (const b of arr) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /* ==== 토큰 저장/로드 ==== */
  function saveTokens({ access_token, refresh_token, expires_in }) {
    try {
      if (access_token) localStorage.setItem(TOKEN_KEY, access_token);
      if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
      if (expires_in) localStorage.setItem(EXPIRES_KEY, String(Date.now() + expires_in * 1000));
    } catch {}
  }
  function loadTokens() {
    try {
      return {
        access_token: localStorage.getItem(TOKEN_KEY) || '',
        refresh_token: localStorage.getItem(REFRESH_KEY) || '',
        expires_at: parseInt(localStorage.getItem(EXPIRES_KEY) || '0', 10)
      };
    } catch { return { access_token: '', refresh_token: '', expires_at: 0 }; }
  }
  function clearTokens() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(EXPIRES_KEY);
    } catch {}
  }

  /* ==== Fetch 래퍼 — 401 시 refresh 한번 재시도 ==== */
  async function ensureAccessToken(adapter) {
    const t = loadTokens();
    if (t.access_token && Date.now() < t.expires_at - 30_000) return t.access_token;
    if (t.refresh_token) {
      const ok = await refreshAccessToken(t.refresh_token);
      if (ok) return loadTokens().access_token;
    }
    adapter._setStatus({ connected: false, error: 'token-expired' });
    throw new Error('Dropbox: access token 없음/만료. 다시 로그인 필요.');
  }

  async function refreshAccessToken(refreshToken) {
    const id = getClientId();
    if (id === CLIENT_ID_PLACEHOLDER) return false;
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: id
    });
    const r = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    if (!r.ok) return false;
    const j = await r.json();
    saveTokens(j);
    return true;
  }

  /* ==== 어댑터 ==== */
  class DropboxAdapter extends window.JANStorage.Adapter {
    constructor() {
      super('dropbox');
      this._accountInfo = null;
    }

    async init() {
      const t = loadTokens();
      if (!t.access_token && !t.refresh_token) {
        this._setStatus({ connected: false, error: 'not-signed-in' });
        throw new Error('Dropbox: 로그인 필요. startOAuth() 호출');
      }
      // identity 조회 (작동 확인)
      try {
        await this._call('/2/users/get_current_account', {});
        this._setStatus({ connected: true, identity: (this._accountInfo && this._accountInfo.email) || 'dropbox', error: null });
      } catch (e) {
        this._setStatus({ connected: false, error: e.message });
        throw e;
      }
    }

    /**
     * OAuth PKCE flow 시작 — Dropbox authorize 페이지로 리다이렉트.
     * 콜백에서 handleOAuthCallback() 호출 필요.
     */
    async startOAuth() {
      const id = getClientId();
      if (id === CLIENT_ID_PLACEHOLDER) {
        throw new Error('Dropbox Client ID 가 등록되지 않았습니다. Dropbox App Console 에서 앱을 만들고 config.js 의 window.DROPBOX_CLIENT_ID 를 설정하세요. (https://www.dropbox.com/developers/apps)');
      }
      const verifier = randomString(48);
      const challenge = await sha256b64url(verifier);
      const state = randomString(16);
      try { sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state })); } catch {}

      const redirect = getRedirectUri();
      const url = new URL('https://www.dropbox.com/oauth2/authorize');
      url.searchParams.set('client_id', id);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('redirect_uri', redirect);
      url.searchParams.set('code_challenge', challenge);
      url.searchParams.set('code_challenge_method', 'S256');
      url.searchParams.set('state', state);
      url.searchParams.set('token_access_type', 'offline');  // refresh token 도 받음
      // Tauri 는 외부 브라우저로, 웹은 현재 탭으로
      if (window.__TAURI__ && window.__TAURI__.shell && window.__TAURI__.shell.open) {
        await window.__TAURI__.shell.open(url.toString());
      } else {
        location.href = url.toString();
      }
    }

    /**
     * 리다이렉트 콜백 페이지/핸들러에서 호출.
     * URL query 의 ?code=, ?state= 를 가져와 토큰 교환.
     */
    async handleOAuthCallback(searchParams) {
      const params = (typeof searchParams === 'string')
        ? new URLSearchParams(searchParams.replace(/^\?/, ''))
        : searchParams;
      const code = params.get('code');
      const state = params.get('state');
      const err = params.get('error');
      if (err) throw new Error('Dropbox OAuth 오류: ' + err);
      if (!code) throw new Error('Dropbox OAuth: code 누락');

      let saved = null;
      try { saved = JSON.parse(sessionStorage.getItem(PKCE_KEY) || 'null'); } catch {}
      if (!saved || saved.state !== state) {
        throw new Error('Dropbox OAuth: state 불일치 (CSRF 방어)');
      }
      sessionStorage.removeItem(PKCE_KEY);

      const id = getClientId();
      const body = new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: id,
        code_verifier: saved.verifier,
        redirect_uri: getRedirectUri()
      });
      const r = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        throw new Error('Dropbox 토큰 교환 실패: ' + r.status + ' ' + t);
      }
      const tok = await r.json();
      saveTokens(tok);
      await this.init();
      return { ok: true };
    }

    /* ==== Dropbox API call 헬퍼 ==== */
    async _call(endpoint, args, opts = {}) {
      const tok = await ensureAccessToken(this);
      const headers = { 'Authorization': 'Bearer ' + tok };
      let body;
      if (opts.contentType === 'octet') {
        headers['Content-Type'] = 'application/octet-stream';
        headers['Dropbox-API-Arg'] = JSON.stringify(args);
        body = opts.body;
      } else if (opts.downloadContent) {
        headers['Dropbox-API-Arg'] = JSON.stringify(args);
        // body 없음
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(args);
      }
      const host = opts.contentHost ? 'content.dropboxapi.com' : 'api.dropboxapi.com';
      const r = await fetch('https://' + host + endpoint, { method: 'POST', headers, body });
      if (r.status === 401) {
        // refresh 후 1회 재시도
        const t = loadTokens();
        if (t.refresh_token && await refreshAccessToken(t.refresh_token)) {
          return this._call(endpoint, args, opts);
        }
        throw new Error('Dropbox 401 — 재인증 필요');
      }
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        throw new Error('Dropbox ' + endpoint + ' ' + r.status + ': ' + txt);
      }
      if (endpoint === '/2/users/get_current_account') {
        const j = await r.json();
        this._accountInfo = j;
        return j;
      }
      if (opts.downloadContent) {
        const meta = r.headers.get('dropbox-api-result');
        const data = await r.arrayBuffer();
        return { meta: meta ? JSON.parse(meta) : null, data };
      }
      const ct = r.headers.get('content-type') || '';
      if (ct.includes('application/json')) return r.json();
      return r.text();
    }

    _toDropboxPath(path) {
      // 앱 폴더 타입이면 root 가 자동으로 /Apps/JustANotepad
      const clean = String(path).replace(/^\/+/, '');
      return '/' + clean;
    }

    async list(prefix = '') {
      const path = this._toDropboxPath(prefix).replace(/\/+$/, '');
      try {
        const r = await this._call('/2/files/list_folder', {
          path: path === '/' ? '' : path,
          recursive: true,
          include_deleted: false
        });
        return (r.entries || [])
          .filter(e => e['.tag'] === 'file')
          .map(e => ({
            path: e.path_display.replace(/^\//, ''),
            size: e.size || 0,
            mtime: e.server_modified ? new Date(e.server_modified).getTime() : 0
          }));
      } catch (e) {
        if (/not_found/.test(e.message)) return [];
        throw e;
      }
    }

    async read(path) {
      try {
        const { data, meta } = await this._call('/2/files/download', { path: this._toDropboxPath(path) }, {
          contentHost: true,
          downloadContent: true
        });
        const text = new TextDecoder().decode(data);
        const mtime = meta && meta.server_modified ? new Date(meta.server_modified).getTime() : 0;
        return { data: text, mtime };
      } catch (e) {
        if (/not_found|path\/not_found/.test(e.message)) return null;
        throw e;
      }
    }

    async write(path, data /* , mtime */) {
      const body = (data instanceof Uint8Array)
        ? data
        : new TextEncoder().encode(String(data));
      await this._call('/2/files/upload', {
        path: this._toDropboxPath(path),
        mode: 'overwrite',
        mute: true
      }, { contentType: 'octet', contentHost: true, body });
      return { ok: true };
    }

    async delete(path) {
      try {
        await this._call('/2/files/delete_v2', { path: this._toDropboxPath(path) });
      } catch (e) {
        if (!/not_found/.test(e.message)) throw e;
      }
    }

    // Dropbox longpoll 가능하나 복잡 — polling 으로 충분
    async watch(onChange) {
      let cursor = null;
      let stopped = false;
      const poll = async () => {
        while (!stopped) {
          try {
            if (!cursor) {
              const r = await this._call('/2/files/list_folder', { path: '', recursive: true });
              cursor = r.cursor;
              // 초기 baseline — 이벤트 발생 안 함
            } else {
              const r = await this._call('/2/files/list_folder/continue', { cursor });
              cursor = r.cursor;
              for (const e of r.entries || []) {
                const type = e['.tag'] === 'deleted' ? 'delete'
                          : (e['.tag'] === 'file' ? 'modify' : null);
                if (!type) continue;
                if (onChange) onChange({ type, path: e.path_display.replace(/^\//, '') });
              }
            }
          } catch (e) { /* 잠시 후 재시도 */ }
          await new Promise(r => setTimeout(r, 15_000));
        }
      };
      poll();
      return () => { stopped = true; };
    }

    async disconnect() {
      this._setStatus({ connected: false });
    }

    async signOut() {
      try { await this._call('/2/auth/token/revoke', null); } catch {}
      clearTokens();
      this._accountInfo = null;
      this._setStatus({ connected: false, identity: null });
    }

    isConfigured() { return getClientId() !== CLIENT_ID_PLACEHOLDER; }
    hasToken() { return !!loadTokens().access_token; }
  }

  const inst = new DropboxAdapter();
  window.JANStorage.register(inst);
  window.JANStorage.adapters = window.JANStorage.adapters || {};
  window.JANStorage.adapters.dropbox = inst;
})();
