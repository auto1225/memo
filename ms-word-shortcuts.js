/* ms-word-shortcuts.js — v1
 * MS Word 호환 단축키 전면 매핑.
 * 목적: 사용자가 Word 에 익숙한 단축키를 그대로 JustANotepad 에서 사용.
 *
 * 충돌 재배치 요약:
 *   - Ctrl+K: 팔레트 → 하이퍼링크 삽입 (팔레트는 Ctrl+Shift+P 로 이동)
 *   - Ctrl+J: 캘린더 → 양쪽 정렬 (캘린더는 Alt+Shift+J 로 이동)
 *   - Ctrl+D: 오늘 메모 → 폰트 설정 (오늘 메모는 Ctrl+Alt+D 로 이동)
 *
 * MS Word 표준 매핑:
 *   [ 서식 ]
 *   - Ctrl+B/I/U                : 굵게·기울임·밑줄 (contenteditable 네이티브)
 *   - Ctrl+Shift+D              : 이중 밑줄
 *   - Ctrl+Shift+=              : 위 첨자
 *   - Ctrl+=                    : 아래 첨자
 *   - Ctrl+Shift+A              : 모두 대문자
 *   - Ctrl+Shift+K              : 작은 대문자
 *   - Ctrl+Space                : 서식 지우기
 *   - Ctrl+Shift+>  / Ctrl+]    : 글자 크기 +
 *   - Ctrl+Shift+<  / Ctrl+[    : 글자 크기 -
 *   - Shift+F3                  : 대소문자 토글 (UPPER → lower → Title)
 *
 *   [ 정렬 & 들여쓰기 ]
 *   - Ctrl+L                    : 왼쪽 정렬
 *   - Ctrl+E                    : 가운데 정렬
 *   - Ctrl+R                    : 오른쪽 정렬
 *   - Ctrl+J                    : 양쪽 정렬 (justify)
 *   - Ctrl+M                    : 들여쓰기 증가
 *   - Ctrl+Shift+M              : 들여쓰기 감소
 *   - Ctrl+T                    : 내어쓰기 (hanging indent) — 우선 browser tab 과 충돌하여 생략
 *
 *   [ 제목 & 단락 ]
 *   - Ctrl+Alt+1                : 제목 1
 *   - Ctrl+Alt+2                : 제목 2
 *   - Ctrl+Alt+3                : 제목 3
 *   - Ctrl+Shift+N              : 일반 문단 (Normal)
 *   - Ctrl+Alt+1 등은 IME 이슈 가능성 있어 keydown 에서 직접 처리
 *
 *   [ 줄 간격 ]
 *   - Ctrl+Alt+1                : 단일 간격  (1 은 헤딩과 겹침 — Ctrl+Alt+H1 우선, Ctrl+Alt+Shift+1 로 대체)
 *   — 줄 간격은 Ctrl+Alt+5 등 Word 매핑 대신 툴바 셀렉터 사용 권장 (Tab 1-9 충돌 방지)
 *
 *   [ 삽입 ]
 *   - Ctrl+K                    : 하이퍼링크 삽입
 *   - Ctrl+Enter                : 페이지 구분
 *   - Alt+Ctrl+F                : 각주 삽입
 *   - Alt+Ctrl+D                : 미주 삽입 (앱에서는 각주와 동일 처리)
 *
 *   [ 창 & 탭 (브라우저 관례 유지) ]
 *   - Ctrl+N                    : 새 탭 (Word: 새 문서)
 *   - Ctrl+T                    : 새 탭 (브라우저 관례)
 *   - Ctrl+W                    : 탭 닫기
 *   - Ctrl+Tab                  : 다음 탭
 *   - Ctrl+1..9                 : n번째 탭 이동
 *   - Ctrl+S                    : 저장
 *   - Ctrl+P                    : 인쇄
 *   - Ctrl+F                    : 찾기
 *   - Ctrl+H                    : 찾아 바꾸기
 *   - Ctrl+Z / Ctrl+Y           : 실행 취소 / 다시 실행
 *
 *   [ 이동된 단축키 (앱 고유) ]
 *   - Ctrl+Shift+P              : 명령 팔레트 (구 Ctrl+K)
 *   - Alt+Shift+J               : 캘린더 열기 (구 Ctrl+J)
 *   - Ctrl+Alt+D                : 오늘 메모 (구 Ctrl+D)
 */
(function () {
  'use strict';

  /* 유틸 */
  function $ (id) { return document.getElementById(id); }
  function exec (cmd, value) {
    try { return document.execCommand(cmd, false, value || null); } catch { return false; }
  }
  function inEditable () {
    const ae = document.activeElement;
    if (!ae) return false;
    if (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT') return true;
    if (ae.isContentEditable) return true;
    return false;
  }
  function inPageOnly () {
    const p = $('page');
    return p && (document.activeElement === p || p.contains(document.activeElement));
  }
  function notify (msg) {
    try { if (typeof window.toast === 'function') window.toast(msg); } catch {}
  }

  /* ====== 정렬 & 들여쓰기 ====== */
  function align (dir) {
    if (!inPageOnly()) return false;
    const map = { left:'alignLeftBtn', center:'alignCenterBtn', right:'alignRightBtn', justify:'alignJustifyBtn' };
    const btn = $(map[dir]);
    if (btn) { btn.click(); return true; }
    /* 폴백: execCommand */
    const cmdMap = { left:'justifyLeft', center:'justifyCenter', right:'justifyRight', justify:'justifyFull' };
    return exec(cmdMap[dir]);
  }
  function indent () {
    if (!inPageOnly()) return false;
    const btn = $('indentBtn');
    if (btn) { btn.click(); return true; }
    return exec('indent');
  }
  function outdent () {
    if (!inPageOnly()) return false;
    const btn = $('outdentBtn');
    if (btn) { btn.click(); return true; }
    return exec('outdent');
  }

  /* ====== 제목 & 단락 ====== */
  function applyHeading (level) {
    if (!inPageOnly()) return false;
    if (level === 0) {
      /* Normal paragraph */
      return exec('formatBlock', 'p');
    }
    return exec('formatBlock', 'h' + level);
  }

  /* ====== 글자 크기 증/감 ====== */
  function adjustFontSize (delta) {
    if (!inPageOnly()) return false;
    /* 줄 레벨: 현재 선택 범위에 있는 컴퓨티드 fontSize 를 읽어 ±1px 적용.
       contenteditable 은 span 으로 래핑. */
    try {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return false;
      const range = sel.getRangeAt(0);
      let node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      const curSize = parseFloat(getComputedStyle(node).fontSize) || 16;
      const newSize = Math.max(8, Math.min(72, curSize + delta));
      exec('fontSize', '7'); // 임시로 size=7 적용 → 선택 span 생성
      /* 새로 생성된 span 의 font-size 를 직접 px 값으로 오버라이드 */
      const spans = document.querySelectorAll('#page font[size="7"]');
      spans.forEach(s => {
        s.removeAttribute('size');
        s.style.fontSize = newSize + 'px';
        /* font 태그를 span 으로 전환 (시멘틱) */
        const span = document.createElement('span');
        span.style.fontSize = newSize + 'px';
        while (s.firstChild) span.appendChild(s.firstChild);
        s.parentNode.replaceChild(span, s);
      });
      return true;
    } catch (e) { console.warn('[shortcuts] fontSize 조정 실패', e); return false; }
  }

  /* ====== 대소문자 토글 (Shift+F3 = UPPER → lower → Title cycle) ====== */
  function toggleCase () {
    if (!inPageOnly()) return false;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString()) return false;
    const text = sel.toString();
    let next;
    if (text === text.toUpperCase() && text !== text.toLowerCase()) {
      /* 현재 UPPER → lower */
      next = text.toLowerCase();
    } else if (text === text.toLowerCase() && text !== text.toUpperCase()) {
      /* lower → Title */
      next = text.replace(/\b\w/g, c => c.toUpperCase());
    } else {
      /* Title (혼합) → UPPER */
      next = text.toUpperCase();
    }
    exec('insertText', next);
    return true;
  }

  /* ====== 하이퍼링크 삽입 (Word Ctrl+K) ====== */
  async function insertHyperlink () {
    if (!inPageOnly()) return false;
    const sel = window.getSelection();
    const selectedText = sel && !sel.isCollapsed ? sel.toString() : '';
    const url = await promptForUrl(selectedText);
    if (!url) return true; /* 취소 */
    if (selectedText) {
      exec('createLink', url);
    } else {
      /* 선택 없으면 URL 자체를 링크 텍스트로 삽입 */
      const a = '<a href="' + url + '" target="_blank" rel="noopener">' + url + '</a>';
      exec('insertHTML', a);
    }
    return true;
  }

  function promptForUrl (defaultText) {
    /* 논문 기능의 paperPromptForm 활용 — 공용 폼 */
    if (window.JANPaper && window.JANPaper.paperPromptForm) {
      return window.JANPaper.paperPromptForm('하이퍼링크 삽입', [
        { name: 'url', label: 'URL', type: 'text', placeholder: 'https://example.com', required: true },
        { name: 'text', label: '표시 텍스트 (선택 영역 있으면 그대로 사용)', type: 'text', value: defaultText || '' }
      ], { okLabel: '링크 삽입' }).then(result => result ? result.url : null);
    }
    /* 폴백 */
    const u = prompt('링크 URL 입력:', 'https://');
    return Promise.resolve(u && u.trim() !== 'https://' ? u : null);
  }

  /* ====== 페이지 구분 (Ctrl+Enter) ====== */
  function insertPageBreak () {
    if (!inPageOnly()) return false;
    if (window.JANPaper && window.JANPaper.insertPageBreak) {
      window.JANPaper.insertPageBreak();
      return true;
    }
    /* 폴백 */
    exec('insertHTML', '<hr style="page-break-after:always; border:0; border-top:1px dashed #ccc; margin:16px 0;">');
    return true;
  }

  /* ====== 각주 삽입 (Alt+Ctrl+F) ====== */
  function insertFootnote () {
    if (!inPageOnly()) return false;
    if (window.JANPaper && window.JANPaper.insertFootnote) {
      window.JANPaper.insertFootnote();
      return true;
    }
    return false;
  }

  /* ====== 서식 지우기 (Ctrl+Space) ====== */
  function clearFormat () {
    if (!inPageOnly()) return false;
    return exec('removeFormat');
  }

  /* ============================================================
     메인 키다운 핸들러 — capture 단계에서 실행하여 기존 핸들러
     (ctrl+K=palette, ctrl+J=calendar 등) 보다 먼저 가로챔.
     ============================================================ */
  document.addEventListener('keydown', function (e) {
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const alt = e.altKey;
    const key = e.key;

    /* 팔레트 이동: Ctrl+Shift+P */
    if (ctrl && shift && !alt && (key === 'p' || key === 'P')) {
      e.preventDefault(); e.stopImmediatePropagation();
      const pal = document.getElementById('palette');
      if (!pal) return;
      if (pal.classList.contains('open')) {
        if (typeof window.closePalette === 'function') window.closePalette();
      } else {
        if (typeof window.openPalette === 'function') window.openPalette();
      }
      return;
    }

    /* 캘린더 이동: Alt+Shift+J */
    if (alt && shift && !ctrl && (key === 'j' || key === 'J' || key === 'J')) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (typeof window.openCalendar === 'function') window.openCalendar();
      return;
    }

    /* 오늘 메모 이동: Ctrl+Alt+D */
    if (ctrl && alt && !shift && (key === 'd' || key === 'D')) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (typeof window.openTodayMemo === 'function') window.openTodayMemo();
      return;
    }

    /* === MS Word 표준 매핑 (capture 단계에서 기존 Ctrl+K/J/D 가로채기) === */

    /* Ctrl+K → 하이퍼링크 (구 팔레트 오버라이드) */
    if (ctrl && !shift && !alt && (key === 'k' || key === 'K')) {
      if (!inPageOnly()) return;
      e.preventDefault(); e.stopImmediatePropagation();
      insertHyperlink();
      return;
    }

    /* Ctrl+J → 양쪽 정렬 (구 캘린더 오버라이드) */
    if (ctrl && !shift && !alt && (key === 'j' || key === 'J')) {
      if (!inPageOnly()) return;
      e.preventDefault(); e.stopImmediatePropagation();
      align('justify');
      return;
    }

    /* Ctrl+D → 폰트 크기 입력 (구 오늘 메모 오버라이드) */
    if (ctrl && !shift && !alt && (key === 'd' || key === 'D')) {
      if (!inPageOnly()) return;
      e.preventDefault(); e.stopImmediatePropagation();
      /* 폰트 크기 입력 모달 — paperPromptForm 재사용 */
      if (window.JANPaper && window.JANPaper.paperPromptForm) {
        window.JANPaper.paperPromptForm('글자 크기', [
          { name: 'size', label: '크기 (8 ~ 72)', type: 'text', value: '16', placeholder: '16', required: true }
        ], { okLabel: '적용' }).then(r => {
          if (r && r.size) {
            const n = parseInt(r.size, 10);
            if (n >= 8 && n <= 72) {
              exec('fontSize', '7');
              document.querySelectorAll('#page font[size="7"]').forEach(f => {
                f.removeAttribute('size'); f.style.fontSize = n + 'px';
              });
              notify('글자 크기 ' + n + 'px');
            }
          }
        });
      }
      return;
    }

    /* Ctrl+L/E/R → 정렬 */
    if (ctrl && !shift && !alt && !e.isComposing) {
      if (key === 'l' || key === 'L') {
        if (!inPageOnly()) return;
        e.preventDefault(); e.stopImmediatePropagation();
        align('left'); return;
      }
      if (key === 'e' || key === 'E') {
        if (!inPageOnly()) return;
        e.preventDefault(); e.stopImmediatePropagation();
        align('center'); return;
      }
      if (key === 'r' || key === 'R') {
        if (!inPageOnly()) return;
        e.preventDefault(); e.stopImmediatePropagation();
        align('right'); return;
      }
    }

    /* Ctrl+M / Ctrl+Shift+M → 들여쓰기 */
    if (ctrl && !alt && (key === 'm' || key === 'M')) {
      if (!inPageOnly()) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (shift) outdent(); else indent();
      return;
    }

    /* Ctrl+Alt+1/2/3 → 제목 1/2/3 */
    if (ctrl && alt && !shift && /^[1-3]$/.test(key)) {
      if (!inPageOnly()) return;
      e.preventDefault(); e.stopImmediatePropagation();
      applyHeading(parseInt(key, 10));
      return;
    }

    /* Ctrl+Shift+N → 일반 문단 */
    if (ctrl && shift && !alt && (key === 'n' || key === 'N')) {
      if (!inPageOnly()) return;
      e.preventDefault(); e.stopImmediatePropagation();
      applyHeading(0);
      return;
    }

    /* Ctrl+Enter → 페이지 구분 */
    if (ctrl && !shift && !alt && key === 'Enter') {
      if (!inPageOnly()) return;
      e.preventDefault(); e.stopImmediatePropagation();
      insertPageBreak();
      return;
    }

    /* Alt+Ctrl+F → 각주 */
    if (ctrl && alt && !shift && (key === 'f' || key === 'F')) {
      if (!inPageOnly()) return;
      e.preventDefault(); e.stopImmediatePropagation();
      insertFootnote();
      return;
    }

    /* Ctrl+= → 아래 첨자, Ctrl+Shift+= → 위 첨자 */
    if (ctrl && !alt && (key === '=' || key === '+')) {
      if (!inPageOnly()) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (shift) exec('superscript');
      else exec('subscript');
      return;
    }

    /* Ctrl+Shift+> / Ctrl+Shift+< → 글자 크기 ± (한글 상태에서도 동작) */
    if (ctrl && shift && !alt && (key === '>' || key === '.')) {
      if (!inPageOnly()) return;
      e.preventDefault(); e.stopImmediatePropagation();
      adjustFontSize(+1); return;
    }
    if (ctrl && shift && !alt && (key === '<' || key === ',')) {
      if (!inPageOnly()) return;
      e.preventDefault(); e.stopImmediatePropagation();
      adjustFontSize(-1); return;
    }
    /* Ctrl+] / Ctrl+[ → 글자 크기 ± (Word 대체 키) */
    if (ctrl && !shift && !alt && (key === ']' || key === '[')) {
      if (!inPageOnly()) return;
      e.preventDefault(); e.stopImmediatePropagation();
      adjustFontSize(key === ']' ? +1 : -1); return;
    }

    /* Shift+F3 → 대소문자 토글 */
    if (shift && !ctrl && !alt && (key === 'F3')) {
      if (!inPageOnly()) return;
      e.preventDefault(); e.stopImmediatePropagation();
      toggleCase(); return;
    }

    /* Ctrl+Space → 서식 지우기 */
    if (ctrl && !shift && !alt && key === ' ') {
      if (!inPageOnly()) return;
      e.preventDefault(); e.stopImmediatePropagation();
      clearFormat();
      notify('서식 지움');
      return;
    }

    /* Ctrl+Shift+D → 이중 밑줄 (CSS text-decoration) */
    if (ctrl && shift && !alt && (key === 'd' || key === 'D')) {
      if (!inPageOnly()) return;
      e.preventDefault(); e.stopImmediatePropagation();
      /* 선택 영역에 double underline 적용 */
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const span = document.createElement('span');
      span.style.textDecoration = 'underline double';
      try {
        sel.getRangeAt(0).surroundContents(span);
      } catch {
        exec('insertHTML', '<span style="text-decoration:underline double;">' + escapeHtml(sel.toString()) + '</span>');
      }
      return;
    }
  }, true); /* capture=true — 기존 non-capture 핸들러 보다 먼저 실행 */

  function escapeHtml (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ============================================================
     명령 팔레트에 "MS Word 단축키 안내" 항목 등록 (deferred)
     ============================================================ */
  function registerHelpCommand () {
    if (!window.JAN_COMMANDS) return false;
    const exists = window.JAN_COMMANDS.some(c => c.name === 'MS Word 단축키 안내');
    if (exists) return true;
    window.JAN_COMMANDS.push({
      ico: 'i-help', name: 'MS Word 단축키 안내',
      desc: 'Word 호환 단축키 전체 목록',
      run: openShortcutsHelp
    });
    return true;
  }
  /* 여러 번 시도 — JAN_COMMANDS 는 늦게 초기화될 수 있음 */
  let _regRetry = 0;
  const _regTimer = setInterval(() => {
    if (registerHelpCommand() || ++_regRetry > 20) clearInterval(_regTimer);
  }, 500);

  /* 공용 안내 모달 */
  function openShortcutsHelp () {
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    const ok = document.getElementById('modalOk');
    const cancel = document.getElementById('modalCancel');
    if (!modal || !body) return alert('단축키 안내 UI 를 불러오지 못했습니다');

    const origOkDisp = ok.style.display;
    const origOkText = ok.textContent;
    const origCancelText = cancel.textContent;

    title.textContent = 'MS Word 호환 단축키';

    const GROUPS = [
      { name: '서식', rows: [
        ['Ctrl+B', '굵게 (Bold)'],
        ['Ctrl+I', '기울임 (Italic)'],
        ['Ctrl+U', '밑줄 (Underline)'],
        ['Ctrl+Shift+D', '이중 밑줄'],
        ['Ctrl+=', '아래 첨자 (Subscript)'],
        ['Ctrl+Shift+=', '위 첨자 (Superscript)'],
        ['Ctrl+Space', '서식 지우기'],
        ['Ctrl+]  /  Ctrl+[', '글자 크기 ± 1px'],
        ['Ctrl+Shift+>  /  Ctrl+Shift+<', '글자 크기 ± 1px'],
        ['Shift+F3', '대소문자 토글 (UPPER → lower → Title)'],
        ['Ctrl+D', '글자 크기 직접 입력']
      ]},
      { name: '정렬 & 들여쓰기', rows: [
        ['Ctrl+L', '왼쪽 정렬'],
        ['Ctrl+E', '가운데 정렬'],
        ['Ctrl+R', '오른쪽 정렬'],
        ['Ctrl+J', '양쪽 정렬'],
        ['Ctrl+M', '들여쓰기 증가'],
        ['Ctrl+Shift+M', '들여쓰기 감소']
      ]},
      { name: '제목 & 단락', rows: [
        ['Ctrl+Alt+1', '제목 1 (H1)'],
        ['Ctrl+Alt+2', '제목 2 (H2)'],
        ['Ctrl+Alt+3', '제목 3 (H3)'],
        ['Ctrl+Shift+N', '일반 문단 (Normal)']
      ]},
      { name: '삽입', rows: [
        ['Ctrl+K', '하이퍼링크 삽입'],
        ['Ctrl+Enter', '페이지 구분 삽입'],
        ['Alt+Ctrl+F', '각주 삽입']
      ]},
      { name: '파일 & 탐색', rows: [
        ['Ctrl+S', '저장'],
        ['Ctrl+P', '인쇄'],
        ['Ctrl+F', '찾기'],
        ['Ctrl+H', '찾아 바꾸기'],
        ['Ctrl+Z', '실행 취소'],
        ['Ctrl+Y', '다시 실행']
      ]},
      { name: '탭 (브라우저 관례)', rows: [
        ['Ctrl+T', '새 탭'],
        ['Ctrl+W', '탭 닫기'],
        ['Ctrl+Tab', '다음 탭'],
        ['Ctrl+1..9', 'n번째 탭으로 이동']
      ]},
      { name: '이동된 앱 고유 단축키', rows: [
        ['Ctrl+Shift+P', '명령 팔레트 (구 Ctrl+K)'],
        ['Alt+Shift+J', '캘린더 (구 Ctrl+J)'],
        ['Ctrl+Alt+D', '오늘 메모 (구 Ctrl+D)']
      ]}
    ];

    let html = '<div style="font-size:12.5px; color:#555; margin-bottom:12px; line-height:1.5;">' +
      '모든 단축키는 MS Word 표준에 맞게 매핑되었습니다. Word 사용자는 익숙한 키 조합을 그대로 사용할 수 있습니다.</div>';
    html += GROUPS.map(g =>
      '<div style="margin-bottom:14px;">' +
        '<div style="font-size:10.5px; color:#8B4513; letter-spacing:1px; text-transform:uppercase; font-weight:700; border-bottom:1px solid #f0e4db; padding-bottom:4px; margin-bottom:6px;">' + g.name + '</div>' +
        g.rows.map(r =>
          '<div style="display:flex; align-items:center; gap:10px; padding:4px 0; font-size:12.5px;">' +
            '<kbd style="background:#f5f2ef; border:1px solid #e0d5cc; border-radius:4px; padding:2px 7px; font-family:monospace; font-size:11px; color:#444; min-width:120px; text-align:left;">' + escapeHtml(r[0]) + '</kbd>' +
            '<span style="color:#333;">' + escapeHtml(r[1]) + '</span>' +
          '</div>'
        ).join('') +
      '</div>'
    ).join('');
    body.innerHTML = html;

    const modalBox = modal.querySelector('.modal') || modal;
    modalBox.classList.add('jan-wide');
    ok.style.display = 'none';
    cancel.textContent = '닫기';

    function restoreModal () {
      modal.classList.remove('open');
      modalBox.classList.remove('jan-wide');
      ok.style.display = origOkDisp;
      ok.textContent = origOkText;
      cancel.textContent = origCancelText;
      body.innerHTML = '';
      cancel.onclick = null;
      modal.removeEventListener('click', backdrop);
      document.removeEventListener('keydown', escH);
    }
    function backdrop (e) { if (e.target === modal) restoreModal(); }
    function escH (e) { if (e.key === 'Escape') restoreModal(); }
    cancel.onclick = restoreModal;
    modal.addEventListener('click', backdrop);
    document.addEventListener('keydown', escH);
    modal.classList.add('open');
  }

  /* 공개 API */
  window.JANShortcuts = {
    openHelp: openShortcutsHelp,
    /* 디버깅용 개별 액션 */
    align, indent, outdent, applyHeading, adjustFontSize, toggleCase,
    insertHyperlink, insertPageBreak, insertFootnote, clearFormat
  };
})();
