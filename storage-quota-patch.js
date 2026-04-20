/**
 * justanotepad · Storage Quota Patch (v1.1.0)
 * --------------------------------------------------------------------------
 * 증상:
 *   · "저장 공간 부족 — 현재 사용량 1411KB / 전체 할당 585391102KB" 다이얼로그가
 *     계속 반복해서 뜸
 *
 * 원인 (기존 app.html 3640-3780 라인):
 *   1) 다이얼로그가 보여주는 숫자는 navigator.storage.estimate() (origin 전체).
 *      그러나 실제로 실패한 건 localStorage 의 별개 5MB 하드캡. 두 숫자가 달라서
 *      "585GB 남았는데 왜?" 라는 모순이 생김.
 *   2) 타이핑 · 탭 전환 · 마우스 이동이 scheduleSave → save 를 계속 트리거하는데,
 *      save 가 실패하면 다이얼로그만 띄우고 상태를 바꾸지 않으므로 루프가 발생.
 *   3) externalizeState 후에도 state.history / state.trash 에 inline 본문이
 *      남아있어 slim JSON 이 여전히 5MB 를 넘는 경우가 있음.
 *
 * 이 패치가 하는 일:
 *   A) save() / handleQuotaExceeded() 를 런타임에 감싸서
 *      - 쿨다운 플래그로 재진입 차단 (다이얼로그가 닫힐 때까지 save 멈춤)
 *      - 정확한 메시지: "localStorage 한계 ~5MB · 슬림 저장 시도 N KB"
 *      - 실패 원인 실태: 상위 3 탭 / 히스토리 / 휴지통 크기를 한 화면에 표시
 *   B) 자동 복구 경로를 넓힘:
 *      - history / trash 자동 트리밍 (오래된 것 80% 삭제) 후 재시도
 *      - 여전히 실패면 history/trash 를 IndexedDB 로 격리 (state 에서 제거)
 *      - 마지막 수단으로 state 전체를 IndexedDB 에 넣고 localStorage 에는
 *        포인터만 남김 ("state-in-idb")
 *   C) 사용자에게 한 번만 묻고, 선택이 끝나면 쿨다운 해제
 *
 * 통합 (app.html, </body> 직전, 다른 patch 들 다음에):
 *   <script src="./storage-quota-patch.js"></script>
 *
 * 적용 대상: justanotepad v1.0.9 이하. v1.1.0 에서 정식 수정 계획.
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.__storageQuotaPatchApplied) return;
  window.__storageQuotaPatchApplied = true;

  const STORAGE_KEY    = 'sticky-memo-v4';
  const LS_HARD_LIMIT  = 5 * 1024 * 1024;   // 실측 보수값. 브라우저별 4.8~10MB.
  const SAFE_BUDGET    = 4 * 1024 * 1024;   // 이 선을 넘으면 선제 트리밍
  const TRIM_KEEP_RATIO = 0.2;              // history/trash 에서 최신 20%만 유지
  const COOLDOWN_MS    = 8000;              // 다이얼로그 중 재진입 차단
  const IDB_STATE_KEY  = 'sticky-memo-v4:state';

  // 외부 상태
  let cooldownUntil = 0;
  let dialogOpen = false;
  let lastFailKB = 0;

  // 안전한 getter 들
  const getState = () => window.state || null;
  const setItemRaw = (k, v) => localStorage.setItem(k, v);
  const getStateSize = () => { try { return JSON.stringify(getState() || {}).length; } catch { return 0; } };

  // --------------------------------------------------------------
  // 0. 로거
  // --------------------------------------------------------------
  const log = (...a) => console.log('[quota-patch]', ...a);
  log('applied. STORAGE_KEY =', STORAGE_KEY, 'LS_HARD_LIMIT =', LS_HARD_LIMIT);

  // --------------------------------------------------------------
  // 1. history / trash 트리밍 (큰 원흉)
  //    - state.history / state.trash 의 최신 N 개만 남기고 제거
  // --------------------------------------------------------------
  function trimHistoryAndTrash() {
    const s = getState(); if (!s) return { trimmed: 0 };
    let trimmed = 0;
    ['history', 'trash'].forEach(k => {
      const arr = s[k];
      if (!Array.isArray(arr) || !arr.length) return;
      const keep = Math.max(5, Math.floor(arr.length * TRIM_KEEP_RATIO));
      if (arr.length > keep) {
        trimmed += arr.length - keep;
        s[k] = arr.slice(-keep); // 최신 keep 개만
      }
    });
    return { trimmed };
  }

  // --------------------------------------------------------------
  // 2. history/trash 를 통째로 IndexedDB 로 격리 (state 에서 제거)
  //    - 복구 시 다른 패치/기능에서 읽을 수 있도록 window.__archivedHistory/Trash 에도 보관
  // --------------------------------------------------------------
  async function archiveHeavyFields() {
    const s = getState(); if (!s) return false;
    const archive = {
      history: s.history || [],
      trash: s.trash || [],
      at: Date.now()
    };
    try {
      if (window.__idbStore && window.__idbStore.setKV) {
        await window.__idbStore.setKV('archived:history-trash', archive);
      } else {
        // IDB 미지원: 그냥 메모리에 둔다 (세션 종료 시 손실됨을 경고)
        window.__archivedHistoryTrash = archive;
      }
      s.history = [];
      s.trash = [];
      return true;
    } catch (e) {
      log('archiveHeavyFields failed', e);
      return false;
    }
  }

  // --------------------------------------------------------------
  // 3. 최후 수단: state 전체를 IDB 에 넣고 localStorage 에는 포인터만
  // --------------------------------------------------------------
  async function moveStateToIdb() {
    const s = getState(); if (!s) return false;
    try {
      if (!window.__idbStore || !window.__idbStore.setKV) return false;
      await window.__idbStore.setKV(IDB_STATE_KEY, s);
      const pointer = JSON.stringify({ __stateInIdb: true, key: IDB_STATE_KEY, at: Date.now() });
      setItemRaw(STORAGE_KEY, pointer);
      return true;
    } catch (e) { log('moveStateToIdb failed', e); return false; }
  }

  // --------------------------------------------------------------
  // 4. 정확한 진단 보고서
  // --------------------------------------------------------------
  function diagnose(attemptPayload) {
    const s = getState() || {};
    const tabs = (s.tabs || [])
      .map(t => ({ name: (t.name || '(무제)').slice(0, 30), size: (t.html || '').length + (t.raw || '').length }))
      .sort((a, b) => b.size - a.size).slice(0, 5);
    const histSize = JSON.stringify(s.history || []).length;
    const trashSize = JSON.stringify(s.trash || []).length;
    const attemptKB = attemptPayload ? Math.round(attemptPayload.length / 1024) : Math.round(JSON.stringify(s).length / 1024);
    return { tabs, histSize, trashSize, attemptKB };
  }

  // --------------------------------------------------------------
  // 5. save() 래퍼 — 쿨다운, 선제 트리밍, 자세한 폴백
  // --------------------------------------------------------------
  function wrapSave() {
    const orig = window.save;
    if (typeof orig !== 'function') {
      log('window.save not found — will retry when available');
      setTimeout(wrapSave, 300);
      return;
    }

    window.save = async function patchedSave(...args) {
      if (Date.now() < cooldownUntil) {
        log('save suppressed (cooldown)');
        return;
      }

      // 선제 트리밍: state 가 SAFE_BUDGET 을 넘으면 미리 줄여서 저장 시도
      if (getStateSize() > SAFE_BUDGET) {
        const { trimmed } = trimHistoryAndTrash();
        if (trimmed > 0) log('preemptive trim', trimmed, 'items');
      }

      try {
        return await orig.apply(this, args);
      } catch (e) {
        if (e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014)) {
          log('save threw quota error (caught in wrapper)');
          await handleQuotaSmart();
          return;
        }
        throw e;
      }
    };
    log('save() wrapped');
  }

  // --------------------------------------------------------------
  // 6. handleQuotaExceeded() 대체 — 자동 복구를 먼저, 그래도 안 되면 대화
  // --------------------------------------------------------------
  async function handleQuotaSmart() {
    if (dialogOpen) return;

    // Step 1: IDB externalize (기존 로직 최대 활용)
    if (window.__idbStore?.externalizeState) {
      try {
        const slim = await window.__idbStore.externalizeState(getState(), { minBytes: 2 * 1024 });
        const payload = JSON.stringify(slim);
        lastFailKB = Math.round(payload.length / 1024);
        if (payload.length < LS_HARD_LIMIT) {
          setItemRaw(STORAGE_KEY, payload);
          window.lastSaveSize = payload.length;
          window.updateStorageIndicator?.();
          toastSafe(`공간 확보 — 이미지/첨부를 IndexedDB 로 이관 (${lastFailKB}KB)`);
          return;
        }
      } catch (e) { log('externalize retry failed', e); }
    }

    // Step 2: history / trash 트리밍 + 재시도
    {
      const { trimmed } = trimHistoryAndTrash();
      if (trimmed > 0) {
        try {
          const payload = JSON.stringify(getState());
          lastFailKB = Math.round(payload.length / 1024);
          setItemRaw(STORAGE_KEY, payload);
          window.lastSaveSize = payload.length;
          toastSafe(`자동 정리 — 히스토리/휴지통 ${trimmed}개 트리밍 (${lastFailKB}KB)`);
          window.updateStorageIndicator?.();
          return;
        } catch {}
      }
    }

    // Step 3: history / trash 를 IDB 로 격리 후 재시도
    if (await archiveHeavyFields()) {
      try {
        const payload = JSON.stringify(getState());
        lastFailKB = Math.round(payload.length / 1024);
        setItemRaw(STORAGE_KEY, payload);
        window.lastSaveSize = payload.length;
        toastSafe(`공간 확보 — 히스토리/휴지통을 IndexedDB 로 옮김 (${lastFailKB}KB)`);
        window.updateStorageIndicator?.();
        return;
      } catch {}
    }

    // Step 4: 그래도 실패 → 쿨다운 걸고 사용자에게 정확한 대화 한 번
    cooldownUntil = Date.now() + COOLDOWN_MS;
    dialogOpen = true;
    try { await promptUserFix(); }
    finally { dialogOpen = false; cooldownUntil = Date.now() + 1000; /* 선택 직후 살짝 쿨다운 */ }
  }

  // --------------------------------------------------------------
  // 7. 정직한 대화창
  // --------------------------------------------------------------
  async function promptUserFix() {
    const payload = JSON.stringify(getState());
    const kb = Math.round(payload.length / 1024);
    const d = diagnose(payload);
    const fmtKB = n => (n/1024).toFixed(1) + 'KB';

    const subtitle =
      `localStorage 한계는 ~5MB 입니다.\n` +
      `현재 저장 시도 크기: ${kb}KB (한계 초과)\n` +
      `큰 탭: ${d.tabs.map(t => `${t.name} ${fmtKB(t.size)}`).join(', ') || '없음'}\n` +
      `히스토리 ${fmtKB(d.histSize)} · 휴지통 ${fmtKB(d.trashSize)}\n` +
      `\n※ 이전 다이얼로그의 1411KB 는 브라우저 전체 quota (~585GB) 를 잘못 표시한 것입니다.`;

    const pickList = window.pickList;
    let choice = null;
    if (typeof pickList === 'function') {
      choice = await pickList('저장 공간 부족 — 어떻게 할까요? (수정판)', [
        '큰 파일을 IndexedDB 로 분리하고 저장 (가장 안전)',
        '히스토리·휴지통 완전 비우기 + 저장',
        '백업 JSON 내려받기 + 전부 정리 후 저장',
        '다음 저장까지 자동 저장 끄기 (수동으로만)',
        '취소',
      ], { subtitle }).catch(() => null);
    } else {
      // pickList 가 아직 없으면 기본 confirm 3단으로 폴백
      choice = confirm(subtitle + '\n\n확인 = 히스토리/휴지통 비우고 저장, 취소 = 아무것도 안 함')
        ? '히스토리·휴지통 완전 비우기 + 저장' : '취소';
    }

    if (!choice || choice === '취소') { toastSafe('취소됨 — 자동 저장은 일시 정지'); return; }

    if (choice.startsWith('큰 파일')) {
      const ok = await moveStateToIdb();
      toastSafe(ok ? '상태를 IndexedDB 로 이관 — 다음 저장부터 정상' : '이관 실패 — IDB 미지원일 수 있음');
      return;
    }

    if (choice.startsWith('히스토리')) {
      const s = getState();
      if (s) { s.history = []; s.trash = []; }
      try {
        setItemRaw(STORAGE_KEY, JSON.stringify(getState()));
        toastSafe('정리 완료 · 다시 저장됨');
      } catch (e) {
        toastSafe('정리해도 부족 — IDB 이관으로 진행');
        await moveStateToIdb();
      }
      window.updateStorageIndicator?.();
      return;
    }

    if (choice.startsWith('백업')) {
      try { window.exportJSON?.() ?? document.getElementById('exportBtn')?.click(); } catch {}
      await new Promise(r => setTimeout(r, 600));
      const s = getState();
      if (s) { s.history = []; s.trash = []; }
      try { setItemRaw(STORAGE_KEY, JSON.stringify(getState())); toastSafe('백업 후 정리 완료'); }
      catch { await moveStateToIdb(); toastSafe('백업 후 IDB 이관'); }
      window.updateStorageIndicator?.();
      return;
    }

    if (choice.startsWith('다음 저장까지')) {
      // 긴 쿨다운
      cooldownUntil = Date.now() + 60 * 60 * 1000;
      toastSafe('자동 저장 1시간 정지 — 수동으로 저장하거나 새로고침 후 재시도');
      return;
    }
  }

  // --------------------------------------------------------------
  // 8. 얇은 toast 폴백
  // --------------------------------------------------------------
  function toastSafe(text) {
    try { if (typeof window.toast === 'function') return window.toast(text); } catch {}
    console.log('[toast]', text);
  }

  // --------------------------------------------------------------
  // 9. 부팅 이후 save/load 가 준비되면 감싼다
  // --------------------------------------------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wrapSave, { once: true });
  } else {
    wrapSave();
  }

  // IDB pointer 케이스: 앱 부팅 시 포인터면 실제 state 를 끌어와서 주입
  (async () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.__stateInIdb && window.__idbStore?.getKV) {
        const real = await window.__idbStore.getKV(parsed.key || IDB_STATE_KEY);
        if (real && typeof real === 'object') {
          // 앱이 자기 state 를 이미 만들었을 수 있으므로 머지 대신 덮어씀 경고
          log('state in IDB detected. Merging into window.state');
          Object.assign(window.state || (window.state = {}), real);
          try { window.renderSidebar?.(); window.setActive?.(real.activeId); } catch {}
        }
      }
    } catch (e) { log('IDB pointer hydrate failed', e); }
  })();

  // --------------------------------------------------------------
  // 10. 전역 디버그 엔드포인트
  // --------------------------------------------------------------
  window.__storageQuotaPatch = {
    version: '1.1.0',
    trimHistoryAndTrash,
    archiveHeavyFields,
    moveStateToIdb,
    handleQuotaSmart,
    diagnose,
    clearCooldown() { cooldownUntil = 0; dialogOpen = false; log('cooldown cleared'); },
  };
})();
