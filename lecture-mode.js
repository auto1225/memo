/**
 * justanotepad · Lecture Mode (v2.0 · in-tab)
 * --------------------------------------------------------------------------
 * 이전 v1 의 실수:
 *   - 전체화면 오버레이로 분리 → 탭 구조를 무시
 *   - 자체 다크 컬러 팔레트 사용 → 앱 테마(--accent #FAE100 등) 무시
 *   - 이모지 사용 → 앱 전체 컨벤션(인라인 SVG 심볼)과 불일치
 *
 * v2.0 설계:
 *   - 강의 모드는 "현재 활성 탭에 붙는 녹음 세션". 별도 창 없음.
 *   - 확정된 전사 문장은 실제 .page 안에 <p class="jnp-lec-line"> 로 삽입.
 *     → 탭과 함께 저장되고, 펜 필기(pen-surface.js)가 같은 종이 위에
 *       정상 동작하며, 복사·검색·테마가 모두 자연스럽게 따라옴.
 *   - 모든 UI 는 var(--accent)/var(--paper)/var(--ink)/var(--line) 사용.
 *   - 아이콘은 <svg><use href="#i-mic"/></svg> 패턴으로 앱 심볼 재사용.
 *
 * 통합 (이미 app.html 에 스크립트 태그 삽입됨):
 *   <script src="/lecture-mode.js"></script>
 *
 * 전역 API:
 *   window.justanotepadLecture = {
 *     start(), stop(), toggle(), isRecording(),
 *     toggleCopilot(), insertLine(text), insertSummary(md),
 *   }
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.justanotepadLecture && window.justanotepadLecture.__v === 2) return;

  // ================================================================
  // 1) 스타일 — 100% CSS 변수 사용
  // ================================================================
  const CSS = `
  /* 전사 문장 단락 — 실제 .page 안에 삽입됨 */
  .page .jnp-lec-line {
    position: relative;
    margin: 0.35em 0;
    padding-left: 2.2em;
  }
  .page .jnp-lec-line::before {
    content: attr(data-ts);
    position: absolute;
    left: 0; top: 0.1em;
    width: 1.8em; font-size: 0.78em;
    color: var(--ink-soft);
    opacity: 0.55;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .page .jnp-lec-line.interim {
    opacity: 0.55;
    font-style: italic;
  }
  .page .jnp-lec-line.adopted {
    background: linear-gradient(90deg, var(--accent-2) 0, transparent 80%);
    padding-right: 6px; border-radius: 4px;
  }
  .page .jnp-lec-summary {
    border: 1px dashed var(--line);
    background: var(--tab-hover);
    border-radius: 10px;
    padding: 10px 14px;
    margin: 14px 0;
  }
  .page .jnp-lec-summary h4 { margin: 0 0 6px; font-size: 0.95em; }

  /* 좌상단 녹음 상태 pill (pageEl 우하단 고정) */
  .jnp-lec-rec-pill {
    position: fixed;
    right: 20px;
    bottom: 22px;
    z-index: 40;
    background: var(--paper);
    border: 1px solid var(--line);
    box-shadow: 0 4px 14px rgba(0,0,0,0.08);
    border-radius: 999px;
    padding: 8px 14px 8px 10px;
    display: none;
    align-items: center;
    gap: 10px;
    font: 500 13px/1 inherit;
    color: var(--ink);
  }
  .jnp-lec-rec-pill.on { display: inline-flex; }
  .jnp-lec-rec-pill .dot {
    width: 10px; height: 10px; border-radius: 999px;
    background: #e53935;
    box-shadow: 0 0 0 0 rgba(229,57,53,.6);
    animation: jnpLecPulse 1.2s ease-out infinite;
  }
  @keyframes jnpLecPulse {
    0%   { box-shadow: 0 0 0 0 rgba(229,57,53,.6); }
    70%  { box-shadow: 0 0 0 10px rgba(229,57,53,0); }
    100% { box-shadow: 0 0 0 0 rgba(229,57,53,0); }
  }
  .jnp-lec-rec-pill button.ghost {
    background: transparent; border: 0;
    color: var(--ink-soft); cursor: pointer;
    padding: 4px 6px; font: inherit;
    display: inline-flex; align-items: center; gap: 4px;
  }
  .jnp-lec-rec-pill button.ghost:hover { color: var(--ink); }
  .jnp-lec-rec-pill .sep {
    width: 1px; height: 14px; background: var(--line);
  }

  /* Copilot side panel */
  .jnp-lec-copilot {
    position: fixed;
    top: 50px; right: 0; bottom: 0;
    width: 320px; max-width: 80vw;
    background: var(--paper);
    border-left: 1px solid var(--line);
    box-shadow: -6px 0 18px rgba(0,0,0,0.06);
    transform: translateX(100%);
    transition: transform .22s ease;
    display: flex; flex-direction: column;
    z-index: 35;
    color: var(--ink);
  }
  .jnp-lec-copilot.open { transform: none; }
  .jnp-lec-copilot-head {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--line);
    background: var(--tab-hover);
  }
  .jnp-lec-copilot-head .title { font-weight: 700; font-size: 13px; }
  .jnp-lec-copilot-head .spacer { flex: 1; }
  .jnp-lec-copilot-head button {
    background: transparent; border: 0; cursor: pointer;
    color: var(--ink-soft); padding: 4px; border-radius: 4px;
    display: inline-flex; align-items: center;
  }
  .jnp-lec-copilot-head button:hover { color: var(--ink); background: var(--line); }
  .jnp-lec-copilot-body {
    flex: 1; overflow: auto; padding: 10px;
  }
  .jnp-lec-copilot-empty {
    color: var(--ink-soft); font-size: 12px; padding: 24px 8px;
    text-align: center;
  }
  .jnp-lec-card {
    border: 1px solid var(--line);
    background: var(--paper);
    border-radius: 10px;
    padding: 10px 12px;
    margin-bottom: 8px;
    animation: jnpLecRise .3s ease-out;
  }
  @keyframes jnpLecRise {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: none; }
  }
  .jnp-lec-card .kind {
    display: inline-block;
    font-size: 10px; padding: 1px 6px; border-radius: 999px;
    background: var(--accent-2); color: var(--ink);
    font-weight: 700;
    margin-bottom: 4px;
  }
  .jnp-lec-card .title { font-weight: 600; font-size: 13px; margin-bottom: 2px; }
  .jnp-lec-card .body { font-size: 12.5px; color: var(--ink); line-height: 1.5; }
  .jnp-lec-card .meta { font-size: 11px; color: var(--ink-soft); margin-top: 4px; }
  .jnp-lec-card .row { display: flex; gap: 6px; margin-top: 8px; }
  .jnp-lec-card .row button {
    flex: 1; padding: 5px 8px; font: 600 11px/1 inherit;
    border: 1px solid var(--line); background: var(--paper);
    border-radius: 6px; cursor: pointer; color: var(--ink);
  }
  .jnp-lec-card .row button.primary {
    background: var(--accent); border-color: var(--accent);
  }
  .jnp-lec-card .row button:hover { background: var(--tab-hover); }
  .jnp-lec-card .row button.primary:hover { background: var(--accent-2); }

  /* Topbar button: #lectureTopBtn uses app's existing button styling */

  /* Toast */
  .jnp-lec-toast {
    position: fixed;
    top: 56px; left: 50%; transform: translateX(-50%) translateY(-4px);
    background: var(--ink); color: var(--paper);
    padding: 8px 14px; border-radius: 999px;
    font: 500 12.5px/1.3 inherit;
    opacity: 0; transition: opacity .18s, transform .18s;
    z-index: 60;
    pointer-events: none;
  }
  .jnp-lec-toast.show { opacity: 0.94; transform: translateX(-50%) translateY(0); }
  `;
  (function injectStyle() {
    if (document.getElementById('jnp-lecture-style-v2')) return;
    const st = document.createElement('style');
    st.id = 'jnp-lecture-style-v2';
    st.textContent = CSS;
    document.head.appendChild(st);
  })();

  // ================================================================
  // 2) SVG 아이콘 — 앱 심볼 라이브러리 재사용
  // ================================================================
  function svg(id, size = 16) {
    return `<svg class="ico" style="width:${size}px;height:${size}px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round" aria-hidden="true"><use href="#${id}"/></svg>`;
  }

  // ================================================================
  // 3) 상태
  // ================================================================
  const state = {
    recording: false,
    startedAt: 0,
    mediaStream: null,
    mediaRecorder: null,
    speech: null,
    interimEl: null,
    tickHandle: null,
    copilotTimer: null,
    copilotCtr: 0,
    session: null,   // 녹음 중 누적되는 메타
    ui: {
      btn: null, pill: null, pillTime: null,
      copilot: null, copilotBody: null, copilotBtn: null,
    },
  };

  const fmtTime = ms => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  };
  const now = () => state.startedAt ? (Date.now() - state.startedAt) : 0;
  const $ = id => document.getElementById(id);
  const pageEl = () => document.getElementById('page');
  const adapter = () => window.justanotepadLectureAdapter || {};

  // ================================================================
  // 4) 토스트
  // ================================================================
  function toast(text, ms = 1600) {
    const n = document.createElement('div');
    n.className = 'jnp-lec-toast';
    n.textContent = text;
    document.body.appendChild(n);
    requestAnimationFrame(() => n.classList.add('show'));
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 200); }, ms);
  }

  // ================================================================
  // 5) UI — 녹음 pill (우하단 고정) + Copilot 패널 (우측 슬라이드인)
  // ================================================================
  function buildPill() {
    if (state.ui.pill) return state.ui.pill;
    const pill = document.createElement('div');
    pill.className = 'jnp-lec-rec-pill';
    pill.innerHTML = `
      <span class="dot"></span>
      <span>녹음 중</span>
      <span class="sep"></span>
      <span class="time" style="font-variant-numeric:tabular-nums">00:00</span>
      <span class="sep"></span>
      <button class="ghost" data-act="toggle-copilot" title="AI 제안 패널">${svg('i-smile', 14)}<span style="font-size:11px;margin-left:2px;">AI</span></button>
      <button class="ghost" data-act="stop" title="수업 종료">${svg('i-x', 14)}</button>
    `;
    document.body.appendChild(pill);
    pill.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'toggle-copilot') toggleCopilot();
      if (act === 'stop') stop();
    });
    state.ui.pill = pill;
    state.ui.pillTime = pill.querySelector('.time');
    return pill;
  }

  function buildCopilot() {
    if (state.ui.copilot) return state.ui.copilot;
    const el = document.createElement('aside');
    el.className = 'jnp-lec-copilot';
    el.innerHTML = `
      <div class="jnp-lec-copilot-head">
        <div class="title">AI 강의 제안</div>
        <div class="spacer"></div>
        <button data-act="ask" title="직접 질문">${svg('i-help', 16)}</button>
        <button data-act="close" title="닫기">${svg('i-x', 16)}</button>
      </div>
      <div class="jnp-lec-copilot-body">
        <div class="jnp-lec-copilot-empty">
          수업을 시작하면 20초마다<br>정의·연결·예상시험 카드가 올라옵니다.
        </div>
      </div>
    `;
    document.body.appendChild(el);
    el.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'close') toggleCopilot(false);
      if (act === 'ask') askCopilot();
    });
    state.ui.copilot = el;
    state.ui.copilotBody = el.querySelector('.jnp-lec-copilot-body');
    return el;
  }

  function toggleCopilot(force) {
    const el = buildCopilot();
    const want = typeof force === 'boolean' ? force : !el.classList.contains('open');
    el.classList.toggle('open', want);
  }

  // ================================================================
  // 6) 토픽바 버튼 — 기존 #calOpenBtn 옆에 삽입 (앱 버튼 스타일 상속)
  // ================================================================
  function injectTopbarButton() {
    if ($('lectureTopBtn')) return true;
    const anchor = $('calOpenBtn') || $('aiBtn') || $('palBtn');
    if (!anchor || !anchor.parentNode) return false;

    const btn = document.createElement('button');
    btn.id = 'lectureTopBtn';
    btn.className = anchor.className || 'collapsible';
    btn.setAttribute('aria-label', '강의 모드');
    btn.setAttribute('title', '강의 녹음 시작 / 종료');
    btn.innerHTML = svg('i-mic', 18);
    btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggle(); });
    anchor.parentNode.insertBefore(btn, anchor.nextSibling);
    state.ui.btn = btn;
    return true;
  }

  function setBtnState(isRec) {
    const btn = state.ui.btn; if (!btn) return;
    if (isRec) {
      btn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px;color:#e53935">
        <span style="width:8px;height:8px;border-radius:999px;background:#e53935"></span>
        <span style="font:600 12px/1 inherit">REC</span>
      </span>`;
      btn.setAttribute('title', '녹음 종료');
    } else {
      btn.innerHTML = svg('i-mic', 18);
      btn.setAttribute('title', '강의 녹음 시작');
    }
  }

  // ================================================================
  // 7) 전사 문장을 .page 에 실제 단락으로 삽입
  // ================================================================
  function appendLineToPage(text, { interim = false, adopted = false, kind = null } = {}) {
    const page = pageEl();
    if (!page) return null;
    const p = document.createElement('p');
    p.className = 'jnp-lec-line' + (interim ? ' interim' : '') + (adopted ? ' adopted' : '');
    p.setAttribute('data-ts', fmtTime(now()));
    if (kind) p.setAttribute('data-kind', kind);
    p.textContent = text;
    page.appendChild(p);
    // 앱의 저장 트리거
    try { page.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
    // 스크롤을 입력 지점으로
    p.scrollIntoView({ block: 'end', behavior: 'smooth' });
    return p;
  }

  function insertSummary(markdown) {
    const page = pageEl(); if (!page) return;
    const div = document.createElement('div');
    div.className = 'jnp-lec-summary';
    div.innerHTML = `
      <h4>수업 요약 · ${new Date().toLocaleString('ko-KR')}</h4>
      <div>${escapeHtml(markdown).replace(/\n/g, '<br>')}</div>
    `;
    page.appendChild(div);
    try { page.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
  }

  function escapeHtml(s) { return (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // ================================================================
  // 8) 오디오 녹음 + Web Speech 자동 필기
  // ================================================================
  async function startMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.mediaStream = stream;
      if (window.MediaRecorder) {
        const rec = new MediaRecorder(stream);
        rec.ondataavailable = () => {}; // 추후 오디오 파일 저장 시 확장
        rec.start(1000);
        state.mediaRecorder = rec;
      }
      return true;
    } catch (e) {
      toast('마이크 권한이 필요합니다');
      return false;
    }
  }

  function startSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('이 브라우저는 자동 필기 미지원 (Chrome/Edge/Safari 권장)'); return false; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language?.startsWith('en') ? 'en-US' : 'ko-KR';
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = (res[0].transcript || '').trim();
        if (!text) continue;
        if (res.isFinal) {
          if (state.interimEl) { state.interimEl.remove(); state.interimEl = null; }
          const p = appendLineToPage(text, { interim: false });
          state.session?.lines.push({ t: now(), text, el: p });
          maybeTriggerCopilot();
        } else {
          if (!state.interimEl) {
            state.interimEl = appendLineToPage(text, { interim: true });
          } else {
            state.interimEl.textContent = text;
          }
        }
      }
    };
    rec.onerror = (e) => { if (e.error !== 'no-speech' && e.error !== 'audio-capture') console.warn('[speech]', e.error); };
    rec.onend = () => { if (state.recording) { try { rec.start(); } catch {} } };
    try { rec.start(); state.speech = rec; return true; }
    catch (e) { console.warn('[speech] start failed', e); return false; }
  }

  // ================================================================
  // 9) Start / Stop / Toggle
  // ================================================================
  async function start() {
    if (state.recording) return;

    // 탭 없으면 하나 만들어 준다
    if (!pageEl()) { toast('활성 탭을 먼저 열어 주세요'); return; }

    // 개인정보 동의
    if (!localStorage.getItem('jnpLectureConsent')) {
      const ok = confirm(
        '이 기능은 마이크로 수업을 녹음합니다.\n\n' +
        '· 녹음된 오디오는 기본적으로 이 기기에만 저장됩니다.\n' +
        '· Web Speech API 사용 시 음성이 브라우저 제공자(Google/Apple) 서버로\n' +
        '  잠시 전송되어 텍스트로 변환됩니다.\n' +
        '· 타인의 목소리를 녹음할 땐 반드시 동의를 얻으세요.\n\n' +
        '계속하시겠습니까?'
      );
      if (!ok) return;
      localStorage.setItem('jnpLectureConsent', '1');
    }

    // 시작 마커 삽입
    const page = pageEl();
    if (page) {
      const hr = document.createElement('p');
      hr.className = 'jnp-lec-line';
      hr.setAttribute('data-ts', '');
      hr.style.borderTop = '1px dashed var(--line)';
      hr.style.paddingTop = '6px';
      hr.style.marginTop = '14px';
      hr.style.color = 'var(--ink-soft)';
      hr.style.fontSize = '0.85em';
      hr.textContent = `― 강의 시작 · ${new Date().toLocaleString('ko-KR')} ―`;
      page.appendChild(hr);
      try { page.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
    }

    state.recording = true;
    state.startedAt = Date.now();
    state.session = { startedAt: state.startedAt, lines: [], cards: [] };

    buildPill().classList.add('on');
    setBtnState(true);
    startTick();

    await startMic();
    startSpeech();
    startCopilot();
    toast('녹음 시작 · 자유롭게 말씀하세요');
  }

  async function stop() {
    if (!state.recording) return;
    state.recording = false;

    try { state.speech?.stop(); } catch {}
    try { state.mediaRecorder?.state === 'recording' && state.mediaRecorder.stop(); } catch {}
    try { state.mediaStream?.getTracks().forEach(t => t.stop()); } catch {}
    stopCopilot();
    stopTick();

    state.ui.pill?.classList.remove('on');
    setBtnState(false);

    // 종료 마커
    const page = pageEl();
    if (page) {
      const hr = document.createElement('p');
      hr.className = 'jnp-lec-line';
      hr.setAttribute('data-ts', fmtTime(now()));
      hr.style.borderTop = '1px dashed var(--line)';
      hr.style.paddingTop = '6px';
      hr.style.marginTop = '14px';
      hr.style.color = 'var(--ink-soft)';
      hr.style.fontSize = '0.85em';
      hr.textContent = `― 강의 종료 · ${new Date().toLocaleString('ko-KR')} ―`;
      page.appendChild(hr);
      try { page.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
    }

    toast('녹음 종료 · 요약 생성 중');

    // 어댑터 요약 (있으면)
    if (adapter().buildSummary) {
      try {
        const lines = (state.session?.lines || []).map(l => ({ t: l.t, text: l.text }));
        const res = await adapter().buildSummary({ lines, cards: state.session?.cards || [] });
        if (res?.summary) insertSummary(res.summary);
      } catch (e) { console.warn('[adapter.buildSummary]', e); }
    } else {
      // Mock 요약: 긴 문장 top N 을 간이 요약으로
      const lines = state.session?.lines || [];
      if (lines.length >= 3) {
        const top = lines
          .map(l => l.text)
          .filter(t => t && t.length > 12)
          .slice(-6)
          .join('\n· ');
        if (top) insertSummary('· ' + top);
      }
    }
  }

  function toggle() { state.recording ? stop() : start(); }

  // ================================================================
  // 10) Tick — pill 시간 업데이트
  // ================================================================
  function startTick() {
    stopTick();
    const step = () => {
      if (!state.recording) return;
      if (state.ui.pillTime) state.ui.pillTime.textContent = fmtTime(now());
      state.tickHandle = requestAnimationFrame(step);
    };
    state.tickHandle = requestAnimationFrame(step);
  }
  function stopTick() { if (state.tickHandle) cancelAnimationFrame(state.tickHandle); state.tickHandle = null; }

  // ================================================================
  // 11) Copilot — 20초마다 카드 (어댑터 있으면 실제 LLM, 없으면 Mock)
  // ================================================================
  const MOCK_CARDS = [
    { kind: '정의', title: '용어 정리 제안', body: '이 구간의 핵심 용어를 정리해 드릴까요? adapter 를 연결하면 실제 LLM이 정의를 뽑습니다.', meta: 'Mock · adapter 없음', cta: ['채택','지나가기'] },
    { kind: '연결', title: '이전 수업 연결', body: '이 개념은 지난 회차 노트와 연결될 가능성이 높습니다.', meta: 'Mock', cta: ['이 수업 요약에 포함','지나가기'] },
    { kind: '퀴즈', title: '예상 시험 문항', body: '조금 더 필기가 쌓이면 예상 시험문항이 카드로 올라옵니다.', meta: 'Mock', cta: ['시험지에 추가','지나가기'] },
    { kind: '자료', title: '참고자료 제안', body: '관련된 논문·교재 추천은 adapter.getCopilotCards 가 호출될 때 활성화됩니다.', meta: 'Mock', cta: ['지나가기'] },
  ];

  function startCopilot() {
    stopCopilot();
    state.copilotTimer = setInterval(maybeTriggerCopilot, 20000);
  }
  function stopCopilot() { if (state.copilotTimer) { clearInterval(state.copilotTimer); state.copilotTimer = null; } }

  async function maybeTriggerCopilot() {
    if (!state.recording) return;
    const recent = (state.session?.lines || []).slice(-6).map(l => l.text).join('\n');
    if (recent.length < 30 && (state.session?.lines.length || 0) < 2) return;
    let cards = [];
    try {
      if (adapter().getCopilotCards) {
        cards = await adapter().getCopilotCards({ recentTranscript: recent, notes: state.session?.lines || [] }) || [];
      } else {
        cards = [MOCK_CARDS[state.copilotCtr % MOCK_CARDS.length]];
        state.copilotCtr++;
      }
    } catch (e) { console.warn('[copilot]', e); return; }
    cards.forEach(renderCard);
  }

  async function askCopilot() {
    const q = prompt('AI 에게 질문 (예: 지금까지 내용 요약)');
    if (!q) return;
    if (adapter().getCopilotCards) {
      try {
        const cards = await adapter().getCopilotCards({
          question: q,
          recentTranscript: (state.session?.lines || []).slice(-12).map(l => l.text).join('\n')
        }) || [];
        cards.forEach(renderCard);
      } catch (e) { console.warn(e); }
    } else {
      renderCard({ kind: '답변', title: 'Mock', body: '질문: ' + q + '\n(adapter 를 연결하면 실제 LLM 응답이 여기에 표시됩니다.)', meta: 'Mock', cta: ['지나가기'] });
    }
  }

  function renderCard(card) {
    const root = state.ui.copilotBody;
    if (!root) buildCopilot();
    const empty = state.ui.copilotBody?.querySelector('.jnp-lec-copilot-empty');
    if (empty) empty.remove();

    const el = document.createElement('div');
    el.className = 'jnp-lec-card';
    el.innerHTML = `
      <span class="kind">${escapeHtml(card.kind || 'AI')}</span>
      <div class="title">${escapeHtml(card.title || '')}</div>
      <div class="body">${escapeHtml(card.body || '')}</div>
      ${card.meta ? `<div class="meta">${escapeHtml(card.meta)}</div>` : ''}
      <div class="row"></div>
    `;
    const row = el.querySelector('.row');
    const ctas = card.cta || ['채택', '지나가기'];
    ctas.forEach((label, i) => {
      const b = document.createElement('button');
      b.textContent = label;
      if (i === 0) b.className = 'primary';
      b.addEventListener('click', () => {
        if (i === 0 && card.body) {
          // 첫 번째 버튼은 "채택" → 실제 페이지에 삽입
          const line = appendLineToPage(`${card.title ? `[${card.title}] ` : ''}${card.body}`, { adopted: true, kind: card.kind });
          state.session?.lines.push({ t: now(), text: card.body, el: line, adopted: true });
        }
        el.style.opacity = 0;
        setTimeout(() => el.remove(), 180);
      });
      row.appendChild(b);
    });
    state.ui.copilotBody.prepend(el);
    state.session?.cards.push(card);

    // 카드 생기면 살짝 반짝
    if (!state.ui.copilot.classList.contains('open')) {
      // 패널 닫혀 있으면 pill 에 살짝 힌트
      const aiBtn = state.ui.pill?.querySelector('[data-act="toggle-copilot"]');
      if (aiBtn) {
        aiBtn.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.2)' }, { transform: 'scale(1)' }], { duration: 400 });
      }
    }
  }

  // ================================================================
  // 12) Command Palette 등록
  // ================================================================
  function tryRegisterPalette() {
    const pal = window.justanotepadPalette;
    if (!pal || typeof pal.register !== 'function') return false;
    pal.register({
      id: 'lecture.toggle',
      title: '강의 녹음 시작 / 종료',
      hint: '현재 탭에 자동 필기와 AI Copilot 을 붙입니다',
      keywords: ['강의','수업','lecture','녹음','recording','ai','copilot'],
      run: () => toggle()
    });
    pal.register({
      id: 'lecture.copilot',
      title: '강의 · AI 제안 패널 열기/닫기',
      keywords: ['copilot','제안','ai','강의'],
      run: () => toggleCopilot()
    });
    pal.register({
      id: 'lecture.ask',
      title: '강의 AI 에 질문',
      keywords: ['질문','물어보기','ai','강의'],
      run: () => askCopilot()
    });
    return true;
  }

  // ================================================================
  // 13) 부팅
  // ================================================================
  function boot() {
    injectTopbarButton() || setTimeout(boot, 400);
    tryRegisterPalette() || setTimeout(tryRegisterPalette, 600);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // ================================================================
  // 14) 단축키
  // ================================================================
  window.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    const shift = e.shiftKey;
    if (mod && shift && e.key.toLowerCase() === 'r') {
      e.preventDefault(); toggle();
    }
  });

  // ================================================================
  // 15) 전역 API
  // ================================================================
  window.justanotepadLecture = {
    __v: 2,
    start, stop, toggle,
    isRecording: () => state.recording,
    toggleCopilot,
    insertLine: (text) => appendLineToPage(text, { adopted: true }),
    insertSummary,
    _state: state,
  };

  console.info('[lecture-mode] v2.0 ready · in-tab · uses var(--accent) and #i-mic svg');
})();
