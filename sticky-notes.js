/**
 * justanotepad · JustPin (v1.0)
 * --------------------------------------------------------------------------
 * 화면 위에 떠있는 JustPin 메모. 드래그로 이동·리사이즈하고 다음 방문에도
 * 위치·내용·색상이 그대로 유지됨.
 *
 * 기능:
 *   - [핀 아이콘] 토픽바 버튼 → 새 JustPin 생성
 *   - 탭 우클릭 → "JustPin으로 떼어내기" (탭 내용을 JustPin으로 변환)
 *   - 현재 선택 텍스트를 JustPin으로 (단축키 Ctrl+Shift+P)
 *   - 새 JustPin 생성 단축키 Ctrl+Alt+P
 *   - 드래그 이동 (헤더 부분 잡고 끌기)
 *   - 우하단 핸들로 크기 조절
 *   - 6색 팔레트 (노랑·핑크·민트·하늘·라벤더·살구)
 *   - 최소화 버튼 (헤더만 남김)
 *   - 닫기 버튼 (휴지통으로 이동, 복원 가능)
 *   - 내용 편집은 contenteditable, 입력 시 자동 저장
 *   - JustPin 데이터는 별도 IDB(jnp-sticky) 에 저장 — 메인 앱 state 와 분리
 *
 * 전역 API:
 *   window.jnpStickyNotes = {
 *     create({x, y, w, h, text, color}),
 *     list(), remove(id), bringToFront(id),
 *     fromSelection(), fromTab(tabId), toggleAll(),
 *   }
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.jnpStickyNotes) return;

  const IDB_NAME = 'jnp-sticky';
  const STORE = 'notes';

  const COLORS = {
    yellow:   { bg: '#fff6a5', border: '#f0dd55', head: '#fae77c' },
    pink:     { bg: '#ffd6e0', border: '#f298b0', head: '#fbb8ca' },
    mint:     { bg: '#c6f0dc', border: '#7fcaa6', head: '#a8e4c7' },
    sky:      { bg: '#cfe8ff', border: '#7fb9e6', head: '#b5d8f5' },
    lavender: { bg: '#e3d6ff', border: '#a98fe0', head: '#cfbdf5' },
    peach:    { bg: '#ffd8c0', border: '#e89975', head: '#fabca0' },
  };
  const COLOR_NAMES = Object.keys(COLORS);

  // ---- IDB ----
  async function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(IDB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  async function dbAll() {
    try { const d = await idb(); return await new Promise(res => { const r = d.transaction(STORE).objectStore(STORE).getAll(); r.onsuccess = () => res(r.result||[]); r.onerror = () => res([]); }); } catch { return []; }
  }
  async function dbPut(note) {
    try { const d = await idb(); d.transaction(STORE, 'readwrite').objectStore(STORE).put(note); } catch (e) { console.warn('[sticky]', e); }
  }
  async function dbDel(id) {
    try { const d = await idb(); d.transaction(STORE, 'readwrite').objectStore(STORE).delete(id); } catch {}
  }

  // ---- 스타일 ----
  const CSS = `
  .jnp-sticky {
    position: fixed;
    min-width: 160px; min-height: 120px;
    border-radius: 6px;
    box-shadow: 0 6px 18px rgba(0,0,0,0.18), 0 2px 4px rgba(0,0,0,0.12);
    display: flex; flex-direction: column;
    overflow: hidden;
    transform-origin: top left;
    transition: box-shadow .15s;
    font: 13px/1.45 -apple-system, "Segoe UI", "Malgun Gothic", sans-serif;
    z-index: 1000;
  }
  .jnp-sticky:focus-within { box-shadow: 0 10px 26px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.15); }
  .jnp-sticky.min { min-height: auto !important; height: auto !important; }
  .jnp-sticky.min .jnp-sticky-body,
  .jnp-sticky.min .jnp-sticky-foot,
  .jnp-sticky.min .jnp-sticky-resize { display: none; }

  .jnp-sticky-head {
    display: flex; align-items: center; gap: 4px;
    padding: 4px 6px 4px 10px;
    cursor: move;
    user-select: none;
    font: 600 11px/1 inherit;
    color: rgba(0,0,0,0.55);
  }
  .jnp-sticky-head .ttl {
    flex: 1; min-width: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .jnp-sticky-head button {
    background: transparent; border: 0; cursor: pointer;
    padding: 3px 5px; border-radius: 4px;
    color: rgba(0,0,0,0.55);
    display: inline-flex; align-items: center;
    font: inherit;
  }
  .jnp-sticky-head button:hover { background: rgba(0,0,0,0.08); color: rgba(0,0,0,0.85); }

  .jnp-sticky-body {
    flex: 1;
    padding: 8px 12px;
    outline: none;
    overflow: auto;
    color: rgba(0,0,0,0.85);
    font: 13px/1.5 inherit;
    word-break: break-word;
  }
  .jnp-sticky-body:empty::before {
    content: attr(data-placeholder);
    color: rgba(0,0,0,0.3);
  }
  .jnp-sticky-foot {
    display: flex; align-items: center; gap: 4px;
    padding: 3px 6px;
    border-top: 1px dashed rgba(0,0,0,0.1);
    background: rgba(0,0,0,0.04);
  }
  .jnp-sticky-foot .swatch {
    width: 14px; height: 14px; border-radius: 50%;
    cursor: pointer;
    border: 1px solid rgba(0,0,0,0.12);
  }
  .jnp-sticky-foot .swatch:hover { transform: scale(1.2); }
  .jnp-sticky-foot .info {
    flex: 1;
    font-size: 10px;
    color: rgba(0,0,0,0.45);
    text-align: right;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  .jnp-sticky-resize {
    position: absolute; right: 0; bottom: 0;
    width: 14px; height: 14px;
    cursor: nwse-resize;
    background: linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.18) 50%);
  }

  /* 컨텍스트 메뉴 */
  .jnp-sticky-ctx {
    position: fixed;
    z-index: 1100;
    background: #fff;
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 8px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.18);
    padding: 4px;
    font: 13px/1 -apple-system, sans-serif;
    min-width: 180px;
  }
  .jnp-sticky-ctx button {
    display: block; width: 100%; text-align: left;
    background: transparent; border: 0;
    padding: 7px 10px; border-radius: 6px;
    cursor: pointer;
    color: #111;
  }
  .jnp-sticky-ctx button:hover { background: #f4f4f4; }
  `;
  (function() {
    if (document.getElementById('jnp-sticky-style')) return;
    const st = document.createElement('style');
    st.id = 'jnp-sticky-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  })();

  // ---- 상태 ----
  const notes = new Map(); // id → { el, data }
  let zCounter = 1000;

  const uid = () => 'st_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  // ---- JustPin DOM 생성 ----
  function render(note) {
    // note 가 부분적이거나 깨졌을 때 기본값 보장
    if (!note || typeof note !== 'object') note = {};
    if (!note.color || !COLORS[note.color]) note.color = 'yellow';
    const c = COLORS[note.color];
    const el = document.createElement('div');
    el.className = 'jnp-sticky';
    el.style.left = (note.x ?? 120) + 'px';
    el.style.top = (note.y ?? 120) + 'px';
    el.style.width = (note.w ?? 240) + 'px';
    el.style.height = (note.h ?? 200) + 'px';
    el.style.background = c.bg;
    el.style.border = '1px solid ' + c.border;
    el.style.zIndex = ++zCounter;
    el.dataset.id = note.id || uid();

    const head = document.createElement('div');
    head.className = 'jnp-sticky-head';
    head.style.background = c.head;
    head.innerHTML = `
      <span class="ttl">${escHtml(note.title || 'JustPin')}</span>
      <button data-act="min" title="최소화"><svg style="width:11px;height:11px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;vertical-align:middle" viewBox="0 0 24 24"><line x1="5" y1="18" x2="19" y2="18"/></svg></button>
      <button data-act="close" title="닫기"><svg style="width:11px;height:11px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;vertical-align:middle" viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg></button>
    `;

    const body = document.createElement('div');
    body.className = 'jnp-sticky-body';
    body.contentEditable = 'true';
    body.setAttribute('data-placeholder', '여기에 입력…');
    body.innerHTML = note.html || '';

    const foot = document.createElement('div');
    foot.className = 'jnp-sticky-foot';
    for (const name of COLOR_NAMES) {
      const s = document.createElement('span');
      s.className = 'swatch';
      s.style.background = COLORS[name].bg;
      s.title = name;
      s.onclick = () => changeColor(note.id, name);
      foot.appendChild(s);
    }
    const info = document.createElement('span');
    info.className = 'info';
    info.textContent = new Date(note.updatedAt || Date.now()).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
    foot.appendChild(info);

    const resize = document.createElement('div');
    resize.className = 'jnp-sticky-resize';

    el.append(head, body, foot, resize);
    document.body.appendChild(el);

    // 이벤트
    head.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'min') { el.classList.toggle('min'); persist(note.id); }
      if (act === 'close') { destroy(note.id); }
    });
    el.addEventListener('mousedown', () => bringToFront(note.id));
    body.addEventListener('input', () => {
      const n = notes.get(note.id)?.data; if (!n) return;
      n.html = body.innerHTML;
      n.title = (body.textContent || '').slice(0, 30) || 'JustPin';
      head.querySelector('.ttl').textContent = n.title;
      n.updatedAt = Date.now();
      info.textContent = new Date(n.updatedAt).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
      queueSave(note.id);
    });

    makeDraggable(el, head, note.id);
    makeResizable(el, resize, note.id);

    notes.set(note.id, { el, data: note });
    return el;
  }

  // ---- 드래그·리사이즈 ----
  function makeDraggable(el, handle, id) {
    let sx = 0, sy = 0, ox = 0, oy = 0, drag = false;
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      drag = true; sx = e.clientX; sy = e.clientY;
      const rect = el.getBoundingClientRect();
      ox = rect.left; oy = rect.top;
      handle.setPointerCapture(e.pointerId);
      bringToFront(id);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!drag) return;
      el.style.left = Math.max(0, ox + e.clientX - sx) + 'px';
      el.style.top  = Math.max(0, oy + e.clientY - sy) + 'px';
    });
    handle.addEventListener('pointerup', () => {
      if (!drag) return; drag = false;
      const n = notes.get(id)?.data; if (n) {
        n.x = parseInt(el.style.left, 10);
        n.y = parseInt(el.style.top, 10);
        persist(id);
      }
    });
  }
  function makeResizable(el, handle, id) {
    let sx = 0, sy = 0, sw = 0, sh = 0, drag = false;
    handle.addEventListener('pointerdown', (e) => {
      drag = true; sx = e.clientX; sy = e.clientY;
      const rect = el.getBoundingClientRect();
      sw = rect.width; sh = rect.height;
      handle.setPointerCapture(e.pointerId);
      bringToFront(id);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!drag) return;
      el.style.width  = Math.max(160, sw + e.clientX - sx) + 'px';
      el.style.height = Math.max(120, sh + e.clientY - sy) + 'px';
    });
    handle.addEventListener('pointerup', () => {
      if (!drag) return; drag = false;
      const n = notes.get(id)?.data; if (n) {
        n.w = parseInt(el.style.width, 10);
        n.h = parseInt(el.style.height, 10);
        persist(id);
      }
    });
  }

  // ---- 지속성 ----
  const saveTimers = new Map();
  function queueSave(id) {
    clearTimeout(saveTimers.get(id));
    saveTimers.set(id, setTimeout(() => persist(id), 500));
  }
  function persist(id) {
    const entry = notes.get(id); if (!entry) return;
    const el = entry.el;
    entry.data.min = el.classList.contains('min');
    entry.data.z = parseInt(el.style.zIndex, 10) || 1000;
    dbPut(entry.data);
  }

  function bringToFront(id) {
    const entry = notes.get(id); if (!entry) return;
    entry.el.style.zIndex = ++zCounter;
  }

  function changeColor(id, color) {
    const entry = notes.get(id); if (!entry) return;
    entry.data.color = color;
    const c = COLORS[color];
    entry.el.style.background = c.bg;
    entry.el.style.borderColor = c.border;
    entry.el.querySelector('.jnp-sticky-head').style.background = c.head;
    persist(id);
  }

  async function destroy(id) {
    const entry = notes.get(id); if (!entry) return;
    // 휴지통 보관 (복원 가능하도록)
    try {
      const trashKey = 'jnp-sticky-trash';
      const trash = JSON.parse(localStorage.getItem(trashKey) || '[]');
      trash.unshift(entry.data);
      localStorage.setItem(trashKey, JSON.stringify(trash.slice(0, 30)));
    } catch {}
    entry.el.remove();
    notes.delete(id);
    await dbDel(id);
  }

  // ---- Tauri 감지 ----
  const isTauri = !!window.__TAURI__;
  const tauriInvoke = async (cmd, args) => {
    try {
      const fn = window.__TAURI__?.core?.invoke;
      if (typeof fn !== 'function') throw new Error('no invoke');
      return await fn(cmd, args);
    } catch (e) { return { __err: e }; }
  };

  // ---- 생성 ----
  // Tauri 데스크톱: 실제 OS 창(always-on-top, frameless) 생성 → 데스크톱 어디서든 사용 가능 + 재부팅 후 복원
  // 웹/브라우저: 페이지 내 플로팅 JustPin (폴백)
  // Tauri 지만 새 커맨드가 없는 구버전 앱: 자동으로 웹 폴백으로 전환
  // JustPin 스폰 좌표를 stagger — 같은 자리에 겹쳐쌓이지 않도록.
  // 매번 (+28, +28) 씩 밀어준다. 화면 밖으로 가면 다시 시작 위치로.
  let __spawnOffset = 0;
  function nextSpawnPos() {
    const base = {
      x: (window.screenX || 0) + 120,
      y: (window.screenY || 0) + 120,
    };
    const step = 28;
    const n = __spawnOffset++;
    // 8개 이상이면 리셋 (너무 멀리 가지 않게)
    const k = n % 8;
    return { x: base.x + k * step, y: base.y + k * step };
  }

  async function create(opts = {}) {
    if (isTauri) {
      const id = opts.id || ('postit-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6));
      const pos = (opts.x == null && opts.y == null) ? nextSpawnPos() : { x: opts.x, y: opts.y };
      const args = {
        id,
        x: pos.x,
        y: pos.y,
        w: opts.w ?? 280,
        h: opts.h ?? 240,
        color: opts.color || randomColor(),
        content: opts.html || (opts.text ? escHtml(opts.text).replace(/\n/g,'<br>') : ''),
      };
      const res = await tauriInvoke('postit_spawn', args);
      if (res && res.__err) {
        // 데스크톱 앱 구버전 (v1.0.22 이전) — postit_spawn 커맨드 없음 → 웹 폴백
        console.warn('[sticky] Tauri postit_spawn not available, falling back to web floating:', res.__err);
        toast('데스크톱 앱이 구버전이라 브라우저 내 JustPin으로 대체합니다');
        // 아래 웹 폴백으로 떨어짐
      } else {
        toast('바탕화면에 JustPin 생성됨');
        return args;
      }
    }

    // === 웹 폴백 (브라우저 창 내 플로팅) ===
    const now = Date.now();
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = opts.w || 240;
    const h = opts.h || 200;
    const x = opts.x ?? Math.max(20, Math.round(vw * 0.5 - w / 2 + (Math.random()-.5) * 120));
    const y = opts.y ?? Math.max(80, Math.round(vh * 0.3 + (Math.random()-.5) * 100));
    const note = {
      id: opts.id || uid(),
      x, y, w, h,
      color: opts.color || randomColor(),
      html: opts.html || (opts.text ? escHtml(opts.text).replace(/\n/g,'<br>') : ''),
      title: (opts.text || '').slice(0, 30) || 'JustPin',
      min: false, z: ++zCounter,
      createdAt: now, updatedAt: now,
    };
    render(note);
    persist(note.id);
    return note;
  }
  function randomColor() { return COLOR_NAMES[Math.floor(Math.random() * COLOR_NAMES.length)]; }

  // ---- 선택 텍스트 → JustPin ----
  function fromSelection() {
    const sel = window.getSelection?.();
    const text = sel?.toString() || '';
    if (!text.trim()) { toast('선택된 텍스트가 없습니다'); return null; }
    return create({ text, color: 'yellow' });
  }

  // ---- 탭 → JustPin (탭 html 을 그대로) ----
  function fromTab(tabId) {
    const s = window.state; if (!s) return null;
    const tab = s.tabs?.find(t => t.id === tabId);
    if (!tab) return null;
    return create({ html: tab.html || '', title: tab.name, color: 'yellow' });
  }

  // ---- 전체 숨김/복원 ----
  function toggleAll() {
    const anyVisible = [...notes.values()].some(e => e.el.style.display !== 'none');
    for (const e of notes.values()) e.el.style.display = anyVisible ? 'none' : '';
    toast(anyVisible ? 'JustPin 모두 숨김' : 'JustPin 모두 표시');
  }

  // ---- 부팅: 저장된 JustPin 복원 (웹 전용; Tauri 는 Rust 가 복원) ----
  async function hydrate() {
    if (isTauri) return;  // Tauri 데스크톱에선 메인 창 안에 플로팅 JustPin을 띄우지 않음
    const list = await dbAll();
    for (const n of list) {
      render(n);
      if (n.min) { notes.get(n.id)?.el.classList.add('min'); }
    }
  }

  // ---- 유틸 ----
  function escHtml(s) { return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function toast(t, ms = 1800) { try { window.toast?.(t, ms); } catch { console.log('[toast]', t); } }

  // ---- 토픽바 버튼 ----
  function injectTopBtn() {
    if (document.getElementById('stickyTopBtn')) return true;
    const anchor = document.getElementById('calOpenBtn') || document.getElementById('palBtn');
    if (!anchor?.parentNode) return false;
    const b = document.createElement('button');
    b.id = 'stickyTopBtn';
    b.className = anchor.className || 'collapsible';
    b.setAttribute('aria-label', '새 JustPin');
    b.setAttribute('title', '새 JustPin (Ctrl+Alt+P)');
    b.innerHTML = `<svg style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round" viewBox="0 0 24 24"><path d="M15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9z"/><path d="M15 3v6h6"/></svg>`;
    b.addEventListener('click', (e) => {
      e.preventDefault();
      if (e.shiftKey) fromSelection(); else create();
    });
    anchor.parentNode.insertBefore(b, anchor.nextSibling);
    return true;
  }

  // ---- 탭 우클릭 메뉴: "JustPin으로 떼어내기" ----
  function installTabContextMenu() {
    document.addEventListener('contextmenu', (e) => {
      const tab = e.target.closest('.tab[data-id], [data-tab-id]');
      if (!tab) return;
      const tabId = tab.dataset.id || tab.dataset.tabId;
      if (!tabId) return;
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, [
        { label: 'JustPin으로 떼어내기', run: () => fromTab(tabId) },
        { label: '새 JustPin (빈)', run: () => create() },
      ]);
    });
  }

  function showContextMenu(x, y, items) {
    document.querySelectorAll('.jnp-sticky-ctx').forEach(m => m.remove());
    const m = document.createElement('div');
    m.className = 'jnp-sticky-ctx';
    m.style.left = x + 'px'; m.style.top = y + 'px';
    for (const it of items) {
      const b = document.createElement('button');
      b.textContent = it.label;
      b.onclick = () => { m.remove(); it.run(); };
      m.appendChild(b);
    }
    document.body.appendChild(m);
    setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }), 50);
  }

  // ---- 명령 팔레트 등록 ----
  function tryRegisterPalette() {
    const pal = window.justanotepadPalette;
    if (!pal?.register) return false;
    pal.register({ id: 'sticky.create',   title: '새 JustPin',              keywords:['JustPin','justpin','postit','sticky','메모','포스트잇'], run: () => create() });
    pal.register({ id: 'sticky.selection',title: '선택 텍스트를 JustPin으로', keywords:['JustPin','justpin','postit','선택','copy'],          run: () => fromSelection() });
    pal.register({ id: 'sticky.toggle',   title: 'JustPin 모두 숨김/표시',     keywords:['JustPin','justpin','postit','toggle','전체'],         run: () => toggleAll() });
    return true;
  }

  // ---- 단축키 ----
  window.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.altKey && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); create(); }
    if (mod && e.shiftKey && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); fromSelection(); }
  });

  // ---- 부팅 ----
  function boot() {
    injectTopBtn() || setTimeout(boot, 400);
    tryRegisterPalette() || setTimeout(tryRegisterPalette, 600);
    installTabContextMenu();
    hydrate();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  // ---- 전역 API ----
  window.jnpStickyNotes = {
    create, fromSelection, fromTab, toggleAll,
    list: () => [...notes.values()].map(e => e.data),
    remove: destroy,
    bringToFront,
    changeColor,
  };
  console.info('[sticky-notes] v1.0 ready — Ctrl+Alt+P for new sticky');
})();
