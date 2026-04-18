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
    const cloud = await pullFromCloud();
    const local = getStateJSON();

    if (cloud && cloud.data) {
      if (!local) {
        localStorage.setItem('sticky-memo-v4', JSON.stringify(cloud.data));
        showToast('클라우드 데이터 복원됨');
        setTimeout(() => { if (confirm('새로고침하여 적용할까요?')) location.reload(); }, 800);
      } else {
        const cloudTime = new Date(cloud.updated_at).getTime();
        if (Date.now() - cloudTime < 60000) {
          await pushToCloud();  // 로컬이 더 최신
        } else if (confirm('클라우드에 더 최신 데이터가 있습니다. 불러올까요?')) {
          localStorage.setItem('sticky-memo-v4', JSON.stringify(cloud.data));
          location.reload();
        }
      }
    } else if (local) {
      await pushToCloud();
      showToast('로컬 데이터가 클라우드에 백업됨');
    }
    subscribeRealtime();
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
      } else if (event === 'SIGNED_OUT' && realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
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
