/* JustANotepad Cloud Sync v3
 *
 * 변경 사항 (v2 → v3):
 *   - StorageManager 어댑터 체계와 통합
 *   - 기존 Supabase 단일 블롭 동작은 'supabase' 어댑터로 캡슐화
 *   - 활성 어댑터가 'none' 이 아닌 경우에만 동기화 수행
 *   - 기존 JANSync.* API 는 호환 유지:
 *       init(), ready(), getSession(), getSupabase(),
 *       signInGoogle/Kakao/Github/Email, signOut, syncNow, pullNow
 *   - 신규:
 *       JANSync.provider       현재 활성 provider 이름
 *       JANSync.setProvider(n) 교체 + 마이그레이션 훅
 *       JANSync.migrateLegacyToActive()
 *       JANSync.listFiles(prefix), readFile(path), writeFile(path, data)
 */
(function () {
  'use strict';

  const CONFIG = {
    url: window.SUPABASE_URL || '',
    anon: window.SUPABASE_ANON_KEY || ''
  };

  const SUPABASE_AVAILABLE = !!(CONFIG.url && CONFIG.anon);

  /* Supabase 미설정이어도 어댑터 매니저는 동작해야 하므로 early-return 하지 않음.
     대신 getSupabase() 등이 null 을 반환. */

  let supabase = null;
  let session = null;
  let syncing = false;
  let lastSyncAt = 0;
  let realtimeChannel = null;
  let afterLoginRan = false;
  let afterLoginRunning = false;

  let readyResolve = null;
  const readyPromise = new Promise(r => { readyResolve = r; });

  /* ==== 기존 동작 유지 (Supabase 단일 블롭) ==== */

  async function loadSDK() {
    if (window.supabase) return window.supabase;
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      s.onload = () => resolve(window.supabase);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function updateUI() {
    window.dispatchEvent(new CustomEvent('jan-auth-change', { detail: { session } }));
  }

  function getStateJSON() {
    try { return JSON.parse(localStorage.getItem('sticky-memo-v4') || 'null'); }
    catch { return null; }
  }

  async function getStateForUpload() {
    const data = getStateJSON();
    if (!data) return null;
    try {
      if (window.__idbStore && window.__idbStore.rehydrateState) {
        await window.__idbStore.rehydrateState(data);
      }
    } catch (e) { console.warn('[Sync] rehydrate 실패', e); }
    return data;
  }

  function showToast(msg, dur) {
    if (typeof window.toast === 'function') window.toast(msg, dur || 4000);
    else console.log('[Sync]', msg);
  }

  async function pushToCloud() {
    // 활성 어댑터가 있으면 그걸로 라우팅. 없으면 기존 supabase 블롭 방식.
    const activeName = (window.JANStorage && window.JANStorage.getActiveName && window.JANStorage.getActiveName()) || 'none';
    if (activeName && activeName !== 'none' && activeName !== 'supabase') {
      return pushViaAdapter();
    }
    // 기본: Supabase 블롭
    if (!session || syncing || !supabase) return { ok: false, reason: 'no-session-or-client' };
    const data = await getStateForUpload();
    if (!data) return { ok: false, reason: 'no-data' };
    syncing = true;
    try {
      const { error } = await supabase.from('user_data').upsert({
        user_id: session.user.id,
        data,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      lastSyncAt = Date.now();
      try { localStorage.setItem('jan.sync.lastAt', String(lastSyncAt)); } catch {}
      try { window.dispatchEvent(new CustomEvent('jan-sync-done', { detail: { at: lastSyncAt } })); } catch {}
      console.log('[Sync] 업로드 완료 (legacy blob)');
      return { ok: true };
    } catch (e) {
      console.warn('[Sync] 업로드 실패:', e.message);
      return { ok: false, error: e.message };
    } finally { syncing = false; }
  }

  async function pullFromCloud() {
    const activeName = (window.JANStorage && window.JANStorage.getActiveName && window.JANStorage.getActiveName()) || 'none';
    if (activeName && activeName !== 'none' && activeName !== 'supabase') {
      return pullViaAdapter();
    }
    if (!session || !supabase) return null;
    try {
      const { data, error } = await supabase
        .from('user_data')
        .select('data, updated_at')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('[Sync] 다운로드 실패:', e.message);
      return null;
    }
  }

  /* ==== 어댑터 기반 동기화 ==== */

  async function pushViaAdapter() {
    const a = window.JANStorage.getActive();
    if (!a) return { ok: false, reason: 'no-active-adapter' };
    try {
      const blob = await getStateForUpload();
      if (!blob) return { ok: false, reason: 'no-data' };
      const files = window.JANStorage.DataMap.blobToFiles(blob);
      // meta
      files['_meta.json'] = JSON.stringify(Object.assign(window.JANStorage.defaultMeta(), {
        lastSync: Date.now()
      }));
      // 변경된 것만 쓰면 최적이지만 MVP 는 전부 write
      for (const [path, data] of Object.entries(files)) {
        await a.write(path, data);
      }
      lastSyncAt = Date.now();
      try { localStorage.setItem('jan.sync.lastAt', String(lastSyncAt)); } catch {}
      try { window.dispatchEvent(new CustomEvent('jan-sync-done', { detail: { at: lastSyncAt, provider: a.name } })); } catch {}
      console.log('[Sync] 어댑터 업로드 완료:', a.name, Object.keys(files).length, '파일');
      return { ok: true };
    } catch (e) {
      console.warn('[Sync] 어댑터 업로드 실패:', e);
      return { ok: false, error: e.message };
    }
  }

  async function pullViaAdapter() {
    const a = window.JANStorage.getActive();
    if (!a) return null;
    try {
      const items = await a.list('');
      const files = {};
      for (const it of items) {
        if (it.path === '_meta.json') continue;
        const r = await a.read(it.path);
        if (r) files[it.path] = r.data;
      }
      const blob = window.JANStorage.DataMap.filesToBlob(files);
      return { data: blob, updated_at: new Date().toISOString() };
    } catch (e) {
      console.warn('[Sync] 어댑터 다운로드 실패:', e);
      return null;
    }
  }

  /* ==== 파일 단위 API (신규) ==== */

  async function listFiles(prefix = '') {
    const a = window.JANStorage.getActive();
    if (!a) return [];
    return a.list(prefix);
  }
  async function readFile(path) {
    const a = window.JANStorage.getActive();
    if (!a) return null;
    return a.read(path);
  }
  async function writeFile(path, data) {
    const a = window.JANStorage.getActive();
    if (!a) throw new Error('활성 저장소 어댑터 없음');
    return a.write(path, data);
  }

  /* ==== 마이그레이션: Supabase legacy blob → 현재 활성 어댑터 ==== */

  async function migrateLegacyToActive(opts = {}) {
    const a = window.JANStorage.getActive();
    if (!a) throw new Error('활성 어댑터 없음. 먼저 provider 를 선택하세요.');
    if (a.name === 'supabase') throw new Error('이미 Supabase 어댑터를 쓰고 있습니다.');
    if (!supabase || !session) throw new Error('Supabase 세션 없음');
    const { data, error } = await supabase
      .from('user_data')
      .select('data, updated_at')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data || !data.data) return { ok: true, migrated: 0, reason: 'no-legacy-data' };
    const files = window.JANStorage.DataMap.blobToFiles(data.data);
    files['_meta.json'] = JSON.stringify(Object.assign(window.JANStorage.defaultMeta(), {
      lastSync: Date.now(),
      migratedFrom: 'supabase-legacy',
      migratedAt: new Date().toISOString()
    }));
    let i = 0;
    const total = Object.keys(files).length;
    for (const [p, d] of Object.entries(files)) {
      await a.write(p, d);
      i++;
      if (opts.onProgress) opts.onProgress({ done: i, total });
    }
    return { ok: true, migrated: i };
  }

  /* ==== 활성 provider 교체 ==== */

  async function setProvider(name, config) {
    if (!window.JANStorage) throw new Error('storage-adapter.js 로딩 전');
    if (name === 'supabase' && !session) {
      throw new Error('Supabase provider 는 로그인 필요');
    }
    await window.JANStorage.setActive(name, config);
    window.dispatchEvent(new CustomEvent('jan-storage-provider-change', { detail: { provider: name } }));
  }

  /* ==== 기존 afterLogin 로직 (Supabase 세션 기반) ==== */

  async function afterLogin() {
    if (afterLoginRan || afterLoginRunning) return;
    afterLoginRunning = true;
    try {
      // 활성 provider 가 supabase 이외면 afterLogin 은 아무것도 안 함.
      const activeName = (window.JANStorage && window.JANStorage.getActiveName && window.JANStorage.getActiveName()) || 'none';
      if (activeName !== 'none' && activeName !== 'supabase') {
        afterLoginRan = true;
        return;
      }
      const cloud = await pullFromCloud();
      const local = getStateJSON();
      if (cloud && cloud.data) {
        if (!local) {
          localStorage.setItem('sticky-memo-v4', JSON.stringify(cloud.data));
          showToast('클라우드 데이터 복원됨 — 새로고침합니다', 3000);
          setTimeout(() => location.reload(), 1500);
        } else {
          const localStr = JSON.stringify(local);
          const cloudStr = JSON.stringify(cloud.data);
          if (localStr === cloudStr) {
            console.log('[Sync] 로컬 == 클라우드');
          } else {
            const cloudTime = new Date(cloud.updated_at).getTime();
            if (Date.now() - cloudTime < 60000) {
              backupLocal(local);
              localStorage.setItem('sticky-memo-v4', cloudStr);
              showToast('클라우드 데이터 동기화됨 — 새로고침합니다', 3000);
              setTimeout(() => location.reload(), 1500);
            } else {
              await pushToCloud();
              showToast('로컬 변경사항 클라우드 업로드됨', 2500);
            }
          }
        }
      } else if (local) {
        await pushToCloud();
        showToast('로컬 데이터가 클라우드에 백업됨', 2500);
      }
      afterLoginRan = true;
      subscribeRealtime();

      // 신 방식 제안 모달 — 조건: legacy blob 존재 + 아직 사용자 선택 안 함
      maybeProposeMigration();
    } finally {
      afterLoginRunning = false;
    }
  }

  function backupLocal(local) {
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      localStorage.setItem('sticky-memo-v4-backup-' + ts, JSON.stringify(local));
      console.log('[Sync] 로컬 백업 키: sticky-memo-v4-backup-' + ts);
    } catch (e) { console.warn('[Sync] 로컬 백업 실패:', e.message); }
  }

  function subscribeRealtime() {
    if (!session || realtimeChannel || !supabase) return;
    realtimeChannel = supabase
      .channel('user-data-' + session.user.id)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_data',
        filter: 'user_id=eq.' + session.user.id
      }, payload => {
        const incoming = payload.new;
        const incomingTime = new Date(incoming.updated_at).getTime();
        if (incomingTime - lastSyncAt < 5000) return;
        console.log('[Sync] 다른 기기에서 변경 감지');
        try { window.dispatchEvent(new CustomEvent('jan-sync-remote-change')); } catch {}
        showToast('다른 기기에서 변경됨. 새로고침하세요', 6000);
      })
      .subscribe();
  }

  function maybeProposeMigration() {
    try {
      if (localStorage.getItem('jan.storage.migrationProposed') === '1') return;
      if ((window.JANStorage && window.JANStorage.getActiveName()) !== 'none' && (window.JANStorage && window.JANStorage.getActiveName()) !== 'supabase') return;
      // 한 번만 제안
      setTimeout(() => {
        try { window.dispatchEvent(new CustomEvent('jan-storage-propose-migration')); } catch {}
      }, 4000);
    } catch {}
  }

  /* ==== 초기화 ==== */

  async function init() {
    if (SUPABASE_AVAILABLE) {
      await loadSDK();
      supabase = window.supabase.createClient(CONFIG.url, CONFIG.anon, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      const { data: { session: s } } = await supabase.auth.getSession();
      session = s;
      updateUI();
      if (readyResolve) { readyResolve(!!session); readyResolve = null; }

      supabase.auth.onAuthStateChange(async (event, newSession) => {
        session = newSession;
        updateUI();
        if (event === 'SIGNED_IN') {
          await afterLogin();
        } else if (event === 'SIGNED_OUT') {
          afterLoginRan = false;
          if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
            realtimeChannel = null;
          }
        }
      });

      if (session) afterLogin();

      // localStorage 변경 감지 → 어댑터 방식이든 legacy 방식이든 debounced push
      let uploadTimer = null;
      const origSetItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = function (key, val) {
        origSetItem(key, val);
        if (key !== 'sticky-memo-v4') return;
        const activeName = (window.JANStorage && window.JANStorage.getActiveName && window.JANStorage.getActiveName()) || 'none';
        if (activeName === 'none') return;
        if (activeName === 'supabase' && !session) return;
        clearTimeout(uploadTimer);
        uploadTimer = setTimeout(() => pushToCloud(), 2000);
      };
    } else {
      console.log('[Sync] Supabase 미설정 — 어댑터 기반 로컬/클라우드만 사용 가능');
      if (readyResolve) { readyResolve(false); readyResolve = null; }

      // Supabase 없어도 localStorage 변경 → 활성 어댑터에 push
      let uploadTimer = null;
      const origSetItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = function (key, val) {
        origSetItem(key, val);
        if (key !== 'sticky-memo-v4') return;
        const activeName = (window.JANStorage && window.JANStorage.getActiveName && window.JANStorage.getActiveName()) || 'none';
        if (activeName === 'none' || activeName === 'supabase') return;
        clearTimeout(uploadTimer);
        uploadTimer = setTimeout(() => pushViaAdapter(), 2000);
      };
    }

    // 활성 provider 가 저장돼 있으면 복원 시도
    try {
      const saved = window.JANStorage && window.JANStorage.getActiveName && window.JANStorage.getActiveName();
      if (saved && saved !== 'none' && saved !== 'supabase') {
        const adapter = window.JANStorage.get ? window.JANStorage.get(saved) : null
                     || (window.JANStorage.adapters && window.JANStorage.adapters[saved]);
        if (adapter) {
          window.JANStorage.setActive(saved).catch(e => {
            console.warn('[Sync] 저장된 provider 복원 실패:', saved, e.message);
            // 복원 실패 = 재연결 필요 이벤트
            window.dispatchEvent(new CustomEvent('jan-storage-reconnect-needed', { detail: { provider: saved, error: e.message } }));
          });
        }
      }
    } catch (e) { console.warn('[Sync] provider 복원 err', e); }
  }

  /* ==== JANSync 공개 API ==== */

  window.JANSync = {
    enabled: SUPABASE_AVAILABLE,
    init,
    ready: () => readyPromise,
    getSession: () => session,
    getSupabase: () => supabase,
    signInGoogle: () => supabase && supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + '/app' }
    }),
    signInKakao: () => supabase && supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: location.origin + '/app' }
    }),
    signInGithub: () => supabase && supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: location.origin + '/app' }
    }),
    signInEmail: async (email) => {
      if (!supabase) return { error: { message: 'Supabase 미설정' } };
      return supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.origin + '/app' }
      });
    },
    signOut: () => supabase && supabase.auth.signOut(),
    syncNow: pushToCloud,
    pullNow: pullFromCloud,

    // ==== 신규 ====
    get provider() {
      return (window.JANStorage && window.JANStorage.getActiveName && window.JANStorage.getActiveName()) || 'none';
    },
    setProvider,
    listFiles,
    readFile,
    writeFile,
    migrateLegacyToActive,
    // Dropbox OAuth 콜백 핸들러 편의 — app.html 의 콜백 라우트에서 호출
    handleDropboxCallback: async (search) => {
      const a = window.JANStorage && window.JANStorage.adapters && window.JANStorage.adapters.dropbox;
      if (!a) throw new Error('Dropbox 어댑터 없음');
      return a.handleOAuthCallback(search || location.search);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
