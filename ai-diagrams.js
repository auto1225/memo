/* ============================================================
   ai-diagrams.js — AI 다이어그램 자동 생성
   ------------------------------------------------------------
   선택한 텍스트를 분석해서 다음 3종 다이어그램을 자동 생성합니다:

     - 구성도 (buildOrgChart)      : Mermaid flowchart TD
     - 순서도 (buildFlowchart)     : Mermaid flowchart LR
     - 인포그래픽 (buildInfographic): 자체 SVG 바차트 · KPI 카드

   공개 API:  window.JANDiagrams = {
     ensureMermaid, renderMermaid,
     buildOrgChart, buildFlowchart, buildInfographic,
     insertFigure
   }

   사용 예:
     await window.JANDiagrams.buildOrgChart(selectedText);
     // -> 노트에 <figure> 가 자동 삽입됨.

   의존:
     - window.callAI(system, user)   — app.html 에 이미 정의됨
     - window.toast(msg)             — 앱 공용 토스트
     - window.insertHtmlAtCursor(h)  — 커서 위치에 HTML 삽입
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

  // AI 응답에서 코드블록/설명문을 걷어내고 실제 코드만 추출
  function stripCodeFence(txt, hintLang) {
    if (!txt) return '';
    const raw = String(txt).trim();
    // ```mermaid ... ``` 또는 ```json ... ``` 형태
    const fence = raw.match(/```(?:[a-zA-Z]+)?\s*\n?([\s\S]*?)```/);
    if (fence) return fence[1].trim();
    return raw;
  }

  // Mermaid 가 싫어하는 문자를 노드 레이블에서 이스케이프
  function mermaidSafeLabel(s) {
    return String(s || '')
      .replace(/"/g, "'")
      .replace(/\|/g, '／')
      .replace(/[\[\]\(\)\{\}]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

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
              primaryColor: '#FFE0EC',
              primaryBorderColor: '#D97757',
              primaryTextColor: '#222',
              lineColor: '#D97757',
              secondaryColor: '#CCE5FF',
              tertiaryColor: '#FFF6D5'
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
    // mermaid.render 는 validateUp 을 내부에서 돌림. 실패하면 throw.
    const { svg } = await m.render(id, code);
    return svg;
  }

  /* ---------- 노트 삽입 ---------- */
  function insertFigure(svgOrHtml, caption) {
    const figHtml =
      '<figure class="jan-diagram" contenteditable="false" ' +
      'style="margin:12px auto; max-width:600px; text-align:center; ' +
      'border:1px solid rgba(0,0,0,0.08); border-radius:8px; ' +
      'padding:12px; background:#fff;">' +
        '<div class="jan-diagram-body" style="display:flex; ' +
        'justify-content:center; align-items:center; overflow:auto;">' +
          svgOrHtml +
        '</div>' +
        (caption
          ? '<figcaption style="margin-top:8px; font-size:11.5px; ' +
            'color:#888; font-style:italic;">' +
            escapeHtml(caption) + '</figcaption>'
          : '') +
      '</figure><p><br></p>';

    if (typeof window.insertHtmlAtCursor === 'function') {
      window.insertHtmlAtCursor(figHtml);
    } else {
      const page = document.getElementById('page');
      if (page) {
        const tmp = document.createElement('div');
        tmp.innerHTML = figHtml;
        page.appendChild(tmp.firstChild);
      }
    }
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

  /* ---------- Mermaid 코드 후처리 ---------- */
  // AI 가 종종 한글 ID 를 넣거나 잘못된 따옴표를 쓰는 걸 보정
  function sanitizeMermaid(code, kind) {
    if (!code) return '';
    let c = String(code).trim();
    // 맨 첫줄이 flowchart 로 시작 안 하면 보정
    const firstLine = c.split(/\r?\n/, 1)[0].trim();
    if (!/^flowchart\s+(TD|LR|TB|BT|RL)/i.test(firstLine)) {
      const header = kind === 'flow' ? 'flowchart LR' : 'flowchart TD';
      c = header + '\n' + c;
    }
    // "flowchart TD\n" 보장
    return c;
  }

  /* ---------- Org Chart (구성도) ---------- */
  async function buildOrgChart(selectedText) {
    const text = (selectedText || '').trim();
    if (!text) { notify('선택된 텍스트가 없습니다'); return null; }
    notify('구성도를 생성 중…');
    let resp = await aiCall(ORG_SYS, text);
    if (!resp) return null;
    const code = sanitizeMermaid(stripCodeFence(resp, 'mermaid'), 'org');
    try {
      const svg = await renderMermaid(code);
      insertFigure(svg, 'AI 가 생성한 구성도');
      notify('구성도 삽입 완료');
      return { code, svg };
    } catch (e) {
      console.error('[OrgChart] render 실패:', e, '\ncode:', code);
      // fallback: 코드블록으로 삽입
      insertFigure(
        '<pre style="text-align:left; background:#f5f5f5; padding:10px; ' +
        'border-radius:6px; font-size:12px; overflow:auto; max-width:100%;">' +
        escapeHtml(code) + '</pre>',
        '다이어그램 렌더 실패 — 원본 Mermaid 코드'
      );
      notify('렌더는 실패했지만 코드를 삽입했습니다');
      return { code, error: e.message };
    }
  }

  /* ---------- Flowchart (순서도) ---------- */
  async function buildFlowchart(selectedText) {
    const text = (selectedText || '').trim();
    if (!text) { notify('선택된 텍스트가 없습니다'); return null; }
    notify('순서도를 생성 중…');
    let resp = await aiCall(FLOW_SYS, text);
    if (!resp) return null;
    const code = sanitizeMermaid(stripCodeFence(resp, 'mermaid'), 'flow');
    try {
      const svg = await renderMermaid(code);
      insertFigure(svg, 'AI 가 생성한 순서도');
      notify('순서도 삽입 완료');
      return { code, svg };
    } catch (e) {
      console.error('[Flowchart] render 실패:', e, '\ncode:', code);
      insertFigure(
        '<pre style="text-align:left; background:#f5f5f5; padding:10px; ' +
        'border-radius:6px; font-size:12px; overflow:auto; max-width:100%;">' +
        escapeHtml(code) + '</pre>',
        '다이어그램 렌더 실패 — 원본 Mermaid 코드'
      );
      notify('렌더는 실패했지만 코드를 삽입했습니다');
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
    // 대괄호만 남기기
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

  // 수평 바차트 SVG (단위가 같거나 단일일 때 비교용)
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

  // KPI 카드 SVG (서로 다른 성격의 수치들을 카드로)
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
    const text = (selectedText || '').trim();
    if (!text) { notify('선택된 텍스트가 없습니다'); return null; }
    notify('인포그래픽 데이터를 추출 중…');
    const resp = await aiCall(INFO_SYS, text);
    if (!resp) return null;
    const items = parseInfoJson(resp);
    if (items.length === 0) {
      notify('핵심 수치를 추출하지 못했습니다. 숫자가 포함된 텍스트를 선택해 보세요');
      return { items: [], error: '수치 추출 실패' };
    }
    // 단위가 같으면 바차트, 다르면 KPI 카드
    const units = new Set(items.map(it => it.unit || ''));
    const svg = units.size <= 1
      ? renderBarChartSvg(items)
      : renderKpiCardsSvg(items);
    insertFigure(svg, 'AI 가 생성한 인포그래픽 (' + items.length + '개 지표)');
    notify('인포그래픽 삽입 완료');
    return { items, svg };
  }

  /* ---------- 공개 ---------- */
  window.JANDiagrams = {
    ensureMermaid,
    renderMermaid,
    buildOrgChart,
    buildFlowchart,
    buildInfographic,
    insertFigure,
    // 내부 테스트용
    _parseInfoJson: parseInfoJson,
    _stripCodeFence: stripCodeFence,
    _sanitizeMermaid: sanitizeMermaid
  };

  console.log('[JANDiagrams] ready — buildOrgChart/buildFlowchart/buildInfographic');
})();
