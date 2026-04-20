/**
 * justanotepad · Storage Quota Patch (v1.2.0)
 * --------------------------------------------------------------------------
 * 증상:
 *   "저장 공간 부족 — 현재 사용량 N KB / 전체 할당 585391102KB" 다이얼로그가
 *   타이핑·탭전환마다 계속 반복해서 뜸. 실제 사용량은 1~2MB에 불과.
 *
 * 원인:
 *   app.html 내 `async function save()` 가 지역 스코프라 window.save 로는
 *   접근 불가 → v1.1.0 패치는 save() 를 감싸지 못해 사실상 no-op 이었다.
 *
 *   근본 원인은 state 안에 누적된 탭의 inline base64 이미지 + history/trash
 *   가 커져서 슬림 JSON 이 여전히 5MB(localStorage 하드캡)를 넘는 것.
 *   navigator.storage.estimate() 는 origin 전체 quota(585GB)를 반환하므로
 *   "585GB 중 1MB 썼는데 왜 거부?" 라는 모순된 다이얼로그가 생긴다.
 *
 * v1.2.0 이 하는 일 (근본 수정):
 *   localStorage.setItem 자체를 몽키패치. QuotaExceededError 를 잡아
 *   자동 복구한 뒤 재시도. 성공하면 호출자는 에러를 못 봄 → 다이얼로그
 *   애초에 안 뜸.
 *
 *   자동 복구 순서:
 *     1. IDB 외부화 (window.__idbStore.externalizeState)
 *     2. state.history / state.trash 트리밍 (최신 20% 유지)
 *     3. state.history / state.trash 를 통째로 IDB 로 격리
 *     4. state 전체를 IDB 로 이관, localStorage 에는 포인터만
 *
 *   1~4 모두 실패해야 쿨다운 플래그 + 사용자 대화 한 번.
 *   타이핑·탭전환이 scheduleSave 를 계속 호출해도 쿨다운 동안은 setItem
 *   이 조용히 skip 되므로 다이얼로그 루프가 발생하지 않음.
 *
 * 통합 (이미 적용됨):
 *   <script src="/storage-quota-patch.js"></script>
 *
 * 디버그 엔드포인트:
 *   window.__storageQuotaPatch.version         // '1.2.0'
 *   window.__storageQuotaPatch.diagnose()      // 현재 크기 분석
 *   window.__storageQuotaPatch.clearCooldown() // 쿨다운 즉시 해제
 *   window.__storageQuotaPatch.forceRecover()  // 수동으로 4단계 복구 실행
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.__storageQuotaPatch && window.__storageQuotaPatch.version === '1.2.0') return;
  if (window.__storageQuotaPatch) {
    console.log('[quota-patch] v1.2.0 upgrading from', window.__storageQuotaPatch.version);
  }

  const STORAGE_KEY     = 'sticky-memo-v4';
  const SAFE_BUDGET     = 4 * 1024 * 1024;   // 4MB 넘으면 선제 트리밍
  const TRIM_KEEP_RATIO = 0.2;               // history/trash 최신 20%만 남김
  const COOLDOWN_MS     = 8000;              // 대화창 동안 setItem 스킵
  const IDB_STATE_KEY   = 'sticky-memo-v4:state';

  // 공유 상태
  let cooldownUntil = 0;
  let recovering = false;
  let dialogOpen = false;

  const log = (...a) => console.log('[quota-patch]', ...a);
  log('v1.2.0 applied');

  // ---- 유틸 ----
  const getState = () => window.state || null;
  const stateSize = () => { try { return JSON.stringify(getState() || {}).length; } catch { return 0; } };
  const toastSafe = (t) => { try { if (typeof window.toast === 'function') return window.toast(t); } catch {} console.log('[toast]', t); };

  // ---- 복구 루틴 ----
  async function idbExternalize() {
    if (!window.__idbStore || !window.__idbStore.externalizeState) return null;
    try {
      const slim = await window.__idbStore.externalizeState(getState(), { minBytes: 2 * 1024 });
      return JSON.stringify(slim);
    } catch (e) { log('externalize failed', e); return null; }
  }

  function trimHistoryAndTrash() {
    const s = getState(); if (!s) return 0;
    let trimmed = 0;
    ['history', 'trash'].forEach(k => {
      const arr = s[k];
      if (!Array.isArray(arr) || !arr.length) return;
      const keep = Math.max(3, Math.floor(arr.length * TRIM_KEEP_RATIO));
      if (arr.length > keep) { trimmed += arr.length - keep; s[k] = arr.slice(-keep); }
    });
    return trimmed;
  }

  async function archiveHeavyFields() {
    const s = getState(); if (!s) return false;
    const archive = { history: s.history || [], trash: s.trash || [], at: Date.now() };
    try {
      if (window.__idbStore?.setKV) await window.__idbStore.setKV('archived:history-trash', archive);
      else window.__archivedHistoryTrash = archive;
      s.history = []; s.trash = [];
      return true;
    } catch (e) { log('archive failed', e); return false; }
  }

  async function moveStateToIdb() {
    const s = getState(); if (!s) return false;
    if (!window.__idbStore?.setKV) return false;
    try {
      await window.__idbStore.setKV(IDB_STATE_KEY, s);
      return JSON.stringify({ __stateInIdb: true, key: IDB_STATE_KEY, at: Date.now() });
    } catch (e) { log('moveStateToIdb failed', e); return false; }
  }

  // 4단계 복구 파이프라인. 성공 시 payload 문자열 반환, 실패 시 null.
  async function recoverPayload(key, originalValue) {
    if (key !== STORAGE_KEY) return null;
    if (recovering) return null;
    recovering = true;
    try {
      // 1) IDB 외부화
      const slim = await idbExternalize();
      if (slim && slim.length < SAFE_BUDGET) { log('recovered via externalize', slim.length); return slim; }

      // 2) history/trash 트리밍
      const trimmed = trimHistoryAndTrash();
      if (trimmed > 0) {
        const payload = JSON.stringify(getState());
        if (payload.length < SAFE_BUDGET) { log('recovered via trim', trimmed, payload.length); return payload; }
      }

      // 3) history/trash IDB 격리
      if (await archiveHeavyFields()) {
        const payload = JSON.stringify(getState());
        if (payload.length < SAFE_BUDGET) { log('recovered via archive', payload.length); return payload; }
      }

      // 4) state 전체 IDB 로
      const pointer = await moveStateToIdb();
      if (pointer) { log('recovered via state-to-idb'); return pointer; }

      return null;
    } finally { recovering = false; }
  }

  // ---- localStorage.setItem 몽키패치 ----
  const proto = Object.getPrototypeOf(localStorage);
  const origSetItem = proto.setItem;
  const origGetItem = proto.getItem;

  proto.setItem = function patchedSetItem(key, value) {
    // 쿨다운 중인 STORAGE_KEY 저장은 조용히 drop (다이얼로그 루프 차단)
    if (key === STORAGE_KEY && Date.now() < cooldownUntil) {
      log('setItem suppressed (cooldown)', key);
      return;
    }

    // 선제 트리밍: 너무 크면 미리 줄임
    if (key === STORAGE_KEY && typeof value === 'string' && value.length > SAFE_BUDGET) {
      const trimmed = trimHistoryAndTrash();
      if (trimmed > 0) {
        try { value = JSON.stringify(getState()); log('preemptive trim', trimmed, value.length); } catch {}
      }
    }

    try {
      return origSetItem.call(this, key, value);
    } catch (e) {
      if (e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014)) {
        if (key !== STORAGE_KEY) throw e; // 다른 키면 그대로
        log('QuotaExceededError intercepted for', key, '· payload', (value||'').length, 'bytes');

        // 비동기 복구를 시작하되, 이 setItem 호출은 throw 하지 않고 성공처럼 반환
        // (원본 save() 의 catch 블록에서 다이얼로그가 뜨지 않도록).
        // 복구가 완료되면 별도로 localStorage 에 기록됨.
        setCooldown(COOLDOWN_MS);

        (async () => {
          const payload = await recoverPayload(key, value);
          if (payload) {
            try {
              origSetItem.call(localStorage, key, payload);
              window.lastSaveSize = payload.length;
              try { window.updateStorageIndicator?.(); } catch {}
              toastSafe(`공간 확보 완료 — ${Math.round(payload.length/1024)}KB 로 슬림화됨`);
              cooldownUntil = Date.now() + 500; // 짧은 쿨다운으로 후속 저장은 바로 허용
            } catch (e2) { log('retry write after recovery failed', e2); await openRecoveryDialog(); }
          } else {
            await openRecoveryDialog();
          }
        })();

        return; // 원본 호출자는 성공한 것으로 간주
      }
      throw e;
    }
  };

  function setCooldown(ms) { cooldownUntil = Math.max(cooldownUntil, Date.now() + ms); }

  // 원본 getItem 도 감싸서 IDB 포인터면 그대로 리턴 (원본 코드는 파싱 후 문제 없음)
  // — 여기선 변경할 필요 없음 (load 시 별도 hydrate 루틴에서 처리)

  // ---- 부팅: 포인터 감지 + 앱 state 에 주입 ----
  (async () => {
    try {
      const raw = origGetItem.call(localStorage, STORAGE_KEY);
      if (!raw) return;
      let parsed;
      try { parsed = JSON.parse(raw); } catch { return; }
      if (parsed && parsed.__stateInIdb && window.__idbStore?.getKV) {
        log('IDB-state pointer detected, hydrating from IDB');
        const real = await window.__idbStore.getKV(parsed.key || IDB_STATE_KEY);
        if (real && typeof real === 'object') {
          // 앱이 이미 빈 state 로 부팅 직후라면 Object.assign 으로 주입
          const tryInject = () => {
            if (!window.state) return false;
            Object.assign(window.state, real);
            try { window.renderSidebar?.(); } catch {}
            try { if (real.activeId) window.setActive?.(real.activeId); } catch {}
            log('state hydrated from IDB');
            return true;
          };
          if (!tryInject()) {
            // state 가 아직 없으면 정의되기를 기다림
            let tries = 0;
            const iv = setInterval(() => { if (tryInject() || ++tries > 50) clearInterval(iv); }, 100);
          }
        }
      }
    } catch (e) { log('IDB hydrate failed', e); }
  })();

  // ---- 마지막 보루: 에러가 원본 save() 의 catch 로 샜을 경우 대비 ----
  async function openRecoveryDialog() {
    if (dialogOpen) return;
    dialogOpen = true;
    setCooldown(COOLDOWN_MS);
    try {
      const kb = Math.round(stateSize() / 1024);
      const diag = diagnose();
      const lines = [
        `localStorage 한계(~5MB)에 도달했고, 자동 복구도 실패했습니다.`,
        `현재 state: ${kb}KB`,
        `큰 탭: ${diag.tabs.map(t => `${t.name} ${Math.round(t.size/1024)}KB`).join(', ') || '없음'}`,
        `히스토리 ${Math.round(diag.histSize/1024)}KB · 휴지통 ${Math.round(diag.trashSize/1024)}KB`,
        ``,
        `확인 = 히스토리·휴지통 완전 비우고 IDB 이관 시도`,
        `취소 = 자동 저장 1시간 정지 (수동 새로고침 필요)`,
      ];
      if (confirm(lines.join('\n'))) {
        const s = getState();
        if (s) { s.history = []; s.trash = []; }
        const pointer = await moveStateToIdb();
        if (pointer) {
          try { origSetItem.call(localStorage, STORAGE_KEY, pointer); toastSafe('복구 완료 — IDB 이관'); }
          catch (e) { log('final fallback failed', e); }
        }
      } else {
        cooldownUntil = Date.now() + 60 * 60 * 1000;
        toastSafe('자동 저장 1시간 정지 — 새로고침 후 재시도 가능');
      }
    } finally { dialogOpen = false; }
  }

  function diagnose() {
    const s = getState() || {};
    const tabs = (s.tabs || [])
      .map(t => ({ name: (t.name || '(무제)').slice(0, 30), size: (t.html || '').length + (t.raw || '').length }))
      .sort((a, b) => b.size - a.size).slice(0, 5);
    return {
      tabs,
      histSize: JSON.stringify(s.history || []).length,
      trashSize: JSON.stringify(s.trash || []).length,
      attemptKB: Math.round(JSON.stringify(s).length / 1024),
      stateInIdbPointer: !!(() => { try { return JSON.parse(origGetItem.call(localStorage, STORAGE_KEY))?.__stateInIdb; } catch { return false; } })(),
    };
  }

  // ---- 전역 디버그 ----
  window.__storageQuotaPatch = {
    version: '1.2.0',
    diagnose,
    clearCooldown() { cooldownUntil = 0; dialogOpen = false; recovering = false; log('cooldown cleared'); },
    async forceRecover() {
      const value = origGetItem.call(localStorage, STORAGE_KEY) || '';
      const payload = await recoverPayload(STORAGE_KEY, value);
      if (payload) origSetItem.call(localStorage, STORAGE_KEY, payload);
      return payload ? Math.round(payload.length/1024) + 'KB' : 'failed';
    },
    trim: trimHistoryAndTrash,
    moveStateToIdb,
    archiveHeavyFields,
  };

  // 부팅 직후 선제적으로 state 크기 체크 → 이미 크면 자동 슬림화
  window.addEventListener('load', async () => {
    setTimeout(async () => {
      const s = getState();
      if (!s) return;
      const sz = stateSize();
      if (sz > SAFE_BUDGET) {
        log('state already over budget on load:', Math.round(sz/1024), 'KB — auto-slimming');
        await window.__storageQuotaPatch.forceRecover();
      }
    }, 2000);
  });
})();
