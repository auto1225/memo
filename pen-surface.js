/**
 * JustANotepad - Pen / Handwriting Surface
 * --------------------------------------------------------------------------
 * The full drawing studio already exists inside #paintModal (pencil, brush
 * with pressure sensing, marker, airbrush, eraser, shapes, layers, symmetry,
 * grid, thickness slider 1–50px, fill styles, undo/redo). Users just don't
 * know it's there — the only entry is a small #paintTopBtn icon.
 *
 * This script:
 *   1. Adds a large, friendly "✍️ 손글씨" floating action button (FAB) so
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
    .jnp-pen-fab {
      position: fixed; right: 20px; bottom: 20px; z-index: 2147483200;
      display: flex; align-items: center; gap: 8px;
      padding: 12px 18px;
      background: linear-gradient(135deg, #7e57c2, #5e35b1);
      color: white; border: none; border-radius: 999px;
      box-shadow: 0 8px 24px rgba(94,53,177,.35);
      font: 600 14px/1 -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo",
             "Noto Sans KR", Roboto, sans-serif;
      cursor: pointer; opacity: 0; transform: translateY(12px);
      transition: opacity 180ms ease, transform 180ms ease;
      pointer-events: none;
    }
    .jnp-pen-fab.show { opacity: 1; transform: translateY(0); pointer-events: auto; }
    .jnp-pen-fab:hover { filter: brightness(1.08); }
    .jnp-pen-fab svg { width: 18px; height: 18px; }

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
      <span>✒️ 펜이 감지됐어요. 손글씨 모드로 전환하시겠어요?</span>
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
    installFab();
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
