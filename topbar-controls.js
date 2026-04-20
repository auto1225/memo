/**
 * JustANotepad — Topbar window controls
 * --------------------------------------------------------------------------
 * Centralized handlers for the topbar's window-control buttons:
 *   minBtn / maxBtn / pinBtn / closeBtn
 *
 * Why this file exists:
 *   Previously, app.html's minBtn handler *always* toggled a `.minimized`
 *   CSS class (42px strip), AND frameless-patch.js added a second Tauri
 *   handler that called the real OS `minimize()`. In Tauri desktop, every
 *   click fired both handlers:
 *     click 1: CSS class ON   + OS minimize → window goes to taskbar
 *     click 2 (from taskbar): window restores, CSS class still ON → BLANK
 *     click 3: CSS class OFF  + OS minimize → restore from taskbar → normal
 *     click 4: CSS class ON   + OS minimize → restore → BLANK
 *   The CSS state drifted out of sync with the actual OS window state,
 *   producing the "every other click is blank" bug the user reported.
 *
 * Fix strategy:
 *   - In Tauri/Capacitor: let the OS/webview handle minimize. Skip CSS.
 *     Additionally listen for window focus/resize events so if CSS ever
 *     *does* get stuck ON (defensive), we clear it on restore.
 *   - In browser/PWA: keep the CSS strip minimize (useful for sticky-note
 *     style). Toggle `.minimized` on padEl.
 *
 *   Also adds real maximize/restore (Tauri) and always-on-top (Tauri),
 *   plus a "⋯ 더보기" overflow menu that mirrors every .collapsible
 *   topbar button for narrow widths.
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.__janTopbarControls__) return;
  window.__janTopbarControls__ = true;

  const isTauri = !!(window.__TAURI__ || window.__TAURI_INTERNALS__);
  const isCapacitor = !!(window.Capacitor || window.capacitorBridge);
  const isNativeWrapper = isTauri || isCapacitor ||
    (typeof navigator !== 'undefined' && / wv\)/.test(navigator.userAgent));

  // ---- Helpers ---------------------------------------------------------
  function getTauriWindow() {
    if (!isTauri) return null;
    const T = window.__TAURI__ || {};
    try {
      if (T.window?.getCurrentWindow) return T.window.getCurrentWindow();
      if (T.window?.appWindow)        return T.window.appWindow;
    } catch {}
    return null;
  }

  function $(id) { return document.getElementById(id); }
  function padEl() { return document.getElementById('pad'); }

  // ---- Minimize (fix blank-screen bug) ---------------------------------
  function wireMinimize() {
    const btn = $('minBtn');
    if (!btn) return;
    // Remove any pre-existing click listener from app.html by cloning.
    // (app.html may still have added its `.classList.toggle('minimized')`.)
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);

    fresh.addEventListener('click', async () => {
      const pe = padEl();
      if (isTauri) {
        // Real OS minimize only — never toggle CSS class
        const w = getTauriWindow();
        try { await w?.minimize?.(); } catch (e) { console.warn('[JAN] minimize failed', e); }
        // Defensive: ensure CSS is cleared so next restore shows content
        pe?.classList.remove('minimized');
        return;
      }
      if (isCapacitor) {
        try {
          const App = window.Capacitor?.Plugins?.App;
          if (App?.minimizeApp) await App.minimizeApp();
        } catch {}
        pe?.classList.remove('minimized');
        return;
      }
      // Browser/PWA: CSS strip minimize
      pe?.classList.toggle('minimized');
    });

    // Tauri: listen for restore/focus events to clear any stale .minimized
    // class. This is bulletproof against any other path re-adding the class.
    if (isTauri) {
      const w = getTauriWindow();
      try {
        w?.listen?.('tauri://focus', () => padEl()?.classList.remove('minimized'));
      } catch {}
      window.addEventListener('focus', () => padEl()?.classList.remove('minimized'));
    }
  }

  // ---- Maximize / Restore ----------------------------------------------
  // Fix for "bouncing back" bug (user report 2026-04-20):
  //   - Cloned the button to strip any accidental pre-bound listeners
  //     (same defensive pattern as wireMinimize).
  //   - Added a 300ms debounce so rapid duplicate clicks (including any
  //     synthetic events from drag region / focus handlers) collapse to
  //     one action.
  //   - stopPropagation on the click so the topbar drag/dblclick never
  //     hears the click and can't retrigger maximize.
  //   - In browser mode, toggle a .maximized class on the pad that makes
  //     it fill the viewport — NOT browser fullscreen (which was
  //     confusing because it filled the whole browser chrome, not the
  //     pad). Users can restore by clicking the button again or Esc.
  function wireMaximize() {
    const old = $('maxBtn');
    if (!old) return;
    const btn = old.cloneNode(true);
    old.parentNode.replaceChild(btn, old);

    let busy = false;
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (busy) return;               // debounce duplicate clicks
      busy = true;
      setTimeout(() => { busy = false; }, 300);

      if (isTauri) {
        const w = getTauriWindow();
        try {
          if (w?.toggleMaximize) await w.toggleMaximize();
          else if (w?.isMaximized && w?.unmaximize && w?.maximize) {
            const max = await w.isMaximized();
            if (max) await w.unmaximize(); else await w.maximize();
          }
        } catch (err) {
          console.warn('[JAN] maximize failed', err);
        }
        return;
      }
      // Browser/PWA: toggle a .maximized class on the pad so it fills the
      // viewport. Safer and more intuitive than requestFullscreen.
      const pe = padEl();
      if (!pe) return;
      pe.classList.toggle('maximized');
      pe.classList.remove('minimized');
    });

    // Esc key restores when maximized in browser mode
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (isTauri) return;
      const pe = padEl();
      if (pe?.classList.contains('maximized')) pe.classList.remove('maximized');
    });
  }

  // ---- Always-on-top (Tauri only; hidden otherwise) --------------------
  function wirePin() {
    const btn = $('pinBtn');
    if (!btn) return;
    if (!isTauri) {
      btn.style.display = 'none';
      return;
    }
    let pinned = false;
    btn.addEventListener('click', async () => {
      const w = getTauriWindow();
      try {
        pinned = !pinned;
        await w?.setAlwaysOnTop?.(pinned);
        btn.classList.toggle('pinned', pinned);
        btn.title = pinned ? '항상 위에 (켜짐)' : '항상 위에';
      } catch (e) {
        console.warn('[JAN] setAlwaysOnTop failed', e);
        pinned = !pinned;
      }
    });
  }

  // ---- Overflow menu ---------------------------------------------------
  // Mirror every .collapsible button under #topbarOverflow so narrow-width
  // users can still access them via a ⋯ menu.
  function wireOverflow() {
    const wrap = $('topbarOverflow');
    const menu = $('overflowMenu');
    const toggle = $('overflowBtn');
    if (!wrap || !menu || !toggle) return;

    function buildMenu() {
      menu.innerHTML = '';
      document.querySelectorAll('.topbar .collapsible').forEach((el) => {
        // Skip elements that are explicitly hidden even at wide widths
        if (el.style.display === 'none' && !el.id) return;
        if (el.id === 'authBtn' && el.style.display === 'none') return;
        if (el.id === 'pomoDisplay' && el.classList.contains('hidden')) return;

        // Build a labeled button that proxies the click to the original
        const clone = document.createElement('button');
        const origTitle = el.getAttribute('title') || el.textContent.trim().slice(0, 20);
        const iconSvg = el.querySelector('svg.ico, svg.ico-sm');
        if (iconSvg) {
          const svg = iconSvg.cloneNode(true);
          svg.setAttribute('class', 'ico');
          clone.appendChild(svg);
        }
        const label = document.createElement('span');
        // Clean up the label: strip shortcut hints in parens, em-dash tail
        // text, and anything after a dash so menu entries stay one-line.
        const cleaned = origTitle
          .split('(')[0]
          .split(/[—\-·]/)[0]
          .trim();
        label.textContent = cleaned.length > 14 ? cleaned.slice(0, 14) + '…' : cleaned;
        // Full title preserved for hover
        clone.title = origTitle;
        clone.appendChild(label);

        clone.addEventListener('click', (e) => {
          e.stopPropagation();
          wrap.classList.remove('open');
          // If the original is a <button>, just click it
          if (el.tagName === 'BUTTON') {
            el.click();
          } else {
            // e.g. the calendar dropdown div — click its first button
            const realBtn = el.querySelector('button');
            if (realBtn) realBtn.click();
          }
        });
        menu.appendChild(clone);
      });
    }

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!wrap.classList.contains('open')) buildMenu();
      wrap.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) wrap.classList.remove('open');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') wrap.classList.remove('open');
    });
  }

  // ---- Container-based overflow detection -----------------------------
  // Pad width is often smaller than viewport, so viewport @media rules
  // don't catch it. We observe the topbar's own size and toggle a class
  // on the pad that CSS can react to, independent of viewport size.
  function wireResponsive() {
    const pad = padEl();
    const topbar = document.getElementById('topbar');
    if (!pad || !topbar) return;

    const evaluate = () => {
      // First remove the narrow class to measure at full width
      pad.classList.remove('narrow-topbar');
      // Force reflow
      void topbar.offsetWidth;
      // If scrollWidth > offsetWidth means content overflows
      const overflows = topbar.scrollWidth > topbar.offsetWidth + 4;
      pad.classList.toggle('narrow-topbar', overflows);
    };

    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(() => requestAnimationFrame(evaluate));
      ro.observe(pad);
      ro.observe(topbar);
    }
    window.addEventListener('resize', evaluate);
    // Initial + a few retries while layout settles
    evaluate();
    setTimeout(evaluate, 200);
    setTimeout(evaluate, 800);
  }

  function init() {
    wireMinimize();
    wireMaximize();
    wirePin();
    wireOverflow();
    wireResponsive();
  }

  // Run after app.html's DOMContentLoaded scripts, and also after
  // frameless-patch.js (which adds its own min/close handlers).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 60));
  } else {
    setTimeout(init, 60);
  }
})();
