/**
 * JustANotepad Admin CMS
 * --------------------------------------------------------------------------
 * - Auth gate (Google/GitHub OAuth via Supabase)
 * - Role check: only emails whose profile.role is 'admin' get in
 * - Sidebar routing between modules
 * - Working modules: dashboard, users (회원 관리), notices (공지사항)
 * - Placeholder modules for every other sidebar entry so navigation works
 *
 * Requires Supabase tables — see supabase-admin-schema.sql.
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';

  // ---- Supabase client -----------------------------------------------
  const SUPABASE_URL = window.SUPABASE_URL || '';
  const SUPABASE_ANON = window.SUPABASE_ANON_KEY || '';
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    document.body.innerHTML =
      '<div style="padding:40px;font-family:sans-serif;">config.js에 SUPABASE_URL과 SUPABASE_ANON_KEY가 필요합니다.</div>';
    return;
  }
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  // ---- Elements ------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const loginGate = $('loginGate');
  const layout = $('layout');
  const view = $('view');
  const pageTitle = $('pageTitle');
  const crumb = $('crumb');
  const userEmailEl = $('userEmail');

  // ---- Auth flow -----------------------------------------------------
  async function signInWith(provider) {
    const { error } = await sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo: location.origin + '/admin' },
    });
    if (error) alert('로그인 실패: ' + error.message);
  }
  $('btnLoginGoogle').addEventListener('click', () => signInWith('google'));
  $('btnLoginGitHub').addEventListener('click', () => signInWith('github'));

  async function loadProfile(user) {
    const { data, error } = await sb
      .from('profiles')
      .select('role, display_name, plan')
      .eq('id', user.id)
      .maybeSingle();
    if (error) {
      // table likely missing — bootstrap a dummy admin if email matches env list
      return { role: 'user', display_name: user.email };
    }
    return data || { role: 'user', display_name: user.email };
  }

  // Super-admin email list — bypasses profile.role requirement so the
  // owner can always get in even if the profiles table/row is missing.
  const SUPER_ADMINS = ['auto0104@gmail.com'];

  async function boot() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { showGate(); return; }

    const emailLower = (session.user.email || '').toLowerCase();
    const isSuperAdmin = SUPER_ADMINS.includes(emailLower);
    const profile = await loadProfile(session.user);

    if (!isSuperAdmin && profile.role !== 'admin') {
      await sb.auth.signOut();
      alert('관리자 권한이 없습니다.\n(' + session.user.email + ')');
      showGate();
      return;
    }

    // If super-admin signed in but has no profile row yet, synthesize one.
    if (isSuperAdmin && profile.role !== 'admin') {
      profile.role = 'admin';
      profile.display_name = profile.display_name || session.user.email;
      // Best-effort: promote themselves in DB too (may fail if RLS blocks first time).
      try {
        await sb.from('profiles').upsert({
          id: session.user.id,
          email: session.user.email,
          role: 'admin',
          display_name: profile.display_name,
        });
      } catch {}
    }

    showApp(session.user, profile);
  }

  function showGate() {
    loginGate.style.display = 'flex';
    layout.style.display = 'none';
  }

  function showApp(user, profile) {
    loginGate.style.display = 'none';
    layout.style.display = 'grid';
    userEmailEl.textContent = `${profile.display_name || user.email} · 관리자`;

    // sidebar group toggles
    document.querySelectorAll('.sb-group-title').forEach((el) => {
      el.addEventListener('click', () => {
        el.parentElement.classList.toggle('collapsed');
      });
    });

    // item clicks
    document.querySelectorAll('.sb-item[data-view]').forEach((el) => {
      el.addEventListener('click', () => {
        const v = el.dataset.view;
        if (v === 'app-logout') { sb.auth.signOut().then(() => location.reload()); return; }
        activate(el);
        render(v);
      });
    });

    render('dashboard');
  }

  function activate(el) {
    document.querySelectorAll('.sb-item.active').forEach((x) => x.classList.remove('active'));
    el.classList.add('active');
  }

  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') boot();
    if (event === 'SIGNED_OUT') showGate();
  });

  // ---- View registry -------------------------------------------------
  const titles = {
    dashboard: ['대시보드', '대시보드'],
    analytics: ['방문자 통계', '대시보드 / 방문자 통계'],
    downloads: ['다운로드 분석', '대시보드 / 다운로드'],
    payments: ['판매 / 결제', '비즈니스 / 판매'],
    serials:  ['시리얼 관리', '비즈니스 / 시리얼'],
    users:    ['회원 관리', '비즈니스 / 회원'],
    auth:     ['회원가입/로그인 설정', '비즈니스 / 인증'],
    features: ['앱 기능 제한', '비즈니스 / 엔타이틀먼트'],
    hero:     ['히어로 섹션', '랜딩 / 히어로'],
    how:      ['작동 원리', '랜딩 / 작동 원리'],
    scenarios:['활용 시나리오', '랜딩 / 시나리오'],
    appIntro: ['앱 소개', '랜딩 / 앱 소개'],
    'features-page': ['기능 소개', '랜딩 / 기능'],
    recovery: ['도난 복구 모드', '랜딩 / 복구'],
    sensors:  ['센서 상세', '랜딩 / 센서'],
    remote:   ['원격 제어 & 경보', '랜딩 / 원격 제어'],
    howto:    ['사용 방법', '랜딩 / 사용 방법'],
    install:  ['설치 가이드', '랜딩 / 설치'],
    i18n:     ['다국어 지원', '랜딩 / 다국어'],
    pricing:  ['가격 정책', '랜딩 / 가격'],
    download: ['다운로드', '랜딩 / 다운로드'],
    board:    ['게시판 관리', '커뮤니티 / 게시판'],
    faq:      ['FAQ 관리', '커뮤니티 / FAQ'],
    announce: ['공지사항', '커뮤니티 / 공지'],
    header:   ['헤더 & 푸터', '사이트 설정 / 헤더 푸터'],
    popup:    ['팝업 관리', '사이트 설정 / 팝업'],
    terms:    ['약관 관리', '사이트 설정 / 약관'],
    settings: ['설정', '사이트 설정 / 일반'],
  };

  function setTitle(v) {
    const t = titles[v] || ['', '관리자'];
    pageTitle.textContent = t[0];
    crumb.textContent = t[1];
  }

  async function render(v) {
    setTitle(v);
    view.innerHTML = '<div style="color:var(--ink-soft);padding:20px;">로딩 중...</div>';
    try {
      if (v === 'dashboard')     await renderDashboard();
      else if (v === 'users')    await renderUsers();
      else if (v === 'announce') await renderNotices();
      else if (v === 'faq')      await renderFAQ();
      else if (v === 'terms')    await renderCmsDoc('terms', '약관 관리');
      else if (v === 'popup')    await renderPopups();
      else if (v === 'analytics') await renderAnalytics();
      else if (v === 'downloads') await renderDownloads();
      else                       renderContentPage(v);
    } catch (e) {
      view.innerHTML = '<div style="color:var(--danger);padding:20px;">오류: ' + (e.message || e) + '</div>';
    }
  }

  // ---- MODULE: Dashboard --------------------------------------------
  async function renderDashboard() {
    const [{ count: users }, { count: notes }, { count: notices }, { count: paid }] = await Promise.all([
      sb.from('profiles').select('*', { count: 'exact', head: true }),
      sb.from('user_data').select('*', { count: 'exact', head: true }),
      sb.from('cms_notices').select('*', { count: 'exact', head: true }),
      sb.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'paid'),
    ]).catch(() => [{count:0},{count:0},{count:0},{count:0}]);

    const recent = await sb.from('profiles')
      .select('id, display_name, email, role, plan, created_at')
      .order('created_at', { ascending: false }).limit(10);

    view.innerHTML = `
      <div class="kpis">
        <div class="kpi"><div class="lbl">총 회원</div><div class="val">${users ?? '—'}</div></div>
        <div class="kpi"><div class="lbl">유료 회원</div><div class="val">${paid ?? '—'}</div></div>
        <div class="kpi"><div class="lbl">저장된 메모</div><div class="val">${notes ?? '—'}</div></div>
        <div class="kpi"><div class="lbl">활성 공지</div><div class="val">${notices ?? '—'}</div></div>
      </div>
      <div class="panel">
        <div class="panel-title">최근 가입자 <span class="sub">최대 10명</span></div>
        ${recent.data && recent.data.length ? `
        <table class="t">
          <thead><tr><th>이름</th><th>이메일</th><th>권한</th><th>플랜</th><th>가입일</th></tr></thead>
          <tbody>
            ${recent.data.map(u => `
              <tr>
                <td>${escape(u.display_name || '-')}</td>
                <td>${escape(u.email || '-')}</td>
                <td><span class="badge ${u.role === 'admin' ? 'admin' : 'user'}">${u.role || 'user'}</span></td>
                <td><span class="badge ${u.plan === 'paid' ? 'paid' : 'trial'}">${u.plan || 'free'}</span></td>
                <td>${fmtDate(u.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div style="color:var(--ink-soft);padding:20px;text-align:center;">데이터 없음</div>'}
      </div>
    `;
  }

  // ---- MODULE: Users --------------------------------------------------
  async function renderUsers() {
    view.innerHTML = `
      <div class="panel">
        <div class="panel-title">
          회원 관리
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="search" id="userSearch" placeholder="이메일 검색" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
          </div>
        </div>
        <div id="usersTable">로딩…</div>
      </div>
    `;
    const load = async (q) => {
      let query = sb.from('profiles').select('id,display_name,email,role,plan,created_at')
        .order('created_at', { ascending: false }).limit(100);
      if (q) query = query.ilike('email', `%${q}%`);
      const { data, error } = await query;
      if (error) { $('usersTable').innerHTML = '<div style="color:var(--danger);">'+error.message+'</div>'; return; }
      $('usersTable').innerHTML = `
        <table class="t">
          <thead><tr><th>이메일</th><th>이름</th><th>권한</th><th>플랜</th><th>가입일</th><th></th></tr></thead>
          <tbody>
            ${(data||[]).map(u => `
              <tr data-id="${u.id}">
                <td>${escape(u.email)}</td>
                <td>${escape(u.display_name || '-')}</td>
                <td>
                  <select class="u-role" data-id="${u.id}">
                    <option value="user" ${u.role==='user'?'selected':''}>user</option>
                    <option value="admin" ${u.role==='admin'?'selected':''}>admin</option>
                    <option value="banned" ${u.role==='banned'?'selected':''}>banned</option>
                  </select>
                </td>
                <td>
                  <select class="u-plan" data-id="${u.id}">
                    <option value="free" ${u.plan==='free'?'selected':''}>free</option>
                    <option value="trial" ${u.plan==='trial'?'selected':''}>trial</option>
                    <option value="paid" ${u.plan==='paid'?'selected':''}>paid</option>
                  </select>
                </td>
                <td>${fmtDate(u.created_at)}</td>
                <td><button class="btn btn-save" data-id="${u.id}">저장</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      document.querySelectorAll('.btn-save').forEach(btn => btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const role = document.querySelector('.u-role[data-id="'+id+'"]').value;
        const plan = document.querySelector('.u-plan[data-id="'+id+'"]').value;
        const { error } = await sb.from('profiles').update({ role, plan }).eq('id', id);
        btn.textContent = error ? '실패' : '저장됨';
        setTimeout(() => { btn.textContent = '저장'; }, 1500);
      }));
    };
    let t;
    $('userSearch').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => load(e.target.value.trim()), 300); });
    load('');
  }

  // ---- MODULE: Notices (공지사항) -----------------------------------
  async function renderNotices() {
    view.innerHTML = `
      <div class="panel">
        <div class="panel-title">
          공지사항
          <button class="btn primary" id="btnNewNotice">+ 새 공지</button>
        </div>
        <div id="noticeList">로딩…</div>
      </div>
      <div class="panel" id="noticeEditor" style="display:none;">
        <div class="panel-title"><span id="noticeEditTitle">새 공지</span>
          <button class="btn" id="btnCancelNotice">취소</button>
        </div>
        <div class="field"><label>제목</label><input id="nfTitle"></div>
        <div class="field"><label>내용 (Markdown)</label><textarea id="nfBody" rows="8"></textarea></div>
        <div style="display:flex;gap:10px;">
          <label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" id="nfPinned"> 상단 고정</label>
          <label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" id="nfPublished" checked> 게시</label>
        </div>
        <div style="margin-top:16px;display:flex;gap:8px;">
          <button class="btn primary" id="btnSaveNotice">저장</button>
          <button class="btn danger" id="btnDeleteNotice" style="display:none;">삭제</button>
        </div>
      </div>
    `;
    let current = null;
    const load = async () => {
      const { data, error } = await sb.from('cms_notices')
        .select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false });
      if (error) { $('noticeList').innerHTML = '<div style="color:var(--danger);">'+error.message+'</div>'; return; }
      $('noticeList').innerHTML = (data||[]).length ? `
        <table class="t">
          <thead><tr><th>제목</th><th>상태</th><th>업데이트</th><th></th></tr></thead>
          <tbody>
            ${data.map(n => `
              <tr data-id="${n.id}">
                <td>${n.pinned?'📌 ':''}${escape(n.title)}</td>
                <td><span class="badge ${n.published?'paid':'trial'}">${n.published?'게시':'임시'}</span></td>
                <td>${fmtDate(n.updated_at || n.created_at)}</td>
                <td><button class="btn btn-edit" data-id="${n.id}">편집</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div style="color:var(--ink-soft);padding:20px;text-align:center;">공지 없음</div>';
      document.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', async () => {
        const { data } = await sb.from('cms_notices').select('*').eq('id', btn.dataset.id).single();
        openEditor(data);
      }));
    };
    const openEditor = (n) => {
      current = n || null;
      $('noticeEditor').style.display = 'block';
      $('noticeEditTitle').textContent = n ? '공지 편집' : '새 공지';
      $('nfTitle').value = n?.title || '';
      $('nfBody').value = n?.body || '';
      $('nfPinned').checked = !!n?.pinned;
      $('nfPublished').checked = n ? !!n.published : true;
      $('btnDeleteNotice').style.display = n ? 'inline-flex' : 'none';
    };
    $('btnNewNotice').addEventListener('click', () => openEditor(null));
    $('btnCancelNotice').addEventListener('click', () => { $('noticeEditor').style.display='none'; });
    $('btnSaveNotice').addEventListener('click', async () => {
      const payload = {
        title: $('nfTitle').value,
        body:  $('nfBody').value,
        pinned: $('nfPinned').checked,
        published: $('nfPublished').checked,
      };
      const query = current
        ? sb.from('cms_notices').update(payload).eq('id', current.id)
        : sb.from('cms_notices').insert(payload);
      const { error } = await query;
      if (error) { alert(error.message); return; }
      $('noticeEditor').style.display='none';
      await load();
    });
    $('btnDeleteNotice').addEventListener('click', async () => {
      if (!current || !confirm('정말 삭제하시겠어요?')) return;
      const { error } = await sb.from('cms_notices').delete().eq('id', current.id);
      if (error) { alert(error.message); return; }
      $('noticeEditor').style.display='none';
      await load();
    });
    load();
  }

  // ---- MODULE: FAQ ---------------------------------------------------
  async function renderFAQ() { return renderCmsListCrud('cms_faq', ['question', 'answer'], 'FAQ 항목', ['질문', '답변']); }

  // ---- MODULE: Popups ------------------------------------------------
  async function renderPopups() { return renderCmsListCrud('cms_popups', ['title', 'body', 'active_from', 'active_to'], '팝업', ['제목', '내용', '시작일', '종료일']); }

  // ---- MODULE: Terms (single doc) ------------------------------------
  async function renderCmsDoc(key, label) {
    view.innerHTML = `<div class="panel"><div class="panel-title">${label}</div>
      <div class="field"><label>본문 (Markdown)</label><textarea id="docBody" rows="20"></textarea></div>
      <button class="btn primary" id="btnSaveDoc">저장</button>
    </div>`;
    const { data } = await sb.from('cms_docs').select('body').eq('key', key).maybeSingle();
    $('docBody').value = data?.body || '';
    $('btnSaveDoc').addEventListener('click', async () => {
      const { error } = await sb.from('cms_docs').upsert({ key, body: $('docBody').value });
      if (error) { alert(error.message); return; }
      $('btnSaveDoc').textContent = '저장됨';
      setTimeout(() => $('btnSaveDoc').textContent = '저장', 1500);
    });
  }

  // ---- MODULE: Landing page content sections -------------------------
  async function renderContentPage(slug) {
    view.innerHTML = `
      <div class="panel">
        <div class="panel-title">${titles[slug][0]}
          <span class="sub">cms_sections: slug=${slug}</span>
        </div>
        <div class="field"><label>제목 (headline)</label><input id="cpHeadline"></div>
        <div class="field"><label>부제 (subhead)</label><input id="cpSubhead"></div>
        <div class="field"><label>본문/마크다운</label><textarea id="cpBody" rows="12"></textarea></div>
        <div class="field"><label>이미지 URL</label><input id="cpImage" placeholder="https://..."></div>
        <div style="display:flex;gap:8px;"><button class="btn primary" id="btnSaveCp">저장</button></div>
      </div>`;
    const { data } = await sb.from('cms_sections').select('*').eq('slug', slug).maybeSingle();
    $('cpHeadline').value = data?.headline || '';
    $('cpSubhead').value = data?.subhead || '';
    $('cpBody').value = data?.body || '';
    $('cpImage').value = data?.image_url || '';
    $('btnSaveCp').addEventListener('click', async () => {
      const payload = {
        slug, headline: $('cpHeadline').value, subhead: $('cpSubhead').value,
        body: $('cpBody').value, image_url: $('cpImage').value, updated_at: new Date().toISOString(),
      };
      const { error } = await sb.from('cms_sections').upsert(payload);
      if (error) { alert(error.message); return; }
      $('btnSaveCp').textContent = '저장됨';
      setTimeout(() => $('btnSaveCp').textContent = '저장', 1500);
    });
  }

  async function renderAnalytics() {
    view.innerHTML = `<div class="panel"><div class="panel-title">방문자 통계</div>
      <p style="color:var(--ink-soft);">Vercel Analytics 또는 Plausible 연동 권장.
      Supabase에 <code>cms_analytics_events</code> 테이블 생성 시 자체 집계도 가능합니다.</p>
    </div>`;
  }
  async function renderDownloads() {
    view.innerHTML = `<div class="panel"><div class="panel-title">다운로드 분석</div>
      <p style="color:var(--ink-soft);">GitHub Releases API 기반 다운로드 수 집계.
      향후 엔드포인트 <code>/api/downloads</code> 추가 예정.</p>
    </div>`;
  }

  // ---- Generic list/CRUD helper --------------------------------------
  async function renderCmsListCrud(table, fields, labelSingular, fieldLabels) {
    view.innerHTML = `
      <div class="panel">
        <div class="panel-title">${labelSingular} 목록 <button class="btn primary" id="btnNew">+ 새 ${labelSingular}</button></div>
        <div id="listWrap">로딩…</div>
      </div>
      <div class="panel" id="editWrap" style="display:none;">
        <div class="panel-title">편집 <button class="btn" id="btnCancel">취소</button></div>
        ${fields.map((f, i) => `
          <div class="field"><label>${fieldLabels[i]}</label>${f === 'body' || f === 'answer' ? `<textarea id="f-${f}" rows="6"></textarea>` : `<input id="f-${f}">`}</div>
        `).join('')}
        <div style="display:flex;gap:8px;"><button class="btn primary" id="btnSave">저장</button><button class="btn danger" id="btnDel" style="display:none;">삭제</button></div>
      </div>`;
    let current = null;
    const load = async () => {
      const { data, error } = await sb.from(table).select('*').order('created_at', { ascending: false });
      if (error) { $('listWrap').innerHTML = '<div style="color:var(--danger);">'+error.message+'</div>'; return; }
      $('listWrap').innerHTML = (data||[]).length ? `
        <table class="t"><thead><tr>${fields.map((f,i) => `<th>${fieldLabels[i]}</th>`).join('')}<th></th></tr></thead>
        <tbody>${data.map(row => `<tr>${fields.map(f => `<td>${escape((row[f]||'').toString().slice(0,80))}</td>`).join('')}<td><button class="btn btn-e" data-id="${row.id}">편집</button></td></tr>`).join('')}</tbody></table>
      ` : '<div style="color:var(--ink-soft);padding:20px;text-align:center;">항목 없음</div>';
      document.querySelectorAll('.btn-e').forEach(btn => btn.addEventListener('click', async () => {
        const { data } = await sb.from(table).select('*').eq('id', btn.dataset.id).single();
        openEdit(data);
      }));
    };
    const openEdit = (row) => {
      current = row;
      $('editWrap').style.display = 'block';
      fields.forEach(f => $(`f-${f}`).value = row?.[f] || '');
      $('btnDel').style.display = row ? 'inline-flex' : 'none';
    };
    $('btnNew').addEventListener('click', () => openEdit(null));
    $('btnCancel').addEventListener('click', () => $('editWrap').style.display = 'none');
    $('btnSave').addEventListener('click', async () => {
      const payload = {}; fields.forEach(f => payload[f] = $(`f-${f}`).value);
      const query = current ? sb.from(table).update(payload).eq('id', current.id) : sb.from(table).insert(payload);
      const { error } = await query;
      if (error) { alert(error.message); return; }
      $('editWrap').style.display = 'none';
      await load();
    });
    $('btnDel').addEventListener('click', async () => {
      if (!confirm('삭제하시겠어요?')) return;
      const { error } = await sb.from(table).delete().eq('id', current.id);
      if (error) { alert(error.message); return; }
      $('editWrap').style.display = 'none';
      await load();
    });
    load();
  }

  // ---- utils ---------------------------------------------------------
  function escape(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
    })[c]);
  }
  function fmtDate(s) {
    if (!s) return '-';
    try { return new Date(s).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }); }
    catch { return s; }
  }

  // ---- Start ---------------------------------------------------------
  boot();
})();
