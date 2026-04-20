/**
 * justanotepad · Lecture / Meeting Notes (v5.0 · organized storage)
 * --------------------------------------------------------------------------
 * v4 개선점 (v3 → v4):
 *   1. "수업 시작" 과 "녹음" 분리. 세션(타이머·마커)이 먼저, 녹음/카메라/화면은
 *      독립 토글.
 *   2. 회의 모드에 맞는 용어 (회의 시작/회의록/액션 아이템).
 *   3. 카메라/화면 PIP 창: 드래그 가능, 숨김·복원 토글, 최소화 가능.
 *   4. 박스 내부 탭 확장: 녹음·녹화 / 서식 / 삽입 / 미디어 / AI / 내보내기.
 *      각 탭에 SVG 아이콘 (앱 심볼 i-mic/i-style/i-plus/i-image/i-smile/i-upload).
 *   5. 넓은 화면에서 버튼들이 한 줄 유지, 좁은 화면에서만 wrap (media query).
 *   6. 모든 AI 기능은 window.callAI 우선 사용 (기본 Gemini 프록시 내장).
 *   7. 이모지 금지, 테마 변수 100% 사용, 오버플로우 완전 차단.
 *
 * 통합 (이미 app.html 에 script 태그 추가됨):
 *   <script src="/lecture-mode.js"></script>
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.justanotepadLecture && window.justanotepadLecture.__v === 5) return;

  // ================================================================
  // 0) 유틸
  // ================================================================
  // 앱에 없는 아이콘은 인라인 SVG 로 정의
  const INLINE_SVG = {
    'i-play':  '<svg viewBox="0 0 24 24"><polygon points="6 4 20 12 6 20" fill="currentColor" stroke="none"/></svg>',
    'i-stop':  '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" fill="currentColor" stroke="none"/></svg>',
    'i-eye':   '<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  };
  function svg(id, size = 16) {
    if (INLINE_SVG[id]) {
      return `<span style="display:inline-flex;align-items:center;width:${size}px;height:${size}px;flex-shrink:0;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;fill:none" aria-hidden="true">${INLINE_SVG[id].replace('<svg ', `<svg style="width:100%;height:100%" `)}</span>`;
    }
    return `<svg style="width:${size}px;height:${size}px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0" aria-hidden="true"><use href="#${id}"/></svg>`;
  }
  const escHtml = s => (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pageEl = () => document.getElementById('page');
  const adapter = () => window.justanotepadLectureAdapter || {};
  const fmtTime = ms => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s%3600/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  };

  // ================================================================
  // 1) 스타일 — CSS 변수 + 넓을땐 한 줄, 좁을 땐 wrap
  // ================================================================
  const CSS = `
  .jnp-lec-box {
    position: relative;
    margin: 8px 0 16px;
    border: 1px solid var(--line);
    background: var(--paper);
    border-radius: 12px;
    overflow: hidden;
    max-width: 100%;
    color: var(--ink);
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    font: 13px/1.45 inherit;
  }

  /* 헤더: 넓으면 한 줄, 좁으면 wrap */
  .jnp-lec-head {
    display: flex; align-items: center;
    gap: 10px; padding: 8px 12px;
    background: var(--tab-hover);
    border-bottom: 1px solid var(--line);
    min-width: 0;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: thin;
  }
  @media (max-width: 640px) { .jnp-lec-head { flex-wrap: wrap; overflow-x: visible; } }
  .jnp-lec-head .title {
    font-weight: 700; font-size: 13.5px;
    display: inline-flex; align-items: center; gap: 6px;
    flex-shrink: 0; color: var(--ink);
  }
  .jnp-lec-head .info {
    display: inline-flex; align-items: center; gap: 8px;
    flex: 1; min-width: 0; overflow: hidden;
  }
  .jnp-lec-head .pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 3px 9px; border-radius: 999px;
    background: var(--paper); border: 1px solid var(--line);
    font-size: 12px; color: var(--ink);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }
  .jnp-lec-head .pill .dot {
    width: 8px; height: 8px; border-radius: 999px;
    background: var(--ink-soft, #aaa);
  }
  .jnp-lec-head .pill.rec .dot {
    background: #e53935;
    animation: jnp-lec-pulse 1.2s infinite;
  }
  @keyframes jnp-lec-pulse {
    0%   { box-shadow: 0 0 0 0 rgba(229,57,53,.6); }
    70%  { box-shadow: 0 0 0 8px rgba(229,57,53,0); }
  }
  .jnp-lec-head .pill.muted { color: var(--ink-soft); }
  .jnp-lec-head .pill .lbl {
    max-width: 20ch;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .jnp-lec-head .close {
    background: transparent; border: 0; cursor: pointer;
    color: var(--ink-soft); padding: 4px; border-radius: 6px;
    display: inline-flex; flex-shrink: 0;
  }
  .jnp-lec-head .close:hover { background: var(--line); color: var(--ink); }

  /* 내부 탭 네비 */
  .jnp-lec-tabs {
    display: flex; gap: 2px;
    padding: 6px 8px 0;
    border-bottom: 1px solid var(--line);
    background: var(--paper);
    min-width: 0;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: thin;
  }
  @media (max-width: 640px) { .jnp-lec-tabs { flex-wrap: wrap; overflow-x: visible; } }
  .jnp-lec-tabs button {
    background: transparent; border: 0; cursor: pointer;
    padding: 8px 12px; border-radius: 8px 8px 0 0;
    color: var(--ink-soft); font: 500 12.5px/1 inherit;
    display: inline-flex; align-items: center; gap: 6px;
    border-bottom: 2px solid transparent;
    transform: translateY(1px);
    white-space: nowrap; flex-shrink: 0;
  }
  .jnp-lec-tabs button:hover { color: var(--ink); background: var(--tab-hover); }
  .jnp-lec-tabs button.active {
    color: var(--ink);
    border-bottom-color: var(--accent);
    background: var(--paper);
    font-weight: 600;
  }

  .jnp-lec-body { padding: 12px; min-width: 0; }
  .jnp-lec-section { display: none; flex-direction: column; gap: 12px; }
  .jnp-lec-section.active { display: flex; }
  .jnp-lec-section h5 {
    margin: 2px 0 0; font-size: 11px; font-weight: 700;
    color: var(--ink-soft); text-transform: uppercase; letter-spacing: .06em;
  }

  /* 행 — 넓으면 한 줄, 좁으면 wrap */
  .jnp-lec-row {
    display: flex; gap: 6px; align-items: center;
    min-width: 0; flex-wrap: nowrap;
    overflow-x: auto; scrollbar-width: thin;
    padding-bottom: 2px;
  }
  @media (max-width: 640px) {
    .jnp-lec-row { flex-wrap: wrap; overflow-x: visible; }
  }
  .jnp-lec-row::-webkit-scrollbar { height: 4px; }
  .jnp-lec-row::-webkit-scrollbar-thumb { background: var(--line); border-radius: 2px; }

  .jnp-lec-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 11px; border-radius: 8px; cursor: pointer;
    background: var(--paper); border: 1px solid var(--line);
    color: var(--ink); font: 500 12.5px/1 inherit;
    white-space: nowrap; flex-shrink: 0;
  }
  .jnp-lec-btn:hover { background: var(--tab-hover); }
  .jnp-lec-btn.primary {
    background: var(--accent); border-color: var(--accent); color: var(--ink);
    font-weight: 700;
  }
  .jnp-lec-btn.primary:hover { background: var(--accent-2); }
  .jnp-lec-btn.danger {
    background: #e53935; border-color: #e53935; color: #fff; font-weight: 600;
  }
  .jnp-lec-btn.danger:hover { background: #d32f2f; border-color: #d32f2f; }
  .jnp-lec-btn.on { background: var(--accent-2); border-color: var(--accent); }
  .jnp-lec-btn[disabled] { opacity: 0.45; cursor: not-allowed; }
  .jnp-lec-btn.icon-only { padding: 7px 8px; }
  .jnp-lec-sep { width: 1px; height: 20px; background: var(--line); flex-shrink: 0; margin: 0 2px; }

  .jnp-lec-folder-pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 10px; background: var(--tab-hover);
    border: 1px dashed var(--line); border-radius: 8px;
    color: var(--ink-soft); font-size: 12px;
    min-width: 0; flex: 1; max-width: 100%;
  }
  .jnp-lec-folder-pill strong {
    color: var(--ink); font-weight: 600;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
  }

  /* AI 카드 */
  .jnp-lec-cards {
    display: grid; grid-template-columns: 1fr; gap: 8px;
  }
  @media (min-width: 760px) { .jnp-lec-cards { grid-template-columns: 1fr 1fr; } }
  .jnp-lec-card {
    border: 1px solid var(--line);
    background: var(--paper);
    border-radius: 10px;
    padding: 10px 12px;
    overflow-wrap: anywhere;
  }
  .jnp-lec-card .kind {
    display: inline-block; font-size: 10px; padding: 1px 6px; border-radius: 999px;
    background: var(--accent-2); color: var(--ink); font-weight: 700;
    margin-bottom: 4px;
  }
  .jnp-lec-card .ttl { font-weight: 600; font-size: 13px; margin-bottom: 2px; }
  .jnp-lec-card .body { font-size: 12.5px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
  .jnp-lec-card .meta { font-size: 11px; color: var(--ink-soft); margin-top: 4px; }
  .jnp-lec-card .row { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
  .jnp-lec-card .row button {
    flex: 1; min-width: 60px;
    padding: 5px 8px; font: 600 11px/1 inherit;
    border: 1px solid var(--line); background: var(--paper);
    border-radius: 6px; cursor: pointer; color: var(--ink);
  }
  .jnp-lec-card .row button.primary { background: var(--accent); border-color: var(--accent); }

  .jnp-lec-empty {
    padding: 20px 10px; text-align: center;
    color: var(--ink-soft); font-size: 12px;
    background: var(--tab-hover); border-radius: 8px; border: 1px dashed var(--line);
    grid-column: 1/-1;
  }
  .jnp-lec-empty strong { color: var(--ink); }

  /* 카메라/화면 PIP 창 */
  .jnp-lec-pip {
    position: fixed;
    right: 20px; bottom: 20px;
    width: 260px;
    z-index: 50;
    background: #000;
    border: 1px solid var(--line);
    border-radius: 10px;
    box-shadow: 0 6px 22px rgba(0,0,0,0.2);
    overflow: hidden;
    user-select: none;
    display: none;
  }
  .jnp-lec-pip.on { display: block; }
  .jnp-lec-pip.min { height: 32px !important; }
  .jnp-lec-pip.min video { display: none; }
  .jnp-lec-pip .pip-head {
    display: flex; align-items: center; gap: 6px;
    padding: 4px 8px; background: #222; color: #fff;
    font: 500 11px/1 inherit;
    cursor: move;
  }
  .jnp-lec-pip .pip-head .lbl { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .jnp-lec-pip .pip-head button {
    background: transparent; border: 0; color: #fff; cursor: pointer;
    padding: 2px 4px; border-radius: 4px;
    display: inline-flex;
  }
  .jnp-lec-pip .pip-head button:hover { background: rgba(255,255,255,.15); }
  .jnp-lec-pip video {
    display: block; width: 100%; max-height: 240px;
    background: #000; object-fit: cover;
  }
  .jnp-lec-pip .pip-resize {
    position: absolute; right: 0; bottom: 0;
    width: 14px; height: 14px; cursor: nwse-resize;
    background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,.4) 50%);
  }

  /* 전사 문장 (pageEl 안) */
  .page .jnp-lec-line {
    position: relative; margin: 0.3em 0; padding-left: 2.4em;
    overflow-wrap: anywhere;
  }
  .page .jnp-lec-line::before {
    content: attr(data-ts);
    position: absolute; left: 0; top: 0.15em;
    width: 2em; font-size: 0.78em;
    color: var(--ink-soft); opacity: 0.55;
    font-variant-numeric: tabular-nums;
  }
  .page .jnp-lec-line.interim { opacity: 0.55; font-style: italic; }
  .page .jnp-lec-line.adopted {
    background: linear-gradient(90deg, var(--accent-2) 0, transparent 80%);
    padding-right: 6px; border-radius: 4px;
  }

  .jnp-lec-toast {
    position: fixed; top: 56px; left: 50%;
    transform: translateX(-50%) translateY(-4px);
    background: var(--ink); color: var(--paper);
    padding: 8px 14px; border-radius: 999px;
    font: 500 12.5px/1.3 inherit;
    opacity: 0; transition: opacity .18s, transform .18s;
    z-index: 1000; pointer-events: none;
    max-width: 90vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .jnp-lec-toast.show { opacity: 0.94; transform: translateX(-50%) translateY(0); }
  `;
  (function injectStyle() {
    if (document.getElementById('jnp-lec-style-v4')) return;
    const st = document.createElement('style');
    st.id = 'jnp-lec-style-v4';
    st.textContent = CSS;
    document.head.appendChild(st);
  })();

  // ================================================================
  // 2) 라벨 (용어) 테이블 — kind 별로 단어 치환
  // ================================================================
  const L = {
    lecture: {
      title: '강의노트', startSession: '수업 시작', endSession: '수업 종료',
      recStart: '녹음', recStop: '녹음 정지',
      startMarker: '강의 시작', endMarker: '강의 종료',
      summaryTitle: '강의 요약', quizTitle: '예상 시험문항', askPrompt: 'AI에 질문 (예: 지금까지 내용 한 줄 요약)',
      summaryPrompt: '당신은 한국 학생의 강의 조수입니다. 아래 실시간 자동 필기 텍스트를 3~6개 소제목의 마크다운 요약으로 만듭니다. 근거 없는 말 금지.',
      quizSys: '당신은 한국 학생용 문제 출제자입니다. 아래 노트를 근거로 JSON만 출력합니다. 형식: {"items":[{"q":"문제","choices":["A","B","C","D","E"],"answer":2,"explain":"해설"}]} 5문항. 근거 없는 문제 금지.',
      actionLabel: '예상 시험문항',
    },
    meeting: {
      title: '회의노트', startSession: '회의 시작', endSession: '회의 종료',
      recStart: '녹음', recStop: '녹음 정지',
      startMarker: '회의 시작', endMarker: '회의 종료',
      summaryTitle: '회의록', quizTitle: '액션 아이템', askPrompt: 'AI에 질문 (예: 의사결정 사항 추출)',
      summaryPrompt: '당신은 회의 서기입니다. 아래 실시간 발언 텍스트를 한국어 회의록으로 만듭니다. 섹션: 의제 · 논의 요약 · 의사결정 · 참석자 발언 요약. 근거 없는 말 금지.',
      quizSys: '당신은 회의 분석가입니다. 아래 회의 내용에서 "액션 아이템"만 JSON으로 추출합니다. 형식: {"items":[{"q":"무엇을 할 것인가","choices":["담당자","기한"],"answer":0,"explain":"근거 발언"}]} 최대 10개.',
      actionLabel: '액션 아이템',
    },
  };

  // ================================================================
  // 3) 상태
  // ================================================================
  const state = {
    __v: 4,
    open: false, kind: 'lecture',
    session: null,      // { startedAt, lines: [], cards: [] }
    recording: false,   // audio MediaRecorder active
    videoOn: false, screenOn: false, transcribeOn: true, copilotOn: true,
    mediaStream: null, camStream: null, screenStream: null,
    mediaRecorder: null, screenRecorder: null,
    chunks: [], screenChunks: [],
    speech: null, interimEl: null,
    tickHandle: null, copilotTimer: null,
    dirHandle: null,
    ui: {},
  };

  function toast(text, ms = 1800) {
    const n = document.createElement('div');
    n.className = 'jnp-lec-toast';
    n.textContent = text;
    document.body.appendChild(n);
    requestAnimationFrame(() => n.classList.add('show'));
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 200); }, ms);
  }

  // ================================================================
  // 4) IDB (폴더 핸들 영속화)
  // ================================================================
  async function openKv() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('jnp-lec-v4', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function kvSet(k, v) { try { const db = await openKv(); db.transaction('kv', 'readwrite').objectStore('kv').put(v, k); } catch {} }
  async function kvGet(k) { try { const db = await openKv(); return await new Promise(r => { const req = db.transaction('kv').objectStore('kv').get(k); req.onsuccess = () => r(req.result || null); req.onerror = () => r(null); }); } catch { return null; } }

  // ================================================================
  // 5) 박스 UI 빌드
  // ================================================================
  function buildBox(kind) {
    const lang = L[kind];
    const titleIcon = kind === 'lecture' ? 'i-mic' : 'i-speaker';
    const box = document.createElement('div');
    box.className = 'jnp-lec-box';
    box.setAttribute('contenteditable', 'false');
    box.setAttribute('data-jnp-lec-box', '1');
    box.innerHTML = `
      <div class="jnp-lec-head">
        <div class="title">${svg(titleIcon, 16)}<span>${lang.title}</span></div>
        <div class="info">
          <span class="pill muted" data-role="status"><span class="dot"></span><span>대기</span></span>
          <span class="pill" data-role="time"><span class="t">00:00:00</span></span>
          <span class="jnp-lec-folder-pill" data-role="folder">
            ${svg('i-note', 13)}
            <span>폴더:</span>
            <strong data-role="folder-name">미지정</strong>
          </span>
        </div>
        <button class="close" data-act="close" title="박스 닫기">${svg('i-x', 16)}</button>
      </div>

      <div class="jnp-lec-tabs" role="tablist">
        <button data-sec="rec" class="active" title="세션·녹음·녹화">${svg('i-mic',14)}<span>녹음·녹화</span></button>
        <button data-sec="fmt" title="서식">${svg('i-style',14)}<span>서식</span></button>
        <button data-sec="ins" title="삽입">${svg('i-plus',14)}<span>삽입</span></button>
        <button data-sec="med" title="미디어">${svg('i-image',14)}<span>미디어</span></button>
        <button data-sec="ai" title="AI 도우미">${svg('i-smile',14)}<span>AI</span></button>
        <button data-sec="out" title="내보내기">${svg('i-upload',14)}<span>내보내기</span></button>
      </div>

      <div class="jnp-lec-body">

        <!-- 녹음·녹화 -->
        <div class="jnp-lec-section active" data-sec="rec">
          <div class="jnp-lec-row">
            <button class="jnp-lec-btn primary" data-act="session-toggle">
              ${svg('i-play', 14)}<span data-role="session-label">${lang.startSession}</span>
            </button>
            <span class="jnp-lec-sep"></span>
            <button class="jnp-lec-btn" data-act="rec-toggle" disabled>
              ${svg('i-mic', 14)}<span data-role="rec-label">${lang.recStart}</span>
            </button>
            <button class="jnp-lec-btn" data-act="cam-toggle" disabled>${svg('i-target',14)}<span>카메라</span></button>
            <button class="jnp-lec-btn" data-act="screen-toggle" disabled>${svg('i-table',14)}<span>화면</span></button>
            <button class="jnp-lec-btn" data-act="pip-toggle" disabled>${svg('i-eye',14)}<span>카메라 창</span></button>
            <button class="jnp-lec-btn on" data-act="transcribe-toggle">${svg('i-quote',14)}<span>자동 필기</span></button>
          </div>
        </div>

        <!-- 서식 -->
        <div class="jnp-lec-section" data-sec="fmt">
          <div class="jnp-lec-row">
            <button class="jnp-lec-btn icon-only" data-app="bold" title="굵게"><b>B</b></button>
            <button class="jnp-lec-btn icon-only" data-app="italic" title="기울임"><i>I</i></button>
            <button class="jnp-lec-btn icon-only" data-app="underline" title="밑줄"><u>U</u></button>
            <button class="jnp-lec-btn icon-only" data-app="strikeThrough" title="취소선"><s>S</s></button>
            <span class="jnp-lec-sep"></span>
            <button class="jnp-lec-btn icon-only" data-app-id="colorBtn" title="글자색">${svg('i-palette',14)}</button>
            <button class="jnp-lec-btn icon-only" data-app-id="hiliteBtn" title="형광펜">${svg('i-highlight',14)}</button>
            <span class="jnp-lec-sep"></span>
            <button class="jnp-lec-btn icon-only" data-app-id="alignLeftBtn" title="왼쪽">${svg('i-align-left',14)}</button>
            <button class="jnp-lec-btn icon-only" data-app-id="alignCenterBtn" title="가운데">${svg('i-align-center',14)}</button>
            <button class="jnp-lec-btn icon-only" data-app-id="alignRightBtn" title="오른쪽">${svg('i-align-right',14)}</button>
            <button class="jnp-lec-btn icon-only" data-app-id="alignJustifyBtn" title="양쪽">${svg('i-align-justify',14)}</button>
            <span class="jnp-lec-sep"></span>
            <button class="jnp-lec-btn" data-app-id="h1Btn" title="제목1">H1</button>
            <button class="jnp-lec-btn" data-app-id="h2Btn" title="제목2">H2</button>
            <button class="jnp-lec-btn" data-app-id="h3Btn" title="제목3">H3</button>
            <span class="jnp-lec-sep"></span>
            <button class="jnp-lec-btn icon-only" data-app-id="styleMenuBtn" title="서식 프리셋">${svg('i-style',14)}</button>
            <button class="jnp-lec-btn icon-only" data-app-id="clearFmt" title="서식 지우기">${svg('i-eraser',14)}</button>
          </div>
        </div>

        <!-- 삽입 -->
        <div class="jnp-lec-section" data-sec="ins">
          <div class="jnp-lec-row">
            <button class="jnp-lec-btn" data-app="insertUnorderedList" title="글머리">${svg('i-list',14)}<span>글머리</span></button>
            <button class="jnp-lec-btn" data-app="insertOrderedList" title="번호">${svg('i-list-ol',14)}<span>번호</span></button>
            <button class="jnp-lec-btn" data-app-id="todoBtn" title="체크리스트">${svg('i-check',14)}<span>체크리스트</span></button>
            <span class="jnp-lec-sep"></span>
            <button class="jnp-lec-btn" data-app-id="tableBtn" title="표">${svg('i-table',14)}<span>표</span></button>
            <button class="jnp-lec-btn" data-app-id="quoteBtn" title="인용">${svg('i-quote',14)}<span>인용</span></button>
            <button class="jnp-lec-btn" data-app-id="hrBtn" title="구분선">${svg('i-hr',14)}<span>구분선</span></button>
            <button class="jnp-lec-btn" data-app-id="codeBtn" title="코드">${svg('i-code',14)}<span>코드</span></button>
            <span class="jnp-lec-sep"></span>
            <button class="jnp-lec-btn" data-app-id="dateBtn" title="날짜/시간">${svg('i-clock',14)}<span>날짜</span></button>
            <button class="jnp-lec-btn" data-app-id="dateTagBtn" title="캘린더 태그">${svg('i-cal-tag',14)}<span>태그</span></button>
            <button class="jnp-lec-btn" data-app-id="linkCardBtn" title="링크 카드">${svg('i-share',14)}<span>링크</span></button>
            <button class="jnp-lec-btn" data-app-id="wikiBtn" title="위키 링크">${svg('i-link',14)}<span>위키</span></button>
            <button class="jnp-lec-btn" data-app-id="emojiBtn" title="이모지">${svg('i-smile',14)}<span>이모지</span></button>
          </div>
        </div>

        <!-- 미디어 -->
        <div class="jnp-lec-section" data-sec="med">
          <div class="jnp-lec-row">
            <button class="jnp-lec-btn" data-app-id="imgUploadBtn" title="이미지 업로드">${svg('i-image',14)}<span>이미지</span></button>
            <button class="jnp-lec-btn" data-app-id="captureBtn" title="화면 캡처">${svg('i-camera',14)}<span>캡처</span></button>
            <button class="jnp-lec-btn" data-app-id="sketchBtn" title="손글씨">${svg('i-brush',14)}<span>손글씨</span></button>
            <button class="jnp-lec-btn" data-app-id="attachFileBtn" title="파일 첨부">${svg('i-paperclip',14)}<span>파일</span></button>
            <span class="jnp-lec-sep"></span>
            <button class="jnp-lec-btn" data-app-id="audioRecordBtn" title="짧은 음성 메모">${svg('i-record',14)}<span>음성 메모</span></button>
            <button class="jnp-lec-btn" data-app-id="voiceBtn" title="음성 입력(받아쓰기)">${svg('i-mic',14)}<span>받아쓰기</span></button>
            <button class="jnp-lec-btn" data-app-id="speakBtn" title="읽어주기">${svg('i-speaker',14)}<span>읽어주기</span></button>
          </div>
        </div>

        <!-- AI -->
        <div class="jnp-lec-section" data-sec="ai">
          <div class="jnp-lec-row">
            <button class="jnp-lec-btn on" data-act="copilot-toggle">${svg('i-smile',14)}<span>자동 제안</span></button>
            <button class="jnp-lec-btn" data-act="ai-summary">${svg('i-clipboard',14)}<span>${lang.summaryTitle}</span></button>
            <button class="jnp-lec-btn" data-act="ai-quiz">${svg('i-check',14)}<span>${lang.quizTitle}</span></button>
            <button class="jnp-lec-btn" data-act="ai-translate">${svg('i-translate',14)}<span>번역</span></button>
            <button class="jnp-lec-btn" data-act="ai-ask">${svg('i-help',14)}<span>질문</span></button>
          </div>
          <h5>AI 제안 카드</h5>
          <div class="jnp-lec-cards" data-role="cards">
            <div class="jnp-lec-empty">
              로그인하면 <strong>기본 AI(Gemini, 하루 50회 무료)</strong>가 자동 연결됩니다.<br>
              자동 제안 ON 이면 30초마다 정의·연결·${kind === 'lecture' ? '시험문항' : '액션아이템'} 카드가 올라옵니다.
            </div>
          </div>
        </div>

        <!-- 내보내기 -->
        <div class="jnp-lec-section" data-sec="out">
          <div class="jnp-lec-row">
            <button class="jnp-lec-btn" data-act="pick-folder" title="녹화·내보내기가 저장될 루트 폴더">${svg('i-note',14)}<span>저장 폴더</span></button>
            <span class="jnp-lec-folder-pill">
              <strong data-role="folder-name-full">미지정</strong>
              <span style="color:var(--ink-soft);font-size:11px;">/ ${kind === 'lecture' ? 'lectures' : 'meetings'} / 날짜_제목 / audio.m4a · camera.mp4 · screen.mp4 · note.md</span>
            </span>
          </div>
          <div class="jnp-lec-row">
            <button class="jnp-lec-btn" data-act="export-md">${svg('i-md',14)}<span>Markdown</span></button>
            <button class="jnp-lec-btn" data-act="export-txt">${svg('i-quote',14)}<span>텍스트</span></button>
            <button class="jnp-lec-btn" data-act="export-json">${svg('i-code',14)}<span>JSON</span></button>
            <button class="jnp-lec-btn" data-act="export-docx">${svg('i-clipboard',14)}<span>Word</span></button>
            <button class="jnp-lec-btn" data-app-id="exportPdfBtn">${svg('i-printer',14)}<span>PDF</span></button>
            <button class="jnp-lec-btn" data-app-id="printBtn">${svg('i-printer',14)}<span>인쇄</span></button>
          </div>
          <div class="jnp-lec-row" data-role="stats" style="color:var(--ink-soft);font-size:12px;">
            문장 0 · 카드 0 · 00:00:00
          </div>
        </div>
      </div>
    `;

    box.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.jnp-lec-tabs button[data-sec]');
      if (tabBtn) { switchSection(tabBtn.dataset.sec); return; }
      const appCmd = e.target.closest('[data-app]')?.dataset.app;
      if (appCmd) { try { document.execCommand(appCmd); pageEl()?.focus(); } catch {} return; }
      const appId = e.target.closest('[data-app-id]')?.dataset.appId;
      if (appId) { const b = document.getElementById(appId); b?.click(); return; }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act) handle(act);
    });
    return box;
  }

  // ================================================================
  // 6) Open / Close / 섹션 전환
  // ================================================================
  async function open(kind = 'lecture') {
    if (state.open && state.kind === kind) { scrollToBox(); return; }
    if (state.open && state.recording) {
      if (!confirm('다른 모드로 바꾸려면 현재 녹음을 종료해야 합니다. 종료하시겠습니까?')) return;
      await stopRec();
    }
    close(true);

    const page = pageEl();
    if (!page) { toast('먼저 탭을 하나 열어 주세요'); return; }

    const box = buildBox(kind);
    page.insertBefore(box, page.firstChild);

    state.kind = kind;
    state.open = true;
    state.ui.box = box;
    state.ui.status = box.querySelector('[data-role="status"]');
    state.ui.statusText = box.querySelector('[data-role="status"] span:last-child');
    state.ui.statusDot = box.querySelector('[data-role="status"] .dot');
    state.ui.timeText = box.querySelector('[data-role="time"] .t');
    state.ui.timePill = box.querySelector('[data-role="time"]');
    state.ui.sessionLbl = box.querySelector('[data-role="session-label"]');
    state.ui.recLbl = box.querySelector('[data-role="rec-label"]');
    state.ui.cards = box.querySelector('[data-role="cards"]');
    state.ui.folderName = box.querySelector('[data-role="folder-name"]');
    state.ui.folderNameFull = box.querySelector('[data-role="folder-name-full"]');
    state.ui.stats = box.querySelector('[data-role="stats"]');

    // 저장된 폴더 복원
    try { const h = await kvGet('dirHandle'); if (h) { state.dirHandle = h; setFolderLabel(h.name); } } catch {}

    try { page.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
    scrollToBox();
  }

  function close(silent = false) {
    const b = document.querySelector('.jnp-lec-box');
    if (b) {
      if (state.recording && !silent) {
        if (!confirm('녹음 중입니다. 종료하시겠습니까?')) return;
      }
      endSession(true); stopRec(true); stopVideo(); stopScreen(); killPip();
      b.remove();
    }
    state.ui = {};
    state.open = false;
  }

  function scrollToBox() { state.ui.box?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  function switchSection(sec) {
    if (!state.ui.box) return;
    state.ui.box.querySelectorAll('.jnp-lec-tabs button').forEach(b => b.classList.toggle('active', b.dataset.sec === sec));
    state.ui.box.querySelectorAll('.jnp-lec-section').forEach(s => s.classList.toggle('active', s.dataset.sec === sec));
  }

  function setFolderLabel(name) {
    if (state.ui.folderName) state.ui.folderName.textContent = name || '미지정';
    if (state.ui.folderNameFull) state.ui.folderNameFull.textContent = name || '미지정';
  }

  // ================================================================
  // 7) Session / Rec / Video / Screen — 완전 분리
  // ================================================================
  function handle(act) {
    switch (act) {
      case 'close': close(); break;
      case 'session-toggle': state.session ? endSession() : startSession(); break;
      case 'rec-toggle': state.recording ? stopRec() : startRec(); break;
      case 'cam-toggle': state.videoOn ? stopVideo() : startVideo(); break;
      case 'screen-toggle': state.screenOn ? stopScreen() : startScreen(); break;
      case 'pip-toggle': togglePipVisibility(); break;
      case 'transcribe-toggle': state.transcribeOn ? stopSpeech() : startSpeech(); break;
      case 'copilot-toggle': toggleCopilot(); break;
      case 'pick-folder': pickFolder(); break;
      case 'ai-summary': runAI('summary'); break;
      case 'ai-quiz': runAI('quiz'); break;
      case 'ai-translate': runAI('translate'); break;
      case 'ai-ask': runAI('ask'); break;
      case 'export-md': exportAs('md'); break;
      case 'export-txt': exportAs('txt'); break;
      case 'export-json': exportAs('json'); break;
      case 'export-docx': exportAs('docx'); break;
    }
  }

  // --- 세션 (타이머·마커) ---
  function startSession() {
    const lang = L[state.kind];
    state.session = { startedAt: Date.now(), lines: [], cards: [] };
    insertMarker(lang.startMarker);
    startTick();
    state.ui.status.classList.remove('muted');
    state.ui.statusText.textContent = '세션 중';
    state.ui.statusDot.style.background = 'var(--accent)';
    state.ui.sessionLbl.textContent = lang.endSession;
    state.ui.box.querySelector('[data-act="session-toggle"]').classList.replace('primary','danger');
    state.ui.box.querySelector('[data-act="session-toggle"] svg').outerHTML = svg('i-stop', 14);
    // 하위 버튼 활성화
    ['rec-toggle','cam-toggle','screen-toggle'].forEach(a => state.ui.box.querySelector(`[data-act="${a}"]`).removeAttribute('disabled'));
    if (state.transcribeOn) startSpeech();
    if (state.copilotOn) startCopilot();
    toast(lang.startSession);
  }

  async function endSession(silent = false) {
    if (!state.session) return;
    const lang = L[state.kind];
    // 하위 녹음들 중단
    await stopRec(true); stopVideo(); stopScreen();
    stopSpeech(); stopCopilot(); stopTick();
    insertMarker(lang.endMarker);

    // 자동 요약 (aiText 통합 경로)
    if (state.session.lines.length >= 3) {
      const text = state.session.lines.map(l => l.text).join('\n');
      try {
        const out = await aiText(lang.summaryPrompt, text);
        if (out) insertSummary(out, lang.summaryTitle);
      } catch (e) { console.warn('[auto-summary]', e); }
    }

    state.session = null;
    if (state.ui.status) {
      state.ui.status.classList.add('muted');
      state.ui.statusText.textContent = '대기';
      state.ui.statusDot.style.background = 'var(--ink-soft)';
    }
    if (state.ui.sessionLbl) state.ui.sessionLbl.textContent = lang.startSession;
    const sBtn = state.ui.box?.querySelector('[data-act="session-toggle"]');
    if (sBtn) { sBtn.classList.replace('danger','primary'); const s = sBtn.querySelector('svg'); if (s) s.outerHTML = svg('i-play', 14); }
    ['rec-toggle','cam-toggle','screen-toggle','pip-toggle'].forEach(a => state.ui.box?.querySelector(`[data-act="${a}"]`)?.setAttribute('disabled',''));
    if (!silent) toast(lang.endSession);
  }

  // --- 오디오 녹음 (세션과 별개) ---
  async function startRec() {
    if (!state.session) { toast('먼저 세션을 시작하세요'); return; }
    if (state.recording) return;
    try {
      if (!state.mediaStream) {
        state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      state.chunks = [];
      const mime = pickAudioMime();
      const rec = new MediaRecorder(state.mediaStream, mime ? { mimeType: mime } : {});
      rec.ondataavailable = (e) => { if (e.data.size > 0) state.chunks.push(e.data); };
      rec.onstop = () => saveRec({ kind: 'audio' });
      rec.start(1000);
      state.mediaRecorder = rec;
      state.recordedMime = mime;
      state.recording = true;
      state.ui.timePill.classList.add('rec');
      state.ui.recLbl.textContent = L[state.kind].recStop;
      const rb = state.ui.box.querySelector('[data-act="rec-toggle"]');
      rb.classList.add('on');
      toast('녹음 시작');
    } catch (e) { toast('마이크 권한이 필요합니다'); console.warn(e); }
  }

  async function stopRec(silent = false) {
    if (!state.recording) return;
    state.recording = false;
    try { state.mediaRecorder?.state === 'recording' && state.mediaRecorder.stop(); } catch {}
    state.ui.timePill?.classList.remove('rec');
    if (state.ui.recLbl) state.ui.recLbl.textContent = L[state.kind].recStart;
    state.ui.box?.querySelector('[data-act="rec-toggle"]')?.classList.remove('on');
    if (!silent) toast('녹음 정지');
  }

  // --- 카메라 (PIP 창 + 실제 영상 녹화) ---
  async function startVideo() {
    if (state.videoOn) return;
    try {
      state.camStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false  // 오디오는 '녹음' 버튼 쪽에서 별도 녹음
      });
      state.videoOn = true;
      state.ui.box.querySelector('[data-act="cam-toggle"]').classList.add('on');
      state.ui.box.querySelector('[data-act="pip-toggle"]').removeAttribute('disabled');
      openPip('camera', state.camStream);

      // 실제 파일로 녹화!
      state.camChunks = [];
      const mime = pickVideoMime();
      const rec = new MediaRecorder(state.camStream, mime ? { mimeType: mime } : {});
      rec.ondataavailable = (e) => { if (e.data.size > 0) state.camChunks.push(e.data); };
      rec.onstop = () => saveRec({ kind: 'camera' });
      rec.start(1000);
      state.camRecorder = rec;
      toast('카메라 녹화 시작 (' + extForMime(mime) + ')');
    } catch (e) { toast('카메라 권한이 필요합니다'); console.warn(e); }
  }
  function stopVideo() {
    if (!state.videoOn) return;
    try { state.camRecorder?.state === 'recording' && state.camRecorder.stop(); } catch {}
    try { state.camStream?.getTracks().forEach(t => t.stop()); } catch {}
    state.camStream = null; state.camRecorder = null; state.videoOn = false;
    state.ui.box?.querySelector('[data-act="cam-toggle"]')?.classList.remove('on');
    killPip('camera');
    toast('카메라 녹화 종료');
  }

  // --- 화면 공유 ---
  async function startScreen() {
    if (state.screenOn) return;
    try {
      state.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      state.screenOn = true;
      state.ui.box.querySelector('[data-act="screen-toggle"]').classList.add('on');
      openPip('screen', state.screenStream);
      // 자체 녹화
      state.screenChunks = [];
      const mime = pickVideoMime();
      const rec = new MediaRecorder(state.screenStream, mime ? { mimeType: mime } : {});
      rec.ondataavailable = (e) => { if (e.data.size > 0) state.screenChunks.push(e.data); };
      rec.onstop = () => saveRec({ kind: 'screen' });
      rec.start(1000);
      state.screenRecorder = rec;
      // 사용자가 공유 중단 시
      state.screenStream.getVideoTracks()[0].addEventListener('ended', stopScreen);
      toast('화면 공유 ON · 녹화 중');
    } catch (e) { toast('화면 공유가 거부되었습니다'); console.warn(e); }
  }
  function stopScreen() {
    if (!state.screenOn) return;
    try { state.screenRecorder?.state === 'recording' && state.screenRecorder.stop(); } catch {}
    try { state.screenStream?.getTracks().forEach(t => t.stop()); } catch {}
    state.screenStream = null; state.screenOn = false;
    state.ui.box?.querySelector('[data-act="screen-toggle"]')?.classList.remove('on');
    killPip('screen');
    toast('화면 공유 OFF');
  }

  // ================================================================
  // 8) PIP 창 (드래그·숨김·최소화)
  // ================================================================
  const pipMap = {}; // { camera: el, screen: el }
  function openPip(name, stream) {
    if (pipMap[name]) { pipMap[name].classList.add('on'); return; }
    const el = document.createElement('div');
    el.className = 'jnp-lec-pip on';
    el.style.right = (name === 'screen' ? '300px' : '20px');
    el.innerHTML = `
      <div class="pip-head">
        ${svg(name === 'camera' ? 'i-target' : 'i-table', 12)}
        <span class="lbl">${name === 'camera' ? '카메라' : '화면'}</span>
        <button data-pip-act="min" title="최소화">${svg('i-min', 12)}</button>
        <button data-pip-act="close" title="끄기">${svg('i-x', 12)}</button>
      </div>
      <video autoplay muted playsinline></video>
      <div class="pip-resize"></div>
    `;
    document.body.appendChild(el);
    const v = el.querySelector('video');
    v.srcObject = stream;
    v.play().catch(() => {});

    // 버튼
    el.querySelector('[data-pip-act="min"]').addEventListener('click', (e) => {
      e.stopPropagation(); el.classList.toggle('min');
    });
    el.querySelector('[data-pip-act="close"]').addEventListener('click', (e) => {
      e.stopPropagation();
      if (name === 'camera') stopVideo(); else stopScreen();
    });

    // 드래그
    makeDraggable(el, el.querySelector('.pip-head'));
    // 크기 조절
    makeResizable(el, el.querySelector('.pip-resize'));

    pipMap[name] = el;
  }
  function killPip(name) {
    const rm = (n) => { pipMap[n]?.remove(); delete pipMap[n]; };
    if (!name) { rm('camera'); rm('screen'); return; }
    rm(name);
  }
  function togglePipVisibility() {
    const anyOn = Object.values(pipMap).some(el => el?.classList.contains('on'));
    Object.values(pipMap).forEach(el => el?.classList.toggle('on', !anyOn));
    toast(anyOn ? '카메라 창 숨김' : '카메라 창 표시');
  }
  function makeDraggable(el, handle) {
    let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      const rect = el.getBoundingClientRect();
      ox = rect.left; oy = rect.top;
      el.style.right = 'auto'; el.style.bottom = 'auto';
      el.style.left = ox + 'px'; el.style.top = oy + 'px';
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      el.style.left = (ox + e.clientX - sx) + 'px';
      el.style.top  = (oy + e.clientY - sy) + 'px';
    });
    handle.addEventListener('pointerup', () => { dragging = false; });
  }
  function makeResizable(el, handle) {
    let sx = 0, sy = 0, sw = 0, sh = 0, dragging = false;
    handle.addEventListener('pointerdown', (e) => {
      dragging = true; sx = e.clientX; sy = e.clientY;
      const rect = el.getBoundingClientRect();
      sw = rect.width; sh = rect.height;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      el.style.width = Math.max(180, sw + (e.clientX - sx)) + 'px';
      el.querySelector('video').style.maxHeight = Math.max(100, sh + (e.clientY - sy) - 32) + 'px';
    });
    handle.addEventListener('pointerup', () => { dragging = false; });
  }

  // ================================================================
  // 9) 자동 필기 (Web Speech)
  // ================================================================
  function startSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('자동 필기 미지원 브라우저'); return; }
    if (state.speech) return;
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true;
    rec.lang = navigator.language?.startsWith('en') ? 'en-US' : 'ko-KR';
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = (r[0].transcript || '').trim();
        if (!text) continue;
        if (r.isFinal) {
          if (state.interimEl) { state.interimEl.remove(); state.interimEl = null; }
          const p = appendLineToPage(text);
          state.session?.lines.push({ t: (Date.now() - state.session.startedAt), text, el: p });
          updateStats();
          maybeTriggerCopilot();
        } else {
          if (!state.interimEl) state.interimEl = appendLineToPage(text, { interim: true });
          else state.interimEl.textContent = text;
        }
      }
    };
    rec.onerror = (e) => { if (e.error !== 'no-speech' && e.error !== 'audio-capture') console.warn('[speech]', e.error); };
    rec.onend = () => { if (state.transcribeOn && state.session) { try { rec.start(); } catch {} } };
    try { rec.start(); state.speech = rec; state.transcribeOn = true;
      state.ui.box?.querySelector('[data-act="transcribe-toggle"]')?.classList.add('on');
    } catch (e) { console.warn(e); }
  }
  function stopSpeech() {
    try { state.speech?.stop(); } catch {}
    state.speech = null; state.transcribeOn = false;
    state.ui.box?.querySelector('[data-act="transcribe-toggle"]')?.classList.remove('on');
  }

  // ================================================================
  // 10) 페이지 삽입 (전사/마커/요약)
  // ================================================================
  function appendLineToPage(text, { interim = false, adopted = false } = {}) {
    const page = pageEl(); if (!page) return null;
    const t = state.session ? (Date.now() - state.session.startedAt) : 0;
    const p = document.createElement('p');
    p.className = 'jnp-lec-line' + (interim ? ' interim' : '') + (adopted ? ' adopted' : '');
    p.setAttribute('data-ts', fmtTime(t).slice(-5));
    p.textContent = text;
    page.appendChild(p);
    try { page.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
    p.scrollIntoView({ block: 'end', behavior: 'smooth' });
    return p;
  }
  function insertMarker(label) {
    const page = pageEl(); if (!page) return;
    const p = document.createElement('p');
    p.className = 'jnp-lec-line';
    p.setAttribute('data-ts', fmtTime(state.session ? (Date.now() - state.session.startedAt) : 0).slice(-5));
    p.style.cssText = 'border-top:1px dashed var(--line); padding-top:6px; margin-top:14px; color:var(--ink-soft); font-size:0.85em;';
    p.textContent = `― ${label} · ${new Date().toLocaleString('ko-KR')} ―`;
    page.appendChild(p);
    try { page.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
  }
  function insertSummary(text, title) {
    const page = pageEl(); if (!page) return;
    const div = document.createElement('div');
    div.style.cssText = 'border:1px dashed var(--line); background:var(--tab-hover); border-radius:10px; padding:10px 14px; margin:14px 0;';
    div.innerHTML = `<h4 style="margin:0 0 6px;font-size:0.95em">${escHtml(title)}</h4><div style="white-space:pre-wrap">${escHtml(text)}</div>`;
    page.appendChild(div);
    try { page.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
  }

  // ================================================================
  // 11) AI
  // ================================================================
  // JANSync 준비 대기 (최대 3초)
  async function waitForAuth(timeoutMs = 3000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const s = window.JANSync?.getSession?.();
      if (s !== undefined) return s;  // 로딩 완료 (null 이든 세션이든)
      await new Promise(r => setTimeout(r, 150));
    }
    return null;
  }

  async function aiText(sys, user) {
    // 1. JANSync 로딩 대기
    await waitForAuth();
    const session = window.JANSync?.getSession?.();
    const loggedIn = !!(session && session.user);

    // 2. 로그인 되어 있으면 default provider 강제 활성화
    if (loggedIn && typeof window.setActiveProvider === 'function') {
      const active = localStorage.getItem('ai-active-provider');
      if (!active) {
        try { window.setActiveProvider('default'); } catch {}
      }
    }

    // 3. 통합 API 시도
    if (typeof window.callAI === 'function') {
      try {
        const out = await window.callAI(sys, user);
        if (out != null) return String(out);
      } catch (e) { console.warn('[lecture-ai] callAI error', e); }
    }

    // 4. 직접 프록시 폴백 (callAI 실패 + 로그인 되어 있음)
    if (loggedIn && session?.access_token) {
      try {
        const r = await fetch('/api/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
          body: JSON.stringify({ sys, user })
        });
        if (r.ok) { const d = await r.json(); return d.text || null; }
        else console.warn('[lecture-ai] /api/gemini', r.status);
      } catch (e) { console.warn('[lecture-ai] direct gemini error', e); }
    }

    // 5. 실패 — 정확한 안내
    if (!loggedIn) toast('로그인이 필요합니다 (우상단 계정 아이콘)');
    else toast('AI 호출 실패 — 콘솔을 확인하세요');
    return null;
  }
  function tryParseJson(text) {
    if (!text) return null;
    const m = text.match(/```json\s*([\s\S]+?)```/i) || text.match(/```\s*([\s\S]+?)```/);
    const raw = m ? m[1] : text;
    try { return JSON.parse(raw); } catch {}
    const i = raw.indexOf('{'), j = raw.lastIndexOf('}');
    if (i >= 0 && j > i) { try { return JSON.parse(raw.slice(i, j + 1)); } catch {} }
    return null;
  }

  async function runAI(kind) {
    const lang = L[state.kind];
    const lines = state.session?.lines || [];
    const recent = lines.slice(-30).map(l => l.text).join('\n');

    if (kind === 'ask') {
      const q = prompt(lang.askPrompt);
      if (!q) return;
      toast('AI 질문 중…');
      const out = await aiText('당신은 노트 보조 AI입니다. 사용자의 노트를 근거로 한국어로 간결히 답합니다. 환각 금지.', `[질문]\n${q}\n\n[노트]\n${recent || '(없음)'}`);
      if (out) { renderCard({ kind: '답변', title: q.slice(0, 40), body: out, cta: ['노트에 삽입','지나가기'] }); switchSection('ai'); }
      else toast('AI 응답 없음 — 로그인 상태와 무료 한도를 확인하세요');
      return;
    }
    if (kind === 'summary') {
      if (!lines.length) { toast('아직 필기가 없습니다'); return; }
      toast(lang.summaryTitle + ' 생성 중…');
      const out = await aiText(lang.summaryPrompt, recent);
      if (out) insertSummary(out, lang.summaryTitle);
      else toast('AI 응답 없음');
      return;
    }
    if (kind === 'quiz') {
      if (!lines.length) { toast('아직 필기가 없습니다'); return; }
      toast(lang.quizTitle + ' 생성 중…');
      const raw = await aiText(lang.quizSys, recent);
      const parsed = tryParseJson(raw);
      if (parsed?.items?.length) {
        parsed.items.forEach((q, i) => {
          const body = `${q.q}\n\n` + (q.choices || []).map((c, j) => `${state.kind === 'lecture' ? (j === q.answer ? '◉' : '○') : '·'} ${c}`).join('\n') + (q.explain ? `\n\n${state.kind === 'lecture' ? '해설' : '근거'}: ${q.explain}` : '');
          renderCard({ kind: `${lang.actionLabel} ${i+1}`, title: q.q.slice(0, 50), body, cta: ['노트에 삽입','지나가기'] });
        });
        switchSection('ai');
      } else if (raw) { renderCard({ kind: lang.quizTitle, title: lang.quizTitle, body: raw, cta: ['노트에 삽입','지나가기'] }); switchSection('ai'); }
      else toast('AI 응답 없음');
      return;
    }
    if (kind === 'translate') {
      if (!lines.length) { toast('아직 필기가 없습니다'); return; }
      const target = prompt('번역 대상 언어', 'English') || 'English';
      toast('번역 중…');
      const out = await aiText(`당신은 전문 번역가입니다. 한국어 원문을 ${target}로 자연스럽게 번역합니다.`, recent);
      if (out) { insertSummary(out, `번역 (${target})`); renderCard({ kind: '번역', title: `→ ${target}`, body: out, cta: ['노트에 삽입','지나가기'] }); switchSection('ai'); }
      else toast('AI 응답 없음');
    }
  }

  function toggleCopilot() {
    state.copilotOn = !state.copilotOn;
    state.ui.box?.querySelector('[data-act="copilot-toggle"]')?.classList.toggle('on', state.copilotOn);
    if (state.copilotOn && state.session) startCopilot();
    else stopCopilot();
    toast('자동 제안 ' + (state.copilotOn ? 'ON' : 'OFF'));
  }
  function startCopilot() { stopCopilot(); state.copilotTimer = setInterval(maybeTriggerCopilot, 30000); }
  function stopCopilot() { if (state.copilotTimer) { clearInterval(state.copilotTimer); state.copilotTimer = null; } }

  async function maybeTriggerCopilot() {
    if (!state.session || !state.copilotOn) return;
    const recent = state.session.lines.slice(-6).map(l => l.text).join('\n');
    if (recent.length < 30 && state.session.lines.length < 3) return;
    if (adapter().getCopilotCards) {
      try { const cards = await adapter().getCopilotCards({ recentTranscript: recent, kind: state.kind }) || []; cards.forEach(renderCard); return; } catch {}
    }
    const sys = state.kind === 'lecture'
      ? '당신은 수업 중 옆에서 도와주는 한국어 AI 조수입니다. 최근 발화를 읽고 학생에게 도움될 제안 카드 1~3개를 만듭니다. JSON: {"cards":[{"kind":"정의|연결|퀴즈|자료","title":"짧게","body":"한두 문장","cta":["노트에 삽입","지나가기"]}]}. 환각 금지.'
      : '당신은 회의 서기 AI 입니다. 최근 발언을 읽고 의사록 작성에 유용한 제안 카드 1~3개를 만듭니다. JSON: {"cards":[{"kind":"결정|액션|의제|요약","title":"짧게","body":"한두 문장","cta":["노트에 삽입","지나가기"]}]}. 환각 금지.';
    const raw = await aiText(sys, recent);
    const parsed = tryParseJson(raw);
    (parsed?.cards || []).forEach(renderCard);
    if (!parsed?.cards?.length && raw) renderCard({ kind: 'AI', title: '제안', body: raw.slice(0, 500), cta: ['노트에 삽입','지나가기'] });
  }

  function renderCard(card) {
    if (!state.ui.cards) return;
    const empty = state.ui.cards.querySelector('.jnp-lec-empty');
    if (empty) empty.remove();
    const el = document.createElement('div');
    el.className = 'jnp-lec-card';
    el.innerHTML = `
      <span class="kind">${escHtml(card.kind || 'AI')}</span>
      <div class="ttl">${escHtml(card.title || '')}</div>
      <div class="body">${escHtml(card.body || '')}</div>
      ${card.meta ? `<div class="meta">${escHtml(card.meta)}</div>` : ''}
      <div class="row"></div>
    `;
    const row = el.querySelector('.row');
    (card.cta || ['노트에 삽입','지나가기']).forEach((label, i) => {
      const b = document.createElement('button');
      b.textContent = label;
      if (i === 0) b.className = 'primary';
      b.addEventListener('click', () => {
        if (i === 0 && card.body) {
          const line = appendLineToPage(`${card.title ? `[${card.title}] ` : ''}${card.body}`, { adopted: true });
          state.session?.lines.push({ t: (Date.now() - (state.session?.startedAt || Date.now())), text: card.body, el: line, adopted: true });
          updateStats();
        }
        el.style.opacity = 0; setTimeout(() => el.remove(), 180);
      });
      row.appendChild(b);
    });
    state.ui.cards.prepend(el);
    state.session?.cards.push(card);
  }

  // ================================================================
  // 12) 파일 포맷 & 저장 체계
  //     - 오디오: .m4a (AAC) > .webm (Opus)
  //     - 비디오: .mp4 (H.264) > .webm (VP9/8)
  //     - 저장 구조: [루트폴더]/lectures/2026-04-21_과목명/ 안에 세션 파일들
  // ================================================================
  function pickAudioMime() {
    const list = [
      'audio/mp4;codecs=mp4a.40.2',  // AAC in MP4 (탐색기/카톡/모든 기기 재생)
      'audio/mp4',
      'audio/webm;codecs=opus',
      'audio/webm',
    ];
    for (const m of list) if (MediaRecorder.isTypeSupported?.(m)) return m;
    return '';
  }
  function pickVideoMime() {
    const list = [
      'video/mp4;codecs=avc1.42E01E',  // H.264 baseline MP4 (기본 플레이어 재생)
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    for (const m of list) if (MediaRecorder.isTypeSupported?.(m)) return m;
    return '';
  }
  function extForMime(mime) {
    if (!mime) return 'bin';
    if (mime.includes('mp4')) return mime.startsWith('audio') ? 'm4a' : 'mp4';
    if (mime.includes('webm')) return 'webm';
    if (mime.includes('wav')) return 'wav';
    return 'bin';
  }

  // 현재 세션의 고유 폴더명 (날짜_제목)
  function getSessionFolderName() {
    const date = new Date().toISOString().slice(0, 10);
    const rawTitle = document.getElementById('padTitle')?.value
      || document.querySelector('.tab.active')?.textContent?.trim()
      || (state.kind === 'lecture' ? '수업' : '회의');
    const clean = rawTitle.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
    const ts = new Date().toTimeString().slice(0, 5).replace(':', '');
    return `${date}_${ts}_${clean}`;
  }
  // 세션 폴더명을 localStorage 에 보관 (세션 중엔 계속 같은 폴더로)
  function getOrCreateSessionFolderName() {
    if (!state.session) return getSessionFolderName();
    if (!state.session.folderName) state.session.folderName = getSessionFolderName();
    return state.session.folderName;
  }

  // [dirHandle]/lectures or meetings / [세션 폴더]/ 까지 만들어 핸들 리턴
  async function getSessionDirHandle() {
    if (!state.dirHandle) return null;
    try {
      const perm = await state.dirHandle.queryPermission?.({ mode: 'readwrite' });
      if (perm !== 'granted') {
        const req = await state.dirHandle.requestPermission?.({ mode: 'readwrite' });
        if (req !== 'granted') return null;
      }
      const cat = state.kind === 'lecture' ? 'lectures' : 'meetings';
      const catHandle = await state.dirHandle.getDirectoryHandle(cat, { create: true });
      const sessionName = getOrCreateSessionFolderName();
      return await catHandle.getDirectoryHandle(sessionName, { create: true });
    } catch (e) { console.warn('[session folder]', e); return null; }
  }

  async function saveRec(opt = {}) {
    const chunks = opt.kind === 'screen' ? state.screenChunks
                 : opt.kind === 'camera' ? state.camChunks
                 : state.chunks;
    if (!chunks?.length) return;
    const blob = new Blob(chunks, { type: chunks[0].type });
    const ext = extForMime(blob.type);
    const name = opt.kind === 'screen' ? `screen.${ext}`
               : opt.kind === 'camera' ? `camera.${ext}`
               : `audio.${ext}`;
    await writeSessionFile(name, blob);
  }

  async function pickFolder() {
    if (!('showDirectoryPicker' in window)) { toast('이 브라우저는 폴더 선택 미지원 — 다운로드로 대체'); return; }
    try {
      const handle = await window.showDirectoryPicker({ id: 'jnp-lec-dir', mode: 'readwrite' });
      state.dirHandle = handle; await kvSet('dirHandle', handle); setFolderLabel(handle.name);
      toast('루트 저장 폴더: ' + handle.name);
    } catch (e) { if (e.name !== 'AbortError') console.warn(e); }
  }

  // 세션 서브폴더 안에 파일 저장 (lectures/2026-04-21_물리/audio.m4a)
  async function writeSessionFile(filename, blob) {
    const sf = await getSessionDirHandle();
    if (sf) {
      try {
        const fh = await sf.getFileHandle(filename, { create: true });
        const w = await fh.createWritable(); await w.write(blob); await w.close();
        const cat = state.kind === 'lecture' ? 'lectures' : 'meetings';
        toast(`저장: ${cat}/${getOrCreateSessionFolderName()}/${filename}`);
        return true;
      } catch (e) { console.warn('[writeSessionFile]', e); }
    }
    return writeToFolder(filename, blob);
  }

  // 루트에 직접 (비세션, 일반 내보내기) — notes/ 서브로 묶음
  async function writeToFolder(filename, blob, subfolder = null) {
    if (state.dirHandle) {
      try {
        const perm = await state.dirHandle.queryPermission?.({ mode: 'readwrite' });
        if (perm !== 'granted') {
          const req = await state.dirHandle.requestPermission?.({ mode: 'readwrite' });
          if (req !== 'granted') throw new Error('no permission');
        }
        let target = state.dirHandle;
        if (subfolder) target = await state.dirHandle.getDirectoryHandle(subfolder, { create: true });
        const fh = await target.getFileHandle(filename, { create: true });
        const w = await fh.createWritable(); await w.write(blob); await w.close();
        toast(`저장: ${subfolder ? subfolder + '/' : ''}${filename}`); return true;
      } catch (e) { console.warn('[fs write]', e); }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('다운로드: ' + filename);
    return false;
  }

  function collectLines() {
    const page = pageEl(); if (!page) return [];
    return Array.from(page.querySelectorAll('.jnp-lec-line')).map(p => ({ ts: p.getAttribute('data-ts') || '', text: p.textContent }));
  }
  async function exportAs(format) {
    const kindTitle = L[state.kind].title;
    const title = (document.getElementById('padTitle')?.value || kindTitle);
    const lines = collectLines();
    const text = lines.map(l => l.ts ? `[${l.ts}] ${l.text}` : l.text).join('\n');

    // 세션 중이면 세션 폴더, 아니면 notes/ 서브폴더
    const inSession = !!state.session;
    const filename = inSession
      ? `note.${format === 'docx' ? 'doc' : format}`
      : `${new Date().toISOString().slice(0,10)}_${title.replace(/[\\/:*?"<>|]/g,'_').slice(0,40)}.${format === 'docx' ? 'doc' : format}`;

    const write = async (fname, blob) => {
      if (inSession) return writeSessionFile(fname, blob);
      return writeToFolder(fname, blob, 'notes');
    };

    if (format === 'md' || format === 'txt') {
      const body = format === 'md'
        ? `# ${title}\n\n- 종류: ${state.kind === 'lecture' ? '강의노트' : '회의노트'}\n- 저장: ${new Date().toLocaleString('ko-KR')}\n\n---\n\n${text}\n`
        : text;
      await write(filename, new Blob([body], { type: format === 'md' ? 'text/markdown' : 'text/plain;charset=utf-8' }));
      return;
    }
    if (format === 'json') {
      const data = { title, kind: state.kind, startedAt: state.session?.startedAt, lines, cards: state.session?.cards || [] };
      await write(filename, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); return;
    }
    if (format === 'docx') {
      const html = `<html><head><meta charset="utf-8"><title>${escHtml(title)}</title></head><body><h1>${escHtml(title)}</h1><pre style="font-family:inherit;white-space:pre-wrap">${escHtml(text)}</pre></body></html>`;
      await write(filename, new Blob([html], { type: 'application/msword' }));
    }
  }

  // ================================================================
  // 13) Tick + Stats
  // ================================================================
  function startTick() {
    stopTick();
    const step = () => {
      if (!state.session) return;
      if (state.ui.timeText) state.ui.timeText.textContent = fmtTime(Date.now() - state.session.startedAt);
      state.tickHandle = requestAnimationFrame(step);
    };
    state.tickHandle = requestAnimationFrame(step);
  }
  function stopTick() { if (state.tickHandle) cancelAnimationFrame(state.tickHandle); state.tickHandle = null; }
  function updateStats() {
    if (!state.ui.stats) return;
    const elapsed = state.session ? (Date.now() - state.session.startedAt) : 0;
    state.ui.stats.textContent = `문장 ${state.session?.lines.length || 0} · 카드 ${state.session?.cards.length || 0} · ${fmtTime(elapsed)}`;
  }

  // ================================================================
  // 14) 토픽바 버튼
  // ================================================================
  function injectTopbarButtons() {
    if (document.getElementById('lectureTopBtn') && document.getElementById('meetingTopBtn')) return true;
    const anchor = document.getElementById('calOpenBtn') || document.getElementById('aiBtn') || document.getElementById('palBtn');
    if (!anchor?.parentNode) return false;
    const make = (id, label, iconId, kind) => {
      if (document.getElementById(id)) return null;
      const b = document.createElement('button');
      b.id = id;
      b.className = anchor.className || 'collapsible';
      b.setAttribute('aria-label', label);
      b.setAttribute('title', label);
      b.innerHTML = `${svg(iconId, 16)}<span style="margin-left:4px">${label}</span>`;
      b.style.cssText = 'display:inline-flex;align-items:center;gap:4px;white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis;';
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); open(kind); });
      return b;
    };
    const b1 = make('lectureTopBtn', '강의노트', 'i-mic', 'lecture');
    const b2 = make('meetingTopBtn', '회의노트', 'i-speaker', 'meeting');
    if (b1) anchor.parentNode.insertBefore(b1, anchor.nextSibling);
    if (b2) anchor.parentNode.insertBefore(b2, b1 ? b1.nextSibling : anchor.nextSibling);
    return true;
  }

  function tryRegisterPalette() {
    const pal = window.justanotepadPalette;
    if (!pal?.register) return false;
    pal.register({ id: 'lecture.open', title: '강의노트 열기', keywords: ['강의','수업','lecture'], run: () => open('lecture') });
    pal.register({ id: 'meeting.open', title: '회의노트 열기', keywords: ['회의','meeting'], run: () => open('meeting') });
    pal.register({ id: 'lecture.pick-folder', title: '강의노트 저장 폴더 선택', keywords: ['폴더','folder'], run: () => handle('pick-folder') });
    return true;
  }

  // 기존 툴바의 #meetingNoteBtn 을 가로채서 v5 회의노트 박스로 라우팅
  function hijackLegacyMeetingBtn() {
    const btn = document.getElementById('meetingNoteBtn');
    if (!btn || btn.dataset.jnpHijacked) return;
    btn.dataset.jnpHijacked = '1';
    // 기존 리스너 제거는 어려우니, clone 으로 교체
    const clone = btn.cloneNode(true);
    clone.setAttribute('title', '회의노트 (녹음 + 자동 필기 + AI 요약)');
    clone.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); open('meeting'); });
    btn.parentNode.replaceChild(clone, btn);
  }

  function boot() {
    injectTopbarButtons() || setTimeout(boot, 400);
    tryRegisterPalette() || setTimeout(tryRegisterPalette, 600);
    hijackLegacyMeetingBtn();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  // ================================================================
  // 전역 API
  // ================================================================
  window.justanotepadLecture = {
    __v: 4, open, close,
    toggle: (k) => state.open && state.kind === k ? close() : open(k),
    isOpen: () => state.open,
    isRecording: () => state.recording,
    isSessionActive: () => !!state.session,
    _state: state,
  };

  console.info('[lecture-mode] v4.0 ready · 6 sections · split session/rec · camera PIP · meeting terms');
})();
