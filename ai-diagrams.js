/* ============================================================
   ai-diagrams.js — AI 다이어그램 자동 생성 (v2)
   ------------------------------------------------------------
   선택한 텍스트를 분석해서 다음 3종 다이어그램을 자동 생성합니다:

     - 구성도 (buildOrgChart)      : Mermaid flowchart TD
     - 순서도 (buildFlowchart)     : Mermaid flowchart LR
     - 인포그래픽 (buildInfographic): 자체 SVG 바차트 · KPI 카드

   v2 개선:
     - 선택된 원본 텍스트를 "보존"하고 그 다음 줄에 figure 삽입
       (insertHtmlAtCursor 는 선택을 덮어쓰기 때문에 range 끝점 뒤에 insertNode)
     - Mermaid 테마를 base + 명시적 themeVariables + CSS !important 로 강제
       → 다크모드에서도 노드/텍스트 가독성 보장
     - figure 에 [편집]/[삭제] 버튼 (data-mermaid-code 에 원본 코드 보존)
     - 편집 모달 (textarea + 실시간 미리보기)

   공개 API:  window.JANDiagrams = {
     ensureMermaid, renderMermaid,
     buildOrgChart, buildFlowchart, buildInfographic,
     insertFigure, insertFigureAfterSelection, renderMath
   }
   ============================================================ */
(function () {
  'use strict';

  const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';

  /* ---------- 유틸 ---------- */
  function notify(msg) {
    try { if (typeof window.toast === 'function') window.toast(msg); }
    catch { console.log('[JANDiagrams]', msg); }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // base64 인코딩 (유니코드 안전)
  function b64enc(s) {
    try {
      return btoa(unescape(encodeURIComponent(String(s || ''))));
    } catch {
      return '';
    }
  }
  function b64dec(s) {
    try {
      return decodeURIComponent(escape(atob(String(s || ''))));
    } catch {
      return '';
    }
  }

  // Mermaid 파서 오류를 사용자 친화 힌트로 변환.
  // 원문 에러도 details 안에서 열람 가능하도록 별도 getter.
  function humanizeMermaidError(err) {
    const msg = String(err && err.message || err);
    const tips = [
      { re: /Parse error on line/i, hint: '문법 오류 — 줄 시작에 `flowchart TD` 또는 `flowchart LR` 이 한 줄만 있어야 합니다. 중복된 ``` 코드블록 기호가 있으면 제거하세요.' },
      { re: /Expecting.*got '?GRAPH'?/i, hint: '`graph` 키워드가 예상치 않은 위치에 있습니다. 첫 줄만 `flowchart TD` 로 시작하세요.' },
      { re: /Expecting.*got .*?['"]?-{2,}-{2,}['"]?/i, hint: '화살표 문법 — `A --> B` 처럼 공백을 넣으세요 (양쪽에).' },
      { re: /Cannot read propert/i, hint: 'Mermaid 라이브러리가 아직 로드되지 않았습니다. 잠시 후 재시도하세요.' },
      { re: /Lexical error/i, hint: '특수문자 (괄호·콜론·세미콜론) 가 노드명 안에 있을 때는 대괄호 `[...]` 로 감싸세요.' },
      { re: /Unknown arrow /i, hint: '지원되는 화살표: `-->`, `---`, `-.->`, `==>`' },
    ];
    for (const t of tips) if (t.re.test(msg)) return t.hint;
    return '알 수 없는 Mermaid 오류입니다. 코드 문법을 확인하세요.';
  }

  // AI 응답에서 코드블록/설명문을 걷어내고 실제 코드만 추출
  function stripCodeFence(txt, hintLang) {
    if (!txt) return '';
    const raw = String(txt).trim();
    const fence = raw.match(/```(?:[a-zA-Z]+)?\s*\n?([\s\S]*?)```/);
    if (fence) return fence[1].trim();
    return raw;
  }

  /* ---------- 전역 CSS (한 번만 주입) ---------- */
  (function injectCss() {
    if (document.getElementById('jan-diagram-css')) return;
    const css = document.createElement('style');
    css.id = 'jan-diagram-css';
    css.textContent = `
      figure.jan-diagram {
        margin: 12px auto;
        max-width: 640px;
        text-align: center;
        border: 1px solid rgba(0,0,0,0.08);
        border-radius: 8px;
        padding: 12px;
        background: #ffffff;
        position: relative;
      }
      figure.jan-diagram .jan-diagram-body {
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: auto;
        background: #ffffff;
      }
      figure.jan-diagram figcaption {
        margin-top: 8px;
        font-size: 11.5px;
        color: #888;
        font-style: italic;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      figure.jan-diagram .jan-diagram-tools {
        display: inline-flex;
        gap: 4px;
        margin-left: 8px;
      }
      figure.jan-diagram .jan-diagram-tools button {
        appearance: none;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 2px 8px;
        font-size: 11px;
        color: #555;
        cursor: pointer;
        font-family: inherit;
        font-style: normal;
        line-height: 1.4;
      }
      figure.jan-diagram .jan-diagram-tools button:hover {
        background: #FFE0EC;
        border-color: #D97757;
        color: #B23A4C;
      }
      figure.jan-diagram .jan-diagram-tools button.danger:hover {
        background: #FFD9D9;
        border-color: #C0392B;
        color: #C0392B;
      }
      /* Mermaid 편집 모달 에러 박스 (사용자 친화 메시지 + 원문 상세) */
      .jan-mermaid-err {
        background: #FFF4F0;
        border: 1px solid #E89B85;
        border-radius: 8px;
        padding: 10px 12px;
        color: #8B3A1F;
        font-size: 12.5px;
        line-height: 1.55;
      }
      .jan-mermaid-err strong {
        display: block;
        font-size: 13px;
        margin-bottom: 4px;
        color: #B23A4C;
      }
      .jan-mermaid-err .hint { white-space: pre-wrap; }
      .jan-mermaid-err details {
        margin-top: 6px;
        font-size: 11px;
        color: #666;
      }
      .jan-mermaid-err details summary { cursor: pointer; }
      .jan-mermaid-err details pre {
        background: #fff;
        border: 1px solid #eee;
        padding: 6px 8px;
        border-radius: 4px;
        overflow: auto;
        font-size: 11px;
        margin-top: 4px;
        max-height: 120px;
      }
      /* 다크모드/검정배경에서도 가독성 보장 — Mermaid SVG 내부 강제 색 */
      figure.jan-diagram svg .node rect,
      figure.jan-diagram svg .node polygon,
      figure.jan-diagram svg .node circle,
      figure.jan-diagram svg .node ellipse {
        fill: #FFE0EC !important;
        stroke: #D97757 !important;
        stroke-width: 1.5px !important;
      }
      figure.jan-diagram svg .node .label,
      figure.jan-diagram svg .node text,
      figure.jan-diagram svg .node foreignObject div,
      figure.jan-diagram svg .nodeLabel {
        color: #2c2c2c !important;
        fill: #2c2c2c !important;
      }
      figure.jan-diagram svg .edgePath path,
      figure.jan-diagram svg .flowchart-link {
        stroke: #555 !important;
        stroke-width: 1.6px !important;
      }
      figure.jan-diagram svg .edgeLabel,
      figure.jan-diagram svg .edgeLabel rect {
        background-color: #fff !important;
        fill: #fff !important;
        color: #2c2c2c !important;
      }
      figure.jan-diagram svg .arrowheadPath,
      figure.jan-diagram svg marker path {
        fill: #555 !important;
        stroke: #555 !important;
      }
      /* 수식 figure — 문장 사이에 끼어들어갈 수 있게 inline-block.
         텍스트와 크기·세로 정렬 맞추어 '한 줄의 일부' 처럼 보이게.
         배경·패딩·보더 완전 투명. KaTeX 내부의 기본 흰 배경까지 모두 제거. */
      figure.jan-math {
        display: inline-block !important;
        vertical-align: middle;          /* 주변 텍스트 가운데 기준 정렬 */
        margin: 0 0.15em;
        max-width: 100%;
        text-align: center;
        padding: 0 !important;
        background: transparent !important;
        background-color: transparent !important;
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        overflow: visible;               /* 큰 행렬·분수가 잘리지 않게 */
        color: inherit;
        line-height: normal;             /* 수식 높이만큼 줄 확장 — 잘림 방지 */
      }
      figure.jan-math .katex-display {
        margin: 0 !important;
        padding: 0 !important;
        background: transparent !important;
        color: inherit;
        display: inline-block !important;
        vertical-align: middle;
      }
      /* KaTeX 의 기본 1.21em 폰트 크기 오버라이드 — 주변 텍스트와 동일 크기로 */
      figure.jan-math .katex,
      figure.jan-math .katex *,
      figure.jan-math .katex-html,
      figure.jan-math .katex-mathml {
        background: transparent !important;
        background-color: transparent !important;
        color: inherit !important;
      }
      figure.jan-math .katex {
        font-size: 1em !important;        /* 주변 텍스트 크기와 정확히 맞춤 */
        line-height: normal;              /* KaTeX 자체 레이아웃 존중 */
        vertical-align: middle;
      }
      /* KaTeX 분수/근호 줄긋기만 색 따로 (원래 currentColor 이지만 보장) */
      figure.jan-math .katex .frac-line,
      figure.jan-math .katex .sqrt-line {
        border-color: currentColor !important;
      }
      /* 인라인 수식 span 도 KaTeX 크기 고정 + 가운데 정렬 */
      .jan-math-inline .katex {
        font-size: 1em !important;
        line-height: 1.2;
        vertical-align: middle;
      }
      figure.jan-math figcaption {
        margin-top: 2px;
        font-size: 11px;
        color: #bbb;
        font-style: italic;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        opacity: 0;                   /* 기본은 숨김 — 이미지 같은 느낌 제거 */
        transition: opacity 0.15s;
        pointer-events: none;
      }
      figure.jan-math:hover figcaption,
      figure.jan-math:focus-within figcaption,
      figure.jan-math.jan-focus figcaption {
        opacity: 1;
        pointer-events: auto;
      }
      figure.jan-math .jan-math-tools { display: inline-flex; gap: 4px; margin-left: 8px; }
      figure.jan-math .jan-math-tools button {
        appearance: none;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 2px 8px;
        font-size: 11px;
        color: #555;
        cursor: pointer;
        font-family: inherit;
        font-style: normal;
      }
      figure.jan-math .jan-math-tools button:hover {
        background: #FFE0EC; border-color: #D97757; color: #B23A4C;
      }
      figure.jan-math .jan-math-tools button.danger:hover {
        background: #FFD9D9; border-color: #C0392B; color: #C0392B;
      }
      /* 인라인 수식 — 텍스트 옆에 글자처럼 자연스럽게 흐름.
         주변 텍스트의 서식(font-size, color, font-weight) 을 그대로 상속 —
         노트가 자연스러운 문서가 되려면 수식도 같은 스타일로 어우러져야 함.
         padding/border/background 없음 (박스처럼 안 보이게). */
      .jan-math-inline {
        display: inline-block;
        vertical-align: middle;
        cursor: pointer;
        line-height: 1;
        padding: 0; border: 0; background: transparent; border-radius: 0;
        margin: 0;                         /* 래퍼 마진 0 — 주변 글자에 곧장 붙게 */
        color: inherit;
        font-weight: inherit;
        font-style: inherit;
        transition: background 0.12s;
        white-space: nowrap;               /* 수식 중간에 줄바꿈 안 되게 */
      }
      /* KaTeX 내부는 색/크기만 상속받게 하고 margin/padding 은 건들지 않는다.
         (내부 margin 을 0 으로 밀면 분수선·근호 위치가 깨져 √ 가 사라짐) */
      .jan-math-inline .katex,
      .jan-math-inline .katex * {
        font-size: inherit !important;
        color: inherit !important;
      }
      /* .katex 래퍼 자체의 좌우 margin 만 정리 — 주변 글자와의 공백 제거 */
      .jan-math-inline > .katex {
        margin-left: 0 !important;
        margin-right: 0 !important;
      }
      .jan-math-inline .katex .mord,
      .jan-math-inline .katex .mbin,
      .jan-math-inline .katex .mrel,
      .jan-math-inline .katex .mop {
        font-weight: inherit;
      }
      .jan-math-inline:hover { background: rgba(255, 214, 228, 0.35); }
      .jan-math-inline.jan-focus { background: rgba(255, 182, 193, 0.45); }
      /* figure 선택(focus) 하이라이트 — Ctrl+C 복사 가능함을 시각적으로 */
      figure.jan-diagram.jan-focus,
      figure.jan-math.jan-focus {
        outline: 2px solid #D97757;
        outline-offset: 2px;
      }
    `;
    document.head.appendChild(css);
  })();

  /* ---------- Mermaid 로더 ---------- */
  let _mermaidPromise = null;
  function ensureMermaid() {
    if (window.mermaid) return Promise.resolve(window.mermaid);
    if (_mermaidPromise) return _mermaidPromise;
    _mermaidPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = MERMAID_URL;
      s.async = true;
      s.onload = () => {
        try {
          window.mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            securityLevel: 'loose',
            fontFamily: 'inherit',
            themeVariables: {
              background: '#ffffff',
              mainBkg: '#ffffff',
              primaryColor: '#FFE0EC',
              primaryTextColor: '#2c2c2c',
              primaryBorderColor: '#D97757',
              lineColor: '#555555',
              secondaryColor: '#E3F2FD',
              tertiaryColor: '#FFF9C4',
              nodeBkg: '#FFE0EC',
              nodeTextColor: '#2c2c2c',
              nodeBorder: '#D97757',
              edgeLabelBackground: '#ffffff',
              clusterBkg: '#FFF6F8',
              clusterBorder: '#D97757',
              titleColor: '#2c2c2c',
              textColor: '#2c2c2c',
              labelTextColor: '#2c2c2c',
              arrowheadColor: '#555555',
            },
            flowchart: { htmlLabels: true, curve: 'basis' }
          });
          resolve(window.mermaid);
        } catch (e) { reject(e); }
      };
      s.onerror = () => reject(new Error('Mermaid 라이브러리 로드 실패'));
      document.head.appendChild(s);
    });
    return _mermaidPromise;
  }

  async function renderMermaid(code) {
    const m = await ensureMermaid();
    const id = 'jan-mrm-' + Math.random().toString(36).slice(2, 9);
    const { svg } = await m.render(id, code);
    return svg;
  }

  /* ---------- KaTeX 로더 (수식 렌더) ---------- */
  let _katexPromise = null;
  function ensureKatex() {
    if (window.katex) return Promise.resolve(window.katex);
    if (_katexPromise) return _katexPromise;
    _katexPromise = new Promise((resolve, reject) => {
      // CSS
      if (!document.querySelector('link[data-jan-katex]')) {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
        css.setAttribute('data-jan-katex', '');
        document.head.appendChild(css);
      }
      // JS
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
      s.async = true;
      s.onload = () => resolve(window.katex);
      s.onerror = () => reject(new Error('KaTeX 라이브러리 로드 실패'));
      document.head.appendChild(s);
    });
    return _katexPromise;
  }

  /* 인라인 모드로 LaTeX 한 줄 렌더 (displayMode: false) */
  async function renderLatexInlineHtml(latex) {
    const katex = await ensureKatex();
    const clean = String(latex || '')
      .replace(/^\\\[|\\\]$/g, '')
      .replace(/^\$\$|\$\$$/g, '')
      .replace(/^\\\(|\\\)$/g, '')
      .replace(/^\$|\$$/g, '')
      .replace(/\n+/g, ' ')
      .trim();
    if (!clean) return '';
    try {
      return katex.renderToString(clean, {
        displayMode: false,
        throwOnError: false,
        errorColor: '#D97757',
        strict: 'ignore',
      });
    } catch (e) {
      return '<span style="color:#c00">' + escapeHtml(clean) + '</span>';
    }
  }

  /* 여러 줄 LaTeX 를 라인별로 displayMode 렌더 */
  async function renderLatexHtml(latex) {
    const katex = await ensureKatex();
    const lines = String(latex || '').split(/\n+/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return '';
    return lines.map(l => {
      // \[ ... \] / $$...$$ 껍질 제거
      let clean = l.replace(/^\\\[|\\\]$/g, '')
                   .replace(/^\$\$|\$\$$/g, '')
                   .replace(/^\\\(|\\\)$/g, '')
                   .replace(/^\$|\$$/g, '')
                   .trim();
      try {
        return katex.renderToString(clean, {
          displayMode: true,
          throwOnError: false,
          errorColor: '#D97757',
          strict: 'ignore',
        });
      } catch (e) {
        return '<span style="color:#c00">' + escapeHtml(clean) + '</span>';
      }
    }).join('');
  }

  /* ---------- Figure HTML 조립 ---------- */
  function buildDiagramFigureHtml(svgOrHtml, caption, mermaidCode) {
    const enc = mermaidCode ? b64enc(mermaidCode) : '';
    const tools =
      '<span class="jan-diagram-tools" contenteditable="false">' +
        (mermaidCode ? '<button type="button" data-diag-act="edit">편집</button>' : '') +
        '<button type="button" data-diag-act="copy" title="Word · 한글 · 메일에 이미지로 붙여넣기">복사</button>' +
        '<button type="button" data-diag-act="delete" class="danger">삭제</button>' +
      '</span>';
    return (
      '<figure class="jan-diagram" contenteditable="false" tabindex="0"' +
      (enc ? ' data-mermaid-code="' + enc + '"' : '') + '>' +
        '<div class="jan-diagram-body">' + svgOrHtml + '</div>' +
        '<figcaption>' + escapeHtml(caption || '') + tools + '</figcaption>' +
      '</figure>'
    );
  }

  function buildMathFigureHtml(html, latex, caption) {
    const enc = latex ? b64enc(latex) : '';
    const tools =
      '<span class="jan-math-tools" contenteditable="false">' +
        '<button type="button" data-math-act="move-up" title="한 칸 위로 이동">↑</button>' +
        '<button type="button" data-math-act="move-down" title="한 칸 아래로 이동">↓</button>' +
        '<button type="button" data-math-act="edit">편집</button>' +
        '<button type="button" data-math-act="cut" title="잘라내기 (Word·한글 붙여넣기용)">잘라내기</button>' +
        '<button type="button" data-math-act="copy" title="Word · 한글 · 메일에 이미지로 붙여넣기">복사</button>' +
        '<button type="button" data-math-act="copy-latex" title="LaTeX 텍스트만 복사">LaTeX</button>' +
        '<button type="button" data-math-act="delete" class="danger">삭제</button>' +
      '</span>';
    return (
      '<figure class="jan-math" contenteditable="false" tabindex="0"' +
      (enc ? ' data-latex="' + enc + '"' : '') + '>' +
        html +
        '<figcaption>' + escapeHtml(caption || '수식') + tools + '</figcaption>' +
      '</figure>'
    );
  }

  /* ---------- 노트 삽입 (원본 텍스트 보존 = 선택 끝점 뒤에 삽입) ----------
     forcedRange: 외부에서 미리 확보한 Range 가 있으면 그걸 우선 사용
     (AI 호출로 오래 기다리는 동안 selection 이 날아가는 걸 방어)  */
  // 빈 블록 판단 — 위/아래 이동 시 빈 <p><br></p> 같은 placeholder 는 건너뛴다
  function isEmptyBlock(node) {
    if (!node || node.nodeType !== 1) return false;
    const tag = node.nodeName;
    if (tag !== 'P' && tag !== 'DIV') return false;
    const txt = (node.textContent || '').replace(/\s|\u200b/g, '');
    if (txt) return false;
    // figure / img / table / iframe / svg 같은 의미 있는 자식이 있으면 비어있는 게 아님
    if (node.querySelector('figure,img,table,iframe,svg,video,audio,canvas')) return false;
    return true;
  }

  let _preservedRange = null;
  function captureRangeNow() {
    try {
      const pageEl = document.getElementById('page') || document.querySelector('[contenteditable="true"]');
      const sel = window.getSelection();
      if (pageEl && sel && sel.rangeCount > 0 && pageEl.contains(sel.anchorNode)) {
        _preservedRange = sel.getRangeAt(0).cloneRange();
        return _preservedRange;
      }
    } catch {}
    return null;
  }

  function insertFigureAfterSelection(figHtml) {
    const pageEl = document.getElementById('page') || document.querySelector('[contenteditable="true"]');
    if (!pageEl) {
      if (typeof window.insertHtmlAtCursor === 'function') window.insertHtmlAtCursor(figHtml);
      return;
    }

    // 우선순위:
    // 1) 캡처해둔 _preservedRange (한 번만 소비)
    // 2) 현재 selection 이 pageEl 안에 있으면 그대로 — 루프 내 연속 호출 시 이전 삽입 뒤를 유지
    // 3) 그 외에는 복원된 saved selection
    let range = _preservedRange;
    _preservedRange = null; // 1회성
    const sel = window.getSelection();
    if (!range && sel && sel.rangeCount > 0 && pageEl.contains(sel.anchorNode)) {
      // 이미 pageEl 안에 유효한 커서 — 복원하지 말고 그대로 사용
      range = sel.getRangeAt(0).cloneRange();
    }
    if (!range) {
      try {
        if (typeof window.restorePageSel === 'function') window.restorePageSel();
      } catch {}
      if (sel && sel.rangeCount > 0 && pageEl.contains(sel.anchorNode)) {
        range = sel.getRangeAt(0).cloneRange();
      }
    }

    // temp container 에서 figure 노드 생성
    const tmp = document.createElement('div');
    tmp.innerHTML = figHtml;
    const figNode = tmp.firstChild;
    const brNode = document.createElement('p');
    brNode.innerHTML = '<br>';

    if (range) {
      // 선택 끝점으로 collapse → 삽입 (원본 텍스트 유지!)
      range.collapse(false);
      // 블록 라인 밖으로 빠져나가도록: 현재 블록의 뒤에 삽입
      // 가장 가까운 block 레벨 조상 찾기
      let block = range.startContainer;
      if (block.nodeType === 3) block = block.parentNode;
      while (block && block !== pageEl && !/^(P|DIV|LI|H[1-6]|BLOCKQUOTE|PRE|FIGURE|ARTICLE|SECTION)$/i.test(block.nodeName)) {
        block = block.parentNode;
      }
      if (block && block !== pageEl && block.parentNode) {
        // 블록 뒤에 삽입 (원본 텍스트 손상 없이 다음 줄)
        if (block.nextSibling) block.parentNode.insertBefore(figNode, block.nextSibling);
        else block.parentNode.appendChild(figNode);
        if (figNode.nextSibling) figNode.parentNode.insertBefore(brNode, figNode.nextSibling);
        else figNode.parentNode.appendChild(brNode);
      } else {
        // 블록을 못 찾으면 range 뒤에 그대로 삽입
        range.insertNode(brNode);
        range.insertNode(figNode);
      }
      // 커서를 figure 다음으로
      const after = document.createRange();
      after.setStartAfter(brNode);
      after.collapse(true);
      sel.removeAllRanges();
      sel.addRange(after);
    } else {
      // 선택 없으면 문서 끝에 append
      pageEl.appendChild(figNode);
      pageEl.appendChild(brNode);
    }

    // 저장 트리거
    try { if (typeof window.scheduleSave === 'function') window.scheduleSave(); } catch {}
  }

  // 하위 호환: 기존 API (단, 이제 선택 영역을 '보존'하며 뒤에 삽입)
  function insertFigure(svgOrHtml, caption, mermaidCode) {
    insertFigureAfterSelection(buildDiagramFigureHtml(svgOrHtml, caption, mermaidCode));
  }

  /* ---------- 편집/삭제 이벤트 위임 ---------- */
  function onDocClickForFigures(ev) {
    // 인라인 수식 span 클릭 → 편집
    const inlineMath = ev.target.closest && ev.target.closest('span.jan-math-inline');
    if (inlineMath && !ev.target.closest('[data-math-act]')) {
      ev.preventDefault();
      ev.stopPropagation();
      openInlineMathEditor(inlineMath);
      return;
    }
    const btn = ev.target.closest && ev.target.closest('[data-diag-act], [data-math-act]');
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    const fig = btn.closest('figure.jan-diagram, figure.jan-math');
    if (!fig) return;
    const act = btn.getAttribute('data-diag-act') || btn.getAttribute('data-math-act');
    if (act === 'delete') {
      fig.remove();
      try { if (typeof window.scheduleSave === 'function') window.scheduleSave(); } catch {}
      notify('삭제됨');
      return;
    }
    if (act === 'move-up' || act === 'move-down') {
      // 바로 인접한 형제가 빈 <p>/줄바꿈인 경우 흔해서, 같은 타입 figure 가 아니어도
      // 한 블록 위/아래로 단순 스왑. 인접 형제가 없으면 부모 레벨로 올라가며 찾음.
      const dir = act === 'move-up' ? 'prev' : 'next';
      let target = dir === 'prev' ? fig.previousElementSibling : fig.nextElementSibling;
      // 빈 <p> 이거나 <br> 만 있는 블록은 건너뛰면서 의미있는 형제 찾기
      while (target && isEmptyBlock(target)) {
        target = dir === 'prev' ? target.previousElementSibling : target.nextElementSibling;
      }
      if (!target) { notify(dir === 'prev' ? '더 위로 이동할 수 없음' : '더 아래로 이동할 수 없음'); return; }
      if (dir === 'prev') {
        fig.parentNode.insertBefore(fig, target);
      } else {
        fig.parentNode.insertBefore(fig, target.nextSibling);
      }
      try { if (typeof window.scheduleSave === 'function') window.scheduleSave(); } catch {}
      fig.focus();
      notify(dir === 'prev' ? '위로 이동됨' : '아래로 이동됨');
      return;
    }
    if (act === 'cut') {
      // Word 호환 복사 → 성공 후 figure 제거
      copyFigureForWord(fig).then(() => {
        fig.remove();
        try { if (typeof window.scheduleSave === 'function') window.scheduleSave(); } catch {}
        notify('잘라냈습니다 — 원하는 곳에 Ctrl+V');
      }).catch(err => {
        console.error('[cutFigure]', err);
        notify('잘라내기 실패: ' + err.message);
      });
      return;
    }
    if (act === 'copy-latex') {
      const enc = fig.getAttribute('data-latex') || '';
      const latex = b64dec(enc);
      try { navigator.clipboard.writeText(latex); notify('LaTeX 복사됨'); }
      catch { notify('복사 실패'); }
      return;
    }
    if (act === 'copy') {
      // Word·한글·메일 호환 복사 (PNG + plain text)
      copyFigureForWord(fig).catch(err => {
        console.error('[copyFigure]', err);
        notify('복사 실패: ' + err.message);
      });
      return;
    }
    if (act === 'edit') {
      if (fig.classList.contains('jan-diagram')) {
        openDiagramEditor(fig);
      } else if (fig.classList.contains('jan-math')) {
        openMathEditor(fig);
      }
    }
  }
  document.addEventListener('click', onDocClickForFigures, true);

  /* ---------- figure 포커스/Ctrl+C 지원 ---------- */
  function onFigureFocus(ev) {
    const fig = ev.target.closest && ev.target.closest('figure.jan-diagram, figure.jan-math');
    if (!fig) return;
    document.querySelectorAll('figure.jan-diagram.jan-focus, figure.jan-math.jan-focus')
      .forEach(f => { if (f !== fig) f.classList.remove('jan-focus'); });
    fig.classList.add('jan-focus');
  }
  function onFigureBlur(ev) {
    const fig = ev.target.closest && ev.target.closest('figure.jan-diagram, figure.jan-math');
    if (fig) fig.classList.remove('jan-focus');
  }
  document.addEventListener('focusin', onFigureFocus);
  document.addEventListener('focusout', onFigureBlur);
  // Ctrl+C — 포커스된 figure 가 있으면 Word 호환 복사
  document.addEventListener('keydown', (ev) => {
    if (!(ev.key === 'c' || ev.key === 'C') || !(ev.ctrlKey || ev.metaKey)) return;
    const fig = document.querySelector('figure.jan-diagram.jan-focus, figure.jan-math.jan-focus');
    if (!fig) return;
    // 텍스트 선택이 있는 경우엔 일반 복사 존중
    const sel = window.getSelection();
    if (sel && sel.toString()) return;
    ev.preventDefault();
    ev.stopPropagation();
    copyFigureForWord(fig).catch(() => {});
  }, true);
  // Delete/Backspace — 포커스된 figure 삭제
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Delete' && ev.key !== 'Backspace') return;
    const fig = document.querySelector('figure.jan-diagram.jan-focus, figure.jan-math.jan-focus');
    if (!fig) return;
    ev.preventDefault();
    fig.remove();
    try { if (typeof window.scheduleSave === 'function') window.scheduleSave(); } catch {}
    notify('삭제됨');
  });

  /* ---------- 편집 모달: 다이어그램 ---------- */
  function openDiagramEditor(fig) {
    const enc = fig.getAttribute('data-mermaid-code') || '';
    const code = b64dec(enc);
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    const okBtn = document.getElementById('modalOk');
    const cancelBtn = document.getElementById('modalCancel');
    if (!modal || !title || !body || !okBtn || !cancelBtn) {
      notify('편집 다이얼로그를 열 수 없습니다');
      return;
    }
    title.textContent = '다이어그램 편집 (Mermaid)';
    body.innerHTML =
      '<div style="font-size:12px; color:#666; margin-bottom:6px;">Mermaid 코드를 수정한 뒤 "재생성"을 누르세요.</div>' +
      '<textarea id="janDiagEditTa" rows="10" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px; font-family:Consolas,monospace; font-size:12.5px; line-height:1.5;"></textarea>' +
      '<div id="janDiagPreview" style="margin-top:10px; min-height:60px; border:1px dashed #eee; border-radius:6px; padding:8px; background:#fff; overflow:auto;"></div>' +
      '<div style="font-size:11px; color:#888; margin-top:4px;">Tip: 아래 미리보기는 실시간으로 갱신됩니다.</div>';
    const ta = document.getElementById('janDiagEditTa');
    const preview = document.getElementById('janDiagPreview');
    ta.value = code;
    okBtn.textContent = '재생성';
    cancelBtn.textContent = '취소';
    modal.classList.add('open');

    let previewTimer = null;
    async function updatePreview() {
      try {
        preview.classList.add('jan-diagram');
        const svg = await renderMermaid(ta.value.trim());
        preview.innerHTML = svg;
      } catch (e) {
        const hint = humanizeMermaidError(e);
        preview.classList.remove('jan-diagram');
        preview.innerHTML =
          '<div class="jan-mermaid-err">' +
            '<strong>오류가 있어요</strong>' +
            '<div class="hint">' + escapeHtml(hint) + '</div>' +
            '<details><summary>개발자 원문 보기</summary><pre>' + escapeHtml(String(e && e.message || e)) + '</pre></details>' +
          '</div>';
      }
    }
    ta.addEventListener('input', () => {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(updatePreview, 400);
    });
    // 초기 미리보기
    updatePreview();

    function cleanup() {
      modal.classList.remove('open');
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      okBtn.textContent = '확인';
      cancelBtn.textContent = '취소';
    }
    okBtn.onclick = async () => {
      const newCode = ta.value.trim();
      if (!newCode) { notify('코드가 비어 있습니다'); return; }
      try {
        const svg = await renderMermaid(newCode);
        const body2 = fig.querySelector('.jan-diagram-body');
        if (body2) body2.innerHTML = svg;
        fig.setAttribute('data-mermaid-code', b64enc(newCode));
        try { if (typeof window.scheduleSave === 'function') window.scheduleSave(); } catch {}
        notify('다이어그램 갱신 완료');
        cleanup();
      } catch (e) {
        notify('렌더 실패: ' + humanizeMermaidError(e));
      }
    };
    cancelBtn.onclick = cleanup;
  }

  /* ---------- 편집 모달: 인라인 수식 ---------- */
  function openInlineMathEditor(span) {
    const latex = span.dataset.latex || '';
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    const okBtn = document.getElementById('modalOk');
    const cancelBtn = document.getElementById('modalCancel');
    if (!modal) { notify('편집 다이얼로그를 열 수 없습니다'); return; }
    title.textContent = '인라인 수식 편집';
    body.innerHTML =
      '<div style="font-size:12px; color:#666; margin-bottom:6px;">LaTeX 한 줄을 수정하세요.</div>' +
      '<textarea id="janMathInlineTa" rows="2" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px; font-family:Consolas,monospace; font-size:13px;"></textarea>' +
      '<div id="janMathInlinePreview" style="margin-top:10px; padding:10px; background:#fffdf7; border:1px dashed #eee; border-radius:6px; min-height:28px;"></div>' +
      '<div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">' +
        '<button type="button" id="janInlineCopy" style="padding:4px 10px; font-size:11px; border:1px solid #ddd; background:#fff; border-radius:4px; cursor:pointer;">복사</button>' +
        '<button type="button" id="janInlineCut" style="padding:4px 10px; font-size:11px; border:1px solid #ddd; background:#fff; border-radius:4px; cursor:pointer;">잘라내기</button>' +
        '<button type="button" id="janInlineCopyLatex" style="padding:4px 10px; font-size:11px; border:1px solid #ddd; background:#fff; border-radius:4px; cursor:pointer;">LaTeX 복사</button>' +
        '<button type="button" id="janInlineConvertBlock" style="padding:4px 10px; font-size:11px; border:1px solid #ddd; background:#fff; border-radius:4px; cursor:pointer;">블록 모드로 변환</button>' +
        '<button type="button" id="janInlineDelete" style="padding:4px 10px; font-size:11px; border:1px solid #C0392B; color:#C0392B; background:#fff; border-radius:4px; cursor:pointer;">삭제</button>' +
      '</div>';
    const ta = document.getElementById('janMathInlineTa');
    const preview = document.getElementById('janMathInlinePreview');
    ta.value = latex;
    okBtn.textContent = '재생성';
    cancelBtn.textContent = '취소';
    modal.classList.add('open');

    let previewTimer = null;
    async function updatePreview() {
      try {
        preview.innerHTML = await renderLatexInlineHtml(ta.value);
      } catch (e) {
        preview.innerHTML = '<span style="color:#c00; font-size:12px;">' + escapeHtml(e.message) + '</span>';
      }
    }
    ta.addEventListener('input', () => {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(updatePreview, 250);
    });
    updatePreview();

    function cleanup() {
      modal.classList.remove('open');
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      okBtn.textContent = '확인';
      cancelBtn.textContent = '취소';
    }
    // 인라인 수식 복사 — 내부에서 임시 block figure 만들어 copyFigureForWord 호출.
    // 클립보드에 jan-figure meta + PNG + LaTeX 세 포맷이 모두 담겨 다른 노트에 붙여넣기 가능.
    async function copyInlineToClipboard() {
      try {
        const html = await renderLatexHtml(latex);  // block 용 display 렌더 (PNG 용)
        const tmp = document.createElement('div');
        tmp.style.position = 'fixed';
        tmp.style.left = '-10000px';
        tmp.innerHTML = buildMathFigureHtml(html, latex, '수식');
        document.body.appendChild(tmp);
        try {
          await copyFigureForWord(tmp.firstChild);
        } finally {
          tmp.remove();
        }
        return true;
      } catch (e) {
        notify('복사 실패: ' + e.message);
        return false;
      }
    }
    document.getElementById('janInlineCopy').onclick = async () => {
      if (await copyInlineToClipboard()) cleanup();
    };
    document.getElementById('janInlineCut').onclick = async () => {
      if (await copyInlineToClipboard()) {
        span.remove();
        try { if (typeof window.scheduleSave === 'function') window.scheduleSave(); } catch {}
        notify('잘라냈습니다 — 원하는 곳에 Ctrl+V');
        cleanup();
      }
    };
    document.getElementById('janInlineCopyLatex').onclick = () => {
      navigator.clipboard.writeText(latex).then(
        () => { notify('LaTeX 복사됨'); cleanup(); },
        () => notify('복사 실패')
      );
    };
    document.getElementById('janInlineConvertBlock').onclick = async () => {
      const newLatex = ta.value.trim();
      if (!newLatex) return;
      try {
        const html = await renderLatexHtml(newLatex);
        if (!html) { notify('렌더할 수식이 없습니다'); return; }
        const wrapper = document.createElement('div');
        wrapper.innerHTML = buildMathFigureHtml(html, newLatex, '수식');
        const fig = wrapper.firstChild;
        span.replaceWith(fig);
        try { if (typeof window.scheduleSave === 'function') window.scheduleSave(); } catch {}
        notify('블록 모드로 변환됨');
        cleanup();
      } catch (e) { notify('변환 실패: ' + e.message); }
    };
    document.getElementById('janInlineDelete').onclick = () => {
      span.remove();
      try { if (typeof window.scheduleSave === 'function') window.scheduleSave(); } catch {}
      notify('삭제됨');
      cleanup();
    };
    okBtn.onclick = async () => {
      const newLatex = ta.value.trim();
      if (!newLatex) { notify('LaTeX 가 비어 있습니다'); return; }
      try {
        const html = await renderLatexInlineHtml(newLatex);
        if (!html) { notify('렌더할 수식이 없습니다'); return; }
        span.innerHTML = html;
        span.dataset.latex = newLatex;
        span.title = newLatex + ' (클릭해서 편집)';
        try { if (typeof window.scheduleSave === 'function') window.scheduleSave(); } catch {}
        notify('수식 갱신 완료');
        cleanup();
      } catch (e) { notify('렌더 실패: ' + e.message); }
    };
    cancelBtn.onclick = cleanup;
  }

  /* ---------- 편집 모달: 수식 ---------- */
  function openMathEditor(fig) {
    const enc = fig.getAttribute('data-latex') || '';
    const latex = b64dec(enc);
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    const okBtn = document.getElementById('modalOk');
    const cancelBtn = document.getElementById('modalCancel');
    if (!modal) { notify('편집 다이얼로그를 열 수 없습니다'); return; }
    title.textContent = '수식 편집 (LaTeX)';
    body.innerHTML =
      '<div style="font-size:12px; color:#666; margin-bottom:6px;">LaTeX 코드를 수정한 뒤 "재생성"을 누르세요.</div>' +
      '<textarea id="janMathEditTa" rows="6" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px; font-family:Consolas,monospace; font-size:13px; line-height:1.5;"></textarea>' +
      '<div id="janMathPreview" style="margin-top:10px; min-height:50px; border:1px dashed #eee; border-radius:6px; padding:10px; background:#fffdf7; overflow-x:auto;"></div>';
    const ta = document.getElementById('janMathEditTa');
    const preview = document.getElementById('janMathPreview');
    ta.value = latex;
    okBtn.textContent = '재생성';
    cancelBtn.textContent = '취소';
    modal.classList.add('open');

    let previewTimer = null;
    async function updatePreview() {
      try {
        preview.innerHTML = await renderLatexHtml(ta.value);
      } catch (e) {
        preview.innerHTML = '<div style="color:#c00; font-size:12px;">' + escapeHtml(e.message) + '</div>';
      }
    }
    ta.addEventListener('input', () => {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(updatePreview, 300);
    });
    updatePreview();

    function cleanup() {
      modal.classList.remove('open');
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      okBtn.textContent = '확인';
      cancelBtn.textContent = '취소';
    }
    okBtn.onclick = async () => {
      const newLatex = ta.value.trim();
      if (!newLatex) { notify('LaTeX 가 비어 있습니다'); return; }
      try {
        const html = await renderLatexHtml(newLatex);
        // figure 의 figcaption 보존하면서 앞부분만 교체
        const cap = fig.querySelector('figcaption');
        fig.innerHTML = html + (cap ? cap.outerHTML : '');
        fig.setAttribute('data-latex', b64enc(newLatex));
        try { if (typeof window.scheduleSave === 'function') window.scheduleSave(); } catch {}
        notify('수식 갱신 완료');
        cleanup();
      } catch (e) {
        notify('렌더 실패: ' + e.message);
      }
    };
    cancelBtn.onclick = cleanup;
  }

  /* ---------- AI 호출 ---------- */
  async function aiCall(sys, user) {
    if (typeof window.callAI !== 'function') {
      notify('AI 함수를 찾을 수 없습니다');
      return null;
    }
    return await window.callAI(sys, user);
  }

  /* ---------- 프롬프트 ---------- */
  const ORG_SYS =
    '당신은 텍스트 분석 전문가입니다. 주어진 텍스트의 계층 관계(조직도·구성 관계)를 ' +
    'Mermaid flowchart TD 코드로 정확히 표현하세요.\n\n' +
    '규칙:\n' +
    '1. 반드시 "flowchart TD" 로 시작\n' +
    '2. 노드 ID 는 영문+숫자 (예: A, B1, C2). 절대 한글 ID 사용 금지\n' +
    '3. 한글 이름·라벨은 반드시 대괄호 [ ] 안에 넣기. 예: A[대표]\n' +
    '4. 부모-자식 관계는 --> 화살표로\n' +
    '5. 같은 부모의 자식들은 부모 바로 아래 나열\n' +
    '6. 코드블록 ```mermaid ``` 안에만 코드. 설명·주석 일체 금지\n' +
    '7. 노드 라벨 안에 " ( ) [ ] { } | 문자 사용 금지';

  const FLOW_SYS =
    '당신은 절차 분석가입니다. 주어진 텍스트의 순서·절차·단계를 ' +
    'Mermaid flowchart LR 코드로 정확히 표현하세요.\n\n' +
    '규칙:\n' +
    '1. 반드시 "flowchart LR" 로 시작\n' +
    '2. 노드 ID 는 영문+숫자 (S1, S2, …). 절대 한글 ID 사용 금지\n' +
    '3. 한글 라벨은 반드시 대괄호 [ ] 안에. 예: S1[원서 작성]\n' +
    '4. 단계간 흐름은 --> 화살표로\n' +
    '5. 조건 분기가 있으면 마름모 {조건?} 와 |예|/|아니오| 라벨 사용. 예: S2{합격?} -->|예| S3[다음]\n' +
    '6. 코드블록 ```mermaid ``` 안에만 코드. 설명 금지\n' +
    '7. 라벨 안에 " ( ) [ ] { } | 사용 금지';

  const INFO_SYS =
    '당신은 데이터 추출 전문가입니다. 주어진 텍스트에서 핵심 수치·비교·통계 데이터를 ' +
    '뽑아 JSON 배열로 출력하세요.\n\n' +
    '형식: [{"label":"한글 라벨","value":숫자,"unit":"단위","color":"#rrggbb"}, ...]\n\n' +
    '규칙:\n' +
    '1. JSON 배열만 출력 (설명·주석 금지). 코드블록은 ```json 허용\n' +
    '2. value 는 반드시 숫자 (쉼표·단위 제외한 순수 숫자)\n' +
    '3. unit 은 선택 — "%", "억", "명", "kg" 등\n' +
    '4. color 는 선택. 생략 시 자동 배색됨\n' +
    '5. label 은 한국어. 20자 이내\n' +
    '6. 수치가 전혀 없으면 빈 배열 [] 출력';

  const MATH_SYS =
    '당신은 수학 표기 전문가입니다. 주어진 텍스트(또는 설명문)를 ' +
    'KaTeX/LaTeX 수식으로 정확히 변환하세요.\n\n' +
    '지원 기호 — 최대한 많이 활용하세요:\n' +
    '- 사칙연산: +, -, \\times, \\div, \\pm, \\mp\n' +
    '- 분수: \\frac{a}{b}\n' +
    '- 근호: \\sqrt{x}, \\sqrt[n]{x}\n' +
    '- 지수/첨자: x^2, x_n, x^{n+1}, x_{i,j}\n' +
    '- 적분/합: \\int, \\iint, \\oint, \\sum, \\prod, \\bigcup, \\bigcap\n' +
    '- 미분: \\frac{dy}{dx}, \\partial, \\nabla, f\'(x), \\dot{x}, \\ddot{x}\n' +
    '- 벡터: \\vec{v}, \\mathbf{v}, \\overrightarrow{AB}\n' +
    '- 행렬: \\begin{pmatrix}...\\end{pmatrix}, bmatrix, vmatrix\n' +
    '- 로그: \\log, \\ln, \\log_2\n' +
    '- 지수함수: e^x, \\exp(x)\n' +
    '- 삼각: \\sin, \\cos, \\tan, \\arcsin, \\arctan, \\sec, \\csc\n' +
    '- 극한: \\lim_{x \\to 0}, \\limsup, \\liminf\n' +
    '- 집합: \\in, \\notin, \\subset, \\subseteq, \\cup, \\cap, \\emptyset, \\mathbb{R}\n' +
    '- 부등호: \\leq, \\geq, \\neq, \\approx, \\equiv, \\sim, \\cong\n' +
    '- 그리스: \\alpha, \\beta, \\gamma, \\theta, \\pi, \\sigma, \\phi, \\omega, \\Omega\n' +
    '- 괄호: \\left(...\\right), \\{...\\}, \\langle...\\rangle, \\lfloor...\\rfloor\n' +
    '- 논리/기타: \\to, \\rightarrow, \\iff, \\forall, \\exists, \\infty\n\n' +
    '규칙:\n' +
    '1. **LaTeX 코드만** 출력 (설명·마크다운·코드블록 감싸기 금지)\n' +
    '2. 다중 식은 **줄바꿈** 으로 구분\n' +
    '3. 변환 불가/판독 불가는 [?] 로 표시\n' +
    '4. 달러($) 나 \\[ \\] 같은 구분자 감싸지 말고 순수 식만';

  /* ---------- Mermaid 코드 후처리 ---------- */
  function sanitizeMermaid(code, kind) {
    if (!code) return '';
    let s = String(code);
    // 1. 주변 코드펜스 제거 (``` 또는 ```mermaid)
    s = s.replace(/^\s*```+\s*(?:mermaid|mmd)?\s*\n?/i, '');
    s = s.replace(/\n?\s*```+\s*$/, '');
    // 2. 본문 내부에 중복된 ```mermaid 와 그 뒤 중복된 flowchart/graph 헤더 제거
    //    (AI 가 `flowchart TD\n```mermaid\nflowchart TD\n...` 형태로 중첩 반환하는 경우)
    s = s.replace(/\s*```+\s*(?:mermaid|mmd)?\s*\n\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie)\s+\w+\n/gi,
                  '\n');
    // 3. 닫히지 않은 ``` 단독 라인 제거
    s = s.replace(/^\s*```+\s*$/gm, '');
    let c = s.trim();
    // 4. 헤더 보강: flowchart 또는 graph 헤더가 없으면 기본값 삽입
    const firstLine = c.split(/\r?\n/, 1)[0].trim();
    if (!/^(?:flowchart|graph)\s+(TD|LR|TB|BT|RL)/i.test(firstLine)) {
      const header = kind === 'flow' ? 'flowchart LR' : 'flowchart TD';
      c = header + '\n' + c;
    }
    return c;
  }

  /* ---------- 선택 범위 해석기 (공용) ----------
     호출 시점에 selection 을 확인.
       - 있으면: 그대로 사용 + toast
       - 없으면: 커서 주변 블록(p/li/heading) 의 textContent 를 기본 소스로
     반환: { text, fromSelection: boolean }
     selectedText 인자가 이미 넘어오면 그걸 존중 (명령 팔레트/선택 메뉴 경로).
  */
  function resolveSourceText(argText, kindLabel) {
    const argTrim = (argText || '').trim();
    if (argTrim) {
      // 외부에서 이미 추출된 텍스트: argText 가 selection 이었는지는
      // 여기서 재확인 불가 → 우선 live selection 을 먼저 체크
      try {
        const liveSel = (window.getSelection && window.getSelection().toString().trim()) || '';
        if (liveSel && argTrim === liveSel) {
          notify('선택된 ' + liveSel.length + '자로 ' + kindLabel + ' 생성 중…');
          return { text: liveSel, fromSelection: true };
        }
      } catch {}
      notify('선택된 텍스트가 없어서 현재 문단으로 ' + kindLabel + ' 생성. (특정 내용만 변환하려면 먼저 선택)');
      return { text: argTrim, fromSelection: false };
    }
    try {
      const liveSel = (window.getSelection && window.getSelection().toString().trim()) || '';
      if (liveSel) {
        notify('선택된 ' + liveSel.length + '자로 ' + kindLabel + ' 생성 중…');
        return { text: liveSel, fromSelection: true };
      }
      // 커서가 속한 블록 탐색
      const sel = window.getSelection && window.getSelection();
      if (sel && sel.anchorNode) {
        let node = sel.anchorNode;
        if (node.nodeType === 3) node = node.parentElement;
        while (node && node !== document.body) {
          const tag = (node.tagName || '').toLowerCase();
          if (/^(p|li|h1|h2|h3|h4|h5|h6|blockquote|pre|td|th)$/.test(tag)) {
            const t = (node.textContent || '').trim();
            if (t) {
              notify('선택된 텍스트가 없어서 현재 문단으로 ' + kindLabel + ' 생성. (특정 내용만 변환하려면 먼저 선택)');
              return { text: t, fromSelection: false };
            }
          }
          node = node.parentElement;
        }
      }
    } catch {}
    return { text: '', fromSelection: false };
  }

  /* ---------- Org Chart (구성도) ---------- */
  async function buildOrgChart(selectedText) {
    const res = resolveSourceText(selectedText, '구성도');
    const text = res.text;
    if (!text) { notify('변환할 텍스트가 없습니다 (선택 또는 현재 문단)'); return null; }
    captureRangeNow();  // 현재 선택 위치를 고정 (AI 대기 중 selection 손실 방어)
    const resp = await aiCall(ORG_SYS, text);
    if (!resp) return null;
    const code = sanitizeMermaid(stripCodeFence(resp, 'mermaid'), 'org');
    try {
      const svg = await renderMermaid(code);
      insertFigureAfterSelection(buildDiagramFigureHtml(svg, 'AI 가 생성한 구성도', code));
      notify('구성도 삽입 완료');
      return { code, svg };
    } catch (e) {
      console.error('[OrgChart] render 실패:', e, '\ncode:', code);
      const fallback =
        '<pre style="text-align:left; background:#f5f5f5; padding:10px; ' +
        'border-radius:6px; font-size:12px; overflow:auto; max-width:100%;">' +
        escapeHtml(code) + '</pre>';
      insertFigureAfterSelection(buildDiagramFigureHtml(fallback, '다이어그램 렌더 실패 — 원본 Mermaid 코드', code));
      notify('렌더는 실패했지만 코드를 삽입했습니다 (편집으로 수정 가능)');
      return { code, error: e.message };
    }
  }

  /* ---------- Flowchart (순서도) ---------- */
  async function buildFlowchart(selectedText) {
    const res = resolveSourceText(selectedText, '순서도');
    const text = res.text;
    if (!text) { notify('변환할 텍스트가 없습니다 (선택 또는 현재 문단)'); return null; }
    captureRangeNow();
    const resp = await aiCall(FLOW_SYS, text);
    if (!resp) return null;
    const code = sanitizeMermaid(stripCodeFence(resp, 'mermaid'), 'flow');
    try {
      const svg = await renderMermaid(code);
      insertFigureAfterSelection(buildDiagramFigureHtml(svg, 'AI 가 생성한 순서도', code));
      notify('순서도 삽입 완료');
      return { code, svg };
    } catch (e) {
      console.error('[Flowchart] render 실패:', e, '\ncode:', code);
      const fallback =
        '<pre style="text-align:left; background:#f5f5f5; padding:10px; ' +
        'border-radius:6px; font-size:12px; overflow:auto; max-width:100%;">' +
        escapeHtml(code) + '</pre>';
      insertFigureAfterSelection(buildDiagramFigureHtml(fallback, '다이어그램 렌더 실패 — 원본 Mermaid 코드', code));
      notify('렌더는 실패했지만 코드를 삽입했습니다 (편집으로 수정 가능)');
      return { code, error: e.message };
    }
  }

  /* ---------- Infographic (인포그래픽) ---------- */
  const DEFAULT_COLORS = [
    '#FF6B9D', '#63B8FF', '#FFB84C', '#A78BFA',
    '#59C173', '#FF8A5C', '#4DD0E1', '#FFB8D1'
  ];

  function parseInfoJson(raw) {
    if (!raw) return [];
    let t = stripCodeFence(raw, 'json').trim();
    const s = t.indexOf('[');
    const e = t.lastIndexOf(']');
    if (s >= 0 && e > s) t = t.slice(s, e + 1);
    try {
      const arr = JSON.parse(t);
      if (!Array.isArray(arr)) return [];
      return arr
        .filter(it => it && typeof it === 'object')
        .map(it => ({
          label: String(it.label || '').trim(),
          value: Number(it.value),
          unit: it.unit ? String(it.unit) : '',
          color: /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(it.color || ''))
            ? it.color : null
        }))
        .filter(it => it.label && isFinite(it.value));
    } catch (e) {
      console.warn('[Infographic] JSON 파싱 실패:', e, t);
      return [];
    }
  }

  function renderBarChartSvg(items) {
    const W = 560;
    const rowH = 42;
    const padL = 140;
    const padR = 80;
    const padT = 20;
    const padB = 16;
    const H = padT + padB + items.length * rowH;
    const max = Math.max(...items.map(it => Math.abs(it.value)), 1);
    const barMax = W - padL - padR;

    const rows = items.map((it, i) => {
      const y = padT + i * rowH;
      const color = it.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      const barW = (Math.abs(it.value) / max) * barMax;
      const valTxt = escapeHtml(
        (Number.isInteger(it.value) ? it.value : it.value.toFixed(2)) +
        (it.unit ? ' ' + it.unit : '')
      );
      return (
        '<g>' +
          '<text x="' + (padL - 10) + '" y="' + (y + rowH / 2 + 4) +
            '" text-anchor="end" font-size="13" fill="#333" font-weight="600">' +
            escapeHtml(it.label) + '</text>' +
          '<rect x="' + padL + '" y="' + (y + 8) +
            '" width="' + barW + '" height="' + (rowH - 16) +
            '" rx="4" fill="' + color + '" opacity="0.88"/>' +
          '<text x="' + (padL + barW + 8) + '" y="' + (y + rowH / 2 + 4) +
            '" font-size="12" fill="#222" font-weight="700">' + valTxt + '</text>' +
        '</g>'
      );
    }).join('');

    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H +
      '" width="100%" style="max-width:' + W + 'px;">' +
        '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>' +
        rows +
      '</svg>'
    );
  }

  function renderKpiCardsSvg(items) {
    const cardW = 170;
    const cardH = 110;
    const gap = 14;
    const perRow = Math.min(3, items.length);
    const rows = Math.ceil(items.length / perRow);
    const W = perRow * cardW + (perRow + 1) * gap;
    const H = rows * cardH + (rows + 1) * gap;

    const cards = items.map((it, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const x = gap + col * (cardW + gap);
      const y = gap + row * (cardH + gap);
      const color = it.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      const val = Number.isInteger(it.value)
        ? String(it.value)
        : it.value.toFixed(2);
      return (
        '<g>' +
          '<rect x="' + x + '" y="' + y + '" width="' + cardW + '" height="' + cardH +
            '" rx="10" fill="' + color + '" opacity="0.12" stroke="' + color +
            '" stroke-width="1.5"/>' +
          '<rect x="' + x + '" y="' + y + '" width="4" height="' + cardH +
            '" rx="2" fill="' + color + '"/>' +
          '<text x="' + (x + cardW / 2) + '" y="' + (y + cardH / 2 + 4) +
            '" text-anchor="middle" font-size="28" font-weight="800" fill="#1a1a1a">' +
            escapeHtml(val) +
          '</text>' +
          (it.unit
            ? '<text x="' + (x + cardW / 2) + '" y="' + (y + cardH / 2 + 26) +
              '" text-anchor="middle" font-size="11" fill="#555" font-weight="600">' +
              escapeHtml(it.unit) + '</text>'
            : '') +
          '<text x="' + (x + cardW / 2) + '" y="' + (y + cardH - 16) +
            '" text-anchor="middle" font-size="12" fill="#333">' +
            escapeHtml(it.label) + '</text>' +
        '</g>'
      );
    }).join('');

    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H +
      '" width="100%" style="max-width:' + W + 'px;">' +
        '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>' +
        cards +
      '</svg>'
    );
  }

  async function buildInfographic(selectedText) {
    const res = resolveSourceText(selectedText, '인포그래픽');
    const text = res.text;
    if (!text) { notify('변환할 텍스트가 없습니다 (선택 또는 현재 문단)'); return null; }
    captureRangeNow();
    const resp = await aiCall(INFO_SYS, text);
    if (!resp) return null;
    const items = parseInfoJson(resp);
    if (items.length === 0) {
      notify('핵심 수치를 추출하지 못했습니다. 숫자가 포함된 텍스트를 선택해 보세요');
      return { items: [], error: '수치 추출 실패' };
    }
    const units = new Set(items.map(it => it.unit || ''));
    const svg = units.size <= 1
      ? renderBarChartSvg(items)
      : renderKpiCardsSvg(items);
    // 인포그래픽은 Mermaid 코드가 없으므로 편집 버튼 없음
    insertFigureAfterSelection(buildDiagramFigureHtml(svg, 'AI 가 생성한 인포그래픽 (' + items.length + '개 지표)', ''));
    notify('인포그래픽 삽입 완료');
    return { items, svg };
  }

  /* ---------- 수식 변환 (텍스트/LaTeX → KaTeX 렌더) ---------- */
  async function convertTextToMath(selectedText) {
    const text = (selectedText || '').trim();
    if (!text) { notify('선택된 텍스트가 없습니다'); return null; }
    captureRangeNow();
    notify('수식을 LaTeX 로 변환 중…');
    const resp = await aiCall(MATH_SYS, text);
    if (!resp) return null;
    const latex = sanitizeLatex(resp);
    if (!latex) { notify('수식을 추출하지 못했습니다'); return null; }
    try {
      const html = await renderLatexHtml(latex);
      if (!html) { notify('렌더할 수식이 없습니다'); return null; }
      insertFigureAfterSelection(buildMathFigureHtml(html, latex, '수식'));
      notify('수식 삽입 완료');
      return { latex, html };
    } catch (e) {
      console.error('[Math] render 실패:', e, latex);
      notify('렌더 실패: ' + e.message);
      return { latex, error: e.message };
    }
  }

  /* LaTeX 응답에서 설명문·텍스트를 걸러내고 실제 수식만 남김 (LaTeX 누수 방어).
     버그 재현: AI 가 "\chi^x" 만 반환해야 할 때 앞에 "답: \chi^x" 처럼 라벨이
     붙어 그 전체가 insertMathFromLatex 에 들어가면, KaTeX 가 "답:" 부분을
     raw 로 그려 figure 안에 보이고, 심지어 오류 파싱이 figure 경계를 깨뜨릴
     가능성이 있음. 앞머리 라벨 + 코드펜스 + 달러 감싸기 모두 여기서 제거. */
  function sanitizeLatex(raw) {
    if (!raw) return '';
    let s = stripCodeFence(String(raw));
    s = s.replace(/^\s*\\\[|\\\]\s*$/g, '')
         .replace(/^\s*\$\$|\$\$\s*$/g, '')
         .replace(/^\s*\\\(|\\\)\s*$/g, '')
         .trim();
    // "설명:", "답:", "LaTeX:", "Result:" 같은 앞머리 라벨 제거
    s = s.replace(/^\s*(설명|답|결과|Explanation|LaTeX|Latex|Result|Answer)\s*[:：]\s*/gim, '');
    s = s.replace(/^`+|`+$/g, '').trim();
    return s;
  }

  /* 손글씨 수식 전용: OCR(math) 프롬프트로 이미 변환된 LaTeX 를 바로 삽입 (블록) */
  async function insertMathFromLatex(latex, caption) {
    const s = sanitizeLatex(latex);
    if (!s) { notify('수식이 비어 있습니다'); return null; }
    try {
      const html = await renderLatexHtml(s);
      if (!html) { notify('렌더할 수식이 없습니다'); return null; }
      insertFigureAfterSelection(buildMathFigureHtml(html, s, caption || '수식'));
      notify('수식 삽입 완료');
      return { latex: s, html };
    } catch (e) {
      console.error('[Math] render 실패:', e, s);
      notify('렌더 실패: ' + e.message);
      return { latex: s, error: e.message };
    }
  }

  /* ----------- 인라인 수식: 현재 커서 위치에 글자처럼 삽입 ----------- */
  async function insertMathInline(latex) {
    const s = sanitizeLatex(latex);
    if (!s) { notify('수식이 비어 있습니다'); return null; }
    try {
      const html = await renderLatexInlineHtml(s);
      if (!html) { notify('렌더할 수식이 없습니다'); return null; }
      const span = document.createElement('span');
      span.className = 'jan-math-inline';
      span.contentEditable = 'false';
      span.dataset.latex = s;
      span.innerHTML = html;
      span.title = s + ' (클릭해서 편집)';
      insertInlineAtCursor(span);
      try { if (typeof window.scheduleSave === 'function') window.scheduleSave(); } catch {}
      notify('인라인 수식 삽입 완료');
      return { latex: s, html, node: span };
    } catch (e) {
      console.error('[MathInline] render 실패:', e, s);
      notify('렌더 실패: ' + e.message);
      return { latex: s, error: e.message };
    }
  }

  /* ---------- Word 호환 복사 (PNG + plain text) ---------- */
  // 이미지(img) 를 PNG blob 으로 (이미 raster 라서 재인코딩만)
  function imageToBlob(img, scale = 2) {
    return new Promise((resolve, reject) => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(w * scale);
        canvas.height = Math.ceil(h * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob 실패')), 'image/png');
      } catch (e) { reject(e); }
    });
  }

  // SVG element → PNG blob
  function svgToPngBlob(svgEl, scale = 2) {
    return new Promise((resolve, reject) => {
      try {
        const bbox = svgEl.getBoundingClientRect();
        let w = bbox.width, h = bbox.height;
        const vb = svgEl.getAttribute('viewBox');
        if (vb) {
          const p = vb.split(/\s+/).map(Number);
          if (p.length === 4 && p[2] > 0 && p[3] > 0) {
            w = w || p[2]; h = h || p[3];
          }
        }
        if (!w || !h) { w = 400; h = 300; }
        const clone = svgEl.cloneNode(true);
        if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('width', w);
        clone.setAttribute('height', h);
        // 흰 배경 (Word 에서 투명 검은배경 방지)
        const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bgRect.setAttribute('x', '0'); bgRect.setAttribute('y', '0');
        bgRect.setAttribute('width', '100%'); bgRect.setAttribute('height', '100%');
        bgRect.setAttribute('fill', '#ffffff');
        clone.insertBefore(bgRect, clone.firstChild);
        const xml = new XMLSerializer().serializeToString(clone);
        const svg64 = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(w * scale);
          canvas.height = Math.ceil(h * scale);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(b => b ? resolve(b) : reject(new Error('canvas.toBlob 실패')), 'image/png');
        };
        img.onerror = () => reject(new Error('SVG → Image 로드 실패'));
        img.src = svg64;
      } catch (e) { reject(e); }
    });
  }

  // HTML element (KaTeX 등) → PNG blob (foreignObject SVG 기법)
  function htmlToPngBlob(el, scale = 2) {
    return new Promise((resolve, reject) => {
      try {
        const rect = el.getBoundingClientRect();
        const w = Math.max(1, Math.ceil(rect.width));
        const h = Math.max(1, Math.ceil(rect.height));
        const clone = el.cloneNode(true);
        const katexCss = '<style>@import url("https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css");</style>';
        const xml =
          '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">' +
            '<foreignObject width="100%" height="100%">' +
              '<div xmlns="http://www.w3.org/1999/xhtml" style="margin:0; padding:0; background:#fff; font-family:KaTeX_Main,Times,serif;">' +
                katexCss +
                clone.outerHTML +
              '</div>' +
            '</foreignObject>' +
          '</svg>';
        const svg64 = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(w * scale);
          canvas.height = Math.ceil(h * scale);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(b => b ? resolve(b) : reject(new Error('canvas.toBlob 실패')), 'image/png');
        };
        img.onerror = () => reject(new Error('HTML → Image 로드 실패 (foreignObject CORS 가능성)'));
        img.src = svg64;
      } catch (e) { reject(e); }
    });
  }

  async function rasterizeFigure(fig) {
    // 우선순위: <img> (이미 raster) → <svg> (다이어그램) → KaTeX HTML
    const imgEl = fig.querySelector('img');
    if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
      return imageToBlob(imgEl);
    }
    const svg = fig.querySelector('svg');
    if (svg) return svgToPngBlob(svg);
    const katex = fig.querySelector('.katex-display, .katex');
    if (katex) return htmlToPngBlob(katex);
    return htmlToPngBlob(fig);
  }

  async function copyFigureForWord(fig) {
    if (!fig) throw new Error('figure 가 없습니다');
    notify('복사 준비 중…');
    let pngBlob = null;
    try {
      pngBlob = await rasterizeFigure(fig);
    } catch (e) {
      console.warn('[copyFigure] raster 실패, 폴백 시도:', e);
      try { pngBlob = await htmlToPngBlob(fig); } catch (e2) {
        throw new Error('이미지 변환 실패: ' + (e2.message || e.message));
      }
    }
    // plain text — LaTeX or Mermaid code
    let plainText = '';
    const latexEnc = fig.getAttribute('data-latex') || '';
    const mermaidEnc = fig.getAttribute('data-mermaid-code') || '';
    if (latexEnc) plainText = b64dec(latexEnc);
    else if (mermaidEnc) plainText = b64dec(mermaidEnc);
    else plainText = (fig.textContent || '').trim();

    // text/html — JustANotepad 안으로 붙여넣을 때 '원본 LaTeX' 로부터 새로 렌더해
    // 깨끗한 figure 로 복원되도록, 메타데이터를 data-attributes 로 담은 빈 span 을
    // 주석 블록 안에 둔다. (outerHTML 로 하면 KaTeX 내부 DOM 이 붙여넣기 중 sanitize
    // 되면서 figcaption/mathml 이 노출되는 버그가 있어 포기)
    const figKind = fig.classList.contains('jan-math') ? 'math' : 'diagram';
    const caption = (fig.querySelector('figcaption') ? fig.querySelector('figcaption').firstChild.textContent : '') || '수식';
    const payloadEl =
      '<span data-jan-figure="' + figKind + '"' +
      ' data-jan-latex="' + b64enc(plainText) + '"' +
      ' data-jan-caption="' + b64enc(caption) + '">' +
      '</span>';
    const pngDataUrl = await blobToDataURL(pngBlob);
    // Word·한글 등 외부 앱용 렌더링: base64 이미지. JustANotepad 는 주석 안의 meta 를 보고
    // 새로 렌더, 외부는 img 를 렌더.
    const htmlPayload =
      '<!--jan-figure-start-->' + payloadEl + '<!--jan-figure-end-->' +
      '<img src="' + pngDataUrl + '" alt="' + escapeHtml(plainText) + '" style="max-width:100%;">';

    try {
      if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
        const items = {
          'image/png': pngBlob,
          'text/html': new Blob([htmlPayload], { type: 'text/html' }),
        };
        if (plainText) items['text/plain'] = new Blob([plainText], { type: 'text/plain' });
        await navigator.clipboard.write([new ClipboardItem(items)]);
        notify('복사됨 · 노트에 붙여넣으면 수식으로, Word·한글·메일에는 이미지로');
        return true;
      }
    } catch (e) {
      console.warn('[copyFigure] clipboard.write 실패, 폴백:', e);
    }
    // 폴백 — text 만이라도 복사
    try {
      await navigator.clipboard.writeText(plainText || '');
      notify('이미지 복사 실패 — 텍스트만 복사됨 (브라우저 제한)');
      return true;
    } catch (e) {
      throw new Error('클립보드 접근 거부됨');
    }
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('blob → dataURL 실패'));
      r.readAsDataURL(blob);
    });
  }

  /* 현재 커서(또는 미리 캡처한 range) 위치에 노드를 그대로 삽입 — 원본 선택 텍스트 덮어쓰기 안 함 */
  function insertInlineAtCursor(node) {
    const pageEl = document.getElementById('page') || document.querySelector('[contenteditable="true"]');
    if (!pageEl) return;
    let range = _preservedRange;
    _preservedRange = null;
    if (!range) {
      try { if (typeof window.restorePageSel === 'function') window.restorePageSel(); } catch {}
    }
    const sel = window.getSelection();
    if (!range && sel && sel.rangeCount > 0 && pageEl.contains(sel.anchorNode)) {
      range = sel.getRangeAt(0).cloneRange();
    }
    if (range) {
      // 원본 텍스트 유지 — 선택이 있어도 끝점으로 collapse
      range.collapse(false);
      range.insertNode(node);
      // 커서를 span 뒤로
      const after = document.createRange();
      after.setStartAfter(node);
      after.collapse(true);
      if (sel) { sel.removeAllRanges(); sel.addRange(after); }
    } else {
      pageEl.appendChild(node);
    }
  }

  /* ---------- 공개 ---------- */
  window.JANDiagrams = {
    ensureMermaid,
    renderMermaid,
    ensureKatex,
    renderLatexHtml,
    renderLatexInlineHtml,
    buildOrgChart,
    buildFlowchart,
    buildInfographic,
    convertTextToMath,
    insertMathFromLatex,
    insertMathInline,
    copyFigureForWord,
    insertFigure,
    insertFigureAfterSelection,
    captureRangeNow,
    buildDiagramFigureHtml,
    buildMathFigureHtml,
    sanitizeLatex,
    humanizeMermaidError,
    // 내부 테스트용
    _parseInfoJson: parseInfoJson,
    _stripCodeFence: stripCodeFence,
    _sanitizeMermaid: sanitizeMermaid,
    _b64enc: b64enc,
    _b64dec: b64dec,
  };

  // 기존에 저장된 figure 들의 툴바가 구 버전이라면 (위/아래/잘라내기 버튼이 없음)
  // 새 버튼으로 교체. 저장 트리거는 수정 시에만.
  function upgradeFigureToolbars(root) {
    const scope = root || document;
    const figs = scope.querySelectorAll('figure.jan-math .jan-math-tools');
    let changed = 0;
    figs.forEach(tools => {
      if (tools.querySelector('[data-math-act="move-up"]')) return; // 이미 최신
      const newHTML =
        '<button type="button" data-math-act="move-up" title="한 칸 위로 이동">↑</button>' +
        '<button type="button" data-math-act="move-down" title="한 칸 아래로 이동">↓</button>' +
        '<button type="button" data-math-act="edit">편집</button>' +
        '<button type="button" data-math-act="cut" title="잘라내기 (Word·한글 붙여넣기용)">잘라내기</button>' +
        '<button type="button" data-math-act="copy" title="Word · 한글 · 메일에 이미지로 붙여넣기">복사</button>' +
        '<button type="button" data-math-act="copy-latex" title="LaTeX 텍스트만 복사">LaTeX</button>' +
        '<button type="button" data-math-act="delete" class="danger">삭제</button>';
      tools.innerHTML = newHTML;
      changed++;
    });
    if (changed) {
      try { if (typeof window.scheduleSave === 'function') window.scheduleSave(); } catch {}
      console.log('[JANDiagrams] 기존 수식 figure 툴바 업그레이드:', changed, '개');
    }
  }
  // 페이지 로드 후 한 번, 그리고 페이지 전환 시에도 — 단, 무한 루프 방지
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => upgradeFigureToolbars());
  } else {
    upgradeFigureToolbars();
  }
  // 노트 전환 시 MutationObserver 로 새 figure 가 나타나면 업그레이드 (존재하는 figure 만)
  try {
    const pageEl = document.getElementById('page') || document.querySelector('[contenteditable="true"]');
    if (pageEl) {
      const obs = new MutationObserver(muts => {
        for (const m of muts) {
          for (const n of m.addedNodes) {
            if (n.nodeType === 1 && (n.matches?.('figure.jan-math') || n.querySelector?.('figure.jan-math'))) {
              upgradeFigureToolbars(n);
            }
          }
        }
      });
      obs.observe(pageEl, { childList: true, subtree: true });
    }
  } catch (e) { console.warn('[JANDiagrams] observer 설치 실패', e); }

  console.log('[JANDiagrams v4] ready — figure toolbar 확장 (↑↓ 이동, 잘라내기)');
})();
