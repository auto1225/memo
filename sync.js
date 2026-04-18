/* JustANotepad Cloud Sync
   Supabase 기반 인증 + 데이터 동기화
   - Google 로그인
   - state 전체 JSONB로 저장/복원
   - 실시간 구독 (다른 기기 변경 감지)
   - 충돌 해결: updated_at 최신 우선
   - 오프라인 시 LocalStorage 우선, 재연결 시 sync
*/
(function() {
  const CONFIG = {
    url: window.SUPABASE_URL || '',
    anon: window.SUPABASE_ANON_KEY || ''
  };

  // 설정 없으면 스킵 (오프라인 단일 모드)
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
    const event = new CustomEvent('jan-auth-change', { detail: { session } });
    window.dispatchEvent(event);
  }

  function getStateJSON() {
    try { return JSON.parse(localStorage.getItem('sticky-memo-v4') || 'null'); }
    catch { return null; }
  }

  async function pushToCloud() {
    if (!session || syncing) return;
    const data = getStateJSON();
    if (!data) return;
    syncing = true;
    try {
      const { error } = await supabase.from('user_data').upsert({
        user_id: session.user.id,
        data,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      lastSyncAt = Date.now();
      console.log('[Sync] 클라우드 업로드 완료');
    } catch (e) {
      console.warn('[Sync] 업로드 실패:', e.message);
    } finally {
      syncing = false;
    }
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
      const cloudTime = new Date(cloud.updated_at).getTime();
      const localTime = local ? Date.now() : 0;

      if (!local) {
        // 로컬 비어있음 → 클라우드로 복원
        localStorage.setItem('sticky-memo-v4', JSON.stringify(cloud.data));
        if (window.location.pathname === '/app' || document.getElementById('pad')) {
          showToast('클라우드에서 데이터 복원됨. 새로고침 권장.');
          setTimeout(() => {
            if (confirm('새로고침해서 클라우드 데이터를 적용할까요?')) location.reload();
          }, 1000);
        }
      } else if (cloudTime > localTime + 60000) {
        // 클라우드가 1분 이상 최신
        if (confirm('클라우드에 더 최신 데이터가 있습니다. 불러올까요?\n(아니요 = 로컬 유지)')) {
          localStorage.setItem('sticky-memo-v4', JSON.stringify(cloud.data));
          location.reload();
        }
      } else {
        // 로컬이 더 최신 → 업로드
        await pushToCloud();
      }
    } else if (local) {
      // 클라우드 데이터 없음, 로컬 존재 → 최초 업로드
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
        if (incomingTime - lastSyncAt < 5000) return; // 자기가 방금 푸시한 것은 스킵
        console.log('[Sync] 다른 기기에서 변경 감지');
        showToast('다른 기기에서 변경됨. 새로고침하시겠어요?', { action: '새로고침' });
      })
      .subscribe();
  }

  function showToast(msg, opts = {}) {
    if (typeof window.toast === 'function') {
      window.toast(msg, 5000);
    } else {
      console.log('[Sync]', msg);
    }
  }

  async function init() {
    await loadSDK();
    supabase = window.supabase.createClient(CONFIG.url, CONFIG.anon, {
      auth: { persistSession: true, autoRefreshToken: true }
    });

    const { data: { session: s } } = await supabase.auth.getSession();
    session = s;
    updateUI();

    supabase.auth.onAuthStateChange(async (event, newSession) => {
      session = newSession;
      updateUI();
      if (event === 'SIGNED_IN') await afterLogin();
      else if (event === 'SIGNED_OUT' && realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }
    });

    if (session) afterLogin();

    // 로컬 저장 감지 → 클라우드 업로드 (debounce)
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
    signInGoogle: () => supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + '/app' }
    }),
    signOut: () => supabase.auth.signOut(),
    getSession: () => session,
    syncNow: pushToCloud,
    pullNow: pullFromCloud
  };

  // 자동 초기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
