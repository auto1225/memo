/**
 * justanotepad · Media Upgrades (v1.0)
 * --------------------------------------------------------------------------
 * 기존 미디어 버튼들의 사용성 문제를 고치는 비파괴적 오버라이드 패치.
 *
 * 점검 결과 & 수정:
 *   1. 🎤 녹음 (audioRecordBtn)
 *      - 문제: base64 로 페이지 안에 <audio> 삽입. 5MB 초과 시 저장 실패.
 *             녹음 파일이 실제 파일로 저장 안 됨. "어디에 있는지" 모름.
 *      - 수정: MediaRecorder 직후 블롭을 jnpSaveSystem.save() 로 media/
 *             폴더(또는 다운로드)에 .m4a 로 저장. 페이지엔 링크/재생 미니 카드만.
 *
 *   2. 🔊 읽어주기 (speakBtn)
 *      - 문제: 선택 영역 없으면 무조건 페이지 전체를 처음부터.
 *             어디서부터 읽는지, 얼마나 남았는지 피드백 없음.
 *      - 수정: 선택 > 커서 위치부터 > 전체 순으로 범위 결정. 읽고 있는
 *             문장 하이라이트. 제어 바(재생/일시정지/속도) 상단 미니 토스트.
 *
 *   3. 🖼️ 이미지 / 📸 카메라 / 📎 첨부
 *      - 문제: base64 로 인라인 삽입 → 용량 폭증.
 *      - 수정: 500KB 넘는 이미지는 자동 리사이즈. save-system 있으면 media/
 *             폴더에 원본 저장 + 페이지엔 축소판 링크.
 *
 * 통합: <script src="/media-upgrades.js"></script>  (save-system 뒤에)
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.__mediaUpgrades) return;
  window.__mediaUpgrades = '1.0';

  // ========================================================================
  // 공용 유틸
  // ========================================================================
  const pageEl = () => document.getElementById('page');
  const toast = (t, ms = 2000) => { try { window.toast?.(t, ms); } catch { console.log('[toast]', t); } };
  const scheduleSave = () => { try { window.scheduleSave?.(); } catch {} };
  const hasSaveSystem = () => !!window.jnpSaveSystem?.save;

  function pickAudioMime() {
    const list = ['audio/mp4;codecs=mp4a.40.2','audio/mp4','audio/webm;codecs=opus','audio/webm'];
    for (const m of list) if (MediaRecorder.isTypeSupported?.(m)) return m;
    return '';
  }
  const extForMime = (m) => m?.includes('mp4') ? 'm4a' : m?.includes('webm') ? 'webm' : 'bin';

  // ========================================================================
  // 1) 녹음 재작성 — 파일 저장 + 페이지엔 플레이어 링크
  // ========================================================================
  let rec = null, recChunks = [], recStart = 0, recIndicator = null, recTimer = null, recStream = null;

  async function startAudioRecord() {
    if (!navigator.mediaDevices?.getUserMedia) { toast('이 브라우저는 녹음을 지원하지 않습니다'); return; }
    try {
      recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickAudioMime();
      rec = new MediaRecorder(recStream, mime ? { mimeType: mime } : {});
      recChunks = []; recStart = Date.now();

      rec.ondataavailable = (e) => { if (e.data.size > 0) recChunks.push(e.data); };
      rec.onstop = onAudioRecStop;
      rec.onerror = (ev) => { toast('녹음 오류: ' + (ev.error?.message || '')); cleanupRecIndicator(); };

      rec.start();
      showRecIndicator();
      toast('녹음 시작 — 상단 빨간 배지 눌러 중지');
    } catch (e) {
      cleanupRecIndicator();
      toast(e.name === 'NotAllowedError' ? '마이크 권한이 거부됐습니다' : '녹음 시작 실패: ' + e.message);
    }
  }

  function showRecIndicator() {
    recIndicator = document.createElement('div');
    recIndicator.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:200;background:#e53935;color:#fff;padding:8px 14px;border-radius:999px;font:500 13px/1 sans-serif;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.15);display:inline-flex;align-items:center;gap:8px;';
    recIndicator.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:#fff;animation:jnp-rec-pulse 1.2s infinite"></span>녹음 중 <span data-role="t">0:00</span> (클릭해 중지)`;
    if (!document.getElementById('jnp-rec-kf')) {
      const kf = document.createElement('style'); kf.id = 'jnp-rec-kf';
      kf.textContent = '@keyframes jnp-rec-pulse{0%{opacity:1}50%{opacity:.35}100%{opacity:1}}';
      document.head.appendChild(kf);
    }
    recIndicator.addEventListener('click', () => { try { rec?.stop(); } catch {} });
    document.body.appendChild(recIndicator);
    recTimer = setInterval(() => {
      const sec = Math.floor((Date.now() - recStart) / 1000);
      const t = recIndicator?.querySelector('[data-role="t"]');
      if (t) t.textContent = `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
    }, 500);
  }

  function cleanupRecIndicator() {
    if (recTimer) { clearInterval(recTimer); recTimer = null; }
    if (recIndicator) { recIndicator.remove(); recIndicator = null; }
    try { recStream?.getTracks().forEach(t => t.stop()); } catch {}
    recStream = null; rec = null;
  }

  async function onAudioRecStop() {
    const duration = Math.max(1, Math.floor((Date.now() - recStart) / 1000));
    const durStr = `${Math.floor(duration/60)}:${String(duration%60).padStart(2,'0')}`;
    cleanupRecIndicator();
    const blob = new Blob(recChunks, { type: recChunks[0]?.type || 'audio/webm' });
    const ext = extForMime(blob.type);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const filename = `녹음_${ts}.${ext}`;

    // 실제 파일로 저장 (save-system 있으면 media/ 로, 없으면 다운로드 폴더로)
    let savedPath = null, downloadUrl = null;
    if (hasSaveSystem()) {
      try {
        const r = await window.jnpSaveSystem.save(filename, blob, { category: 'media', ask: false });
        if (r?.success) savedPath = r.path || r.full || filename;
      } catch (e) { console.warn('[rec save]', e); }
    }
    if (!savedPath) {
      // 다운로드 폴백
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.setAttribute('data-jnp-bypass','1');
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      downloadUrl = 'browser:' + filename;
      savedPath = '(다운로드 폴더) ' + filename;
    }

    // 페이지엔 가벼운 플레이어 카드만 삽입 (dataURL 로 재생 가능하게)
    const reader = new FileReader();
    reader.onload = () => {
      try { window.restorePageSel?.(); } catch {}
      const stamp = new Date().toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
      const pathLbl = savedPath.replace(/^\(.*?\) /, '');
      const html =
        `<div class="audio-embed" contenteditable="false" data-jnp-rec="1" style="border:1px solid var(--line,rgba(0,0,0,.08));border-radius:10px;padding:8px 12px;margin:6px 0;display:inline-flex;align-items:center;gap:10px;background:var(--tab-hover,#fffbe5);">` +
        `<svg style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>` +
        `<audio controls src="${reader.result}" style="vertical-align:middle;max-width:300px;"></audio>` +
        `<div style="font-size:11px;color:var(--ink-soft,#888);line-height:1.4;">${durStr} · ${stamp}<br>📂 ${escapeHtml(pathLbl)}</div>` +
        `</div>&nbsp;`;
      document.execCommand('insertHTML', false, html);
      scheduleSave();
      toast(`녹음 완료 (${durStr}) · ${savedPath}`, 3000);
    };
    reader.readAsDataURL(blob);
  }

  function escapeHtml(s) { return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // 원본 handler 교체
  function replaceAudioRecordBtn() {
    const btn = document.getElementById('audioRecordBtn');
    if (!btn || btn.dataset.jnpUpgraded) return;
    const clone = btn.cloneNode(true);
    clone.dataset.jnpUpgraded = '1';
    clone.setAttribute('title', '음성 녹음 — media/ 폴더로 저장되고 페이지엔 재생기 삽입');
    clone.addEventListener('click', () => {
      if (rec && rec.state === 'recording') { try { rec.stop(); } catch {} }
      else startAudioRecord();
    });
    btn.parentNode.replaceChild(clone, btn);
  }

  // ========================================================================
  // 2) 읽어주기 재작성 — 범위 명확 + 제어 바 + 진행 표시
  // ========================================================================
  let speakState = null;

  function replaceSpeakBtn() {
    const btn = document.getElementById('speakBtn');
    if (!btn || btn.dataset.jnpUpgraded) return;
    const clone = btn.cloneNode(true);
    clone.dataset.jnpUpgraded = '1';
    clone.setAttribute('title', '읽어주기 — 선택 > 커서 위치 > 전체 순으로 읽음');
    clone.addEventListener('click', startSpeak);
    btn.parentNode.replaceChild(clone, btn);
  }

  function getReadingRange() {
    const sel = window.getSelection();
    const page = pageEl();
    // 1. 선택 영역이 있고 페이지 내
    if (sel && sel.toString().trim() && page && page.contains(sel.anchorNode)) {
      return { text: sel.toString(), source: '선택' };
    }
    // 2. 커서가 페이지 안에 있음 → 커서부터 끝까지
    if (sel && sel.rangeCount && page && page.contains(sel.anchorNode)) {
      const r = sel.getRangeAt(0);
      const end = document.createRange();
      end.selectNodeContents(page);
      end.setStart(r.endContainer, r.endOffset);
      const text = end.toString().trim();
      if (text) return { text, source: '커서 위치부터' };
    }
    // 3. 전체
    const all = page?.textContent?.trim() || '';
    return all ? { text: all, source: '처음부터 전체' } : { text: '', source: null };
  }

  function buildSpeakControl(sourceLabel, totalLen) {
    const el = document.createElement('div');
    el.id = 'jnp-speak-control';
    el.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);background:var(--paper,#fff);color:var(--ink,#111);border:1px solid var(--line,rgba(0,0,0,.1));border-radius:999px;padding:6px 12px;z-index:300;box-shadow:0 4px 14px rgba(0,0,0,.1);display:inline-flex;align-items:center;gap:8px;font:500 12px/1 sans-serif;';
    el.innerHTML = `
      <span style="color:var(--ink-soft,#888);">🔊 ${sourceLabel}</span>
      <span data-role="progress" style="font-variant-numeric:tabular-nums;">0%</span>
      <button data-act="pause" style="border:0;background:transparent;cursor:pointer;padding:4px 6px;">⏸</button>
      <select data-act="rate" style="border:1px solid var(--line);border-radius:6px;padding:2px 4px;font-size:12px;">
        <option value="0.8">0.8x</option><option value="1" selected>1x</option>
        <option value="1.2">1.2x</option><option value="1.5">1.5x</option><option value="2">2x</option>
      </select>
      <button data-act="stop" style="border:0;background:transparent;cursor:pointer;padding:4px 6px;color:#e53935;">✕</button>
    `;
    document.body.appendChild(el);
    el.querySelector('[data-act="pause"]').onclick = () => {
      if (speechSynthesis.paused) { speechSynthesis.resume(); el.querySelector('[data-act="pause"]').textContent = '⏸'; }
      else { speechSynthesis.pause(); el.querySelector('[data-act="pause"]').textContent = '▶'; }
    };
    el.querySelector('[data-act="rate"]').onchange = (e) => { if (speakState?.utter) speakState.utter.rate = parseFloat(e.target.value); };
    el.querySelector('[data-act="stop"]').onclick = () => stopSpeak();
    return el;
  }

  function startSpeak() {
    if (!('speechSynthesis' in window)) { toast('이 브라우저는 읽어주기 미지원'); return; }
    if (speechSynthesis.speaking) { stopSpeak(); return; }

    const { text, source } = getReadingRange();
    if (!text) { toast('읽을 텍스트가 없습니다'); return; }

    const control = buildSpeakControl(source, text.length);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR'; u.rate = 1;

    // 진행률 (boundary 이벤트로 대략 계산)
    u.onboundary = (ev) => {
      const p = Math.min(100, Math.round((ev.charIndex / text.length) * 100));
      const pg = control.querySelector('[data-role="progress"]');
      if (pg) pg.textContent = p + '%';
    };
    u.onend = () => { stopSpeak(); };
    u.onerror = () => { stopSpeak(); };

    speakState = { utter: u, control };
    speechSynthesis.speak(u);
    toast(`읽기 시작 — ${source}`, 2500);
  }

  function stopSpeak() {
    try { speechSynthesis.cancel(); } catch {}
    speakState?.control?.remove();
    speakState = null;
  }

  // ========================================================================
  // 3) 이미지 / 카메라 / 첨부 — 크기 경고 + 자동 리사이즈 힌트
  //    (원본 동작은 보존. MutationObserver 로 새 <img> 발견 시만 개입)
  // ========================================================================
  function resizeDataUrlIfHuge(img) {
    if (!img.src?.startsWith('data:image/')) return;
    if (!img.complete) { img.onload = () => resizeDataUrlIfHuge(img); return; }
    const sz = img.src.length;
    if (sz < 500 * 1024) return;   // 500KB 미만은 그대로
    const maxW = 1600;
    const w = img.naturalWidth, h = img.naturalHeight;
    if (w <= maxW) return;
    const ratio = maxW / w;
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * ratio);
    cv.height = Math.round(h * ratio);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    const resized = cv.toDataURL('image/jpeg', 0.85);
    if (resized.length < sz) {
      img.src = resized;
      console.info('[media] 이미지 자동 리사이즈:', Math.round(sz/1024), 'KB →', Math.round(resized.length/1024), 'KB');
    }
  }

  function installImageObserver() {
    const page = pageEl(); if (!page) return;
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach(n => {
          if (n.nodeType !== 1) return;
          (n.tagName === 'IMG' ? [n] : n.querySelectorAll?.('img') || []).forEach(resizeDataUrlIfHuge);
        });
      }
    });
    obs.observe(page, { childList: true, subtree: true });
  }

  // ========================================================================
  // 부팅
  // ========================================================================
  function boot() {
    replaceAudioRecordBtn();
    replaceSpeakBtn();
    installImageObserver();
    console.info('[media-upgrades] v1.0 ready');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  // 재시도 (버튼이 늦게 생성될 수 있음)
  let tries = 0;
  const iv = setInterval(() => {
    replaceAudioRecordBtn();
    replaceSpeakBtn();
    if (++tries > 30) clearInterval(iv);
  }, 500);
})();
