/**
 * JustANotepad — 노트 필기 오버레이 (Note Handwriting Overlay)
 * ============================================================
 * 노트 화면 위에 투명 캔버스를 덮어 실제 "노트 필기" 경험을 제공한다.
 * 기존 #paintModal (전문 그림판) 은 그대로 유지되고, 이 모듈은 별도 모드.
 *
 * 주요 기능:
 *   - 투명 오버레이 캔버스 (노트가 그대로 뒤로 보임)
 *   - pointerevents 기반 stroke + SVG path 누적
 *   - 필압 (pressure) 반영 + 속도 기반 두께 미세 변조
 *   - 팜 리젝션 (stylus/pen 우선, touch 는 무시)
 *   - 상단/하단 플로팅 툴바 (펜/지우개·색·굵기·Undo/Redo / 사운드·AI·도형·저장·취소)
 *   - 연필 "쓱쓱" 소리 (Web Audio 합성, ON/OFF 토글)
 *   - ESC / 취소 / 저장 → SVG 를 노트 커서 위치에 삽입
 *   - AI 텍스트 변환 (기존 runOCR 재활용)
 *   - 도형 정돈 (원 / 직사각형 / 직선 회귀)
 *
 * 공개 API: window.JANHandwriting
 *   .open() .close() .save() .isOpen()
 *   .toggleSound() .setColor(c) .setTool(t) .setThickness(n)
 *   .undo() .redo()
 *
 * 규칙: 이모지 0 개. 라인아트 SVG 아이콘만 사용.
 */
(function () {
  'use strict';
  if (window.JANHandwriting && window.JANHandwriting.__installed) return;

  // ============================================================
  // 0. 상태
  // ============================================================
  const S = {
    open: false,
    tool: 'pen',           // 'pen' | 'eraser'
    color: '#222222',
    thickness: 3,
    strokes: [],           // 완료된 stroke 배열
    redo: [],              // redo 스택
    current: null,         // 그리는 중 stroke
    soundOn: (function () {
      try { return localStorage.getItem('jan.handwriting.sound') !== '0'; }
      catch { return true; }
    })(),
    stylusDetected: false, // 한 번이라도 pen 이 감지됐으면 touch 팜 리젝션 활성
    svgNS: 'http://www.w3.org/2000/svg',
  };

  const QUICK_COLORS = [
    { name: '검정', v: '#222222' },
    { name: '빨강', v: '#e53935' },
    { name: '파랑', v: '#1e88e5' },
    { name: '초록', v: '#43a047' },
    { name: '주황', v: '#fb8c00' },
  ];

  // ============================================================
  // 1. 연필 사운드 (Web Audio)
  // ============================================================
  const Sfx = (function () {
    let ctx = null, noiseBuf = null;
    let active = null;   // {src, filter, gain}
    let lastUpdateAt = 0;

    function initCtx() {
      if (ctx) return ctx;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      } catch { return null; }
      // 1초짜리 화이트 노이즈 버퍼
      const len = Math.floor(ctx.sampleRate * 1.0);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return ctx;
    }

    async function resumeIfNeeded() {
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch {}
      }
    }

    function start(speed, pressure) {
      if (!S.soundOn) return;
      if (!initCtx()) return;
      resumeIfNeeded();
      stop();   // 혹시 남아있던 게 있으면 정리
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2400 + speed * 900;
      filter.Q.value = 1.3;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const target = Math.min(0.14, 0.05 + speed * 0.05 + pressure * 0.04);
      gain.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.03);
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      try { src.start(); } catch {}
      active = { src, filter, gain };
      lastUpdateAt = performance.now();
    }

    function update(speed, pressure) {
      if (!active || !ctx) return;
      // 너무 자주 스케쥴링하면 audio glitch 가 생기므로 ~25ms 간격으로만
      const now = performance.now();
      if (now - lastUpdateAt < 25) return;
      lastUpdateAt = now;
      const t = ctx.currentTime;
      try {
        active.filter.frequency.cancelScheduledValues(t);
        active.filter.frequency.linearRampToValueAtTime(
          2400 + speed * 900, t + 0.05);
        const target = Math.min(0.15, 0.04 + speed * 0.06 + pressure * 0.05);
        active.gain.gain.cancelScheduledValues(t);
        active.gain.gain.linearRampToValueAtTime(target, t + 0.05);
      } catch {}
    }

    function stop() {
      if (!active || !ctx) return;
      const { src, gain } = active;
      const t = ctx.currentTime;
      try {
        gain.gain.cancelScheduledValues(t);
        gain.gain.linearRampToValueAtTime(0, t + 0.08);
      } catch {}
      setTimeout(() => { try { src.stop(); } catch {} }, 120);
      active = null;
    }

    return { start, update, stop, resumeIfNeeded };
  })();

  // ============================================================
  // 2. DOM / 스타일
  // ============================================================
  const CSS = `
    .jan-hw-overlay {
      position: fixed; inset: 0; z-index: 2147483000;
      display: none;
    }
    .jan-hw-overlay.open { display: block; }
    .jan-hw-canvas {
      position: absolute; inset: 0; width: 100%; height: 100%;
      background: transparent;
      touch-action: none;
      cursor: crosshair;
    }
    .jan-hw-canvas.eraser {
      cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="%23555" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H9l-7-7 9-9 11 11-2 5z"/><path d="M14 4l6 6"/></svg>') 4 18, crosshair;
    }
    .jan-hw-toolbar {
      position: fixed; left: 50%; transform: translateX(-50%);
      z-index: 2147483010;
      background: rgba(255,255,255,0.88);
      backdrop-filter: saturate(1.6) blur(10px);
      -webkit-backdrop-filter: saturate(1.6) blur(10px);
      border: 1px solid rgba(255,182,193,0.5);
      border-radius: 14px;
      box-shadow: 0 6px 24px rgba(0,0,0,0.12);
      padding: 8px 10px;
      display: flex; align-items: center; gap: 6px;
      font: 500 13px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", Roboto, sans-serif;
      color: #333;
    }
    .jan-hw-toolbar.top { top: 60px; }
    .jan-hw-toolbar.bottom { bottom: 24px; }
    .jan-hw-toolbar button {
      appearance: none; background: transparent; border: 1px solid transparent;
      padding: 6px 8px; border-radius: 8px; cursor: pointer;
      color: #333; font: inherit; display: inline-flex; align-items: center; gap: 4px;
    }
    .jan-hw-toolbar button:hover { background: rgba(255,182,193,0.18); border-color: rgba(255,182,193,0.35); }
    .jan-hw-toolbar button.active { background: #ffd7e0; border-color: #ffb6c1; color: #c2185b; }
    .jan-hw-toolbar button svg { width: 16px; height: 16px; }
    .jan-hw-toolbar .sep { width: 1px; height: 20px; background: rgba(0,0,0,0.12); margin: 0 4px; }
    .jan-hw-toolbar .swatch {
      width: 20px; height: 20px; border-radius: 50%; cursor: pointer;
      border: 2px solid rgba(255,255,255,0.8);
      box-shadow: 0 0 0 1px rgba(0,0,0,0.1);
      padding: 0;
    }
    .jan-hw-toolbar .swatch.active { box-shadow: 0 0 0 2px #c2185b; }
    .jan-hw-toolbar input[type=range] { width: 90px; accent-color: #e91e63; }
    .jan-hw-toolbar .thick-label { font-size: 11px; color: #777; min-width: 22px; text-align: right; }
    .jan-hw-toolbar .primary {
      background: linear-gradient(180deg, #ffb6c1, #ff8aa0);
      color: #fff; border-color: #ff8aa0; padding: 6px 14px; font-weight: 700;
    }
    .jan-hw-toolbar .primary:hover { background: linear-gradient(180deg, #ffa5b3, #f57a90); color: #fff; }
    .jan-hw-toolbar .ghost { color: #555; }
    .jan-hw-toolbar .ghost:hover { background: rgba(0,0,0,0.06); }
    .jan-hw-toolbar .custom-color-wrap {
      position: relative; width: 20px; height: 20px; border-radius: 50%;
      overflow: hidden; border: 2px dashed #bbb;
    }
    .jan-hw-toolbar .custom-color-wrap input[type=color] {
      position: absolute; inset: -4px; width: calc(100% + 8px); height: calc(100% + 8px);
      border: 0; padding: 0; background: transparent; cursor: pointer;
    }
    /* 삽입된 손글씨 SVG — 드래그·리사이즈 가능 */
    .jan-handwriting-ink {
      display: inline-block; max-width: 100%; height: auto;
      vertical-align: middle; cursor: grab;
    }
    /* 모바일 */
    @media (max-width: 600px) {
      .jan-hw-toolbar { padding: 6px 8px; gap: 4px; flex-wrap: wrap; max-width: 96vw; }
      .jan-hw-toolbar input[type=range] { width: 70px; }
    }
  `;
  const styleEl = document.createElement('style');
  styleEl.setAttribute('data-jan-handwriting', '');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  // 아이콘 (인라인 SVG, 이모지 금지)
  const I = {
    pen:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/></svg>',
    eraser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H9l-7-7 9-9 11 11-2 5z"/><path d="M14 4l6 6"/></svg>',
    undo:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></svg>',
    redo:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/></svg>',
    soundOn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
    soundOff:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
    sparkles:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M19 16l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>',
    shape:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="4"/><rect x="13" y="13" width="8" height="8"/></svg>',
    check:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    close:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  };

  let overlayEl, canvasEl, ctx2d, topBar, bottomBar;
  let thickSlider, thickLabel, penBtn, eraserBtn, undoBtn, redoBtn, soundBtn;
  let swatchEls = [];

  function buildUI() {
    if (overlayEl) return;

    overlayEl = document.createElement('div');
    overlayEl.className = 'jan-hw-overlay';

    canvasEl = document.createElement('canvas');
    canvasEl.className = 'jan-hw-canvas';
    canvasEl.tabIndex = 0;   // 포커스 받을 수 있도록
    overlayEl.appendChild(canvasEl);

    // 상단 툴바
    topBar = document.createElement('div');
    topBar.className = 'jan-hw-toolbar top';
    topBar.setAttribute('role', 'toolbar');

    penBtn = mkBtn(I.pen, '펜');
    penBtn.addEventListener('click', () => setTool('pen'));
    eraserBtn = mkBtn(I.eraser, '지우개');
    eraserBtn.addEventListener('click', () => setTool('eraser'));

    topBar.appendChild(penBtn);
    topBar.appendChild(eraserBtn);
    topBar.appendChild(mkSep());

    swatchEls = [];
    QUICK_COLORS.forEach(c => {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.style.background = c.v;
      b.title = c.name;
      b.addEventListener('click', () => setColor(c.v));
      swatchEls.push({ el: b, value: c.v });
      topBar.appendChild(b);
    });
    // 커스텀 color
    const cwrap = document.createElement('div');
    cwrap.className = 'custom-color-wrap';
    cwrap.title = '색상 직접 선택';
    const cinput = document.createElement('input');
    cinput.type = 'color';
    cinput.value = S.color;
    cinput.addEventListener('input', e => setColor(e.target.value));
    cwrap.appendChild(cinput);
    topBar.appendChild(cwrap);

    topBar.appendChild(mkSep());

    // 두께 슬라이더
    thickSlider = document.createElement('input');
    thickSlider.type = 'range';
    thickSlider.min = '1'; thickSlider.max = '12'; thickSlider.value = String(S.thickness);
    thickSlider.title = '굵기';
    thickSlider.addEventListener('input', e => setThickness(parseInt(e.target.value, 10) || 3));
    thickLabel = document.createElement('span');
    thickLabel.className = 'thick-label';
    thickLabel.textContent = String(S.thickness);
    topBar.appendChild(thickSlider);
    topBar.appendChild(thickLabel);

    topBar.appendChild(mkSep());

    undoBtn = mkBtn(I.undo, '되돌리기 (Ctrl+Z)');
    undoBtn.addEventListener('click', undo);
    redoBtn = mkBtn(I.redo, '다시실행 (Ctrl+Y)');
    redoBtn.addEventListener('click', redo);
    topBar.appendChild(undoBtn);
    topBar.appendChild(redoBtn);

    overlayEl.appendChild(topBar);

    // 하단 툴바
    bottomBar = document.createElement('div');
    bottomBar.className = 'jan-hw-toolbar bottom';

    soundBtn = mkBtn(S.soundOn ? I.soundOn : I.soundOff, '연필 소리 토글');
    soundBtn.addEventListener('click', toggleSound);
    bottomBar.appendChild(soundBtn);

    const aiBtn = mkBtn(I.sparkles + '<span style="margin-left:4px;">AI 텍스트 변환</span>', 'AI로 손글씨를 텍스트로 변환');
    aiBtn.addEventListener('click', runAiOcr);
    bottomBar.appendChild(aiBtn);

    const shapeBtn = mkBtn(I.shape + '<span style="margin-left:4px;">도형 정돈</span>', '원·직사각형·직선으로 정돈');
    shapeBtn.addEventListener('click', tidyShapes);
    bottomBar.appendChild(shapeBtn);

    bottomBar.appendChild(mkSep());

    const saveBtn = mkBtn(I.check + '<span style="margin-left:4px;">저장하고 끝내기</span>', '');
    saveBtn.className = 'primary';
    saveBtn.addEventListener('click', save);
    bottomBar.appendChild(saveBtn);

    const cancelBtn = mkBtn(I.close + '<span style="margin-left:4px;">취소</span>', '');
    cancelBtn.className = 'ghost';
    cancelBtn.addEventListener('click', close);
    bottomBar.appendChild(cancelBtn);

    overlayEl.appendChild(bottomBar);

    document.body.appendChild(overlayEl);

    // Pointer events
    canvasEl.addEventListener('pointerdown', onPointerDown);
    canvasEl.addEventListener('pointermove', onPointerMove);
    canvasEl.addEventListener('pointerup', onPointerUp);
    canvasEl.addEventListener('pointercancel', onPointerUp);
    canvasEl.addEventListener('pointerleave', onPointerUp);
    // Canvas 자체에도 keydown — 캔버스에 포커스가 있을 때 최우선 처리
    canvasEl.addEventListener('keydown', onKeyDown);

    refreshToolbar();
  }

  function mkBtn(innerHTML, title) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = innerHTML;
    if (title) b.title = title;
    return b;
  }
  function mkSep() { const s = document.createElement('span'); s.className = 'sep'; return s; }

  function refreshToolbar() {
    if (!penBtn) return;
    penBtn.classList.toggle('active', S.tool === 'pen');
    eraserBtn.classList.toggle('active', S.tool === 'eraser');
    swatchEls.forEach(s => s.el.classList.toggle('active', s.value.toLowerCase() === S.color.toLowerCase()));
    thickSlider.value = String(S.thickness);
    thickLabel.textContent = String(S.thickness);
    if (soundBtn) soundBtn.innerHTML = S.soundOn ? I.soundOn : I.soundOff;
    canvasEl.classList.toggle('eraser', S.tool === 'eraser');
  }

  // ============================================================
  // 3. 캔버스 사이즈 / 렌더
  // ============================================================
  function resizeCanvas() {
    if (!canvasEl) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvasEl.width = Math.max(1, Math.floor(w * dpr));
    canvasEl.height = Math.max(1, Math.floor(h * dpr));
    canvasEl.style.width = w + 'px';
    canvasEl.style.height = h + 'px';
    ctx2d = canvasEl.getContext('2d');
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2d.lineCap = 'round';
    ctx2d.lineJoin = 'round';
    redrawAll();
  }

  function redrawAll() {
    if (!ctx2d) return;
    const w = canvasEl.clientWidth, h = canvasEl.clientHeight;
    ctx2d.clearRect(0, 0, w, h);
    for (const st of S.strokes) drawStroke(st);
    if (S.current) drawStroke(S.current);
  }

  function drawStroke(st) {
    if (!ctx2d || !st.points.length) return;
    if (st.kind === 'shape-circle') {
      ctx2d.save();
      ctx2d.strokeStyle = st.color;
      ctx2d.lineWidth = st.thickness;
      ctx2d.beginPath();
      ctx2d.ellipse(st.cx, st.cy, st.rx, st.ry, 0, 0, Math.PI * 2);
      ctx2d.stroke();
      ctx2d.restore();
      return;
    }
    if (st.kind === 'shape-rect') {
      ctx2d.save();
      ctx2d.strokeStyle = st.color;
      ctx2d.lineWidth = st.thickness;
      ctx2d.strokeRect(st.x, st.y, st.w, st.h);
      ctx2d.restore();
      return;
    }
    if (st.kind === 'shape-line') {
      ctx2d.save();
      ctx2d.strokeStyle = st.color;
      ctx2d.lineWidth = st.thickness;
      ctx2d.beginPath();
      ctx2d.moveTo(st.x1, st.y1);
      ctx2d.lineTo(st.x2, st.y2);
      ctx2d.stroke();
      ctx2d.restore();
      return;
    }

    const pts = st.points;
    ctx2d.save();
    if (st.erase) {
      ctx2d.globalCompositeOperation = 'destination-out';
      ctx2d.strokeStyle = '#000';
    } else {
      ctx2d.globalCompositeOperation = 'source-over';
      ctx2d.strokeStyle = st.color;
    }
    ctx2d.lineCap = 'round'; ctx2d.lineJoin = 'round';
    // 점이 하나면 점 찍기
    if (pts.length === 1) {
      const p = pts[0];
      ctx2d.fillStyle = ctx2d.strokeStyle;
      ctx2d.beginPath();
      ctx2d.arc(p.x, p.y, Math.max(0.8, p.w / 2), 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.restore();
      return;
    }
    // 세그먼트별로 두께 다르게 — 필압/속도 반영
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      ctx2d.lineWidth = (a.w + b.w) / 2;
      ctx2d.beginPath();
      ctx2d.moveTo(a.x, a.y);
      // Quadratic smoothing: 중간점을 control 로 사용
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      ctx2d.quadraticCurveTo(a.x, a.y, mx, my);
      ctx2d.lineTo(b.x, b.y);
      ctx2d.stroke();
    }
    ctx2d.restore();
  }

  // ============================================================
  // 4. Pointer 핸들링
  // ============================================================
  function shouldIgnorePointer(e) {
    // 팜 리젝션: stylus 한 번이라도 감지됐으면 touch 무시
    if (e.pointerType === 'pen') { S.stylusDetected = true; return false; }
    if (e.pointerType === 'touch' && S.stylusDetected) return true;
    return false;
  }

  function baseThickness(pressure) {
    // pressure 0~1. pen 이 아니면 보통 0.5 (브라우저 기본) 이므로 pen 일 때만 진짜 반영
    const p = (pressure && pressure > 0) ? pressure : 0.5;
    return Math.max(0.5, S.thickness * (0.5 + p * 1.0));   // 0.5x~1.5x
  }

  function onPointerDown(e) {
    if (shouldIgnorePointer(e)) return;
    e.preventDefault();
    try { canvasEl.setPointerCapture(e.pointerId); } catch {}
    Sfx.resumeIfNeeded();
    const pos = getPos(e);
    const pressure = e.pressure || 0.5;
    S.current = {
      points: [{ x: pos.x, y: pos.y, w: baseThickness(pressure), t: performance.now() }],
      color: S.color,
      thickness: S.thickness,
      erase: S.tool === 'eraser',
      kind: 'freehand',
    };
    if (!S.current.erase && S.soundOn) Sfx.start(0.3, pressure);
    redrawAll();
  }

  function onPointerMove(e) {
    if (!S.current) return;
    if (shouldIgnorePointer(e)) return;
    e.preventDefault();
    const pos = getPos(e);
    const pts = S.current.points;
    const prev = pts[pts.length - 1];
    const dx = pos.x - prev.x, dy = pos.y - prev.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.7) return;   // 노이즈 컷
    const now = performance.now();
    const dt = Math.max(1, now - prev.t);
    const speed = dist / dt;  // px/ms

    // 속도 기반 굵기 미세 조정 — 느리면 굵게, 빠르면 얇게 (0.8~1.2배)
    const speedMul = Math.max(0.8, Math.min(1.2, 1.1 - speed * 0.12));
    const pressure = e.pressure || 0.5;
    const baseW = baseThickness(pressure) * speedMul;

    pts.push({ x: pos.x, y: pos.y, w: baseW, t: now });
    if (!S.current.erase) Sfx.update(Math.min(1, speed), pressure);
    redrawAll();
  }

  function onPointerUp(e) {
    if (!S.current) { Sfx.stop(); return; }
    try { canvasEl.releasePointerCapture(e.pointerId); } catch {}
    // 점 1개만 있었으면 (탭) 그대로 keep
    S.strokes.push(S.current);
    S.current = null;
    S.redo = [];
    Sfx.stop();
    redrawAll();
  }

  function getPos(e) {
    const r = canvasEl.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // ============================================================
  // 5. Undo / Redo / 세터
  // ============================================================
  function undo() {
    if (!S.strokes.length) return;
    S.redo.push(S.strokes.pop());
    redrawAll();
  }
  function redo() {
    if (!S.redo.length) return;
    S.strokes.push(S.redo.pop());
    redrawAll();
  }
  function setTool(t) { S.tool = t; refreshToolbar(); }
  function setColor(c) { S.color = c; refreshToolbar(); }
  function setThickness(n) { S.thickness = Math.max(1, Math.min(12, n | 0)); refreshToolbar(); }
  function toggleSound() {
    S.soundOn = !S.soundOn;
    try { localStorage.setItem('jan.handwriting.sound', S.soundOn ? '1' : '0'); } catch {}
    refreshToolbar();
    if (!S.soundOn) Sfx.stop();
    if (typeof window.toast === 'function') window.toast(S.soundOn ? '연필 소리 ON' : '연필 소리 OFF');
  }

  // ============================================================
  // 6. 도형 정돈 (회귀 분석)
  // ============================================================
  function tidyShapes() {
    if (!S.strokes.length) {
      if (typeof window.toast === 'function') window.toast('정돈할 획이 없습니다');
      return;
    }
    let changed = 0;
    const out = [];
    for (const st of S.strokes) {
      if (st.kind !== 'freehand' || st.erase || st.points.length < 4) {
        out.push(st); continue;
      }
      const tidy = tidyOne(st);
      if (tidy) { out.push(tidy); changed++; }
      else out.push(st);
    }
    S.strokes = out;
    S.redo = [];
    redrawAll();
    if (typeof window.toast === 'function')
      window.toast(changed ? `${changed}개 획을 정돈했습니다` : '정돈할 형태가 감지되지 않았습니다');
  }

  function tidyOne(st) {
    const pts = st.points;
    const n = pts.length;
    const p0 = pts[0], pn = pts[n - 1];
    const closeDist = Math.hypot(p0.x - pn.x, p0.y - pn.y);

    // 바운딩
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    const w = maxX - minX, h = maxY - minY;
    const diag = Math.hypot(w, h);
    if (diag < 6) return null;

    // 1. 직선 — 모든 점이 회귀직선에 가까우면
    const line = fitLine(pts);
    if (line && line.avgErr < diag * 0.02) {
      return {
        kind: 'shape-line',
        x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2,
        color: st.color, thickness: st.thickness, points: [],
      };
    }

    // 2. 원 — 시작/끝이 가깝고, 점들이 대략 같은 반지름
    if (closeDist < diag * 0.2) {
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      const rx = w / 2, ry = h / 2;
      // 원/타원 피팅 — 점들이 (cx,cy) 로부터 rx,ry 타원 위에 있는지
      let err = 0;
      for (const p of pts) {
        const dx = (p.x - cx) / rx, dy = (p.y - cy) / ry;
        const d = Math.abs(Math.sqrt(dx * dx + dy * dy) - 1);
        err += d;
      }
      err /= n;
      if (err < 0.22) {
        return {
          kind: 'shape-circle',
          cx, cy, rx, ry,
          color: st.color, thickness: st.thickness, points: [],
        };
      }
    }

    // 3. 직사각형 — 점들이 4 변 중 하나에 붙어있는지
    if (w > 10 && h > 10) {
      let onEdge = 0;
      const tol = Math.max(diag * 0.06, 6);
      for (const p of pts) {
        const dTop = Math.abs(p.y - minY), dBot = Math.abs(p.y - maxY);
        const dLft = Math.abs(p.x - minX), dRgt = Math.abs(p.x - maxX);
        if (Math.min(dTop, dBot, dLft, dRgt) < tol) onEdge++;
      }
      if (onEdge / n > 0.78) {
        return {
          kind: 'shape-rect',
          x: minX, y: minY, w, h,
          color: st.color, thickness: st.thickness, points: [],
        };
      }
    }
    return null;
  }

  function fitLine(pts) {
    const n = pts.length;
    if (n < 2) return null;
    let sx = 0, sy = 0;
    for (const p of pts) { sx += p.x; sy += p.y; }
    const mx = sx / n, my = sy / n;
    let sxx = 0, sxy = 0, syy = 0;
    for (const p of pts) {
      const dx = p.x - mx, dy = p.y - my;
      sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
    }
    // 주성분 방향
    const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const vx = Math.cos(theta), vy = Math.sin(theta);
    // 선에 각 점의 거리 평균
    let err = 0;
    let tmin = Infinity, tmax = -Infinity;
    for (const p of pts) {
      const dx = p.x - mx, dy = p.y - my;
      const t = dx * vx + dy * vy;            // 선 위로의 투영
      const perp = dx * (-vy) + dy * vx;      // 수직 거리
      err += Math.abs(perp);
      if (t < tmin) tmin = t;
      if (t > tmax) tmax = t;
    }
    err /= n;
    return {
      x1: mx + vx * tmin, y1: my + vy * tmin,
      x2: mx + vx * tmax, y2: my + vy * tmax,
      avgErr: err,
    };
  }

  // ============================================================
  // 7. AI OCR (기존 runOCR 재활용)
  // ============================================================
  async function runAiOcr() {
    if (!S.strokes.length) {
      if (typeof window.toast === 'function') window.toast('변환할 필기가 없습니다');
      return;
    }
    // 바운딩 박스 기반으로 off-screen canvas 렌더 → dataURL
    const bbox = strokesBBox(S.strokes, 20);
    if (!bbox) return;
    const oc = document.createElement('canvas');
    const pad = 20;
    oc.width = Math.ceil(bbox.w + pad * 2);
    oc.height = Math.ceil(bbox.h + pad * 2);
    const octx = oc.getContext('2d');
    octx.fillStyle = 'white';
    octx.fillRect(0, 0, oc.width, oc.height);
    octx.translate(-bbox.x + pad, -bbox.y + pad);
    octx.lineCap = 'round'; octx.lineJoin = 'round';
    // 저장용으로 렌더 (지우개는 투명이 아닌 흰색으로)
    const prevCtx = ctx2d; ctx2d = octx;
    for (const st of S.strokes) {
      if (st.erase) continue;
      drawStroke(st);
    }
    ctx2d = prevCtx;
    const dataUrl = oc.toDataURL('image/png');
    // 기존 runOCR 호출
    if (typeof window.runOCR === 'function') {
      window.runOCR(dataUrl, 'text', true);
    } else if (typeof runOCR === 'function') {
      // eslint-disable-next-line no-undef
      runOCR(dataUrl, 'text', true);
    } else {
      if (typeof window.toast === 'function') window.toast('AI OCR 기능을 찾을 수 없습니다');
    }
  }

  function strokesBBox(strokes, pad = 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, any = false;
    const visit = (x, y) => { any = true; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; };
    for (const st of strokes) {
      if (st.kind === 'shape-circle') {
        visit(st.cx - st.rx, st.cy - st.ry); visit(st.cx + st.rx, st.cy + st.ry);
      } else if (st.kind === 'shape-rect') {
        visit(st.x, st.y); visit(st.x + st.w, st.y + st.h);
      } else if (st.kind === 'shape-line') {
        visit(st.x1, st.y1); visit(st.x2, st.y2);
      } else {
        for (const p of (st.points || [])) visit(p.x, p.y);
      }
    }
    if (!any) return null;
    return {
      x: minX - pad, y: minY - pad,
      w: (maxX - minX) + pad * 2, h: (maxY - minY) + pad * 2,
    };
  }

  // ============================================================
  // 8. Save → SVG 삽입
  // ============================================================
  function strokesToSvg() {
    const bbox = strokesBBox(S.strokes, 10);
    if (!bbox) return null;
    const w = Math.max(1, bbox.w), h = Math.max(1, bbox.h);
    // 지우개는 raster 가 아니면 반영 어렵다 — SVG 에서는 erase 를 mask 로 구현
    // 단순화: erase stroke 는 저장 시 생략하지 않고 흰색으로 덮기 — 노트 배경이 대부분 흰색/크림이므로
    // 더 정확하려면 <mask> 로 전체 그룹 마스킹. 지우개는 mask 로 처리.
    const groups = [];
    const mask = [];
    for (const st of S.strokes) {
      if (st.erase) {
        mask.push(strokeToPath(st, '#000', bbox.x, bbox.y));
      } else {
        groups.push(strokeToPath(st, st.color, bbox.x, bbox.y));
      }
    }
    const maskId = 'hwmask-' + Math.random().toString(36).slice(2, 8);
    const maskSvg = mask.length
      ? `<defs><mask id="${maskId}"><rect x="0" y="0" width="${w}" height="${h}" fill="white"/>${mask.join('')}</mask></defs>`
      : '';
    const groupOpen = mask.length ? `<g mask="url(#${maskId})">` : '<g>';
    const groupClose = '</g>';
    return `<svg xmlns="${S.svgNS}" class="jan-handwriting-ink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${maskSvg}${groupOpen}${groups.join('')}${groupClose}</svg>`;
  }

  function strokeToPath(st, color, offX, offY) {
    const sw = st.thickness || 3;
    if (st.kind === 'shape-circle') {
      return `<ellipse cx="${st.cx - offX}" cy="${st.cy - offY}" rx="${st.rx}" ry="${st.ry}" fill="none" stroke="${color}" stroke-width="${sw}"/>`;
    }
    if (st.kind === 'shape-rect') {
      return `<rect x="${st.x - offX}" y="${st.y - offY}" width="${st.w}" height="${st.h}" fill="none" stroke="${color}" stroke-width="${sw}"/>`;
    }
    if (st.kind === 'shape-line') {
      return `<line x1="${st.x1 - offX}" y1="${st.y1 - offY}" x2="${st.x2 - offX}" y2="${st.y2 - offY}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
    }
    const pts = st.points;
    if (!pts || !pts.length) return '';
    if (pts.length === 1) {
      const p = pts[0];
      return `<circle cx="${p.x - offX}" cy="${p.y - offY}" r="${Math.max(0.8, p.w / 2)}" fill="${color}"/>`;
    }
    // 가변 두께를 살리려면 polyline 대신 세그먼트별 path. 단순화: 평균 두께로 smooth path
    let d = `M ${fmt(pts[0].x - offX)} ${fmt(pts[0].y - offY)}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const mx = (a.x + b.x) / 2 - offX;
      const my = (a.y + b.y) / 2 - offY;
      d += ` Q ${fmt(a.x - offX)} ${fmt(a.y - offY)} ${fmt(mx)} ${fmt(my)}`;
    }
    const last = pts[pts.length - 1];
    d += ` L ${fmt(last.x - offX)} ${fmt(last.y - offY)}`;
    // 평균 굵기
    let sum = 0; for (const p of pts) sum += p.w || sw;
    const avgW = sum / pts.length;
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${fmt(avgW)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  function fmt(n) { return Math.round(n * 100) / 100; }

  function save() {
    if (!S.strokes.length) { close(); return; }
    const svg = strokesToSvg();
    if (!svg) { close(); return; }
    // 기존 insertHtmlAtCursor 사용 — 커서 위치 보존 + scheduleSave
    const pageEl = document.getElementById('page');
    if (pageEl) pageEl.focus();
    const html = svg + '<br>';
    if (typeof window.insertHtmlAtCursor === 'function') {
      window.insertHtmlAtCursor(html);
    } else {
      document.execCommand('insertHTML', false, html);
      if (typeof window.scheduleSave === 'function') window.scheduleSave();
    }
    if (typeof window.toast === 'function') window.toast('손글씨가 노트에 삽입되었습니다');
    close();
  }

  // ============================================================
  // 9. open / close
  // ============================================================
  function open() {
    buildUI();
    if (S.open) return;
    S.open = true;
    S.strokes = [];
    S.redo = [];
    S.current = null;
    overlayEl.classList.add('open');
    resizeCanvas();
    // 열기 전에 현재 포커스 element 의 blur 를 강제 — 한글 IME 가
    // 활성화되어 있으면 ESC 가 'Process' 로 들어가 막히기 때문.
    try {
      const active = document.activeElement;
      if (active && typeof active.blur === 'function' &&
          active !== document.body && active !== canvasEl) {
        active.blur();
      }
    } catch {}
    // canvas 에 포커스 — ESC 등 키보드 이벤트가 다른 앱 모듈보다 먼저 도달하도록
    try { canvasEl.focus({ preventScroll: true }); } catch { try { canvasEl.focus(); } catch {} }
    window.addEventListener('resize', resizeCanvas);
    // keydown 리스너는 초기 boot 에 document 에 이미 등록했으므로 여기서 재등록 안 함
    // (다른 앱 리스너보다 먼저 실행되기 위함)
  }
  function close() {
    if (!S.open) return;
    S.open = false;
    Sfx.stop();
    overlayEl.classList.remove('open');
    window.removeEventListener('resize', resizeCanvas);
    S.strokes = [];
    S.redo = [];
    S.current = null;
    if (ctx2d) ctx2d.clearRect(0, 0, canvasEl.clientWidth, canvasEl.clientHeight);
  }

  function onKeyDown(e) {
    if (!S.open) return;
    // DEBUG: 사용자가 문제 추적할 수 있도록 window 에 마지막 키 이벤트 저장
    try { window.__hwLastKey = { key: e.key, code: e.code, kc: e.keyCode, t: Date.now(), phase: e.eventPhase, composing: e.isComposing, target: (e.target && e.target.tagName) || '?' }; } catch {}
    // ESC — 한글 IME 조합 중에는 e.key 가 'Process' 가 되는 경우가 있어
    // 물리적 키 코드(e.code / keyCode)도 함께 체크한다.
    const isEsc = e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27;
    if (isEsc) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      close(); return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ')) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); undo(); return;
    }
    if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && (e.key === 'Z' || e.key === 'z' || e.code === 'KeyZ')) || e.key === 'y' || e.key === 'Y' || e.code === 'KeyY')) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); redo(); return;
    }
  }

  // ============================================================
  // 10. 삽입된 SVG — 드래그·리사이즈 (기존 이미지 인프라 재활용 + 최소 자체 기능)
  // ============================================================
  function enhanceInsertedSvgs() {
    document.addEventListener('mousedown', function (e) {
      const t = e.target;
      if (!t) return;
      const svg = t.closest && t.closest('svg.jan-handwriting-ink');
      if (!svg) return;
      // 기본: 편집 영역에서 drag 로 이미 이동 가능하므로 아무 것도 안 함. resize 핸들만 보강.
      // 하지만 contenteditable 에서 svg 는 기본 드래그 안 됨 → 선택만 시키고 폭 조정 UI 제공
    });
    // 더블클릭 → 크기 조정 prompt
    document.addEventListener('dblclick', function (e) {
      const svg = e.target && e.target.closest && e.target.closest('svg.jan-handwriting-ink');
      if (!svg) return;
      e.preventDefault();
      const cur = parseFloat(svg.getAttribute('width')) || svg.getBoundingClientRect().width;
      const v = prompt('손글씨 크기 (px). 현재 ' + Math.round(cur) + ' px', String(Math.round(cur)));
      if (v == null) return;
      const nw = parseFloat(v);
      if (!isFinite(nw) || nw <= 10) return;
      const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
      const ratio = (vb.length === 4 && vb[2] > 0) ? (vb[3] / vb[2]) : 1;
      svg.setAttribute('width', nw);
      svg.setAttribute('height', Math.round(nw * ratio));
      svg.style.width = nw + 'px';
      svg.style.height = Math.round(nw * ratio) + 'px';
      if (typeof window.scheduleSave === 'function') window.scheduleSave();
    });
  }

  // ============================================================
  // 11. 부팅 — sketchBtn 가로채기 + Alt+P 가로채기 + 명령 팔레트
  // ============================================================
  function interceptSketchBtn() {
    const btn = document.getElementById('sketchBtn');
    if (!btn) return false;
    // capture 단계 리스너 → 기존 click 핸들러 (openSketch) 가 실행되기 전에 가로챔
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopImmediatePropagation();
      open();
    }, true);
    return true;
  }

  function interceptAltP() {
    window.addEventListener('keydown', function (e) {
      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        // 기존 pen-surface.js 의 openPaint 대신 오버레이 열기
        e.preventDefault();
        e.stopImmediatePropagation();
        if (S.open) close(); else open();
      }
    }, true);   // capture 단계
  }

  function registerPaletteCommands() {
    let tries = 0;
    const tick = setInterval(() => {
      tries++;
      if (window.justanotepadPalette && typeof window.justanotepadPalette.register === 'function') {
        clearInterval(tick);
        try {
          window.justanotepadPalette.register({
            id: 'handwriting-overlay',
            title: '노트 필기 시작',
            hint: '노트 위에 오버레이로 바로 필기 — ESC 로 취소',
            keywords: ['손글씨', '필기', '오버레이', 'handwriting', 'pen', '펜', 'draw'],
            run: open,
          });
          window.justanotepadPalette.register({
            id: 'paint-studio',
            title: '전문 그림판 (레이어·AI)',
            hint: '레이어·필터·AI 이미지 생성까지',
            keywords: ['그림판', 'paint', '스튜디오', '레이어', 'layers'],
            run: () => {
              const b = document.getElementById('paintTopBtn');
              if (b) b.click();
            },
          });
        } catch {}
      }
      if (tries > 60) clearInterval(tick);
    }, 250);
  }

  function boot() {
    // sketchBtn 이 나중에 DOM 에 들어올 수도 있으므로 재시도
    if (!interceptSketchBtn()) {
      let tries = 0;
      const tick = setInterval(() => {
        if (interceptSketchBtn() || ++tries > 40) clearInterval(tick);
      }, 200);
    }
    interceptAltP();
    registerPaletteCommands();
    enhanceInsertedSvgs();
    // keydown (ESC, Ctrl+Z, Ctrl+Y) 를 document 에 capture 로 상시 등록 — open 때만 실제 동작
    // 여기서 미리 등록해 두면 후속으로 등록되는 앱 리스너보다 우선권 확보
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    // keyup 백업 — 한글 IME 조합 상태에서 keydown 이 'Process' 로 막혀도
    // keyup 은 정상 발생하므로 ESC 를 확실히 잡을 수 있게 한다.
    const keyUpEsc = function (e) {
      if (!S.open) return;
      if (e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27) {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        close();
      }
    };
    document.addEventListener('keyup', keyUpEsc, true);
    window.addEventListener('keyup', keyUpEsc, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // ============================================================
  // 12. 공개 API
  // ============================================================
  window.JANHandwriting = {
    __installed: true,
    open, close, save,
    isOpen: () => S.open,
    toggleSound,
    setColor, setTool, setThickness,
    undo, redo,
  };
})();
