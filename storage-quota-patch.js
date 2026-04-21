/**
 * justanotepad · Storage Quota Patch (v1.5.0)
 * --------------------------------------------------------------------------
 * v1.3.0 문제:
 *   state.tabs 가 ~70KB 이고 history/trash 모두 0 인데도 lockdown 다이얼로그가 떴음.
 *   원인: v1.3.0 의 진단·복구가 오직 state.tabs / history / trash 만 보고,
 *         실제로 5MB 를 채운 "다른 localStorage 키"들(지난 버전 잔해, 로그, 캐시,
 *         임시 키 등)을 못 봤다. 복구 단계에서 state 만 슬림화해봤자 다른 키가
 *         여전히 5MB를 점유 → setItem 재시도 즉시 실패 → 루프·Lockdown.
 *
 * v1.4.0 근본 수정:
 *   1. diagnose() — localStorage 전체를 스캔해 "키별 바이트 크기" 리스트 제공.
 *   2. recover — 전체 localStorage 의 용량을 낮추는 전략:
 *      a. state.tabs 의 큰 base64 이미지 → IDB (기존)
 *      b. 잔해 키 자동 정리: 앱이 쓰지 않는 오래된 키 자동 삭제
 *      c. 대용량 임시 키 자동 삭제
 *      d. 그래도 실패 시 state 전체 IDB 이관
 *   3. 다이얼로그에 "상위 N개 탭" 대신 "상위 N개 localStorage 키" 표시.
 *      키 클릭(또는 버튼)으로 개별 삭제 가능.
 *   4. 보호 키 allowlist: 삭제하면 안 되는 핵심 키는 절대 건드리지 않음.
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.__storageQuotaPatch && window.__storageQuotaPatch.version === '1.5.0') return;

  const STORAGE_KEY     = 'sticky-memo-v4';
  const SAFE_BUDGET     = 4 * 1024 * 1024;
  const COOLDOWN_MS     = 3000;
  const IDB_STATE_KEY   = 'sticky-memo-v4:state';
  const LOOP_WINDOW_MS  = 10000;
  const LOOP_THRESHOLD  = 3;
  const LOCKDOWN_MS     = 10 * 60 * 1000;

  // 절대 자동 삭제하지 않을 핵심 키 (정확한 매칭 — backup-* 등 파생은 보호 X)
  const PROTECTED_PATTERNS = [
    /^sticky-memo-v4$/,              // 정확히 메인 state 만 (backup 키는 보호 안 함)
    /^sb-.*-auth-token$/,            // Supabase 세션
    /^supabase\.auth\./,
    /^jan\.apiKeys\./,               // 사용자 AI 키
    /^ai-active-provider$/,
    /^jan\.theme$/,
    /^jnpLectureConsent/,
    /^jan\.preferences\./,
  ];
  const isProtected = (k) => PROTECTED_PATTERNS.some(re => re.test(k));
  // 이 패턴에 매칭되는 키는 "최신 N개만 유지하고 나머지 자동 삭제" 규칙 적용
  const BACKUP_PATTERNS = [
    { re: /^sticky-memo-v4-backup-/, keep: 2 },  // 백업은 최신 2개만
    { re: /^jnp-sticky-trash$/,      keep: 1 },  // 포스트잇 휴지통 (용량 커지면)
  ];

  let cooldownUntil = 0;
  let recovering = false;
  let dialogShown = false;
  let quotaErrorTimestamps = [];
  let lockdown = false;
  let lockdownUntil = 0;
  let lastToastText = '';
  let lastToastAt = 0;

  const log = (...a) => console.log('[quota-patch]', ...a);
  log('v1.4.0 applied');

  const getState = () => window.state || null;

  function toastOnce(text) {
    const now = Date.now();
    if (text === lastToastText && now - lastToastAt < 3000) return;
    lastToastText = text; lastToastAt = now;
    try { if (typeof window.toast === 'function') return window.toast(text); } catch {}
    console.log('[toast]', text);
  }

  // ======================================================================
  // 전체 localStorage 진단 (v1.3.0 핵심 결함 수정)
  // ======================================================================
  function diagnose() {
    const keys = [];
    let total = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        const v = origGetItem.call(localStorage, k) || '';
        const size = k.length + v.length; // 대략의 바이트
        total += size;
        keys.push({ key: k, size, protected: isProtected(k) });
      }
    } catch (e) { log('diagnose failed', e); }
    keys.sort((a, b) => b.size - a.size);
    // 탭 내부 정보 (선택적)
    const s = getState() || {};
    return {
      totalBytes: total,
      totalKB: Math.round(total/1024),
      keys,
      topKeys: keys.slice(0, 10),
      stateTabs: (s.tabs || []).length,
    };
  }

  // ======================================================================
  // state.tabs 안 base64 이미지 → IDB 참조로
  // ======================================================================
  async function hardSlimState() {
    const s = getState();
    if (!s || !Array.isArray(s.tabs)) return 0;
    const idb = window.__idbStore;
    const DATA_URL_RE = /data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]{2000,}/g;
    let saved = 0;
    for (const tab of s.tabs) {
      if (!tab.html || typeof tab.html !== 'string' || tab.html.length < 2048) continue;
      const matches = tab.html.match(DATA_URL_RE);
      if (!matches?.length) continue;
      for (const dataUrl of matches) {
        try {
          if (idb?.putBlob) {
            const mime = (dataUrl.match(/data:([^;]+);/) || [])[1] || 'image/png';
            const bin = atob(dataUrl.split(',')[1]);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            const blob = new Blob([arr], { type: mime });
            const hash = await idb.putBlob(blob);
            tab.html = tab.html.replace(dataUrl, `idb://${hash}`);
            saved += dataUrl.length;
          } else {
            tab.html = tab.html.replace(dataUrl, '');
            saved += dataUrl.length;
          }
        } catch (e) { log('slim err', e); break; }
      }
    }
    return saved;
  }

  // ======================================================================
  // 백업·휴지통 키 정리: 같은 패턴 키들 중 최신 N개만 유지
  // ======================================================================
  function cleanOldBackups() {
    const allKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) allKeys.push(k);
    }
    let freed = 0;
    for (const rule of BACKUP_PATTERNS) {
      const matched = allKeys.filter(k => rule.re.test(k));
      if (matched.length <= rule.keep) continue;
      // 최신 = 키 이름 sort desc (ISO timestamp 정렬 가능)
      matched.sort().reverse();
      const toRemove = matched.slice(rule.keep);
      for (const k of toRemove) {
        try {
          const sz = (origGetItem.call(localStorage, k) || '').length + k.length;
          origRemoveItem.call(localStorage, k);
          freed += sz;
          log('removed old backup', k, '(' + Math.round(sz/1024) + 'KB)');
        } catch (e) { log('backup rm failed', k, e); }
      }
    }
    return freed;
  }

  // ======================================================================
  // 전체 localStorage 자동 청소 — 핵심 키는 보호, 큰 보조 키부터 삭제
  // ======================================================================
  function autoCleanNonEssential() {
    // 1) 백업 패턴부터 정리 (가장 효과적)
    let freed = cleanOldBackups();
    // 2) 그 외 비핵심 큰 키 (50KB+) 삭제
    const diag = diagnose();
    const candidates = diag.keys.filter(k => !k.protected && k.size > 50 * 1024);
    for (const c of candidates.slice(0, 5)) {
      try {
        origRemoveItem.call(localStorage, c.key);
        freed += c.size;
        log('auto-removed non-essential key', c.key, Math.round(c.size/1024), 'KB');
      } catch (e) { log('remove failed', c.key, e); }
    }
    return freed;
  }

  // ======================================================================
  // Full IDB 모드 — state 를 IndexedDB 로 이관해 localStorage 5MB 제약 우회
  // 한 번 활성화되면 setItem 을 가로채서 IDB 에 쓰고 localStorage 엔 포인터만.
  // 디바이스 저장 용량(GB급)을 사용 가능 → 사실상 무제한.
  // ======================================================================
  let fullIdbMode = false;
  async function enterFullIdbMode() {
    if (!window.__idbStore?.setKV) {
      toastOnce('IndexedDB 저장소를 찾을 수 없습니다');
      return false;
    }
    try {
      const s = getState();
      if (s) await window.__idbStore.setKV(IDB_STATE_KEY, s);
      const pointer = JSON.stringify({ __stateInIdb: true, key: IDB_STATE_KEY, at: Date.now() });
      origSetItem.call(localStorage, STORAGE_KEY, pointer);
      origSetItem.call(localStorage, 'jnp-full-idb-mode', '1');
      fullIdbMode = true;
      toastOnce('Full IDB 모드 ON — 디바이스 저장 용량 사용 (5MB 제약 해제)');
      log('Full IDB mode activated');
      return true;
    } catch (e) { log('enterFullIdbMode failed', e); return false; }
  }
  // 부팅 시 mode 확인
  try { fullIdbMode = origGetItem.call(localStorage, 'jnp-full-idb-mode') === '1'; } catch {}

  // ======================================================================
  // 복구 파이프라인
  // ======================================================================
  async function recoverPayload(key, originalValue) {
    if (key !== STORAGE_KEY) return null;
    if (recovering) return null;
    recovering = true;
    try {
      // 0) 먼저 전체 localStorage 에서 큰 비핵심 키들 삭제 (v1.4.0 핵심)
      const freed = autoCleanNonEssential();
      if (freed > 0) {
        log('pre-cleaned', Math.round(freed/1024), 'KB of non-essential keys');
        // 재시도
        try {
          origSetItem.call(localStorage, key, originalValue);
          return null; // 성공 — 호출자에게 그대로 알림 대신 null 리턴 (아래 재시도 시나리오와 구분)
        } catch {}
      }

      // 1) state 슬림화
      const slimmed = await hardSlimState();
      if (slimmed > 0) {
        const payload = JSON.stringify(getState());
        if (payload.length < SAFE_BUDGET) { log('recovered via slim', slimmed); return payload; }
      }

      // 2) history/trash 비움
      const s = getState();
      if (s && ((s.history?.length || 0) + (s.trash?.length || 0) > 0)) {
        s.history = []; s.trash = [];
        const payload = JSON.stringify(s);
        if (payload.length < SAFE_BUDGET) { log('recovered via wipe'); return payload; }
      }

      // 3) state 전체 IDB 이관 + 포인터
      if (window.__idbStore?.setKV) {
        try {
          await window.__idbStore.setKV(IDB_STATE_KEY, getState());
          const pointer = JSON.stringify({ __stateInIdb: true, key: IDB_STATE_KEY, at: Date.now() });
          return pointer;
        } catch (e) { log('idb pointer failed', e); }
      }
      return null;
    } finally { recovering = false; }
  }

  function recordQuotaError() {
    const now = Date.now();
    quotaErrorTimestamps = quotaErrorTimestamps.filter(t => now - t < LOOP_WINDOW_MS);
    quotaErrorTimestamps.push(now);
    if (quotaErrorTimestamps.length >= LOOP_THRESHOLD && !lockdown) { enterLockdown(); return true; }
    return false;
  }

  function enterLockdown() {
    lockdown = true;
    lockdownUntil = Date.now() + LOCKDOWN_MS;
    const d = diagnose();
    log('LOCKDOWN', d);
    if (!dialogShown) {
      dialogShown = true;
      setTimeout(() => showLockdownDialog(d), 400);
    }
    toastOnce('저장 일시 중지 — 아래 대화창에서 정리 버튼을 누르세요');
  }

  // ======================================================================
  // 개선된 Lockdown 다이얼로그 — 실제 localStorage 키 보여주고 개별 삭제
  // ======================================================================
  function showLockdownDialog(diag) {
    // 앱의 pickList 가 있으면 그걸 쓰되, 없으면 HTML 다이얼로그 직접 렌더
    const back = document.createElement('div');
    back.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2147483600;display:flex;align-items:flex-start;justify-content:center;padding-top:8vh;';
    const card = document.createElement('div');
    card.style.cssText = 'background:#fff;border-radius:12px;min-width:min(560px,92vw);max-width:92vw;padding:18px 20px;font:14px/1.5 -apple-system,"Segoe UI","Malgun Gothic",sans-serif;color:#111;box-shadow:0 20px 60px rgba(0,0,0,.2);max-height:80vh;display:flex;flex-direction:column;';
    card.innerHTML = `
      <h3 style="margin:0 0 10px;font-size:16px;">저장 공간 부족 — localStorage 전체 진단</h3>
      <div style="font-size:13px;color:#333;margin-bottom:10px;">
        브라우저 localStorage 한계(~5MB)에 도달했습니다.<br>
        총 사용량: <b>${diag.totalKB} KB</b> · 키 ${diag.keys.length}개
      </div>
      <div style="font-size:12px;color:#666;margin-bottom:6px;">용량 상위 키 (☆ = 보호 키, 지우지 않음):</div>
      <div style="border:1px solid #e0e0e0;border-radius:8px;overflow:auto;flex:1;max-height:300px;">
        <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
          <tbody>
            ${diag.topKeys.map((k, i) => `
              <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:6px 8px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,Menlo,Consolas,monospace;${k.protected ? 'color:#888;' : ''}">
                  ${k.protected ? '☆ ' : ''}${escHtml(k.key)}
                </td>
                <td style="padding:6px 8px;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;">${(k.size/1024).toFixed(1)} KB</td>
                <td style="padding:6px 8px;text-align:right;">
                  ${k.protected
                    ? '<span style="color:#aaa;font-size:11px;">보호</span>'
                    : `<button data-rm="${escHtml(k.key)}" style="background:#fff2f2;border:1px solid #f5b5b5;color:#c62828;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;">삭제</button>`}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:8px;padding:10px 12px;background:#f0f8ff;border:1px solid #b3d4f0;border-radius:8px;font-size:12.5px;color:#1a3a5a;">
        💡 <b>5MB 한계가 답답하다면?</b> "디바이스 저장 모드" 한 번만 켜면 이후 모든 메모가
        IndexedDB(수GB 가능)에 저장돼 5MB 제약이 사실상 사라집니다.
      </div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
        <button data-act="full-idb" style="flex:1;min-width:140px;background:#1976d2;color:#fff;border:1px solid #1565c0;border-radius:8px;padding:9px;font-weight:700;cursor:pointer;">📦 디바이스 저장 모드 ON (권장)</button>
        <button data-act="auto" style="flex:1;min-width:120px;background:#fae100;border:1px solid #d4bc00;border-radius:8px;padding:8px;font-weight:700;cursor:pointer;">백업·잔해 정리</button>
        <button data-act="reload" style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:8px 12px;cursor:pointer;">새로고침</button>
        <button data-act="close" style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:8px 12px;cursor:pointer;">닫기</button>
      </div>
    `;
    back.appendChild(card);
    document.body.appendChild(back);

    card.addEventListener('click', async (e) => {
      const rm = e.target.closest('[data-rm]')?.dataset.rm;
      if (rm) {
        if (confirm(`"${rm}" 키를 삭제할까요? 이 앱이 이 키를 쓰고 있다면 관련 데이터가 사라질 수 있습니다.`)) {
          try { origRemoveItem.call(localStorage, rm); toastOnce('삭제됨: ' + rm); }
          catch (err) { toastOnce('삭제 실패: ' + err.message); }
          const row = e.target.closest('tr'); row?.remove();
        }
        return;
      }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      if (act === 'close') { back.remove(); dialogShown = false; return; }
      if (act === 'reload') { location.reload(); return; }
      if (act === 'auto') {
        const freed = autoCleanNonEssential();
        toastOnce(`정리 완료 — ${Math.round(freed/1024)}KB 확보`);
        back.remove(); dialogShown = false;
        window.__storageQuotaPatch.clearLockdown();
        return;
      }
      if (act === 'state-to-idb' || act === 'full-idb') {
        // state-to-idb 는 1회 이관, full-idb 는 영구 모드
        const ok = await enterFullIdbMode();
        if (ok && act === 'full-idb') {
          // 추가로 남은 백업 키들 정리
          cleanOldBackups();
        }
        back.remove(); dialogShown = false;
        window.__storageQuotaPatch.clearLockdown();
      }
    });
  }

  function escHtml(s) { return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // ======================================================================
  // setItem 몽키패치
  // ======================================================================
  const proto = Object.getPrototypeOf(localStorage);
  const origSetItem = proto.setItem;
  const origGetItem = proto.getItem;
  const origRemoveItem = proto.removeItem;

  proto.setItem = function patchedSetItem(key, value) {
    if (lockdown && Date.now() > lockdownUntil) {
      lockdown = false; dialogShown = false; quotaErrorTimestamps = [];
      log('lockdown expired');
    }
    if (lockdown && key === STORAGE_KEY) return;
    if (key === STORAGE_KEY && Date.now() < cooldownUntil) return;

    // Full IDB 모드: STORAGE_KEY 쓰기는 전부 IDB 로 라우팅, localStorage 엔 포인터만
    if (fullIdbMode && key === STORAGE_KEY && typeof value === 'string') {
      // 포인터 쓰기 자체는 localStorage 로 (30바이트)
      if (value.startsWith('{"__stateInIdb"')) return origSetItem.call(this, key, value);
      // 실제 state 데이터 → IDB 로
      (async () => {
        try {
          let parsed = null; try { parsed = JSON.parse(value); } catch {}
          if (parsed) await window.__idbStore.setKV(IDB_STATE_KEY, parsed);
          const pointer = JSON.stringify({ __stateInIdb: true, key: IDB_STATE_KEY, at: Date.now() });
          origSetItem.call(localStorage, key, pointer);
        } catch (e) { log('full-idb setItem', e); }
      })();
      return;
    }

    try {
      return origSetItem.call(this, key, value);
    } catch (e) {
      if (e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014)) {
        if (key !== STORAGE_KEY) throw e;
        if (recordQuotaError()) return;
        cooldownUntil = Date.now() + COOLDOWN_MS;
        (async () => {
          const payload = await recoverPayload(key, value);
          if (payload) {
            try {
              origSetItem.call(localStorage, key, payload);
              window.lastSaveSize = payload.length;
              try { window.updateStorageIndicator?.(); } catch {}
              toastOnce(`공간 확보 — ${Math.round(payload.length/1024)}KB`);
            } catch {
              enterLockdown();
            }
          } else if (!lockdown) {
            // autoCleanNonEssential 이 직접 성공했으면 payload null
            // → 확인 후 lockdown 안 걸린 상태면 그냥 통과
            try {
              origSetItem.call(localStorage, key, value);
              toastOnce('비핵심 키 정리 후 저장 성공');
            } catch {
              enterLockdown();
            }
          }
        })();
        return;
      }
      throw e;
    }
  };

  // 부팅: 포인터 hydrate (v1.3.0과 동일)
  (async () => {
    try {
      const raw = origGetItem.call(localStorage, STORAGE_KEY);
      if (!raw) return;
      let parsed; try { parsed = JSON.parse(raw); } catch { return; }
      if (parsed?.__stateInIdb && window.__idbStore?.getKV) {
        const real = await window.__idbStore.getKV(parsed.key || IDB_STATE_KEY);
        if (real && typeof real === 'object') {
          const tryInject = () => {
            if (!window.state) return false;
            Object.assign(window.state, real);
            try { window.renderSidebar?.(); } catch {}
            try { if (real.activeId) window.setActive?.(real.activeId); } catch {}
            return true;
          };
          if (!tryInject()) {
            let tries = 0;
            const iv = setInterval(() => { if (tryInject() || ++tries > 50) clearInterval(iv); }, 100);
          }
        }
      }
    } catch (e) { log('boot hydrate', e); }
  })();

  // 전역 디버그
  window.__storageQuotaPatch = {
    version: '1.5.0',
    diagnose,
    autoCleanNonEssential,
    cleanOldBackups,
    enterFullIdbMode,
    isFullIdbMode: () => fullIdbMode,
    clearCooldown() { cooldownUntil = 0; lockdown = false; dialogShown = false; quotaErrorTimestamps = []; log('cleared'); },
    clearLockdown() { lockdown = false; dialogShown = false; quotaErrorTimestamps = []; log('lockdown cleared'); },
    async forceSlim() { return { saved: await hardSlimState() }; },
    showDialog() { showLockdownDialog(diagnose()); },
    isLockdown: () => lockdown,
  };

  // 부팅 직후: 백업 과다 자동 정리 + 용량 초과 시 비핵심 정리
  window.addEventListener('load', () => {
    setTimeout(() => {
      // 1) 백업이 3개 넘으면 최신 2개만 유지 (큰 절약)
      const freed = cleanOldBackups();
      if (freed > 0) log('load-time backup cleanup freed', Math.round(freed/1024), 'KB');
      // 2) 그래도 여전히 4MB 초과면 비핵심 키 청소
      const d = diagnose();
      if (d.totalBytes > SAFE_BUDGET) {
        log('localStorage still over budget:', d.totalKB, 'KB');
        autoCleanNonEssential();
      }
    }, 2500);
  });
})();
