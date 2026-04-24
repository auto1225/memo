/* paged-preview.js — v1
 * Paged.js 기반 인쇄 미리보기 (W3C CSS Paged Media 표준).
 *
 * 핵심 아이디어:
 *   - 편집 화면은 현재 contenteditable 그대로 (영향 0)
 *   - 사용자가 "인쇄 미리보기" 클릭 시 → iframe 에 콘텐츠 복제
 *   - iframe 안에서 paged.polyfill.js 가 자동 실행 → 픽셀 퍼펙트 페이지 분할
 *   - 미리보기 + 인쇄 버튼 + PDF 저장
 *
 * 장점:
 *   - 편집 화면 깨지지 않음 (Paged.js 는 별도 iframe 에서만 동작)
 *   - W3C 표준 (@page, break-after, counter(page) 등 완벽 지원)
 *   - 픽셀 퍼펙트 페이지 분할 (책·논문 출판 업계에서 검증됨)
 *
 * 공개 API:
 *   window.JANPagedPreview = { open, close }
 */
(function () {
  'use strict';

  const PAGED_CDN = 'https://unpkg.com/pagedjs/dist/paged.polyfill.js';

  function notify (msg) {
    try { if (typeof window.toast === 'function') window.toast(msg); } catch {}
  }

  function getPageEl () {
    return document.getElementById('page');
  }

  /* 메인 진입점 — 인쇄 미리보기 모달 열기 */
  function open () {
    const page = getPageEl();
    if (!page) return notify('편집 영역을 찾을 수 없습니다');
    const contentHtml = page.innerHTML;
    if (!contentHtml.trim()) return notify('미리볼 콘텐츠가 없습니다');

    /* 페이지 크기 가져오기 */
    const computed = getComputedStyle(page);
    let pageWmm = parseFloat(computed.getPropertyValue('--page-w')) || 210;
    let pageHmm = parseFloat(computed.getPropertyValue('--page-h')) || 297;
    let pageMargin = parseFloat(computed.getPropertyValue('--page-margin')) || 20;
    /* CSS variable 단위가 mm 라고 가정 (paper-features 의 PAGE_SIZES 정의) */
    const pageSizeName = (() => {
      if (Math.abs(pageWmm - 210) < 1 && Math.abs(pageHmm - 297) < 1) return 'A4 portrait';
      if (Math.abs(pageWmm - 297) < 1 && Math.abs(pageHmm - 210) < 1) return 'A4 landscape';
      if (Math.abs(pageWmm - 297) < 1 && Math.abs(pageHmm - 420) < 1) return 'A3 portrait';
      if (Math.abs(pageWmm - 420) < 1 && Math.abs(pageHmm - 297) < 1) return 'A3 landscape';
      if (Math.abs(pageWmm - 250) < 1 && Math.abs(pageHmm - 353) < 1) return 'B4 portrait';
      if (Math.abs(pageWmm - 353) < 1 && Math.abs(pageHmm - 250) < 1) return 'B4 landscape';
      return pageWmm + 'mm ' + pageHmm + 'mm';
    })();

    /* 기존 미리보기 있으면 닫기 */
    close();

    /* 모달 컨테이너 생성 */
    const modal = document.createElement('div');
    modal.id = 'jan-paged-preview-modal';
    modal.style.cssText =
      'position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.6); ' +
      'display:flex; flex-direction:column; align-items:stretch;';
    modal.innerHTML =
      '<div id="jan-paged-preview-toolbar" style="' +
        'background:#fff; padding:10px 16px; border-bottom:1px solid #ddd; ' +
        'display:flex; align-items:center; gap:12px; flex-shrink:0;">' +
        '<span style="font-size:14px; font-weight:700; color:#8B4513;">' +
          '인쇄 미리보기 — ' + pageSizeName + '</span>' +
        '<span id="jan-paged-status" style="font-size:12px; color:#888;">페이지 분할 중…</span>' +
        '<div style="flex:1;"></div>' +
        '<button id="jan-paged-print-btn" style="' +
          'padding:6px 14px; background:#D97757; color:#fff; border:none; ' +
          'border-radius:6px; cursor:pointer; font-size:13px; font-weight:600;">' +
          '인쇄 / PDF</button>' +
        '<button id="jan-paged-close-btn" style="' +
          'padding:6px 14px; background:#f5f5f5; color:#444; border:1px solid #ddd; ' +
          'border-radius:6px; cursor:pointer; font-size:13px;">닫기</button>' +
      '</div>' +
      '<iframe id="jan-paged-preview-iframe" style="' +
        'flex:1; width:100%; border:none; background:#e8e8e8;"></iframe>';
    document.body.appendChild(modal);

    /* 닫기 버튼 */
    document.getElementById('jan-paged-close-btn').addEventListener('click', close);
    /* 인쇄 버튼 — iframe 내부에서 print() */
    document.getElementById('jan-paged-print-btn').addEventListener('click', () => {
      const iframe = document.getElementById('jan-paged-preview-iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }
    });
    /* ESC 닫기 */
    document.addEventListener('keydown', escHandler);

    /* iframe 콘텐츠 작성 */
    const iframe = document.getElementById('jan-paged-preview-iframe');
    const html = buildPreviewHtml(contentHtml, pageWmm, pageHmm, pageMargin, pageSizeName);
    /* srcdoc 으로 동기 작성 — Paged.js 자동 실행 */
    iframe.srcdoc = html;

    /* 로딩 표시 */
    iframe.addEventListener('load', () => {
      /* Paged.js 가 끝나면 .pagedjs_pages 가 생성됨 — 폴링으로 감지 */
      const status = document.getElementById('jan-paged-status');
      let waited = 0;
      const t = setInterval(() => {
        waited += 200;
        try {
          const doc = iframe.contentDocument;
          const pages = doc.querySelectorAll('.pagedjs_page');
          if (pages.length > 0) {
            clearInterval(t);
            if (status) status.textContent = pages.length + ' 페이지 — 인쇄 / PDF 저장 가능';
          }
        } catch {}
        if (waited > 15000) {  /* 15초 후에도 안 끝나면 안내 */
          clearInterval(t);
          if (status) status.textContent = '준비 완료 (Paged.js 가 늦게 응답하면 새로고침 필요)';
        }
      }, 200);
    });
    notify('인쇄 미리보기 로드 중…');
  }

  function close () {
    const m = document.getElementById('jan-paged-preview-modal');
    if (m) m.remove();
    document.removeEventListener('keydown', escHandler);
  }
  function escHandler (e) { if (e.key === 'Escape') close(); }

  /* iframe 내부에 들어갈 완전한 HTML 문서 빌드 */
  function buildPreviewHtml (contentHtml, pageWmm, pageHmm, pageMargin, sizeName) {
    /* 본 화면의 핵심 CSS 를 일부 재사용 (글꼴·제목 스타일).
       앱의 CSS 전체 인라인하기 어려우므로 최소 print-friendly 스타일 + Paged.js @page 규칙. */
    const escSize = (sizeName || 'A4 portrait').replace(/"/g, '');
    return '<!DOCTYPE html>' +
      '<html lang="ko"><head><meta charset="UTF-8">' +
      '<title>인쇄 미리보기</title>' +
      '<style>' +
        '@page {' +
          ' size: ' + escSize + ';' +
          ' margin: ' + pageMargin + 'mm;' +
          ' @top-right { content: "Page " counter(page) " / " counter(pages); font-size:9pt; color:#888; }' +
        '}' +
        'html, body { margin:0; padding:0; }' +
        'body { font-family: "Noto Sans KR", "맑은 고딕", "Malgun Gothic", -apple-system, sans-serif; ' +
          ' font-size: 11pt; line-height: 1.65; color: #222; background: #ccc; }' +
        '.pagedjs_pages { background: #ccc; }' +
        '.pagedjs_page { margin: 16px auto !important; box-shadow: 0 4px 16px rgba(0,0,0,0.18); background:#fff; }' +
        /* 제목 */
        'h1 { font-size: 22pt; font-weight: 700; margin: 1em 0 0.5em; }' +
        'h2 { font-size: 17pt; font-weight: 700; margin: 1em 0 0.4em; }' +
        'h3 { font-size: 14pt; font-weight: 600; margin: 0.8em 0 0.3em; }' +
        /* 본문 */
        'p { margin: 0.5em 0; text-align: justify; }' +
        /* 표 */
        'table { border-collapse: collapse; margin: 0.6em 0; width: 100%; }' +
        'th, td { border: 1px solid #999; padding: 4px 8px; }' +
        'th { background: #f0f0f0; font-weight: 600; }' +
        /* 코드 */
        'pre, code { font-family: "Consolas", "D2Coding", monospace; background: #f5f5f5; padding: 0 4px; border-radius: 3px; }' +
        'pre { padding: 8px 12px; overflow-x: auto; }' +
        /* 인용문 */
        'blockquote { border-left: 3px solid #D97757; padding: 4px 12px; margin: 0.6em 0; color: #555; background: rgba(217,119,87,0.05); }' +
        /* 이미지 */
        'img { max-width: 100%; height: auto; }' +
        /* 페이지 구분 (jan-page-break) — 강제 새 페이지 */
        '.jan-page-break, .jan-page-divider { display: block; page-break-before: always; break-before: page; height: 0; visibility: hidden; }' +
        /* 페이지 wrapper (.jan-doc-page) — Paged.js 가 다시 분할 */
        '.jan-doc-page { box-shadow: none !important; margin: 0 !important; padding: 0 !important; min-height: 0 !important; background: transparent !important; border: none !important; }' +
        '.jan-doc-page::before { display: none !important; }' +
        /* 책갈피 강조 제거 (인쇄용) */
        '.jan-bookmark { background: none !important; border: 0 !important; padding: 0 !important; }' +
        /* 인쇄 시 본문만 */
        '@media print {' +
          ' body { background: white; }' +
          ' .pagedjs_page { box-shadow: none !important; margin: 0 !important; }' +
        '}' +
      '</style>' +
      '</head><body>' +
        '<div id="jan-content">' + contentHtml + '</div>' +
        '<script src="' + PAGED_CDN + '"><' + '/script>' +
      '</body></html>';
  }

  /* 공개 API */
  window.JANPagedPreview = {
    open: open,
    close: close
  };

  /* 명령 팔레트 등록 — 대기 후 시도 */
  function registerCommand () {
    if (!window.JAN_COMMANDS) return false;
    const exists = window.JAN_COMMANDS.some(c => c.name === '인쇄 미리보기 (Paged.js)');
    if (exists) return true;
    window.JAN_COMMANDS.push({
      ico: 'i-printer', name: '인쇄 미리보기 (Paged.js)',
      desc: '정확한 페이지 분할로 인쇄/PDF 저장',
      run: open
    });
    return true;
  }
  let _retry = 0;
  const _t = setInterval(() => {
    if (registerCommand() || ++_retry > 20) clearInterval(_t);
  }, 500);
})();
