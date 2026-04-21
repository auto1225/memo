/**
 * justanotepad · Desktop Postit Mode (v1.0)
 * --------------------------------------------------------------------------
 * URL 이 ?mode=postit&id=X 일 때: 전체 앱 UI 숨기고 포스트잇 화면만 렌더.
 * Tauri 창 하나 = 포스트잇 1개.
 *
 * 동작:
 *   1. 이 스크립트는 모든 페이지에서 로드되지만 ?mode=postit 일 때만 활성화
 *   2. 활성화 시: 기존 앱 UI 전부 display:none, 자체 포스트잇 UI 주입
 *   3. 내용 입력 → invoke('postit_update', { id, content }) 로 Rust 에 저장
 *   4. 색상 변경 → invoke('postit_update', { id, color })
 *   5. 창 이동/리사이즈는 Rust 측에서 자동 저장 (on_window_event)
 *   6. 닫기 버튼 → invoke('postit_close', { id }) — 파일에서도 제거
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  const url = new URL(location.href);
  const mode = url.searchParams.get('mode');
  const id = url.searchParams.get('id');
  if (mode !== 'postit' || !id) return;            // postit 창이 아니면 종료
  if (window.__postitMode) return;
  window.__postitMode = true;

  const isTauri = !!window.__TAURI__;
  const invoke = (cmd, args) => {
    try { return window.__TAURI__?.core?.invoke(cmd, args); } catch { return null; }
  };

  // ---- 색상 팔레트 (sticky-notes 와 일치) ----
  const COLORS = {
    yellow:   { bg: '#fff6a5', border: '#f0dd55', head: '#fae77c' },
    pink:     { bg: '#ffd6e0', border: '#f298b0', head: '#fbb8ca' },
    mint:     { bg: '#c6f0dc', border: '#7fcaa6', head: '#a8e4c7' },
    sky:      { bg: '#cfe8ff', border: '#7fb9e6', head: '#b5d8f5' },
    lavender: { bg: '#e3d6ff', border: '#a98fe0', head: '#cfbdf5' },
    peach:    { bg: '#ffd8c0', border: '#e89975', head: '#fabca0' },
  };
  const COLOR_NAMES = Object.keys(COLORS);

  // 상태
  let state = { id, color: url.searchParams.get('color') || 'yellow', content: '' };

  // ---- 기존 앱 UI 완전 숨김 ----
  function hideAppUi() {
    const style = document.createElement('style');
    style.textContent = `
      body > *:not(#postit-root) { display: none !important; }
      html, body { overflow: hidden !important; margin: 0; padding: 0; height: 100vh; background: transparent; }
    `;
    document.head.appendChild(style);
  }

  // ---- 포스트잇 UI 생성 ----
  function build() {
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
        color: rgba(0,0,0,0.55);
        display: flex; align-items: center; gap: 4px;
        cursor: move; user-select: none;
      ">
        <span style="flex:1;">포스트잇</span>
        <button data-act="min" title="최소화" style="background:transparent;border:0;cursor:pointer;padding:3px 6px;color:inherit;font:inherit;">▁</button>
        <button data-act="close" title="삭제" style="background:transparent;border:0;cursor:pointer;padding:3px 6px;color:inherit;font:inherit;">✕</button>
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

    const head = root.querySelector('#postit-head');
    const body = root.querySelector('#postit-body');
    const foot = root.querySelector('#postit-foot');

    // placeholder
    const ph = document.createElement('style');
    ph.textContent = `#postit-body:empty::before{content:attr(data-placeholder);color:rgba(0,0,0,0.32);}`;
    document.head.appendChild(ph);

    // 입력 자동 저장 (0.4초 debounce)
    let t = null;
    body.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.content = body.innerHTML;
        invoke('postit_update', { id: state.id, content: state.content });
      }, 400);
    });

    // 헤더 버튼
    head.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'min') {
        const body = root.querySelector('#postit-body');
        const foot = root.querySelector('#postit-foot');
        const minimized = body.style.display === 'none';
        body.style.display = minimized ? '' : 'none';
        foot.style.display = minimized ? '' : 'none';
      }
      if (act === 'close') {
        if (!confirm('이 포스트잇을 삭제하시겠습니까?')) return;
        invoke('postit_close', { id: state.id });
        // Rust 가 창 닫음
      }
    });

    // 색상 변경
    foot.addEventListener('click', (e) => {
      const sw = e.target.closest('[data-color]');
      if (!sw) return;
      state.color = sw.dataset.color;
      applyColor(root);
      invoke('postit_update', { id: state.id, color: state.color });
    });

    return { root, body };
  }

  function applyColor(root) {
    const c = COLORS[state.color] || COLORS.yellow;
    root.style.background = c.bg;
    root.style.borderColor = c.border;
    const head = root.querySelector('#postit-head');
    if (head) head.style.background = c.head;
  }

  // ---- 상태 로드 ----
  async function loadInitial() {
    if (!isTauri) return;
    try {
      const list = await invoke('postit_list');
      if (!Array.isArray(list)) return;
      const mine = list.find(p => p.id === state.id);
      if (mine) {
        state.color = mine.color || state.color;
        state.content = mine.content || '';
      }
    } catch (e) { console.warn('[postit-desktop] load', e); }
  }

  // ---- 부팅 ----
  async function boot() {
    hideAppUi();
    await loadInitial();
    const { root, body } = build();
    body.innerHTML = state.content || '';
    // placeholder visibility
    if (!body.textContent.trim()) body.focus();
    console.info('[postit-desktop] ready, id =', state.id);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
