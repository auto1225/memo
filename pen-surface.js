/**
 * JustANotepad - Pen / Handwriting Surface
 * --------------------------------------------------------------------------
 * The full drawing studio already exists inside #paintModal (pencil, brush
 * with pressure sensing, marker, airbrush, eraser, shapes, layers, symmetry,
 * grid, thickness slider 1–50px, fill styles, undo/redo). Users just don't
 * know it's there — the only entry is a small #paintTopBtn icon.
 *
 * This script:
 *   1. Adds a large, friendly "손글씨" floating action button (FAB) so
 *      the feature is immediately discoverable on phones and tablets.
 *   2. Auto-detects stylus / pen input (PointerEvent.pointerType === 'pen')
 *      and offers "펜 모드로 전환하시겠어요?" toast when the user scribbles
 *      on the editor with a stylus.
 *   3. Registers a command-palette action "손글씨/펜 모드" so Cmd/Ctrl+K
 *      finds it instantly.
 *   4. Keyboard shortcut: Alt+P opens the paint modal.
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.__jnpPenSurface__) return;
  window.__jnpPenSurface__ = true;

  const CSS = `
    /* Icon-only FAB — subtle, matches app's warm beige/yellow theme.
       Label appears on hover only so it doesn't distract while typing. */
    .jnp-pen-fab {
      position: fixed; right: 18px; bottom: 18px; z-index: 2147483200;
      display: flex; align-items: center; gap: 0;
      width: 38px; height: 38px;
      padding: 0; overflow: hidden;
      background: rgba(255, 255, 255, 0.92);
      color: #555; border: 1px solid rgba(0,0,0,0.08);
      border-radius: 999px;
      box-shadow: 0 3px 10px rgba(0,0,0,.08);
      font: 600 12px/1 -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo",
             "Noto Sans KR", Roboto, sans-serif;
      cursor: pointer; opacity: 0; transform: translateY(6px);
      transition: opacity 180ms ease, transform 180ms ease,
                  width 160ms ease, background 120ms ease, color 120ms ease;
      pointer-events: none;
      backdrop-filter: saturate(1.5) blur(6px);
    }
    .jnp-pen-fab.show { opacity: 0.7; transform: translateY(0); pointer-events: auto; }
    .jnp-pen-fab:hover {
      opacity: 1; width: 94px; color: #333;
      background: #FAE100; border-color: #e0c800;
      justify-content: flex-start; padding: 0 0 0 11px; gap: 6px;
    }
    .jnp-pen-fab svg { width: 16px; height: 16px; flex: 0 0 16px; }
    .jnp-pen-fab span {
      overflow: hidden; white-space: nowrap;
      max-width: 0; opacity: 0;
      transition: max-width 140ms ease, opacity 140ms ease;
    }
    .jnp-pen-fab:hover span { max-width: 60px; opacity: 1; }
    .jnp-pen-fab.jnp-pen-hidden { display: none !important; }

    /* Toast that appears when stylus/pen is detected */
    .jnp-pen-toast {
      position: fixed; left: 50%; top: 20px; transform: translate(-50%, -12px);
      z-index: 2147483210; display: flex; align-items: center; gap: 10px;
      padding: 10px 14px; border-radius: 10px;
      background: #2a2740; color: #fff;
      box-shadow: 0 8px 24px rgba(0,0,0,.25);
      font: 500 13px -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
      opacity: 0; transition: opacity 160ms ease, transform 160ms ease;
      pointer-events: none; max-width: 92vw;
    }
    .jnp-pen-toast.show { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
    .jnp-pen-toast button {
      background: #FAE100; color: #2a2740; border: 0;
      padding: 6px 12px; border-radius: 6px; font: inherit;
      font-weight: 700; cursor: pointer;
    }
    .jnp-pen-toast .dismiss {
      background: transparent; color: #aaa; padding: 6px 8px;
      font-weight: 400; cursor: pointer;
    }

    /* Slide FAB up when the on-screen keyboard is visible */
    @media (max-height: 500px) { .jnp-pen-fab { bottom: 72px; } }
  `;
  const style = document.createElement('style');
  style.setAttribute('data-jnp-pen', '');
  style.textContent = CSS;
  document.head.appendChild(style);

  // ---- Open the paint modal ----------------------------------------
  function openPaint() {
    const btn = document.getElementById('paintTopBtn');
    if (btn) { btn.click(); return; }
    const modal = document.getElementById('paintModal');
    if (modal) { modal.classList.add('open'); return; }
  }

  // ---- FAB --------------------------------------------------------
  function installFab() {
    // User can permanently hide via command palette
    try {
      if (localStorage.getItem('jnp.penFab.hidden') === '1') return;
    } catch {}
    if (document.getElementById('jnpPenFab')) return;
    const fab = document.createElement('button');
    fab.id = 'jnpPenFab';
    fab.type = 'button';
    fab.className = 'jnp-pen-fab';
    fab.setAttribute('aria-label', '손글씨·펜 모드 열기');
    fab.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 19l7-7 3 3-7 7-3-3z"/>
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
        <path d="M2 2l7.586 7.586"/>
        <circle cx="11" cy="11" r="2"/>
      </svg>
      <span>손글씨</span>
    `;
    fab.addEventListener('click', () => {
      openPaint();
      fab.classList.remove('show');
    });
    document.body.appendChild(fab);
    // Show after a short delay so it doesn't fight with the intro animation.
    setTimeout(() => fab.classList.add('show'), 1500);
  }

  // ---- Stylus detection → one-time suggestion ----------------------
  function installStylusDetection() {
    let shown = false;
    let dismissedOnce = false;
    try { dismissedOnce = localStorage.getItem('jnp.penToast.dismissed') === '1'; } catch {}
    if (dismissedOnce) return;

    function onPointer(e) {
      if (shown) return;
      if (e.pointerType !== 'pen') return;
      shown = true;
      showStylusToast();
    }
    document.addEventListener('pointerdown', onPointer, { passive: true });
  }

  function showStylusToast() {
    const toast = document.createElement('div');
    toast.className = 'jnp-pen-toast';
    toast.innerHTML = `
      <svg viewBox="0 0 24 24" style="width:16px;height:16px;flex:0 0 16px;" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
      <span>펜이 감지됐어요. 손글씨 모드로 전환하시겠어요?</span>
      <button type="button" class="open">네, 열기</button>
      <button type="button" class="dismiss">다시 안 보기</button>
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    toast.querySelector('.open').addEventListener('click', () => {
      openPaint();
      toast.remove();
    });
    toast.querySelector('.dismiss').addEventListener('click', () => {
      try { localStorage.setItem('jnp.penToast.dismissed', '1'); } catch {}
      toast.remove();
    });
    setTimeout(() => toast.classList.remove('show'), 15000);
    setTimeout(() => toast.remove(), 15400);
  }

  // ---- Command palette registration --------------------------------
  function registerPaletteCommand() {
    let tries = 0;
    const tick = setInterval(() => {
      if (window.justanotepadPalette && typeof window.justanotepadPalette.register === 'function') {
        clearInterval(tick);
        window.justanotepadPalette.register({
          id: 'handwriting',
          title: '손글씨·펜 모드',
          hint: '그림판 · 필압 감지 · 레이어 지원',
          keywords: ['pen', '펜', '손글씨', 'draw', '그림', '필기', 'paint'],
          run: openPaint,
        });
        // Allow users to permanently hide the FAB
        window.justanotepadPalette.register({
          id: 'hide-pen-fab',
          title: '손글씨 플로팅 버튼 숨기기',
          hint: '우하단 펜 버튼을 안 보이게 합니다 (명령 팔레트로 다시 켤 수 있어요)',
          keywords: ['hide', 'pen', 'fab', '숨기기', '펜', '손글씨'],
          run: () => {
            try { localStorage.setItem('jnp.penFab.hidden', '1'); } catch {}
            document.getElementById('jnpPenFab')?.remove();
          },
        });
        window.justanotepadPalette.register({
          id: 'show-pen-fab',
          title: '손글씨 플로팅 버튼 보이기',
          hint: '우하단에 손글씨 버튼을 다시 표시합니다',
          keywords: ['show', 'pen', 'fab', '보이기', '펜', '손글씨'],
          run: () => {
            try { localStorage.removeItem('jnp.penFab.hidden'); } catch {}
            installFab();
          },
        });
      }
      if (++tries > 40) clearInterval(tick);
    }, 250);
  }

  // ---- Alt+P keyboard shortcut -------------------------------------
  function installShortcut() {
    window.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        openPaint();
      }
    });
  }

  function boot() {
    // FAB 은 더 이상 기본 설치 안 함 — 툴바의 #sketchBtn (형광펜 옆) 으로 접근.
    // 사용자가 명시적으로 localStorage 에 jnp.penFab.visible='1' 을 설정한 경우만 표시.
    try {
      if (localStorage.getItem('jnp.penFab.visible') === '1') installFab();
    } catch {}
    installStylusDetection();
    registerPaletteCommand();
    installShortcut();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
