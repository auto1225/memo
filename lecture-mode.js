/**
 * justanotepad · Lecture / Meeting Notes (v3.0 · Control Box)
 * --------------------------------------------------------------------------
 * 변경 (v2 → v3):
 *   - 모든 기능이 단 하나의 "컨트롤 박스" 에 집약. 탭 .page 최상단에 붙어
 *     녹음·녹화·저장폴더·AI·내보내기가 한 번에 조작 가능.
 *   - 토픽바에 버튼 2개: [강의노트] [회의노트]
 *   - 영상 녹화 추가: 카메라 + 화면 공유, 음성과 함께 단일 .webm
 *   - File System Access API 로 사용자가 지정한 폴더에 자동 저장
 *     (Chrome/Edge 계열). 미지원 브라우저는 일반 다운로드로 폴백.
 *   - 헤더·버튼 모두 flex-wrap / overflow-wrap 로 박스 밖으로 안 넘어감.
 *   - AI: Copilot 카드 + 요약 + 퀴즈 + 번역. adapter.getCopilotCards /
 *     buildSummary / translate / buildQuiz 로 hook.
 *   - 이모지 금지. 앱 심볼 라이브러리의 <svg><use href="#i-..."/></svg>
 *     만 사용. 색은 var(--accent) 등 테마 토큰만 사용.
 *
 * 통합 (이미 app.html 에 script 태그 추가됨):
 *   <script src="/lecture-mode.js"></script>
 *
 * 전역 API:
 *   window.justanotepadLecture = {
 *     open(kind='lecture'|'meeting'),  // 박스 띄우기
 *     close(),                         // 박스 제거 (녹음 중이면 먼저 확인)
 *     toggle(kind),
 *     isRecording(), isOpen(),
 *     _state
 *   }
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.justanotepadLecture && window.justanotepadLecture.__v === 3) return;

  // ================================================================
  // 0) 테마·아이콘 유틸
  // ================================================================
  function svg(id, size = 16) {
    return `<svg style="width:${size}px;height:${size}px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0" aria-hidden="true"><use href="#${id}"/></svg>`;
  }

  const CSS = `
  /* ------------ 컨트롤 박스 ------------ */
  .jnp-lec-box {
    position: relative;
    margin: 6px 0 14px;
    border: 1px solid var(--line);
    background: var(--paper);
    border-radius: 12px;
    overflow: hidden;
    max-width: 100%;
    color: var(--ink);
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    font: 13px/1.45 inherit;
  }
  .jnp-lec-head {
    display: flex; align-items: center;
    gap: 8px; padding: 8px 12px;
    background: var(--tab-hover);
    border-bottom: 1px solid var(--line);
    flex-wrap: wrap;
    min-width: 0;
  }
  .jnp-lec-head .title {
    font-weight: 700; font-size: 13.5px;
    display: inline-flex; align-items: center; gap: 6px;
    min-width: 0;                 /* flex child 오버플로우 방지 */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .jnp-lec-head .time {
    font-variant-numeric: tabular-nums;
    padding: 3px 8px; border-radius: 999px;
    background: var(--paper); border: 1px solid var(--line);
    font-size: 12px; color: var(--ink);
    display: inline-flex; align-items: center; gap: 6px;
    flex-shrink: 0;
  }
  .jnp-lec-head .time .dot {
    width: 8px; height: 8px; border-radius: 999px;
    background: var(--ink-soft, #999);
  }
  .jnp-lec-head .time.on .dot {
    background: #e53935;
    animation: jnp-lec-pulse 1.2s infinite;
  }
  @keyframes jnp-lec-pulse {
    0%   { box-shadow: 0 0 0 0 rgba(229,57,53,.6); }
    70%  { box-shadow: 0 0 0 8px rgba(229,57,53,0); }
    100% { box-shadow: 0 0 0 0 rgba(229,57,53,0); }
  }
  .jnp-lec-head .spacer { flex: 1; min-width: 0; }
  .jnp-lec-head button.close {
    background: transparent; border: 0; cursor: pointer;
    color: var(--ink-soft); padding: 4px; border-radius: 6px;
    display: inline-flex;
  }
  .jnp-lec-head button.close:hover { background: var(--line); color: var(--ink); }

  /* 탭 네비 (녹음/AI/내보내기) */
  .jnp-lec-tabs {
    display: flex; gap: 4px;
    padding: 6px 8px 0;
    border-bottom: 1px solid var(--line);
    background: var(--paper);
    flex-wrap: wrap;
    min-width: 0;
  }
  .jnp-lec-tabs button {
    background: transparent; border: 0; cursor: pointer;
    padding: 7px 12px; border-radius: 8px 8px 0 0;
    color: var(--ink-soft); font: 500 12.5px/1 inherit;
    display: inline-flex; align-items: center; gap: 6px;
    border-bottom: 2px solid transparent;
    transform: translateY(1px);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .jnp-lec-tabs button:hover { color: var(--ink); background: var(--tab-hover); }
  .jnp-lec-tabs button.active {
    color: var(--ink);
    border-bottom-color: var(--accent);
    background: var(--paper);
  }

  .jnp-lec-body {
    padding: 10px 12px;
    min-width: 0;
  }

  /* 섹션 */
  .jnp-lec-section {
    display: none;
    flex-direction: column;
    gap: 10px;
  }
  .jnp-lec-section.active { display: flex; }
  .jnp-lec-section h5 {
    margin: 4px 0 0; font-size: 11px; font-weight: 700;
    color: var(--ink-soft);
    text-transform: uppercase; letter-spacing: .06em;
  }

  .jnp-lec-row {
    display: flex; flex-wrap: wrap; gap: 6px;
    align-items: center; min-width: 0;
  }
  .jnp-lec-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 12px; border-radius: 8px; cursor: pointer;
    background: var(--paper); border: 1px solid var(--line);
    color: var(--ink); font: 500 12.5px/1 inherit;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .jnp-lec-btn:hover { background: var(--tab-hover); }
  .jnp-lec-btn.primary {
    background: var(--accent); border-color: var(--accent); color: var(--ink);
    font-weight: 600;
  }
  .jnp-lec-btn.primary:hover { background: var(--accent-2); }
  .jnp-lec-btn.danger {
    background: #e53935; border-color: #e53935; color: #fff;
  }
  .jnp-lec-btn.danger:hover { background: #d32f2f; border-color: #d32f2f; }
  .jnp-lec-btn.on {
    background: var(--accent-2); border-color: var(--accent);
  }
  .jnp-lec-btn[disabled] { opacity: 0.45; cursor: not-allowed; }
  .jnp-lec-btn .lbl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }

  .jnp-lec-folder {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px; background: var(--tab-hover);
    border: 1px dashed var(--line); border-radius: 8px;
    color: var(--ink-soft); font-size: 12px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .jnp-lec-folder strong { color: var(--ink); font-weight: 600; }

  /* AI 카드 */
  .jnp-lec-cards {
    display: grid; grid-template-columns: 1fr; gap: 8px;
    min-width: 0;
  }
  @media (min-width: 700px) {
    .jnp-lec-cards { grid-template-columns: 1fr 1fr; }
  }
  .jnp-lec-card {
    border: 1px solid var(--line);
    background: var(--paper);
    border-radius: 10px;
    padding: 10px 12px;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .jnp-lec-card .kind {
    display: inline-block; font-size: 10px; padding: 1px 6px; border-radius: 999px;
    background: var(--accent-2); color: var(--ink); font-weight: 700;
    margin-bottom: 4px;
  }
  .jnp-lec-card .ttl { font-weight: 600; font-size: 13px; margin-bottom: 2px; overflow-wrap: anywhere; }
  .jnp-lec-card .body { font-size: 12.5px; line-height: 1.5; overflow-wrap: anywhere; word-break: break-word; }
  .jnp-lec-card .meta { font-size: 11px; color: var(--ink-soft); margin-top: 4px; overflow-wrap: anywhere; }
  .jnp-lec-card .row { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
  .jnp-lec-card .row button {
    flex: 1; min-width: 60px;
    padding: 5px 8px; font: 600 11px/1 inherit;
    border: 1px solid var(--line); background: var(--paper);
    border-radius: 6px; cursor: pointer; color: var(--ink);
  }
  .jnp-lec-card .row button.primary { background: var(--accent); border-color: var(--accent); }

  .jnp-lec-empty {
    padding: 18px 8px; text-align: center;
    color: var(--ink-soft); font-size: 12px;
    background: var(--tab-hover); border-radius: 8px; border: 1px dashed var(--line);
  }

  /* 미리보기 영상 */
  .jnp-lec-preview {
    max-width: 100%; max-height: 180px;
    border-radius: 8px; background: #000;
    margin-top: 6px;
    display: none;
  }
  .jnp-lec-preview.on { display: block; }

  /* 전사 문장 (pageEl 안에 삽입되는 것) */
  .page .jnp-lec-line {
    position: relative;
    margin: 0.3em 0;
    padding-left: 2.3em;
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

  /* Toast */
  .jnp-lec-toast {
    position: fixed; top: 56px; left: 50%;
    transform: translateX(-50%) translateY(-4px);
    background: var(--ink); color: var(--paper);
    padding: 8px 14px; border-radius: 999px;
    font: 500 12.5px/1.3 inherit;
    opacity: 0; transition: opacity .18s, transform .18s;
    z-index: 60; pointer-events: none;
    max-width: 90vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .jnp-lec-toast.show { opacity: 0.94; transform: translateX(-50%) translateY(0); }
  `;
  (function injectStyle() {
    if (document.getElementById('jnp-lec-style-v3')) return;
    const st = document.createElement('style');
    st.id = 'jnp-lec-style-v3';
    st.textContent = CSS;
    document.head.appendChild(st);
  })();

  // ================================================================
  // 1) 상태
  // ================================================================
  const state = {
    open: false,
    kind: 'lecture',   // 'lecture' | 'meeting'
    recording: false,
    startedAt: 0,
    mediaStream: null,     // audio+(video)
    displayStream: null,   // screen capture (optional)
    mixedStream: null,
    mediaRecorder: null,
    chunks: [],
    speech: null,
    interimEl: null,
    tickHandle: null,
    dirHandle: null,       // File System Access folder handle
    copilotTimer: null,
    copilotCtr: 0,
    currentSection: 'rec', // rec|ai|export
    ui: {},
    session: { lines: [], cards: [] },
  };

  // 저장된 폴더 핸들을 IndexedDB에 저장/복원 (user gesture 재승인은 필요)
  async function persistDirHandle(handle) {
    try {
      if (!('indexedDB' in window)) return;
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('jnp-lec-v3', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(handle, 'dirHandle');
    } catch (e) { console.warn('[lecture] persist dirHandle', e); }
  }
  async function loadDirHandle() {
    try {
      if (!('indexedDB' in window)) return null;
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('jnp-lec-v3', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return await new Promise((resolve) => {
        const req = db.transaction('kv').objectStore('kv').get('dirHandle');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch { return null; }
  }

  // ================================================================
  // 2) 공용 유틸
  // ================================================================
  const fmtTime = ms => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s%3600/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  };
  const now = () => state.startedAt ? (Date.now() - state.startedAt) : 0;
  const pageEl = () => document.getElementById('page');
  const adapter = () => window.justanotepadLectureAdapter || {};
  const escHtml = s => (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function toast(text, ms = 1800) {
    const n = document.createElement('div');
    n.className = 'jnp-lec-toast';
    n.textContent = text;
    document.body.appendChild(n);
    requestAnimationFrame(() => n.classList.add('show'));
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 200); }, ms);
  }

  // ================================================================
  // 3) 컨트롤 박스 생성
  // ================================================================
  function buildBox(kind) {
    const isLecture = kind === 'lecture';
    const titleText = isLecture ? '강의노트' : '회의노트';
    const titleIcon = isLecture ? 'i-mic' : 'i-speaker';

    const box = document.createElement('div');
    box.className = 'jnp-lec-box';
    box.setAttribute('contenteditable', 'false');     // 박스 자체는 편집 대상 아님
    box.setAttribute('data-jnp-lec-box', '1');
    box.innerHTML = `
      <div class="jnp-lec-head">
        <div class="title">
          ${svg(titleIcon, 16)}
          <span class="lbl">${titleText}</span>
        </div>
        <span class="time" data-role="time">
          <span class="dot"></span>
          <span class="t">00:00:00</span>
        </span>
        <span class="spacer"></span>
        <span class="jnp-lec-folder" data-role="folder-indicator">
          ${svg('i-note', 14)}
          <span class="lbl"><span data-role="folder-name">폴더 미지정</span></span>
        </span>
        <button class="close" data-act="close" title="닫기">${svg('i-x', 16)}</button>
      </div>
      <div class="jnp-lec-tabs">
        <button data-sec="rec" class="active">${svg('i-mic',14)}<span class="lbl">녹음·녹화</span></button>
        <button data-sec="ai">${svg('i-smile',14)}<span class="lbl">AI 도우미</span></button>
        <button data-sec="export">${svg('i-clipboard',14)}<span class="lbl">내보내기</span></button>
      </div>
      <div class="jnp-lec-body">
        <!-- Section: 녹음·녹화 -->
        <div class="jnp-lec-section active" data-sec="rec">
          <div class="jnp-lec-row">
            <button class="jnp-lec-btn primary" data-act="toggle-record">
              ${svg('i-mic', 14)}<span class="lbl">수업 시작</span>
            </button>
            <button class="jnp-lec-btn" data-act="toggle-video" title="카메라 녹화 포함">
              ${svg('i-target', 14)}<span class="lbl">카메라</span>
            </button>
            <button class="jnp-lec-btn" data-act="toggle-screen" title="화면 공유 녹화">
              ${svg('i-table', 14)}<span class="lbl">화면</span>
            </button>
            <button class="jnp-lec-btn" data-act="toggle-transcribe" title="자동 필기(음성 → 텍스트)">
              ${svg('i-quote', 14)}<span class="lbl">자동 필기</span>
            </button>
          </div>
          <video class="jnp-lec-preview" data-role="preview" muted></video>
          <h5>저장 위치</h5>
          <div class="jnp-lec-row">
            <button class="jnp-lec-btn" data-act="pick-folder">
              ${svg('i-note', 14)}<span class="lbl">폴더 선택</span>
            </button>
            <span class="jnp-lec-folder" data-role="folder-full">
              <span class="lbl"><strong data-role="folder-name-full">미지정</strong> — 파일은 다운로드 폴더로</span>
            </span>
          </div>
        </div>

        <!-- Section: AI 도우미 -->
        <div class="jnp-lec-section" data-sec="ai">
          <div class="jnp-lec-row">
            <button class="jnp-lec-btn" data-act="ai-copilot" title="수업 중 주기적으로 제안">
              ${svg('i-smile', 14)}<span class="lbl">자동 제안</span>
            </button>
            <button class="jnp-lec-btn" data-act="ai-summary">${svg('i-clipboard',14)}<span class="lbl">지금까지 요약</span></button>
            <button class="jnp-lec-btn" data-act="ai-quiz">${svg('i-check',14)}<span class="lbl">예상 시험문항</span></button>
            <button class="jnp-lec-btn" data-act="ai-translate">${svg('i-code',14)}<span class="lbl">번역</span></button>
            <button class="jnp-lec-btn" data-act="ai-ask">${svg('i-help',14)}<span class="lbl">질문</span></button>
          </div>
          <h5>AI 제안 카드</h5>
          <div class="jnp-lec-cards" data-role="cards">
            <div class="jnp-lec-empty">
              자동 제안을 켜면 수업 중 20초마다 정의·연결·시험문항 카드가 여기에 올라옵니다.
            </div>
          </div>
        </div>

        <!-- Section: 내보내기 -->
        <div class="jnp-lec-section" data-sec="export">
          <div class="jnp-lec-row">
            <button class="jnp-lec-btn" data-act="export-md">${svg('i-note',14)}<span class="lbl">Markdown</span></button>
            <button class="jnp-lec-btn" data-act="export-txt">${svg('i-quote',14)}<span class="lbl">텍스트</span></button>
            <button class="jnp-lec-btn" data-act="export-json">${svg('i-code',14)}<span class="lbl">JSON</span></button>
            <button class="jnp-lec-btn" data-act="export-docx">${svg('i-clipboard',14)}<span class="lbl">Word (.docx)</span></button>
          </div>
          <h5>세션 정보</h5>
          <div class="jnp-lec-row" data-role="stats" style="color:var(--ink-soft);font-size:12px;">
            문장 0개 · 카드 0개 · 0:00
          </div>
        </div>
      </div>
    `;

    // 이벤트 위임
    box.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.jnp-lec-tabs button[data-sec]');
      if (tabBtn) { switchSection(tabBtn.dataset.sec); return; }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      handle(act);
    });

    return box;
  }

  // ================================================================
  // 4) Open / Close / 섹션 전환
  // ================================================================
  async function open(kind = 'lecture') {
    if (state.open && state.kind === kind) { scrollToBox(); return; }
    if (state.open && state.recording) {
      if (!confirm('다른 모드로 바꾸려면 현재 녹음을 종료해야 합니다. 종료하시겠습니까?')) return;
      await stop();
    }
    close(true);

    const page = pageEl();
    if (!page) { toast('활성 탭이 없습니다 — 먼저 새 탭을 열어 주세요'); return; }

    const box = buildBox(kind);
    // 페이지 최상단에 삽입
    page.insertBefore(box, page.firstChild);
    state.ui.box = box;
    state.ui.time = box.querySelector('[data-role="time"]');
    state.ui.timeText = box.querySelector('[data-role="time"] .t');
    state.ui.preview = box.querySelector('[data-role="preview"]');
    state.ui.cards = box.querySelector('[data-role="cards"]');
    state.ui.folderName = box.querySelector('[data-role="folder-name"]');
    state.ui.folderNameFull = box.querySelector('[data-role="folder-name-full"]');
    state.ui.stats = box.querySelector('[data-role="stats"]');

    state.kind = kind;
    state.open = true;
    state.currentSection = 'rec';

    // 지난 세션에 저장된 폴더 핸들이 있으면 표시만
    try {
      const h = await loadDirHandle();
      if (h) { state.dirHandle = h; updateFolderLabel(h.name); }
    } catch {}

    // 앱의 저장 트리거
    try { page.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
    scrollToBox();
    toast((kind === 'lecture' ? '강의노트' : '회의노트') + ' 박스 열림');
  }

  function close(silent = false) {
    const box = document.querySelector('.jnp-lec-box');
    if (box) {
      if (state.recording && !silent) {
        if (!confirm('녹음 중입니다. 종료하시겠습니까?')) return;
      }
      stop();
      box.remove();
    }
    state.ui = {};
    state.open = false;
    const page = pageEl();
    if (page) try { page.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
  }

  function scrollToBox() { state.ui.box?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  function switchSection(sec) {
    if (!state.ui.box) return;
    state.currentSection = sec;
    state.ui.box.querySelectorAll('.jnp-lec-tabs button').forEach(b => b.classList.toggle('active', b.dataset.sec === sec));
    state.ui.box.querySelectorAll('.jnp-lec-section').forEach(s => s.classList.toggle('active', s.dataset.sec === sec));
  }

  // ================================================================
  // 5) 액션 디스패치
  // ================================================================
  async function handle(act) {
    switch (act) {
      case 'close':           close(); break;
      case 'toggle-record':   state.recording ? await stop() : await start(); break;
      case 'toggle-video':    toggleFlag('video'); break;
      case 'toggle-screen':   toggleFlag('screen'); break;
      case 'toggle-transcribe': toggleFlag('transcribe'); break;
      case 'pick-folder':     await pickFolder(); break;
      case 'ai-copilot':      toggleFlag('copilot'); break;
      case 'ai-summary':      await runAI('summary'); break;
      case 'ai-quiz':         await runAI('quiz'); break;
      case 'ai-translate':    await runAI('translate'); break;
      case 'ai-ask':          await runAI('ask'); break;
      case 'export-md':       exportAs('md'); break;
      case 'export-txt':      exportAs('txt'); break;
      case 'export-json':     exportAs('json'); break;
      case 'export-docx':     exportAs('docx'); break;
    }
  }

  // 기본 on/off 기능들 ('video'/'screen'/'transcribe'/'copilot')
  const flags = { video: false, screen: false, transcribe: true, copilot: true };
  function toggleFlag(name) {
    flags[name] = !flags[name];
    const btn = state.ui.box?.querySelector(`[data-act="toggle-${name === 'copilot' ? 'copilot' : name === 'transcribe' ? 'transcribe' : name === 'video' ? 'video' : 'screen'}"]`)
            || state.ui.box?.querySelector(`[data-act="ai-${name}"]`);
    if (name === 'copilot') {
      const b = state.ui.box?.querySelector('[data-act="ai-copilot"]');
      b?.classList.toggle('on', flags[name]);
      if (flags[name]) startCopilot(); else stopCopilot();
    } else {
      const b = state.ui.box?.querySelector(`[data-act="toggle-${name}"]`);
      b?.classList.toggle('on', flags[name]);
    }
    toast(
      (name === 'video'      ? '카메라 녹화' :
       name === 'screen'     ? '화면 녹화' :
       name === 'transcribe' ? '자동 필기' :
       'AI 제안') + (flags[name] ? ' ON' : ' OFF')
    );
  }

  // ================================================================
  // 6) 폴더 선택 (File System Access API)
  // ================================================================
  async function pickFolder() {
    if (!('showDirectoryPicker' in window)) {
      toast('이 브라우저는 폴더 선택 미지원 — 파일은 다운로드됩니다');
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ id: 'jnp-lec-dir', mode: 'readwrite' });
      state.dirHandle = handle;
      await persistDirHandle(handle);
      updateFolderLabel(handle.name);
      toast('저장 폴더: ' + handle.name);
    } catch (e) {
      if (e.name !== 'AbortError') console.warn(e);
    }
  }
  function updateFolderLabel(name) {
    if (state.ui.folderName) state.ui.folderName.textContent = name || '폴더 미지정';
    if (state.ui.folderNameFull) state.ui.folderNameFull.textContent = name || '미지정';
  }

  async function writeToFolder(filename, blob) {
    if (state.dirHandle) {
      try {
        // 매 세션마다 권한 재확인
        const perm = await state.dirHandle.queryPermission?.({ mode: 'readwrite' });
        if (perm !== 'granted') {
          const req = await state.dirHandle.requestPermission?.({ mode: 'readwrite' });
          if (req !== 'granted') throw new Error('no permission');
        }
        const fh = await state.dirHandle.getFileHandle(filename, { create: true });
        const w = await fh.createWritable();
        await w.write(blob); await w.close();
        toast('저장됨: ' + filename);
        return true;
      } catch (e) { console.warn('[writeToFolder] fallback to download', e); }
    }
    // 폴백: 다운로드
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('다운로드: ' + filename);
    return false;
  }

  // ================================================================
  // 7) 녹음 + 녹화 + 화면공유 + 자동필기
  // ================================================================
  async function start() {
    if (state.recording) return;

    // 동의
    if (!localStorage.getItem('jnpLectureConsentV3')) {
      const ok = confirm(
        '이 기능은 마이크' + (flags.video ? '·카메라' : '') + (flags.screen ? '·화면' : '') +
        '를 녹화합니다.\n\n' +
        '· 녹화 파일은 지정한 폴더(또는 다운로드 폴더)에 저장됩니다.\n' +
        '· Web Speech API 사용 시 음성이 브라우저 제공자(Google/Apple) 서버로\n' +
        '  잠시 전송되어 텍스트로 변환됩니다.\n' +
        '· 타인의 음성·영상을 녹화할 땐 반드시 동의를 얻으세요.\n\n계속?'
      );
      if (!ok) return;
      localStorage.setItem('jnpLectureConsentV3', '1');
    }

    // 트랙 모으기
    const tracks = [];
    try {
      const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.mediaStream = audio;
      audio.getAudioTracks().forEach(t => tracks.push(t));
    } catch (e) { toast('마이크 권한이 필요합니다'); return; }

    if (flags.video) {
      try {
        const cam = await navigator.mediaDevices.getUserMedia({ video: true });
        cam.getVideoTracks().forEach(t => tracks.push(t));
        state.mediaStream.addTrack(cam.getVideoTracks()[0]);
      } catch (e) { toast('카메라 권한 거부 — 오디오만 녹음'); flags.video = false; }
    }
    if (flags.screen) {
      try {
        const disp = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        state.displayStream = disp;
        // 화면 트랙은 별도 스트림으로 두고 나중에 합치거나 별 트랙으로 녹화
        // MediaRecorder 는 하나의 스트림만 받으므로, 여기선 화면만 따로 저장
      } catch (e) { toast('화면 공유 거부'); flags.screen = false; }
    }

    // 미리보기 (비디오 있을 때만)
    if (flags.video && state.ui.preview) {
      state.ui.preview.srcObject = state.mediaStream;
      state.ui.preview.classList.add('on');
      state.ui.preview.play().catch(()=>{});
    }

    // MediaRecorder — 오디오 + (카메라)
    try {
      const rec = new MediaRecorder(state.mediaStream, { mimeType: pickMime() });
      state.chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) state.chunks.push(e.data); };
      rec.onstop = () => saveRecording();
      rec.start(1000);
      state.mediaRecorder = rec;
    } catch (e) { console.warn('[MediaRecorder]', e); toast('녹화 엔진 시작 실패'); }

    // 화면 녹화는 별도 MediaRecorder
    if (state.displayStream) {
      try {
        const dRec = new MediaRecorder(state.displayStream, { mimeType: pickMime() });
        state.displayChunks = [];
        dRec.ondataavailable = (e) => { if (e.data.size > 0) state.displayChunks.push(e.data); };
        dRec.onstop = () => saveRecording({ screen: true });
        dRec.start(1000);
        state.displayRecorder = dRec;
        state.displayStream.getVideoTracks()[0].addEventListener('ended', () => {
          try { dRec.state === 'recording' && dRec.stop(); } catch {}
        });
      } catch (e) { console.warn(e); }
    }

    // 자동 필기
    if (flags.transcribe) startSpeech();

    // 마커 삽입 (탭 본문에)
    insertMarker('강의 시작');

    state.recording = true;
    state.startedAt = Date.now();
    state.session = { lines: [], cards: [] };
    state.ui.time?.classList.add('on');
    const b = state.ui.box?.querySelector('[data-act="toggle-record"]');
    if (b) {
      b.classList.remove('primary'); b.classList.add('danger');
      b.innerHTML = `${svg('i-x',14)}<span class="lbl">수업 종료</span>`;
    }
    startTick();
    if (flags.copilot) startCopilot();
    toast('녹음 시작');
  }

  function pickMime() {
    const list = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'audio/webm;codecs=opus', 'audio/webm'];
    for (const m of list) if (MediaRecorder.isTypeSupported?.(m)) return m;
    return 'video/webm';
  }

  async function stop() {
    if (!state.recording) return;
    state.recording = false;
    try { state.speech?.stop(); } catch {}
    try { state.mediaRecorder?.state === 'recording' && state.mediaRecorder.stop(); } catch {}
    try { state.displayRecorder?.state === 'recording' && state.displayRecorder.stop(); } catch {}
    try { state.mediaStream?.getTracks().forEach(t => t.stop()); } catch {}
    try { state.displayStream?.getTracks().forEach(t => t.stop()); } catch {}
    stopCopilot();
    stopTick();
    state.ui.time?.classList.remove('on');
    const b = state.ui.box?.querySelector('[data-act="toggle-record"]');
    if (b) {
      b.classList.remove('danger'); b.classList.add('primary');
      b.innerHTML = `${svg('i-mic',14)}<span class="lbl">수업 시작</span>`;
    }
    if (state.ui.preview) { state.ui.preview.srcObject = null; state.ui.preview.classList.remove('on'); }

    insertMarker('강의 종료');
    updateStats();

    // 어댑터 요약 (있으면)
    if (adapter().buildSummary) {
      try {
        const res = await adapter().buildSummary({ lines: state.session.lines, cards: state.session.cards });
        if (res?.summary) insertSummary(res.summary, 'AI 요약');
      } catch (e) { console.warn('[buildSummary]', e); }
    }
    toast('녹음 종료 · 녹화 파일을 저장합니다');
  }

  async function saveRecording(opt = {}) {
    const chunks = opt.screen ? state.displayChunks : state.chunks;
    if (!chunks || chunks.length === 0) return;
    const blob = new Blob(chunks, { type: chunks[0].type });
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const prefix = state.kind === 'lecture' ? 'lecture' : 'meeting';
    const suffix = opt.screen ? '-screen' : '';
    const ext = blob.type.includes('video') ? 'webm' : 'webm';
    const filename = `${prefix}-${ts}${suffix}.${ext}`;
    await writeToFolder(filename, blob);
  }

  // ================================================================
  // 8) 자동 필기 (Web Speech API)
  // ================================================================
  function startSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('자동 필기 미지원 브라우저'); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language?.startsWith('en') ? 'en-US' : 'ko-KR';
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = (r[0].transcript || '').trim();
        if (!text) continue;
        if (r.isFinal) {
          if (state.interimEl) { state.interimEl.remove(); state.interimEl = null; }
          const p = appendLineToPage(text);
          state.session.lines.push({ t: now(), text, el: p });
          updateStats();
          maybeTriggerCopilot();
        } else {
          if (!state.interimEl) state.interimEl = appendLineToPage(text, { interim: true });
          else state.interimEl.textContent = text;
        }
      }
    };
    rec.onerror = (e) => { if (e.error !== 'no-speech' && e.error !== 'audio-capture') console.warn('[speech]', e.error); };
    rec.onend = () => { if (state.recording) { try { rec.start(); } catch {} } };
    try { rec.start(); state.speech = rec; } catch (e) { console.warn(e); }
  }

  function appendLineToPage(text, { interim = false, adopted = false } = {}) {
    const page = pageEl(); if (!page) return null;
    const p = document.createElement('p');
    p.className = 'jnp-lec-line' + (interim ? ' interim' : '') + (adopted ? ' adopted' : '');
    p.setAttribute('data-ts', fmtTime(now()).slice(-5)); // MM:SS
    p.textContent = text;
    page.appendChild(p);
    try { page.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
    p.scrollIntoView({ block: 'end', behavior: 'smooth' });
    return p;
  }

  function insertMarker(text) {
    const page = pageEl(); if (!page) return;
    const p = document.createElement('p');
    p.className = 'jnp-lec-line';
    p.setAttribute('data-ts', fmtTime(now()).slice(-5));
    p.style.cssText = 'border-top:1px dashed var(--line); padding-top:6px; margin-top:14px; color:var(--ink-soft); font-size:0.85em;';
    p.textContent = `― ${text} · ${new Date().toLocaleString('ko-KR')} ―`;
    page.appendChild(p);
    try { page.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
  }

  function insertSummary(md, title = '요약') {
    const page = pageEl(); if (!page) return;
    const div = document.createElement('div');
    div.style.cssText = 'border:1px dashed var(--line); background:var(--tab-hover); border-radius:10px; padding:10px 14px; margin:14px 0;';
    div.innerHTML = `<h4 style="margin:0 0 6px;font-size:0.95em">${escHtml(title)}</h4><div style="white-space:pre-wrap">${escHtml(md)}</div>`;
    page.appendChild(div);
    try { page.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
  }

  // ================================================================
  // 9) AI
  // ================================================================
  async function runAI(kind) {
    const lines = state.session.lines.map(l => ({ t: l.t, text: l.text }));
    const recentTranscript = lines.slice(-30).map(l => l.text).join('\n');
    if (kind === 'ask') {
      const q = prompt('AI 에 질문 (예: 지금까지 내용 한 줄 요약)');
      if (!q) return;
      return runAdapterCards({ question: q, recentTranscript, notes: lines });
    }
    if (kind === 'summary') {
      if (adapter().buildSummary) {
        try {
          const res = await adapter().buildSummary({ lines, cards: state.session.cards });
          if (res?.summary) insertSummary(res.summary, 'AI 요약');
          (res?.cards || []).forEach(renderCard);
          return;
        } catch (e) { console.warn(e); }
      }
      // Mock
      const top = lines.map(l => l.text).filter(t => t && t.length > 12).slice(-6).join('\n· ');
      if (top) insertSummary('· ' + top, '간이 요약 (Mock)');
      else toast('아직 필기가 충분하지 않습니다');
      return;
    }
    if (kind === 'quiz')      return runAdapterCards({ task: 'quiz', recentTranscript, notes: lines });
    if (kind === 'translate') return runAdapterCards({ task: 'translate', recentTranscript, notes: lines });
  }

  async function runAdapterCards(ctx) {
    if (adapter().getCopilotCards) {
      try {
        const cards = await adapter().getCopilotCards(ctx) || [];
        if (cards.length === 0) toast('생성된 카드 없음');
        cards.forEach(renderCard);
        switchSection('ai');
      } catch (e) { toast('AI 호출 실패'); console.warn(e); }
    } else {
      renderCard({ kind: 'Mock', title: 'AI 응답', body: 'adapter 미연결 — OPENAI_API_KEY 를 Vercel 환경변수에 설정하면 실제 LLM 답변이 여기에 표시됩니다.\n요청: ' + JSON.stringify(ctx).slice(0, 200), cta: ['확인'] });
      switchSection('ai');
    }
  }

  // ---- Copilot 주기 ----
  const MOCK_COP = [
    { kind: '정의', title: '용어 정의 제안', body: '최근 구간 핵심 용어를 정리합니다. adapter 연결 시 실제 정의가 뽑힙니다.', cta: ['노트에 삽입','지나가기'] },
    { kind: '연결', title: '이전 수업 연결', body: '이 개념은 지난 회차와 연결될 가능성이 큽니다.', cta: ['노트에 삽입','지나가기'] },
    { kind: '퀴즈', title: '예상 시험 문항', body: '조금 더 필기가 쌓이면 예상 시험문항 카드가 올라옵니다.', cta: ['시험지에 추가','지나가기'] },
  ];

  function startCopilot() {
    stopCopilot();
    state.copilotTimer = setInterval(maybeTriggerCopilot, 20000);
  }
  function stopCopilot() { if (state.copilotTimer) { clearInterval(state.copilotTimer); state.copilotTimer = null; } }

  async function maybeTriggerCopilot() {
    if (!state.recording || !flags.copilot) return;
    const recent = state.session.lines.slice(-6).map(l => l.text).join('\n');
    if (recent.length < 20 && state.session.lines.length < 2) return;
    let cards = [];
    try {
      if (adapter().getCopilotCards) {
        cards = await adapter().getCopilotCards({ recentTranscript: recent, notes: state.session.lines }) || [];
      } else {
        cards = [MOCK_COP[state.copilotCtr % MOCK_COP.length]];
        state.copilotCtr++;
      }
    } catch (e) { console.warn('[copilot]', e); return; }
    cards.forEach(renderCard);
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
          state.session.lines.push({ t: now(), text: card.body, el: line, adopted: true });
          updateStats();
        }
        el.style.opacity = 0;
        setTimeout(() => el.remove(), 180);
      });
      row.appendChild(b);
    });
    state.ui.cards.prepend(el);
    state.session.cards.push(card);
  }

  // ================================================================
  // 10) 내보내기 (기존 페이지 내용 전체 기준)
  // ================================================================
  function collectText() {
    const page = pageEl(); if (!page) return '';
    return Array.from(page.querySelectorAll('.jnp-lec-line')).map(p => {
      const ts = p.getAttribute('data-ts') || '';
      return ts ? `[${ts}] ${p.textContent}` : p.textContent;
    }).join('\n');
  }

  async function exportAs(format) {
    const kindTitle = state.kind === 'lecture' ? '강의노트' : '회의노트';
    const title = (document.getElementById('padTitle')?.value || kindTitle);
    const text = collectText();
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const base = `${state.kind}-${ts}`;

    if (format === 'md' || format === 'txt') {
      const body = format === 'md'
        ? `# ${title}\n\n${text}\n\n---\n저장: ${new Date().toLocaleString('ko-KR')}\n`
        : text;
      await writeToFolder(`${base}.${format}`, new Blob([body], { type: format === 'md' ? 'text/markdown' : 'text/plain' }));
      return;
    }
    if (format === 'json') {
      const data = { title, kind: state.kind, startedAt: state.startedAt, lines: state.session.lines.map(l => ({ t: l.t, text: l.text })), cards: state.session.cards };
      await writeToFolder(`${base}.json`, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      return;
    }
    if (format === 'docx') {
      // 경량 HTML → docx-friendly .doc (Word 호환)
      const html = `<html><head><meta charset="utf-8"><title>${escHtml(title)}</title></head><body>
        <h1>${escHtml(title)}</h1>
        <pre style="font-family:inherit;white-space:pre-wrap">${escHtml(text)}</pre>
      </body></html>`;
      await writeToFolder(`${base}.doc`, new Blob([html], { type: 'application/msword' }));
      return;
    }
  }

  // ================================================================
  // 11) Tick + Stats
  // ================================================================
  function startTick() {
    stopTick();
    const step = () => {
      if (!state.recording) return;
      if (state.ui.timeText) state.ui.timeText.textContent = fmtTime(now());
      state.tickHandle = requestAnimationFrame(step);
    };
    state.tickHandle = requestAnimationFrame(step);
  }
  function stopTick() { if (state.tickHandle) cancelAnimationFrame(state.tickHandle); state.tickHandle = null; }

  function updateStats() {
    if (!state.ui.stats) return;
    state.ui.stats.textContent = `문장 ${state.session.lines.length}개 · 카드 ${state.session.cards.length}개 · ${fmtTime(now())}`;
  }

  // ================================================================
  // 12) 토픽바 버튼 2개
  // ================================================================
  function injectTopbarButtons() {
    if (document.getElementById('lectureTopBtn') && document.getElementById('meetingTopBtn')) return true;
    const anchor = document.getElementById('calOpenBtn') || document.getElementById('aiBtn') || document.getElementById('palBtn');
    if (!anchor || !anchor.parentNode) return false;

    const make = (id, label, iconId, kind) => {
      if (document.getElementById(id)) return null;
      const b = document.createElement('button');
      b.id = id;
      b.className = anchor.className || 'collapsible';
      b.setAttribute('aria-label', label);
      b.setAttribute('title', label);
      b.innerHTML = `${svg(iconId, 16)}<span class="lbl" style="margin-left:4px">${label}</span>`;
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

  // ================================================================
  // 13) Command Palette
  // ================================================================
  function tryRegisterPalette() {
    const pal = window.justanotepadPalette;
    if (!pal || typeof pal.register !== 'function') return false;
    pal.register({ id: 'lecture.open',  title: '강의노트 열기', keywords: ['lecture','강의','수업','녹음'], run: () => open('lecture') });
    pal.register({ id: 'meeting.open',  title: '회의노트 열기', keywords: ['meeting','회의','녹음'], run: () => open('meeting') });
    pal.register({ id: 'lecture.toggle-record', title: '녹음 시작/종료', keywords: ['녹음','record'], run: () => handle('toggle-record') });
    pal.register({ id: 'lecture.pick-folder', title: '저장 폴더 선택', keywords: ['폴더','folder','저장경로'], run: () => handle('pick-folder') });
    pal.register({ id: 'lecture.summary', title: 'AI 요약 만들기', keywords: ['요약','summary','ai'], run: () => runAI('summary') });
    return true;
  }

  // ================================================================
  // 14) 부팅
  // ================================================================
  function boot() {
    injectTopbarButtons() || setTimeout(boot, 400);
    tryRegisterPalette() || setTimeout(tryRegisterPalette, 600);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // ================================================================
  // 15) 전역 API
  // ================================================================
  window.justanotepadLecture = {
    __v: 3,
    open, close,
    toggle: (k) => state.open && state.kind === k ? close() : open(k),
    isOpen: () => state.open,
    isRecording: () => state.recording,
    _state: state,
  };

  console.info('[lecture-mode] v3.0 ready · control-box · audio+video+screen+folder+ai');
})();
