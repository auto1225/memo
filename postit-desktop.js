/**
 * justanotepad · Desktop Postit (v1.1)
 * --------------------------------------------------------------------------
 * ?mode=postit&id=X 일 때 앱 UI 숨기고 포스트잇 전용 창 렌더.
 *
 * v1.1 추가:
 *   1. 드래그 수정 — pointerdown 에서 Tauri startDragging() 명시 호출
 *   2. 서식 툴바 — B, I, U, 글자색, 형광펜, 글머리, 체크리스트
 *   3. z-order 3-way 토글 — 맨위고정 / 일반 / 바탕화면 맨아래 (SVG 아이콘)
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  // ---- 인라인 SVG 헬퍼 (앱 심볼이 이 창에 없으므로 인라인 정의) ----
  const SVGS = {
    x:       '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>',
    min:     '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="18" x2="19" y2="18"/></svg>',
    zTop:    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="4" x2="20" y2="4"/><polyline points="6 12 12 6 18 12"/><line x1="12" y1="6" x2="12" y2="20"/></svg>',
    zNormal: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>',
    zBottom: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="4" x2="12" y2="18"/><polyline points="6 12 12 18 18 12"/><line x1="4" y1="20" x2="20" y2="20"/></svg>',
    palette: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="1.3" fill="currentColor"/><circle cx="17.5" cy="10.5" r="1.3" fill="currentColor"/><circle cx="8.5" cy="7.5" r="1.3" fill="currentColor"/><circle cx="6.5" cy="12.5" r="1.3" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10a3 3 0 0 0 3-3c0-1.3-.2-2 .5-2.5 1-.7 1.5-1 3.5-1A3 3 0 0 0 22 12c0-5.5-4.5-10-10-10z"/></svg>',
    marker:  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3l7 7-9 9-7-2 2-7z"/><line x1="5" y1="20" x2="3" y2="22"/></svg>',
    check:   '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>',
  };

  const url = new URL(location.href);
  if (url.searchParams.get('mode') !== 'postit') return;
  const id = url.searchParams.get('id');
  if (!id) return;
  if (window.__postitMode) return;
  window.__postitMode = true;

  const isTauri = !!window.__TAURI__;
  const invoke = async (cmd, args) => {
    try { return await window.__TAURI__?.core?.invoke(cmd, args); }
    catch (e) { console.warn('[postit invoke]', cmd, e); return null; }
  };
  const currentWindow = () => {
    try { return window.__TAURI__?.window?.getCurrentWindow?.(); }
    catch { return null; }
  };

  const COLORS = {
    yellow:   { bg:'#fff6a5', border:'#f0dd55', head:'#fae77c' },
    pink:     { bg:'#ffd6e0', border:'#f298b0', head:'#fbb8ca' },
    mint:     { bg:'#c6f0dc', border:'#7fcaa6', head:'#a8e4c7' },
    sky:      { bg:'#cfe8ff', border:'#7fb9e6', head:'#b5d8f5' },
    lavender: { bg:'#e3d6ff', border:'#a98fe0', head:'#cfbdf5' },
    peach:    { bg:'#ffd8c0', border:'#e89975', head:'#fabca0' },
  };
  const COLOR_NAMES = Object.keys(COLORS);

  const TEXT_COLORS = ['#111', '#e53935', '#fb8c00', '#f9a825', '#43a047', '#1e88e5', '#8e24aa', '#fff'];
  const HILITE_COLORS = ['transparent', '#fff59d', '#ffab91', '#ef9a9a', '#a5d6a7', '#90caf9', '#ce93d8'];

  const state = {
    id,
    color: url.searchParams.get('color') || 'yellow',
    content: '',
    zMode: 'top', // 'top' | 'normal' | 'bottom'
  };

  // ---- 앱 UI 완전 숨김 ----
  const style = document.createElement('style');
  style.textContent = `
    body > *:not(#postit-root) { display: none !important; }
    html, body { overflow: hidden !important; margin: 0; padding: 0; height: 100vh; background: transparent; }
    #postit-body:empty::before { content: attr(data-placeholder); color: rgba(0,0,0,0.32); }
    #postit-toolbar button { background: rgba(255,255,255,0.55); border: 1px solid rgba(0,0,0,0.08); cursor: pointer; padding: 3px 6px; border-radius: 4px; font: 600 11px/1 inherit; color: rgba(0,0,0,0.7); min-width: 22px; min-height: 22px; display: inline-flex; align-items: center; justify-content: center; }
    #postit-toolbar button:hover { background: rgba(255,255,255,0.9); color: rgba(0,0,0,0.95); }
    #postit-toolbar button.active { background: rgba(0,0,0,0.15); }
    #postit-popover { position: fixed; z-index: 100; background: #fff; border: 1px solid rgba(0,0,0,0.15); border-radius: 6px; box-shadow: 0 4px 16px rgba(0,0,0,0.15); padding: 6px; display: flex; gap: 4px; }
    #postit-popover .sw { width: 20px; height: 20px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.12); cursor: pointer; }
    #postit-popover .sw:hover { transform: scale(1.15); }
  `;
  document.head.appendChild(style);

  // ---- 상태 로드 ----
  async function loadInitial() {
    if (!isTauri) return;
    try {
      const list = await invoke('postit_list');
      if (Array.isArray(list)) {
        const mine = list.find(p => p.id === state.id);
        if (mine) {
          state.color = mine.color || state.color;
          state.content = mine.content || '';
        }
      }
    } catch {}
  }

  // ---- UI 생성 ----
  function buildUI() {
    const c = COLORS[state.color] || COLORS.yellow;
    const root = document.createElement('div');
    root.id = 'postit-root';
    root.style.cssText = `
      position: fixed; inset: 0;
      background: ${c.bg};
      border: 1px solid ${c.border};
      display: flex; flex-direction: column;
      font: 14px/1.5 -apple-system, "Segoe UI", "Malgun Gothic", sans-serif;
      color: rgba(0,0,0,0.85);
      overflow: hidden;
    `;
    root.innerHTML = `
      <div id="postit-head" data-tauri-drag-region style="
        background: ${c.head};
        padding: 4px 8px;
        font: 600 11px/1 inherit;
        color: rgba(0,0,0,0.6);
        display: flex; align-items: center; gap: 4px;
        cursor: move; user-select: none;
        min-height: 22px;
      ">
        <span data-tauri-drag-region style="flex:1;">포스트잇</span>
        <button data-act="zorder" title="화면 위치: 맨위/일반/바탕화면" style="background:transparent;border:0;cursor:pointer;padding:2px 6px;color:inherit;display:inline-flex;align-items:center;">${SVGS.zTop}</button>
        <button data-act="min" title="최소화" style="background:transparent;border:0;cursor:pointer;padding:2px 6px;color:inherit;display:inline-flex;align-items:center;">${SVGS.min}</button>
        <button data-act="close" title="삭제" style="background:transparent;border:0;cursor:pointer;padding:2px 6px;color:inherit;display:inline-flex;align-items:center;">${SVGS.x}</button>
      </div>

      <div id="postit-toolbar" style="
        display: flex; gap: 3px; padding: 3px 6px;
        border-bottom: 1px solid rgba(0,0,0,0.08);
        background: ${c.head}; opacity: 0.85;
        flex-wrap: wrap;
      ">
        <button data-cmd="bold" title="굵게 (Ctrl+B)"><b>B</b></button>
        <button data-cmd="italic" title="기울임 (Ctrl+I)"><i>𝐼</i></button>
        <button data-cmd="underline" title="밑줄 (Ctrl+U)"><u>U</u></button>
        <button data-pop="color" title="글자색" style="display:inline-flex;align-items:center;justify-content:center;">${SVGS.palette}</button>
        <button data-pop="hilite" title="형광펜" style="display:inline-flex;align-items:center;justify-content:center;">${SVGS.marker}</button>
        <span style="width:1px;height:16px;background:rgba(0,0,0,0.1);margin:0 2px;align-self:center;"></span>
        <button data-cmd="insertUnorderedList" title="글머리">•</button>
        <button data-act="todo" title="체크리스트" style="display:inline-flex;align-items:center;justify-content:center;">${SVGS.check}</button>
      </div>

      <div id="postit-body" contenteditable="true" data-placeholder="여기에 입력…" style="
        flex: 1;
        padding: 10px 14px;
        outline: none;
        overflow: auto;
        word-break: break-word;
      "></div>

      <div id="postit-foot" style="
        display: flex; align-items: center; gap: 5px;
        padding: 4px 8px;
        border-top: 1px dashed rgba(0,0,0,0.12);
        background: rgba(0,0,0,0.04);
      ">
        ${COLOR_NAMES.map(n => `<span class="sw" data-color="${n}" title="${n}" style="
          width:13px;height:13px;border-radius:50%;cursor:pointer;
          background:${COLORS[n].bg}; border:1px solid rgba(0,0,0,0.15);
        "></span>`).join('')}
      </div>
    `;
    document.body.appendChild(root);
    return root;
  }

  // ---- 드래그: Tauri startDragging 명시 호출 ----
  function wireDrag(head) {
    head.addEventListener('pointerdown', async (e) => {
      // 버튼이나 편집 영역은 제외
      if (e.target.closest('button, [contenteditable="true"], input, select')) return;
      const w = currentWindow();
      if (w && typeof w.startDragging === 'function') {
        try { await w.startDragging(); } catch (err) { console.warn('startDragging', err); }
      }
    });
  }

  // ---- 색상 변경 ----
  function applyColor(root) {
    const c = COLORS[state.color] || COLORS.yellow;
    root.style.background = c.bg;
    root.style.borderColor = c.border;
    const head = root.querySelector('#postit-head');
    const toolbar = root.querySelector('#postit-toolbar');
    if (head) head.style.background = c.head;
    if (toolbar) toolbar.style.background = c.head;
  }

  // ---- Popover (색상 / 형광) ----
  let popoverEl = null;
  function showPopover(anchor, kind) {
    closePopover();
    const pop = document.createElement('div');
    pop.id = 'postit-popover';
    const colors = kind === 'color' ? TEXT_COLORS : HILITE_COLORS;
    colors.forEach(col => {
      const s = document.createElement('span');
      s.className = 'sw';
      s.style.background = col === 'transparent'
        ? 'linear-gradient(45deg, #fff 25%, #eee 25%, #eee 50%, #fff 50%, #fff 75%, #eee 75%, #eee)'
        : col;
      s.style.backgroundSize = '6px 6px';
      s.title = col;
      s.onclick = () => {
        if (kind === 'color') {
          document.execCommand('foreColor', false, col === 'transparent' ? '#111' : col);
        } else {
          document.execCommand('hiliteColor', false, col);
        }
        document.getElementById('postit-body')?.focus();
        closePopover();
      };
      pop.appendChild(s);
    });
    const rect = anchor.getBoundingClientRect();
    pop.style.left = rect.left + 'px';
    pop.style.top = (rect.bottom + 3) + 'px';
    document.body.appendChild(pop);
    popoverEl = pop;
    setTimeout(() => document.addEventListener('click', closePopover, { once: true }), 50);
  }
  function closePopover() { popoverEl?.remove(); popoverEl = null; }

  // ---- Z-order 3-way 토글 ----
  async function cycleZOrder(btn) {
    state.zMode = state.zMode === 'top' ? 'normal' : state.zMode === 'normal' ? 'bottom' : 'top';
    const svgMap = { top: SVGS.zTop, normal: SVGS.zNormal, bottom: SVGS.zBottom };
    const title = state.zMode === 'top' ? '맨 위 고정 (다른 앱보다 위)'
                : state.zMode === 'normal' ? '일반 (클릭해야 앞으로)'
                : '바탕화면 (다른 앱에 가려짐)';
    btn.innerHTML = svgMap[state.zMode];
    btn.setAttribute('title', title);
    await invoke('postit_set_z_order', { id: state.id, state: state.zMode });
  }

  // ---- 체크리스트 삽입 ----
  function insertCheckbox() {
    const body = document.getElementById('postit-body');
    if (!body) return;
    body.focus();
    document.execCommand('insertHTML', false,
      '<div style="display:flex;align-items:center;gap:6px;"><input type="checkbox" style="margin:0;"/><span>&nbsp;</span></div>');
  }

  // ---- 입력 디바운스 저장 ----
  let saveTimer = null;
  function scheduleSave(content) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      state.content = content;
      invoke('postit_update', { id: state.id, content });
    }, 400);
  }

  // ---- 이벤트 바인딩 ----
  function wireEvents(root) {
    const head = root.querySelector('#postit-head');
    const toolbar = root.querySelector('#postit-toolbar');
    const body = root.querySelector('#postit-body');
    const foot = root.querySelector('#postit-foot');

    wireDrag(head);

    // 본문 입력 저장
    body.addEventListener('input', () => scheduleSave(body.innerHTML));

    // 헤더 버튼
    head.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      e.stopPropagation();
      if (act === 'zorder') cycleZOrder(e.target.closest('[data-act="zorder"]'));
      else if (act === 'min') {
        body.style.display = body.style.display === 'none' ? '' : 'none';
        toolbar.style.display = body.style.display === 'none' ? 'none' : '';
        foot.style.display = body.style.display === 'none' ? 'none' : '';
      }
      else if (act === 'close') {
        if (!confirm('이 포스트잇을 삭제하시겠습니까?')) return;
        invoke('postit_close', { id: state.id });
      }
    });

    // 서식 툴바
    toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      e.stopPropagation();
      const cmd = btn.dataset.cmd;
      const pop = btn.dataset.pop;
      const act = btn.dataset.act;
      if (cmd) { body.focus(); document.execCommand(cmd); }
      else if (pop) { showPopover(btn, pop); }
      else if (act === 'todo') { insertCheckbox(); }
      scheduleSave(body.innerHTML);
    });

    // 색상 스와치
    foot.addEventListener('click', (e) => {
      const sw = e.target.closest('[data-color]');
      if (!sw) return;
      state.color = sw.dataset.color;
      applyColor(root);
      invoke('postit_update', { id: state.id, color: state.color });
    });

    // 체크박스 클릭도 저장 트리거
    body.addEventListener('change', () => scheduleSave(body.innerHTML));
  }

  // ---- 부팅 ----
  async function boot() {
    await loadInitial();
    const root = buildUI();
    const body = root.querySelector('#postit-body');
    body.innerHTML = state.content || '';
    wireEvents(root);
    if (!body.textContent.trim()) body.focus();
    console.info('[postit-desktop] v1.1 ready · id =', state.id);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
