/**
 * JustANotepad — Home Hub (in-app dashboard drawer)
 * --------------------------------------------------------------------------
 * Injects a floating "home" button on the app screen. Clicking it opens a
 * right-side drawer showing:
 *   - Recent web clips (cms_clips)
 *   - Your shared notes (cms_shared_notes)
 *   - Active notices (cms_notices)
 *   - Template picker shortcut
 * All data lives in Supabase; RLS scopes it to the signed-in user.
 * The drawer is lazy-loaded on first open.
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.__janHomeHub__) return;
  window.__janHomeHub__ = true;

  // Wait up to 8s for Supabase lib to load (sync.js loads it with defer).
  function waitFor(testFn, timeoutMs = 8000, intervalMs = 100) {
    return new Promise((resolve) => {
      if (testFn()) return resolve(true);
      const started = Date.now();
      const t = setInterval(() => {
        if (testFn()) { clearInterval(t); resolve(true); }
        else if (Date.now() - started > timeoutMs) { clearInterval(t); resolve(false); }
      }, intervalMs);
    });
  }

  let sb = null;
  async function getSb() {
    if (sb) return sb;
    const ok = await waitFor(() => window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase?.createClient);
    if (!ok) return null;
    sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    return sb;
  }

  const escape = (s) => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'})[c]);
  const fmtRel = (s) => {
    if (!s) return '';
    const d = new Date(s).getTime(), diff = Math.floor((Date.now()-d)/1000);
    if (diff < 60) return '방금';
    if (diff < 3600) return Math.floor(diff/60) + '분 전';
    if (diff < 86400) return Math.floor(diff/3600) + '시간 전';
    if (diff < 2592000) return Math.floor(diff/86400) + '일 전';
    return new Date(s).toLocaleDateString('ko-KR', { month:'short', day:'numeric' });
  };

  let stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const css = `
      .jan-hub-fab {
        position:fixed; right:20px; bottom:88px;  /* above pen FAB at 20px */
        width:48px; height:48px; border-radius:50%;
        background:#141414; color:#FAE100;
        border:0; cursor:pointer; z-index:9998;
        box-shadow:0 6px 20px rgba(0,0,0,0.2);
        display:flex; align-items:center; justify-content:center;
        transition:transform 0.15s;
      }
      .jan-hub-fab:hover { transform:translateY(-2px); }
      .jan-hub-fab svg { width:22px; height:22px; }

      .jan-hub-drawer {
        position:fixed; top:0; right:-420px; width:400px; max-width:95vw; height:100vh;
        background:#fff; z-index:9999;
        box-shadow:-10px 0 40px rgba(0,0,0,0.12);
        transition:right 0.22s ease;
        display:flex; flex-direction:column;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Apple SD Gothic Neo","Noto Sans KR",sans-serif;
        color:#1f2937;
      }
      .jan-hub-drawer.open { right:0; }
      .jan-hub-backdrop {
        position:fixed; inset:0; background:rgba(20,20,20,0.35);
        z-index:9998; opacity:0; pointer-events:none; transition:opacity 0.2s;
      }
      .jan-hub-backdrop.on { opacity:1; pointer-events:auto; }

      .jan-hub-hd {
        padding:20px 22px 16px; border-bottom:1px solid #e5e7eb;
        display:flex; align-items:center; gap:12px;
      }
      .jan-hub-hd h2 { margin:0; font-size:17px; font-weight:700; flex:1; }
      .jan-hub-hd button {
        width:30px; height:30px; border-radius:50%; border:0;
        background:#f3f4f6; cursor:pointer; color:#6b7280; font-size:16px;
      }
      .jan-hub-bd { padding:14px 22px 30px; overflow-y:auto; flex:1; }

      .jan-hub-section { margin-bottom:24px; }
      .jan-hub-section h3 {
        font-size:11px; text-transform:uppercase; letter-spacing:0.08em;
        color:#9ca3af; font-weight:700; margin:0 0 8px;
        display:flex; align-items:center; gap:6px;
      }
      .jan-hub-section h3 a {
        margin-left:auto; font-size:11px; color:#D97757; text-decoration:none;
      }
      .jan-hub-item {
        display:flex; align-items:center; gap:10px; padding:9px 0;
        border-bottom:1px solid #f3f4f6; text-decoration:none; color:#1f2937;
        font-size:13px;
      }
      .jan-hub-item:last-child { border-bottom:0; }
      .jan-hub-item:hover { background:#fafaf7; margin:0 -8px; padding:9px 8px; border-radius:6px; }
      .jan-hub-item .t {
        flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      }
      .jan-hub-item .d { font-size:10px; color:#9ca3af; white-space:nowrap; }
      .jan-hub-empty { color:#9ca3af; font-size:12px; padding:10px 0; }

      .jan-hub-cta {
        display:block; text-align:center; padding:10px 14px;
        background:#141414; color:#fff; border-radius:8px; font-size:13px; font-weight:600;
        text-decoration:none; margin-top:8px;
      }
      .jan-hub-cta.ghost { background:#fff; color:#141414; border:1px solid #e5e7eb; }
      .jan-hub-cta:hover { opacity:0.9; }

      .jan-hub-row { display:flex; gap:8px; }
      .jan-hub-row > * { flex:1; }

      .jan-hub-kpis { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin-bottom:18px; }
      .jan-hub-kpi { background:#fafaf7; padding:10px; border-radius:8px; text-align:center; }
      .jan-hub-kpi .v { font-size:20px; font-weight:800; }
      .jan-hub-kpi .l { font-size:10px; color:#6b7280; }

      .jan-hub-loading { padding:40px 20px; text-align:center; color:#9ca3af; font-size:12px; }
    `;
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  let drawer, backdrop, loaded = false;

  function toggleDrawer(open) {
    if (!drawer) return;
    drawer.classList.toggle('open', open);
    backdrop.classList.toggle('on', open);
    if (open && !loaded) { loaded = true; loadData(); }
  }

  async function loadData() {
    const bd = drawer.querySelector('.jan-hub-bd');

    // Local state works without login
    const localState = window.JANAppState?.snapshot?.() || null;
    const tagEntries = localState ? Object.entries(localState.tags).sort((a,b) => b[1] - a[1]) : [];
    const todoTxt = localState && localState.todos.total
      ? `${localState.todos.done}/${localState.todos.total}`
      : '—';

    const renderLocalOnly = (extraHeader = '') => {
      bd.innerHTML = `
        ${extraHeader}
        <div class="jan-hub-kpis">
          <div class="jan-hub-kpi"><div class="v">${localState?.tabsTotal ?? 0}</div><div class="l">탭</div></div>
          <div class="jan-hub-kpi"><div class="v">${todoTxt}</div><div class="l">할 일</div></div>
          <div class="jan-hub-kpi"><div class="v">${localState?.wsTotal ?? 0}</div><div class="l">워크스페이스</div></div>
        </div>

        <div class="jan-hub-section">
          <h3>빠른 시작</h3>
          <a href="#" class="jan-hub-cta" id="jan-hub-btn-tpl">템플릿 고르기</a>
        </div>

        ${tagEntries.length ? `
          <div class="jan-hub-section">
            <h3>태그</h3>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              ${tagEntries.slice(0,12).map(([t,c]) => `
                <span style="padding:3px 10px;background:#f3f4f6;border-radius:999px;font-size:11px;color:#6b7280;font-weight:600;">
                  ${escape(t)} <span style="color:#9ca3af;">${c}</span>
                </span>`).join('')}
            </div>
          </div>` : ''}

        ${localState && localState.todos.total ? `
          <div class="jan-hub-section">
            <h3>오늘 할 일 — ${localState.todos.done}/${localState.todos.total} 완료</h3>
            <div style="background:#f3f4f6;border-radius:4px;height:6px;overflow:hidden;">
              <div style="background:#10b981;height:100%;width:${Math.round((localState.todos.done/localState.todos.total)*100)}%;"></div>
            </div>
          </div>` : ''}

        ${localState?.recent?.length ? `
          <div class="jan-hub-section">
            <h3>최근 탭</h3>
            ${localState.recent.slice(0, 5).map(t => `
              <div class="jan-hub-item" style="cursor:default;">
                ${t.starred ? '<span style="color:#eab308;">★</span>' : ''}
                <div class="t">${escape(t.name || '(무제)')}</div>
                <div class="d">${t.tag ? `#${escape(t.tag)}` : ''}</div>
              </div>`).join('')}
          </div>` : ''}
      `;
      bd.querySelector('#jan-hub-btn-tpl')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.JANTemplatePicker) window.JANTemplatePicker.open({
          onPick: (tpl) => document.dispatchEvent(new CustomEvent('jan:template-selected', { detail: tpl })),
        });
      });
    };

    const client = await getSb();
    if (!client) {
      renderLocalOnly('<div style="padding:10px 0;color:#9ca3af;font-size:11px;">Supabase 미연결 — 로컬 위젯만 표시됩니다.</div>');
      return;
    }
    const { data: { session } } = await client.auth.getSession();
    const userId = session?.user?.id || null;

    if (!userId) {
      renderLocalOnly(`<div style="padding:8px 12px;background:#fef3c7;color:#92400e;border-radius:8px;font-size:11px;margin-bottom:14px;">
        클라우드(클립·공유·공지)를 보려면 <a href="/app?signin=1" style="color:inherit;font-weight:700;">로그인</a>하세요.
      </div>`);
      return;
    }

    // Parallel fetch
    const [clips, shared, notices, clipCount, sharedCount] = await Promise.all([
      client.from('cms_clips').select('id,url,title,created_at').order('created_at', { ascending:false }).limit(4),
      client.from('cms_shared_notes').select('token,title,view_count,mode,created_at').eq('owner_id', userId).order('created_at', { ascending:false }).limit(4),
      client.from('cms_notices').select('id,title,pinned,created_at').eq('published', true).order('pinned', { ascending:false }).order('created_at', { ascending:false }).limit(3),
      client.from('cms_clips').select('*', { count:'exact', head:true }),
      client.from('cms_shared_notes').select('view_count', { count:'exact' }).eq('owner_id', userId),
    ]);

    const totalViews = (shared.data||[]).reduce((a,r) => a + (r.view_count||0), 0);
    // localState / tagEntries / todoTxt are already declared above — reused here.

    bd.innerHTML = `
      <div class="jan-hub-kpis">
        <div class="jan-hub-kpi"><div class="v">${localState?.tabsTotal ?? 0}</div><div class="l">탭</div></div>
        <div class="jan-hub-kpi"><div class="v">${todoTxt}</div><div class="l">할 일</div></div>
        <div class="jan-hub-kpi"><div class="v">${clipCount.count ?? 0}</div><div class="l">클립</div></div>
      </div>

      ${tagEntries.length ? `
        <div class="jan-hub-section">
          <h3>태그</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${tagEntries.slice(0,12).map(([t,c]) => `
              <span style="padding:3px 10px;background:#f3f4f6;border-radius:999px;font-size:11px;color:#6b7280;font-weight:600;">
                ${escape(t)} <span style="color:#9ca3af;">${c}</span>
              </span>`).join('')}
          </div>
        </div>
      ` : ''}

      ${localState && localState.todos.total ? `
        <div class="jan-hub-section">
          <h3>오늘 할 일 — ${localState.todos.done}/${localState.todos.total} 완료</h3>
          <div style="background:#f3f4f6;border-radius:4px;height:6px;overflow:hidden;">
            <div style="background:#10b981;height:100%;width:${Math.round((localState.todos.done/localState.todos.total)*100)}%;transition:width 0.3s;"></div>
          </div>
        </div>
      ` : ''}

      <div class="jan-hub-section">
        <h3>빠른 시작
          <a href="/home" target="_blank" rel="noopener">전체 홈 →</a>
        </h3>
        <div class="jan-hub-row">
          <a href="#" class="jan-hub-cta" id="jan-hub-btn-tpl">템플릿 고르기</a>
          <a href="#" class="jan-hub-cta ghost" id="jan-hub-btn-share">공유 링크 만들기</a>
        </div>
      </div>

      <div class="jan-hub-section">
        <h3>최근 웹 클립
          <a href="https://github.com/auto1225/memo/tree/main/extensions/clipper" target="_blank" rel="noopener">확장 설치 →</a>
        </h3>
        ${(clips.data||[]).length ? clips.data.map(c => `
          <a class="jan-hub-item" href="${escape(c.url||'#')}" target="_blank" rel="noopener">
            <div class="t">${escape(c.title || c.url || '(제목 없음)')}</div>
            <div class="d">${fmtRel(c.created_at)}</div>
          </a>`).join('') : '<div class="jan-hub-empty">저장된 클립이 없습니다.</div>'}
      </div>

      <div class="jan-hub-section">
        <h3>내 공유 노트</h3>
        ${(shared.data||[]).length ? shared.data.map(s => `
          <a class="jan-hub-item" href="/s/${encodeURIComponent(s.token)}" target="_blank" rel="noopener">
            <div class="t">${escape(s.title || '(제목 없음)')}</div>
            <div class="d">${s.view_count||0}회 · ${s.mode==='edit'?'편집':'읽기'}</div>
          </a>`).join('') : '<div class="jan-hub-empty">공유한 노트가 없습니다.</div>'}
      </div>

      ${localState?.recent?.length ? `
        <div class="jan-hub-section">
          <h3>최근 탭</h3>
          ${localState.recent.slice(0, 5).map(t => `
            <div class="jan-hub-item" style="cursor:default;">
              ${t.starred ? '<span style="color:#eab308;">★</span>' : ''}
              <div class="t">${escape(t.name || '(무제)')}</div>
              <div class="d">${t.tag ? `#${escape(t.tag)}` : ''}</div>
            </div>`).join('')}
        </div>` : ''}

      <div class="jan-hub-section">
        <h3>공지</h3>
        ${(notices.data||[]).length ? notices.data.map(n => `
          <div class="jan-hub-item" style="cursor:default;">
            <div class="t">${n.pinned ? '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:4px;"><path d="M12 17v5M7 9V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v4l3 5H4z"/></svg>' : ''}${escape(n.title)}</div>
            <div class="d">${fmtRel(n.created_at)}</div>
          </div>`).join('') : '<div class="jan-hub-empty">공지 없음</div>'}
      </div>
    `;

    bd.querySelector('#jan-hub-btn-tpl').addEventListener('click', (e) => {
      e.preventDefault();
      if (window.JANTemplatePicker) {
        window.JANTemplatePicker.open({
          onPick: (tpl) => { document.dispatchEvent(new CustomEvent('jan:template-selected', { detail: tpl })); },
        });
      } else {
        alert('템플릿 피커가 아직 로드되지 않았습니다.');
      }
    });

    bd.querySelector('#jan-hub-btn-share').addEventListener('click', async (e) => {
      e.preventDefault();
      const title = prompt('공유할 노트 제목');
      if (!title) return;
      const body = prompt('본문 (Markdown OK)') || '';
      const token = Math.random().toString(36).slice(2, 14);
      const { error } = await client.from('cms_shared_notes').insert({
        token, owner_id: userId, title, body, mode: 'readonly',
      });
      if (error) { alert(error.message); return; }
      const url = location.origin + '/s/' + token;
      try { await navigator.clipboard.writeText(url); } catch {}
      alert('공유 링크가 생성되고 클립보드에 복사되었습니다:\n' + url);
      loaded = false;
      loadData();
    });
  }

  function build() {
    injectStyles();

    const fab = document.createElement('button');
    fab.className = 'jan-hub-fab';
    fab.title = '홈 허브 (최근 클립·공유 노트·템플릿)';
    fab.setAttribute('aria-label', '홈 허브 열기');
    fab.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`;
    document.body.appendChild(fab);

    backdrop = document.createElement('div');
    backdrop.className = 'jan-hub-backdrop';
    document.body.appendChild(backdrop);

    drawer = document.createElement('aside');
    drawer.className = 'jan-hub-drawer';
    drawer.innerHTML = `
      <div class="jan-hub-hd">
        <svg style="width:20px;height:20px;color:#D97757;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <h2>홈 허브</h2>
        <button aria-label="닫기">×</button>
      </div>
      <div class="jan-hub-bd">
        <div class="jan-hub-loading">불러오는 중…</div>
      </div>`;
    document.body.appendChild(drawer);

    fab.addEventListener('click', () => toggleDrawer(true));
    drawer.querySelector('button').addEventListener('click', () => toggleDrawer(false));
    backdrop.addEventListener('click', () => toggleDrawer(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleDrawer(false); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
