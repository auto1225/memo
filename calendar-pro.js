/**
 * JustANotepad — Calendar Pro (월/주/일/년/할일 + CRUD + 알림 + ICS + 검색)
 * --------------------------------------------------------------------------
 * Overrides window.openCalendar(). Mounts a rich multi-view calendar UI
 * inside the existing #calModal. Persists events under state.calEvents
 * (localStorage, auto-synced via the app's existing save()).
 *
 * Event shape:
 *   { id, title, startAt (ISO), endAt (ISO, optional), allDay,
 *     category, color, location, memo, linkedTabId,
 *     recurring: { freq, interval, until, byDay? } | null,
 *     reminder: { offsetMin: 10 } | null,  // minutes before startAt
 *     notified: boolean  // set after a reminder fires }
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.__janCalPro__) return;
  window.__janCalPro__ = true;

  const D = window.JANCalData;
  if (!D) { console.warn('[JANCal] JANCalData missing — load calendar-data.js first'); return; }

  const CATEGORIES = [
    { id: 'personal', name: '개인',   color: '#D97757' },
    { id: 'work',     name: '업무',   color: '#3B82F6' },
    { id: 'family',   name: '가족',   color: '#10B981' },
    { id: 'study',    name: '학습',   color: '#8B5CF6' },
    { id: 'health',   name: '건강',   color: '#EC4899' },
    { id: 'other',    name: '기타',   color: '#6B7280' },
  ];
  const CAT_BY_ID = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

  // ---- View state ------------------------------------------------------
  let state = null;       // alias to global window state
  let view = 'month';     // month | week | day | year | todo
  let cursor = new Date();
  let selectedId = null;
  let query = '';
  // Category filter — set of category ids that are SHOWN. Default: all.
  let activeCategories = new Set(CATEGORIES.map(c => c.id));
  // Drag state for month-view rescheduling
  let dragging = null;

  // ---- Utilities -------------------------------------------------------
  const $ = (sel, root) => (root||document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root||document).querySelectorAll(sel));
  const esc = (s) => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'})[c]);
  const uid = () => 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  const sameDay = (a, b) => {
    const da = new Date(a), db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
  };
  const startOfWeek = (d) => { const x = new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate() - x.getDay()); return x; };
  const endOfWeek = (d) => { const x = startOfWeek(d); x.setDate(x.getDate() + 6); x.setHours(23,59,59,999); return x; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };

  // ---- Inject CSS ------------------------------------------------------
  function injectCSS() {
    if (document.getElementById('janCalProStyles')) return;
    const css = `
      /* ========== TAB MODE OVERRIDES ==========
         When calendar mounts into .page as a tab, neutralize every paper-
         template background, padding, line-height, and placeholder that
         would otherwise bleed through behind the calendar UI. */
      .page.cal-tab-mode {
        background: #ffffff !important;
        background-image: none !important;
        padding: 0 !important;
        margin: 0 !important;
        min-height: 0 !important;
        line-height: normal !important;
        color: var(--ink) !important;
        font-size: 14px !important;
        outline: none !important;
        cursor: default !important;
      }
      .page.cal-tab-mode:empty::before { content: none !important; }
      .page.cal-tab-mode::before,
      .page.cal-tab-mode::after { display: none !important; }
      .page.cal-tab-mode * { cursor: inherit; }
      .page.cal-tab-mode button,
      .page.cal-tab-mode .cp-day,
      .page.cal-tab-mode .cp-hour-slot,
      .page.cal-tab-mode .upcoming-item,
      .page.cal-tab-mode .cat-filter,
      .page.cal-tab-mode .cp-year-day,
      .page.cal-tab-mode .ev,
      .page.cal-tab-mode .cp-week-ev { cursor: pointer; }
      .page.cal-tab-mode input,
      .page.cal-tab-mode textarea,
      .page.cal-tab-mode select { cursor: text; }

      #calProRoot * { box-sizing: border-box; }
      #calProRoot { font-family: inherit; color: var(--ink); background: #ffffff; }
      .cp-topbar { display:flex; align-items:center; gap:8px; padding:12px 14px;
        border-bottom:1px solid var(--paper-edge); flex-wrap:wrap; background:#fafaf7; }
      .cp-tabs { display:inline-flex; background:var(--paper-edge); border-radius:8px; padding:2px; }
      .cp-tab { padding:5px 12px; font-size:12px; border:0; background:transparent; color:var(--ink-soft);
        border-radius:6px; cursor:pointer; font-weight:600; }
      .cp-tab.active { background:white; color:var(--accent); box-shadow:0 1px 3px rgba(0,0,0,.08); }
      .cp-nav { display:inline-flex; gap:4px; }
      .cp-nav button { width:28px; height:28px; border:0; background:var(--paper-edge); border-radius:6px; cursor:pointer; color:var(--ink); font-weight:700; }
      .cp-nav button:hover { background:var(--tab-hover); }
      .cp-label { font-size:14px; font-weight:700; padding:0 6px; min-width:110px; text-align:center; }
      .cp-today { padding:5px 12px; background:white; border:1px solid var(--paper-edge); border-radius:6px; font-size:12px; cursor:pointer; }
      .cp-spacer { flex:1; }
      .cp-search { padding:5px 10px; border:1px solid var(--paper-edge); border-radius:6px; font-size:12px; width:160px; }
      .cp-add { padding:5px 12px; background:var(--accent); color:#fff; border:0; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer; }
      .cp-menu-btn { width:28px; height:28px; border:0; background:transparent; cursor:pointer; font-weight:700; color:var(--ink-soft); border-radius:6px; }
      .cp-menu-btn:hover { background:var(--tab-hover); }
      .cp-menu-dropdown { position:absolute; right:10px; top:46px; background:#fff; border:1px solid var(--paper-edge);
        border-radius:8px; box-shadow:0 6px 20px rgba(0,0,0,.12); padding:4px; z-index:200; display:none; min-width:160px; }
      .cp-menu-dropdown.show { display:block; }
      .cp-menu-dropdown button { display:block; width:100%; text-align:left; background:transparent; border:0;
        padding:7px 12px; font-size:12px; cursor:pointer; border-radius:4px; color:var(--ink); }
      .cp-menu-dropdown button:hover { background:var(--tab-hover); }

      .cp-body { display:flex; max-height:540px; overflow:hidden; background:#ffffff; }
      .cp-main { flex:1; overflow:auto; padding:0; position:relative; background:#ffffff; }
      .cp-side { width:200px; border-left:1px solid var(--paper-edge); padding:12px; overflow-y:auto; font-size:12px; display:flex; flex-direction:column; gap:14px; flex:0 0 auto; background:#fafaf7; }
      /* Tab mode: fill whole page area */
      .page.cal-tab-mode #calProRoot { height: 100%; display: flex; flex-direction: column; }
      .page.cal-tab-mode .cp-body { flex: 1 1 auto; max-height: none !important; min-height: 0; position:relative; }
      .page.cal-tab-mode .cp-main { overflow: auto; }
      .page.cal-tab-mode .cp-month-grid { min-height: 100%; }
      .page.cal-tab-mode .cp-day { min-height: 96px; }
      /* Container-width hide: side panel vanishes when pad is narrower
         than 600px and surfaces only on ☰ click */
      #calProRoot.narrow .cp-side { display: none; }
      #calProRoot.narrow .cp-side.show {
        display: flex; position: absolute; right: 0; top: 0; bottom: 0;
        width: min(240px, 85%); z-index: 30; background: #fafaf7;
        box-shadow: -8px 0 24px rgba(0,0,0,.12);
      }
      #calProRoot.narrow .cp-side-toggle { display: flex; align-items:center; justify-content:center; }
      #calProRoot.narrow .cp-topbar { padding: 10px 12px; }
      #calProRoot.narrow .cp-topbar .cp-search { width: 120px; }
      #calProRoot.narrow .cp-topbar .cp-label { min-width: auto; }
      .cp-side-toggle { display:none; position:absolute; top:8px; right:8px; width:28px; height:28px; border:0; background:var(--paper-edge); border-radius:6px; cursor:pointer; font-size:12px; color:var(--ink); z-index:50; }
      @media (max-width: 720px) {
        .cp-side { display:none; }
        .cp-side.show { display:flex; position:absolute; right:0; top:0; bottom:0; z-index:30; background:#fff; width:240px; box-shadow:-6px 0 20px rgba(0,0,0,.1); }
        .cp-side-toggle { display:flex; align-items:center; justify-content:center; }
      }
      .cp-side .section-title { font-size:10px; color:var(--ink-soft); font-weight:700; letter-spacing:0.05em; text-transform:uppercase; margin-bottom:4px; }
      .cp-side .upcoming-item { padding:6px 8px; border-radius:6px; background:var(--tab-inactive); margin-bottom:4px; cursor:pointer; border-left:3px solid var(--accent); }
      .cp-side .upcoming-item:hover { background:var(--tab-hover); }
      .cp-side .upcoming-item .t { font-weight:600; font-size:12px; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .cp-side .upcoming-item .d { font-size:10px; color:var(--ink-soft); }
      .cp-side .cat-filter { display:flex; align-items:center; gap:6px; padding:4px 0; cursor:pointer; }
      .cp-side .cat-filter input { margin:0; }
      .cp-side .cat-dot { width:10px; height:10px; border-radius:50%; flex:0 0 10px; }

      /* Month view */
      .cp-month-grid { display:grid; grid-template-columns:repeat(7, 1fr); border-top:1px solid var(--paper-edge); }
      .cp-month-head { text-align:center; padding:6px 0; font-size:11px; color:var(--ink-soft); font-weight:700; border-right:1px solid var(--paper-edge); border-bottom:1px solid var(--paper-edge); }
      .cp-month-head.sun { color:#e53935; }
      .cp-month-head.sat { color:#1e88e5; }
      .cp-month-head:last-child { border-right:0; }
      .cp-day {
        position:relative; min-height:84px; padding:4px;
        border-right:1px solid var(--paper-edge); border-bottom:1px solid var(--paper-edge);
        cursor:pointer; overflow:hidden; font-size:11px;
      }
      .cp-day:nth-child(7n) { border-right:0; }
      .cp-day.other { background:#fafafa; color:#bbb; }
      .cp-day.today { background:color-mix(in srgb, var(--accent) 10%, transparent); }
      .cp-day.selected { outline:2px solid var(--accent); outline-offset:-2px; z-index:2; }
      .cp-day:hover { background:var(--tab-hover); }
      .cp-day .dn { font-weight:700; font-size:12px; margin-bottom:2px; }
      .cp-day .dn.sun { color:#e53935; }
      .cp-day .dn.sat { color:#1e88e5; }
      .cp-day .hol { display:block; color:#e53935; font-size:9px; font-weight:600; margin-bottom:2px; }
      .cp-day .lun { display:inline-block; color:#94a3b8; font-size:9px; font-weight:500; margin-left:4px; vertical-align:1px; }
      .cp-day .lun.leap { color:#a16207; font-style:italic; }
      .cp-day .ev {
        display:block; background:var(--accent); color:#fff; padding:1px 4px;
        border-radius:3px; font-size:10px; margin-bottom:1px;
        overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      }
      .cp-day .ev.all-day { font-weight:700; }
      /* Multi-day span chips */
      .cp-day .ev.span-start { border-radius:3px 0 0 3px; margin-right:-1px; }
      .cp-day .ev.span-mid { border-radius:0; margin-left:-1px; margin-right:-1px; padding-left:0; padding-right:0; }
      .cp-day .ev.span-end { border-radius:0 3px 3px 0; margin-left:-1px; padding-left:0; }
      .cp-day .ev.span-mid, .cp-day .ev.span-end { color:rgba(255,255,255,0.4); }
      .cp-day .more { font-size:9px; color:var(--ink-soft); }

      /* Week/Day view */
      .cp-week-wrap { display:grid; grid-template-columns:40px repeat(7, 1fr); overflow:auto; }
      .cp-week-wrap.day-view { grid-template-columns:40px 1fr; }
      .cp-timeline-head { position:sticky; top:0; background:#fff; z-index:5; border-bottom:1px solid var(--paper-edge);
        padding:6px 4px; text-align:center; font-size:11px; font-weight:700; }
      .cp-timeline-head.today { color:var(--accent); }
      .cp-hour-slot { border-right:1px solid var(--paper-edge); border-bottom:1px solid var(--paper-edge); height:32px; position:relative; cursor:pointer; }
      .cp-hour-slot:hover { background:var(--tab-hover); }
      .cp-hour-label { border-right:1px solid var(--paper-edge); height:32px; text-align:right; padding:2px 4px; font-size:9px; color:var(--ink-soft); }
      .cp-week-ev {
        position:absolute; left:1px; right:1px; background:var(--accent); color:#fff;
        border-radius:3px; padding:2px 4px; font-size:10px; overflow:hidden;
        cursor:pointer; z-index:2;
      }

      /* Year heatmap */
      .cp-year-grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:16px; padding:14px; }
      .cp-year-month { border:1px solid var(--paper-edge); border-radius:8px; padding:8px; }
      .cp-year-month h4 { margin:0 0 6px; font-size:12px; color:var(--ink); text-align:center; font-weight:700; }
      .cp-year-days { display:grid; grid-template-columns:repeat(7, 1fr); gap:1px; }
      .cp-year-day {
        aspect-ratio:1; border-radius:2px; background:#f0f0f0; font-size:7px; text-align:center;
        padding-top:1px; cursor:pointer; transition:transform 0.08s; color:var(--ink-soft);
      }
      .cp-year-day.other { visibility:hidden; }
      .cp-year-day.l1 { background:#e0f0ff; }
      .cp-year-day.l2 { background:#a0d0ff; }
      .cp-year-day.l3 { background:#5095f0; color:#fff; }
      .cp-year-day.l4 { background:#1060d0; color:#fff; }
      .cp-year-day.today { outline:1px solid var(--accent); }
      .cp-year-day:hover { transform:scale(1.3); z-index:3; position:relative; }

      /* Todo list */
      .cp-todo-list { padding:10px; }
      .cp-todo-section { font-size:11px; color:var(--ink-soft); font-weight:700; text-transform:uppercase; margin:14px 0 6px; letter-spacing:0.04em; }
      .cp-todo-item { display:flex; align-items:flex-start; gap:10px; padding:8px 10px; border-radius:8px; background:var(--tab-inactive); margin-bottom:4px; cursor:pointer; }
      .cp-todo-item:hover { background:var(--tab-hover); }
      .cp-todo-item .dot { width:10px; height:10px; border-radius:50%; flex:0 0 10px; margin-top:3px; }
      .cp-todo-item .t { flex:1; }
      .cp-todo-item .t .tt { font-weight:600; font-size:13px; }
      .cp-todo-item .t .td { font-size:11px; color:var(--ink-soft); margin-top:2px; }
      .cp-todo-item .rel { font-size:10px; font-weight:700; color:var(--accent); flex:0 0 auto; }

      /* Event editor modal */
      .cp-edit-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.3); z-index:10002; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(3px); }
      .cp-edit-card { background:#fff; width:min(500px, 94vw); max-height:92vh; overflow-y:auto;
        border-radius:12px; padding:22px; box-shadow:0 20px 60px rgba(0,0,0,0.18); }
      .cp-edit-card h3 { margin:0 0 14px; font-size:16px; }
      .cp-edit-field { margin-bottom:10px; }
      .cp-edit-field label { display:block; font-size:11px; color:var(--ink-soft); margin-bottom:4px; font-weight:600; }
      .cp-edit-field input, .cp-edit-field select, .cp-edit-field textarea {
        width:100%; padding:7px 10px; border:1px solid var(--paper-edge); border-radius:6px;
        font-size:13px; font-family:inherit; box-sizing:border-box;
      }
      .cp-edit-field textarea { min-height:60px; resize:vertical; }
      .cp-edit-row { display:flex; gap:8px; }
      .cp-edit-row > div { flex:1; }
      .cp-edit-cats { display:flex; flex-wrap:wrap; gap:5px; }
      .cp-edit-cats button {
        padding:4px 10px; border:1px solid var(--paper-edge); border-radius:999px;
        font-size:11px; background:#fff; cursor:pointer; font-family:inherit;
      }
      .cp-edit-cats button.active { color:#fff; border-color:transparent; font-weight:700; }
      .cp-edit-foot { display:flex; gap:8px; margin-top:14px; }
      .cp-edit-foot button { flex:1; padding:9px; border-radius:7px; font-size:13px; font-weight:700; cursor:pointer; border:1px solid var(--paper-edge); background:#fff; }
      .cp-edit-foot .ok { background:var(--accent); color:#fff; border-color:var(--accent); }
      .cp-edit-foot .del { background:#fff; color:#e53935; border-color:#fecaca; margin-right:auto; flex:0 0 auto; padding-left:14px; padding-right:14px; }

      .cp-nl-input { position:absolute; top:52px; right:10px; z-index:100; padding:10px 14px; background:#fff;
        border:1px solid var(--paper-edge); border-radius:8px; box-shadow:0 6px 20px rgba(0,0,0,0.12); width:300px; display:none; }
      .cp-nl-input.show { display:block; }
      .cp-nl-input h5 { margin:0 0 6px; font-size:12px; }
      .cp-nl-input input { width:100%; padding:8px; border:1px solid var(--paper-edge); border-radius:6px; font-size:13px; font-family:inherit; }
      .cp-nl-input .hint { font-size:10px; color:var(--ink-soft); margin-top:6px; }
    `;
    const s = document.createElement('style');
    s.id = 'janCalProStyles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ---- Init + state wiring --------------------------------------------
  function ensureStateHooks() {
    state = window.state || null;
    if (!state) return false;
    if (!Array.isArray(state.calEvents)) state.calEvents = [];
    return true;
  }

  // ---- Occurrences in range ------------------------------------------
  // Returns occurrences as { ev, occ, span?: { total, idx, position } }
  //   span is set for multi-day events
  //   idx = 0..total-1 (which day within the span)
  //   position = 'start' | 'mid' | 'end' | 'solo'
  function occurrencesInRange(rs, re) {
    if (!state || !Array.isArray(state.calEvents)) return [];
    const out = [];
    state.calEvents.forEach(ev => {
      if (!activeCategories.has(ev.category || 'other')) return;
      const occs = D.expandRecurring(ev, rs, re);
      // Determine if the event spans multiple days
      let spanDays = 1;
      if (ev.endAt) {
        const sd = new Date(ev.startAt);
        const ed = new Date(ev.endAt);
        const s0 = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate()).getTime();
        const e0 = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate()).getTime();
        spanDays = Math.max(1, Math.floor((e0 - s0) / 86400000) + 1);
      }
      occs.forEach(occ => {
        if (spanDays === 1) {
          out.push({ ev, occ });
          return;
        }
        // Emit one entry per day of the span
        for (let i = 0; i < spanDays; i++) {
          const d = new Date(occ);
          d.setDate(d.getDate() + i);
          if (d < rs || d > re) continue;
          const position = i === 0 ? 'start' : (i === spanDays - 1 ? 'end' : 'mid');
          out.push({ ev, occ: d, span: { total: spanDays, idx: i, position } });
        }
      });
    });
    return out;
  }

  // Track current mount host — either the modal card or the #page element
  let host = null;

  // ---- Main mount (modal) --------------------------------------------
  function mount() {
    const modal = document.getElementById('calModal');
    if (!modal) return;
    const card = modal.querySelector('.modal');
    if (!card) return;
    card.style.width = '920px';
    card.style.maxWidth = '96vw';
    card.style.padding = '0';
    card.style.overflow = 'hidden';
    host = card;
    card.innerHTML = `
      <div id="calProRoot" style="position:relative;">
        <div class="cp-topbar">
          <div class="cp-tabs" id="cpTabs">
            <button class="cp-tab" data-v="month">월</button>
            <button class="cp-tab" data-v="week">주</button>
            <button class="cp-tab" data-v="day">일</button>
            <button class="cp-tab" data-v="year">년</button>
            <button class="cp-tab" data-v="todo">할 일</button>
          </div>
          <div class="cp-nav">
            <button id="cpPrev">◀</button>
            <span class="cp-label" id="cpLabel">—</span>
            <button id="cpNext">▶</button>
          </div>
          <button class="cp-today" id="cpToday">오늘</button>
          <input type="search" class="cp-search" id="cpSearch" placeholder="이벤트 검색">
          <div class="cp-spacer"></div>
          <button class="cp-add" id="cpNL" title="자연어로 추가: 내일 3시 회의">+ 빠른 추가</button>
          <button class="cp-add" id="cpAdd" title="상세 입력">+ 이벤트</button>
          <button class="cp-menu-btn" id="cpMenu" title="더보기">⋯</button>
          <div class="cp-menu-dropdown" id="cpMenuDrop">
            <button id="cpExportIcs">ICS 파일 내보내기</button>
            <button id="cpImportIcs">ICS 파일 가져오기</button>
            <button id="cpEnableNotify">알림 권한 요청</button>
            <button id="cpTogglePin">D-day 고정 전환</button>
          </div>
        </div>
        <div class="cp-nl-input" id="cpNLInput">
          <h5>자연어로 빠르게</h5>
          <input id="cpNLText" placeholder="예: 내일 오후 3시 치과 예약">
          <div class="hint">"내일 / 모레", "3월 15일", "오후 2시 반", "다음 주 수요일" 인식</div>
        </div>
        <button class="cp-side-toggle" id="cpSideToggle" title="사이드 패널" aria-label="사이드 패널 열기">☰</button>
        <div class="cp-body">
          <div class="cp-main" id="cpMain"></div>
          <div class="cp-side" id="cpSide"></div>
        </div>
      </div>
    `;
    wireHandlers();
    renderAll();
  }

  function wireHandlers() {
    $$('#cpTabs .cp-tab').forEach(b => b.addEventListener('click', () => setView(b.dataset.v)));
    $('#cpPrev').addEventListener('click', () => shiftCursor(-1));
    $('#cpNext').addEventListener('click', () => shiftCursor(1));
    $('#cpToday').addEventListener('click', () => { cursor = new Date(); renderAll(); });
    $('#cpSearch').addEventListener('input', (e) => { query = e.target.value.trim(); renderAll(); });
    $('#cpAdd').addEventListener('click', () => openEditor(null));
    $('#cpNL').addEventListener('click', () => {
      const box = $('#cpNLInput');
      box.classList.toggle('show');
      if (box.classList.contains('show')) $('#cpNLText').focus();
    });
    $('#cpNLText').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const parsed = D.parseNaturalKR($('#cpNLText').value);
        if (!parsed) { alert('해석 실패'); return; }
        const ev = {
          id: uid(), title: parsed.title,
          startAt: parsed.startAt.toISOString(),
          allDay: parsed.allDay, category: 'personal',
          color: CAT_BY_ID.personal.color, recurring: null, reminder: null,
        };
        state.calEvents.push(ev);
        if (window.save) window.save();
        $('#cpNLText').value = '';
        $('#cpNLInput').classList.remove('show');
        renderAll();
      }
    });
    $('#cpMenu').addEventListener('click', () => $('#cpMenuDrop').classList.toggle('show'));
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#cpMenu') && !e.target.closest('#cpMenuDrop')) $('#cpMenuDrop')?.classList.remove('show');
    });
    $('#cpExportIcs').addEventListener('click', exportIcs);
    $('#cpImportIcs').addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.ics,text/calendar';
      inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return;
        await importIcs(await f.text());
        renderAll();
      };
      inp.click();
    });
    $('#cpEnableNotify').addEventListener('click', async () => {
      if (!('Notification' in window)) return alert('이 브라우저는 알림을 지원하지 않습니다.');
      const p = await Notification.requestPermission();
      alert('알림 권한: ' + p);
    });
    $('#cpSideToggle')?.addEventListener('click', () => {
      $('#cpSide')?.classList.toggle('show');
    });
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Fire whenever the calendar is visible — modal OR tab mode
      const modalOpen = document.getElementById('calModal')?.classList.contains('open');
      const tabOpen = !!document.querySelector('#page #calProRoot');
      if (!modalOpen && !tabOpen) return;
      // Don't hijack when typing in inputs or the editor is open
      if (document.querySelector('.cp-edit-backdrop')) return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openEditor(null); }
      else if (e.key === 'ArrowLeft') shiftCursor(-1);
      else if (e.key === 'ArrowRight') shiftCursor(1);
      else if (e.key === 't' || e.key === 'T') { cursor = new Date(); renderAll(); }
      else if (e.key === 'm') setView('month');
      else if (e.key === 'w') setView('week');
      else if (e.key === 'd') setView('day');
      else if (e.key === 'y') setView('year');
    });
  }

  function setView(v) {
    view = v;
    $$('#cpTabs .cp-tab').forEach(b => b.classList.toggle('active', b.dataset.v === v));
    renderAll();
  }

  function shiftCursor(dir) {
    if (view === 'month') cursor = addMonths(cursor, dir);
    else if (view === 'week') cursor = addDays(cursor, 7 * dir);
    else if (view === 'day') cursor = addDays(cursor, dir);
    else if (view === 'year') cursor.setFullYear(cursor.getFullYear() + dir);
    else if (view === 'todo') { /* no shift */ }
    renderAll();
  }

  // ---- Render dispatch -----------------------------------------------
  function renderAll() {
    $$('#cpTabs .cp-tab').forEach(b => b.classList.toggle('active', b.dataset.v === view));
    updateLabel();
    const main = $('#cpMain');
    if (!main) return;
    if (view === 'month') renderMonth(main);
    else if (view === 'week') renderWeek(main);
    else if (view === 'day') renderDay(main);
    else if (view === 'year') renderYear(main);
    else renderTodo(main);
    renderSide();
    wireResponsiveSide();
  }

  // Container-width responsive side panel toggle (works whether calendar
  // is in a modal, a narrow tab inside a wide viewport, or any size).
  let _roWired = false;
  function wireResponsiveSide() {
    const root = document.getElementById('calProRoot');
    if (!root) return;
    const apply = () => {
      if (!document.getElementById('calProRoot')) return;
      const narrow = root.offsetWidth < 600;
      root.classList.toggle('narrow', narrow);
      if (!narrow) root.querySelector('.cp-side')?.classList.remove('show');
    };
    apply();
    if (!_roWired && 'ResizeObserver' in window) {
      _roWired = true;
      const ro = new ResizeObserver(() => requestAnimationFrame(apply));
      ro.observe(root);
    }
  }

  function updateLabel() {
    const L = $('#cpLabel');
    if (!L) return;
    const y = cursor.getFullYear(), m = cursor.getMonth() + 1, d = cursor.getDate();
    if (view === 'month') L.textContent = `${y}년 ${m}월`;
    else if (view === 'week') {
      const ws = startOfWeek(cursor), we = endOfWeek(cursor);
      L.textContent = `${ws.getMonth()+1}/${ws.getDate()} – ${we.getMonth()+1}/${we.getDate()}`;
    }
    else if (view === 'day') L.textContent = `${y}년 ${m}월 ${d}일 (${'일월화수목금토'[cursor.getDay()]})`;
    else if (view === 'year') L.textContent = `${y}년`;
    else L.textContent = '할 일 목록';
  }

  // ---- Month view ----------------------------------------------------
  function renderMonth(host) {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysIn = new Date(y, m+1, 0).getDate();
    const prevDays = new Date(y, m, 0).getDate();
    const rangeStart = new Date(y, m, 1 - firstDay, 0, 0, 0);
    const rangeEnd = new Date(y, m, daysIn + (42 - firstDay - daysIn), 23, 59, 59);
    const todayKey = D.dateKey(new Date());

    // Build occurrences by day (preserve span info for multi-day bars)
    const byDay = {};
    occurrencesInRange(rangeStart, rangeEnd).forEach(({ ev, occ, span }) => {
      if (query && !matchesQuery(ev, query)) return;
      const k = D.dateKey(occ);
      (byDay[k] = byDay[k] || []).push({ ev, occ, span });
    });

    let html = `<div class="cp-month-grid">`;
    ['일','월','화','수','목','금','토'].forEach((d, i) => {
      html += `<div class="cp-month-head ${i===0?'sun':i===6?'sat':''}">${d}</div>`;
    });
    for (let i = 0; i < 42; i++) {
      const dt = addDays(rangeStart, i);
      const k = D.dateKey(dt);
      const inMonth = dt.getMonth() === m;
      const hol = D.KOREAN_HOLIDAYS[k];
      const evs = byDay[k] || [];
      const dow = dt.getDay();
      const cls = [
        'cp-day',
        inMonth ? '' : 'other',
        k === todayKey ? 'today' : '',
        k === selectedId ? 'selected' : '',
      ].filter(Boolean).join(' ');
      const dnCls = dow === 0 ? 'sun' : dow === 6 ? 'sat' : '';
      // Lunar date — show on every day if lookup succeeds
      const lun = D.solarToLunar ? D.solarToLunar(dt) : null;
      const lunHtml = lun
        ? `<span class="lun${lun.leap?' leap':''}" title="음력 ${lun.leap?'윤 ':''}${lun.month}월 ${lun.day}일">음 ${lun.month}.${lun.day}${lun.leap?'閏':''}</span>`
        : '';
      html += `<div class="${cls}" data-key="${k}">
        <span class="dn ${dnCls}">${dt.getDate()}</span>${lunHtml}
        ${hol ? `<span class="hol">${esc(hol)}</span>` : ''}
        ${evs.slice(0, 3).map(({ ev, occ, span }) => {
          const hhmm = ev.allDay ? '' : `${String(new Date(occ).getHours()).padStart(2,'0')}:${String(new Date(occ).getMinutes()).padStart(2,'0')} `;
          const color = ev.color || CAT_BY_ID[ev.category]?.color || 'var(--accent)';
          const spanCls = span ? ' span-' + span.position : '';
          // Title on start only (and solo events); mid/end get a blank bar that still connects visually
          const label = span && span.position !== 'start' ? '\u00a0' : (hhmm + ev.title);
          return `<span class="ev${ev.allDay?' all-day':''}${spanCls}" data-eid="${ev.id}" style="background:${color};" title="${esc(ev.title)}">${esc(label)}</span>`;
        }).join('')}
        ${evs.length > 3 ? `<span class="more">+${evs.length - 3}개</span>` : ''}
      </div>`;
    }
    html += `</div>`;
    host.innerHTML = html;
    host.querySelectorAll('.cp-day').forEach(el => {
      el.addEventListener('click', (e) => {
        if (dragging && dragging.moved) return;  // don't open editor if we just dragged
        if (e.target.closest('.ev')) return;
        const k = el.dataset.key;
        selectedId = k;
        const [yy, mm, dd] = k.split('-').map(Number);
        openEditor(null, new Date(yy, mm-1, dd, 9, 0));
      });
      // DROP TARGET for drag-reschedule
      el.addEventListener('dragover', (e) => { e.preventDefault(); el.style.outline = '2px dashed var(--accent)'; });
      el.addEventListener('dragleave', () => { el.style.outline = ''; });
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.style.outline = '';
        const evId = e.dataTransfer.getData('jan-ev-id');
        if (!evId) return;
        const ev = state.calEvents.find(x => x.id === evId);
        if (!ev) return;
        const newDate = el.dataset.key.split('-').map(Number);
        const oldStart = new Date(ev.startAt);
        const newStart = new Date(newDate[0], newDate[1]-1, newDate[2], oldStart.getHours(), oldStart.getMinutes());
        const diffMs = newStart - oldStart;
        ev.startAt = newStart.toISOString();
        if (ev.endAt) ev.endAt = new Date(new Date(ev.endAt).getTime() + diffMs).toISOString();
        window.save?.();
        renderAll();
      });
    });
    host.querySelectorAll('.ev').forEach(el => {
      el.setAttribute('draggable', 'true');
      el.addEventListener('dragstart', (e) => {
        dragging = { id: el.dataset.eid, moved: true };
        e.dataTransfer.setData('jan-ev-id', el.dataset.eid);
        e.dataTransfer.effectAllowed = 'move';
        el.style.opacity = '0.5';
      });
      el.addEventListener('dragend', () => {
        el.style.opacity = '';
        setTimeout(() => { dragging = null; }, 100);
      });
      el.addEventListener('click', (e) => {
        if (dragging) return;
        e.stopPropagation();
        const ev = state.calEvents.find(x => x.id === el.dataset.eid);
        if (ev) openEditor(ev);
      });
    });
  }

  // ---- Week / Day view -----------------------------------------------
  function renderWeek(host) { renderTimeline(host, 7); }
  function renderDay(host)  { renderTimeline(host, 1); }

  // Column layout for overlapping timed events within a single day.
  // Returns: Map<ev.id+startISO → { col, totalCols }> so the render
  // loop can compute left/width without stacking events on top of each other.
  function layoutDayColumns(daySlots) {
    // daySlots: [{ ev, occ, start, end }]
    const sorted = daySlots.slice().sort((a, b) => a.start - b.start || a.end - b.end);
    const columns = [];  // array of last-end Date per column
    const placement = new Map();
    sorted.forEach((s, i) => {
      let col = columns.findIndex(endT => endT <= s.start);
      if (col === -1) { col = columns.length; columns.push(s.end); }
      else columns[col] = s.end;
      placement.set(s.ev.id + s.start.toISOString(), { col, _raw: s });
    });
    // For each placement, find the max concurrent columns its group shares
    // (bands of overlapping events all use the same totalCols)
    const totalCols = columns.length;
    placement.forEach((v, k) => { v.totalCols = totalCols; });
    return placement;
  }

  function renderTimeline(host, days) {
    const start = days === 7 ? startOfWeek(cursor) : new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    const rangeEnd = new Date(start); rangeEnd.setDate(rangeEnd.getDate() + days - 1); rangeEnd.setHours(23,59,59,999);
    const todayKey = D.dateKey(new Date());
    let html = `<div class="cp-week-wrap ${days===1?'day-view':''}">
      <div></div>`;
    for (let i = 0; i < days; i++) {
      const dt = addDays(start, i);
      const isToday = D.dateKey(dt) === todayKey;
      html += `<div class="cp-timeline-head ${isToday?'today':''}">${dt.getMonth()+1}/${dt.getDate()} (${'일월화수목금토'[dt.getDay()]})</div>`;
    }
    for (let h = 0; h < 24; h++) {
      html += `<div class="cp-hour-label">${String(h).padStart(2,'0')}:00</div>`;
      for (let i = 0; i < days; i++) {
        const dt = addDays(start, i);
        html += `<div class="cp-hour-slot" data-h="${h}" data-d="${D.dateKey(dt)}"></div>`;
      }
    }
    html += `</div>`;
    host.innerHTML = html;

    // Place events — first group by day and compute column layout for
    // overlapping events, then render with left/width adjusted.
    const main = host.querySelector('.cp-week-wrap');
    if (!main.querySelector('.cp-hour-slot')) return;
    const slotH = 32;
    // Group day slots
    const byDay = {};
    occurrencesInRange(start, rangeEnd).forEach(({ ev, occ }) => {
      if (query && !matchesQuery(ev, query)) return;
      if (ev.allDay) return;
      const dt = new Date(occ);
      const dayIdx = days === 7 ? dt.getDay() : 0;
      const endT = ev.endAt ? new Date(ev.endAt) : new Date(dt.getTime() + 3600000);
      const key = dayIdx;
      (byDay[key] = byDay[key] || []).push({ ev, occ, start: dt, end: endT });
    });
    Object.entries(byDay).forEach(([dayIdx, slots]) => {
      const placement = layoutDayColumns(slots);
      slots.forEach((s) => {
        const p = placement.get(s.ev.id + s.start.toISOString());
        const hrStart = s.start.getHours() + s.start.getMinutes()/60;
        const durH = Math.max(0.5, (s.end - s.start) / 3600000);
        const top = (hrStart * slotH) + 26;
        const height = durH * slotH - 2;
        const el = document.createElement('div');
        el.className = 'cp-week-ev';
        el.dataset.eid = s.ev.id;
        const color = s.ev.color || CAT_BY_ID[s.ev.category]?.color || 'var(--accent)';
        // Column math: each event gets 1/totalCols width, offset by col
        const widthPct = 100 / Math.max(1, p.totalCols);
        const leftPct = p.col * widthPct;
        el.style.cssText = `top:${top}px;height:${height}px;background:${color};left:calc(${leftPct}% + 1px);width:calc(${widthPct}% - 2px);`;
        el.style.gridColumn = (Number(dayIdx) + 2).toString();
        el.style.gridRow = 'auto';
        el.textContent = `${String(s.start.getHours()).padStart(2,'0')}:${String(s.start.getMinutes()).padStart(2,'0')} ${s.ev.title}`;
        main.appendChild(el);
        el.addEventListener('click', (e) => { e.stopPropagation(); openEditor(s.ev); });
      });
    });

    main.querySelectorAll('.cp-hour-slot').forEach(s => s.addEventListener('click', () => {
      const [y, m, d] = s.dataset.d.split('-').map(Number);
      const h = +s.dataset.h;
      openEditor(null, new Date(y, m-1, d, h, 0));
    }));
  }

  // ---- Year heatmap --------------------------------------------------
  function renderYear(host) {
    const y = cursor.getFullYear();
    const rangeStart = new Date(y, 0, 1);
    const rangeEnd = new Date(y, 11, 31, 23, 59, 59);
    const byDay = {};
    occurrencesInRange(rangeStart, rangeEnd).forEach(({ ev, occ }) => {
      if (query && !matchesQuery(ev, query)) return;
      const k = D.dateKey(occ);
      byDay[k] = (byDay[k] || 0) + 1;
    });
    const todayKey = D.dateKey(new Date());
    let html = `<div class="cp-year-grid">`;
    for (let m = 0; m < 12; m++) {
      html += `<div class="cp-year-month"><h4>${m+1}월</h4><div class="cp-year-days">`;
      const firstDay = new Date(y, m, 1).getDay();
      const daysIn = new Date(y, m+1, 0).getDate();
      for (let i = 0; i < firstDay; i++) html += `<div class="cp-year-day other"></div>`;
      for (let d = 1; d <= daysIn; d++) {
        const k = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const count = byDay[k] || 0;
        const lvl = count === 0 ? '' : count === 1 ? 'l1' : count === 2 ? 'l2' : count <= 4 ? 'l3' : 'l4';
        const hol = D.KOREAN_HOLIDAYS[k];
        html += `<div class="cp-year-day ${lvl} ${k===todayKey?'today':''}" title="${k}${hol?' · '+esc(hol):''}${count?' · '+count+'개':''}" data-key="${k}">${d}</div>`;
      }
      html += `</div></div>`;
    }
    html += `</div>`;
    host.innerHTML = html;
    host.querySelectorAll('.cp-year-day[data-key]').forEach(el => el.addEventListener('click', () => {
      const [yy,mm,dd] = el.dataset.key.split('-').map(Number);
      cursor = new Date(yy, mm-1, dd);
      setView('day');
    }));
  }

  // ---- Todo / upcoming list ------------------------------------------
  function renderTodo(host) {
    const now = new Date();
    const in30 = new Date(now); in30.setDate(in30.getDate() + 30);
    const expanded = occurrencesInRange(addDays(now, -30), addDays(now, 365));
    const filtered = query ? expanded.filter(({ev}) => matchesQuery(ev, query)) : expanded;
    filtered.sort((a,b) => a.occ - b.occ);
    // Group by bucket
    const buckets = { '지난 이벤트':[], '오늘':[], '이번 주':[], '이번 달':[], '이후':[] };
    filtered.forEach(({ ev, occ }) => {
      const d = (occ - now) / 86400000;
      if (d < -0.5) buckets['지난 이벤트'].push({ ev, occ });
      else if (sameDay(occ, now)) buckets['오늘'].push({ ev, occ });
      else if (d <= 7) buckets['이번 주'].push({ ev, occ });
      else if (d <= 30) buckets['이번 달'].push({ ev, occ });
      else buckets['이후'].push({ ev, occ });
    });
    let html = `<div class="cp-todo-list">`;
    for (const k of ['오늘','이번 주','이번 달','이후','지난 이벤트']) {
      if (!buckets[k].length) continue;
      html += `<div class="cp-todo-section">${k} — ${buckets[k].length}</div>`;
      buckets[k].forEach(({ ev, occ }) => {
        const color = ev.color || CAT_BY_ID[ev.category]?.color || 'var(--accent)';
        const dt = new Date(occ);
        const time = ev.allDay ? '종일' : `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
        html += `<div class="cp-todo-item" data-eid="${ev.id}">
          <div class="dot" style="background:${color};"></div>
          <div class="t">
            <div class="tt">${esc(ev.title)}</div>
            <div class="td">${dt.getMonth()+1}월 ${dt.getDate()}일 · ${time}${ev.location ? ' · '+esc(ev.location) : ''}</div>
          </div>
          <div class="rel">${esc(D.formatRelativeKR(dt))}</div>
        </div>`;
      });
    }
    if (!filtered.length) html += `<div style="padding:40px;text-align:center;color:var(--ink-soft);">등록된 이벤트가 없습니다.<br><br><button class="cp-add" id="cpTodoAdd">+ 첫 이벤트 만들기</button></div>`;
    html += `</div>`;
    host.innerHTML = html;
    host.querySelectorAll('.cp-todo-item').forEach(el => el.addEventListener('click', () => {
      const ev = state.calEvents.find(x => x.id === el.dataset.eid);
      if (ev) openEditor(ev);
    }));
    host.querySelector('#cpTodoAdd')?.addEventListener('click', () => openEditor(null));
  }

  // ---- Side panel ----------------------------------------------------
  function renderSide() {
    const side = $('#cpSide');
    if (!side) return;
    const now = new Date();
    const upcoming = occurrencesInRange(now, addDays(now, 30))
      .sort((a,b) => a.occ - b.occ)
      .slice(0, 6);
    side.innerHTML = `
      <div>
        <div class="section-title">다가오는 일정</div>
        ${upcoming.length ? upcoming.map(({ev, occ}) => {
          const color = ev.color || CAT_BY_ID[ev.category]?.color || 'var(--accent)';
          return `<div class="upcoming-item" data-eid="${ev.id}" style="border-left-color:${color};">
            <div class="t">${esc(ev.title)}</div>
            <div class="d">${D.formatRelativeKR(occ)} · ${ev.allDay ? '종일' : `${String(new Date(occ).getHours()).padStart(2,'0')}:${String(new Date(occ).getMinutes()).padStart(2,'0')}`}</div>
          </div>`;
        }).join('') : '<div style="color:var(--ink-soft);font-size:11px;">없음</div>'}
      </div>
      <div>
        <div class="section-title" style="display:flex;align-items:center;">
          카테고리 필터
          <button id="cpCatAll" style="margin-left:auto;font-size:10px;padding:2px 6px;border:1px solid var(--paper-edge);background:#fff;border-radius:4px;cursor:pointer;color:var(--ink-soft);font-weight:600;">전체</button>
        </div>
        ${CATEGORIES.map(c => `
          <label class="cat-filter" data-cat="${c.id}" style="display:flex;align-items:center;gap:6px;padding:4px 0;cursor:pointer;user-select:none;">
            <input type="checkbox" ${activeCategories.has(c.id)?'checked':''} style="margin:0;cursor:pointer;" data-cat-cb="${c.id}">
            <span class="cat-dot" style="background:${c.color}"></span>
            <span style="flex:1;">${c.name}</span>
            <span style="font-size:10px;color:var(--ink-faint);" data-cat-count="${c.id}"></span>
          </label>`).join('')}
      </div>
      <div>
        <div class="section-title">통계 (${cursor.getFullYear()}년)</div>
        <div style="font-size:11px;color:var(--ink-soft);">
          총 ${state.calEvents.length}개 이벤트<br>
          공휴일 ${Object.keys(D.KOREAN_HOLIDAYS).filter(k => k.startsWith(cursor.getFullYear()+'-')).length}일
        </div>
      </div>
    `;
    side.querySelectorAll('.upcoming-item').forEach(el => el.addEventListener('click', () => {
      const ev = state.calEvents.find(x => x.id === el.dataset.eid);
      if (ev) openEditor(ev);
    }));
    // Category filter checkboxes
    side.querySelectorAll('[data-cat-cb]').forEach(cb => cb.addEventListener('change', (e) => {
      const id = cb.dataset.catCb;
      if (cb.checked) activeCategories.add(id); else activeCategories.delete(id);
      renderAll();
    }));
    side.querySelector('#cpCatAll')?.addEventListener('click', () => {
      const allSelected = activeCategories.size === CATEGORIES.length;
      activeCategories = new Set(allSelected ? [] : CATEGORIES.map(c => c.id));
      renderAll();
    });
    // Update per-category counts (events in current year)
    const yStart = new Date(cursor.getFullYear(), 0, 1);
    const yEnd = new Date(cursor.getFullYear(), 11, 31, 23, 59, 59);
    const counts = {};
    (state.calEvents || []).forEach(ev => {
      const occs = D.expandRecurring(ev, yStart, yEnd);
      const cat = ev.category || 'other';
      counts[cat] = (counts[cat] || 0) + occs.length;
    });
    Object.entries(counts).forEach(([cat, n]) => {
      const el = side.querySelector(`[data-cat-count="${cat}"]`);
      if (el) el.textContent = n || '';
    });
  }

  function matchesQuery(ev, q) {
    const qq = q.toLowerCase();
    return (ev.title||'').toLowerCase().includes(qq)
        || (ev.memo||'').toLowerCase().includes(qq)
        || (ev.location||'').toLowerCase().includes(qq);
  }

  // ---- Event editor modal --------------------------------------------
  function openEditor(ev, defaultStart) {
    const isNew = !ev;
    const e = ev || {
      id: uid(),
      title: '',
      startAt: (defaultStart || new Date()).toISOString(),
      endAt: null, allDay: false,
      category: 'personal',
      color: CAT_BY_ID.personal.color,
      location: '', memo: '',
      recurring: null, reminder: null,
      linkedTabId: null,
    };
    const fmtDT = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };

    const back = document.createElement('div');
    back.className = 'cp-edit-backdrop';
    back.innerHTML = `
      <div class="cp-edit-card">
        <h3 style="display:flex;align-items:center;">
          ${isNew ? '새 이벤트' : '이벤트 편집'}
          <button id="eClose" style="margin-left:auto;width:28px;height:28px;border:0;background:transparent;font-size:20px;cursor:pointer;color:var(--ink-soft);border-radius:50%;" title="닫기 (Esc)">×</button>
        </h3>
        <div class="cp-edit-field"><label>제목</label><input id="eTitle" value="${esc(e.title)}" placeholder="이벤트 제목"></div>
        <div class="cp-edit-row">
          <div class="cp-edit-field"><label>시작</label><input id="eStart" type="datetime-local" value="${fmtDT(e.startAt)}"></div>
          <div class="cp-edit-field"><label>종료 (선택)</label><input id="eEnd" type="datetime-local" value="${e.endAt ? fmtDT(e.endAt) : ''}"></div>
        </div>
        <div class="cp-edit-field">
          <label style="display:flex;align-items:center;gap:16px;">
            <span><input type="checkbox" id="eAllDay" ${e.allDay?'checked':''}> 종일</span>
            <button type="button" id="eMultiDay" style="padding:3px 10px;border:1px solid var(--paper-edge);border-radius:999px;font-size:11px;background:#fff;cursor:pointer;font-family:inherit;">여러 날</button>
            <span style="font-size:10px;color:var(--ink-soft);">종료일을 다른 날로 설정하면 캘린더에 연속된 바로 표시됩니다</span>
          </label>
        </div>
        <div class="cp-edit-field">
          <label>카테고리 · 색상 직접 지정 가능</label>
          <div class="cp-edit-cats">${CATEGORIES.map(c =>
            `<button data-c="${c.id}" class="${c.id===e.category?'active':''}" style="${c.id===e.category?`background:${c.color};color:#fff;`:''}">${c.name}</button>`
          ).join('')}
          <label style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border:1px solid var(--paper-edge);border-radius:999px;cursor:pointer;font-size:11px;">
            색상
            <input type="color" id="eColor" value="${esc(e.color || CAT_BY_ID[e.category]?.color || '#D97757')}" style="width:20px;height:20px;padding:0;border:0;cursor:pointer;">
          </label>
          </div>
        </div>
        <div class="cp-edit-row">
          <div class="cp-edit-field"><label>장소</label><input id="eLoc" value="${esc(e.location||'')}" placeholder="장소 (선택)"></div>
          <div class="cp-edit-field">
            <label>알림 (분 전)</label>
            <select id="eRemind">
              <option value="">없음</option>
              <option value="0">정시</option>
              <option value="5">5분 전</option>
              <option value="10">10분 전</option>
              <option value="30">30분 전</option>
              <option value="60">1시간 전</option>
              <option value="1440">1일 전</option>
            </select>
          </div>
        </div>
        <div class="cp-edit-row">
          <div class="cp-edit-field">
            <label>반복</label>
            <select id="eFreq">
              <option value="">반복 없음</option>
              <option value="daily">매일</option>
              <option value="weekly">매주</option>
              <option value="monthly">매월</option>
              <option value="yearly">매년</option>
            </select>
          </div>
          <div class="cp-edit-field"><label>반복 종료일 (선택)</label><input id="eUntil" type="date" value="${e.recurring?.until ? new Date(e.recurring.until).toISOString().slice(0,10) : ''}"></div>
        </div>
        <div class="cp-edit-field"><label>메모</label><textarea id="eMemo" placeholder="상세 메모">${esc(e.memo||'')}</textarea></div>
        <div class="cp-edit-foot">
          ${isNew ? '' : '<button class="del" id="eDel">삭제</button>'}
          <button id="eCancel">취소</button>
          <button class="ok" id="eSave">${isNew?'추가':'저장'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(back);
    // Preset selects
    const remindSel = back.querySelector('#eRemind');
    if (e.reminder) remindSel.value = String(e.reminder.offsetMin);
    const freqSel = back.querySelector('#eFreq');
    if (e.recurring) freqSel.value = e.recurring.freq;
    let selectedCat = e.category;
    back.querySelectorAll('.cp-edit-cats button').forEach(b => b.addEventListener('click', () => {
      selectedCat = b.dataset.c;
      back.querySelectorAll('.cp-edit-cats button').forEach(bb => {
        const cat = CAT_BY_ID[bb.dataset.c];
        bb.classList.toggle('active', bb.dataset.c === selectedCat);
        bb.style.background = bb.dataset.c === selectedCat ? cat.color : '#fff';
        bb.style.color = bb.dataset.c === selectedCat ? '#fff' : 'var(--ink)';
      });
    }));
    const close = () => { back.remove(); document.removeEventListener('keydown', escHandler); };
    const escHandler = (evt) => { if (evt.key === 'Escape') close(); };
    document.addEventListener('keydown', escHandler);
    back.addEventListener('click', (evt) => { if (evt.target === back) close(); });
    back.querySelector('#eCancel').addEventListener('click', close);
    back.querySelector('#eClose').addEventListener('click', close);
    // Multi-day quick-set: allDay + endAt = start + 1 day (00:00)
    back.querySelector('#eMultiDay').addEventListener('click', () => {
      back.querySelector('#eAllDay').checked = true;
      const startEl = back.querySelector('#eStart');
      const endEl = back.querySelector('#eEnd');
      const sd = startEl.value ? new Date(startEl.value) : new Date();
      const ed = new Date(sd);
      ed.setDate(ed.getDate() + 1);
      ed.setHours(sd.getHours(), sd.getMinutes(), 0, 0);
      const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      endEl.value = fmt(ed);
      endEl.focus();
    });
    back.querySelector('#eSave').addEventListener('click', () => {
      const title = back.querySelector('#eTitle').value.trim() || '(제목 없음)';
      const startStr = back.querySelector('#eStart').value;
      const endStr = back.querySelector('#eEnd').value;
      const allDay = back.querySelector('#eAllDay').checked;
      const loc = back.querySelector('#eLoc').value.trim();
      const memo = back.querySelector('#eMemo').value;
      const freq = back.querySelector('#eFreq').value;
      const untilStr = back.querySelector('#eUntil').value;
      const remind = back.querySelector('#eRemind').value;
      if (!startStr) return alert('시작 시각 필수');
      const customColor = back.querySelector('#eColor').value;
      const catDefault = CAT_BY_ID[selectedCat].color;
      const newEv = {
        ...e,
        title,
        startAt: new Date(startStr).toISOString(),
        endAt: endStr ? new Date(endStr).toISOString() : null,
        allDay, location: loc, memo,
        category: selectedCat,
        // If user picked a custom color different from the category default, use it.
        color: (customColor && customColor.toLowerCase() !== catDefault.toLowerCase()) ? customColor : catDefault,
        recurring: freq ? { freq, interval: 1, until: untilStr ? new Date(untilStr).toISOString() : null } : null,
        reminder: remind === '' ? null : { offsetMin: +remind },
        notified: false,
      };
      if (isNew) state.calEvents.push(newEv);
      else { const idx = state.calEvents.findIndex(x => x.id === e.id); if (idx >= 0) state.calEvents[idx] = newEv; }
      if (window.save) window.save();
      close();
      renderAll();
    });
    back.querySelector('#eDel')?.addEventListener('click', () => {
      if (!confirm('이 이벤트를 삭제하시겠어요?')) return;
      state.calEvents = state.calEvents.filter(x => x.id !== e.id);
      if (window.save) window.save();
      close();
      renderAll();
    });
    setTimeout(() => back.querySelector('#eTitle').focus(), 50);
  }

  // ---- ICS export / import -------------------------------------------
  function exportIcs() {
    if (!state.calEvents.length) return alert('내보낼 이벤트가 없습니다.');
    const toIcsDate = (iso, allDay) => {
      const d = new Date(iso);
      if (allDay) return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
      return `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}T${String(d.getUTCHours()).padStart(2,'0')}${String(d.getUTCMinutes()).padStart(2,'0')}00Z`;
    };
    const freqMap = { daily:'DAILY', weekly:'WEEKLY', monthly:'MONTHLY', yearly:'YEARLY' };
    const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//JustANotepad//Cal Pro//KR'];
    state.calEvents.forEach(e => {
      lines.push('BEGIN:VEVENT');
      lines.push('UID:' + e.id + '@justanotepad.com');
      if (e.allDay) {
        lines.push('DTSTART;VALUE=DATE:' + toIcsDate(e.startAt, true));
      } else {
        lines.push('DTSTART:' + toIcsDate(e.startAt, false));
        if (e.endAt) lines.push('DTEND:' + toIcsDate(e.endAt, false));
      }
      lines.push('SUMMARY:' + (e.title||'').replace(/[,;\\]/g, '\\$&'));
      if (e.location) lines.push('LOCATION:' + e.location.replace(/[,;\\]/g, '\\$&'));
      if (e.memo) lines.push('DESCRIPTION:' + e.memo.replace(/\n/g, '\\n').replace(/[,;\\]/g, '\\$&'));
      if (e.recurring) {
        let rr = 'RRULE:FREQ=' + freqMap[e.recurring.freq];
        if (e.recurring.interval > 1) rr += ';INTERVAL=' + e.recurring.interval;
        if (e.recurring.until) rr += ';UNTIL=' + toIcsDate(e.recurring.until, true);
        lines.push(rr);
      }
      if (e.reminder) {
        lines.push('BEGIN:VALARM');
        lines.push('ACTION:DISPLAY');
        lines.push('DESCRIPTION:' + (e.title||''));
        lines.push('TRIGGER:-PT' + e.reminder.offsetMin + 'M');
        lines.push('END:VALARM');
      }
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `justanotepad-calendar-${new Date().toISOString().slice(0,10)}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importIcs(text) {
    const blocks = text.split(/BEGIN:VEVENT/).slice(1).map(s => 'BEGIN:VEVENT' + s.split('END:VEVENT')[0]);
    let added = 0;
    blocks.forEach(block => {
      const get = (k) => {
        const m = block.match(new RegExp('^' + k + '[^:]*:(.+)$', 'm'));
        return m ? m[1].trim().replace(/\\,/g, ',').replace(/\\n/g, '\n') : null;
      };
      const title = get('SUMMARY') || '(제목 없음)';
      const loc = get('LOCATION') || '';
      const memo = get('DESCRIPTION') || '';
      const dtStartLine = block.match(/^DTSTART.*$/m)?.[0] || '';
      const dtEndLine = block.match(/^DTEND.*$/m)?.[0] || '';
      const parseIcs = (line) => {
        const val = line.split(':')[1]?.trim();
        if (!val) return null;
        const allDay = /VALUE=DATE/.test(line) && !val.includes('T');
        if (allDay) {
          const y = +val.slice(0,4), mm = +val.slice(4,6)-1, dd = +val.slice(6,8);
          return { dt: new Date(y, mm, dd, 0, 0), allDay: true };
        }
        const y = +val.slice(0,4), mm = +val.slice(4,6)-1, dd = +val.slice(6,8);
        const hh = +val.slice(9,11), mi = +val.slice(11,13);
        const utc = val.endsWith('Z');
        const d = utc ? new Date(Date.UTC(y, mm, dd, hh, mi)) : new Date(y, mm, dd, hh, mi);
        return { dt: d, allDay: false };
      };
      const st = parseIcs(dtStartLine);
      const en = parseIcs(dtEndLine);
      if (!st) return;
      const ev = {
        id: uid(), title, location: loc, memo,
        startAt: st.dt.toISOString(),
        endAt: en ? en.dt.toISOString() : null,
        allDay: st.allDay,
        category: 'other', color: CAT_BY_ID.other.color,
        recurring: null, reminder: null,
      };
      // Basic RRULE
      const rrule = block.match(/^RRULE:(.*)$/m)?.[1];
      if (rrule) {
        const freqMatch = rrule.match(/FREQ=(\w+)/);
        if (freqMatch) {
          const fMap = { DAILY:'daily', WEEKLY:'weekly', MONTHLY:'monthly', YEARLY:'yearly' };
          ev.recurring = { freq: fMap[freqMatch[1]] || 'daily', interval: 1, until: null };
        }
      }
      state.calEvents.push(ev);
      added++;
    });
    if (window.save) window.save();
    alert(`${added}개 이벤트를 가져왔습니다.`);
  }

  // ---- Reminder engine -----------------------------------------------
  // Every 30s: look at events in next hour, fire Notification if reminder
  // offset matches AND !notified.
  function startReminderLoop() {
    if (window.__janCalReminderLoop) return;
    window.__janCalReminderLoop = true;
    setInterval(() => {
      if (!ensureStateHooks()) return;
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const now = new Date();
      const in60 = new Date(now); in60.setHours(in60.getHours() + 1);
      const occs = occurrencesInRange(now, in60);
      occs.forEach(({ ev, occ }) => {
        if (!ev.reminder) return;
        const triggerAt = new Date(occ.getTime() - ev.reminder.offsetMin * 60 * 1000);
        if (now >= triggerAt && now <= occ) {
          // Has this event (by id+day) already been notified?
          const key = ev.id + ':' + D.dateKey(occ);
          if (window.__janNotified && window.__janNotified.has(key)) return;
          window.__janNotified = window.__janNotified || new Set();
          window.__janNotified.add(key);
          try {
            new Notification(ev.title, {
              body: `${D.formatRelativeKR(occ)} · ${new Date(occ).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}${ev.location?' · '+ev.location:''}`,
              icon: '/favicon.svg',
              tag: ev.id,
            });
          } catch {}
        }
      });
    }, 30000);
  }

  // ---- Mount into page (tab mode) ------------------------------------
  function mountIntoPage() {
    const pageEl = document.getElementById('page');
    if (!pageEl) return;
    pageEl.setAttribute('contenteditable', 'false');
    pageEl.classList.add('cal-tab-mode');
    host = pageEl;
    pageEl.innerHTML = `
      <div id="calProRoot" style="position:relative;height:100%;display:flex;flex-direction:column;">
        <div class="cp-topbar">
          <div class="cp-tabs" id="cpTabs">
            <button class="cp-tab" data-v="month">월</button>
            <button class="cp-tab" data-v="week">주</button>
            <button class="cp-tab" data-v="day">일</button>
            <button class="cp-tab" data-v="year">년</button>
            <button class="cp-tab" data-v="todo">할 일</button>
          </div>
          <div class="cp-nav">
            <button id="cpPrev">◀</button>
            <span class="cp-label" id="cpLabel">—</span>
            <button id="cpNext">▶</button>
          </div>
          <button class="cp-today" id="cpToday">오늘</button>
          <input type="search" class="cp-search" id="cpSearch" placeholder="이벤트 검색">
          <div class="cp-spacer"></div>
          <button class="cp-add" id="cpNL" title="자연어로 추가">+ 빠른 추가</button>
          <button class="cp-add" id="cpAdd" title="상세 입력">+ 이벤트</button>
          <button class="cp-menu-btn" id="cpMenu" title="더보기">⋯</button>
          <div class="cp-menu-dropdown" id="cpMenuDrop">
            <button id="cpExportIcs">ICS 파일 내보내기</button>
            <button id="cpImportIcs">ICS 파일 가져오기</button>
            <button id="cpEnableNotify">알림 권한 요청</button>
          </div>
        </div>
        <div class="cp-nl-input" id="cpNLInput">
          <h5>자연어로 빠르게</h5>
          <input id="cpNLText" placeholder="예: 내일 오후 3시 치과 예약">
          <div class="hint">"내일 / 모레", "3월 15일", "오후 2시 반", "다음 주 수요일" 인식</div>
        </div>
        <button class="cp-side-toggle" id="cpSideToggle" title="사이드 패널">☰</button>
        <div class="cp-body" style="flex:1;max-height:none;">
          <div class="cp-main" id="cpMain"></div>
          <div class="cp-side" id="cpSide"></div>
        </div>
      </div>
    `;
    wireHandlers();
    renderAll();
  }

  // ---- Tab integration -----------------------------------------------
  function isCalendarTabActive() {
    const st = window.state;
    if (!st) return false;
    const t = st.tabs?.find(x => x.id === st.activeId);
    return t?.type === 'calendar';
  }

  function wireTabRenderOverride() {
    if (!window.renderPage || window.__janCalRenderPatched) return;
    window.__janCalRenderPatched = true;
    const orig = window.renderPage;
    window.renderPage = function() {
      if (isCalendarTabActive()) {
        injectCSS();
        ensureStateHooks();
        cursor = cursor || new Date();
        mountIntoPage();
        startReminderLoop();
        const wordCount = document.getElementById('wordCount');
        if (wordCount) wordCount.textContent = '— 캘린더 탭 —';
        return;
      } else {
        const pageEl = document.getElementById('page');
        if (pageEl?.classList.contains('cal-tab-mode')) {
          pageEl.classList.remove('cal-tab-mode');
          pageEl.setAttribute('contenteditable', 'true');
        }
        return orig.apply(this, arguments);
      }
    };
    // If a calendar tab is already the active tab (e.g. persisted from
    // a previous session), trigger an immediate re-render so the user
    // sees the calendar, not an empty page.
    if (isCalendarTabActive()) {
      setTimeout(() => { try { window.renderPage(); } catch {} }, 50);
    }
  }

  // Add a calendar tab (or activate existing one)
  window.openCalendarAsTab = function() {
    if (!ensureStateHooks()) return;
    wireTabRenderOverride();
    const st = window.state;
    let t = st.tabs.find(x => x.type === 'calendar' && x.wsId === st.meta.activeWs);
    if (!t) {
      const id = 't' + Date.now();
      t = { id, wsId: st.meta.activeWs, name: '📅 캘린더', type: 'calendar', pinned: false, tag: '', html: '' };
      st.tabs.push(t);
    }
    st.activeId = t.id;
    if (window.save) window.save();
    if (window.renderTabs) window.renderTabs();
    if (window.renderPage) window.renderPage();
    if (window.renderSidebar) window.renderSidebar();
  };

  // ---- Public entry --------------------------------------------------
  const oldOpen = window.openCalendar;
  window.openCalendar = function() {
    injectCSS();
    if (!ensureStateHooks()) {
      // Fallback to legacy if state not ready
      if (oldOpen) return oldOpen();
      return;
    }
    cursor = new Date();
    view = 'month';
    mount();
    document.getElementById('calModal').classList.add('open');
    startReminderLoop();
  };
  // Auto-wire tab override once state/renderPage are ready. Poll every
  // 200ms until we catch the moment renderPage is exposed, then re-render
  // if a calendar tab is active (survives page reloads).
  (function autowire() {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (window.renderPage || tries > 50) {  // 10s cap
        clearInterval(t);
        wireTabRenderOverride();
      }
    }, 200);
  })();

  // Start reminder loop even if user doesn't open calendar
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      ensureStateHooks();
      startReminderLoop();
    }, 1500);
  });
})();
