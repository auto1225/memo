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
    // Try full schema first; fall back to legacy schema without 'role' column.
    let { data, error } = await sb
      .from('profiles')
      .select('role, display_name, plan')
      .eq('id', user.id)
      .maybeSingle();
    if (error && /role|column/i.test(error.message || '')) {
      // role column missing — query with just display_name/plan
      const r2 = await sb
        .from('profiles')
        .select('display_name, plan')
        .eq('id', user.id)
        .maybeSingle();
      data = r2.data;
      error = r2.error;
    }
    if (error) {
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
  // Landing-page sections: each key prefix corresponds to a real section
  // of index.html. renderLandingSection() uses this map to filter.
  const LANDING_SECTIONS = {
    'ls-nav':      { prefix: 'nav.',      label: '네비게이션',   desc: '상단 네비게이션 바 메뉴, 로고, 버튼 문구' },
    'ls-hero':     { prefix: 'hero.',     label: '히어로 섹션',  desc: '첫 화면의 헤드라인과 CTA 버튼' },
    'ls-featured': { prefix: 'featured.', label: '피처드 카드',  desc: '14가지 도구, 평생 무료 등 4개 카드' },
    'ls-features': { prefix: 'features.', label: '기능 소개',    desc: '850KB 헤드라인부터 워크스페이스 샘플까지' },
    'ls-download': { prefix: 'download.', label: '다운로드 섹션', desc: '다운로드 헤드라인 + 4개 다운로드 카드 + PWA 가이드' },
    'ls-cta':      { prefix: 'cta.',      label: '무료 시작 CTA', desc: '가입 유도 섹션 (버튼/부제/공지)' },
    'ls-faq':      { prefix: 'faq.',      label: 'FAQ',          desc: '자주 묻는 질문 제목과 항목' },
    'ls-footer':   { prefix: 'footer.',   label: '푸터',         desc: '하단 링크·저작권·회사 정보' },
  };

  const titles = {
    dashboard: ['대시보드', '대시보드'],
    content:   ['콘텐츠 관리 (전체)', '랜딩 / 콘텐츠'],
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
    if (LANDING_SECTIONS[v]) {
      pageTitle.textContent = LANDING_SECTIONS[v].label;
      crumb.textContent = '랜딩 / ' + LANDING_SECTIONS[v].label;
      return;
    }
    const t = titles[v] || ['', '관리자'];
    pageTitle.textContent = t[0];
    crumb.textContent = t[1];
  }

  async function renderLandingSection(v) {
    const info = LANDING_SECTIONS[v];
    // Reuse renderCmsContent but filtered to this prefix + show description
    await renderCmsContent(info);
  }

  async function render(v) {
    setTitle(v);
    view.innerHTML = '<div style="color:var(--ink-soft);padding:20px;">로딩 중...</div>';
    // Friendly setup banner if cms_content table is missing
    const { error: probe } = await sb.from('cms_content').select('key', { head: true, count: 'exact' });
    if (probe && /relation .*cms_content.* does not exist|could not find the table/i.test(probe.message || '')) {
      view.innerHTML = `
        <div class="panel" style="border-left:4px solid var(--warn, #f59e0b);">
          <div class="panel-title">초기 설정이 필요합니다</div>
          <p>Supabase에 CMS 테이블(<code>cms_content</code>, <code>cms_notices</code> 등)이 아직 만들어지지 않았습니다.
          아래 SQL을 한 번만 실행해주세요 (30초).</p>
          <ol style="line-height:1.8;">
            <li><a href="https://app.supabase.com/project/rbscvtnfveakwjwrteux/sql/new" target="_blank" rel="noopener"><b>Supabase SQL Editor 열기</b></a></li>
            <li><a href="https://raw.githubusercontent.com/auto1225/memo/main/supabase-SETUP-ALL.sql" target="_blank" rel="noopener"><b>SETUP SQL 전체 복사</b></a> → Editor에 붙여넣기</li>
            <li>우측 하단 <b>Run</b> 클릭</li>
            <li>추가로 한 줄 더: <code>update public.profiles set role='admin' where email='auto0104@gmail.com';</code></li>
          </ol>
          <p style="color:var(--ink-soft);font-size:12px;">또는 <b>Personal Access Token</b>을 공유해주시면 자동으로 세팅됩니다.
          토큰 발급: <a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noopener">supabase.com/dashboard/account/tokens</a></p>
        </div>`;
      return;
    }
    try {
      if (v === 'dashboard')       await renderDashboard();
      else if (v === 'users')      await renderUsers();
      else if (v === 'announce')   await renderNotices();
      else if (v === 'faq')        await renderFAQ();
      else if (v === 'content')    await renderCmsContent(null);
      else if (LANDING_SECTIONS[v]) await renderLandingSection(v);
      else if (v === 'terms')      await renderCmsDoc('terms', '약관 관리');
      else if (v === 'popup')      await renderPopups();
      else if (v === 'analytics')  await renderAnalytics();
      else if (v === 'downloads')  await renderDownloads();
      else if (v === 'board')      await renderBoard();
      else if (v === 'payments')   await renderPayments();
      else if (v === 'serials')    await renderSerials();
      else if (v === 'features')   await renderEntitlements();
      else if (v === 'settings')   await renderSettings();
      else if (v === 'header')     await renderHeaderFooter();
      else if (v === 'auth')       await renderAuthSettings();
      else                         renderContentPage(v);
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
                <td style="white-space:nowrap;">
                  <button class="btn btn-save" data-id="${u.id}">저장</button>
                  <button class="btn danger btn-del-user" data-id="${u.id}" data-email="${escape(u.email)}">삭제</button>
                </td>
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
      document.querySelectorAll('.btn-del-user').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm(`${btn.dataset.email} 프로필을 삭제하시겠어요? (auth.users는 그대로 남습니다)`)) return;
        const { error } = await sb.from('profiles').delete().eq('id', btn.dataset.id);
        if (error) { alert(error.message); return; }
        await load($('userSearch').value.trim());
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
                <td>${n.pinned?'<svg style="width:13px;height:13px;vertical-align:-2px;margin-right:4px;" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14l-1.68-9.24A2 2 0 0 0 15.36 6H8.64a2 2 0 0 0-1.96 1.76L5 17z"/></svg>':''}${escape(n.title)}</td>
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

  // ---- MODULE: CMS content (landing-page DB) ------------------------
  // Lists every row in cms_content (key/value/kind/note) so the admin can
  // edit any landing-page text/image/url live. New keys can be added too.
  async function renderCmsContent(section) {
    const scopedPrefix = section && section.prefix ? section.prefix : '';
    view.innerHTML = `
      <div class="panel">
        <div class="panel-title">${section ? section.label : '콘텐츠 항목'}
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="search" id="ccSearch" placeholder="키/내용 검색" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
            <button class="btn primary" id="ccNew">+ 새 항목</button>
          </div>
        </div>
        <div id="ccHelp" style="color:var(--ink-soft);font-size:12px;margin-bottom:10px;">
          ${section
            ? `이 섹션의 키 접두사는 <code>${scopedPrefix}</code>. ${escape(section.desc)}`
            : `랜딩 페이지(index.html)의 요소에 <code>data-cms="키"</code> 속성을 달면 이 테이블의 값으로 자동 치환됩니다. kind는 text / html / image / url 중 선택.`}
        </div>
        <div id="ccList">로딩…</div>
      </div>
      <div class="panel" id="ccEditor" style="display:none;">
        <div class="panel-title"><span id="ccEditTitle">편집</span>
          <button class="btn" id="ccCancel">취소</button>
        </div>
        <div class="field"><label>키 (data-cms 속성과 동일)</label><input id="ccKey" placeholder="예: hero.title"></div>
        <div class="field"><label>유형</label>
          <select id="ccKind">
            <option value="text">text (플레인 텍스트)</option>
            <option value="html">html (서식 포함)</option>
            <option value="image">image (img src URL)</option>
            <option value="url">url (링크 href)</option>
          </select>
        </div>
        <div class="field"><label>값</label><textarea id="ccValue" rows="6"></textarea></div>
        <div class="field"><label>메모 (내부용)</label><input id="ccNote"></div>
        <div style="display:flex;gap:8px;">
          <button class="btn primary" id="ccSave">저장</button>
          <button class="btn danger" id="ccDelete" style="display:none;">삭제</button>
        </div>
      </div>
    `;
    let current = null;
    const load = async (q) => {
      let query = sb.from('cms_content').select('*').order('key', { ascending: true }).limit(500);
      if (scopedPrefix) query = query.like('key', scopedPrefix + '%');
      const { data, error } = await query;
      if (error) { $('ccList').innerHTML = '<div style="color:var(--danger);">'+error.message+'</div>'; return; }
      const filtered = !q ? (data||[]) :
        (data||[]).filter(r => (r.key+' '+(r.value||'')+' '+(r.note||'')).toLowerCase().includes(q.toLowerCase()));
      $('ccList').innerHTML = filtered.length ? `
        <table class="t">
          <thead><tr><th>키</th><th>유형</th><th>값 미리보기</th><th>메모</th><th>업데이트</th><th></th></tr></thead>
          <tbody>
            ${filtered.map(r => `
              <tr>
                <td><code style="font-size:12px;">${escape(r.key)}</code></td>
                <td><span class="badge ${r.kind==='html'?'admin':r.kind==='image'?'paid':'user'}">${r.kind||'text'}</span></td>
                <td>${escape((r.value||'').slice(0, 80))}</td>
                <td style="color:var(--ink-soft);">${escape(r.note||'')}</td>
                <td>${fmtDate(r.updated_at)}</td>
                <td><button class="btn btn-ccedit" data-key="${encodeURIComponent(r.key)}">편집</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div style="color:var(--ink-soft);padding:20px;text-align:center;">항목 없음. "+ 새 항목"으로 추가하세요.</div>';
      document.querySelectorAll('.btn-ccedit').forEach(btn => btn.addEventListener('click', async () => {
        const key = decodeURIComponent(btn.dataset.key);
        const { data } = await sb.from('cms_content').select('*').eq('key', key).single();
        openEditor(data);
      }));
    };
    const openEditor = (row) => {
      current = row || null;
      $('ccEditor').style.display = 'block';
      $('ccEditTitle').textContent = row ? ('편집: ' + row.key) : '새 콘텐츠 항목';
      $('ccKey').value = row?.key || '';
      $('ccKey').readOnly = !!row;
      $('ccKind').value = row?.kind || 'text';
      $('ccValue').value = row?.value || '';
      $('ccNote').value = row?.note || '';
      $('ccDelete').style.display = row ? 'inline-flex' : 'none';
    };
    $('ccNew').addEventListener('click', () => {
      openEditor(null);
      if (scopedPrefix) $('ccKey').value = scopedPrefix;
    });
    $('ccCancel').addEventListener('click', () => $('ccEditor').style.display='none');
    $('ccSave').addEventListener('click', async () => {
      const payload = {
        key: $('ccKey').value.trim(),
        kind: $('ccKind').value,
        value: $('ccValue').value,
        note: $('ccNote').value,
        updated_at: new Date().toISOString(),
      };
      if (!payload.key) { alert('키는 필수입니다 (예: hero.title)'); return; }
      const { error } = await sb.from('cms_content').upsert(payload);
      if (error) { alert(error.message); return; }
      $('ccEditor').style.display='none';
      await load($('ccSearch').value.trim());
    });
    $('ccDelete').addEventListener('click', async () => {
      if (!current || !confirm('정말 삭제하시겠어요? 이 키로 연결된 랜딩 요소는 원래 HTML 텍스트로 복귀합니다.')) return;
      const { error } = await sb.from('cms_content').delete().eq('key', current.key);
      if (error) { alert(error.message); return; }
      $('ccEditor').style.display='none';
      await load($('ccSearch').value.trim());
    });
    let t;
    $('ccSearch').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => load(e.target.value.trim()), 250); });
    load('');
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

  // ---- MODULE: 게시판 관리 (cms_board) -----------------------------
  async function renderBoard() {
    return renderCmsListCrud('cms_board',
      ['title','category','author_email','body','is_pinned','is_visible'],
      '게시글',
      ['제목','분류','작성자 이메일','본문','상단 고정 (true/false)','공개 (true/false)']
    );
  }

  // ---- MODULE: 판매/결제 (cms_payments) ----------------------------
  async function renderPayments() {
    view.innerHTML = `
      <div class="panel">
        <div class="panel-title">판매 / 결제
          <div style="display:flex;gap:8px;">
            <select id="payFilter" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
              <option value="">전체 상태</option>
              <option value="pending">pending</option>
              <option value="paid">paid</option>
              <option value="refunded">refunded</option>
              <option value="failed">failed</option>
            </select>
            <button class="btn primary" id="payNew">+ 결제 기록 추가</button>
          </div>
        </div>
        <div id="payList">로딩…</div>
      </div>
      <div class="panel" id="payEd" style="display:none;">
        <div class="panel-title"><span id="payEdTitle">결제 기록</span>
          <button class="btn" id="payCancel">취소</button></div>
        <div class="field"><label>사용자 이메일</label><input id="pf-email"></div>
        <div class="field"><label>금액</label><input id="pf-amount" type="number" step="0.01"></div>
        <div class="field"><label>통화</label><input id="pf-currency" value="KRW"></div>
        <div class="field"><label>상태</label>
          <select id="pf-status"><option>pending</option><option>paid</option><option>refunded</option><option>failed</option></select>
        </div>
        <div class="field"><label>결제 수단</label><input id="pf-method" placeholder="card / bank / paypal..."></div>
        <div class="field"><label>제공자</label><input id="pf-provider" placeholder="stripe / toss / kakaopay..."></div>
        <div class="field"><label>거래 ID</label><input id="pf-txn"></div>
        <div class="field"><label>메모</label><input id="pf-memo"></div>
        <div style="display:flex;gap:8px;">
          <button class="btn primary" id="paySave">저장</button>
          <button class="btn danger" id="payDel" style="display:none;">삭제</button>
        </div>
      </div>`;
    let current = null;
    const load = async () => {
      const status = $('payFilter').value;
      let q = sb.from('cms_payments').select('*').order('created_at', { ascending: false }).limit(200);
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) { $('payList').innerHTML = '<div style="color:var(--danger);">'+error.message+'</div>'; return; }
      $('payList').innerHTML = (data||[]).length ? `
        <table class="t"><thead><tr><th>생성</th><th>이메일</th><th>금액</th><th>상태</th><th>제공자</th><th></th></tr></thead>
        <tbody>${data.map(p => `<tr>
          <td>${fmtDate(p.created_at)}</td>
          <td>${escape(p.user_email||'-')}</td>
          <td>${(p.amount||0).toLocaleString()} ${escape(p.currency||'')}</td>
          <td><span class="badge ${p.status==='paid'?'paid':p.status==='refunded'?'admin':'trial'}">${p.status}</span></td>
          <td>${escape(p.provider||'-')}</td>
          <td><button class="btn pe-edit" data-id="${p.id}">편집</button></td>
        </tr>`).join('')}</tbody></table>` : '<div style="color:var(--ink-soft);padding:20px;text-align:center;">결제 기록 없음</div>';
      document.querySelectorAll('.pe-edit').forEach(b => b.addEventListener('click', async () => {
        const { data } = await sb.from('cms_payments').select('*').eq('id', b.dataset.id).single();
        openEd(data);
      }));
    };
    const openEd = (p) => {
      current = p || null;
      $('payEd').style.display = 'block';
      ['email','amount','currency','status','method','provider'].forEach((k,i) => {
        const id = 'pf-' + ['email','amount','currency','status','method','provider'][i];
        $(id).value = p?.['user_'+k] ?? p?.[k] ?? (k==='currency'?'KRW':(k==='status'?'pending':''));
      });
      $('pf-email').value   = p?.user_email || '';
      $('pf-amount').value  = p?.amount || '';
      $('pf-currency').value= p?.currency || 'KRW';
      $('pf-status').value  = p?.status || 'pending';
      $('pf-method').value  = p?.method || '';
      $('pf-provider').value= p?.provider || '';
      $('pf-txn').value     = p?.provider_txn_id || '';
      $('pf-memo').value    = p?.memo || '';
      $('payDel').style.display = p ? 'inline-flex' : 'none';
    };
    $('payNew').addEventListener('click', () => openEd(null));
    $('payCancel').addEventListener('click', () => $('payEd').style.display='none');
    $('payFilter').addEventListener('change', load);
    $('paySave').addEventListener('click', async () => {
      const payload = {
        user_email: $('pf-email').value,
        amount: Number($('pf-amount').value) || 0,
        currency: $('pf-currency').value,
        status: $('pf-status').value,
        method: $('pf-method').value,
        provider: $('pf-provider').value,
        provider_txn_id: $('pf-txn').value,
        memo: $('pf-memo').value,
      };
      const q = current ? sb.from('cms_payments').update(payload).eq('id', current.id)
                        : sb.from('cms_payments').insert(payload);
      const { error } = await q;
      if (error) { alert(error.message); return; }
      $('payEd').style.display='none';
      await load();
    });
    $('payDel').addEventListener('click', async () => {
      if (!confirm('이 결제 기록을 삭제하시겠어요?')) return;
      const { error } = await sb.from('cms_payments').delete().eq('id', current.id);
      if (error) { alert(error.message); return; }
      $('payEd').style.display='none';
      await load();
    });
    load();
  }

  // ---- MODULE: 시리얼 관리 (cms_serials) --------------------------
  async function renderSerials() {
    view.innerHTML = `
      <div class="panel">
        <div class="panel-title">시리얼 관리
          <button class="btn primary" id="srNew">+ 새 시리얼</button></div>
        <div id="srList">로딩…</div>
      </div>
      <div class="panel" id="srEd" style="display:none;">
        <div class="panel-title"><span id="srEdTitle">시리얼</span>
          <button class="btn" id="srCancel">취소</button></div>
        <div class="field"><label>코드</label>
          <div style="display:flex;gap:6px;"><input id="sf-code" style="flex:1;"><button class="btn" id="srGen" type="button">랜덤 생성</button></div>
        </div>
        <div class="field"><label>플랜</label>
          <select id="sf-plan"><option>free</option><option>trial</option><option selected>paid</option></select>
        </div>
        <div class="field"><label>최대 사용 횟수</label><input id="sf-max" type="number" value="1"></div>
        <div class="field"><label>만료일 (선택)</label><input id="sf-exp" type="date"></div>
        <div class="field"><label>폐기 여부</label>
          <select id="sf-rev"><option value="false">활성</option><option value="true">폐기</option></select>
        </div>
        <div class="field"><label>메모</label><input id="sf-memo"></div>
        <div style="display:flex;gap:8px;">
          <button class="btn primary" id="srSave">저장</button>
          <button class="btn danger" id="srDel" style="display:none;">삭제</button>
        </div>
      </div>`;
    let current = null;
    const load = async () => {
      const { data, error } = await sb.from('cms_serials').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) { $('srList').innerHTML = '<div style="color:var(--danger);">'+error.message+'</div>'; return; }
      $('srList').innerHTML = (data||[]).length ? `
        <table class="t"><thead><tr><th>코드</th><th>플랜</th><th>사용</th><th>만료</th><th>상태</th><th></th></tr></thead>
        <tbody>${data.map(s => `<tr>
          <td><code style="font-size:12px;">${escape(s.code)}</code></td>
          <td><span class="badge ${s.plan==='paid'?'paid':'trial'}">${escape(s.plan)}</span></td>
          <td>${s.used_count}/${s.max_uses}</td>
          <td>${s.expires_at ? fmtDate(s.expires_at) : '-'}</td>
          <td>${s.revoked ? '<span class="badge" style="background:#fde0e0;color:#b91c1c;">폐기</span>' : '<span class="badge paid">활성</span>'}</td>
          <td><button class="btn sr-edit" data-id="${s.id}">편집</button></td>
        </tr>`).join('')}</tbody></table>` : '<div style="color:var(--ink-soft);padding:20px;text-align:center;">시리얼 없음</div>';
      document.querySelectorAll('.sr-edit').forEach(b => b.addEventListener('click', async () => {
        const { data } = await sb.from('cms_serials').select('*').eq('id', b.dataset.id).single();
        openEd(data);
      }));
    };
    const openEd = (s) => {
      current = s || null;
      $('srEd').style.display = 'block';
      $('sf-code').value = s?.code || '';
      $('sf-plan').value = s?.plan || 'paid';
      $('sf-max').value  = s?.max_uses || 1;
      $('sf-exp').value  = s?.expires_at ? new Date(s.expires_at).toISOString().slice(0,10) : '';
      $('sf-rev').value  = String(!!s?.revoked);
      $('sf-memo').value = s?.memo || '';
      $('srDel').style.display = s ? 'inline-flex' : 'none';
    };
    $('srNew').addEventListener('click', () => openEd(null));
    $('srCancel').addEventListener('click', () => $('srEd').style.display='none');
    $('srGen').addEventListener('click', () => {
      const r = (n) => Array.from({length:n}, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
      $('sf-code').value = `${r(4)}-${r(4)}-${r(4)}-${r(4)}`;
    });
    $('srSave').addEventListener('click', async () => {
      const payload = {
        code: $('sf-code').value.trim(),
        plan: $('sf-plan').value,
        max_uses: Number($('sf-max').value) || 1,
        expires_at: $('sf-exp').value || null,
        revoked: $('sf-rev').value === 'true',
        memo: $('sf-memo').value,
      };
      if (!payload.code) { alert('코드 필수'); return; }
      const q = current ? sb.from('cms_serials').update(payload).eq('id', current.id)
                        : sb.from('cms_serials').insert(payload);
      const { error } = await q;
      if (error) { alert(error.message); return; }
      $('srEd').style.display='none';
      await load();
    });
    $('srDel').addEventListener('click', async () => {
      if (!confirm('이 시리얼을 영구 삭제하시겠어요?')) return;
      const { error } = await sb.from('cms_serials').delete().eq('id', current.id);
      if (error) { alert(error.message); return; }
      $('srEd').style.display='none';
      await load();
    });
    load();
  }

  // ---- MODULE: 앱 기능 제한 (cms_entitlements) --------------------
  async function renderEntitlements() {
    return renderCmsListCrud('cms_entitlements',
      ['feature_key','label','min_plan','enabled','note'],
      '기능 제한',
      ['기능 키 (고유)','라벨','최소 플랜 (free/trial/paid)','활성 (true/false)','메모']
    );
  }

  // ---- MODULE: 설정 (cms_settings) --------------------------------
  async function renderSettings() {
    return renderCmsListCrud('cms_settings',
      ['key','value','note'],
      '사이트 설정',
      ['키','값','메모']
    );
  }

  // ---- MODULE: 헤더 & 푸터 (cms_content 중 header.* / footer.*) ---
  async function renderHeaderFooter() {
    view.innerHTML = `
      <div class="panel">
        <div class="panel-title">헤더 & 푸터</div>
        <p style="color:var(--ink-soft);font-size:12px;">네비게이션은 랜딩 → 네비게이션 메뉴에서 관리. 여기는 footer.* 키 전용.</p>
      </div>
      <div id="hfView"></div>`;
    const wrap = $('hfView');
    // Reuse renderCmsContent with prefix 'footer.'
    const tmp = view.querySelector('.panel');
    view.innerHTML = ''; view.appendChild(tmp); view.appendChild(wrap);
    await renderCmsContent({ prefix: 'footer.', label: '푸터', desc: '푸터 텍스트/링크/카피라이트 등' });
  }

  // ---- MODULE: 회원가입/로그인 설정 -------------------------------
  async function renderAuthSettings() {
    view.innerHTML = `
      <div class="panel">
        <div class="panel-title">회원가입/로그인 설정</div>
        <p style="color:var(--ink-soft);font-size:12px;">아래 키들을 저장하면 <code>cms_settings</code>에 들어갑니다. 프론트에서 읽어 배너/공지로 활용.</p>
      </div>
      <div id="asView"></div>`;
    const tmp = view.querySelector('.panel');
    view.innerHTML = ''; view.appendChild(tmp); view.appendChild($('asView'));
    // Reuse settings-style list but filtered to auth.*
    return renderCmsListCrud('cms_settings',
      ['key','value','note'],
      '인증 설정',
      ['키 (예: auth.signup_enabled)','값','메모']
    );
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
