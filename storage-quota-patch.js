/**
 * justanotepad · Storage Quota Patch (v1.3.0)
 * --------------------------------------------------------------------------
 * v1.2.0 의 문제:
 *   - state-in-IDB 포인터로 교체 후에도, 원본 save() 는 여전히 원래 state 를
 *     JSON.stringify 해 setItem 을 호출 → 또 QuotaExceededError → 또 복구 →
 *     "공간 확보 완료" 토스트가 무한히 깜빡이는 루프 발생.
 *
 * v1.3.0 근본 수정:
 *   1. state 객체를 실제로 mutation — 큰 탭의 html 을 작은 IDB 참조로
 *      치환해서 다음 save() 호출의 JSON.stringify 크기도 작아지게 만든다.
 *   2. 루프 감지 — 10초 내 3회 이상 QuotaExceededError 시 Lockdown 모드.
 *      Lockdown 모드에서는 setItem 전부 silent skip, 토스트 1회만, 사용자에게
 *      "새로고침 후 이미지 제거 필요" 안내창 한 번만 표시.
 *   3. 토스트 dedup — 같은 메시지 3초 내 재표시 차단.
 *   4. 긴 쿨다운 — 복구 성공 후 500ms → 3000ms 로 연장 (루프 완화).
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.__storageQuotaPatch && window.__storageQuotaPatch.version === '1.3.0') return;

  const STORAGE_KEY     = 'sticky-memo-v4';
  const SAFE_BUDGET     = 4 * 1024 * 1024;
  const COOLDOWN_MS     = 3000;               // 복구 후 쿨다운 연장
  const IDB_STATE_KEY   = 'sticky-memo-v4:state';
  const LOOP_WINDOW_MS  = 10000;
  const LOOP_THRESHOLD  = 3;
  const LOCKDOWN_MS     = 10 * 60 * 1000;     // 10분 lockdown

  let cooldownUntil = 0;
  let recovering = false;
  let dialogShown = false;
  let quotaErrorTimestamps = [];
  let lockdown = false;
  let lockdownUntil = 0;
  let lastToastText = '';
  let lastToastAt = 0;

  const log = (...a) => console.log('[quota-patch]', ...a);
  log('v1.3.0 applied');

  // ---- 유틸 ----
  const getState = () => window.state || null;
  const stateSize = () => { try { return JSON.stringify(getState() || {}).length; } catch { return 0; } };

  function toastOnce(text) {
    const now = Date.now();
    if (text === lastToastText && now - lastToastAt < 3000) return; // dedup
    lastToastText = text; lastToastAt = now;
    try { if (typeof window.toast === 'function') return window.toast(text); } catch {}
    console.log('[toast]', text);
  }

  // ---- 큰 탭 진단 ----
  function diagnose() {
    const s = getState() || {};
    const tabs = (s.tabs || []).map(t => ({
      id: t.id, name: (t.name || '(무제)').slice(0, 24),
      size: ((t.html || '') + (t.raw || '')).length,
    })).sort((a, b) => b.size - a.size);
    return {
      total: stateSize(),
      tabCount: (s.tabs || []).length,
      top: tabs.slice(0, 5),
      histSize: JSON.stringify(s.history || []).length,
      trashSize: JSON.stringify(s.trash || []).length,
    };
  }

  // ---- state 직접 슬림화: 큰 탭의 html 안의 base64 이미지를 IDB로 옮기고
  //      data:image/... → idb:hash 참조로 치환 ----
  async function hardSlimState() {
    const s = getState();
    if (!s || !Array.isArray(s.tabs)) return 0;

    let slimmedBytes = 0;
    let idb = window.__idbStore;
    // base64 감지 정규식 (최소 2KB 이상만)
    const DATA_URL_RE = /data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]{2000,}/g;

    for (const tab of s.tabs) {
      if (!tab.html || typeof tab.html !== 'string') continue;
      const before = tab.html.length;
      if (before < 2048) continue;

      if (idb?.putBlob && idb?.externalizeState) {
        // externalizeState 는 탭 단위가 아닌 전체 state 를 받음. 우선 시도.
        // 실패하면 inline regex replace.
      }

      // inline replace: 큰 data URL 발견할 때마다 Blob 으로 옮김
      const matches = tab.html.match(DATA_URL_RE);
      if (!matches?.length) continue;

      for (const dataUrl of matches) {
        try {
          if (!idb?.putBlob) {
            // IDB store 없으면 아예 썸네일 placeholder 로 치환
            tab.html = tab.html.replace(dataUrl, 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="%23eee"/><text x="60" y="44" text-anchor="middle" font-family="sans-serif" font-size="11" fill="%23888">이미지 제거됨</text></svg>');
            slimmedBytes += dataUrl.length;
          } else {
            // base64 → Blob → IDB put
            const mime = (dataUrl.match(/data:([^;]+);/) || [])[1] || 'image/png';
            const b64 = dataUrl.split(',')[1];
            const bin = atob(b64);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            const blob = new Blob([arr], { type: mime });
            const hash = await idb.putBlob(blob);
            tab.html = tab.html.replace(dataUrl, `idb://${hash}`);
            slimmedBytes += dataUrl.length;
          }
        } catch (e) { log('slim tab err', e); break; }
      }
      log(`slim tab "${tab.name}" ${before} → ${tab.html.length} bytes`);
    }
    return slimmedBytes;
  }

  // ---- 복구 파이프라인 ----
  async function recoverPayload(key, originalValue) {
    if (key !== STORAGE_KEY) return null;
    if (recovering) return null;
    recovering = true;
    try {
      // 1) state 직접 슬림화 (큰 base64 이미지를 IDB 참조로)
      const slimmed = await hardSlimState();
      if (slimmed > 0) {
        const payload = JSON.stringify(getState());
        if (payload.length < SAFE_BUDGET) {
          log('recovered via hard slim', slimmed, '→', payload.length);
          return payload;
        }
      }

      // 2) history/trash 완전 제거 (재시도)
      const s = getState();
      if (s) {
        const prevH = s.history?.length || 0, prevT = s.trash?.length || 0;
        if (prevH + prevT > 0) {
          s.history = [];
          s.trash = [];
          const payload = JSON.stringify(s);
          if (payload.length < SAFE_BUDGET) {
            log('recovered by wiping history/trash', prevH, prevT);
            return payload;
          }
        }
      }

      // 3) 그래도 실패 — state 통째로 IDB 로, localStorage 엔 포인터만
      if (window.__idbStore?.setKV) {
        try {
          await window.__idbStore.setKV(IDB_STATE_KEY, getState());
          const pointer = JSON.stringify({ __stateInIdb: true, key: IDB_STATE_KEY, at: Date.now() });
          log('recovered via full state-to-idb');
          return pointer;
        } catch (e) { log('state-to-idb failed', e); }
      }

      return null;
    } finally { recovering = false; }
  }

  // ---- 루프 감지 → Lockdown ----
  function recordQuotaError() {
    const now = Date.now();
    quotaErrorTimestamps = quotaErrorTimestamps.filter(t => now - t < LOOP_WINDOW_MS);
    quotaErrorTimestamps.push(now);
    if (quotaErrorTimestamps.length >= LOOP_THRESHOLD && !lockdown) {
      enterLockdown();
      return true;
    }
    return false;
  }

  function enterLockdown() {
    lockdown = true;
    lockdownUntil = Date.now() + LOCKDOWN_MS;
    const d = diagnose();
    log('LOCKDOWN', d);

    // 사용자에게 한 번만 안내
    if (!dialogShown) {
      dialogShown = true;
      setTimeout(() => {
        const biggest = d.top.map(t => `  · ${t.name}: ${(t.size/1024).toFixed(0)} KB`).join('\n');
        const msg =
          '저장 공간이 반복적으로 초과되어 자동 저장을 10분 동안 멈춥니다.\n\n' +
          `상위 5개 탭 크기:\n${biggest}\n\n` +
          '해결 방법:\n' +
          '  1. 가장 큰 탭을 열어 붙여넣은 이미지를 삭제하세요\n' +
          '  2. 또는 브라우저를 새로고침 (Ctrl+Shift+R)\n' +
          '  3. 콘솔에서 __storageQuotaPatch.clearLockdown() 입력 시 복구';
        alert(msg);
      }, 400);
    }
    toastOnce('저장 일시 중지 — 큰 이미지를 삭제하거나 새로고침하세요');
  }

  // ---- localStorage.setItem 몽키패치 ----
  const proto = Object.getPrototypeOf(localStorage);
  const origSetItem = proto.setItem;
  const origGetItem = proto.getItem;

  proto.setItem = function patchedSetItem(key, value) {
    // Lockdown 만료 체크
    if (lockdown && Date.now() > lockdownUntil) {
      lockdown = false; dialogShown = false; quotaErrorTimestamps = [];
      log('lockdown expired');
    }
    if (lockdown && key === STORAGE_KEY) return; // 조용히 drop

    if (key === STORAGE_KEY && Date.now() < cooldownUntil) return;

    try {
      return origSetItem.call(this, key, value);
    } catch (e) {
      if (e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014)) {
        if (key !== STORAGE_KEY) throw e;

        if (recordQuotaError()) return; // Lockdown 진입 → 조용히 drop

        cooldownUntil = Date.now() + COOLDOWN_MS;
        (async () => {
          const payload = await recoverPayload(key, value);
          if (payload) {
            try {
              origSetItem.call(localStorage, key, payload);
              window.lastSaveSize = payload.length;
              try { window.updateStorageIndicator?.(); } catch {}
              toastOnce(`저장 공간 확보 — ${Math.round(payload.length/1024)}KB`);
            } catch (e2) {
              log('retry write failed', e2);
              enterLockdown();
            }
          } else {
            enterLockdown();
          }
        })();
        return;
      }
      throw e;
    }
  };

  // ---- 부팅: 포인터면 IDB 에서 state 복원 ----
  (async () => {
    try {
      const raw = origGetItem.call(localStorage, STORAGE_KEY);
      if (!raw) return;
      let parsed; try { parsed = JSON.parse(raw); } catch { return; }
      if (parsed?.__stateInIdb && window.__idbStore?.getKV) {
        log('hydrating state from IDB');
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

  // ---- 전역 디버그 ----
  window.__storageQuotaPatch = {
    version: '1.3.0',
    diagnose,
    clearCooldown() { cooldownUntil = 0; lockdown = false; dialogShown = false; quotaErrorTimestamps = []; log('cooldown + lockdown cleared'); },
    clearLockdown() { lockdown = false; dialogShown = false; quotaErrorTimestamps = []; log('lockdown cleared'); },
    async forceSlim() {
      const before = stateSize();
      const slimmed = await hardSlimState();
      const after = stateSize();
      return { before, after, slimmed };
    },
    isLockdown: () => lockdown,
  };

  // ---- 부팅 직후 선제 슬림화 (state 가 이미 크면) ----
  window.addEventListener('load', () => {
    setTimeout(async () => {
      if (stateSize() > SAFE_BUDGET) {
        log('state > budget on load, preemptive slim');
        await hardSlimState();
      }
    }, 2000);
  });
})();
