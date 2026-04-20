/**
 * justanotepad · Unified Save System (v1.0)
 * --------------------------------------------------------------------------
 * 앱 전체 파일 저장을 하나의 체계로 통합.
 *
 * 해결한 문제:
 *   - 사용자가 파일 → 저장하기 → Word 를 눌러도 파일이 어디로 가는지 몰랐음
 *   - 강의/회의 박스의 저장 체계가 앱 본체의 export 버튼에는 적용 안 됐음
 *
 * 이 시스템이 하는 일:
 *   1. 루트 저장 폴더를 1번만 지정하면 모든 파일이 카테고리별 서브폴더로 분류:
 *        lectures/  meetings/  notes/  tasks/  forms/  media/  backups/
 *   2. 기존 앱의 모든 export 버튼(#exportPdfBtn/#exportDocxBtn/...)을 자동 가로채기
 *   3. 저장 직전 상단에 확인 모달: "어디에 저장되는지" 투명하게 표시
 *   4. 폴더 미지정이거나 거부 시 브라우저 기본 다운로드 폴더로 폴백
 *
 * 전역 API:
 *   window.jnpSaveSystem = {
 *     save(filename, blob, { category, session, ask }),
 *     pickRootFolder(),
 *     getRootFolder(), getStatus(),
 *     openConfig()
 *   }
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.jnpSaveSystem) return;

  // ---- 설정 ----
  const CATEGORIES = {
    lecture: 'lectures',
    meeting: 'meetings',
    note:    'notes',
    task:    'tasks',
    form:    'forms',
    media:   'media',
    backup:  'backups',
  };

  // 파일명·MIME 으로 카테고리 자동 추론
  function inferCategory(filename, mime) {
    const ext = (filename.split('.').pop() || '').toLowerCase();
    if (['mp4','m4a','webm','mp3','wav','mov','avi'].includes(ext)) return 'media';
    if (filename.startsWith('lecture')) return 'lecture';
    if (filename.startsWith('meeting')) return 'meeting';
    if (ext === 'json' && /backup|export|전체/.test(filename.toLowerCase())) return 'backup';
    return 'note';
  }

  let dirHandle = null;
  let permGranted = false;
  let askSkip = false;   // 세션 동안 "매번 물어보지 않기" 체크 상태

  // ---- IDB ----
  async function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('jnp-save-system', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  async function kvGet(k) { try { const db = await idb(); return await new Promise(res => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result||null); r.onerror = () => res(null); }); } catch { return null; } }
  async function kvSet(k,v) { try { const db = await idb(); db.transaction('kv','readwrite').objectStore('kv').put(v,k); } catch {} }

  // ---- 스타일 (테마 변수 사용) ----
  const CSS = `
  .jnp-save-modal-backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.35);
    z-index: 2147483500;
    display: none; align-items: flex-start; justify-content: center;
    padding-top: 8vh;
  }
  .jnp-save-modal-backdrop.on { display: flex; }
  .jnp-save-modal {
    background: var(--paper, #fff);
    color: var(--ink, #111);
    border: 1px solid var(--line, rgba(0,0,0,.08));
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.18);
    width: min(520px, 92vw);
    overflow: hidden;
    font: 14px/1.5 -apple-system, "Segoe UI", "Malgun Gothic", sans-serif;
  }
  .jnp-save-head {
    padding: 14px 18px;
    background: var(--tab-hover, #fffbe5);
    border-bottom: 1px solid var(--line, rgba(0,0,0,.08));
    font-weight: 700; font-size: 15px;
    display: flex; align-items: center; gap: 8px;
  }
  .jnp-save-body {
    padding: 16px 18px;
    display: flex; flex-direction: column; gap: 12px;
  }
  .jnp-save-row {
    display: flex; align-items: center; gap: 8px; min-width: 0;
  }
  .jnp-save-path {
    flex: 1;
    background: var(--bg, #f7f7f7);
    border: 1px solid var(--line, rgba(0,0,0,.08));
    border-radius: 8px;
    padding: 8px 10px;
    font-family: ui-monospace, Menlo, Consolas, monospace;
    font-size: 12.5px;
    word-break: break-all;
    color: var(--ink);
  }
  .jnp-save-path strong { color: var(--ink); }
  .jnp-save-path .dim { color: var(--ink-soft, #888); }
  .jnp-save-foot {
    padding: 12px 18px;
    border-top: 1px solid var(--line, rgba(0,0,0,.08));
    display: flex; gap: 8px; flex-wrap: wrap;
    background: var(--bg, #f7f7f7);
  }
  .jnp-save-btn {
    padding: 8px 14px; border-radius: 8px; cursor: pointer;
    font: 600 13px/1 inherit; border: 1px solid var(--line, rgba(0,0,0,.08));
    background: var(--paper, #fff); color: var(--ink, #111);
  }
  .jnp-save-btn.primary {
    background: var(--accent, #fae100);
    border-color: var(--accent, #fae100);
    color: #111;
  }
  .jnp-save-btn.primary:hover { background: var(--accent-2, #fff2a0); }
  .jnp-save-btn:hover { background: var(--tab-hover, #fffbe5); }
  .jnp-save-btn.ghost { background: transparent; border-color: transparent; color: var(--ink-soft, #888); }
  .jnp-save-btn.ghost:hover { color: var(--ink); }
  .jnp-save-toggle {
    font-size: 12px; color: var(--ink-soft, #888);
    display: inline-flex; align-items: center; gap: 6px;
    margin-right: auto;
  }

  .jnp-save-indicator {
    position: fixed; bottom: 10px; left: 10px;
    z-index: 40;
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 4px 10px;
    font: 500 11px/1 inherit;
    color: var(--ink-soft);
    display: none; align-items: center; gap: 6px;
    cursor: pointer;
  }
  .jnp-save-indicator.on { display: inline-flex; }
  .jnp-save-indicator:hover { color: var(--ink); }
  `;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  // ---- 상단 확인 모달 ----
  let modalEl = null;
  function ensureModal() {
    if (modalEl) return modalEl;
    const back = document.createElement('div');
    back.className = 'jnp-save-modal-backdrop';
    back.innerHTML = `
      <div class="jnp-save-modal" role="dialog">
        <div class="jnp-save-head">
          <span>파일 저장</span>
        </div>
        <div class="jnp-save-body">
          <div class="jnp-save-row" data-role="path-row">
            <div class="jnp-save-path" data-role="path"></div>
          </div>
          <div class="jnp-save-row" style="color:var(--ink-soft);font-size:12px;">
            <span data-role="info"></span>
          </div>
        </div>
        <div class="jnp-save-foot">
          <label class="jnp-save-toggle">
            <input type="checkbox" data-role="skip"> 이 세션 동안 묻지 않기
          </label>
          <button class="jnp-save-btn ghost" data-role="cancel">취소</button>
          <button class="jnp-save-btn" data-role="download">다운로드 폴더로</button>
          <button class="jnp-save-btn" data-role="pick">폴더 변경</button>
          <button class="jnp-save-btn primary" data-role="save">저장</button>
        </div>
      </div>
    `;
    document.body.appendChild(back);
    back.addEventListener('click', (e) => { if (e.target === back) closeModal('cancel'); });
    modalEl = back;
    return back;
  }

  function closeModal(reason) {
    if (modalEl) modalEl.classList.remove('on');
    if (currentResolver) { const r = currentResolver; currentResolver = null; r(reason); }
  }

  let currentResolver = null;
  async function showSaveModal({ filename, subfolder, rootName, info }) {
    const el = ensureModal();
    const path = el.querySelector('[data-role="path"]');
    const infoEl = el.querySelector('[data-role="info"]');
    const skipCheck = el.querySelector('[data-role="skip"]');
    skipCheck.checked = askSkip;

    path.innerHTML = rootName
      ? `<strong>${rootName}</strong><span class="dim"> / </span><strong>${subfolder}</strong><span class="dim"> / </span>${filename}`
      : `<span class="dim">폴더 미지정 — </span>${filename}<span class="dim"> (브라우저 다운로드)</span>`;
    infoEl.textContent = info || '';

    el.classList.add('on');

    return new Promise((resolve) => {
      currentResolver = resolve;
      const on = (role, reason) => {
        const b = el.querySelector(`[data-role="${role}"]`);
        b.onclick = () => { askSkip = skipCheck.checked; closeModal(reason); };
      };
      on('save', 'save');
      on('pick', 'pick');
      on('download', 'download');
      on('cancel', 'cancel');
    });
  }

  // ---- 핵심 저장 ----
  async function save(filename, blob, options = {}) {
    const category = options.category || inferCategory(filename, blob.type);
    const subfolder = options.subfolder || CATEGORIES[category] || 'notes';
    const session = options.session || null;

    // 1. 폴더 미지정: 다운로드 폴더로 저장
    if (!dirHandle) {
      return downloadFallback(filename, blob);
    }

    // 2. 사용자 확인 (askSkip 이 꺼져있을 때만)
    if (!askSkip && options.ask !== false) {
      const choice = await showSaveModal({
        filename, subfolder,
        rootName: dirHandle.name,
        info: `카테고리: ${category} · 크기: ${(blob.size/1024).toFixed(1)} KB`
      });
      if (choice === 'cancel') { toast('저장 취소됨'); return { success: false, cancelled: true }; }
      if (choice === 'download') { return downloadFallback(filename, blob); }
      if (choice === 'pick') { await pickRootFolder(); return save(filename, blob, options); }
      // 'save' → 아래 계속
    }

    // 3. 권한 확인
    if (!await ensurePermission()) {
      toast('폴더 권한 없음 — 다운로드 폴더로 저장');
      return downloadFallback(filename, blob);
    }

    // 4. 실제 쓰기
    try {
      const sub = await dirHandle.getDirectoryHandle(subfolder, { create: true });
      const target = session ? await sub.getDirectoryHandle(session, { create: true }) : sub;
      const fh = await target.getFileHandle(filename, { create: true });
      const w = await fh.createWritable(); await w.write(blob); await w.close();
      const path = `${subfolder}/${session ? session + '/' : ''}${filename}`;
      toast(`저장됨 → ${path}`);
      return { success: true, path, full: `${dirHandle.name}/${path}` };
    } catch (e) {
      console.warn('[jnpSaveSystem.save]', e);
      return downloadFallback(filename, blob);
    }
  }

  function downloadFallback(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.setAttribute('data-jnp-bypass', '1');
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    toast(`다운로드: ${filename}`);
    return { success: true, downloaded: true, path: filename };
  }

  async function ensurePermission() {
    if (!dirHandle) return false;
    if (permGranted) return true;
    try {
      const p = await dirHandle.queryPermission?.({ mode: 'readwrite' });
      if (p === 'granted') { permGranted = true; return true; }
      toast('폴더 접근 권한 확인 창이 뜹니다 — 허용을 눌러 주세요', 3500);
      await new Promise(r => setTimeout(r, 400));
      const r = await dirHandle.requestPermission?.({ mode: 'readwrite' });
      if (r === 'granted') { permGranted = true; return true; }
    } catch (e) { console.warn('[ensurePermission]', e); }
    return false;
  }

  async function pickRootFolder() {
    if (!('showDirectoryPicker' in window)) {
      toast('이 브라우저는 폴더 선택을 지원하지 않습니다');
      return null;
    }
    try {
      const h = await window.showDirectoryPicker({ id: 'jnp-save-dir', mode: 'readwrite' });
      dirHandle = h; permGranted = true;
      await kvSet('dirHandle', h);
      updateIndicator(h.name);
      toast(`저장 폴더 설정됨: ${h.name}`);
      // 하위 카테고리 폴더 선제 생성 (선택)
      for (const sub of Object.values(CATEGORIES)) {
        try { await h.getDirectoryHandle(sub, { create: true }); } catch {}
      }
      return h;
    } catch (e) { if (e.name !== 'AbortError') console.warn(e); return null; }
  }

  async function init() {
    try {
      const h = await kvGet('dirHandle');
      if (h) { dirHandle = h; permGranted = false; updateIndicator(h.name, true); }
    } catch {}
  }

  // ---- 좌하단 상태 인디케이터 ----
  let indicatorEl = null;
  function ensureIndicator() {
    if (indicatorEl) return indicatorEl;
    const el = document.createElement('div');
    el.className = 'jnp-save-indicator';
    el.innerHTML = `<svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><span data-role="name">폴더 미지정</span>`;
    el.addEventListener('click', openConfig);
    document.body.appendChild(el);
    indicatorEl = el;
    return el;
  }
  function updateIndicator(name, pending = false) {
    const el = ensureIndicator();
    el.querySelector('[data-role="name"]').textContent = '저장: ' + name + (pending ? ' *' : '');
    el.classList.add('on');
  }

  async function openConfig() {
    // 간이 설정창: 현재 상태 + 폴더 변경
    const ok = confirm(
      `현재 저장 폴더: ${dirHandle?.name || '미지정'}\n\n` +
      '카테고리별 서브폴더 자동 분류:\n' +
      '  · 강의: lectures/\n' +
      '  · 회의: meetings/\n' +
      '  · 메모: notes/\n' +
      '  · 미디어(녹화): media/\n' +
      '  · 전체백업: backups/\n\n' +
      '폴더를 변경하시겠습니까?'
    );
    if (ok) await pickRootFolder();
  }

  function toast(text, ms = 2000) {
    try { if (typeof window.toast === 'function') return window.toast(text); } catch {}
    // 폴백 토스트
    const n = document.createElement('div');
    n.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:8px 14px;border-radius:999px;z-index:2147483600;font-size:13px;';
    n.textContent = text;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), ms);
  }

  // ---- 기존 export 버튼 가로채기 ----
  // 방법: <a download="..." href="blob:..."> 클릭을 전역 가로채기
  function installDownloadInterceptor() {
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function() {
      // 이 시스템 내부에서 만든 다운로드는 통과
      if (this.getAttribute('data-jnp-bypass') === '1') return origClick.apply(this, arguments);
      // download 속성 있고 blob: 또는 data: URL 인 경우만 가로채기
      const dl = this.getAttribute('download');
      const href = this.href || this.getAttribute('href') || '';
      if (!dl || !(href.startsWith('blob:') || href.startsWith('data:'))) return origClick.apply(this, arguments);
      // dirHandle 없으면 원래 동작 (브라우저 기본 다운로드)
      if (!dirHandle) return origClick.apply(this, arguments);

      // 가로채서 우리 save() 로
      (async () => {
        try {
          const r = await fetch(href);
          const blob = await r.blob();
          await save(dl, blob, { ask: !askSkip });
        } catch (e) {
          console.warn('[intercept]', e);
          origClick.apply(this, arguments);
        }
      })();
    };
  }

  // ---- 부팅 ----
  window.jnpSaveSystem = {
    save,
    pickRootFolder,
    getRootFolder: () => dirHandle?.name || null,
    getHandle: () => dirHandle,
    getStatus: () => ({ folder: dirHandle?.name || null, permGranted, askSkip }),
    openConfig,
    CATEGORIES,
  };

  (async () => {
    await init();
    installDownloadInterceptor();
    ensureIndicator();
    console.info('[save-system] ready. window.jnpSaveSystem');
  })();
})();
