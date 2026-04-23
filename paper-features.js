/* ============================================================
   paper-features.js — 논문 작성 기능 팩 (v13)
   v13: 논문 서브 모달 5종 전면 재디자인.
        - openPaperHelp: 표 → 카드 섹션 + kbd + code 태그.
        - insertAuthorsBlock / insertKeywordsBlock /
          configureHeaderFooter / insertAcknowledgments:
          브라우저 기본 prompt() → 공용 커스텀 폼 모달
          (paperPromptForm) 교체. 힌트·placeholder·기본값 유지.
        - 명칭 통일: "논문 요소" → "논문"
   v11: 툴바에 "논문" 드롭다운 메뉴 추가 (paperMenuBtn2 + paperMenuDrop).
        빠른 시작 · 구성 요소 · 레이아웃 · 참조 & 인용 4섹션 16항목.
        구형 paperMenuBtn 은 숨김 유지 (호환용).
   v10: 원자 기능 8종 (atoms.*) + convertToSciencePaper 템플릿 마법사
        로 재레이블. CSS 보강: jan-two-col, jan-authors, jan-affil,
        jan-corresponding, jan-abstract, jan-keywords, jan-toc, jan-ack
   v9 : (이전 릴리스)
   ------------------------------------------------------------
   JustANotepad 에 논문 작성에 필요한 4개 기능을 추가:

     1. 자동 번호 카운터 (수식·그림·표)
        - figure.jan-math 에 (n) 자동 번호
        - figure.jan-fig (또는 figure:has(>img)) 에 "Figure N." 접두어
        - table caption 에 "Table N." 접두어
        - counter 네임스페이스 분리: eq / fig / tbl

     2. 각주 시스템
        - 본문 커서에 <sup class='jan-fn-ref'> 삽입
        - 문서 끝 .jan-footnotes ol 에 텍스트
        - 클릭 시 ref ↔ 각주 스크롤 이동
        - 번호 자동 재정렬 (삭제 시 뒤로 당겨짐)

     3. 참고문헌 / 인용 (IEEE 스타일)
        - "참고문헌 항목 추가"
        - "인용 삽입" — 팝업에서 기존 항목 선택 → [N] 링크
        - 항목 순서/추가 시 번호·본문 인용 자동 재정렬

     4. 페이지 UI (가상 페이지)
        - 페이지 구분 삽입 (.jan-page-break)
        - 점선 시각화, @media print 에서 page-break-after
        - 페이지 번호 CSS counter (print 시)
        - .jan-header / .jan-footer 스타일

   공개 API: window.JANPaper = {
     insertFootnote, renumberFootnotes,
     addBibEntry, openBibManager, insertCitation, renumberCitations,
     insertPageBreak,
     refreshNumbering
   }
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 유틸 ---------- */
  function notify(msg) {
    try { if (typeof window.toast === 'function') window.toast(msg); }
    catch { console.log('[JANPaper]', msg); }
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function uuid() {
    return 'fn-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
  function getPageEl() {
    return document.getElementById('page')
      || document.querySelector('[contenteditable="true"]');
  }
  function scheduleSave() {
    try { if (typeof window.scheduleSave === 'function') window.scheduleSave(); } catch {}
  }
  function restorePageSel() {
    try { if (typeof window.restorePageSel === 'function') window.restorePageSel(); } catch {}
  }

  /* ---------- 되돌리기 스택 (자체 스냅샷) ----------
     convertToSciencePaper · loadPaperSample · bio-append 같이
     page.innerHTML 을 통째로 바꾸는 파괴적 연산 직전에 push.
     Ctrl+Z 또는 paper.undo 명령으로 복원.
     시간 제한 없음 — 스택에 남아있는 한 언제든 되돌림. 최대 10단계. */
  const _paperUndoStack = [];
  const PAPER_UNDO_MAX = 10;

  function pushPaperUndo(label) {
    try {
      const page = getPageEl();
      if (!page) return;
      _paperUndoStack.push({
        html: page.innerHTML,
        label: label || 'paper-op',
        ts: Date.now()
      });
      // 스택 크기 제한 (10개 초과 시 가장 오래된 것 버림)
      while (_paperUndoStack.length > PAPER_UNDO_MAX) _paperUndoStack.shift();
    } catch (e) { console.warn('[JANPaper] pushPaperUndo 실패', e); }
  }

  function paperUndo() {
    const page = getPageEl();
    if (!page) { notify('편집 영역을 찾을 수 없습니다'); return false; }
    if (!_paperUndoStack.length) {
      notify('되돌릴 변환 작업이 없습니다');
      return false;
    }
    const snap = _paperUndoStack.pop();
    try {
      page.innerHTML = snap.html;
      // 되돌린 후 번호·렌더 재적용
      try { refreshNumbering(); } catch (e) {}
      try { renumberFootnotes(); } catch (e) {}
      try { renumberCitations(); } catch (e) {}
      try {
        if (typeof renderAllPaperFigures === 'function') {
          // 비동기지만 기다리지 않아도 괜찮음 (점진 렌더)
          renderAllPaperFigures(page).catch(() => {});
        }
      } catch (e) {}
      try { if (typeof window.scheduleSave === 'function') window.scheduleSave(); } catch (e) {}
      notify('변환 전으로 복원됨 (' + (snap.label || 'paper') + ')');
      return true;
    } catch (e) {
      console.warn('[JANPaper] paperUndo 실패', e);
      notify('복원 실패');
      return false;
    }
  }

  function showUndoToast(msg) {
    try {
      const old = document.getElementById('jan-paper-undo-toast');
      if (old) old.remove();
      const el = document.createElement('div');
      el.id = 'jan-paper-undo-toast';
      el.style.cssText =
        'position:fixed; bottom:20px; left:50%; transform:translateX(-50%); ' +
        'background:#333; color:#fff; padding:10px 16px; border-radius:8px; ' +
        'display:flex; gap:12px; align-items:center; z-index:99999; ' +
        'font-size:13px; box-shadow:0 4px 16px rgba(0,0,0,0.25);';
      const span = document.createElement('span');
      span.textContent = msg;
      const undoBtn = document.createElement('button');
      undoBtn.type = 'button';
      undoBtn.textContent = '되돌리기';
      undoBtn.style.cssText =
        'background:#B23A4C; color:#fff; border:0; padding:4px 10px; ' +
        'border-radius:4px; cursor:pointer; font-weight:600; font-family:inherit; font-size:12px;';
      undoBtn.addEventListener('click', () => { paperUndo(); el.remove(); });
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', '닫기');
      closeBtn.textContent = '×';
      closeBtn.style.cssText =
        'background:none; border:0; color:#ccc; cursor:pointer; font-size:18px; line-height:1; padding:0 2px;';
      closeBtn.addEventListener('click', () => el.remove());
      el.appendChild(span);
      el.appendChild(undoBtn);
      el.appendChild(closeBtn);
      document.body.appendChild(el);
      setTimeout(() => { if (el.isConnected) el.remove(); }, 8000);
    } catch (e) { console.warn('[JANPaper] showUndoToast 실패', e); }
  }

  /* 전역 Ctrl+Z 후킹 — 최근 30초 이내 논문 변환이 있었다면
     Ctrl+Z 가 그것을 되돌린다. 이후부터는 브라우저 기본 undo 위임. */
  (function installPaperUndoHotkey() {
    document.addEventListener('keydown', function (ev) {
      if (!((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && !ev.altKey)) return;
      if (ev.key !== 'z' && ev.key !== 'Z') return;
      if (!_paperUndoStack.length) return;
      // 시간 제한 없음 — 스택에 스냅샷이 있으면 언제나 되돌림 (최대 10단계)
      ev.preventDefault();
      ev.stopPropagation();
      paperUndo();
    }, true);
  })();

  /* ---------- 1. 전역 CSS 주입 (한 번만) ---------- */
  (function injectCss() {
    if (document.getElementById('jan-paper-css')) return;
    const css = document.createElement('style');
    css.id = 'jan-paper-css';
    css.textContent = `
      /* ===== 기능 1: 자동 번호 카운터 ===== */
      /* page 전체에서 eq/fig/tbl 카운터 초기화 */
      .page {
        counter-reset: jan-eq jan-fig jan-tbl;
      }
      /* 수식 figure: (n) 번호, 블록 모드(캡션 위)에서만 표시.
         인라인 수식(.jan-math-inline) 은 번호 없음. */
      .page figure.jan-math.jan-numbered {
        counter-increment: jan-eq;
        display: flex !important;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin: 10px auto !important;
      }
      .page figure.jan-math.jan-numbered::after {
        content: "(" counter(jan-eq) ")";
        font-family: 'Times New Roman', 'Noto Serif KR', serif;
        font-size: 0.95em;
        color: #555;
        font-style: normal;
        min-width: 2.4em;
        text-align: right;
      }
      /* 그림 figure: "Figure N." 접두어 (figcaption 앞) */
      .page figure.jan-fig {
        counter-increment: jan-fig;
        margin: 14px auto;
        text-align: center;
        max-width: 100%;
      }
      .page figure.jan-fig > img,
      .page figure.jan-fig > svg,
      .page figure.jan-fig > canvas {
        max-width: 100%;
        height: auto;
        display: block;
        margin: 0 auto;
      }
      .page figure.jan-fig > figcaption {
        font-size: 12px;
        color: #555;
        margin-top: 6px;
        font-style: italic;
      }
      .page figure.jan-fig > figcaption::before {
        content: "Figure " counter(jan-fig) ". ";
        font-weight: 700;
        font-style: normal;
        color: #333;
      }
      /* 표: caption 에 "Table N." */
      .page table {
        counter-increment: jan-tbl;
      }
      .page table > caption {
        caption-side: top;
        font-size: 12px;
        color: #555;
        margin-bottom: 4px;
        font-style: italic;
        text-align: left;
      }
      .page table > caption::before {
        content: "Table " counter(jan-tbl) ". ";
        font-weight: 700;
        font-style: normal;
        color: #333;
      }

      /* ===== 기능 2: 각주 (footnotes) ===== */
      .page .jan-fn-ref {
        color: #B23A4C;
        cursor: pointer;
        font-size: 0.8em;
        vertical-align: super;
        line-height: 1;
        padding: 0 1px;
        border-radius: 2px;
        text-decoration: none;
        user-select: none;
      }
      .page .jan-fn-ref:hover {
        background: rgba(217, 119, 87, 0.15);
      }
      .page .jan-fn-ref.jan-fn-target {
        background: rgba(217, 119, 87, 0.35);
        transition: background 300ms ease;
      }
      .page .jan-footnotes {
        margin-top: 24px;
        padding-top: 10px;
        border-top: 1px solid rgba(0,0,0,0.15);
        font-size: 12px;
        color: #444;
      }
      .page .jan-footnotes::before {
        content: "각주";
        display: block;
        font-weight: 700;
        color: #333;
        font-size: 11px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        margin-bottom: 6px;
      }
      .page .jan-footnotes > ol {
        padding-left: 22px;
        margin: 0;
      }
      .page .jan-footnotes > ol > li {
        margin-bottom: 4px;
        line-height: 1.5;
      }
      .page .jan-footnotes > ol > li.jan-fn-target {
        background: rgba(217, 119, 87, 0.18);
        transition: background 300ms ease;
      }

      /* ===== 기능 3: 참고문헌 / 인용 (IEEE 스타일) ===== */
      .page .jan-cite {
        color: #1f4fa8;
        cursor: pointer;
        text-decoration: none;
        font-size: 0.92em;
        padding: 0 1px;
      }
      .page .jan-cite:hover {
        background: rgba(31, 79, 168, 0.12);
        border-radius: 2px;
      }
      .page .jan-bibliography {
        margin-top: 28px;
        padding-top: 12px;
        border-top: 1px solid rgba(0,0,0,0.2);
        font-size: 13px;
        color: #333;
      }
      .page .jan-bibliography::before {
        content: "참고문헌";
        display: block;
        font-weight: 700;
        font-size: 14px;
        color: #222;
        margin-bottom: 8px;
        letter-spacing: 0.02em;
      }
      .page .jan-bibliography > ol {
        list-style: none;
        counter-reset: jan-bib;
        padding-left: 0;
        margin: 0;
      }
      .page .jan-bibliography > ol > li {
        counter-increment: jan-bib;
        position: relative;
        padding-left: 32px;
        margin-bottom: 6px;
        line-height: 1.55;
      }
      .page .jan-bibliography > ol > li::before {
        content: "[" counter(jan-bib) "]";
        position: absolute;
        left: 0;
        top: 0;
        font-weight: 600;
        color: #555;
      }
      .page .jan-bibliography > ol > li.jan-fn-target {
        background: rgba(31, 79, 168, 0.12);
        transition: background 300ms ease;
      }

      /* ===== 기능 4: 페이지 구분 ===== */
      .page .jan-page-break {
        margin: 22px 0;
        padding: 8px 12px;
        border-top: 1px dashed rgba(178, 58, 76, 0.45);
        border-bottom: 1px dashed rgba(178, 58, 76, 0.45);
        text-align: center;
        font-size: 10.5px;
        color: #B23A4C;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        user-select: none;
        background: rgba(255, 224, 236, 0.25);
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      .page .jan-header,
      .page .jan-footer {
        font-size: 11px;
        color: #666;
        padding: 4px 8px;
        border-bottom: 1px solid rgba(0,0,0,0.08);
        margin-bottom: 8px;
        font-style: italic;
      }
      .page .jan-footer {
        border-bottom: 0;
        border-top: 1px solid rgba(0,0,0,0.08);
        margin-top: 14px;
        margin-bottom: 0;
        padding-top: 6px;
      }

      /* ===== @print — 진짜 페이지 분할 =====
         앱 컨테이너들(.pad, .page-container, .page-wrap, .page) 이 기본적으로
         fixed/scroll 로 1 뷰포트만 보이게 하므로, 인쇄 시에는 이를 모두
         static + overflow visible 로 풀어 .jan-page 가 각자 한 장씩 분리되도록.
         app.html 에도 기본 @media print 이 있지만 .page-wrap 을 놓쳐
         내용이 잘리는 문제가 있었음 → 여기서 보강. */
      @media print {
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
          height: auto !important;
          max-height: none !important;
          background: #fff !important;
        }
        /* 앱 전반의 스크롤/오버플로우/크기 제한 해제. position:fixed 인
           .pad 도 static 으로. 이러면 내부 .jan-page 가 인쇄 흐름에 참여. */
        body, .pad, #pad,
        .page-container, .page-wrap, .page, #page,
        .note-area, .editor, .editor-wrap,
        main, section.page, article {
          position: static !important;
          overflow: visible !important;
          max-height: none !important;
          height: auto !important;
          min-height: 0 !important;
          width: auto !important;
          transform: none !important;
        }
        /* 논문 샘플과 무관한 앱 UI 숨김 — 툴바·탭·검색바·모달·토스트 등 */
        .topbar, .tabs, .toolbar, .searchbar, .statusbar, .sidebar,
        .floating-toolbar, .tool-group, .modal-backdrop, .modal, .toast,
        .split-close, .toc-panel, [id*="onboard"], #jan-paper-onboarding,
        .popover, .menu-dropdown {
          display: none !important;
        }
        /* 편집 영역 자체의 padding / 배경 제거 */
        .page, #page {
          padding: 0 !important;
          margin: 0 !important;
          box-shadow: none !important;
          background: none !important;
          background-image: none !important;
          border: 0 !important;
        }
        /* 논문 컨테이너 자체도 box-shadow / margin 제거 */
        .jan-paper {
          margin: 0 !important;
          padding: 0 !important;
          box-shadow: none !important;
          background: #fff !important;
          gap: 0 !important;
          display: block !important;
        }
        /* 각 .jan-page 가 A4 한 장씩 분리되도록 강제. 높이를 A4 로 고정해
           내부 콘텐츠가 넘쳐도 한 장에 담기도록 overflow:hidden. */
        .jan-paper .jan-page,
        .jan-page {
          width: 210mm !important;
          height: 297mm !important;
          min-height: 297mm !important;
          max-height: 297mm !important;
          overflow: hidden !important;
          page-break-after: always !important;
          break-after: page !important;
          page-break-inside: avoid !important;
          break-inside: avoid-page !important;
          box-shadow: none !important;
          margin: 0 !important;
          display: block !important;
        }
        .jan-paper .jan-page:last-child,
        .jan-page:last-child {
          page-break-after: auto !important;
          break-after: auto !important;
        }
        /* 수동 페이지 구분도 유지 */
        .page .jan-page-break {
          border: 0 !important;
          background: transparent !important;
          color: transparent !important;
          height: 0;
          margin: 0;
          padding: 0;
          page-break-after: always;
          break-after: page;
        }
        @page {
          size: A4;
          margin: 0;
        }
      }

      /* ===== v10: 원자 기능용 스타일 ===== */
      /* 2단 레이아웃 — 수동 래퍼 */
      .page .jan-two-col {
        column-count: 2;
        column-gap: 7mm;
        column-rule: 1px solid rgba(0,0,0,0.06);
      }
      .page .jan-two-col > * { break-inside: avoid-column; }

      /* 저자 · 소속 · 교신 */
      .page .jan-authors {
        text-align: center;
        font-size: 14px;
        font-weight: 600;
        margin: 6px 0 2px;
        line-height: 1.5;
      }
      .page .jan-authors sup {
        font-weight: 400;
        color: #555;
        font-size: 0.75em;
      }
      .page .jan-affil {
        text-align: center;
        font-size: 11.5px;
        color: #555;
        font-style: italic;
        margin: 0 0 4px;
        line-height: 1.45;
      }
      .page .jan-corresponding {
        text-align: center;
        font-size: 11.5px;
        color: #666;
        margin: 0 0 10px;
      }
      .page .jan-corresponding code {
        background: #f3f4f6;
        padding: 1px 5px;
        border-radius: 3px;
        font-family: ui-monospace, SFMono-Regular, monospace;
        font-size: 0.95em;
      }

      /* Abstract 박스 */
      .page .jan-abstract {
        background: #f7f8fa;
        border-left: 3px solid #1a4b8c;
        padding: 10px 14px;
        margin: 10px 0;
        font-size: 12.5px;
        line-height: 1.6;
        color: #222;
      }
      .page .jan-abstract strong {
        display: inline-block;
        color: #1a4b8c;
        font-weight: 700;
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        margin-right: 6px;
      }
      .page .jan-abstract > p { margin: 4px 0 0; }

      /* Keywords */
      .page .jan-keywords {
        font-size: 12px;
        color: #333;
        margin: 6px 0 10px;
        line-height: 1.55;
      }
      .page .jan-keywords strong {
        color: #1a4b8c;
        font-weight: 700;
        margin-right: 4px;
      }

      /* TOC (목차) */
      .page .jan-toc {
        background: #fafbfc;
        border: 1px solid rgba(0,0,0,0.08);
        border-radius: 6px;
        padding: 10px 14px;
        margin: 10px 0 14px;
        font-size: 12px;
        line-height: 1.65;
      }
      .page .jan-toc > h4 {
        font-weight: 700;
        font-size: 11px;
        letter-spacing: 0.1em;
        color: #1a4b8c;
        margin: 0 0 4px;
        text-transform: uppercase;
      }
      .page .jan-toc ol {
        list-style: none;
        padding-left: 0;
        margin: 0;
        counter-reset: toc-item;
      }
      .page .jan-toc li {
        counter-increment: toc-item;
        margin: 1px 0;
      }
      .page .jan-toc li > a {
        color: #1f4fa8;
        text-decoration: none;
      }
      .page .jan-toc li > a:hover { text-decoration: underline; }
      .page .jan-toc li.jan-toc-l3 { padding-left: 14px; }
      .page .jan-toc li.jan-toc-l4 { padding-left: 28px; }

      /* Acknowledgments 박스 */
      .page .jan-ack {
        background: #fffaf2;
        border-left: 3px solid #d97757;
        padding: 10px 14px;
        margin: 14px 0;
        font-size: 12.5px;
        line-height: 1.6;
        color: #333;
      }
      .page .jan-ack strong {
        display: inline-block;
        color: #b4582f;
        font-weight: 700;
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        margin-right: 6px;
      }
      .page .jan-ack > p { margin: 4px 0 0; }

      /* ===== v11: "논문" 드롭다운 메뉴 (툴바) ===== */
      .paper-menu-btn {
        display: inline-flex !important;
        align-items: center !important;
        gap: 2px !important;
        min-width: auto !important;
        padding: 0 8px !important;
        height: 28px !important;
        border: 1px solid var(--paper-edge, #d0d0d0) !important;
        border-radius: 6px !important;
        background: color-mix(in srgb, var(--accent, #D97757) 8%, transparent) !important;
        color: var(--ink, #1c1c1c) !important;
        cursor: pointer;
        font-size: 13px;
        white-space: nowrap;
      }
      .paper-menu-btn:hover {
        background: color-mix(in srgb, var(--accent, #D97757) 20%, transparent) !important;
        color: var(--accent, #D97757) !important;
      }
      .paper-menu-btn[aria-expanded="true"] {
        background: var(--accent, #D97757) !important;
        color: #fff !important;
      }
      /* 드롭다운 컨테이너 — 흰 배경 고정 (노트의 핑크 배경 변수와 분리) */
      .menu-drop {
        position: fixed;
        z-index: 10000;
        min-width: 260px;
        max-width: 300px;
        max-height: 560px;
        overflow-y: auto;
        background: #ffffff;
        border: 1px solid rgba(0,0,0,0.1);
        border-radius: 10px;
        box-shadow: 0 6px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06);
        padding: 6px 0;
        color: #1c1c1c;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif;
      }
      /* 섹션 제목 — 작은 회색 대문자 */
      .menu-drop .menu-group-title {
        font-size: 10px;
        font-weight: 600;
        color: #999;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 10px 14px 4px;
        margin: 0;
      }
      .menu-drop .menu-group-title:first-child {
        padding-top: 4px;
      }
      /* 아이템 — 1줄 컴팩트, 아이콘 + 라벨만 */
      .menu-drop .menu-item-btn {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 6px 14px;
        background: none;
        border: 0;
        cursor: pointer;
        text-align: left;
        border-radius: 0;
        color: #1c1c1c;
        font-family: inherit;
        font-size: 13px;
        line-height: 1.4;
        transition: background 0.08s;
      }
      .menu-drop .menu-item-btn:hover {
        background: #f3f4f6;
      }
      .menu-drop .menu-item-btn:active {
        background: #e8eaed;
      }
      /* 아이콘 — 회색 (호버시 다크 그레이) */
      .menu-drop .menu-item-btn .ico {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        color: #777;
        stroke: currentColor;
        fill: none;
        stroke-width: 2;
      }
      .menu-drop .menu-item-btn:hover .ico {
        color: #333;
      }
      .menu-drop .menu-item-btn .mi-text {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      /* 라벨만 노출, 설명은 툴팁(title 속성)으로 */
      .menu-drop .menu-item-btn .mi-label {
        font-size: 13px;
        color: #1c1c1c;
        font-weight: 400;
        display: inline;
      }
      /* 설명 숨김 — 기본적으로 안 보이되 접근성을 위해 DOM 유지 */
      .menu-drop .menu-item-btn .mi-desc {
        display: none;
      }
      /* 구분선 — 미묘한 실선 */
      .menu-drop .menu-sep {
        height: 1px;
        background: rgba(0,0,0,0.08);
        margin: 4px 0;
      }
      /* 단축키 힌트 (우측 정렬 회색) — 추후 추가 가능 */
      .menu-drop .menu-item-btn .mi-kbd {
        font-size: 11px;
        color: #aaa;
        margin-left: auto;
        flex-shrink: 0;
        font-family: ui-monospace, 'SF Mono', Consolas, monospace;
      }
      /* 스크롤바 스타일 */
      .menu-drop::-webkit-scrollbar {
        width: 6px;
      }
      .menu-drop::-webkit-scrollbar-thumb {
        background: rgba(0,0,0,0.2);
        border-radius: 3px;
      }
      .menu-drop::-webkit-scrollbar-track {
        background: transparent;
      }

      /* ===== v13: 논문 기능 도움말 모달 (카드 섹션) ===== */
      .jan-help {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif;
        color: #1c1c1c;
        max-width: 560px;
      }
      .jan-help .jh-intro {
        font-size: 13.5px;
        line-height: 1.6;
        color: #333;
        margin-bottom: 18px;
        padding: 12px 14px;
        background: #f8f9fa;
        border-left: 3px solid var(--accent, #d97757);
        border-radius: 0 6px 6px 0;
      }
      .jan-help .jh-sec { margin-bottom: 18px; }
      .jan-help .jh-sec h4 {
        font-size: 11px;
        font-weight: 700;
        color: #999;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin: 0 0 8px;
        padding-bottom: 4px;
        border-bottom: 1px solid rgba(0,0,0,0.06);
      }
      .jan-help .jh-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .jan-help .jh-list li {
        display: flex;
        align-items: baseline;
        gap: 12px;
        padding: 6px 2px;
        font-size: 13px;
        line-height: 1.5;
      }
      .jan-help .jh-list li + li {
        border-top: 1px dashed rgba(0,0,0,0.06);
      }
      .jan-help .jh-label {
        flex: 0 0 130px;
        font-weight: 500;
        color: #1c1c1c;
      }
      .jan-help .jh-how {
        flex: 1;
        color: #555;
      }
      .jan-help .jh-how em {
        font-style: normal;
        font-weight: 500;
        color: #1c1c1c;
      }
      .jan-help .jh-hint {
        color: #888;
        font-size: 11.5px;
      }
      .jan-help kbd {
        display: inline-block;
        padding: 1px 6px;
        font-size: 11.5px;
        font-family: ui-monospace, 'SF Mono', Consolas, monospace;
        background: #f3f4f6;
        border: 1px solid #d0d0d0;
        border-bottom-width: 2px;
        border-radius: 4px;
        color: #333;
        white-space: nowrap;
      }
      .jan-help code {
        font-family: ui-monospace, 'SF Mono', Consolas, monospace;
        font-size: 11.5px;
        background: #f3f4f6;
        padding: 1px 5px;
        border-radius: 3px;
        color: #c85a3f;
      }
      .jan-help .jh-tip {
        margin-top: 20px;
        padding: 12px 14px;
        background: #fff9ec;
        border: 1px solid #ffe3a1;
        border-radius: 6px;
        font-size: 12.5px;
        line-height: 1.55;
        color: #5a4800;
      }

      /* ===== v13: 공용 논문 입력 폼 (paperPromptForm) ===== */
      .paper-form {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif;
        max-width: 520px;
      }
      .paper-form-intro {
        font-size: 12.5px;
        line-height: 1.55;
        color: #555;
        margin: 0 0 14px;
        padding: 10px 12px;
        background: #f8f9fa;
        border-left: 3px solid var(--accent, #d97757);
        border-radius: 0 5px 5px 0;
      }
      .paper-form-field { margin-bottom: 14px; }
      .paper-form-field label {
        display: block;
        font-size: 12px;
        font-weight: 600;
        color: #555;
        margin-bottom: 6px;
        letter-spacing: 0.02em;
      }
      .paper-form-field input,
      .paper-form-field textarea {
        width: 100%;
        box-sizing: border-box;
        padding: 9px 12px;
        border: 1px solid #d0d0d0;
        border-radius: 6px;
        font-family: inherit;
        font-size: 13px;
        background: #fafafa;
        color: #1c1c1c;
        transition: border-color 0.12s, background 0.12s, box-shadow 0.12s;
      }
      .paper-form-field input:focus,
      .paper-form-field textarea:focus {
        outline: none;
        border-color: var(--accent, #d97757);
        background: #fff;
        box-shadow: 0 0 0 3px rgba(217, 119, 87, 0.12);
      }
      .paper-form-field textarea {
        resize: vertical;
        min-height: 60px;
        line-height: 1.5;
      }
      .paper-form-hint {
        font-size: 11px;
        color: #888;
        margin-top: 4px;
        line-height: 1.45;
      }
    `;
    document.head.appendChild(css);
  })();

  /* ============================================================
     기능 1: 자동 번호 카운터 유지
     - CSS counter-increment 가 자동 처리하므로, JS 는 클래스만 보장
     - figure.jan-math 중 "블록 모드" (인라인 아님) 에만 jan-numbered
     ============================================================ */
  function refreshNumbering() {
    const page = getPageEl();
    if (!page) return;
    // 블록 수식 figure 에 jan-numbered 부여 (인라인은 span 이므로 대상 아님)
    page.querySelectorAll('figure.jan-math').forEach(fig => {
      // 수식이 display figure 면 번호 부여 (인라인 span 은 클래스명이 jan-math-inline)
      fig.classList.add('jan-numbered');
    });
    // 이미지만 들어있는 figure 에 jan-fig 클래스 자동 부여 (수식/다이어그램 제외)
    page.querySelectorAll('figure').forEach(fig => {
      if (fig.classList.contains('jan-math')) return;
      if (fig.classList.contains('jan-diagram')) return;
      if (fig.classList.contains('jan-fig')) return;
      const hasImg = fig.querySelector(':scope > img, :scope > svg, :scope > canvas, :scope > picture');
      if (hasImg) fig.classList.add('jan-fig');
    });
  }

  /* ============================================================
     기능 2: 각주 시스템
     ============================================================ */
  function ensureFootnotesContainer() {
    const page = getPageEl();
    if (!page) return null;
    let box = page.querySelector('.jan-footnotes');
    if (!box) {
      box = document.createElement('div');
      box.className = 'jan-footnotes';
      box.setAttribute('contenteditable', 'true');
      const ol = document.createElement('ol');
      box.appendChild(ol);
      // 참고문헌이 있으면 그 앞에, 없으면 문서 끝에
      const bib = page.querySelector('.jan-bibliography');
      if (bib) page.insertBefore(box, bib);
      else page.appendChild(box);
    }
    return box;
  }

  async function insertFootnote() {
    const page = getPageEl();
    if (!page) { notify('페이지를 찾을 수 없습니다'); return; }
    const text = await (typeof window.prompt2 === 'function'
      ? window.prompt2('각주 내용을 입력하세요', '')
      : Promise.resolve(prompt('각주 내용', '')));
    if (!text || !String(text).trim()) return;
    const fnId = uuid();
    // 본문 커서 위치에 <sup class='jan-fn-ref'>[N]</sup> 삽입
    restorePageSel();
    const refHtml =
      '<sup class="jan-fn-ref" data-fn-id="' + fnId + '" contenteditable="false">[?]</sup>';
    document.execCommand('insertHTML', false, refHtml);

    // 각주 컨테이너에 항목 추가
    const box = ensureFootnotesContainer();
    const ol = box.querySelector('ol');
    const li = document.createElement('li');
    li.setAttribute('data-fn-id', fnId);
    li.textContent = String(text).trim();
    ol.appendChild(li);

    renumberFootnotes();
    scheduleSave();
    notify('각주가 삽입되었습니다');
  }

  function renumberFootnotes() {
    const page = getPageEl();
    if (!page) return;
    // 본문에 등장하는 순서대로 fn-ref 를 번호 부여,
    // 동시에 각주 ol 의 li 순서도 같은 순서로 재정렬
    //
    // 주의: 이 함수는 '사용자가 JANPaper.insertFootnote 로 만든' 동적
    // 각주(= data-fn-id 를 가진 ref/li) 만 재정렬한다. 논문 템플릿이
    // 수작업으로 작성한 .jan-footnotes (li id="fn1" + <a href="#fnref1">↩</a>)
    // 는 건드리지 않는다. (그렇지 않으면 템플릿 각주 컨테이너가
    // 통째로 제거되는 버그가 발생한다 — QA T7 실패 원인)
    const refs = Array.from(page.querySelectorAll('sup.jan-fn-ref[data-fn-id]'));
    // 동적 각주용 container 는 data-fn-id 를 가진 li 가 있는 .jan-footnotes.
    // (여러 개일 수 있으므로 모두 수집하고, 첫 번째가 있으면 그걸 사용)
    const allBoxes = Array.from(page.querySelectorAll('.jan-footnotes'));
    const dynamicBox = allBoxes.find(b => b.querySelector('ol > li[data-fn-id]'))
      || allBoxes.find(b => {
        // 빈 상태의 동적 컨테이너 — insertFootnote 가 방금 만들고
        // renumberFootnotes 를 호출한 경우
        const lis = b.querySelectorAll('ol > li');
        return lis.length === 0 || Array.from(lis).every(li => li.hasAttribute('data-fn-id'));
      });
    const ol = dynamicBox ? dynamicBox.querySelector('ol') : null;
    if (!ol) {
      // 동적 ref 도 없으면 아무 작업 안 함
      if (!refs.length) return;
      // ref 만 남은 경우 → ref 도 정리
      refs.forEach(r => { r.textContent = '[?]'; });
      return;
    }
    const items = Array.from(ol.querySelectorAll('li[data-fn-id]'));
    const byId = new Map(items.map(li => [li.getAttribute('data-fn-id'), li]));
    const seen = new Set();
    // 본문 순서대로 번호 부여 + li 재정렬
    const fragment = document.createDocumentFragment();
    refs.forEach((r, i) => {
      const id = r.getAttribute('data-fn-id');
      if (seen.has(id)) return; // 같은 fn-id 중복 참조는 첫 번만 번호
      seen.add(id);
      const n = i + 1;
      r.textContent = '[' + n + ']';
      r.setAttribute('data-fn-num', String(n));
      const li = byId.get(id);
      if (li) {
        li.setAttribute('data-fn-num', String(n));
        fragment.appendChild(li);
      }
    });
    // ref 가 사라진 항목은 제거 (data-fn-id 기준 — 템플릿 li 는 건드리지 않음)
    items.forEach(li => {
      const id = li.getAttribute('data-fn-id');
      if (!seen.has(id)) li.remove();
    });
    // ol 에 정적(템플릿) li 가 섞여 있으면 그대로 유지, 동적 li 만 순서대로 뒤에
    // 붙인다. 그 외 요소 (텍스트 노드 등) 도 건드리지 않음.
    const staticLis = Array.from(ol.querySelectorAll(':scope > li:not([data-fn-id])'));
    if (staticLis.length === 0) {
      // 순수 동적 컨테이너 — 전체 재구성 가능
      ol.innerHTML = '';
      ol.appendChild(fragment);
      // 각주 ol 이 비면 동적 컨테이너만 제거
      if (!ol.children.length && dynamicBox) dynamicBox.remove();
    } else {
      // 템플릿 li 와 섞여 있음 — 동적 li 만 추가/재배치
      // (매우 드문 케이스: 템플릿 로드 후 insertFootnote 사용)
      Array.from(fragment.children).forEach(li => ol.appendChild(li));
    }
  }

  /* ============================================================
     기능 3: 참고문헌 / 인용 (IEEE 스타일)
     ============================================================ */
  function ensureBibContainer() {
    const page = getPageEl();
    if (!page) return null;
    let box = page.querySelector('.jan-bibliography');
    if (!box) {
      box = document.createElement('div');
      box.className = 'jan-bibliography';
      box.setAttribute('contenteditable', 'true');
      const ol = document.createElement('ol');
      box.appendChild(ol);
      page.appendChild(box);
    }
    return box;
  }

  async function addBibEntry(prefill) {
    const page = getPageEl();
    if (!page) { notify('페이지를 찾을 수 없습니다'); return null; }
    const text = prefill != null
      ? String(prefill)
      : await (typeof window.prompt2 === 'function'
        ? window.prompt2('참고문헌 항목 (IEEE 스타일, 예: A. Author, "Title," Journal, vol. N, pp. X-Y, 2024.)', '')
        : Promise.resolve(prompt('참고문헌 항목', '')));
    if (!text || !String(text).trim()) return null;
    const refId = 'ref-' + Math.random().toString(36).slice(2, 9);
    const box = ensureBibContainer();
    const ol = box.querySelector('ol');
    const li = document.createElement('li');
    li.setAttribute('data-ref-id', refId);
    li.innerHTML = escapeHtml(String(text).trim());
    ol.appendChild(li);
    renumberCitations();
    scheduleSave();
    notify('참고문헌 항목이 추가되었습니다');
    return refId;
  }

  function listBibEntries() {
    const page = getPageEl();
    if (!page) return [];
    const ol = page.querySelector('.jan-bibliography > ol');
    if (!ol) return [];
    return Array.from(ol.querySelectorAll('li[data-ref-id]')).map((li, i) => ({
      id: li.getAttribute('data-ref-id'),
      num: i + 1,
      text: (li.textContent || '').trim()
    }));
  }

  async function insertCitation() {
    const page = getPageEl();
    if (!page) { notify('페이지를 찾을 수 없습니다'); return; }
    let entries = listBibEntries();
    if (!entries.length) {
      const yes = confirm('참고문헌 목록이 비어있습니다. 지금 새 항목을 추가할까요?');
      if (!yes) return;
      const id = await addBibEntry();
      if (!id) return;
      entries = listBibEntries();
    }
    // 커서 위치 저장 — 팝업 UI 에서 잃어버리지 않도록
    let savedRange = null;
    try {
      const sel = document.getSelection();
      if (sel && sel.rangeCount > 0 && page.contains(sel.anchorNode)) {
        savedRange = sel.getRangeAt(0).cloneRange();
      }
    } catch {}

    openCitationPicker(entries, (refId) => {
      if (!refId) return;
      // 커서 위치 복원 후 삽입
      if (savedRange) {
        try {
          const sel = document.getSelection();
          sel.removeAllRanges();
          sel.addRange(savedRange);
        } catch {}
      } else {
        restorePageSel();
      }
      const html = '<a class="jan-cite" href="#' + refId + '" data-ref-id="' + refId + '" contenteditable="false">[?]</a>';
      document.execCommand('insertHTML', false, html);
      renumberCitations();
      scheduleSave();
      notify('인용이 삽입되었습니다');
    });
  }

  function renumberCitations() {
    const page = getPageEl();
    if (!page) return;
    const entries = listBibEntries();
    const numById = new Map(entries.map(e => [e.id, e.num]));
    page.querySelectorAll('a.jan-cite[data-ref-id]').forEach(a => {
      const id = a.getAttribute('data-ref-id');
      const n = numById.get(id);
      if (n) {
        a.textContent = '[' + n + ']';
        a.setAttribute('href', '#' + id);
      } else {
        // 참고문헌에서 사라진 인용은 [?]
        a.textContent = '[?]';
      }
    });
  }

  /* 참고문헌 선택 팝업 */
  function openCitationPicker(entries, onPick) {
    // 기존 팝업 제거
    const old = document.getElementById('jan-cite-picker');
    if (old) old.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'jan-cite-picker';
    backdrop.style.cssText =
      'position:fixed; inset:0; background:rgba(0,0,0,0.38); z-index:99999; ' +
      'display:flex; align-items:center; justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText =
      'background:#fff; min-width:460px; max-width:720px; max-height:70vh; ' +
      'border-radius:8px; box-shadow:0 10px 40px rgba(0,0,0,0.25); ' +
      'display:flex; flex-direction:column; overflow:hidden; font-family:inherit;';

    const head = document.createElement('div');
    head.style.cssText =
      'padding:12px 14px; border-bottom:1px solid #eee; font-weight:700; ' +
      'display:flex; align-items:center; justify-content:space-between;';
    head.innerHTML =
      '<span>참고문헌 선택</span>' +
      '<button id="jan-cite-close" style="background:transparent;border:0;font-size:18px;cursor:pointer;color:#888;">×</button>';
    box.appendChild(head);

    const search = document.createElement('input');
    search.type = 'text';
    search.placeholder = '검색 (저자, 제목…)';
    search.style.cssText =
      'margin:10px 14px 0 14px; padding:8px 10px; border:1px solid #ddd; ' +
      'border-radius:6px; font-size:13px; outline:none;';
    box.appendChild(search);

    const list = document.createElement('div');
    list.style.cssText = 'flex:1; overflow:auto; padding:8px 6px 10px;';
    box.appendChild(list);

    const footer = document.createElement('div');
    footer.style.cssText =
      'padding:10px 14px; border-top:1px solid #eee; display:flex; gap:8px; ' +
      'justify-content:flex-end;';
    footer.innerHTML =
      '<button id="jan-cite-new" style="padding:6px 12px; border:1px solid #ddd; ' +
      'background:#fff; border-radius:5px; cursor:pointer;">새 항목 추가</button>' +
      '<button id="jan-cite-cancel" style="padding:6px 12px; border:1px solid #ddd; ' +
      'background:#fff; border-radius:5px; cursor:pointer;">취소</button>';
    box.appendChild(footer);

    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    function render(filter) {
      list.innerHTML = '';
      const q = (filter || '').toLowerCase();
      const shown = entries.filter(e => !q || e.text.toLowerCase().includes(q));
      if (!shown.length) {
        const empty = document.createElement('div');
        empty.textContent = '일치하는 항목이 없습니다';
        empty.style.cssText = 'padding:20px; color:#888; text-align:center; font-size:13px;';
        list.appendChild(empty);
        return;
      }
      shown.forEach(e => {
        const row = document.createElement('button');
        row.type = 'button';
        row.style.cssText =
          'display:flex; gap:10px; width:calc(100% - 12px); margin:3px 6px; ' +
          'padding:8px 10px; background:#fafafa; border:1px solid #eee; ' +
          'border-radius:6px; cursor:pointer; text-align:left; font-family:inherit; ' +
          'font-size:12.5px; line-height:1.45; color:#333;';
        row.innerHTML =
          '<span style="flex:0 0 auto; font-weight:700; color:#1f4fa8;">[' + e.num + ']</span>' +
          '<span style="flex:1 1 auto;">' + escapeHtml(e.text) + '</span>';
        row.addEventListener('mouseenter', () => { row.style.background = '#fff3f7'; });
        row.addEventListener('mouseleave', () => { row.style.background = '#fafafa'; });
        row.addEventListener('click', () => {
          close();
          onPick && onPick(e.id);
        });
        list.appendChild(row);
      });
    }
    function close() { backdrop.remove(); }

    backdrop.addEventListener('click', ev => {
      if (ev.target === backdrop) close();
    });
    box.querySelector('#jan-cite-close').addEventListener('click', close);
    box.querySelector('#jan-cite-cancel').addEventListener('click', close);
    box.querySelector('#jan-cite-new').addEventListener('click', async () => {
      close();
      const id = await addBibEntry();
      if (!id) return;
      // 새 항목 선택 상태로 즉시 인용 삽입
      restorePageSel();
      const html = '<a class="jan-cite" href="#' + id + '" data-ref-id="' + id + '" contenteditable="false">[?]</a>';
      document.execCommand('insertHTML', false, html);
      renumberCitations();
      scheduleSave();
      notify('인용이 삽입되었습니다');
    });
    search.addEventListener('input', () => render(search.value));
    // ESC 로 닫기
    backdrop.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') close();
    });

    render('');
    setTimeout(() => search.focus(), 30);
  }

  function openBibManager() {
    // 간단 래퍼 — 참고문헌 영역으로 스크롤 + 없으면 생성
    const box = ensureBibContainer();
    if (box && box.scrollIntoView) {
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    notify('참고문헌 영역으로 이동했습니다');
  }

  /* ============================================================
     기능 4: 페이지 구분
     ============================================================ */
  function insertPageBreak() {
    const page = getPageEl();
    if (!page) { notify('페이지를 찾을 수 없습니다'); return; }
    restorePageSel();
    /* v31: 페이지 크기 활성 상태면 새 .jan-doc-page 로 split */
    if (page.classList.contains('jan-paged')) {
      if (splitAtCursorToNewDocPage()) return;
      /* 실패하면 폴백: 새 빈 .jan-doc-page 를 마지막에 추가 */
      const newPage = document.createElement('div');
      newPage.className = 'jan-doc-page';
      newPage.setAttribute('contenteditable', 'true');  /* v35 */
      newPage.innerHTML = '<p><br></p>';
      page.appendChild(newPage);
      /* 커서 이동 */
      const sel = window.getSelection();
      const range = document.createRange();
      range.setStart(newPage, 0);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      newPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
      scheduleSave();
      notify('새 페이지 추가됨');
      return;
    }
    /* 기본: 페이지 크기 미설정 시 hr 스타일 구분선 */
    const html =
      '<div class="jan-page-break" contenteditable="false">— 페이지 구분 —</div>' +
      '<p><br></p>';
    document.execCommand('insertHTML', false, html);
    scheduleSave();
    notify('페이지 구분이 삽입되었습니다');
  }

  /* ============================================================
     이벤트 위임 — 각주·인용 클릭으로 스크롤 이동
     ============================================================ */
  function flashTarget(el) {
    if (!el) return;
    el.classList.add('jan-fn-target');
    setTimeout(() => el.classList.remove('jan-fn-target'), 1200);
  }

  function onDocClick(ev) {
    // 목차 (TOC) 링크 클릭 → contenteditable 기본 동작이 막혀있으므로
    // 수동으로 스크롤. href 가 "#sec-..." 꼴이어야 함.
    const tocA = ev.target.closest && ev.target.closest('.jan-toc a[href^="#"]');
    if (tocA) {
      ev.preventDefault();
      const href = tocA.getAttribute('href');
      if (href && href.length > 1) {
        try {
          const target = document.querySelector(href);
          if (target && target.scrollIntoView) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            flashTarget(target);
          } else {
            notify('대상 섹션(' + href + ')을 찾지 못했습니다');
          }
        } catch (e) { console.warn('[JANPaper] TOC 이동 실패', e); }
      }
      return;
    }
    // 각주 ref 클릭 → 해당 li 로 스크롤
    const ref = ev.target.closest && ev.target.closest('sup.jan-fn-ref');
    if (ref) {
      ev.preventDefault();
      const id = ref.getAttribute('data-fn-id');
      const page = getPageEl();
      const li = page && page.querySelector('.jan-footnotes li[data-fn-id="' + id + '"]');
      if (li) {
        li.scrollIntoView({ behavior: 'smooth', block: 'center' });
        flashTarget(li);
      }
      return;
    }
    // 각주 li 클릭 → 본문 ref 로 스크롤
    const li = ev.target.closest && ev.target.closest('.jan-footnotes li[data-fn-id]');
    if (li && !ev.target.closest('[contenteditable]:focus')) {
      const id = li.getAttribute('data-fn-id');
      const page = getPageEl();
      const r = page && page.querySelector('sup.jan-fn-ref[data-fn-id="' + id + '"]');
      if (r) {
        r.scrollIntoView({ behavior: 'smooth', block: 'center' });
        flashTarget(r);
      }
      return;
    }
    // 인용 클릭 → 참고문헌 li 로 스크롤
    const cite = ev.target.closest && ev.target.closest('a.jan-cite');
    if (cite) {
      ev.preventDefault();
      const id = cite.getAttribute('data-ref-id');
      const page = getPageEl();
      const target = page && page.querySelector('.jan-bibliography li[data-ref-id="' + id + '"]');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        flashTarget(target);
      }
      return;
    }
  }
  document.addEventListener('click', onDocClick, true);

  /* ============================================================
     자동 재정렬 — DOM 변화(각주·인용 삭제) 감지
     ============================================================ */
  let renumberTimer = null;
  function scheduleRenumber() {
    clearTimeout(renumberTimer);
    renumberTimer = setTimeout(() => {
      try {
        renumberFootnotes();
        renumberCitations();
        refreshNumbering();
      } catch (e) {
        console.warn('[JANPaper] renumber 실패:', e);
      }
    }, 180);
  }

  function attachObserver() {
    const page = getPageEl();
    if (!page) {
      // 아직 페이지 엘리먼트가 없으면 나중에 재시도
      setTimeout(attachObserver, 500);
      return;
    }
    const mo = new MutationObserver(muts => {
      let relevant = false;
      for (const m of muts) {
        // 자손 추가/삭제/텍스트 변화가 paper 요소와 관련되면 재정렬
        if (m.type === 'childList') {
          const nodes = [].concat(Array.from(m.addedNodes), Array.from(m.removedNodes));
          for (const n of nodes) {
            if (!(n instanceof Element)) continue;
            if (
              n.matches &&
              (n.matches('sup.jan-fn-ref, a.jan-cite, .jan-footnotes, .jan-bibliography, figure, table, caption') ||
                n.querySelector && n.querySelector('sup.jan-fn-ref, a.jan-cite, figure, table, caption'))
            ) {
              relevant = true;
              break;
            }
          }
        }
        if (relevant) break;
      }
      if (relevant) scheduleRenumber();
    });
    mo.observe(page, { childList: true, subtree: true });
    // 탭 전환 등으로 page 가 교체되는 경우에 대비 — 주기적 재확인
    setInterval(() => {
      const cur = getPageEl();
      if (cur && cur !== mo._janRoot) {
        try { mo.disconnect(); } catch {}
        mo.observe(cur, { childList: true, subtree: true });
        mo._janRoot = cur;
      }
    }, 3000);
    mo._janRoot = page;
    // 초기 1회 실행
    scheduleRenumber();
  }

  /* ============================================================
     v11: "논문" 드롭다운 메뉴 — 툴바에서 모든 논문 기능을 한눈에
     ============================================================ */
  function buildPaperDropdownMenu() {
    const drop = document.getElementById('paperMenuDrop');
    if (!drop || drop._janBuilt) return drop;
    drop._janBuilt = true;

    /* 메뉴 구조: [section-title, ...items] 반복, items 는 {act, icon, label, desc} */
    const sections = [
      {
        title: '빠른 시작',
        items: [
          { act: 'load-sample',   icon: 'i-book',      label: '논문 시작 (Science 포맷 샘플)', desc: '완성된 물리학 논문 3페이지를 현재 노트 끝에 삽입' },
          { act: 'convert',       icon: 'i-wand',      label: '논문 포맷으로 자동 변환',         desc: '현재 노트를 3페이지 2단 Science 레이아웃으로' },
          { act: 'undo',          icon: 'i-undo',      label: '변환 되돌리기',                   desc: '최근 10회까지 파괴적 연산을 역순 복원' }
        ]
      },
      {
        title: '논문 구성 요소',
        items: [
          { act: 'atom-authors',  icon: 'i-users',     label: '저자 · 소속 · 교신 블록',          desc: '자동 슈퍼스크립트 + 소속 리스트' },
          { act: 'atom-abstract', icon: 'i-clipboard', label: 'Abstract 박스',                  desc: '좌측 strip 박스, 선택 영역도 감쌀 수 있음' },
          { act: 'atom-keywords', icon: 'i-tag',       label: 'Keywords 블록',                  desc: 'KEYWORDS: 키워드1, 키워드2...' },
          { act: 'atom-toc',      icon: 'i-list',      label: 'TOC (목차) 자동 생성',            desc: 'h2/h3/h4 스캔 → 클릭 링크 목차' },
          { act: 'atom-ack',      icon: 'i-heart',     label: 'Acknowledgments (감사의 말)',     desc: '감사 박스 — 연구비·기관 명시' }
        ]
      },
      {
        title: '레이아웃',
        items: [
          { act: 'atom-2col',     icon: 'i-columns',   label: '2단 레이아웃 토글',               desc: '선택 영역을 Science 저널식 2단으로' },
          { act: 'page-break',    icon: 'i-pages',     label: '페이지 구분 삽입',               desc: '인쇄 시 여기서 새 페이지' },
          { act: 'atom-wrap-page',icon: 'i-pages',     label: '페이지로 감싸기',                 desc: '선택 영역을 .jan-page 로 wrap' },
          { act: 'atom-headers',  icon: 'i-bookmark',  label: '러닝 헤더 · 꼬리말 설정',          desc: '모든 페이지 반복 헤더/푸터' }
        ]
      },
      {
        title: '참조 & 인용',
        items: [
          { act: 'footnote',      icon: 'i-sup',       label: '각주 삽입',                       desc: '본문 커서 위치에 번호 + 페이지 하단 문구' },
          { act: 'citation',      icon: 'i-quote',     label: '인용 삽입',                       desc: '[N] 참고문헌 번호 자동' },
          { act: 'bib-add',       icon: 'i-book',      label: '참고문헌 항목 추가',              desc: 'IEEE 스타일, 자동 번호' },
          { act: 'renumber',      icon: 'i-refresh',   label: '번호 재정렬',                     desc: '각주·인용·그림·표 전체 재번호' }
        ]
      }
    ];

    /* HTML 조립 — 1줄 아이템, 설명은 title 속성(툴팁) 으로 */
    const esc = (s) => String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const parts = [];
    sections.forEach((sec, i) => {
      if (i > 0) parts.push('<div class="menu-sep"></div>');
      parts.push('<div class="menu-group-title">' + esc(sec.title) + '</div>');
      sec.items.forEach((it) => {
        parts.push(
          '<button class="menu-item-btn" data-paper-act="' + esc(it.act) + '" type="button" title="' + esc(it.desc) + '">' +
            '<svg class="ico"><use href="#' + esc(it.icon) + '"/></svg>' +
            '<span class="mi-text"><span class="mi-label">' + esc(it.label) + '</span></span>' +
          '</button>'
        );
      });
    });
    /* 도움말 */
    parts.push('<div class="menu-sep"></div>');
    parts.push(
      '<button class="menu-item-btn" data-paper-act="help" type="button" title="사용법 한눈에 보기">' +
        '<svg class="ico"><use href="#i-help"/></svg>' +
        '<span class="mi-text"><span class="mi-label">논문 기능 도움말</span></span>' +
      '</button>'
    );
    drop.innerHTML = parts.join('');

    /* 항목 클릭 라우터 */
    drop.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-paper-act]');
      if (!btn) return;
      const act = btn.getAttribute('data-paper-act');
      closePaperDropdown();
      try {
        switch (act) {
          case 'load-sample':    loadPaperSample(); break;
          case 'convert':        convertToSciencePaper(); break;
          case 'undo':           paperUndo(); break;
          case 'atom-authors':   insertAuthorsBlock(); break;
          case 'atom-abstract':  insertAbstractBox(); break;
          case 'atom-keywords':  insertKeywordsBlock(); break;
          case 'atom-toc':       generateTOC(); break;
          case 'atom-ack':       insertAcknowledgments(); break;
          case 'atom-2col':      toggleTwoColumn(); break;
          case 'page-break':     insertPageBreak(); break;
          case 'atom-wrap-page': wrapAsPage(); break;
          case 'atom-headers':   configureHeaderFooter(); break;
          case 'footnote':       insertFootnote(); break;
          case 'citation':       insertCitation(); break;
          case 'bib-add':        addBibEntry(); break;
          case 'renumber':
            try { renumberFootnotes(); } catch {}
            try { renumberCitations(); } catch {}
            try { refreshNumbering(); } catch {}
            notify('번호 재정렬 완료');
            break;
          case 'help':
            if (typeof openPaperHelp === 'function') openPaperHelp();
            else alert('논문 기능 도움말 — Ctrl+K 명령 팔레트에서 "논문"으로 검색하세요.');
            break;
        }
      } catch (e) {
        console.warn('[JANPaper] 메뉴 액션 실패', act, e);
      }
    });
    return drop;
  }

  function openPaperDropdown(triggerBtn) {
    const drop = buildPaperDropdownMenu();
    if (!drop) return;
    /* 다른 드롭다운 닫기 */
    document.querySelectorAll('.menu-drop').forEach((d) => { if (d !== drop) d.style.display = 'none'; });
    drop.style.display = 'block';
    triggerBtn.setAttribute('aria-expanded', 'true');
    /* 위치 조정 (버튼 아래, 뷰포트 안쪽) */
    const rect = triggerBtn.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth;
    drop.style.top = (rect.bottom + 4) + 'px';
    const desiredLeft = rect.left;
    const maxLeft = vw - drop.offsetWidth - 8;
    drop.style.left = Math.max(8, Math.min(desiredLeft, maxLeft)) + 'px';
  }

  function closePaperDropdown() {
    const drop = document.getElementById('paperMenuDrop');
    if (drop) drop.style.display = 'none';
    const btn = document.getElementById('paperMenuBtn2');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  /* ============================================================
     초기화
     ============================================================ */
  function init() {
    attachObserver();

    /* v11: 새 "논문" 드롭다운 버튼 (paperMenuBtn2) 우선 바인딩 */
    const btn2 = document.getElementById('paperMenuBtn2');
    if (btn2 && !btn2._janBound) {
      btn2._janBound = true;
      btn2.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const drop = document.getElementById('paperMenuDrop');
        const isOpen = drop && drop.style.display === 'block';
        if (isOpen) closePaperDropdown();
        else openPaperDropdown(btn2);
      });
      /* 바깥 클릭 시 닫기 */
      document.addEventListener('click', (ev) => {
        if (!ev.target.closest('#paperMenuWrapper')) closePaperDropdown();
      });
      /* ESC 로 닫기 */
      document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') closePaperDropdown();
      });
    }

    /* 구형 paperMenuBtn (숨겨져 있음) — 호환용 바인딩 유지. 클릭 안 일어남. */
    const btn = document.getElementById('paperMenuBtn');
    if (btn && !btn._janBound) {
      btn._janBound = true;
      btn.addEventListener('click', openPaperMenu);
    }

    /* v16: stacked sheets observer — #page 변경 감지 → updatePageSheets 호출 */
    try { setupSheetsObserver(); } catch (e) { console.warn('[JANPaper] sheets observer 실패', e); }
    try { setupAutoSplitObserver(); } catch (e) { console.warn('[JANPaper] autoSplit observer 실패', e); }
    /* 창 리사이즈 시에도 재계산 — pageH 는 mm 고정이나 콘텐츠 재배치 시 scrollHeight 변동 */
    try {
      window.addEventListener('resize', () => {
        const p = getPageEl();
        if (p && p.classList.contains('jan-paged')) updatePageSheets();
      });
    } catch (e) {}
  }

  /* 템플릿 내 data-latex / data-mermaid-code figure 들을 모두 렌더.
     모든 Promise 를 await 하여 완전 렌더 완료 시점에 resolve. */
  async function renderAllPaperFigures(page) {
    if (!page) return;
    if (!window.JANDiagrams) return;
    try {
      // 1) KaTeX 수식
      const figs = Array.from(page.querySelectorAll('figure.jan-math[data-latex]'));
      const mathTasks = figs.map(async (f) => {
        if (f.querySelector('.katex, .katex-display')) return; // 이미 렌더됨
        const enc = f.getAttribute('data-latex');
        let latex = enc;
        try { latex = decodeURIComponent(escape(atob(enc))); } catch {} // base64 시도
        if (!latex || /^\s*$/.test(latex)) latex = enc;
        try {
          const html = await window.JANDiagrams.renderLatexHtml(latex);
          if (html) {
            const cap = f.querySelector('figcaption');
            f.innerHTML = html;
            if (cap) f.appendChild(cap);
          }
        } catch (e) { console.warn('[paper] 수식 렌더 실패', latex, e); }
      });

      // 2) Mermaid placeholder
      const diags = Array.from(page.querySelectorAll('figure.jan-diagram[data-mermaid-code]'));
      const diagTasks = diags.map(async (d) => {
        if (d.querySelector('svg')) return; // 이미 렌더됨
        const code = (d.getAttribute('data-mermaid-code') || '');
        let mm = code;
        try { mm = decodeURIComponent(escape(atob(code))); } catch {}
        if (!mm) return;
        try {
          const svg = await window.JANDiagrams.renderMermaid(mm);
          if (svg) {
            const cap = d.querySelector('figcaption');
            d.innerHTML = svg;
            if (cap) d.appendChild(cap);
          }
        } catch (e) { console.warn('[paper] Mermaid 렌더 실패', e); }
      });

      await Promise.all([...mathTasks, ...diagTasks]);
    } catch (e) {
      console.warn('[paper] 후처리 실패', e);
    }
  }

  /* 완성된 Science 포맷 물리학 논문 샘플 3페이지를 현재 노트 끝에 삽입.
     async — 수식·Mermaid 렌더가 모두 끝날 때까지 기다린 후 resolve.
     v15: 분야별 샘플 picker 를 먼저 열어 사용자 선택 → 선택된 템플릿 삽입. */
  async function loadPaperSample() {
    /* 분야별 샘플 로드 — picker 열기 */
    if (window.JANPaperTemplate && window.JANPaperTemplate.byFieldList) {
      openPaperSamplePicker();
      return;
    }
    /* 폴백 — 분야 샘플 파일이 로드되지 않았으면 기존 풀 물리학 샘플로 */
    var tpl = window.JANPaperTemplate && window.JANPaperTemplate.physicsScience;
    if (!tpl) { notify('논문 템플릿이 로드되지 않았습니다'); return; }
    await insertSampleHtml(tpl, 'Science 포맷 물리학 논문 3페이지');
  }

  /* 실제 삽입 로직 (풀/경량 공통) */
  async function insertSampleHtml(tpl, label) {
    if (!tpl) { notify('논문 템플릿 데이터가 없습니다'); return; }
    var page = document.getElementById('page');
    if (!page) { notify('편집 영역을 찾을 수 없습니다'); return; }
    pushPaperUndo('load-sample');
    page.insertAdjacentHTML('beforeend', '<hr>' + tpl);
    try { refreshNumbering(); } catch (e) {}
    try { renumberFootnotes(); } catch (e) {}
    try { renumberCitations(); } catch (e) {}
    notify((label || '논문 샘플') + ' 삽입 완료 — 수식 렌더링 중…');
    await renderAllPaperFigures(page);
    try { if (typeof window.scheduleSave === 'function') window.scheduleSave(); } catch (e) {}
    try { showPaperOnboardingBanner(); } catch (e) {}
    notify((label || '논문 샘플') + ' 삽입 완료');
    showUndoToast((label || '논문 샘플') + ' 삽입 완료');
  }

  /* 분야별 샘플 picker — 카드 리스트 모달 */
  function openPaperSamplePicker() {
    const list = (window.JANPaperTemplate && window.JANPaperTemplate.byFieldList) || [];
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    const ok = document.getElementById('modalOk');
    const cancel = document.getElementById('modalCancel');
    if (!modal || !body) {
      /* 폴백 */
      const input = prompt('분야 번호 입력:\n' + list.map((x, i) => (i + 1) + '. ' + x.field + ' — ' + x.label).join('\n') + '\n0. Science 풀 샘플 (물리학 3페이지)');
      if (!input) return;
      const n = parseInt(input, 10);
      if (n === 0 && window.JANPaperTemplate.physicsScience) {
        insertSampleHtml(window.JANPaperTemplate.physicsScience, 'Science 포맷 물리학 풀 샘플');
      } else if (n >= 1 && n <= list.length) {
        const sample = window.JANPaperTemplate[list[n - 1].key];
        if (sample) insertSampleHtml(sample.html, list[n - 1].field + ' · ' + sample.title);
      }
      return;
    }

    const origOkDisp = ok.style.display;
    const origOkText = ok.textContent;
    const origCancelText = cancel.textContent;

    title.textContent = '분야별 예시 논문 선택';
    body.innerHTML = '';

    const intro = document.createElement('div');
    intro.style.cssText = 'font-size:12px; color:#666; margin-bottom:10px; line-height:1.55;';
    intro.innerHTML = '현재 탭 끝에 분야별 논문 스켈레톤을 삽입합니다. <br>구조 (제목·저자·Abstract·섹션·참고문헌) 를 유지한 채 내용을 자유롭게 수정하세요.';
    body.appendChild(intro);

    /* 경량 분야 샘플들 (5개) */
    const grid = document.createElement('div');
    grid.style.cssText = 'display:flex; flex-direction:column; gap:6px; margin-bottom:14px;';
    list.forEach(item => {
      const card = document.createElement('button');
      card.type = 'button';
      card.style.cssText = 'display:flex; align-items:flex-start; gap:10px; padding:9px 11px; background:#fafafa; border:1px solid #eee; border-radius:8px; cursor:pointer; text-align:left; font-family:inherit; transition:all 0.12s;';
      card.innerHTML =
        '<svg class="ico" style="width:18px;height:18px;color:#D97757;flex-shrink:0;margin-top:2px;"><use href="#' + item.icon + '"/></svg>' +
        '<div style="flex:1;">' +
          '<div style="font-size:12.5px; font-weight:600; color:#333;">' +
            '<span style="color:#D97757; margin-right:6px;">' + item.field + '</span>' +
            item.label +
          '</div>' +
          '<div style="font-size:11px; color:#777; margin-top:2px; line-height:1.4;">' + item.summary + '</div>' +
        '</div>';
      card.addEventListener('mouseenter', () => {
        card.style.background = '#fef5f1'; card.style.borderColor = '#D97757'; card.style.transform = 'translateY(-1px)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.background = '#fafafa'; card.style.borderColor = '#eee'; card.style.transform = 'none';
      });
      card.addEventListener('click', async () => {
        const sample = window.JANPaperTemplate[item.key];
        if (!sample) return notify('해당 샘플이 로드되지 않았습니다');
        restoreModal();
        await insertSampleHtml(sample.html, item.field + ' · ' + sample.title);
      });
      grid.appendChild(card);
    });
    body.appendChild(grid);

    /* 풀 Science 물리학 샘플 (플래그십) 구분 섹션 */
    if (window.JANPaperTemplate && window.JANPaperTemplate.physicsScience) {
      const sepLabel = document.createElement('div');
      sepLabel.style.cssText = 'font-size:10.5px; color:#888; letter-spacing:1px; text-transform:uppercase; font-weight:700; padding:4px 0 6px; border-top:1px solid #eee;';
      sepLabel.textContent = '완성된 풀 샘플 (3페이지 · 2단 레이아웃 · 수식·Mermaid 포함)';
      body.appendChild(sepLabel);

      const fullCard = document.createElement('button');
      fullCard.type = 'button';
      fullCard.style.cssText = 'display:flex; align-items:flex-start; gap:10px; padding:11px; background:linear-gradient(135deg, #fef5f1 0%, #fae4dd 100%); border:1px solid #D97757; border-radius:8px; cursor:pointer; text-align:left; font-family:inherit; width:100%; transition:all 0.12s;';
      fullCard.innerHTML =
        '<svg class="ico" style="width:20px;height:20px;color:#8B4513;flex-shrink:0;margin-top:2px;"><use href="#i-book"/></svg>' +
        '<div style="flex:1;">' +
          '<div style="font-size:13px; font-weight:700; color:#8B4513;">Science 포맷 물리학 풀 샘플 (3페이지)</div>' +
          '<div style="font-size:11px; color:#6B4423; margin-top:3px; line-height:1.45;">광격자 SOC-BEC 초유체 수송 연구. 완성된 수식(KaTeX)·위상도(Mermaid)·IEEE 참고문헌·2단 레이아웃 포함.</div>' +
        '</div>';
      fullCard.addEventListener('mouseenter', () => { fullCard.style.transform = 'translateY(-1px)'; fullCard.style.boxShadow = '0 6px 20px rgba(217,119,87,0.25)'; });
      fullCard.addEventListener('mouseleave', () => { fullCard.style.transform = 'none'; fullCard.style.boxShadow = 'none'; });
      fullCard.addEventListener('click', async () => {
        restoreModal();
        await insertSampleHtml(window.JANPaperTemplate.physicsScience, 'Science 포맷 물리학 풀 샘플');
      });
      body.appendChild(fullCard);
    }

    /* 넓은 모달 + 내부 스크롤 */
    const modalBox = modal.querySelector('.modal') || modal;
    modalBox.classList.add('jan-wide');

    ok.style.display = 'none'; // 카드 클릭 = 즉시 적용
    cancel.textContent = '닫기';

    function restoreModal() {
      modal.classList.remove('open');
      modalBox.classList.remove('jan-wide');
      ok.style.display = origOkDisp;
      ok.textContent = origOkText;
      cancel.textContent = origCancelText;
      body.innerHTML = '';
      cancel.onclick = null;
      modal.removeEventListener('click', backdropHandler);
      document.removeEventListener('keydown', escHandler);
    }
    function backdropHandler(e) {
      /* v15-fix: backdrop 클릭 = 닫기 */
      if (e.target === modal) restoreModal();
    }
    function escHandler(e) { if (e.key === 'Escape') restoreModal(); }
    cancel.onclick = restoreModal;
    modal.addEventListener('click', backdropHandler);
    document.addEventListener('keydown', escHandler);
    modal.classList.add('open');
  }

  /* ============================================================
     현재 노트를 Science 최종본(3페이지 2단 학술 레이아웃)으로 변환
     ------------------------------------------------------------
     - #page 의 기존 자식들을 스캔해서 제목·저자·소속·초록·키워드·
       본문 섹션·참고문헌 블록으로 분류.
     - 3개의 .jan-page 로 분할: 표지/Intro, Methods/Results, Discussion/Refs.
     - figure/table 이 페이지 경계 직전이면 다음 페이지로 밀어 break 회피.
     - 완료 후 수식·Mermaid 재렌더 + 번호 재정렬.
     ============================================================ */
  async function convertToSciencePaper() {
    const page = getPageEl();
    if (!page) { notify('편집 영역을 찾을 수 없습니다'); return; }

    /* ---- 0. 멱등성 보장 — 이미 .jan-paper 가 있으면 재변환 여부 확인 ----
       사용자가 실수로 두 번 실행 시 래퍼가 중첩되어 레이아웃이 붕괴되는 것을 방지.
       OK → 기존 래퍼를 풀어(flatten) 원본 노드를 되살린 뒤 재변환.
       Cancel → 중단. */
    const existingPaper = page.querySelector('.jan-paper');
    if (existingPaper) {
      const goAgain = window.confirm(
        '이미 논문 포맷으로 변환돼 있습니다.\n' +
        '평문으로 풀고 다시 변환하시겠습니까?\n\n' +
        '(원본 구조 복원은 어렵습니다. 취소를 누르면 현재 상태를 유지합니다.)'
      );
      if (!goAgain) return;
      // 스냅샷 push (현재 래핑된 상태)
      pushPaperUndo('convert-reflatten');
      // 래퍼를 풀어 본문 노드들을 fragment 로 수집 후 page 로 되돌림
      const frag = document.createDocumentFragment();
      existingPaper.querySelectorAll(':scope > .jan-page').forEach(pg => {
        // 헤더/푸터/TOC 제거
        pg.querySelectorAll('.jan-header, .jan-footer, .jan-toc').forEach(el => el.remove());
        // 2단 컬럼·참고문헌 컨테이너 내부를 꺼냄
        pg.querySelectorAll('.jan-two-col').forEach(container => {
          while (container.firstChild) frag.appendChild(container.firstChild);
          container.remove();
        });
        // 나머지 자식 (cover, abstract, bibliography 등)
        while (pg.firstChild) frag.appendChild(pg.firstChild);
      });
      existingPaper.replaceWith(frag);
    }

    const confirmMsg =
      '현재 노트 전체를 Science 최종본 3페이지 레이아웃으로 변환합니다. ' +
      'Ctrl+Z (30초 이내) 또는 "논문 변환 되돌리기" 명령으로 복원할 수 있습니다. 계속하시겠습니까?';
    if (!window.confirm(confirmMsg)) return;

    /* 변환 직전 스냅샷 — 되돌리기 지원 */
    pushPaperUndo('convert');

    /* ---- 1. 원본 노드 수집 (빈 공백·br 제외) ---- */
    const raw = Array.from(page.childNodes);
    const nodes = [];
    for (const n of raw) {
      if (n.nodeType === 3) {
        const t = (n.textContent || '').trim();
        if (t) {
          const p = document.createElement('p');
          p.textContent = t;
          nodes.push(p);
        }
        continue;
      }
      if (n.nodeType !== 1) continue;
      // 완전 빈 p/div/br 은 제외
      const el = n;
      const html = (el.innerHTML || '').replace(/<br\s*\/?>/gi, '').trim();
      const txt = (el.textContent || '').trim();
      if (!html && !txt && !el.querySelector('img,figure,table,svg,canvas')) continue;
      // 이미 jan-paper 로 변환된 경우 내부 콘텐츠만 꺼내서 재처리
      if (el.classList && el.classList.contains('jan-paper')) {
        el.querySelectorAll(':scope > .jan-page').forEach(pg => {
          Array.from(pg.children).forEach(ch => {
            if (ch.classList && (ch.classList.contains('jan-header') ||
                ch.classList.contains('jan-footer'))) return;
            if (ch.classList && ch.classList.contains('jan-two-col')) {
              Array.from(ch.children).forEach(c => nodes.push(c.cloneNode(true)));
            } else if (ch.classList && ch.classList.contains('jan-bibliography')) {
              nodes.push(ch.cloneNode(true));
            } else {
              nodes.push(ch.cloneNode(true));
            }
          });
        });
        continue;
      }
      nodes.push(el.cloneNode(true));
    }
    if (!nodes.length) { notify('변환할 콘텐츠가 없습니다'); return; }

    /* ---- 2. 메타데이터 추출 (제목, 부제, 저자, 소속, 이메일, 초록, 키워드) ---- */
    let title = null, subtitle = null, authors = null, affiliation = null,
        corresponding = null, abstractNode = null, keywords = null;
    const used = new Set();
    const textOf = (n) => (n.textContent || '').trim();
    const isEnglishOnly = (s) => /^[A-Za-z0-9\s\-:,;.'"()\[\]&/]+$/.test(s) && /[A-Za-z]/.test(s);

    // 첫 번째 의미있는 노드 → 제목
    for (let i = 0; i < nodes.length; i++) {
      if (used.has(i)) continue;
      const t = textOf(nodes[i]);
      if (!t) continue;
      title = nodes[i];
      used.add(i);
      // 다음 노드가 영문만이면 부제
      for (let j = i + 1; j < Math.min(i + 3, nodes.length); j++) {
        const t2 = textOf(nodes[j]);
        if (!t2) continue;
        if (isEnglishOnly(t2) && t2.length < 200) {
          subtitle = nodes[j];
          used.add(j);
        }
        break;
      }
      break;
    }

    // 나머지 순회하며 키워드 매칭
    for (let i = 0; i < nodes.length; i++) {
      if (used.has(i)) continue;
      const t = textOf(nodes[i]);
      if (!t) continue;
      // 저자
      if (!authors && /^(저자\s*[:：]|Authors?\s*[:：])/i.test(t)) {
        authors = nodes[i]; used.add(i); continue;
      }
      // 소속 (¹ ² ³ 또는 "소속:" / "Affiliation")
      if (!affiliation && /[¹²³⁴⁵]|^(소속\s*[:：]|Affiliation)/i.test(t) && t.length < 400) {
        affiliation = nodes[i]; used.add(i); continue;
      }
      // corresponding (교신저자·이메일)
      if (!corresponding && /(corresponding|교신저자|\b[\w.+-]+@[\w-]+\.[\w.-]+\b)/i.test(t) && t.length < 300) {
        corresponding = nodes[i]; used.add(i); continue;
      }
      // Abstract
      if (!abstractNode && /^(ABSTRACT|Abstract|초록|요약)\b/i.test(t)) {
        // 같은 노드에 긴 본문이 포함 → 그 노드를 abstract
        if (t.length > 50) { abstractNode = nodes[i]; used.add(i); continue; }
        // 짧은 헤더면 다음 노드를 abstract
        for (let j = i + 1; j < Math.min(i + 3, nodes.length); j++) {
          const t2 = textOf(nodes[j]);
          if (t2) { abstractNode = nodes[j]; used.add(i); used.add(j); break; }
        }
        continue;
      }
      // Keywords
      if (!keywords && /^(Keywords|키워드|핵심어)\s*[:：]/i.test(t)) {
        keywords = nodes[i]; used.add(i); continue;
      }
    }

    /* ---- 3. 참고문헌 분리 ---- */
    // "참고문헌" / "References" 헤더를 찾아 그 이후 노드들을 bibliography 로
    let refHeaderIdx = -1;
    for (let i = 0; i < nodes.length; i++) {
      if (used.has(i)) continue;
      const t = textOf(nodes[i]);
      if (/^(References|참고문헌|Bibliography)\s*$/i.test(t) && t.length < 40) {
        refHeaderIdx = i; break;
      }
    }
    const refNodes = [];
    if (refHeaderIdx !== -1) {
      used.add(refHeaderIdx);
      for (let i = refHeaderIdx + 1; i < nodes.length; i++) {
        if (used.has(i)) continue;
        refNodes.push(nodes[i]);
        used.add(i);
      }
    }
    // 이미 .jan-bibliography 인 노드가 있으면 사용
    const existingBib = nodes.find(n => n.classList && n.classList.contains('jan-bibliography'));
    if (existingBib) {
      const idx = nodes.indexOf(existingBib);
      if (idx >= 0) used.add(idx);
    }

    /* ---- 4. 본문 노드들 = used 안 된 것들 ---- */
    const bodyNodes = [];
    for (let i = 0; i < nodes.length; i++) {
      if (used.has(i)) continue;
      bodyNodes.push(nodes[i]);
    }

    /* ---- 5. 섹션 헤더 자동 승격 (^\d+\.\s -> h2, ^\d+\.\d+\s -> h3) +
               TOC 항목 수집 ---- */
    const tocItems = []; // {id, num, text, level}
    let tocCounter = 0;
    bodyNodes.forEach(n => {
      // 이미 h1-h4 면 id 만 부여
      if (/^H[1-4]$/.test(n.nodeName)) {
        if (!n.id) n.id = 'sec-' + (++tocCounter);
        const t = textOf(n);
        const lvl = parseInt(n.nodeName.substring(1), 10);
        tocItems.push({ id: n.id, text: t, level: lvl });
        return;
      }
      const t = textOf(n);
      if (!t) return;
      const m3 = /^(\d+\.\d+(?:\.\d+)?)\s+(.+)$/.exec(t);
      const m2 = /^(\d+\.)\s+(.+)$/.exec(t);
      if (m3 && t.length < 160) {
        // h3 로 교체
        const h = document.createElement('h3');
        h.id = 'sec-' + (++tocCounter);
        h.textContent = t;
        n.replaceWith(h);
        // 배열 참조도 업데이트
        const idx = bodyNodes.indexOf(n);
        if (idx >= 0) bodyNodes[idx] = h;
        tocItems.push({ id: h.id, text: t, level: 3 });
      } else if (m2 && t.length < 160) {
        const h = document.createElement('h2');
        h.id = 'sec-' + (++tocCounter);
        h.textContent = t;
        n.replaceWith(h);
        const idx = bodyNodes.indexOf(n);
        if (idx >= 0) bodyNodes[idx] = h;
        tocItems.push({ id: h.id, text: t, level: 2 });
      }
    });

    /* ---- 6. 본문 3등분 — figure/table 이 바로 앞/뒤면 경계 조정 ---- */
    const N = bodyNodes.length;
    let p1End = Math.round(N / 3);
    let p2End = Math.round((2 * N) / 3);
    const isBreakable = (n) => {
      if (!n) return true;
      if (n.nodeName === 'FIGURE' || n.nodeName === 'TABLE') return false;
      if (n.classList && (n.classList.contains('jan-fig') ||
          n.classList.contains('jan-math') ||
          n.classList.contains('jan-diagram'))) return false;
      return true;
    };
    // 경계가 figure/table 직후로 떨어지면 다음 섹션 시작을 뒤로 민다
    const adjustBoundary = (idx) => {
      let safe = idx;
      // 경계가 figure/table 이거나 바로 앞이 figure/table 이면 한 칸 미룸
      while (safe < N - 1 && (!isBreakable(bodyNodes[safe]) || !isBreakable(bodyNodes[safe - 1]))) {
        safe++;
      }
      return safe;
    };
    p1End = adjustBoundary(p1End);
    p2End = Math.max(p1End + 1, adjustBoundary(p2End));
    if (p2End >= N) p2End = N - 1;

    const page1Nodes = bodyNodes.slice(0, p1End);
    const page2Nodes = bodyNodes.slice(p1End, p2End);
    const page3Nodes = bodyNodes.slice(p2End);

    /* ---- 7. 러닝 타이틀 추출 (제목에서 짧게) ---- */
    const runningTitle = title
      ? (textOf(title).length > 56 ? textOf(title).slice(0, 54) + '…' : textOf(title))
      : 'Research Article';

    /* ---- 8. DOM 구축 ---- */
    const paper = document.createElement('div');
    paper.className = 'jan-paper';

    const makeHeader = () => {
      const h = document.createElement('header');
      h.className = 'jan-header';
      h.innerHTML =
        '<span>' + escapeHtml(runningTitle) + '</span>' +
        '<span>SCIENCE (Draft)</span>';
      h.style.cssText = 'display:flex; justify-content:space-between; align-items:center;';
      return h;
    };
    const makeFooter = (n, total) => {
      const f = document.createElement('footer');
      f.className = 'jan-footer';
      f.textContent = 'Page ' + n + ' of ' + total + ' · DOI: 10.xxxx/placeholder';
      f.style.textAlign = 'center';
      return f;
    };
    const makeTwoCol = (children) => {
      const c = document.createElement('div');
      c.className = 'jan-two-col';
      c.style.cssText =
        'column-count:2; column-gap:18px; column-rule:1px solid rgba(0,0,0,0.08); ' +
        'text-align:justify; hyphens:auto;';
      children.forEach(ch => {
        // figure/table 은 column break 회피
        if (!isBreakable(ch)) {
          ch.style.breakInside = 'avoid';
          ch.style.webkitColumnBreakInside = 'avoid';
          ch.style.pageBreakInside = 'avoid';
        }
        c.appendChild(ch);
      });
      return c;
    };

    /* --- Page 1: 표지 메타 + TOC + Intro (2단) --- */
    const pg1 = document.createElement('section');
    pg1.className = 'jan-page';
    pg1.style.cssText = 'background:#fff; padding:24px 28px; margin-bottom:18px; box-shadow:0 1px 4px rgba(0,0,0,0.08); border:1px solid rgba(0,0,0,0.06);';
    pg1.appendChild(makeHeader());

    // 제목 블록 (전폭, 1단)
    const cover = document.createElement('div');
    cover.className = 'jan-cover';
    cover.style.cssText = 'text-align:center; padding:10px 0 16px; border-bottom:1px solid rgba(0,0,0,0.08); margin-bottom:14px;';
    if (title) {
      const h1 = document.createElement('h1');
      h1.style.cssText = 'font-size:22px; line-height:1.3; margin:4px 0 6px; font-weight:700;';
      h1.textContent = textOf(title);
      cover.appendChild(h1);
    }
    if (subtitle) {
      const h2 = document.createElement('div');
      h2.style.cssText = 'font-size:14px; color:#555; font-style:italic; margin-bottom:10px;';
      h2.textContent = textOf(subtitle);
      cover.appendChild(h2);
    }
    if (authors) {
      const a = document.createElement('div');
      a.style.cssText = 'font-size:13px; margin:6px 0;';
      a.textContent = textOf(authors);
      cover.appendChild(a);
    }
    if (affiliation) {
      const af = document.createElement('div');
      af.style.cssText = 'font-size:11px; color:#666; margin:3px 0;';
      af.textContent = textOf(affiliation);
      cover.appendChild(af);
    }
    if (corresponding) {
      const co = document.createElement('div');
      co.style.cssText = 'font-size:11px; color:#666; margin:3px 0;';
      co.textContent = textOf(corresponding);
      cover.appendChild(co);
    }
    pg1.appendChild(cover);

    // Abstract (전폭)
    if (abstractNode) {
      const abs = document.createElement('div');
      abs.className = 'jan-abstract';
      abs.style.cssText =
        'background:#f7f8fa; border-left:3px solid #1a4b8c; padding:10px 14px; ' +
        'margin:10px 0; font-size:12.5px; line-height:1.55;';
      const h = document.createElement('div');
      h.style.cssText = 'font-weight:700; font-size:11px; letter-spacing:0.1em; color:#1a4b8c; margin-bottom:4px;';
      h.textContent = 'ABSTRACT';
      abs.appendChild(h);
      const body = document.createElement('div');
      body.innerHTML = abstractNode.innerHTML || escapeHtml(textOf(abstractNode));
      abs.appendChild(body);
      if (keywords) {
        const kw = document.createElement('div');
        kw.style.cssText = 'margin-top:8px; font-size:11.5px; color:#444;';
        kw.textContent = textOf(keywords);
        abs.appendChild(kw);
      }
      pg1.appendChild(abs);
    } else if (keywords) {
      const kw = document.createElement('div');
      kw.style.cssText = 'margin:6px 0; font-size:11.5px; color:#444;';
      kw.textContent = textOf(keywords);
      pg1.appendChild(kw);
    }

    // 목차
    if (tocItems.length > 0) {
      const nav = document.createElement('nav');
      nav.className = 'jan-toc';
      nav.style.cssText =
        'background:#fafbfc; border:1px solid rgba(0,0,0,0.08); border-radius:6px; ' +
        'padding:10px 14px; margin:10px 0 14px; font-size:12px; line-height:1.6;';
      const th = document.createElement('div');
      th.style.cssText = 'font-weight:700; font-size:11px; letter-spacing:0.1em; color:#1a4b8c; margin-bottom:4px;';
      th.textContent = 'CONTENTS';
      nav.appendChild(th);
      tocItems.forEach(it => {
        const a = document.createElement('a');
        a.href = '#' + it.id;
        a.textContent = it.text;
        a.style.cssText =
          'display:block; color:#1f4fa8; text-decoration:none; ' +
          'padding-left:' + ((it.level - 2) * 14) + 'px;';
        nav.appendChild(a);
      });
      pg1.appendChild(nav);
    }

    // 본문 1단락 (2단)
    if (page1Nodes.length) pg1.appendChild(makeTwoCol(page1Nodes));
    pg1.appendChild(makeFooter(1, 3));
    paper.appendChild(pg1);

    /* --- Page 2: 중간 본문 (2단) --- */
    const pg2 = document.createElement('section');
    pg2.className = 'jan-page';
    pg2.style.cssText = pg1.style.cssText;
    pg2.appendChild(makeHeader());
    if (page2Nodes.length) pg2.appendChild(makeTwoCol(page2Nodes));
    pg2.appendChild(makeFooter(2, 3));
    paper.appendChild(pg2);

    /* --- Page 3: 말미 본문 + 참고문헌 --- */
    const pg3 = document.createElement('section');
    pg3.className = 'jan-page';
    pg3.style.cssText = pg1.style.cssText;
    pg3.appendChild(makeHeader());
    if (page3Nodes.length) pg3.appendChild(makeTwoCol(page3Nodes));
    // 참고문헌
    if (existingBib) {
      pg3.appendChild(existingBib.cloneNode(true));
    } else if (refNodes.length) {
      const bib = document.createElement('div');
      bib.className = 'jan-bibliography';
      const ol = document.createElement('ol');
      refNodes.forEach(r => {
        const t = textOf(r);
        if (!t) return;
        // [1] Author… 형태인 경우 괄호 제거, 라인 분리
        const lines = t.split(/\n|(?=\s*\[\d+\])/).map(s => s.trim()).filter(Boolean);
        if (lines.length > 1) {
          lines.forEach(line => {
            const cleaned = line.replace(/^\[\d+\]\s*/, '');
            if (!cleaned) return;
            const li = document.createElement('li');
            li.setAttribute('data-ref-id', 'ref-conv-' + Math.random().toString(36).slice(2, 9));
            li.textContent = cleaned;
            ol.appendChild(li);
          });
        } else {
          const cleaned = t.replace(/^\[\d+\]\s*/, '');
          const li = document.createElement('li');
          li.setAttribute('data-ref-id', 'ref-conv-' + Math.random().toString(36).slice(2, 9));
          li.textContent = cleaned;
          ol.appendChild(li);
        }
      });
      bib.appendChild(ol);
      pg3.appendChild(bib);
    }
    pg3.appendChild(makeFooter(3, 3));
    paper.appendChild(pg3);

    /* ---- 9. #page 내용 교체 ---- */
    page.innerHTML = '';
    page.appendChild(paper);

    /* ---- 10. 후처리 — 수식·Mermaid 재렌더, 번호 재정렬 ---- */
    try { await renderAllPaperFigures(page); } catch (e) { console.warn('[paper] figure 렌더 실패', e); }
    try { refreshNumbering(); } catch (e) {}
    try { renumberFootnotes(); } catch (e) {}
    try { renumberCitations(); } catch (e) {}
    try { if (typeof window.scheduleSave === 'function') window.scheduleSave(); } catch (e) {}

    notify('Science 최종본 3페이지 레이아웃으로 변환 완료');
    showUndoToast('Science 3페이지 변환 완료');
  }

  /* 논문 기능 도움말 모달 — v13: 카드 섹션 + kbd/code + [닫기] 버튼 단일 */
  function openPaperHelp() {
    const html =
      '<div class="jan-help">' +
        '<div class="jh-intro">' +
          '논문 작성에 필요한 모든 요소를 <strong>툴바 &ldquo;논문&rdquo; 메뉴</strong> 또는 ' +
          '<kbd>Ctrl</kbd>+<kbd>K</kbd> 로 빠르게 삽입할 수 있습니다.' +
        '</div>' +

        '<section class="jh-sec">' +
          '<h4>빠른 시작</h4>' +
          '<ul class="jh-list">' +
            '<li>' +
              '<span class="jh-label">논문 샘플 불러오기</span>' +
              '<span class="jh-how">툴바 <em>논문 &rsaquo; 빠른 시작 &rsaquo; 논문 샘플 불러오기</em></span>' +
            '</li>' +
            '<li>' +
              '<span class="jh-label">자동 변환 마법사</span>' +
              '<span class="jh-how">툴바 <em>논문 &rsaquo; 빠른 시작 &rsaquo; 논문 템플릿 마법사</em></span>' +
            '</li>' +
          '</ul>' +
        '</section>' +

        '<section class="jh-sec">' +
          '<h4>참조 &amp; 인용</h4>' +
          '<ul class="jh-list">' +
            '<li>' +
              '<span class="jh-label">각주 삽입</span>' +
              '<span class="jh-how"><kbd>Ctrl</kbd>+<kbd>K</kbd> &rarr; &ldquo;각주 삽입&rdquo;</span>' +
            '</li>' +
            '<li>' +
              '<span class="jh-label">인용 삽입</span>' +
              '<span class="jh-how"><kbd>Ctrl</kbd>+<kbd>K</kbd> &rarr; &ldquo;인용 삽입&rdquo; <span class="jh-hint">(먼저 참고문헌 추가)</span></span>' +
            '</li>' +
            '<li>' +
              '<span class="jh-label">참고문헌 항목</span>' +
              '<span class="jh-how">툴바 <em>논문 &rsaquo; 참조 &amp; 인용 &rsaquo; 참고문헌 항목 추가</em> <span class="jh-hint">(IEEE 스타일)</span></span>' +
            '</li>' +
          '</ul>' +
        '</section>' +

        '<section class="jh-sec">' +
          '<h4>자동 번호 매기기</h4>' +
          '<ul class="jh-list">' +
            '<li>' +
              '<span class="jh-label">수식 번호 (1)(2)&hellip;</span>' +
              '<span class="jh-how">태그 <code>&lt;figure class="jan-math"&gt;</code></span>' +
            '</li>' +
            '<li>' +
              '<span class="jh-label">Figure 번호</span>' +
              '<span class="jh-how">태그 <code>&lt;figure class="jan-fig"&gt;</code> + <code>&lt;figcaption&gt;</code></span>' +
            '</li>' +
            '<li>' +
              '<span class="jh-label">Table 번호</span>' +
              '<span class="jh-how">태그 <code>&lt;figure class="jan-tbl"&gt;</code> + <code>&lt;table&gt;</code> + <code>&lt;figcaption&gt;</code></span>' +
            '</li>' +
            '<li>' +
              '<span class="jh-label">번호 재정렬</span>' +
              '<span class="jh-how">툴바 <em>논문 &rsaquo; 번호 재정렬</em> <span class="jh-hint">(자동 실행, 수동 트리거도 가능)</span></span>' +
            '</li>' +
          '</ul>' +
        '</section>' +

        '<section class="jh-sec">' +
          '<h4>페이지 &middot; 레이아웃</h4>' +
          '<ul class="jh-list">' +
            '<li>' +
              '<span class="jh-label">페이지 구분</span>' +
              '<span class="jh-how">툴바 <em>논문 &rsaquo; 페이지 구분 삽입</em></span>' +
            '</li>' +
            '<li>' +
              '<span class="jh-label">2단 레이아웃</span>' +
              '<span class="jh-how">선택 영역을 <em>논문 &rsaquo; 2단 레이아웃 토글</em></span>' +
            '</li>' +
            '<li>' +
              '<span class="jh-label">러닝 헤더</span>' +
              '<span class="jh-how">모든 페이지 상단 반복 &mdash; <em>러닝 헤더 &middot; 꼬리말 설정</em></span>' +
            '</li>' +
          '</ul>' +
        '</section>' +

        '<section class="jh-sec">' +
          '<h4>다이어그램</h4>' +
          '<ul class="jh-list">' +
            '<li>' +
              '<span class="jh-label">Mermaid 자동 렌더</span>' +
              '<span class="jh-how">태그 <code>&lt;figure class="jan-diagram" data-mermaid-code="BASE64"&gt;</code></span>' +
            '</li>' +
            '<li>' +
              '<span class="jh-label">AI 구성도 &middot; 순서도</span>' +
              '<span class="jh-how">툴바 <em>미디어 &rsaquo; 학술 요소</em> &rarr; 선택 텍스트 자동 변환</span>' +
            '</li>' +
          '</ul>' +
        '</section>' +

        '<div class="jh-tip">' +
          '<strong>팁.</strong> 각주 &middot; 인용 &middot; 목차 링크는 클릭하면 해당 위치로 부드럽게 스크롤됩니다. ' +
          '실수로 파괴적 변환을 했으면 <kbd>Ctrl</kbd>+<kbd>Z</kbd> 로 최대 10단계까지 되돌릴 수 있습니다.' +
        '</div>' +
      '</div>';

    /* 공용 #modal 을 직접 조작 — OK 버튼 숨김 + Cancel 을 "닫기" 로 */
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    const ok = document.getElementById('modalOk');
    const cancel = document.getElementById('modalCancel');

    if (!modal || !title || !body || !ok || !cancel) {
      // fallback — 공용 showModalHtml
      if (typeof window.showModalHtml === 'function') {
        window.showModalHtml('논문 기능 도움말', html);
      } else {
        const w = window.open('', '_blank');
        if (w) { w.document.write('<h2>논문 기능 도움말</h2>' + html); w.document.close(); }
      }
      return;
    }

    // 기존 핸들러 해제 (충돌 방지)
    ok.onclick = null;
    cancel.onclick = null;

    // 원래 상태 보존
    const origOkDisplay = ok.style.display;
    const origCancelText = cancel.textContent;
    const origOkText = ok.textContent;

    title.textContent = '논문 기능 도움말';
    body.innerHTML = html;
    ok.style.display = 'none';
    cancel.textContent = '닫기';

    // 긴 도움말 콘텐츠 — 모달 넓이/높이 확장 + 내부 스크롤
    const modalBox = modal.querySelector('.modal') || modal;
    modalBox.classList.add('jan-wide');

    const close = () => {
      modal.classList.remove('open');
      modalBox.classList.remove('jan-wide');
      ok.style.display = origOkDisplay;
      cancel.textContent = origCancelText;
      ok.textContent = origOkText;
      ok.onclick = null;
      cancel.onclick = null;
      document.removeEventListener('keydown', escHandler);
    };
    const escHandler = (e) => { if (e.key === 'Escape') close(); };

    cancel.onclick = close;
    document.addEventListener('keydown', escHandler);
    modal.classList.add('open');
  }

  /* ============================================================
     v13 — 공용 커스텀 입력 폼 모달 (prompt() 대체)
     fields: [{ key, label, placeholder, type: 'text'|'textarea',
                default, hint }]
     반환: { key: value, ... } 또는 null (취소)
     ============================================================ */
  function paperPromptForm(title, fields, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const modal = document.getElementById('modal');
      const titleEl = document.getElementById('modalTitle');
      const body = document.getElementById('modalBody');
      const ok = document.getElementById('modalOk');
      const cancel = document.getElementById('modalCancel');

      if (!modal || !titleEl || !body || !ok || !cancel) {
        // fallback — 기본 prompt 연쇄
        const out = {};
        for (const f of fields) {
          const v = window.prompt(f.label + (f.hint ? ' (' + f.hint + ')' : ''), f.default || '');
          if (v === null) { resolve(null); return; }
          out[f.key] = v.trim();
        }
        resolve(out);
        return;
      }

      // 기존 핸들러 해제
      ok.onclick = null;
      cancel.onclick = null;

      // 원래 상태 보존
      const origOkDisplay = ok.style.display;
      const origOkText = ok.textContent;
      const origCancelText = cancel.textContent;

      titleEl.textContent = title;
      const introHtml = opts.intro
        ? '<div class="paper-form-intro">' + escapeHtml(opts.intro) + '</div>'
        : '';
      const fieldsHtml = fields.map(f => {
        const k = escapeHtml(f.key);
        const lbl = escapeHtml(f.label);
        const ph = escapeHtml(f.placeholder || '');
        const dv = escapeHtml(f.default || '');
        const hintHtml = f.hint
          ? '<div class="paper-form-hint">' + escapeHtml(f.hint) + '</div>'
          : '';
        const inputHtml = f.type === 'textarea'
          ? '<textarea data-k="' + k + '" placeholder="' + ph + '" rows="3">' + dv + '</textarea>'
          : '<input type="text" data-k="' + k + '" placeholder="' + ph + '" value="' + dv + '">';
        return '' +
          '<div class="paper-form-field">' +
            '<label>' + lbl + '</label>' +
            inputHtml +
            hintHtml +
          '</div>';
      }).join('');

      body.innerHTML = '<div class="paper-form">' + introHtml + fieldsHtml + '</div>';
      ok.style.display = '';
      ok.textContent = opts.okLabel || '삽입';
      cancel.textContent = '취소';

      // 3필드 이상이면 넓은 모달로 확장
      const modalBox = modal.querySelector('.modal') || modal;
      if (fields.length >= 2 || fields.some(f => f.type === 'textarea')) {
        modalBox.classList.add('jan-wide');
      }

      const restore = () => {
        modal.classList.remove('open');
        modalBox.classList.remove('jan-wide');
        ok.style.display = origOkDisplay;
        ok.textContent = origOkText;
        cancel.textContent = origCancelText;
        ok.onclick = null;
        cancel.onclick = null;
        document.removeEventListener('keydown', kh);
      };

      const confirmIt = () => {
        const vals = {};
        body.querySelectorAll('[data-k]').forEach(el => {
          vals[el.dataset.k] = (el.value || '').trim();
        });
        restore();
        resolve(vals);
      };
      const cancelIt = () => { restore(); resolve(null); };
      const kh = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); cancelIt(); }
        else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault(); confirmIt();
        }
        // 단일행 input 에서 Enter -> 확인 (textarea 는 제외)
        else if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT') {
          e.preventDefault(); confirmIt();
        }
      };

      ok.onclick = confirmIt;
      cancel.onclick = cancelIt;
      document.addEventListener('keydown', kh);
      modal.classList.add('open');
      setTimeout(() => {
        const first = body.querySelector('[data-k]');
        if (first) {
          try { first.focus(); if (first.select) first.select(); } catch (e) {}
        }
      }, 30);
    });
  }

  /* 첫 사용자 온보딩 배너 — 논문 샘플 로드 직후 한 번만 노출 */
  function showPaperOnboardingBanner() {
    try {
      if (localStorage.getItem('jan-paper-onboarding-dismissed') === '1') return;
    } catch (e) {}
    const old = document.getElementById('jan-paper-onboarding');
    if (old) old.remove();
    const banner = document.createElement('div');
    banner.id = 'jan-paper-onboarding';
    banner.style.cssText =
      'position:fixed; bottom:12px; right:12px; background:#fff; ' +
      'border:1px solid var(--accent, #1a4b8c); padding:10px 14px 10px 12px; ' +
      'border-radius:8px; z-index:9999; box-shadow:0 4px 16px rgba(0,0,0,0.15); ' +
      'max-width:360px; font-size:12.5px; line-height:1.5; color:#222; ' +
      'font-family:inherit; display:flex; align-items:flex-start; gap:10px;';
    banner.innerHTML =
      '<div style="flex:1 1 auto;">' +
        '<strong style="display:block; margin-bottom:3px; color:var(--accent, #1a4b8c);">논문 샘플이 삽입되었습니다</strong>' +
        '<span>팁: 각주·인용·참고문헌은 툴바 "논문" 메뉴 또는 ' +
        '<kbd style="background:#f2f4f7; border:1px solid #ddd; border-radius:3px; padding:0 4px; font-size:11px;">Ctrl+K</kbd> ' +
        '&rarr; "논문" 검색으로 사용할 수 있어요.</span>' +
        '<div style="margin-top:8px;"><button type="button" id="jan-paper-onboarding-help" ' +
        'style="background:transparent; border:1px solid #ddd; border-radius:5px; ' +
        'padding:4px 9px; font-size:11.5px; cursor:pointer; font-family:inherit;">' +
        '자세히 보기</button></div>' +
      '</div>' +
      '<button type="button" id="jan-paper-onboarding-close" aria-label="닫기" ' +
        'style="background:transparent; border:0; font-size:18px; line-height:1; ' +
        'cursor:pointer; color:#888; padding:0 2px; margin-top:-2px;">×</button>';
    document.body.appendChild(banner);
    banner.querySelector('#jan-paper-onboarding-close').addEventListener('click', () => {
      try { localStorage.setItem('jan-paper-onboarding-dismissed', '1'); } catch (e) {}
      banner.remove();
    });
    banner.querySelector('#jan-paper-onboarding-help').addEventListener('click', () => {
      openPaperHelp();
    });
    // 자동 닫힘 — 45초
    setTimeout(() => { if (banner.isConnected) banner.remove(); }, 45000);
  }

  /* 논문 서브메뉴 (툴바 버튼 클릭 시 작은 드롭다운) */
  function openPaperMenu(ev) {
    const old = document.getElementById('jan-paper-menu');
    if (old) { old.remove(); return; }
    const btn = ev.currentTarget;
    const rect = btn.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.id = 'jan-paper-menu';
    menu.style.cssText =
      'position:fixed; z-index:99998; background:#fff; border:1px solid #ddd; ' +
      'border-radius:8px; box-shadow:0 6px 24px rgba(0,0,0,0.14); padding:4px; ' +
      'min-width:200px; font-size:13px;';
    menu.style.top = (rect.bottom + 4) + 'px';
    menu.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - 220)) + 'px';
    const items = [
      { label: '논문 샘플 불러오기 (Science 포맷)', act: 'load-sample' },
      { label: '논문 템플릿 마법사 (자동 변환)', act: 'convert' },
      { label: '——', act: 'sep' },
      { label: '── 원자 기능 ──', act: 'heading-atoms' },
      { label: '러닝 헤더 · 꼬리말 설정', act: 'atom-headers' },
      { label: '저자 · 소속 · 교신 블록 삽입', act: 'atom-authors' },
      { label: 'Abstract 박스 삽입', act: 'atom-abstract' },
      { label: 'Keywords 블록 삽입', act: 'atom-keywords' },
      { label: 'TOC (목차) 자동 생성', act: 'atom-toc' },
      { label: '2단 레이아웃 토글', act: 'atom-twocol' },
      { label: '페이지 래퍼 (.jan-page) 감싸기', act: 'atom-wrap' },
      { label: '감사의 말 박스 삽입', act: 'atom-ack' },
      { label: '——', act: 'sep' },
      { label: '── 삽입 ──', act: 'heading-insert' },
      { label: '각주 삽입', act: 'footnote' },
      { label: '인용 삽입', act: 'cite' },
      { label: '참고문헌 항목 추가', act: 'bib-add' },
      { label: '참고문헌 영역으로 이동', act: 'bib-open' },
      { label: '페이지 구분 삽입', act: 'pagebreak' },
      { label: '번호 재정렬', act: 'renumber' },
      { label: '——', act: 'sep' },
      { label: '논문 기능 도움말', act: 'help' }
    ];
    items.forEach(it => {
      if (it.act === 'sep') {
        const sep = document.createElement('div');
        sep.style.cssText = 'height:1px; background:#eee; margin:4px 2px;';
        menu.appendChild(sep);
        return;
      }
      if (it.act === 'heading-atoms' || it.act === 'heading-insert') {
        const hd = document.createElement('div');
        hd.textContent = it.label;
        hd.style.cssText =
          'padding:4px 10px; font-size:10.5px; letter-spacing:0.08em; ' +
          'color:#888; text-transform:uppercase; font-weight:600;';
        menu.appendChild(hd);
        return;
      }
      const row = document.createElement('button');
      row.type = 'button';
      row.textContent = it.label;
      row.style.cssText =
        'display:block; width:100%; padding:7px 10px; background:transparent; border:0; ' +
        'text-align:left; cursor:pointer; font-family:inherit; font-size:13px; color:#222; ' +
        'border-radius:5px;';
      row.addEventListener('mouseenter', () => { row.style.background = '#FFE0EC'; });
      row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });
      row.addEventListener('click', () => {
        menu.remove();
        if (it.act === 'convert') convertToSciencePaper();
        else if (it.act === 'load-sample') loadPaperSample();
        else if (it.act === 'footnote') insertFootnote();
        else if (it.act === 'cite') insertCitation();
        else if (it.act === 'bib-add') addBibEntry();
        else if (it.act === 'bib-open') openBibManager();
        else if (it.act === 'pagebreak') insertPageBreak();
        else if (it.act === 'help') openPaperHelp();
        /* v10 — 원자 기능 */
        else if (it.act === 'atom-headers') configureHeaderFooter();
        else if (it.act === 'atom-authors') insertAuthorsBlock();
        else if (it.act === 'atom-abstract') insertAbstractBox();
        else if (it.act === 'atom-keywords') insertKeywordsBlock();
        else if (it.act === 'atom-toc') generateTOC();
        else if (it.act === 'atom-twocol') toggleTwoColumn();
        else if (it.act === 'atom-wrap') wrapAsPage();
        else if (it.act === 'atom-ack') insertAcknowledgments();
        else if (it.act === 'renumber') {
          renumberFootnotes();
          renumberCitations();
          refreshNumbering();
          notify('재정렬 완료');
        }
      });
      menu.appendChild(row);
    });
    document.body.appendChild(menu);
    // 바깥 클릭으로 닫기
    setTimeout(() => {
      function closer(e) {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', closer, true);
        }
      }
      document.addEventListener('click', closer, true);
    }, 10);
  }

  /* ============================================================
     v10 — 원자 기능 8종 (window.JANPaper.atoms.*)
     각자 선택 영역 또는 커서 위치에 독립 동작. 템플릿 마법사
     (convertToSciencePaper) 와 달리 **문서를 파괴하지 않음**.
     ============================================================ */

  /* 선택 범위가 있으면 그 Range 반환, 없으면 null. editable 영역 안인지 검사. */
  function getActiveRange() {
    const page = getPageEl();
    if (!page) return null;
    try {
      const sel = document.getSelection();
      if (!sel || sel.rangeCount === 0) return null;
      const r = sel.getRangeAt(0);
      // 페이지 안에 걸쳐있는지 확인
      if (!page.contains(r.commonAncestorContainer)) return null;
      return r;
    } catch (e) { return null; }
  }

  /* HTML 조각을 커서 위치에 삽입 (또는 선택 대체) */
  function insertHtmlAtCaret(html) {
    const page = getPageEl();
    if (!page) return false;
    restorePageSel();
    try {
      document.execCommand('insertHTML', false, html);
      return true;
    } catch (e) {
      page.insertAdjacentHTML('beforeend', html);
      return true;
    }
  }

  /* --- 1. 2단 레이아웃 토글 --- */
  function toggleTwoColumn() {
    const page = getPageEl();
    if (!page) { notify('편집 영역을 찾을 수 없습니다'); return; }
    pushPaperUndo('toggle-two-col');

    const r = getActiveRange();

    // 이미 jan-two-col 안에 있으면 풀기 (선택/커서 중 아무 지점이어도)
    let ancestor = null;
    if (r) {
      let n = r.commonAncestorContainer;
      if (n.nodeType === 3) n = n.parentNode;
      while (n && n !== page) {
        if (n.classList && n.classList.contains('jan-two-col')) { ancestor = n; break; }
        n = n.parentNode;
      }
    }
    if (ancestor) {
      // 풀기: 자식을 부모로 옮김
      const parent = ancestor.parentNode;
      while (ancestor.firstChild) parent.insertBefore(ancestor.firstChild, ancestor);
      parent.removeChild(ancestor);
      scheduleSave();
      notify('2단 레이아웃 해제');
      showUndoToast('2단 해제');
      return;
    }

    if (!r || r.collapsed) {
      notify('2단으로 만들 영역을 먼저 선택하세요');
      return;
    }
    // 선택 범위를 div.jan-two-col 로 감쌈
    try {
      const wrap = document.createElement('div');
      wrap.className = 'jan-two-col';
      wrap.appendChild(r.extractContents());
      r.insertNode(wrap);
      scheduleSave();
      notify('2단 레이아웃 적용');
      showUndoToast('2단 적용');
    } catch (e) {
      console.warn('[JANPaper] toggleTwoColumn 실패', e);
      notify('2단 변환 실패 — 블록 경계를 포함하도록 다시 선택해 주세요');
    }
  }

  /* --- 2. 러닝 헤더/꼬리말 설정 --- v13: prompt → paperPromptForm */
  async function configureHeaderFooter() {
    const page = getPageEl();
    if (!page) { notify('편집 영역을 찾을 수 없습니다'); return; }
    const pages = Array.from(page.querySelectorAll('.jan-page'));
    if (!pages.length) {
      notify('.jan-page 블록이 없습니다. 먼저 "논문 템플릿 마법사" 또는 "페이지 래퍼 감싸기" 로 만드세요');
      return;
    }

    const curTitle = (document.title || '').replace(' — JustANotepad', '') ||
                     (page.querySelector('h1,h2') && page.querySelector('h1,h2').textContent) || 'Untitled';
    const defaults = {
      hdrL: curTitle.trim(),
      hdrR: 'SCIENCE (Draft)',
      ftrL: 'DOI: 10.xxxx/placeholder',
      ftrR: 'Page N of M'
    };

    const vals = await paperPromptForm('러닝 헤더 · 꼬리말 설정', [
      { key: 'hdrL', label: '좌측 헤더 (러닝 타이틀)',
        placeholder: '논문 제목',
        default: defaults.hdrL,
        hint: '모든 페이지 상단 왼쪽에 반복 표시됩니다.' },
      { key: 'hdrR', label: '우측 헤더 (저널명 등)',
        placeholder: 'Nature, Science, ...',
        default: defaults.hdrR,
        hint: '저널명 · 권호 · 초안 표식 등' },
      { key: 'ftrL', label: '좌측 푸터 (DOI 등)',
        placeholder: 'DOI: 10.xxxx/...',
        default: defaults.ftrL,
        hint: 'DOI · 저작권 · 라이선스 표기' },
      { key: 'ftrR', label: '우측 푸터 (페이지 번호 패턴)',
        placeholder: 'Page N of M',
        default: defaults.ftrR,
        hint: 'N → 현재 페이지 번호, M → 총 페이지 수로 자동 치환' }
    ], { okLabel: '적용',
         intro: pages.length + '개 페이지에 헤더 · 꼬리말을 일괄 적용합니다. 기존 헤더 · 꼬리말은 교체됩니다.' });

    if (!vals) return;
    const hdrL = vals.hdrL || '';
    const hdrR = vals.hdrR || '';
    const ftrL = vals.ftrL || '';
    const ftrR = vals.ftrR || 'Page N of M';

    pushPaperUndo('configure-headers');
    const total = pages.length;
    pages.forEach((pg, idx) => {
      // 기존 .jan-header / .jan-footer 제거 후 재삽입
      pg.querySelectorAll(':scope > .jan-header, :scope > .jan-footer').forEach(el => el.remove());
      const pageNo = idx + 1;
      const ftrRResolved = ftrR
        .replace(/\bN\b/, String(pageNo))
        .replace(/\bM\b/, String(total));

      const h = document.createElement('div');
      h.className = 'jan-header';
      h.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:10px;';
      h.innerHTML =
        '<span>' + escapeHtml(hdrL) + '</span>' +
        '<span>' + escapeHtml(hdrR) + '</span>';
      pg.insertBefore(h, pg.firstChild);

      const f = document.createElement('div');
      f.className = 'jan-footer';
      f.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:10px;';
      f.innerHTML =
        '<span>' + escapeHtml(ftrL) + '</span>' +
        '<span>' + escapeHtml(ftrRResolved) + '</span>';
      pg.appendChild(f);
    });
    scheduleSave();
    notify('헤더 · 꼬리말 적용됨 (' + total + '페이지)');
    showUndoToast('헤더 · 꼬리말');
  }

  /* --- 3. 저자 · 소속 · 교신 블록 --- v13: prompt → paperPromptForm */
  async function insertAuthorsBlock() {
    const page = getPageEl();
    if (!page) { notify('편집 영역을 찾을 수 없습니다'); return; }

    const vals = await paperPromptForm('저자 · 소속 · 교신 정보', [
      { key: 'authors', label: '저자',
        placeholder: 'Hong Gildong, Kim Cheolsoo, Lee Yeonghui',
        default: 'Hong Gildong, Kim Cheolsoo, Lee Yeonghui',
        hint: '쉼표(,) 로 구분. 순서대로 1, 2, 3 ... 슈퍼스크립트를 자동 부여합니다.' },
      { key: 'affils', label: '소속', type: 'textarea',
        placeholder: 'Dept. of Physics, SNU | Dept. of Chemistry, KAIST',
        default: 'Dept. of Physics, Seoul National Univ. | Dept. of Chemistry, KAIST',
        hint: '파이프(|) 또는 줄바꿈으로 구분. 저자 순서에 맞게 1, 2, 3 ...' },
      { key: 'email', label: '교신저자 이메일',
        placeholder: 'author@univ.ac.kr',
        default: 'corresponding@univ.ac.kr',
        hint: '비워두면 Corresponding 줄은 생략됩니다.' }
    ], { okLabel: '삽입',
         intro: '저자명(슈퍼스크립트 자동 부여) · 소속 · 교신저자 이메일 블록을 커서 위치에 삽입합니다.' });

    if (!vals) return;
    const authorsStr = vals.authors || '';
    const affilStr = vals.affils || '';
    const email = vals.email || '';

    const authors = authorsStr.split(',').map(s => s.trim()).filter(Boolean);
    const affils = affilStr.split(/\s*\|\s*|\n/).map(s => s.trim()).filter(Boolean);
    const authorsHtml = authors.map((a, i) => {
      const sup = affils.length > 1 ? ('<sup>' + ((i % affils.length) + 1) + '</sup>') : '';
      return escapeHtml(a) + sup;
    }).join(', ');
    const affilHtml = affils.map((s, i) => {
      const sup = affils.length > 1 ? ('<sup>' + (i + 1) + '</sup> ') : '';
      return sup + escapeHtml(s);
    }).join(' &nbsp; ');

    const html =
      '<p class="jan-authors">' + authorsHtml + '</p>' +
      '<p class="jan-affil">' + affilHtml + '</p>' +
      (email.trim()
        ? '<p class="jan-corresponding">Corresponding: <code>' + escapeHtml(email.trim()) + '</code></p>'
        : '');

    pushPaperUndo('insert-authors');
    insertHtmlAtCaret(html);
    scheduleSave();
    notify('저자 블록 삽입됨');
    showUndoToast('저자 블록');
  }

  /* --- 4. Abstract 박스 --- */
  function insertAbstractBox() {
    const page = getPageEl();
    if (!page) { notify('편집 영역을 찾을 수 없습니다'); return; }
    const r = getActiveRange();
    let body = '여기에 요약을 작성하세요 — 배경·방법·결과·의의를 2~4문장으로 요약.';
    let replace = false;
    if (r && !r.collapsed) {
      const txt = r.toString().trim();
      if (txt) { body = escapeHtml(txt); replace = true; }
    }
    const html =
      '<div class="jan-abstract">' +
        '<strong>ABSTRACT.</strong>' +
        '<p>' + body + '</p>' +
      '</div>';
    pushPaperUndo('insert-abstract');
    if (replace && r) {
      // 선택 영역 교체
      r.deleteContents();
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      while (tmp.firstChild) r.insertNode(tmp.firstChild);
    } else {
      insertHtmlAtCaret(html);
    }
    scheduleSave();
    notify('Abstract 박스 삽입됨');
    showUndoToast('Abstract');
  }

  /* --- 5. Keywords --- v13: prompt → paperPromptForm */
  async function insertKeywordsBlock() {
    const page = getPageEl();
    if (!page) { notify('편집 영역을 찾을 수 없습니다'); return; }

    const vals = await paperPromptForm('Keywords 삽입', [
      { key: 'kws', label: '키워드', type: 'textarea',
        placeholder: 'quantum entanglement, superconductor, Bell inequality',
        default: 'quantum entanglement, superconductor, Bell inequality',
        hint: '쉼표(,) 로 구분. 보통 3 ~ 6 개 권장.' }
    ], { okLabel: '삽입',
         intro: '초록 아래 Keywords 한 줄을 커서 위치에 삽입합니다.' });

    if (!vals) return;
    const kws = vals.kws || '';
    if (!kws.trim()) { notify('키워드가 비어 있습니다'); return; }
    const list = kws.split(',').map(s => s.trim()).filter(Boolean).map(escapeHtml).join(', ');
    const html = '<p class="jan-keywords"><strong>Keywords:</strong> ' + list + '</p>';
    pushPaperUndo('insert-keywords');
    insertHtmlAtCaret(html);
    scheduleSave();
    notify('Keywords 삽입됨');
    showUndoToast('Keywords');
  }

  /* --- 6. TOC 자동 생성 --- */
  function generateTOC() {
    const page = getPageEl();
    if (!page) { notify('편집 영역을 찾을 수 없습니다'); return; }
    const heads = Array.from(page.querySelectorAll('h2, h3, h4'))
      .filter(h => !h.closest('.jan-toc') && !h.closest('.jan-header') && !h.closest('.jan-footer'));
    if (!heads.length) {
      notify('h2/h3/h4 제목이 없습니다. 먼저 헤딩을 추가하세요');
      return;
    }
    pushPaperUndo('generate-toc');

    // id 부여 (없는 것만)
    heads.forEach((h, i) => {
      if (!h.id) {
        const slug = (h.textContent || '').trim()
          .toLowerCase()
          .replace(/[^\w가-힣\s-]/g, '')
          .replace(/\s+/g, '-')
          .slice(0, 40);
        h.id = 'sec-' + (slug || (i + 1));
      }
    });

    // 기존 TOC 제거 (재생성)
    page.querySelectorAll('.jan-toc').forEach(el => el.remove());

    const nav = document.createElement('nav');
    nav.className = 'jan-toc';
    const title = document.createElement('h4');
    title.textContent = 'CONTENTS';
    nav.appendChild(title);
    const ol = document.createElement('ol');
    heads.forEach(h => {
      const level = parseInt(h.tagName.substring(1), 10); // 2, 3, 4
      const li = document.createElement('li');
      li.className = 'jan-toc-l' + level;
      const a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = (h.textContent || '').trim();
      li.appendChild(a);
      ol.appendChild(li);
    });
    nav.appendChild(ol);

    // 삽입 위치 — 커서 있으면 커서, 없으면 첫 헤딩 앞 (또는 첫 .jan-page 안 맨 앞)
    const r = getActiveRange();
    if (r && page.contains(r.commonAncestorContainer)) {
      r.deleteContents();
      r.insertNode(nav);
    } else {
      const firstPage = page.querySelector('.jan-page');
      if (firstPage) firstPage.insertBefore(nav, firstPage.firstChild);
      else if (heads[0] && heads[0].parentNode) heads[0].parentNode.insertBefore(nav, heads[0]);
      else page.insertBefore(nav, page.firstChild);
    }
    scheduleSave();
    notify('TOC 생성됨 (' + heads.length + '개 항목)');
    showUndoToast('TOC 생성');
  }

  /* --- 7. 페이지 래퍼 (.jan-page) 감싸기 --- */
  async function wrapAsPage() {
    const page = getPageEl();
    if (!page) { notify('편집 영역을 찾을 수 없습니다'); return; }
    const r = getActiveRange();

    // 선택 영역이 있으면 감싸기
    if (r && !r.collapsed) {
      pushPaperUndo('wrap-page');
      try {
        const sec = document.createElement('section');
        sec.className = 'jan-page';
        sec.appendChild(r.extractContents());
        r.insertNode(sec);
        scheduleSave();
        notify('페이지 래퍼 감쌈');
        showUndoToast('페이지 래퍼');
        return;
      } catch (e) {
        console.warn('[JANPaper] wrapAsPage 실패', e);
        notify('감싸기 실패 — 블록 경계를 포함하도록 재선택');
        return;
      }
    }

    // 선택 없고 이미 jan-page 있으면 안내만
    if (page.querySelector('.jan-page')) {
      notify('이미 .jan-page 가 있습니다. 감쌀 영역을 먼저 선택하세요');
      return;
    }

    // 전혀 없는 상태 — 전체를 한 페이지로 감쌈
    if (!confirm('현재 노트 전체를 한 개의 .jan-page 로 감쌉니다. 계속할까요?')) return;
    pushPaperUndo('wrap-page-all');
    const sec = document.createElement('section');
    sec.className = 'jan-page';
    while (page.firstChild) sec.appendChild(page.firstChild);
    page.appendChild(sec);
    scheduleSave();
    notify('전체 노트를 .jan-page 로 감쌌습니다');
    showUndoToast('페이지 래퍼 (전체)');
  }

  /* --- 8. 감사의 말 박스 --- v13: 선택 없으면 커스텀 폼 모달 */
  async function insertAcknowledgments() {
    const page = getPageEl();
    if (!page) { notify('편집 영역을 찾을 수 없습니다'); return; }
    const r = getActiveRange();

    let body;
    let replace = false;

    if (r && !r.collapsed) {
      const txt = r.toString().trim();
      if (txt) { body = escapeHtml(txt); replace = true; }
    }

    if (!body) {
      // 선택 없음 → 커스텀 폼 모달로 내용 입력 받기
      const vals = await paperPromptForm('감사의 말 (Acknowledgments)', [
        { key: 'body', label: '감사 내용', type: 'textarea',
          placeholder: '본 연구는 XX재단의 지원(과제번호 ...)을 받아 수행되었습니다. ...',
          default: '본 연구는 [기관명]의 지원(과제번호 [번호])을 받아 수행되었습니다. 저자들은 유익한 토론을 해주신 [이름] 박사님께 감사드립니다.',
          hint: '자금 지원 · 데이터 제공 · 토론에 도움 준 분들을 적습니다. 비워두면 플레이스홀더 문장이 들어갑니다.' }
      ], { okLabel: '삽입',
           intro: '감사의 말 박스를 커서 위치에 삽입합니다. 본문에서 먼저 텍스트를 선택하고 실행하면 해당 텍스트가 사용됩니다.' });

      if (!vals) return;
      const raw = (vals.body || '').trim();
      body = raw
        ? escapeHtml(raw)
        : '여기에 감사 내용을 작성하세요 &mdash; 자금 지원, 자료 제공, 토론에 도움 준 분들.';
    }

    const html =
      '<div class="jan-ack">' +
        '<strong>Acknowledgments.</strong>' +
        '<p>' + body + '</p>' +
      '</div>';
    pushPaperUndo('insert-ack');
    if (replace && r) {
      r.deleteContents();
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      while (tmp.firstChild) r.insertNode(tmp.firstChild);
    } else {
      insertHtmlAtCaret(html);
    }
    scheduleSave();
    notify('감사의 말 박스 삽입됨');
    showUndoToast('감사의 말');
  }

  /* ============================================================
     v15: 페이지 크기 시스템 (A4/A3/B4 · 세로/가로)
     ------------------------------------------------------------
     탭별로 페이지 크기를 지정 → 에디터가 종이처럼 렌더.
     - 클래스: .page.jan-paged + .jan-paged-a4p 등 (CSS 변수)
     - 상태 저장: currentTab().pageSize = 'a4p' | 'a4l' | ... | 'none'
     - renderPage() 훅: 탭 전환 시 자동 복원 (app.html 측 호환)
     ============================================================ */
  const PAGE_SIZES = {
    'none': { cls: null,              label: '페이지 구분 없음 (자유 길이)', dim: '' },
    'a4p':  { cls: 'jan-paged-a4p',   label: 'A4 · 세로',   dim: '210 × 297 mm' },
    'a4l':  { cls: 'jan-paged-a4l',   label: 'A4 · 가로',   dim: '297 × 210 mm' },
    'a3p':  { cls: 'jan-paged-a3p',   label: 'A3 · 세로',   dim: '297 × 420 mm' },
    'a3l':  { cls: 'jan-paged-a3l',   label: 'A3 · 가로',   dim: '420 × 297 mm' },
    'b4p':  { cls: 'jan-paged-b4p',   label: 'B4 · 세로',   dim: '250 × 353 mm' },
    'b4l':  { cls: 'jan-paged-b4l',   label: 'B4 · 가로',   dim: '353 × 250 mm' }
  };

  function setPageSize(key) {
    const page = getPageEl();
    if (!page) return;
    if (!PAGE_SIZES[key]) key = 'none';
    /* 기존 jan-paged* 클래스 제거 */
    page.classList.remove('jan-paged');
    Object.values(PAGE_SIZES).forEach(s => {
      if (s.cls) page.classList.remove(s.cls);
    });
    /* 새 크기 적용 */
    if (key !== 'none') {
      page.classList.add('jan-paged', PAGE_SIZES[key].cls);
    }
    /* 현재 탭에 영속 — state.tabs[i].pageSize. v15-fix: 디바운스 저장 (scheduleSave) 우선 */
    try {
      if (typeof window.currentTab === 'function') {
        const t = window.currentTab();
        if (t) t.pageSize = key;
        if (typeof window.scheduleSave === 'function') window.scheduleSave();
        else if (typeof window.save === 'function') window.save();
      }
    } catch (e) { console.warn('[JANPaper] setPageSize 저장 실패', e); }
    /* v16: 페이지 시트 오버레이 재계산 */
    updatePageSheets();
    notify('페이지 크기: ' + (PAGE_SIZES[key].label || '없음'));
  }

  function getPageSize() {
    try {
      const t = typeof window.currentTab === 'function' ? window.currentTab() : null;
      return (t && t.pageSize) || 'none';
    } catch { return 'none'; }
  }

  /* 탭 전환 / 페이지 렌더 후 호출 — 저장된 pageSize 를 시각적으로 복원 */
  function applyPageSizeFromTab() {
    const key = getPageSize();
    const page = getPageEl();
    if (!page) return;
    page.classList.remove('jan-paged');
    Object.values(PAGE_SIZES).forEach(s => {
      if (s.cls) page.classList.remove(s.cls);
    });
    if (key !== 'none' && PAGE_SIZES[key]) {
      page.classList.add('jan-paged', PAGE_SIZES[key].cls);
    }
    /* v16: 페이지 시트 오버레이 업데이트 */
    updatePageSheets();
  }

  /* ============================================================
     v16: stacked sheets — 콘텐츠가 페이지 높이를 넘으면 뒤에 종이 추가
     ------------------------------------------------------------
     - 페이지 크기 지정되지 않음 ('none') 시 : 오버레이 제거
     - 콘텐츠 높이 측정 → 필요 페이지 수 계산 → 오버레이에 N 장 종이 쌓기
     - 페이지 사이 24px gap 이 pink 배경을 노출 → 시각적 분리
     ============================================================ */
  const SHEET_GAP = 24;   // px, 종이 사이 간격

  /* mm → px 변환 (1mm ≈ 3.7795px @ 96dpi) */
  function mmToPx(mmValue) {
    return parseFloat(mmValue) * 96 / 25.4;
  }

  /* v31: 논문식 .jan-doc-page wrapper 방식.
     - 페이지 크기 설정 시: 기존 콘텐츠를 하나의 .jan-doc-page 로 wrap
     - 페이지 구분 삽입 시: 커서 이후 콘텐츠를 새 .jan-doc-page 로 split
     - 페이지 크기 해제 시: 모든 .jan-doc-page wrapper 제거, 콘텐츠를 .page 로 flatten
     - 오버레이/observer/rebalance 모두 없음 → 타이핑 완전 정상 */
  let _sheetsUpdatePending = false;
  function updatePageSheets() {
    const page = getPageEl();
    if (!page) return;
    const wrap = page.parentElement;
    if (!wrap) return;
    /* 이전 버전 잔재 제거 */
    const outerSheets = wrap.querySelector(':scope > .jan-page-sheets');
    if (outerSheets) outerSheets.remove();
    const innerSheets = page.querySelector(':scope > .jan-page-sheets');
    if (innerSheets) innerSheets.remove();
    const existingLabels = page.querySelector(':scope > .jan-page-labels');
    if (existingLabels) existingLabels.remove();
    Array.from(page.children).forEach(c => {
      if (c.dataset && c.dataset.janPgShift) {
        c.style.marginTop = c.dataset.janPgOrigMt || '';
        delete c.dataset.janPgShift;
        delete c.dataset.janPgOrigMt;
      }
    });
    ['background-image','background-color','background-size','background-repeat',
     'background-attachment','background-position','box-shadow','border','min-height'
    ].forEach(prop => page.style.removeProperty(prop));

    /* v31: jan-paged 상태라면 자식을 .jan-doc-page 로 래핑 */
    if (page.classList.contains('jan-paged')) {
      wrapContentInDocPages(page);
      /* v32: 초기 자동 split — 긴 콘텐츠 처음부터 페이지 분할 */
      try { setupAutoSplitObserver(); } catch {}
      scheduleAutoSplit();
    } else {
      unwrapDocPages(page);
    }
  }

  /* 콘텐츠 하위를 .jan-doc-page 로 래핑 (이미 래핑돼 있으면 skip).
     v35: Google Docs 방식 — 각 .jan-doc-page 가 자체 contenteditable="true",
     부모 #page 는 contenteditable="false" 로 전환. */
  function wrapContentInDocPages(page) {
    /* v35: 부모 #page 의 contenteditable 을 false 로 (각 페이지가 독립 편집) */
    try {
      if (page.getAttribute('contenteditable') !== 'false') {
        page.dataset.janOrigCe = page.getAttribute('contenteditable') || 'true';
        page.setAttribute('contenteditable', 'false');
      }
    } catch {}

    /* 이미 최상위 자식들이 모두 .jan-doc-page 이면 skip */
    const children = Array.from(page.childNodes).filter(n =>
      n.nodeType === Node.ELEMENT_NODE || (n.nodeType === Node.TEXT_NODE && n.textContent.trim())
    );
    const allWrapped = children.length > 0 && children.every(n =>
      n.nodeType === Node.ELEMENT_NODE && n.classList && n.classList.contains('jan-doc-page')
    );
    if (allWrapped) {
      /* 각 페이지에 contenteditable="true" 보장 */
      children.forEach(c => {
        if (c.getAttribute && c.getAttribute('contenteditable') !== 'true') {
          c.setAttribute('contenteditable', 'true');
        }
      });
      return;
    }
    try { pushPaperUndo('page-wrap'); } catch {}
    const wrapDiv = document.createElement('div');
    wrapDiv.className = 'jan-doc-page';
    wrapDiv.setAttribute('contenteditable', 'true');  /* v35: 독립 편집 */
    while (page.firstChild) {
      const c = page.firstChild;
      if (c.nodeType === Node.ELEMENT_NODE && c.classList && c.classList.contains('jan-doc-page')) {
        page.removeChild(c);
        page.appendChild(c);
        if (c.getAttribute('contenteditable') !== 'true') {
          c.setAttribute('contenteditable', 'true');
        }
        break;
      } else {
        wrapDiv.appendChild(c);
      }
    }
    if (!wrapDiv.innerHTML.trim()) {
      wrapDiv.innerHTML = '<p><br></p>';
    }
    page.insertBefore(wrapDiv, page.firstChild);
  }

  /* .jan-doc-page 래퍼 제거 — 모든 자식 콘텐츠를 .page 최상위로 flatten.
     v35: 부모 #page 의 contenteditable 복원 */
  function unwrapDocPages(page) {
    const docPages = Array.from(page.querySelectorAll(':scope > .jan-doc-page'));
    /* v35: 부모 contenteditable 복원 */
    try {
      const orig = page.dataset.janOrigCe || 'true';
      page.setAttribute('contenteditable', orig);
      delete page.dataset.janOrigCe;
    } catch {}
    if (docPages.length === 0) return;
    try { pushPaperUndo('page-unwrap'); } catch {}
    docPages.forEach(dp => {
      while (dp.firstChild) page.insertBefore(dp.firstChild, dp);
      dp.remove();
    });
  }

  /* ============================================================
     v32: 페이지 자동 split — .jan-doc-page 가 pageH 넘치면 overflow 블록을 다음 페이지로 이동
     ============================================================ */
  let _autoSplitPending = false;
  let _isComposingSplit = false;
  /* v33: 디바운스 축소 (350ms → 80ms) + requestAnimationFrame 으로 layout 후 실행 */
  function scheduleAutoSplit() {
    if (_autoSplitPending) return;
    _autoSplitPending = true;
    setTimeout(() => {
      requestAnimationFrame(() => {
        _autoSplitPending = false;
        if (_isComposingSplit) return;
        try { autoSplitOverflowingPages(); } catch (e) { console.warn('[JANPaper] autoSplit 실패', e); }
      });
    }, 80);
  }
  function autoSplitOverflowingPages() {
    const page = getPageEl();
    if (!page || !page.classList.contains('jan-paged')) return;
    const computed = getComputedStyle(page);
    const pageHmm = parseFloat(computed.getPropertyValue('--page-h')) || 297;
    const pageHpx = mmToPx(pageHmm);

    /* v33: selection 저장 — DOM 조작 후 커서 유지 */
    const sel = window.getSelection();
    let savedRange = null;
    if (sel && sel.rangeCount > 0) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }

    /* 반복 처리 — 각 페이지 검사, overflow 시 다음 페이지로 이동.
       v33: padding-bottom 도 고려해서 훨씬 일찍 split (content 가 bottom margin 까지 침범하면 OUT) */
    let maxIter = 30;  /* 무한 루프 방지 */
    let modified = true;
    while (modified && maxIter-- > 0) {
      modified = false;
      const docPages = Array.from(page.querySelectorAll(':scope > .jan-doc-page'));
      for (let i = 0; i < docPages.length; i++) {
        const dp = docPages[i];
        const dpHeight = dp.offsetHeight;
        /* v33: bottom padding 읽어서 허용 영역 계산 */
        const dpComputed = getComputedStyle(dp);
        const padBottom = parseFloat(dpComputed.paddingBottom) || 0;
        /* 콘텐츠가 margin area 침범하면 split — pageH - padBottom 을 한계로 */
        const safeBottomInPage = pageHpx - padBottom;
        /* 짧은 페이지는 skip */
        if (dpHeight <= safeBottomInPage + 2) continue;

        const dpRect = dp.getBoundingClientRect();
        const allowBottom = dpRect.top + safeBottomInPage;

        /* 자식 중에 overflow 시작점 찾기 */
        const children = Array.from(dp.children).filter(c =>
          c.nodeType === Node.ELEMENT_NODE
        );
        let overflowIdx = -1;
        for (let j = 0; j < children.length; j++) {
          const cRect = children[j].getBoundingClientRect();
          /* 블록 끝이 허용 영역을 넘음 OR 블록 시작이 margin 영역에 있으면 overflow */
          if (cRect.bottom > allowBottom + 1 || cRect.top > allowBottom) {
            /* 한 페이지보다 큰 블록은 이동 불가 */
            if (cRect.height > pageHpx * 0.95) {
              overflowIdx = (j === 0) ? -1 : j;
              if (overflowIdx === -1) break;
            } else {
              overflowIdx = j;
            }
            break;
          }
        }
        if (overflowIdx < 0) continue;

        /* 다음 페이지 확보 */
        let nextDp = dp.nextElementSibling;
        if (!nextDp || !nextDp.classList || !nextDp.classList.contains('jan-doc-page')) {
          nextDp = document.createElement('div');
          nextDp.className = 'jan-doc-page';
          nextDp.setAttribute('contenteditable', 'true');  /* v35 */
          dp.parentNode.insertBefore(nextDp, dp.nextSibling);
        }

        /* overflow 블록들을 다음 페이지 앞쪽으로 이동 */
        const toMove = children.slice(overflowIdx);
        /* 다음 페이지에 '<p><br></p>' 빈 자식만 있으면 제거 */
        if (nextDp.children.length === 1) {
          const onlyChild = nextDp.firstElementChild;
          if (onlyChild && onlyChild.tagName === 'P' &&
              onlyChild.childNodes.length === 1 &&
              onlyChild.firstChild && onlyChild.firstChild.nodeName === 'BR') {
            nextDp.innerHTML = '';
          }
        }
        /* 역순으로 insertBefore (다음 페이지 첫 자식 앞에) */
        for (let j = toMove.length - 1; j >= 0; j--) {
          nextDp.insertBefore(toMove[j], nextDp.firstChild);
        }
        modified = true;
      }
    }

    /* 빈 페이지 (마지막 제외) 제거 + 여유 있는 페이지에 다음 페이지 콘텐츠 당기기 (선택적, 보수적) */
    consolidateDocPages(page, pageHpx);

    /* v33: 저장된 selection 복원 — DOM 조작으로 sel 이 이탈했으면 재적용.
       + 커서가 다른 페이지로 이동했으면 scrollIntoView 로 보이게. */
    if (savedRange) {
      try {
        const sel2 = window.getSelection();
        if (savedRange.startContainer && page.contains(savedRange.startContainer)) {
          sel2.removeAllRanges();
          sel2.addRange(savedRange);
          /* 커서가 있는 블록의 부모 .jan-doc-page 찾아서 화면에 보이게 */
          let cursorPage = savedRange.startContainer;
          if (cursorPage.nodeType === Node.TEXT_NODE) cursorPage = cursorPage.parentElement;
          while (cursorPage && cursorPage !== page) {
            if (cursorPage.classList && cursorPage.classList.contains('jan-doc-page')) break;
            cursorPage = cursorPage.parentElement;
          }
          if (cursorPage && cursorPage.classList && cursorPage.classList.contains('jan-doc-page')) {
            /* 커서가 화면 밖에 있으면 스크롤 */
            const rect = cursorPage.getBoundingClientRect();
            const viewH = window.innerHeight;
            if (rect.top < 0 || rect.top > viewH * 0.8) {
              cursorPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        }
      } catch {}
    }
  }

  /* 페이지들 사이 콘텐츠 밸런싱: 이전 페이지에 여유 있으면 다음 페이지 첫 블록 당김 */
  function consolidateDocPages(page, pageHpx) {
    let changed = true;
    let iter = 30;
    while (changed && iter-- > 0) {
      changed = false;
      const docPages = Array.from(page.querySelectorAll(':scope > .jan-doc-page'));
      for (let i = 0; i < docPages.length - 1; i++) {
        const dp = docPages[i];
        const nextDp = docPages[i + 1];
        /* 다음 페이지 첫 블록을 가져왔을 때 현재 페이지가 pageH 이하로 유지되면 당김 */
        const firstNext = nextDp.firstElementChild;
        if (!firstNext) continue;
        const nextFirstRect = firstNext.getBoundingClientRect();
        if (nextFirstRect.height > pageHpx * 0.95) continue;  /* 거대 블록은 skip */
        /* 시뮬레이션: 현재 페이지 하단에 추가했을 때 높이 */
        const dpBottom = dp.getBoundingClientRect().bottom;
        /* 현재 페이지가 이미 pageH 에 꽉 차면 skip */
        if (dp.offsetHeight > pageHpx * 0.92) continue;
        /* 여유 공간이 블록 높이보다 큼 — 당겨오기 */
        const spare = pageHpx - dp.offsetHeight;
        if (spare > nextFirstRect.height + 10) {
          dp.appendChild(firstNext);
          changed = true;
          /* 다음 페이지가 비었으면 삭제 (마지막 페이지면 유지) */
          if (nextDp.children.length === 0 && i + 1 < docPages.length - 1) {
            nextDp.remove();
          }
        }
      }
    }
  }

  /* 편집 이벤트 리스너 — scheduleAutoSplit 트리거.
     v33: ResizeObserver 로 .jan-doc-page 높이 변화를 직접 감지 → 더 빠른 반응. */
  let _resizeObserver = null;
  function setupAutoSplitObserver() {
    const page = getPageEl();
    if (!page || page._autoSplitBound) return;
    page._autoSplitBound = true;
    page.addEventListener('compositionstart', () => { _isComposingSplit = true; });
    page.addEventListener('compositionend', () => {
      _isComposingSplit = false;
      scheduleAutoSplit();
    });
    page.addEventListener('input', () => {
      if (!page.classList.contains('jan-paged')) return;
      scheduleAutoSplit();
    });
    /* v33: ResizeObserver — 각 .jan-doc-page 높이 변화 직접 관찰 */
    if (typeof ResizeObserver !== 'undefined') {
      _resizeObserver = new ResizeObserver(() => {
        if (!page.classList.contains('jan-paged')) return;
        scheduleAutoSplit();
      });
      /* 기존/신규 .jan-doc-page 에 옵저버 연결 */
      const mutObs = new MutationObserver(() => {
        page.querySelectorAll(':scope > .jan-doc-page').forEach(dp => {
          if (!dp._resizeObserved) {
            dp._resizeObserved = true;
            try { _resizeObserver.observe(dp); } catch {}
          }
        });
      });
      mutObs.observe(page, { childList: true });
      /* 초기 연결 */
      page.querySelectorAll(':scope > .jan-doc-page').forEach(dp => {
        if (!dp._resizeObserved) {
          dp._resizeObserved = true;
          _resizeObserver.observe(dp);
        }
      });
    }
    /* 초기 1회 */
    setTimeout(() => {
      if (page.classList.contains('jan-paged')) scheduleAutoSplit();
    }, 300);
  }

  /* 사용자가 페이지 구분 요청 시 — 커서 이후 콘텐츠를 새 .jan-doc-page 로 split */
  function splitAtCursorToNewDocPage() {
    const page = getPageEl();
    if (!page || !page.classList.contains('jan-paged')) {
      return false;
    }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    const range = sel.getRangeAt(0);
    /* 현재 커서가 있는 .jan-doc-page 찾기 */
    let cur = range.startContainer;
    while (cur && cur !== page) {
      if (cur.nodeType === Node.ELEMENT_NODE && cur.classList && cur.classList.contains('jan-doc-page')) {
        break;
      }
      cur = cur.parentNode;
    }
    if (!cur || cur === page) return false;  /* 페이지 밖 */

    try { pushPaperUndo('page-break'); } catch {}

    /* 커서 이후 콘텐츠를 새 페이지로 이동 */
    const newPage = document.createElement('div');
    newPage.className = 'jan-doc-page';
    newPage.setAttribute('contenteditable', 'true');  /* v35 */
    /* Range 를 잘라서 뒷부분 추출 */
    const postRange = range.cloneRange();
    postRange.setEnd(cur, cur.childNodes.length);
    const frag = postRange.extractContents();
    if (frag.childNodes.length > 0) {
      newPage.appendChild(frag);
    } else {
      newPage.innerHTML = '<p><br></p>';
    }
    /* 현재 페이지 다음에 삽입 */
    cur.parentNode.insertBefore(newPage, cur.nextSibling);
    /* 커서를 새 페이지 시작점으로 이동 */
    const newRange = document.createRange();
    newRange.setStart(newPage, 0);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    /* 새 페이지 스크롤 */
    newPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    scheduleSave();
    notify('새 페이지로 구분됨');
    return true;
  }

  function _doUpdatePageSheets() {
    const page = getPageEl();
    if (!page) return;
    const wrap = page.parentElement;
    if (!wrap) return;

    /* 페이지 크기 없으면: 시트 오버레이 + 콘텐츠 margin 조정 모두 제거 */
    if (!page.classList.contains('jan-paged')) {
      const existingSheets = wrap.querySelector('.jan-page-sheets');
      if (existingSheets) existingSheets.remove();
      const innerSheets = page.querySelector(':scope > .jan-page-sheets');
      if (innerSheets) innerSheets.remove();
      const existingLabels = page.querySelector(':scope > .jan-page-labels');
      if (existingLabels) existingLabels.remove();
      page.style.removeProperty('min-height');
      /* v23: 인라인 배경 스타일 정리 — 기본 paperStyle 복원 */
      page.style.removeProperty('background-image');
      page.style.removeProperty('background-color');
      page.style.removeProperty('background-size');
      page.style.removeProperty('background-repeat');
      page.style.removeProperty('background-attachment');
      page.style.removeProperty('background-position');
      page.style.removeProperty('box-shadow');
      page.style.removeProperty('border');
      /* 콘텐츠 블록의 이전 페이지 shift margin 복원 */
      Array.from(page.children).forEach(c => {
        if (c.dataset && c.dataset.janPgShift) {
          c.style.marginTop = c.dataset.janPgOrigMt || '';
          delete c.dataset.janPgShift;
          delete c.dataset.janPgOrigMt;
        }
      });
      return;
    }

    /* v26-fix: 이전 min-height 를 먼저 리셋해야 실제 콘텐츠 높이 측정 가능.
       (chicken-and-egg: min-height=2270 이면 scrollHeight=2270 → 항상 2페이지로 오인) */
    page.style.removeProperty('min-height');

    /* === v19: 콘텐츠 블록들을 페이지 경계 기준으로 재배치 === */
    rebalanceContentToPages(page);

    /* 페이지 높이 (mm → px) 계산 */
    const computed = getComputedStyle(page);
    const pageHmm = parseFloat(computed.getPropertyValue('--page-h')) || 297;
    const pageHpx = mmToPx(pageHmm);

    /* 재배치 후 실제 콘텐츠 높이 측정 (min-height 리셋됐으므로 natural height 반환) */
    const contentH = page.scrollHeight;
    /* 페이지 수 = ceil(콘텐츠 / (pageH + gap)), 최소 1.
       실제 레이아웃에서는 블록이 gap 에 안 빠지도록 rebalance 후 높이 기준. */
    const cycle = pageHpx + SHEET_GAP;
    const nPages = Math.max(1, Math.ceil(contentH / cycle));

    /* min-height = N × (pageH + gap) */
    const totalH = nPages * pageHpx + (nPages - 1) * SHEET_GAP;
    page.style.minHeight = totalH + 'px';

    /* v24-fix: 배경은 건드리지 않고, 각 페이지 경계 위치에 두꺼운 divider + "Page N" 라벨 오버레이.
       배경 paperStyle 과 충돌 없이 항상 페이지 구분이 뚜렷하게 보임. */
    const padTopPx = parseFloat(computed.paddingTop) || 0;

    /* v24-fix: 페이지 경계 divider + 라벨 오버레이 — 기존 sheets 오버레이 제거 */
    const outerSheets = wrap.querySelector(':scope > .jan-page-sheets');
    if (outerSheets) outerSheets.remove();
    const innerSheets = page.querySelector(':scope > .jan-page-sheets');
    if (innerSheets) innerSheets.remove();

    /* Overlay — 각 페이지 경계에 divider line + Page N 라벨.
       v26-fix: labels 를 LAST child 로 배치 (first child 면 초기 커서 위치에 영향) */
    let labels = page.querySelector(':scope > .jan-page-labels');
    if (!labels) {
      labels = document.createElement('div');
      labels.className = 'jan-page-labels';
      labels.setAttribute('contenteditable', 'false');
      labels.setAttribute('aria-hidden', 'true');
      page.appendChild(labels);
    } else if (labels !== page.lastElementChild) {
      /* 이미 존재하지만 첫 자식이면 마지막으로 이동 */
      page.appendChild(labels);
    }
    const padLeftPx = parseFloat(computed.paddingLeft) || 0;
    const padRightPx = parseFloat(computed.paddingRight) || 0;
    labels.style.position = 'absolute';
    labels.style.left = (-padLeftPx) + 'px';
    labels.style.right = (-padRightPx) + 'px';
    labels.style.top = (-padTopPx) + 'px';
    labels.style.width = 'auto';
    labels.style.height = totalH + 'px';
    labels.style.pointerEvents = 'none';
    labels.style.zIndex = '3';

    /* v26-fix: 페이지 수 / pageH / margin 이 바뀌지 않았으면 재생성 스킵.
       매번 innerHTML 리셋 시 cursor 이탈 및 타이핑 방해 발생. */
    const padBottomPx = parseFloat(computed.paddingBottom) || 0;
    const padTopPxLbl = padTopPx;
    const cacheKey = nPages + '|' + pageHpx + '|' + padTopPxLbl + '|' + padBottomPx;
    if (labels._janCache === cacheKey) {
      return;  /* 변경 없음 — DOM 재구성 스킵 */
    }
    labels._janCache = cacheKey;
    labels.innerHTML = '';
    for (let i = 0; i < nPages; i++) {
      /* 페이지 번호 라벨 (2페이지 이상일 때만) */
      if (nPages >= 2) {
        const lbl = document.createElement('span');
        lbl.className = 'jan-sheet-label';
        lbl.textContent = 'Page ' + (i + 1);
        lbl.style.position = 'absolute';
        lbl.style.right = '14px';
        lbl.style.top = (i * cycle + 10) + 'px';
        lbl.style.pointerEvents = 'none';  /* v27-fix: 클릭 pass-through */
        labels.appendChild(lbl);
      }
      /* 페이지 경계 divider (i > 0 인 경우만) — 이전 페이지 하단 여백 + gap + 다음 페이지 상단 여백 한 덩어리로 표시 */
      if (i > 0) {
        /* 전체 no-write zone 높이: 이전 페이지 bottom margin + gap + 이번 페이지 top margin */
        const noWriteStart = i * cycle - padBottomPx;
        const noWriteHeight = padBottomPx + SHEET_GAP + padTopPxLbl;
        const div = document.createElement('div');
        div.className = 'jan-page-divider';
        /* v27-fix: pointer-events:none 로 클릭 pass-through 보장 (CSS inherit 아님) */
        div.style.cssText =
          'position:absolute;left:0;right:0;pointer-events:none;' +
          'top:' + noWriteStart + 'px;' +
          'height:' + noWriteHeight + 'px;' +
          'background:repeating-linear-gradient(45deg,' +
          ' rgba(217,119,87,0.10) 0, rgba(217,119,87,0.10) 10px,' +
          ' transparent 10px, transparent 20px);' +
          'border-top:1px dashed rgba(217,119,87,0.35);' +
          'border-bottom:1px dashed rgba(217,119,87,0.35);' +
          'display:flex;align-items:center;justify-content:center;' +
          'color:#8B4513;font-size:10.5px;font-weight:700;letter-spacing:1px;';
        div.innerHTML =
          '<span style="background:#fff;padding:3px 14px;border-radius:12px;border:1px solid rgba(217,119,87,0.4); box-shadow:0 2px 6px rgba(0,0,0,0.08); pointer-events:none;">' +
          '— 페이지 ' + (i + 1) + ' 시작 —</span>';
        labels.appendChild(div);
      }
      /* 첫 페이지 하단 margin / 마지막 페이지 하단 margin 도 은은하게 표시 (선택) */
      if (i === nPages - 1 && padBottomPx > 0) {
        /* 마지막 페이지 bottom margin */
        const lastMargin = document.createElement('div');
        lastMargin.className = 'jan-page-margin-bottom';
        lastMargin.style.cssText =
          'position:absolute;left:0;right:0;pointer-events:none;' +
          'top:' + (i * cycle + pageHpx - padBottomPx) + 'px;' +
          'height:' + padBottomPx + 'px;' +
          'background:repeating-linear-gradient(45deg,' +
          ' rgba(217,119,87,0.06) 0, rgba(217,119,87,0.06) 10px,' +
          ' transparent 10px, transparent 20px);' +
          'border-top:1px dashed rgba(217,119,87,0.2);';
        labels.appendChild(lastMargin);
      }
    }
  }

  /* ============================================================
     v19: 콘텐츠 블록 재배치 — 페이지 경계를 넘는 블록을 다음 페이지로 푸시
     ------------------------------------------------------------
     알고리즘:
       1. 기존 janPgShift margin-top 을 모두 복원
       2. 각 자식 블록의 top/bottom 측정 (padding 제외)
       3. 블록이 페이지 경계(pageH)를 넘으면 → 다음 페이지 시작 위치로 shift
       4. shift 크기만큼 marginTop 에 더해서 적용
     ============================================================ */
  function rebalanceContentToPages(page) {
    if (!page || !page.classList.contains('jan-paged')) return;
    const computed = getComputedStyle(page);
    const pageHpx = mmToPx(parseFloat(computed.getPropertyValue('--page-h')) || 297);
    const padTop = parseFloat(computed.paddingTop) || 0;
    const padBottom = parseFloat(computed.paddingBottom) || 0;
    const cycle = pageHpx + SHEET_GAP;
    /* v26: 페이지 내부 여백 (top/bottom) 도 "no-write zone" 으로 간주.
       safe zone per page (0-indexed within cycle) = [top_margin, pageH - bottom_margin].
       padTop/padBottom 을 각 페이지의 내부 여백으로 재사용. */
    const MARGIN_TOP = padTop;
    const MARGIN_BOTTOM = padBottom;
    const safeEndInCycle = pageHpx - MARGIN_BOTTOM;    // 콘텐츠가 여기까지 올 수 있음
    const safeStartNextPage = MARGIN_TOP;              // 다음 페이지는 여기서 콘텐츠 시작
    /* 1단계: 기존 shift 복원 — sheets/labels 는 제외 */
    const children = Array.from(page.children).filter(c => {
      return c.nodeType === Node.ELEMENT_NODE
        && !c.classList.contains('jan-page-labels')
        && !c.classList.contains('jan-page-sheets')
        && !c.classList.contains('jan-sheet')
        && !c.classList.contains('jan-sheet-label');
    });
    children.forEach(c => {
      if (c.dataset && c.dataset.janPgShift) {
        c.style.marginTop = c.dataset.janPgOrigMt || '';
        delete c.dataset.janPgShift;
        delete c.dataset.janPgOrigMt;
      }
    });
    /* 2-3단계: 재측정 후 경계 넘는 블록 찾아 shift 적용 */
    const pageRect = page.getBoundingClientRect();
    children.forEach(c => {
      const rect = c.getBoundingClientRect();
      /* top/bottom 은 콘텐츠 영역 기준 (padding 제거, 0 = 첫 페이지 top_margin 안쪽) */
      const top = rect.top - pageRect.top - padTop;
      const bottom = top + rect.height;
      if (bottom <= 0) return;
      const startPage = Math.floor(top / cycle);
      const topInCycle = top - startPage * cycle;
      const bottomInCycle = topInCycle + rect.height;
      /* 한 페이지보다 큰 블록은 건드리지 않음 */
      if (rect.height > pageHpx - MARGIN_TOP - MARGIN_BOTTOM) return;
      /* v26: safe zone = [0, safeEndInCycle] 밖에 걸치면 다음 페이지 safe start 로 push.
         - topInCycle >= safeEndInCycle: 블록이 bottom margin 또는 gap 영역에 시작
         - bottomInCycle > safeEndInCycle: 블록 끝이 bottom margin 또는 gap 을 넘음 */
      if (topInCycle >= safeEndInCycle || bottomInCycle > safeEndInCycle) {
        /* 다음 페이지 safe 시작점 = (startPage + 1) * cycle + MARGIN_TOP */
        const nextPageSafeStart = (startPage + 1) * cycle + safeStartNextPage;
        const shift = nextPageSafeStart - top;
        if (shift > 0 && shift < cycle + safeStartNextPage) {
          const origMt = c.style.marginTop || '';
          const curMt = parseFloat(getComputedStyle(c).marginTop) || 0;
          c.dataset.janPgOrigMt = origMt;
          c.dataset.janPgShift = String(shift);
          c.style.marginTop = (curMt + shift) + 'px';
        }
      }
    });
  }

  /* MutationObserver — #page 내용 변경 시 디바운스로 sheet 재계산.
     v26-fix: IME composition 중엔 건드리지 않음 (타이핑 방해 방지), debounce 400ms */
  let _sheetsObserver = null;
  let _sheetsDebounceTimer = null;
  let _isComposing = false;
  let _lastNPages = -1;
  function setupSheetsObserver() {
    const page = getPageEl();
    if (!page || _sheetsObserver) return;
    /* IME composition 감지 */
    page.addEventListener('compositionstart', () => { _isComposing = true; });
    page.addEventListener('compositionend', () => {
      _isComposing = false;
      /* composition 끝나면 한 번 재계산 */
      if (page.classList.contains('jan-paged')) {
        if (_sheetsDebounceTimer) clearTimeout(_sheetsDebounceTimer);
        _sheetsDebounceTimer = setTimeout(() => updatePageSheets(), 300);
      }
    });
    _sheetsObserver = new MutationObserver(() => {
      /* IME composition 중엔 무시 — 타이핑 방해 방지 */
      if (_isComposing) return;
      if (_sheetsDebounceTimer) clearTimeout(_sheetsDebounceTimer);
      _sheetsDebounceTimer = setTimeout(() => {
        if (page.classList.contains('jan-paged')) updatePageSheets();
      }, 400);
    });
    _sheetsObserver.observe(page, {
      childList: true, subtree: true, characterData: true, attributes: false
    });
  }

  /* 페이지 크기 선택 모달 — 카드 그리드 UI */
  function openPageSizePicker() {
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    const ok = document.getElementById('modalOk');
    const cancel = document.getElementById('modalCancel');
    if (!modal || !body) {
      /* 폴백 — 네이티브 select */
      const keys = Object.keys(PAGE_SIZES);
      const current = getPageSize();
      const idx = keys.indexOf(current);
      const msg = '페이지 크기 선택\n' + keys.map((k, i) =>
        (i === idx ? '● ' : '  ') + (i + 1) + '. ' + PAGE_SIZES[k].label +
        (PAGE_SIZES[k].dim ? ' (' + PAGE_SIZES[k].dim + ')' : '')
      ).join('\n');
      const input = prompt(msg + '\n\n번호 입력:', String(idx + 1));
      if (!input) return;
      const n = parseInt(input, 10);
      if (n >= 1 && n <= keys.length) setPageSize(keys[n - 1]);
      return;
    }

    const origOk = ok.textContent;
    const origCancel = cancel.textContent;
    const origOkDisp = ok.style.display;

    const current = getPageSize();
    title.textContent = '페이지 크기 설정';
    const grid = document.createElement('div');
    grid.className = 'jan-pg-size-grid';
    Object.entries(PAGE_SIZES).forEach(([key, info]) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'jan-pg-size-card' + (key === current ? ' active' : '');
      card.setAttribute('data-size', key);
      /* 미니 미리보기 박스: 가로/세로 비율 */
      let ratio = '';
      if (key !== 'none' && info.dim) {
        const [w, h] = info.dim.replace(/mm/g, '').split('×').map(s => parseFloat(s.trim()));
        const maxDim = Math.max(w, h);
        const pw = (w / maxDim) * 22;
        const ph = (h / maxDim) * 22;
        ratio = '<span class="pg-ico" style="display:inline-block; width:24px; height:24px; position:relative;">' +
          '<span style="position:absolute; left:' + ((24 - pw) / 2) + 'px; top:' + ((24 - ph) / 2) + 'px; ' +
          'width:' + pw + 'px; height:' + ph + 'px; border:1.5px solid currentColor; background:rgba(217,119,87,0.08);"></span></span>';
      } else {
        ratio = '<svg class="ico pg-ico"><use href="#i-x"/></svg>';
      }
      card.innerHTML = ratio +
        '<span>' +
          '<span class="pg-label">' + info.label + '</span>' +
          (info.dim ? '<div class="pg-sub">' + info.dim + '</div>' : '<div class="pg-sub">자유 길이 · 페이지 경계 없음</div>') +
        '</span>';
      card.addEventListener('click', () => {
        /* 카드 클릭 = 즉시 적용 + 모달 닫기 */
        setPageSize(key);
        restoreModal();
      });
      grid.appendChild(card);
    });
    body.innerHTML = '';
    const intro = document.createElement('div');
    intro.style.cssText = 'font-size:12px; color:#666; margin-bottom:4px; line-height:1.5;';
    intro.textContent = '현재 탭에 적용할 페이지 크기를 선택하세요. 선택하면 에디터가 종이처럼 보이고, 인쇄 시 해당 용지 크기로 출력됩니다.';
    body.appendChild(intro);
    body.appendChild(grid);

    /* 넓은 모달 + 스크롤 지원 */
    const modalBox = modal.querySelector('.modal') || modal;
    modalBox.classList.add('jan-wide');

    ok.style.display = 'none'; // 카드 클릭으로 즉시 적용
    cancel.textContent = '닫기';

    function restoreModal() {
      modal.classList.remove('open');
      modalBox.classList.remove('jan-wide');
      ok.style.display = origOkDisp;
      ok.textContent = origOk;
      cancel.textContent = origCancel;
      body.innerHTML = '';
      ok.onclick = null;
      cancel.onclick = null;
      modal.removeEventListener('click', backdropHandler);
      document.removeEventListener('keydown', escHandler);
    }
    function backdropHandler(e) {
      /* v15-fix: backdrop 클릭 = 닫기 (modal 자체가 클릭 타겟일 때만; .modal 내부 클릭은 무시) */
      if (e.target === modal) restoreModal();
    }
    function escHandler(e) {
      if (e.key === 'Escape') { restoreModal(); }
    }
    cancel.onclick = restoreModal;
    modal.addEventListener('click', backdropHandler);
    document.addEventListener('keydown', escHandler);
    modal.classList.add('open');
  }

  /* 원자 기능 namespace */
  const paperAtoms = {
    toggleTwoColumn,
    configureHeaderFooter,
    insertAuthorsBlock,
    insertAbstractBox,
    insertKeywordsBlock,
    generateTOC,
    wrapAsPage,
    insertAcknowledgments,
    /* v15 — 페이지 크기 */
    setPageSize,
    getPageSize,
    applyPageSizeFromTab,
    openPageSizePicker,
    PAGE_SIZES,
    /* v16 — stacked sheets */
    updatePageSheets
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ============================================================
     공개 API
     ============================================================ */
  window.JANPaper = {
    insertFootnote,
    renumberFootnotes,
    addBibEntry,
    openBibManager,
    insertCitation,
    renumberCitations,
    insertPageBreak,
    refreshNumbering,
    openPaperMenu,
    loadPaperSample,
    convertToSciencePaper,
    renderAllPaperFigures,
    openPaperHelp,
    paperPromptForm,
    showPaperOnboardingBanner,
    /* v8 — 되돌리기 지원 */
    paperUndo,
    pushPaperUndo,
    showUndoToast,
    _paperUndoStack,
    /* v10 — 원자 기능 8종 */
    atoms: paperAtoms
  };
})();
