/* JustANotepad — Storage Onboarding Wizard
 *
 * 동기화 방식 선택 UI. 3단계 카드 레이아웃:
 *   [A] 내 PC 의 클라우드 폴더 쓰기 (LocalFolder, 추천)
 *   [B] Dropbox 에 바로 연결
 *   [C] Google Drive / OneDrive (준비 중)
 *   [D] Supabase 서버 쓰기 (Legacy, 고급 옵션 접힘)
 *   [E] 오프라인만
 *
 * 호출:
 *   JANStorageOnboarding.open()       — 수동으로 열기
 *   JANStorageOnboarding.openIfFirstRun() — 첫 실행 시 자동
 *
 * 의존:
 *   window.JANStorage (storage-adapter.js)
 *   window.JANStorage.adapters.{local, dropbox, gdrive, onedrive, supabase}
 *   window.toast() — 전역 토스트 (app.html 의 기본 제공)
 */
(function () {
  'use strict';

  const MODAL_ID = 'jan-storage-onboarding';
  const FIRST_RUN_KEY = 'jan.storage.onboardingSeen';

  function h(html) {
    const d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstElementChild;
  }

  function toast(msg, dur) {
    if (typeof window.toast === 'function') window.toast(msg, dur || 3500);
    else console.log('[Onboarding]', msg);
  }

  function ensureStyles() {
    if (document.getElementById('jan-storage-onboarding-style')) return;
    const css = `
      #${MODAL_ID}-backdrop {
        position: fixed; inset: 0; background: rgba(20,20,28,.55);
        display: none; align-items: center; justify-content: center;
        z-index: 9999; padding: 24px;
      }
      #${MODAL_ID}-backdrop.open { display: flex; }
      #${MODAL_ID} {
        background: #fff; border-radius: 14px; max-width: 760px; width: 100%;
        max-height: 92vh; overflow: auto; padding: 22px 26px 28px;
        box-shadow: 0 18px 60px rgba(0,0,0,.25);
        font-family: inherit; color: var(--ink, #191919);
      }
      #${MODAL_ID} .ob-head { display:flex; align-items:center; justify-content:space-between; margin-bottom: 4px; }
      #${MODAL_ID} h2 { font-size: 19px; margin: 0; font-weight: 700; }
      #${MODAL_ID} .ob-sub { color: var(--ink-soft, #555); font-size: 12.5px; margin: 6px 0 18px; line-height: 1.55; }
      #${MODAL_ID} .ob-close {
        background: transparent; border: 0; cursor: pointer;
        font-size: 22px; line-height: 1; color: #888; padding: 4px 8px;
      }
      #${MODAL_ID} .ob-cards { display: grid; gap: 12px; grid-template-columns: 1fr; }
      @media (min-width: 680px) { #${MODAL_ID} .ob-cards { grid-template-columns: 1fr 1fr; } }
      #${MODAL_ID} .ob-card {
        border: 1.5px solid var(--paper-edge, #e5e5e5); border-radius: 11px;
        padding: 16px 16px 14px; background: #fff; position: relative;
        display: flex; flex-direction: column; gap: 6px;
      }
      #${MODAL_ID} .ob-card.recommended { border-color: #2f6feb; box-shadow: 0 0 0 2px rgba(47,111,235,.08); }
      #${MODAL_ID} .ob-card.recommended::before {
        content: '추천'; position: absolute; top: -9px; left: 14px;
        background: #2f6feb; color: #fff; font-size: 10.5px; font-weight: 700;
        padding: 2px 8px; border-radius: 10px; letter-spacing: .3px;
      }
      #${MODAL_ID} .ob-card.soon { opacity: .7; }
      #${MODAL_ID} .ob-card.soon::before {
        content: '준비 중'; position: absolute; top: -9px; left: 14px;
        background: #888; color: #fff; font-size: 10.5px; font-weight: 700;
        padding: 2px 8px; border-radius: 10px;
      }
      #${MODAL_ID} .ob-card h3 {
        margin: 0 0 2px; font-size: 14.5px; font-weight: 700;
        display: flex; align-items: center; gap: 8px;
      }
      #${MODAL_ID} .ob-card p { margin: 0; font-size: 12px; line-height: 1.6; color: var(--ink-soft, #555); }
      #${MODAL_ID} .ob-card .ob-pill {
        display: inline-block; font-size: 10.5px; background: #f4f4f8;
        padding: 2px 8px; border-radius: 10px; color: #666; margin-right: 4px;
      }
      #${MODAL_ID} .ob-card .ob-btn {
        margin-top: 10px; padding: 9px 12px; width: 100%;
        background: var(--accent, #FAE100); color: #111; border: 0;
        border-radius: 7px; font-weight: 700; cursor: pointer; font-size: 13px;
      }
      #${MODAL_ID} .ob-card .ob-btn.secondary {
        background: #fff; border: 1px solid var(--paper-edge, #e5e5e5);
      }
      #${MODAL_ID} .ob-card .ob-btn[disabled] { cursor: not-allowed; opacity: .55; }
      #${MODAL_ID} .ob-card .ob-faq {
        margin-top: 8px; font-size: 11.5px; color: #666;
      }
      #${MODAL_ID} .ob-card .ob-faq summary { cursor: pointer; user-select: none; }
      #${MODAL_ID} .ob-card .ob-faq p { margin-top: 6px; }
      #${MODAL_ID} .ob-diag {
        font-size: 10.5px; color: #777; background: #fafafb;
        padding: 6px 8px; border-radius: 6px; margin-top: 2px;
        font-family: ui-monospace, Menlo, Consolas, monospace;
      }
      #${MODAL_ID} .ob-advanced summary {
        cursor: pointer; user-select: none; font-size: 12px; color: #888;
        margin-top: 18px; padding: 6px 2px;
      }
      #${MODAL_ID} .ob-advanced[open] summary { color: #444; }
      #${MODAL_ID} .ob-ico { width: 18px; height: 18px; flex-shrink: 0; color: #444; }
      #${MODAL_ID} .ob-status-bar {
        margin-top: 18px; padding: 10px 12px; background: #f6f8fb;
        border-radius: 8px; font-size: 12px; color: #455; display: flex;
        justify-content: space-between; align-items: center; gap: 12px;
      }
      #${MODAL_ID} .ob-status-bar b { color: #111; }
      #${MODAL_ID} .ob-status-bar .ob-btn { width: auto; padding: 5px 10px; font-size: 11.5px; margin: 0; }
    `;
    const style = document.createElement('style');
    style.id = 'jan-storage-onboarding-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // 라인아트 SVG 아이콘 — <symbol> 체계에 없을 수 있으니 inline
  const ICONS = {
    folder: '<svg class="ob-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    cloud: '<svg class="ob-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1A4 4 0 0 0 6 18z"/></svg>',
    server: '<svg class="ob-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><circle cx="7" cy="7.5" r=".9" fill="currentColor" stroke="none"/><circle cx="7" cy="16.5" r=".9" fill="currentColor" stroke="none"/></svg>',
    off: '<svg class="ob-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64A9 9 0 1 1 5.64 6.64"/><line x1="12" y1="2" x2="12" y2="12"/></svg>',
    drive: '<svg class="ob-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><polygon points="9,3 15,3 22,15 16,21 12,14 8,21 2,15"/></svg>',
    box: '<svg class="ob-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>'
  };

  function buildModal() {
    ensureStyles();
    if (document.getElementById(MODAL_ID + '-backdrop')) return document.getElementById(MODAL_ID + '-backdrop');
    const backdrop = h(`<div id="${MODAL_ID}-backdrop" role="dialog" aria-modal="true"></div>`);
    const body = h(`
      <div id="${MODAL_ID}">
        <div class="ob-head">
          <h2>동기화 방식 선택</h2>
          <button class="ob-close" aria-label="닫기" type="button">&times;</button>
        </div>
        <div class="ob-sub">
          노트·캘린더·할 일을 어디에 저장할지 고르세요. 나중에 언제든 바꿀 수 있습니다.
        </div>

        <div class="ob-cards">

          <div class="ob-card recommended" data-provider="local">
            <h3>${ICONS.folder} 내 PC 의 클라우드 폴더 쓰기</h3>
            <p>Dropbox · OneDrive · Google Drive 데스크톱 앱이 설치돼 있다면 제일 쉬운 방법. 저장될 폴더를 그 동기화 폴더 안에 두면 다른 기기와 자동으로 공유됩니다.</p>
            <div class="ob-diag">내 PC 폴더 → 클라우드 자동 동기화 → 다른 기기</div>
            <div>
              <span class="ob-pill">빠름</span>
              <span class="ob-pill">계정 없음</span>
              <span class="ob-pill">오프라인 OK</span>
            </div>
            <button class="ob-btn" data-action="local">폴더 선택</button>
            <details class="ob-faq">
              <summary>자주 묻는 질문</summary>
              <p><b>Q. 클라우드 앱이 없어요.</b><br>내 PC 만 쓰신다면 아무 폴더나 선택해도 됩니다 (백업만 됨). 여러 기기를 쓰려면 Dropbox/OneDrive/Google Drive 데스크톱 앱을 설치하세요.</p>
              <p><b>Q. Firefox 에서 안 돼요.</b><br>웹 표준 File System Access API 가 Chrome·Edge 전용입니다. Firefox 유저는 Dropbox 방식을 써주세요. 데스크톱 앱은 상관없이 모두 지원.</p>
            </details>
          </div>

          <div class="ob-card" data-provider="dropbox">
            <h3>${ICONS.cloud} Dropbox 에 바로 연결</h3>
            <p>Dropbox 계정으로 로그인하면 앱이 자동으로 저장·불러오기를 합니다. 데스크톱 앱 설치가 안 돼 있어도 됩니다.</p>
            <div class="ob-diag">앱 → OAuth → 내 Dropbox 계정 (/Apps/JustANotepad)</div>
            <div>
              <span class="ob-pill">모든 브라우저</span>
              <span class="ob-pill">최대 2GB 무료</span>
            </div>
            <button class="ob-btn secondary" data-action="dropbox">Dropbox 로그인</button>
            <details class="ob-faq">
              <summary>자주 묻는 질문</summary>
              <p><b>Q. Dropbox 계정이 없어요.</b><br>무료 가입 후 2GB 를 쓸 수 있습니다. 메모만 담는다면 평생 무료로 충분합니다.</p>
              <p><b>Q. 안전한가요?</b><br>OAuth PKCE 방식으로 앱 폴더 (/Apps/JustANotepad) 권한만 받습니다. 다른 파일은 볼 수 없어요.</p>
            </details>
          </div>

          <div class="ob-card soon" data-provider="gdrive">
            <h3>${ICONS.drive} Google Drive</h3>
            <p>곧 지원 예정. Google 계정으로 15GB 무료 저장.</p>
            <button class="ob-btn secondary" data-action="gdrive" disabled>준비 중</button>
          </div>

          <div class="ob-card soon" data-provider="onedrive">
            <h3>${ICONS.box} OneDrive</h3>
            <p>곧 지원 예정. Microsoft 계정으로 5GB 무료.</p>
            <button class="ob-btn secondary" data-action="onedrive" disabled>준비 중</button>
          </div>

        </div>

        <div class="ob-status-bar" id="ob-status-bar">
          <div>현재 상태: <b id="ob-current-provider">—</b></div>
          <div style="display:flex; gap:6px;">
            <button class="ob-btn secondary" data-action="offline">오프라인만</button>
          </div>
        </div>

        <details class="ob-advanced">
          <summary>고급 옵션 / 기존 사용자</summary>
          <div class="ob-card" style="margin-top:10px;" data-provider="supabase">
            <h3>${ICONS.server} Supabase 서버 쓰기 (Legacy)</h3>
            <p>기존 방식. 로그인 후 관리형 서버에 저장됩니다. 신규 가입자에겐 위 방식들을 권장.</p>
            <button class="ob-btn secondary" data-action="supabase">기존 방식 사용</button>
          </div>
          <div style="font-size:11px; color:#888; margin-top:10px; line-height:1.6;">
            이미 Supabase 로 저장된 데이터가 있다면 새 방식 선택 시 자동 마이그레이션이 제안됩니다.
          </div>
        </details>
      </div>
    `);
    backdrop.appendChild(body);
    document.body.appendChild(backdrop);

    // 이벤트 바인딩
    backdrop.querySelector('.ob-close').addEventListener('click', close);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    body.addEventListener('click', onAction);
    // ESC 로 모달 닫기 (다른 모달이 열려있을 때도 동기화 모달이 맨 앞이면 닫도록)
    document.addEventListener('keydown', escHandler);
    return backdrop;
  }

  function escHandler(e) {
    if (e.key !== 'Escape') return;
    const bd = document.getElementById(MODAL_ID + '-backdrop');
    if (!bd || !bd.classList.contains('open')) return;
    // command palette 가 열려 있으면 팔레트를 먼저 닫게 양보
    const palEl = document.querySelector('.jnp-palette-backdrop');
    if (palEl && getComputedStyle(palEl).display !== 'none') return;
    close();
  }

  function currentProviderLabel() {
    const name = (window.JANStorage && window.JANStorage.getActiveName && window.JANStorage.getActiveName()) || 'none';
    const a = window.JANStorage && window.JANStorage.getActive && window.JANStorage.getActive();
    const st = a && a.getStatus && a.getStatus();
    if (name === 'none') return '오프라인만';
    if (!st || !st.connected) return name + ' (연결 안 됨)';
    return name + (st.identity ? ' · ' + st.identity : '');
  }

  function updateStatusBar() {
    const el = document.getElementById('ob-current-provider');
    if (el) el.textContent = currentProviderLabel();
  }

  async function onAction(e) {
    // "준비 중" 카드 전체 영역 클릭 시 안내 토스트
    const soonCard = e.target.closest('.ob-card.soon');
    if (soonCard) {
      const prov = soonCard.dataset.provider || 'gdrive';
      const label = prov === 'gdrive' ? 'Google Drive' : prov === 'onedrive' ? 'OneDrive' : prov;
      toast(label + ' 은 곧 지원 예정입니다. 지금은 내 PC 폴더 또는 Dropbox 방식을 써주세요.', 4500);
      return;
    }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (btn.disabled) return;
    try {
      if (action === 'local') await chooseLocal();
      else if (action === 'dropbox') await chooseDropbox();
      else if (action === 'gdrive' || action === 'onedrive') {
        const label = action === 'gdrive' ? 'Google Drive' : 'OneDrive';
        toast(label + ' 은 곧 지원 예정입니다. 폴더 또는 Dropbox 방식을 먼저 써주세요.', 4500);
      }
      else if (action === 'supabase') await chooseSupabase();
      else if (action === 'offline') await chooseOffline();
    } catch (err) {
      console.warn('[Onboarding]', err);
      toast('오류: ' + (err && err.message || err), 5000);
    }
    updateStatusBar();
  }

  async function chooseLocal() {
    const a = window.JANStorage.adapters && window.JANStorage.adapters.local;
    if (!a) throw new Error('LocalFolder 어댑터 로딩 안 됨');
    await a.promptPickFolder();
    await window.JANStorage.setActive('local');
    toast('폴더에 연결됨: ' + (a.getStatus().identity || ''), 3500);
    await afterSelect('local');
  }

  async function chooseDropbox() {
    const a = window.JANStorage.adapters && window.JANStorage.adapters.dropbox;
    if (!a) throw new Error('Dropbox 어댑터 로딩 안 됨');
    if (!a.isConfigured()) {
      toast('Dropbox Client ID 가 등록되지 않았습니다. 관리자: config.js 에 window.DROPBOX_CLIENT_ID 설정 후 Dropbox App Console 에서 redirect URL 을 등록하세요.', 8000);
      return;
    }
    if (a.hasToken()) {
      await window.JANStorage.setActive('dropbox');
      toast('Dropbox 에 연결됨', 3000);
      await afterSelect('dropbox');
      return;
    }
    toast('Dropbox 로그인 페이지로 이동합니다…', 3000);
    await a.startOAuth();
  }

  async function chooseSupabase() {
    if (!window.JANSync || !window.JANSync.enabled) {
      toast('Supabase 가 설정되지 않은 빌드입니다.', 4000);
      return;
    }
    const s = window.JANSync.getSession && window.JANSync.getSession();
    if (!s) {
      toast('먼저 로그인하세요. 우측 상단 계정 버튼을 눌러 로그인한 뒤 다시 선택하세요.', 5500);
      return;
    }
    await window.JANStorage.setActive('supabase');
    toast('Supabase 관리형 저장소를 사용합니다.', 3000);
    await afterSelect('supabase');
  }

  async function chooseOffline() {
    await window.JANStorage.setActive('none');
    toast('오프라인 모드 — 이 기기에만 저장됩니다.', 3000);
    await afterSelect('none');
  }

  async function afterSelect(providerName) {
    try { localStorage.setItem(FIRST_RUN_KEY, '1'); } catch {}
    // 마이그레이션 제안 — legacy supabase 데이터 있을 경우
    if (providerName !== 'none' && providerName !== 'supabase') {
      try {
        const sb = window.JANSync && window.JANSync.getSupabase && window.JANSync.getSupabase();
        const sess = window.JANSync && window.JANSync.getSession && window.JANSync.getSession();
        if (sb && sess) {
          const offer = await proposeMigrate(providerName);
          if (offer) {
            const r = await window.JANSync.migrateLegacyToActive({
              onProgress: ({ done, total }) => {
                toast(`이동 중… ${done}/${total}`, 1500);
              }
            });
            toast(`마이그레이션 완료 — ${r.migrated} 파일 이동`, 5000);
          }
        }
      } catch (e) { console.warn('[Onboarding] migrate err', e); }
    }
    setTimeout(close, 800);
  }

  function proposeMigrate(targetName) {
    return new Promise((resolve) => {
      const ok = window.confirm(
        '기존 서버에 저장된 데이터를 찾았습니다.\n\n' +
        '새 방식(' + targetName + ')으로 데이터를 옮기시겠습니까?\n' +
        '※ 기존 서버 데이터는 지워지지 않습니다.'
      );
      resolve(ok);
    });
  }

  function open() {
    const bd = buildModal();
    updateStatusBar();
    bd.classList.add('open');
    document.documentElement.style.overflow = 'hidden';
  }
  function close() {
    const bd = document.getElementById(MODAL_ID + '-backdrop');
    if (bd) bd.classList.remove('open');
    document.documentElement.style.overflow = '';
  }

  function openIfFirstRun() {
    try {
      if (localStorage.getItem(FIRST_RUN_KEY) === '1') return false;
      // 기존 Supabase 세션이 있으면 첫 실행 자동 오픈 지연 — afterLogin 이 제안하도록
      if (window.JANSync && window.JANSync.getSession && window.JANSync.getSession()) {
        return false;
      }
      setTimeout(open, 1500);
      return true;
    } catch { return false; }
  }

  // 마이그레이션 제안 이벤트 핸들러
  window.addEventListener('jan-storage-propose-migration', () => {
    try {
      if (localStorage.getItem('jan.storage.migrationProposed') === '1') return;
      localStorage.setItem('jan.storage.migrationProposed', '1');
      const ok = window.confirm(
        '기존 Supabase 저장소 대신 내 PC 폴더나 Dropbox 로 데이터를 옮길까요?\n\n' +
        '새 방식은 내가 직접 데이터를 보관·백업할 수 있어요.\n' +
        '(지금은 취소해도 나중에 설정에서 바꿀 수 있습니다)'
      );
      if (ok) open();
    } catch {}
  });

  // 재연결 필요 이벤트 (복원 실패)
  window.addEventListener('jan-storage-reconnect-needed', (e) => {
    const { provider, error } = (e && e.detail) || {};
    toast('저장소 재연결이 필요합니다 (' + provider + '): ' + (error || ''), 6000);
    setTimeout(open, 1200);
  });

  window.JANStorageOnboarding = { open, close, openIfFirstRun };
})();
