/**
 * justanotepad · Lecture Mode (LectureOS v0)
 * --------------------------------------------------------------------------
 * 세계 최고급 강의노트 앱의 핵심 UX를 justanotepad에 얹는 드롭인 ES 모듈.
 *
 * 기능 (브라우저 기본 · API 키 불필요):
 *   1. 🎙️ 수업 시작/종료 — 오디오 녹음(MediaRecorder) + Web Speech API 실시간 자동 필기
 *   2. 📝 자동 필기 블록 — 확정 문장이 에디터에 auto-transcript 블록으로 추가
 *   3. 🤖 Copilot 카드 스트림 — 용어 정의/이전 수업 연결/예상 시험문항/참고자료 (adapter로 LLM 연결 가능)
 *   4. ⏱️ Note Timeline — 오디오/잉크/타이핑/AI 4트랙 하단 바. 클릭 시 해당 시점으로 점프
 *   5. 🧊 블록 에디터 (기존 영역 재사용)
 *   6. 💾 세션 저장 — 종료 시 localStorage + Supabase(adapter 연결 시)
 *   7. 📤 .md / .json / .docx-friendly HTML 내보내기
 *   8. ⌘K 명령 팔레트와 자동 통합 (command-palette.js 설치되어 있으면)
 *
 * 통합 (app.html, </body> 직전, 기존 모듈 아래):
 *     <script type="module" src="./lecture-mode.js"></script>
 *
 * 선택 — 기존 에디터에 전사 블록을 꽂아 넣고 싶을 때:
 *     window.justanotepadLectureAdapter = {
 *       // 에디터에 한 줄 블록 추가. 기본값은 우리 내장 에디터에 쓴다.
 *       appendBlock({ type, text, meta }) { myEditor.insert(text); },
 *       // 세션 종료 시 Supabase 업로드 등 원하는 저장 로직
 *       async saveSession(session) { ... POST to Supabase ... },
 *       // Copilot 카드 생성 (LLM 연결 지점).
 *       //   ctx: { recentTranscript, notes, subject, subjectHistory }
 *       //   반환: [{ kind:'define'|'link'|'quiz'|'cite'|'translate', title, body, meta, cta:[] }]
 *       async getCopilotCards(ctx) { return []; },
 *       // 수업 종료 후 요약/플래시카드/시험문항 생성
 *       async buildSummary(session) { return { summary, cards, quiz }; },
 *     };
 *
 * 명령 팔레트 등록 (자동):
 *   · "강의 모드 시작" / "강의 모드 종료" / "강의 모드 열기"
 *   · "현재 수업 내보내기 (Markdown)"
 *
 * 전역 API:
 *   window.justanotepadLecture = {
 *     start(opts), stop(), open(), close(), isActive(),
 *     addCard(card), addTimelineEvent(track, t, label, onClick),
 *     onEvent(name, fn), off(name, fn), exportMarkdown(), exportJson(),
 *     getSession()
 *   }
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.justanotepadLecture) return; // idempotent

  // ==================================================================
  // 1. 스타일 (scoped, 단 한 번만 주입)
  // ==================================================================
  const CSS = `
  .jnp-lec-overlay {
    position: fixed; inset: 0; z-index: 2147482000;
    background: #0f1320; color: #e7ecf7;
    font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI",
          "Malgun Gothic","Apple SD Gothic Neo", sans-serif;
    display: grid;
    grid-template-columns: 240px 1fr 340px;
    grid-template-rows: 52px 1fr 96px;
    opacity: 0; transition: opacity 140ms ease;
  }
  .jnp-lec-overlay.open { opacity: 1; }
  .jnp-lec-overlay .top {
    grid-column: 1/-1; display: flex; align-items: center; gap: 10px;
    padding: 0 14px; border-bottom: 1px solid #262d49;
    background: linear-gradient(180deg,#171c31,#131828);
  }
  .jnp-lec-overlay .logo { font-weight: 800; letter-spacing:.3px }
  .jnp-lec-overlay .logo span { color: #6ea8ff }
  .jnp-lec-overlay .crumb { color: #9aa3c7; font-size: 12px; }
  .jnp-lec-overlay .spacer { flex: 1; }
  .jnp-lec-overlay .pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 10px; border-radius: 999px;
    background: #1b2139; border: 1px solid #262d49;
    color: #9aa3c7; font-size: 12px;
  }
  .jnp-lec-overlay .pill .dot {
    width: 8px; height: 8px; border-radius: 999px; background: #9aa3c7;
  }
  .jnp-lec-overlay .pill.rec .dot {
    background: #ff7a7a;
    animation: jnp-lec-pulse 1.2s infinite;
  }
  @keyframes jnp-lec-pulse {
    0%{ box-shadow: 0 0 0 0 rgba(255,122,122,.7); }
    70%{ box-shadow: 0 0 0 9px rgba(255,122,122,0); }
  }
  .jnp-lec-overlay .btn {
    border: 1px solid #262d49; background: #1b2139; color: #e7ecf7;
    padding: 7px 11px; border-radius: 10px; cursor: pointer; font: inherit;
  }
  .jnp-lec-overlay .btn:hover { border-color: #3a4575; }
  .jnp-lec-overlay .btn.primary {
    background: linear-gradient(180deg,#3a71e3,#2456bd); border-color:#3762b6; color:#fff;
  }
  .jnp-lec-overlay .btn.danger {
    background: linear-gradient(180deg,#d63a3a,#a52727); border-color:#a53434; color:#fff;
  }

  .jnp-lec-overlay .side {
    background: #151a2c; border-right: 1px solid #262d49;
    overflow: auto;
  }
  .jnp-lec-overlay .side h4 {
    margin: 14px 14px 6px; font-size: 11px; color: #9aa3c7;
    letter-spacing: .12em; text-transform: uppercase;
  }
  .jnp-lec-overlay .side .it {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 14px; cursor: pointer; color: #e7ecf7;
    border-left: 2px solid transparent;
  }
  .jnp-lec-overlay .side .it.active {
    background: linear-gradient(90deg, rgba(110,168,255,.16), transparent);
    border-left-color: #6ea8ff;
  }
  .jnp-lec-overlay .side .it:hover { background: #1a2039; }

  .jnp-lec-overlay .editor {
    background: #0f1320; display: flex; flex-direction: column; overflow: hidden;
  }
  .jnp-lec-overlay .editor header {
    padding: 14px 22px 8px; border-bottom: 1px solid #262d49;
    background: linear-gradient(180deg,#12172a,#0f1424);
  }
  .jnp-lec-overlay .editor header input.title {
    background: transparent; border: 0; outline: 0;
    color: #e7ecf7; font: 700 18px/1.3 inherit; width: 100%;
  }
  .jnp-lec-overlay .editor header input.title::placeholder { color: #5c6890; }
  .jnp-lec-overlay .editor header .meta {
    color: #9aa3c7; font-size: 12px; margin-top: 4px;
    display: flex; gap: 14px; flex-wrap: wrap;
  }

  .jnp-lec-canvas {
    flex: 1; overflow: auto; padding: 18px 22px;
    background:
      radial-gradient(circle at 10px 10px, #1a2140 1px, transparent 1px) 0 0/28px 28px,
      #0f1320;
  }
  .jnp-lec-block {
    background: #151a2c; border: 1px solid #262d49;
    border-radius: 12px; padding: 12px 14px; margin: 10px 0;
    position: relative;
  }
  .jnp-lec-block .time { font-size: 11px; color: #9aa3c7; margin-bottom: 4px; }
  .jnp-lec-block .chips {
    display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;
  }
  .jnp-lec-block .chip {
    font-size: 11px; padding: 3px 8px; border-radius: 999px;
    background: #0f1528; border: 1px solid #262d49; color: #9aa3c7;
    cursor: pointer;
  }
  .jnp-lec-block .chip:hover { color: #e7ecf7; border-color: #3a4575; }
  .jnp-lec-block.ai { border-color: #3a4a7a; }
  .jnp-lec-block.ai::before {
    content: "AI 자동 필기"; position: absolute; top: -10px; left: 14px;
    font-size: 10px; color: #8ff3c8; background: #0f1528;
    padding: 2px 8px; border-radius: 999px; border: 1px solid #2a5a4a;
  }
  .jnp-lec-block[contenteditable="true"] { outline: none; }

  .jnp-lec-overlay .copilot {
    background: #151a2c; border-left: 1px solid #262d49;
    display: flex; flex-direction: column; overflow: hidden;
  }
  .jnp-lec-overlay .copilot header {
    padding: 12px 14px; border-bottom: 1px solid #262d49;
    display: flex; align-items: center; gap: 8px;
  }
  .jnp-lec-overlay .copilot .stream {
    flex: 1; overflow: auto; padding: 10px;
  }
  .jnp-lec-card {
    background: #1b2139; border: 1px solid #262d49;
    border-radius: 12px; padding: 12px; margin-bottom: 10px;
    animation: jnp-lec-rise .35s ease-out;
  }
  @keyframes jnp-lec-rise {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: none; }
  }
  .jnp-lec-card .kind {
    display: inline-block; font-size: 10px; padding: 2px 8px;
    border-radius: 999px; background: #112036; color: #a6c7ff;
    margin-bottom: 6px; border: 1px solid #1f3356;
  }
  .jnp-lec-card .kind.warn { color: #ffd166; background: #2b2514; border-color: #584a21; }
  .jnp-lec-card .kind.ok { color: #8ff3c8; background: #11281f; border-color: #2a5a4a; }
  .jnp-lec-card .kind.qz { color: #ffb3de; background: #2a1424; border-color: #572545; }
  .jnp-lec-card .body { color: #e7ecf7; }
  .jnp-lec-card .meta { color: #9aa3c7; font-size: 11px; margin-top: 6px; }
  .jnp-lec-card .row { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
  .jnp-lec-card .swipe {
    flex: 1; min-width: 60px; text-align: center;
    padding: 6px 10px; border-radius: 8px;
    background: #0f1528; border: 1px solid #262d49;
    color: #9aa3c7; cursor: pointer; font-size: 12px;
  }
  .jnp-lec-card .swipe.adopt { color: #8ff3c8; border-color: #2a5a4a; }
  .jnp-lec-card .swipe.adopt:hover { background: #11281f; }
  .jnp-lec-card .swipe.skip:hover { background: #2a1419; color: #ff7a7a; border-color: #572525; }

  .jnp-lec-overlay .timeline {
    grid-column: 1/-1;
    background: linear-gradient(180deg,#0e1222,#0b0f1d);
    border-top: 1px solid #262d49;
    padding: 10px 16px;
    display: flex; flex-direction: column; gap: 4px;
  }
  .jnp-lec-tl-row {
    display: flex; align-items: center; gap: 8px;
    font-size: 11px; color: #9aa3c7;
  }
  .jnp-lec-tl-row .label { width: 78px; }
  .jnp-lec-tl-row .track {
    flex: 1; height: 16px;
    background: #0a0e1c; border: 1px solid #262d49; border-radius: 8px;
    position: relative; overflow: hidden; cursor: pointer;
  }
  .jnp-lec-tl-row .seg { position: absolute; top: 1px; bottom: 1px; border-radius: 6px; }
  .jnp-lec-tl-row.audio .seg { background: linear-gradient(90deg,#2d4c8a,#3a71e3); }
  .jnp-lec-tl-row.ink   .seg { background: linear-gradient(90deg,#4a8f73,#8ff3c8); }
  .jnp-lec-tl-row.type  .seg { background: linear-gradient(90deg,#9a6b2c,#ffd166); }
  .jnp-lec-tl-row.ai    .seg { background: linear-gradient(90deg,#7a3a7a,#ffb3de); }
  .jnp-lec-tl-row .head {
    position: absolute; top: 0; bottom: 0; width: 2px; background: #fff; z-index: 3;
  }
  .jnp-lec-tl-row .mark {
    position: absolute; top: 50%; transform: translate(-50%,-50%);
    width: 8px; height: 8px; border-radius: 999px; background: #fff;
    cursor: pointer; border: 2px solid #0b0f1d;
  }

  .jnp-lec-overlay .legend {
    display: flex; gap: 10px; margin-top: 4px;
    color: #9aa3c7; font-size: 11px; flex-wrap: wrap;
  }
  .jnp-lec-overlay .legend .dot {
    display: inline-block; width: 8px; height: 8px; border-radius: 2px;
    vertical-align: middle; margin-right: 4px;
  }

  .jnp-lec-toast {
    position: fixed; top: 70px; right: 16px; z-index: 2147483500;
    background: #1b2139; border: 1px solid #2a355b;
    color: #cfe0ff; padding: 8px 12px; border-radius: 10px;
    font: 13px/1.4 inherit;
    opacity: 0; transform: translateY(-4px);
    transition: opacity .2s, transform .2s;
  }
  .jnp-lec-toast.show { opacity: 1; transform: none; }

  /* Light theme support (auto-detected via body or html class) */
  html.light .jnp-lec-overlay, body.light .jnp-lec-overlay {
    background: #f5f7fb; color: #1b2139;
  }
  html.light .jnp-lec-overlay .side, body.light .jnp-lec-overlay .side,
  html.light .jnp-lec-overlay .copilot, body.light .jnp-lec-overlay .copilot {
    background: #fff; border-color: #dfe3ef;
  }
  html.light .jnp-lec-overlay .editor, body.light .jnp-lec-overlay .editor {
    background: #f5f7fb;
  }
  html.light .jnp-lec-overlay .timeline, body.light .jnp-lec-overlay .timeline {
    background: #eef1f8; border-color: #dfe3ef;
  }
  html.light .jnp-lec-block, body.light .jnp-lec-block {
    background: #fff; border-color: #dfe3ef; color: #1b2139;
  }
  html.light .jnp-lec-card, body.light .jnp-lec-card {
    background: #fff; border-color: #dfe3ef; color: #1b2139;
  }

  @media (max-width: 960px) {
    .jnp-lec-overlay { grid-template-columns: 1fr !important; }
    .jnp-lec-overlay .side, .jnp-lec-overlay .copilot {
      max-height: 220px; overflow: auto;
    }
  }
  `;
  const st = document.createElement('style');
  st.id = 'jnp-lecture-style';
  st.textContent = CSS;
  document.head.appendChild(st);

  // ==================================================================
  // 2. 내부 상태 & 이벤트 버스
  // ==================================================================
  const state = {
    active: false,
    recording: false,
    startedAt: 0,
    pausedAt: 0,
    title: '',
    subject: '',
    blocks: [],     // {id, type, text, timeMs, meta}
    cards: [],      // AI cards shown
    events: [],     // timeline events {track, t, label}
    audioChunks: [],
    mediaRecorder: null,
    speech: null,   // SpeechRecognition instance
    ui: null,       // DOM root
    copilotTimer: null,
    copilotCtr: 0,  // rotating mock demo index
  };
  const bus = {};
  const emit = (name, ...args) => (bus[name] || []).forEach(fn => { try { fn(...args); } catch (e) { console.error(e); } });
  const on = (name, fn) => { (bus[name] = bus[name] || []).push(fn); };
  const off = (name, fn) => { bus[name] = (bus[name] || []).filter(f => f !== fn); };

  // ==================================================================
  // 3. 유틸
  // ==================================================================
  const el = (tag, attrs = {}, children = []) => {
    const d = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'class') d.className = attrs[k];
      else if (k === 'style') d.style.cssText = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function') d.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else d.setAttribute(k, attrs[k]);
    }
    [].concat(children).forEach(c => {
      if (c == null) return;
      if (typeof c === 'string') d.appendChild(document.createTextNode(c));
      else d.appendChild(c);
    });
    return d;
  };
  const fmt = ms => {
    const s = Math.floor(ms/1000);
    return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s%3600/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  };
  const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36);
  const now = () => state.startedAt ? (Date.now() - state.startedAt) : 0;
  const toast = (text, ms=2000) => {
    const t = el('div', { class: 'jnp-lec-toast' }, '⤷ ' + text);
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, ms);
  };
  const adapter = () => window.justanotepadLectureAdapter || {};

  // ==================================================================
  // 4. UI 빌드
  // ==================================================================
  function buildUI() {
    if (state.ui) return state.ui;

    // TOP
    const recPill = el('span', { class: 'pill' });
    const recDot = el('span', { class: 'dot' });
    const recText = el('span', {}, '대기 중');
    recPill.append(recDot, recText);

    const timePill = el('span', { class: 'pill' });
    const timeDot = el('span', { class: 'dot', style: 'background:#8ff3c8' });
    const timeText = el('span', {}, '00:00:00');
    timePill.append(timeDot, timeText);

    const recBtn = el('button', { class: 'btn primary' }, '🎙️ 수업 시작');
    recBtn.onclick = () => state.recording ? stop() : start();

    const exportBtn = el('button', { class: 'btn' }, '📤 내보내기');
    exportBtn.onclick = () => exportMarkdown();

    const closeBtn = el('button', { class: 'btn' }, '✕ 닫기');
    closeBtn.onclick = () => close();

    const top = el('div', { class: 'top' }, [
      el('div', { class: 'logo' }, [document.createTextNode('Lecture'), el('span', {}, 'OS')]),
      el('span', { class: 'crumb' }, '· justanotepad'),
      el('div', { class: 'spacer' }),
      recPill, timePill, recBtn, exportBtn, closeBtn
    ]);

    // SIDE
    const subjectInput = el('input', {
      class: 'btn',
      style: 'margin:10px 14px; width: calc(100% - 28px); background:#0f1528;',
      placeholder: '과목 (예: 일반물리학 I)',
      oninput: (e) => { state.subject = e.target.value; }
    });
    const side = el('nav', { class: 'side' }, [
      el('h4', {}, '오늘의 수업'),
      subjectInput,
      el('div', { class: 'it active' }, [document.createTextNode('🎙️ 현재 수업 (임시)')]),
      el('h4', {}, '학습'),
      el('div', { class: 'it', onclick: () => openSummary() }, [document.createTextNode('🧷 요약 · 복습 카드')]),
      el('div', { class: 'it', onclick: () => exportJson() }, [document.createTextNode('💾 세션 JSON 저장')]),
      el('div', { class: 'it', onclick: () => exportMarkdown() }, [document.createTextNode('📄 Markdown 내보내기')]),
      el('h4', {}, '도움말'),
      el('div', { class: 'it', onclick: () => showHelp() }, [document.createTextNode('❔ 단축키 · 기능')]),
    ]);

    // EDITOR
    const titleInput = el('input', {
      class: 'title', placeholder: '수업 제목 (예: 3주차 굴절·전반사)',
      oninput: (e) => { state.title = e.target.value; }
    });
    const metaBar = el('div', { class: 'meta' }, [
      el('span', {}, '🎤 실시간 자동 필기'),
      el('span', {}, '🤖 Copilot 제안'),
      el('span', {}, '⏱️ 타임라인 동기화'),
      el('span', { id: 'jnp-lec-asr-status' }, '상태: 대기')
    ]);
    const canvas = el('div', { class: 'jnp-lec-canvas', id: 'jnp-lec-canvas' });

    const editor = el('main', { class: 'editor' }, [
      el('header', {}, [titleInput, metaBar]),
      canvas
    ]);

    // COPILOT
    const copilotHeader = el('header', {}, [
      el('div', {}, [
        el('div', { style: 'font-weight:700' }, 'AI Copilot'),
        el('div', { style: 'color:#9aa3c7;font-size:12px' }, '수업 중 실시간 제안')
      ]),
      el('div', { style: 'margin-left:auto' }, [el('span', { class: 'pill' }, [el('span', { class: 'dot', style: 'background:#8ff3c8' }), document.createTextNode('ON')])])
    ]);
    const copilotStream = el('div', { class: 'stream', id: 'jnp-lec-stream' });
    const copilot = el('aside', { class: 'copilot' }, [copilotHeader, copilotStream]);

    // TIMELINE
    const tracks = {};
    const heads = {};
    const tlRow = (cls, labelText, trackKey) => {
      const head = el('div', { class: 'head', style: 'left:0%' });
      const track = el('div', { class: 'track', onclick: (e) => onTrackClick(e, track) });
      track.appendChild(head);
      tracks[trackKey] = track; heads[trackKey] = head;
      return el('div', { class: 'jnp-lec-tl-row ' + cls }, [
        el('div', { class: 'label' }, labelText),
        track
      ]);
    };
    const timeline = el('footer', { class: 'timeline' }, [
      tlRow('audio', '🎤 오디오', 'audio'),
      tlRow('ink',   '✍ 잉크',   'ink'),
      tlRow('type',  '⌨ 타이핑', 'type'),
      tlRow('ai',    '🤖 AI',     'ai'),
      el('div', { class: 'legend' }, [
        el('span', {}, [el('span', { class: 'dot', style: 'background:#3a71e3' }), document.createTextNode(' 오디오')]),
        el('span', {}, [el('span', { class: 'dot', style: 'background:#8ff3c8' }), document.createTextNode(' 잉크')]),
        el('span', {}, [el('span', { class: 'dot', style: 'background:#ffd166' }), document.createTextNode(' 타이핑')]),
        el('span', {}, [el('span', { class: 'dot', style: 'background:#ffb3de' }), document.createTextNode(' AI')]),
        el('span', { style: 'margin-left:auto' }, '⌘R 시작/정지 · ⌘J Copilot · ⌘. 최신채택 · Esc 닫기')
      ])
    ]);

    const overlay = el('div', { class: 'jnp-lec-overlay' }, [
      top, side, editor, copilot, timeline
    ]);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    state.ui = {
      overlay, recBtn, recPill, recText, timeText, canvas, stream: copilotStream,
      tracks, heads, titleInput, subjectInput,
      asrStatus: metaBar.querySelector('#jnp-lec-asr-status')
    };
    return state.ui;
  }

  function open() {
    if (state.active) return;
    state.active = true;
    buildUI();
    // onbeforeunload guard
    window.addEventListener('beforeunload', beforeUnload);
    // seed card
    addCard({
      kind: 'ok',
      title: '환영',
      body: '수업 시작 버튼을 누르면 자동 필기와 Copilot 제안이 시작됩니다. Web Speech API를 사용하므로 Chrome/Edge/Safari 에서 최적 동작합니다.',
      meta: '단축키 ⌘R · ⌘K (Command Palette)',
      cta: ['확인']
    });
    startTick();
    emit('open');
  }

  function close() {
    if (!state.active) return;
    if (state.recording) { if (!confirm('수업이 녹음 중입니다. 정말 닫을까요?')) return; stop(); }
    state.active = false;
    state.ui?.overlay?.classList.remove('open');
    setTimeout(() => { state.ui?.overlay?.remove(); state.ui = null; }, 200);
    window.removeEventListener('beforeunload', beforeUnload);
    emit('close');
  }
  function beforeUnload(e) {
    if (state.recording) { e.preventDefault(); e.returnValue = ''; }
  }

  // ==================================================================
  // 5. 녹음 (MediaRecorder) + Web Speech API 자동 필기
  // ==================================================================
  async function startMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      state.audioChunks = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) state.audioChunks.push(e.data); };
      rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); };
      rec.start(1000); // 1s timeslice — adds audio timeline segments
      state.mediaRecorder = rec;
      setAsrStatus('마이크: OK');
      return true;
    } catch (err) {
      console.warn('[lecture-mode] mic error', err);
      setAsrStatus('마이크: 거부됨 — 음성 없이 진행');
      return false;
    }
  }

  function startSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setAsrStatus('자동필기: 브라우저 미지원 — 타이핑으로만 진행');
      toast('Web Speech API 미지원. Chrome / Edge / Safari 를 권장합니다.');
      return false;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language?.startsWith('en') ? 'en-US' : 'ko-KR';

    let interimEl = null;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res[0].transcript.trim();
        if (!text) continue;
        if (res.isFinal) {
          // confirm block
          if (interimEl) { interimEl.remove(); interimEl = null; }
          addBlock({ type: 'ai-transcript', text, meta: { confidence: res[0].confidence } });
          emit('transcript', text);
          maybeTriggerCopilot();
        } else {
          // live interim
          if (!interimEl) {
            interimEl = el('div', { class: 'jnp-lec-block ai', style: 'opacity:.6' }, [
              el('div', { class: 'time' }, fmt(now()) + ' · 듣는 중...'),
              el('div', { class: 'body' }, text)
            ]);
            state.ui.canvas.appendChild(interimEl);
            state.ui.canvas.scrollTop = state.ui.canvas.scrollHeight;
          } else {
            interimEl.querySelector('.body').textContent = text;
          }
        }
      }
    };
    rec.onerror = (e) => {
      console.warn('[speech] error', e.error);
      if (e.error === 'no-speech' || e.error === 'audio-capture') return;
      setAsrStatus('자동필기: ' + e.error);
    };
    rec.onend = () => { if (state.recording) try { rec.start(); } catch {} };
    try { rec.start(); state.speech = rec; setAsrStatus('자동필기: ON · ' + rec.lang); return true; }
    catch (err) { console.warn(err); setAsrStatus('자동필기: 시작 실패'); return false; }
  }

  function setAsrStatus(text) {
    if (state.ui?.asrStatus) state.ui.asrStatus.textContent = '상태: ' + text;
  }

  async function start(opts = {}) {
    if (!state.active) open();
    if (state.recording) return;

    // Privacy disclosure
    if (!localStorage.getItem('jnpLectureConsent')) {
      const ok = confirm(
        '이 기능은 마이크로 수업을 녹음합니다.\n' +
        '• 녹음은 기본적으로 이 브라우저/기기에만 저장됩니다.\n' +
        '• Web Speech API 사용 시 음성이 브라우저 제공자(Google/Apple 등)의 서버로 잠시 전송되어 텍스트로 변환됩니다.\n' +
        '• 타인의 목소리를 녹음할 땐 반드시 동의를 얻으세요.\n\n계속하시겠습니까?'
      );
      if (!ok) return;
      localStorage.setItem('jnpLectureConsent', '1');
    }

    state.recording = true;
    state.startedAt = Date.now();
    state.ui.recBtn.textContent = '⏹️ 수업 종료';
    state.ui.recBtn.classList.remove('primary');
    state.ui.recBtn.classList.add('danger');
    state.ui.recPill.classList.add('rec');
    state.ui.recText.textContent = '녹음 중';

    addBlock({ type: 'system', text: `[수업 시작] ${new Date().toLocaleString()} — ${state.subject || '과목 미지정'}`, meta: { kind: 'start' } });

    await startMic();
    startSpeech();
    startCopilot();
    emit('start');
    toast('수업 시작 · Copilot이 주기적으로 제안을 올립니다');
  }

  async function stop() {
    if (!state.recording) return;
    state.recording = false;
    state.ui.recBtn.textContent = '🎙️ 수업 시작';
    state.ui.recBtn.classList.add('primary');
    state.ui.recBtn.classList.remove('danger');
    state.ui.recPill.classList.remove('rec');
    state.ui.recText.textContent = '종료됨';

    try { state.mediaRecorder?.state === 'recording' && state.mediaRecorder.stop(); } catch {}
    try { state.speech?.stop(); } catch {}
    stopCopilot();

    addBlock({ type: 'system', text: `[수업 종료] ${new Date().toLocaleString()} — ${fmt(now())}`, meta: { kind: 'stop' } });

    const session = buildSessionObject();
    // Local backup
    try {
      const key = 'jnpLectureSession:' + session.id;
      localStorage.setItem(key, JSON.stringify(session));
    } catch (e) { console.warn('localStorage full?', e); }

    // Adapter save (Supabase, etc.)
    try {
      if (adapter().saveSession) await adapter().saveSession(session);
    } catch (e) { console.warn('[adapter.saveSession] failed', e); }

    // Post-session summary (async, non-blocking)
    try {
      if (adapter().buildSummary) {
        toast('종료 · 요약/카드/시험문항을 생성합니다 (최대 5분)');
        adapter().buildSummary(session).then(res => {
          if (res?.summary) addBlock({ type: 'summary', text: res.summary });
          (res?.cards || []).forEach(c => addCard({ ...c, kind: c.kind || 'ok' }));
        }).catch(e => console.warn('[adapter.buildSummary]', e));
      } else {
        toast('종료됨 · 세션이 로컬에 저장됐습니다');
      }
    } catch {}

    emit('stop', session);
  }

  // ==================================================================
  // 6. 블록 & 타임라인
  // ==================================================================
  function addBlock({ type, text, meta = {}, html = null }) {
    const id = uid();
    const t = now();
    state.blocks.push({ id, type, text, timeMs: t, meta });

    const isAI = type === 'ai-transcript' || type === 'summary';
    const b = el('div', { class: 'jnp-lec-block' + (isAI ? ' ai' : '') });
    b.appendChild(el('div', { class: 'time' }, fmt(t) + (meta?.kind ? ` · ${meta.kind}` : '')));

    if (html) {
      const body = el('div');
      body.innerHTML = html;
      b.appendChild(body);
    } else {
      const body = el('div', { contenteditable: 'true' }, text);
      body.oninput = () => {
        const blk = state.blocks.find(x => x.id === id);
        if (blk) blk.text = body.textContent;
      };
      b.appendChild(body);
    }

    // chips
    const chips = el('div', { class: 'chips' }, [
      el('span', { class: 'chip', onclick: () => jumpTo(t) }, '📍 이 시점 재생'),
      el('span', { class: 'chip', onclick: () => askCopilot(text) }, '🤖 Copilot에 질문'),
      el('span', { class: 'chip', onclick: () => { state.blocks = state.blocks.filter(x => x.id !== id); b.remove(); } }, '🗑️ 삭제')
    ]);
    b.appendChild(chips);

    if (state.ui?.canvas) {
      state.ui.canvas.appendChild(b);
      state.ui.canvas.scrollTop = state.ui.canvas.scrollHeight;
    }
    // timeline marker
    if (type === 'ai-transcript') addTimelineEvent('type', t, text.slice(0, 30));
    emit('block', { id, type, text, timeMs: t });

    // adapter append
    try { adapter().appendBlock && adapter().appendBlock({ type, text, meta: { ...meta, timeMs: t } }); } catch {}

    return id;
  }

  function addTimelineEvent(track, t, label, onClick) {
    state.events.push({ track, t, label });
    const trackEl = state.ui?.tracks?.[track];
    if (!trackEl) return;
    const dur = Math.max(now(), 1);
    const pos = Math.min(1, t / Math.max(dur, 60000));
    const mark = el('div', { class: 'mark', style: `left:${pos*100}%`, title: label });
    mark.onclick = (e) => { e.stopPropagation(); (onClick || (() => jumpTo(t)))(); };
    trackEl.appendChild(mark);
  }

  function onTrackClick(e, track) {
    const rect = track.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const dur = Math.max(now(), 1);
    const t = ratio * dur;
    jumpTo(t);
  }

  function jumpTo(timeMs) {
    // Best-effort: scroll to the block closest to timeMs
    const blk = [...state.blocks].reverse().find(b => b.timeMs <= timeMs);
    if (!blk || !state.ui?.canvas) return;
    const els = state.ui.canvas.querySelectorAll('.jnp-lec-block');
    els.forEach(x => x.style.outline = '');
    const idx = state.blocks.findIndex(b => b.id === blk.id);
    if (els[idx]) {
      els[idx].style.outline = '2px solid #6ea8ff';
      els[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => { els[idx].style.outline = ''; }, 1500);
    }
    toast('⏱️ ' + fmt(timeMs) + ' 로 점프');
  }

  // ==================================================================
  // 7. Tick (타이밍 헤드 갱신 + 오디오 트랙 자동 생성)
  // ==================================================================
  let tickHandle = null;
  function startTick() {
    cancelAnimationFrame(tickHandle);
    const step = () => {
      if (!state.active) return;
      if (state.recording && state.ui) {
        const dur = Math.max(now(), 60000);
        state.ui.timeText.textContent = fmt(now());
        // heads
        for (const k in state.ui.heads) {
          state.ui.heads[k].style.left = Math.min(100, now()/dur*100) + '%';
        }
        // audio segment append (every tick if recording)
        extendAudioSeg(now());
      }
      tickHandle = requestAnimationFrame(step);
    };
    tickHandle = requestAnimationFrame(step);
  }
  let lastSeg = null;
  function extendAudioSeg(t) {
    const trk = state.ui?.tracks?.audio;
    if (!trk) return;
    const dur = Math.max(t, 60000);
    if (!lastSeg) {
      lastSeg = el('div', { class: 'seg', style: `left:0%;width:0%` });
      trk.appendChild(lastSeg);
    }
    lastSeg.style.width = Math.min(100, (t/dur)*100) + '%';
  }

  // ==================================================================
  // 8. Copilot 엔진 (adapter 주입 가능)
  // ==================================================================
  const MOCK_CARDS = [
    { kind: 'ok',   title: '정의 제안 (예시)',   body: '지금까지 등장한 주요 용어를 정리하고 싶다면 이 카드를 채택하세요.',          meta: 'Mock · adapter 없음', cta: ['채택','버림'] },
    { kind: 'kind', title: '이전 수업 연결',    body: '이 개념은 지난 회차 필기와 연결될 가능성이 높습니다. adapter로 LLM 연결 시 실제 연결이 제안됩니다.', meta: 'Mock', cta: ['채택','지난 노트 열기','버림'] },
    { kind: 'warn', title: '용어 확인',        body: '발음이 유사한 영어 용어가 감지되면 한+영 동시 표기로 저장할지 물어봅니다.',     meta: 'Mock', cta: ['한+영','한만','영만'] },
    { kind: 'qz',   title: '예상 시험 문항',    body: '요약 노트가 충분히 쌓이면 예상 시험문항이 카드로 올라옵니다.',                    meta: 'Mock', cta: ['시험지 추가','버림'] },
    { kind: 'ok',   title: '참고자료 추천',    body: 'adapter.getCopilotCards 를 구현하면 OpenAlex/arXiv/PubMed에서 연관 자료를 큐레이션해 줍니다.', meta: 'Mock', cta: ['소스 추가','버림'] },
  ];

  function startCopilot() {
    stopCopilot();
    state.copilotTimer = setInterval(() => maybeTriggerCopilot(), 20000); // 20초 간격
  }
  function stopCopilot() { if (state.copilotTimer) { clearInterval(state.copilotTimer); state.copilotTimer = null; } }

  async function maybeTriggerCopilot() {
    if (!state.active) return;
    // Build context
    const recent = state.blocks.slice(-6).map(b => b.text).join('\n');
    if (recent.length < 30 && state.blocks.length < 2) return;
    const ctx = {
      recentTranscript: recent,
      notes: state.blocks.map(b => ({ text: b.text, timeMs: b.timeMs })),
      subject: state.subject,
      title: state.title,
      language: navigator.language
    };
    let cards = [];
    try {
      if (adapter().getCopilotCards) {
        cards = await adapter().getCopilotCards(ctx) || [];
      } else {
        cards = [MOCK_CARDS[state.copilotCtr % MOCK_CARDS.length]];
        state.copilotCtr++;
      }
    } catch (e) { console.warn('[copilot]', e); return; }
    cards.forEach(c => addCard(c));
  }

  async function askCopilot(seed) {
    const q = prompt('Copilot에게 질문', seed?.slice(0, 120) || '');
    if (!q) return;
    let cards = [];
    try {
      if (adapter().getCopilotCards) {
        cards = await adapter().getCopilotCards({ question: q, notes: state.blocks, subject: state.subject }) || [];
      } else {
        cards = [{ kind: 'ok', title: '답변 (Mock)', body: 'adapter.getCopilotCards 를 구현하면 실제 LLM 응답이 여기에 표시됩니다. 질문: ' + q, meta: 'Mock', cta: ['확인'] }];
      }
    } catch (e) { console.warn(e); }
    cards.forEach(c => addCard(c));
  }

  function addCard(card) {
    state.cards.push(card);
    const t = now();
    addTimelineEvent('ai', t, card.title);

    const root = state.ui?.stream; if (!root) return;
    const kind = card.kind === 'warn' ? 'warn' : card.kind === 'qz' ? 'qz' : card.kind === 'ok' ? 'ok' : '';
    const cardEl = el('div', { class: 'jnp-lec-card' });
    cardEl.appendChild(el('span', { class: 'kind ' + kind }, card.title || 'Copilot'));
    cardEl.appendChild(el('div', { class: 'body' }, card.body || ''));
    if (card.meta) cardEl.appendChild(el('div', { class: 'meta' }, card.meta));
    const row = el('div', { class: 'row' });
    (card.cta || ['채택','버림']).forEach((label, i) => {
      const btn = el('div', { class: 'swipe ' + (i === 0 ? 'adopt' : 'skip') }, label);
      btn.onclick = () => {
        if (i === 0 && card.body) {
          addBlock({ type: 'adopted', text: '★ ' + (card.title ? `[${card.title}] ` : '') + card.body, meta: { from: 'copilot' } });
        }
        cardEl.style.opacity = '0';
        cardEl.style.transform = 'translateX(30px)';
        setTimeout(() => cardEl.remove(), 250);
      };
      row.appendChild(btn);
    });
    cardEl.appendChild(row);
    root.prepend(cardEl);
    while (root.children.length > 10) root.removeChild(root.lastChild);
    emit('card', card);
  }

  // ==================================================================
  // 9. 세션 객체 / 저장 / 내보내기
  // ==================================================================
  function buildSessionObject() {
    return {
      id: uid(),
      version: 1,
      app: 'justanotepad',
      feature: 'lecture',
      createdAt: new Date(state.startedAt).toISOString(),
      durationMs: now(),
      title: state.title || 'Untitled Lecture',
      subject: state.subject || '',
      blocks: state.blocks,
      cards: state.cards,
      events: state.events,
    };
  }

  function exportJson() {
    const s = buildSessionObject();
    downloadBlob(JSON.stringify(s, null, 2), (s.title || 'lecture') + '.json', 'application/json');
    toast('JSON 내보내기 완료');
  }

  function exportMarkdown() {
    const s = buildSessionObject();
    const lines = [];
    lines.push(`# ${s.title || 'Untitled Lecture'}`);
    lines.push('');
    lines.push(`- 과목: ${s.subject || '미지정'}`);
    lines.push(`- 일시: ${s.createdAt}`);
    lines.push(`- 길이: ${fmt(s.durationMs)}`);
    lines.push('');
    lines.push('## 본 노트');
    lines.push('');
    s.blocks.forEach(b => {
      if (b.type === 'system') return;
      const prefix = b.type === 'ai-transcript' ? '🎤' : b.type === 'adopted' ? '★' : b.type === 'summary' ? '📘' : '•';
      lines.push(`${prefix} \`${fmt(b.timeMs)}\` ${b.text}`);
    });
    lines.push('');
    if (s.cards.length) {
      lines.push('## Copilot 제안');
      lines.push('');
      s.cards.forEach(c => {
        lines.push(`- **${c.title}** — ${c.body}`);
      });
    }
    downloadBlob(lines.join('\n'), (s.title || 'lecture') + '.md', 'text/markdown');
    toast('Markdown 내보내기 완료');
  }

  function downloadBlob(data, filename, mime) {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function openSummary() {
    // Build a lightweight summary-on-the-fly
    const outline = state.blocks
      .filter(b => b.type !== 'system')
      .slice(-50)
      .map(b => `• [${fmt(b.timeMs)}] ${b.text}`).join('\n');
    addBlock({ type: 'summary', text: outline || '아직 필기가 충분하지 않습니다.' });
    toast('간이 요약 블록을 추가했습니다');
  }

  function showHelp() {
    addCard({
      kind: 'ok',
      title: '도움말 / 단축키',
      body: '⌘R (수업 시작/종료) · ⌘J (Copilot 포커스) · ⌘. (최신 제안 채택) · ⌘K (Command Palette) · Esc (닫기). 블록은 클릭해서 직접 편집 가능합니다.',
      meta: 'LectureOS v0',
      cta: ['확인']
    });
  }

  // ==================================================================
  // 10. 전역 단축키
  // ==================================================================
  window.addEventListener('keydown', (e) => {
    if (!state.active) return;
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (mod && e.key.toLowerCase() === 'r') { e.preventDefault(); state.recording ? stop() : start(); }
    if (mod && e.key.toLowerCase() === 'j') { e.preventDefault(); document.querySelector('.jnp-lec-overlay .copilot')?.scrollIntoView({ behavior: 'smooth' }); }
    if (mod && e.key === '.') {
      e.preventDefault();
      const btn = state.ui?.stream?.querySelector('.jnp-lec-card .swipe.adopt');
      if (btn) btn.click();
    }
  });

  // ==================================================================
  // 11. Command Palette 자동 등록
  // ==================================================================
  function tryRegisterPalette() {
    const pal = window.justanotepadPalette;
    if (!pal || typeof pal.register !== 'function') return false;
    pal.register({
      id: 'lecture.open',
      title: '강의 모드 열기',
      hint: '실시간 자동 필기 + AI Copilot 강의노트',
      keywords: ['lecture','강의','수업','note','ai','copilot'],
      run: () => open()
    });
    pal.register({
      id: 'lecture.start',
      title: '강의 모드 시작 (녹음)',
      hint: '바로 수업 녹음 + 자동 필기 시작',
      keywords: ['record','녹음','수업시작','lecture start'],
      run: () => { open(); setTimeout(() => start(), 100); }
    });
    pal.register({
      id: 'lecture.export.md',
      title: '현재 수업 Markdown으로 내보내기',
      keywords: ['export','내보내기','markdown','md'],
      run: () => { if (!state.blocks.length) { toast('내보낼 수업이 없습니다'); return; } exportMarkdown(); }
    });
    pal.register({
      id: 'lecture.export.json',
      title: '현재 수업 JSON 저장',
      keywords: ['export','json','세션','backup'],
      run: () => { if (!state.blocks.length) { toast('저장할 수업이 없습니다'); return; } exportJson(); }
    });
    return true;
  }
  if (!tryRegisterPalette()) {
    // 팔레트가 나중에 로드되는 경우 대비
    let tries = 0;
    const iv = setInterval(() => {
      if (tryRegisterPalette() || ++tries > 40) clearInterval(iv);
    }, 250);
  }

  // ==================================================================
  // 12. 전역 API 노출
  // ==================================================================
  window.justanotepadLecture = {
    start, stop, open, close,
    isActive: () => state.active,
    isRecording: () => state.recording,
    addCard, addBlock, addTimelineEvent, askCopilot, exportMarkdown, exportJson,
    getSession: buildSessionObject,
    onEvent: on, off,
    _state: state,
  };

  // ==================================================================
  // 13. 토픽바 버튼 주입 ("🎙️ 강의")
  // ==================================================================
  function injectTopbarButton() {
    if (document.getElementById('lectureTopBtn')) return true;
    // 여러 후보 위치 시도 (calendar / ai / palette 바로 옆)
    const anchor =
      document.getElementById('calOpenBtn') ||
      document.getElementById('aiBtn') ||
      document.getElementById('cardsTopBtn') ||
      document.getElementById('palBtn');
    if (!anchor || !anchor.parentNode) return false;

    const btn = document.createElement('button');
    btn.id = 'lectureTopBtn';
    btn.className = anchor.className || 'collapsible';
    btn.setAttribute('aria-label', '강의 모드 열기');
    btn.setAttribute('title', '강의 모드 · 수업 녹음 + 자동 필기 + AI Copilot (Ctrl+K → 강의)');
    btn.textContent = '🎙️ 강의';
    btn.style.cssText = 'cursor:pointer;';
    btn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      open();
    });
    // calendar 버튼 바로 다음에 삽입 (없으면 palBtn 다음)
    anchor.parentNode.insertBefore(btn, anchor.nextSibling);
    console.info('[lecture-mode] topbar button injected next to #' + anchor.id);
    return true;
  }

  function tryInjectTopbar(attempts = 0) {
    if (injectTopbarButton()) return;
    if (attempts > 60) { console.warn('[lecture-mode] topbar not found after 30s; using palette only'); return; }
    setTimeout(() => tryInjectTopbar(attempts + 1), 500);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => tryInjectTopbar(0), { once: true });
  } else {
    tryInjectTopbar(0);
  }

  // Self-test log (non-invasive)
  if (window?.justanotepadPalette || window?.justanotepadLectureAdapter) {
    console.info('[lecture-mode] ready. window.justanotepadLecture');
  } else {
    console.info('[lecture-mode] ready (standalone). window.justanotepadLecture');
  }
})();
