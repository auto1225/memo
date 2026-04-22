/**
 * JustANotepad · Image Converter UX Upgrades (v1.0)
 * --------------------------------------------------------------------------
 * 기존 #imgCvtModal (이미지 변환기) 를 후처리해서:
 *   1. 블로킹 모달 → 드래그 가능한 floating 패널로 변환
 *      (backdrop 제거, .modal 에 position:fixed + drag)
 *   2. 우하단 리사이즈 핸들
 *   3. 미리보기 확대/축소 (+ / − / 100% / Ctrl+휠)
 *   4. 최근 저장 위치 힌트 기록
 *
 * 기존 app.html 은 손대지 않고 런타임에 DOM + 이벤트만 덧붙임.
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.__janImgCvtUpgrades__) return;
  window.__janImgCvtUpgrades__ = true;

  // ---- 스타일 주입 --------------------------------------------------------
  const CSS = `
  /* Non-blocking: backdrop 투명 + pointer-events pass-through */
  #imgCvtModal.modal-backdrop.open.jnp-nonblocking {
    background: transparent !important;
    pointer-events: none !important;   /* 백드롭이 뒷 앱 클릭 가로채지 않음 */
    display: block !important;         /* flex 중앙정렬 해제, 자유 위치 */
  }
  #imgCvtModal.modal-backdrop.jnp-nonblocking .modal {
    pointer-events: auto !important;   /* 본체는 정상 조작 */
    position: fixed !important;
    top: var(--ic-top, 60px);
    left: var(--ic-left, 40%);
    width: var(--ic-w, min(980px, 96vw)) !important;
    height: var(--ic-h, min(720px, 90vh)) !important;
    max-height: none !important;
    box-shadow: 0 20px 60px rgba(0,0,0,.28), 0 0 0 1px rgba(0,0,0,.06) !important;
    cursor: default;
  }
  #imgCvtModal.jnp-nonblocking .modal > div:first-child {
    cursor: move;
    user-select: none;
  }
  /* 우하단 리사이즈 핸들 */
  .jnp-ic-resize {
    position: absolute;
    right: 2px; bottom: 2px;
    width: 16px; height: 16px;
    cursor: nwse-resize;
    background: linear-gradient(135deg, transparent 50%, var(--ink-soft,#aaa) 50%, var(--ink-soft,#aaa) 60%, transparent 60%, transparent 72%, var(--ink-soft,#aaa) 72%, var(--ink-soft,#aaa) 82%, transparent 82%);
    opacity: .5;
  }
  .jnp-ic-resize:hover { opacity: .9; }
  /* 줌 컨트롤 */
  .jnp-ic-zoom {
    display: inline-flex; align-items: center; gap: 4px;
    margin-left: 8px;
    font-size: 11px;
    color: var(--ink-soft);
  }
  .jnp-ic-zoom button {
    padding: 2px 8px; border: 1px solid var(--paper-edge);
    background: white; border-radius: 4px; cursor: pointer;
    font-size: 11px; color: var(--ink);
  }
  .jnp-ic-zoom button:hover { background: #f3ebff; border-color: var(--accent); color: var(--accent); }
  .jnp-ic-zoom .val { min-width: 42px; text-align: center; font-weight: 600; }
  /* 미리보기 줌 적용 */
  #imgCvtPreview.jnp-zoomed { transition: transform .08s ease; transform-origin: center center; }
  /* 드롭 영역이 scroll 가능하도록 */
  #imgCvtDrop { overflow: auto !important; }
  `;
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);

  // ---- 초기화 (DOM 준비 후 1회) -------------------------------------------
  function init() {
    const modal = document.getElementById('imgCvtModal');
    if (!modal) return;
    if (modal.dataset.jnpUpgraded) return;
    modal.dataset.jnpUpgraded = '1';

    modal.classList.add('jnp-nonblocking');

    const box = modal.querySelector('.modal');
    const header = box ? box.firstElementChild : null;
    if (!box || !header) return;

    // ---- 드래그 이동 ----
    let dragging = false, offX = 0, offY = 0;
    header.addEventListener('mousedown', (e) => {
      // 버튼 클릭은 드래그 아님
      if (e.target.closest('button,input,select,a')) return;
      dragging = true;
      const rect = box.getBoundingClientRect();
      offX = e.clientX - rect.left;
      offY = e.clientY - rect.top;
      document.body.style.userSelect = 'none';
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const x = Math.max(0, Math.min(window.innerWidth - 100, e.clientX - offX));
      const y = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - offY));
      box.style.setProperty('--ic-left', x + 'px');
      box.style.setProperty('--ic-top', y + 'px');
    });
    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = '';
      // 위치 기억
      try {
        localStorage.setItem('jan.ic.pos', JSON.stringify({
          left: box.style.getPropertyValue('--ic-left'),
          top: box.style.getPropertyValue('--ic-top'),
        }));
      } catch {}
    });

    // 저장된 위치 복원
    try {
      const saved = JSON.parse(localStorage.getItem('jan.ic.pos') || 'null');
      if (saved?.left) box.style.setProperty('--ic-left', saved.left);
      if (saved?.top) box.style.setProperty('--ic-top', saved.top);
    } catch {}

    // ---- 우하단 리사이즈 핸들 ----
    const grip = document.createElement('div');
    grip.className = 'jnp-ic-resize';
    grip.title = '크기 조절 (드래그)';
    box.appendChild(grip);
    let resizing = false, startX = 0, startY = 0, startW = 0, startH = 0;
    grip.addEventListener('mousedown', (e) => {
      e.preventDefault();
      resizing = true;
      const rect = box.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY;
      startW = rect.width; startH = rect.height;
      document.body.style.userSelect = 'none';
    });
    window.addEventListener('mousemove', (e) => {
      if (!resizing) return;
      const w = Math.max(480, startW + (e.clientX - startX));
      const h = Math.max(400, startH + (e.clientY - startY));
      box.style.setProperty('--ic-w', w + 'px');
      box.style.setProperty('--ic-h', h + 'px');
    });
    window.addEventListener('mouseup', () => {
      if (!resizing) return;
      resizing = false;
      document.body.style.userSelect = '';
      try {
        localStorage.setItem('jan.ic.size', JSON.stringify({
          w: box.style.getPropertyValue('--ic-w'),
          h: box.style.getPropertyValue('--ic-h'),
        }));
      } catch {}
    });
    try {
      const saved = JSON.parse(localStorage.getItem('jan.ic.size') || 'null');
      if (saved?.w) box.style.setProperty('--ic-w', saved.w);
      if (saved?.h) box.style.setProperty('--ic-h', saved.h);
    } catch {}

    // ---- 미리보기 확대/축소 ----
    const preview = document.getElementById('imgCvtPreview');
    if (preview) {
      preview.classList.add('jnp-zoomed');
      let zoom = 1;
      const applyZoom = () => {
        preview.style.transform = `scale(${zoom})`;
        if (zoomVal) zoomVal.textContent = Math.round(zoom * 100) + '%';
      };
      const setZoom = (z) => {
        zoom = Math.max(0.1, Math.min(8, z));
        applyZoom();
      };

      // 헤더에 줌 컨트롤 삽입
      const zoomWrap = document.createElement('span');
      zoomWrap.className = 'jnp-ic-zoom';
      zoomWrap.innerHTML = `
        <span title="확대/축소">🔍</span>
        <button class="jnp-z-out" title="축소 (Ctrl+-)">−</button>
        <span class="val">100%</span>
        <button class="jnp-z-in" title="확대 (Ctrl++)">+</button>
        <button class="jnp-z-fit" title="원본 크기(100%)">100%</button>
      `;
      // 기존 "크기 · 용량 · 포맷 조정" 스팬 옆에 삽입
      const spacer = header.querySelector('span[style*="flex:1"]');
      if (spacer) header.insertBefore(zoomWrap, spacer);
      else header.appendChild(zoomWrap);

      const zoomVal = zoomWrap.querySelector('.val');
      zoomWrap.querySelector('.jnp-z-in').addEventListener('click', () => setZoom(zoom * 1.25));
      zoomWrap.querySelector('.jnp-z-out').addEventListener('click', () => setZoom(zoom / 1.25));
      zoomWrap.querySelector('.jnp-z-fit').addEventListener('click', () => setZoom(1));

      // Ctrl + wheel on preview → zoom
      const dropArea = document.getElementById('imgCvtDrop');
      const wheelTarget = dropArea || preview;
      wheelTarget.addEventListener('wheel', (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        if (preview.style.display === 'none') return;
        e.preventDefault();
        const d = e.deltaY > 0 ? 1/1.1 : 1.1;
        setZoom(zoom * d);
      }, { passive: false });

      // Ctrl + = / − 단축키 (모달 열려있을 때만)
      document.addEventListener('keydown', (e) => {
        if (!modal.classList.contains('open')) return;
        if (!(e.ctrlKey || e.metaKey)) return;
        if (e.key === '=' || e.key === '+') { e.preventDefault(); setZoom(zoom * 1.25); }
        else if (e.key === '-') { e.preventDefault(); setZoom(zoom / 1.25); }
        else if (e.key === '0') { e.preventDefault(); setZoom(1); }
      });

      applyZoom();
    }

    console.info('[img-cvt-upgrades] applied');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
