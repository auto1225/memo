/* ============================================================
   paper-features.js — 논문 작성 기능 팩 (v7)
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
     초기화
     ============================================================ */
  function init() {
    attachObserver();
    // 툴바 버튼 (app.html 에 추가한 #paperMenuBtn) 이벤트 바인딩
    const btn = document.getElementById('paperMenuBtn');
    if (btn && !btn._janBound) {
      btn._janBound = true;
      btn.addEventListener('click', openPaperMenu);
    }
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
     async — 수식·Mermaid 렌더가 모두 끝날 때까지 기다린 후 resolve. */
  async function loadPaperSample() {
    var tpl = window.JANPaperTemplate && window.JANPaperTemplate.physicsScience;
    if (!tpl) { notify('논문 템플릿이 로드되지 않았습니다'); return; }
    if (!window.confirm('현재 노트에 Science 포맷 물리학 논문 샘플 3페이지를 삽입합니다. 기존 내용은 유지됩니다. 계속하시겠습니까?')) return;
    var page = document.getElementById('page');
    if (!page) { notify('편집 영역을 찾을 수 없습니다'); return; }
    page.insertAdjacentHTML('beforeend', '<hr>' + tpl);
    try { refreshNumbering(); } catch (e) {}
    try { renumberFootnotes(); } catch (e) {}
    try { renumberCitations(); } catch (e) {}
    notify('논문 샘플 삽입 완료 — 수식 렌더링 중…');
    // 모든 수식·다이어그램 렌더가 끝날 때까지 기다림
    await renderAllPaperFigures(page);
    try { if (typeof window.scheduleSave === 'function') window.scheduleSave(); } catch (e) {}
    // 첫 사용자 대상 온보딩 배너 (localStorage 로 1회만)
    try { showPaperOnboardingBanner(); } catch (e) { console.warn('[JANPaper] 온보딩 배너 실패', e); }
    notify('논문 샘플 삽입 완료');
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
    const confirmMsg =
      '현재 노트 전체를 Science 최종본 3페이지 레이아웃으로 변환합니다. ' +
      '되돌릴 수 없습니다. 계속하시겠습니까?';
    if (!window.confirm(confirmMsg)) return;

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
  }

  /* 논문 기능 도움말 모달 — 사용법 요약표 */
  function openPaperHelp() {
    const html =
      '<div style="padding:4px 2px 8px; font-size:13px; line-height:1.55; color:#222;">' +
        '<p style="margin:0 0 10px;">논문 작성에 필요한 요소들은 아래 방식으로 빠르게 삽입할 수 있습니다.</p>' +
        '<table style="width:100%; border-collapse:collapse; font-size:12.5px;">' +
          '<thead>' +
            '<tr style="background:#f6f8fb; border-bottom:1px solid #dbe0e7;">' +
              '<th style="text-align:left; padding:6px 8px; font-weight:700;">기능</th>' +
              '<th style="text-align:left; padding:6px 8px; font-weight:700;">방법</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' +
            '<tr style="border-bottom:1px solid #eef0f3;"><td style="padding:6px 8px;">논문 샘플 불러오기</td><td style="padding:6px 8px;">툴바 "논문 요소" 메뉴 → <em>논문 샘플 불러오기</em></td></tr>' +
            '<tr style="border-bottom:1px solid #eef0f3;"><td style="padding:6px 8px;">각주 삽입</td><td style="padding:6px 8px;">Ctrl+K → <em>각주 삽입</em>, 또는 "논문 요소" 메뉴</td></tr>' +
            '<tr style="border-bottom:1px solid #eef0f3;"><td style="padding:6px 8px;">인용 삽입</td><td style="padding:6px 8px;">Ctrl+K → <em>인용 삽입</em> (먼저 참고문헌 항목이 있어야 함)</td></tr>' +
            '<tr style="border-bottom:1px solid #eef0f3;"><td style="padding:6px 8px;">참고문헌 항목 추가</td><td style="padding:6px 8px;">"논문 요소" 메뉴 → <em>참고문헌 항목 추가</em> (IEEE 스타일 텍스트)</td></tr>' +
            '<tr style="border-bottom:1px solid #eef0f3;"><td style="padding:6px 8px;">페이지 구분 삽입</td><td style="padding:6px 8px;">Ctrl+K → <em>페이지 구분</em>. 인쇄 시 한 장씩 나눠짐</td></tr>' +
            '<tr style="border-bottom:1px solid #eef0f3;"><td style="padding:6px 8px;">수식 번호 (1)(2)…</td><td style="padding:6px 8px;"><code>&lt;figure class="jan-math"&gt;</code> 자동 카운터</td></tr>' +
            '<tr style="border-bottom:1px solid #eef0f3;"><td style="padding:6px 8px;">Figure 번호</td><td style="padding:6px 8px;"><code>&lt;figure class="jan-fig"&gt;</code> 안에 <code>&lt;figcaption&gt;</code></td></tr>' +
            '<tr style="border-bottom:1px solid #eef0f3;"><td style="padding:6px 8px;">Table 번호</td><td style="padding:6px 8px;"><code>&lt;figure class="jan-tbl"&gt;</code> 안에 <code>&lt;table&gt;</code> + <code>&lt;figcaption&gt;</code></td></tr>' +
            '<tr style="border-bottom:1px solid #eef0f3;"><td style="padding:6px 8px;">Mermaid 다이어그램</td><td style="padding:6px 8px;"><code>&lt;figure class="jan-diagram" data-mermaid-code="BASE64"&gt;</code> — 샘플 로드 시 자동 렌더</td></tr>' +
            '<tr><td style="padding:6px 8px;">번호 재정렬</td><td style="padding:6px 8px;">"논문 요소" → <em>번호 재정렬</em> (자동 실행되지만 수동 트리거)</td></tr>' +
          '</tbody>' +
        '</table>' +
        '<p style="margin:10px 0 0; font-size:12px; color:#666;">각주·인용·목차 링크는 클릭하면 해당 위치로 스크롤합니다.</p>' +
      '</div>';
    if (typeof window.showModalHtml === 'function') {
      window.showModalHtml('논문 기능 도움말', html);
    } else {
      // fallback — 창 띄우기
      const w = window.open('', '_blank');
      if (w) { w.document.write('<h2>논문 기능 도움말</h2>' + html); w.document.close(); }
    }
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
        '<span>팁: 각주·인용·참고문헌은 툴바 "논문 요소" 메뉴 또는 ' +
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

  /* 논문 요소 서브메뉴 (툴바 버튼 클릭 시 작은 드롭다운) */
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
      { label: '현재 노트를 논문 포맷으로 (Science 3페이지)', act: 'convert' },
      { label: '논문 샘플 불러오기 (Science 포맷)', act: 'load-sample' },
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
    showPaperOnboardingBanner
  };
})();
