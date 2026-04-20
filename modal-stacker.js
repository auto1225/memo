/**
 * JustANotepad — Modal Stacking Manager
 * --------------------------------------------------------------------------
 * Problem: the app has 30+ .modal-backdrop elements. When a user opens one
 * modal and triggers an action that opens another (e.g. "그룹 추가" prompt
 * from inside cardsModal), the second modal sometimes rendered at the same
 * or lower z-index than the first — making its semi-transparent backdrop
 * visually blend into the first and appearing to do nothing.
 *
 * CSS solved specific cases (#modal:200, #cardEditModal:120, etc.) but
 * couldn't cover every pair/triple of modals that might open together.
 *
 * This script installs a MutationObserver on every .modal-backdrop. When
 * the `.open` class is added, the modal is stamped with a z-index HIGHER
 * than every currently-open modal. When `.open` is removed, the inline
 * z-index is cleared so the next open cycle is fresh.
 *
 * Bonus: auto-hides floating UI (pen FAB, home-hub FAB) when any modal is
 * open so users can't accidentally click through them.
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.__janModalStacker__) return;
  window.__janModalStacker__ = true;

  const BASE_Z = 100;        // minimum for any modal (defeats any leftover CSS of 50)
  const STEP = 10;           // gap between stacked modals
  const MAX_REASONABLE = 9000;  // sanity cap so we don't race toward 2^31

  function openModals() {
    return Array.from(document.querySelectorAll('.modal-backdrop.open'));
  }

  function currentMaxZ(exclude) {
    let max = BASE_Z;
    for (const m of openModals()) {
      if (m === exclude) continue;
      const z = parseInt(getComputedStyle(m).zIndex);
      if (!isNaN(z) && z < MAX_REASONABLE) max = Math.max(max, z);
    }
    return max;
  }

  function onModalOpened(el) {
    // Ensure the just-opened modal is always above any already-open modals.
    const nextZ = currentMaxZ(el) + STEP;
    el.style.zIndex = String(nextZ);
    // Auto-hide floating FABs while any modal is active
    syncFabs(true);
  }

  function onModalClosed(el) {
    el.style.zIndex = '';   // reset inline so CSS defaults apply next time
    syncFabs(openModals().length > 0);
  }

  function syncFabs(modalOpen) {
    const penFab = document.getElementById('jnpPenFab');
    const hubFab = document.querySelector('.jan-hub-fab');
    const fbFab = document.querySelector('.jan-fb-btn');
    [penFab, hubFab, fbFab].forEach(fab => {
      if (!fab) return;
      if (!fab.dataset.jnpOrigDisplay) {
        fab.dataset.jnpOrigDisplay = getComputedStyle(fab).display || 'flex';
      }
      fab.style.display = modalOpen ? 'none' : '';
    });
  }

  function observeModal(el) {
    if (el.__jnpModalObs) return;
    el.__jnpModalObs = true;
    const wasOpen = el.classList.contains('open');
    if (wasOpen) onModalOpened(el);
    const obs = new MutationObserver(() => {
      const isOpen = el.classList.contains('open');
      if (isOpen) onModalOpened(el);
      else if (el.style.zIndex) onModalClosed(el);
    });
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
  }

  function scanAll() {
    document.querySelectorAll('.modal-backdrop').forEach(observeModal);
  }

  function init() {
    scanAll();
    // Watch for dynamically-added backdrops (e.g. calendar-pro creates its editor)
    const rootObs = new MutationObserver(muts => {
      let needRescan = false;
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          if (n.classList?.contains('modal-backdrop')) { observeModal(n); needRescan = false; }
          if (n.querySelectorAll) n.querySelectorAll('.modal-backdrop').forEach(observeModal);
        }
      }
    });
    rootObs.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
