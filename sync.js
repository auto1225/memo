/* JustANotepad Cloud Sync v2
   Supabase 기반 인증 + 동기화
   지원: Google OAuth / Magic Link (이메일) / 카카오 OAuth
*/
(function() {
  const CONFIG = {
    url: window.SUPABASE_URL || '',
    anon: window.SUPABASE_ANON_KEY || ''
  };

  if (!CONFIG.url || !CONFIG.anon) {
    console.log('[Sync] Supabase 미설정 — 오프라인 전용 모드');
    window.JANSync = { enabled: false };
    return;
  }

  let supabase = null;
  let session = null;
  let syncing = false;
  let lastSyncAt = 0;
  let realtimeChannel = null;
  let afterLoginRan = false;     // 세션 1회만 동기화 다이얼로그 노출
  let afterLoginRunning = false; // 동시 호출 방지

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

  async function pushToCloud() {
    if (!session || syncing) return { ok: false };
    const data = getStateJSON();
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
      console.log('[Sync] 업로드 완료');
      return { ok: true };
    } catch (e) {
      console.warn('[Sync] 업로드 실패:', e.message);
      return { ok: false, error: e.message };
    } finally { syncing = false; }
  }

  async function pullFromCloud() {
    if (!session) return null;
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

  async function afterLogin() {
    if (afterLoginRan || afterLoginRunning) return;  // 중복 실행 방지
    afterLoginRunning = true;
    try {
      const cloud = await pullFromCloud();
      const local = getStateJSON();

      if (cloud && cloud.data) {
        if (!local) {
          // 로컬 비어 있음 → 자동 복원 (다이얼로그 없이)
          localStorage.setItem('sticky-memo-v4', JSON.stringify(cloud.data));
          showToast('클라우드 데이터 복원됨 — 새로고침합니다', 3000);
          setTimeout(() => location.reload(), 1500);
        } else {
          // 로컬 데이터 == 클라우드 데이터면 스킵
          const localStr = JSON.stringify(local);
          const cloudStr = JSON.stringify(cloud.data);
          if (localStr === cloudStr) {
            console.log('[Sync] 로컬 == 클라우드, 동기화 불필요');
          } else {
            const cloudTime = new Date(cloud.updated_at).getTime();
            if (Date.now() - cloudTime < 60000) {
              // 최근 1분 내 클라우드 변경 → 로컬이 더 최신이라 가정하지 말고 클라우드 우선
              console.log('[Sync] 클라우드가 최근 → 로컬 백업 후 클라우드 적용');
              backupLocal(local);
              localStorage.setItem('sticky-memo-v4', cloudStr);
              showToast('클라우드 데이터 동기화됨 — 새로고침합니다', 3000);
              setTimeout(() => location.reload(), 1500);
            } else {
              // 클라우드가 1분 이상 오래됨 → 로컬을 클라우드로 푸시 (다이얼로그 없이)
              console.log('[Sync] 로컬이 더 최신 → 자동 업로드');
              await pushToCloud();
              showToast('로컬 변경사항 클라우드 업로드됨', 2500);
            }
          }
        }
      } else if (local) {
        // 클라우드에 데이터 없음 → 로컬 업로드
        await pushToCloud();
        showToast('로컬 데이터가 클라우드에 백업됨', 2500);
      }
      afterLoginRan = true;
      subscribeRealtime();
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
    if (!session || realtimeChannel) return;
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
        showToast('다른 기기에서 변경됨. 새로고침하세요', 6000);
      })
      .subscribe();
  }

  function showToast(msg, dur) {
    if (typeof window.toast === 'function') window.toast(msg, dur || 4000);
    else console.log('[Sync]', msg);
  }

  async function init() {
    await loadSDK();
    supabase = window.supabase.createClient(CONFIG.url, CONFIG.anon, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    const { data: { session: s } } = await supabase.auth.getSession();
    session = s;
    updateUI();

    supabase.auth.onAuthStateChange(async (event, newSession) => {
      session = newSession;
      updateUI();
      if (event === 'SIGNED_IN') {
        await afterLogin();
      } else if (event === 'SIGNED_OUT') {
        afterLoginRan = false;  // 다음 로그인 시 다시 동기화 가능
        if (realtimeChannel) {
          supabase.removeChannel(realtimeChannel);
          realtimeChannel = null;
        }
      }
    });

    if (session) afterLogin();

    // 로컬 저장 감지 → debounced 업로드
    let uploadTimer = null;
    const origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, val) {
      origSetItem(key, val);
      if (key === 'sticky-memo-v4' && session) {
        clearTimeout(uploadTimer);
        uploadTimer = setTimeout(() => pushToCloud(), 3000);
      }
    };
  }

  window.JANSync = {
    enabled: true,
    init,
    getSession: () => session,
    getSupabase: () => supabase,
    signInGoogle: () => supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + '/app' }
    }),
    signInKakao: () => supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: location.origin + '/app' }
    }),
    signInGithub: () => supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: location.origin + '/app' }
    }),
    signInEmail: async (email) => {
      return supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.origin + '/app' }
      });
    },
    signOut: () => supabase.auth.signOut(),
    syncNow: pushToCloud,
    pullNow: pullFromCloud
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
