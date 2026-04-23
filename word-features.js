/* word-features.js — v1
 * MS Word 공통 기능 10종 추가.
 * 서식·페이지·삽입 메뉴에 통합. 모든 액션은 paperPromptForm 모달 공용.
 *
 * 포함 기능:
 *   [ 서식 (글자·단락) ]
 *   1. 자간 (letter-spacing)            : 선택 텍스트의 글자 사이 간격 (px)
 *   2. 장평 (horizontal scale)         : transform scaleX, 50~200% (inline-block span)
 *   3. 첫 줄 들여쓰기 (text-indent)     : 현재 문단의 첫 줄 들여쓰기 (px)
 *   4. 단락 간격 (margin before/after) : 현재 문단 위/아래 여백 (px)
 *   5. 글자 효과 (text-shadow)         : 그림자·외곽선 효과
 *   6. 강조 배경 (highlight box)        : 선택 텍스트를 배경색 박스로
 *
 *   [ 페이지 ]
 *   7. 여백 설정 (page margins)         : 상·우·하·좌 (mm), --page-margin 커스터마이즈
 *
 *   [ 삽입 ]
 *   8. 책갈피 (bookmark)               : 이름 있는 <a> 앵커 삽입 (목차·링크 타겟)
 *   9. 텍스트 상자 (text box)          : 선택 영역을 테두리 + 여백 박스로 래핑
 *   10. 구분선 스타일 (HR variants)     : 점선·이중선·장식선
 */
(function () {
  'use strict';

  function $ (id) { return document.getElementById(id); }
  function exec (cmd, value) {
    try { return document.execCommand(cmd, false, value || null); } catch { return false; }
  }
  function getPageEl () { return $('page') || document.querySelector('[contenteditable="true"]'); }
  function notify (msg) {
    try { if (typeof window.toast === 'function') window.toast(msg); } catch {}
  }
  function pushUndo (label) {
    try {
      if (window.JANPaper && window.JANPaper.pushPaperUndo) window.JANPaper.pushPaperUndo(label || 'word-op');
    } catch {}
  }
  function scheduleSave () {
    try {
      if (typeof window.scheduleSave === 'function') window.scheduleSave();
      else if (typeof window.save === 'function') window.save();
    } catch {}
  }
  function prompt2 (title, fields, opts) {
    if (window.JANPaper && window.JANPaper.paperPromptForm) {
      return window.JANPaper.paperPromptForm(title, fields, opts || {});
    }
    /* 폴백 */
    return Promise.resolve(null);
  }

  /* 선택 영역의 부모 블록 찾기 (p, div, li, h1~h6) */
  function getSelectedBlock () {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let node = sel.anchorNode;
    if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const page = getPageEl();
    while (node && node !== page) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        if (/^(p|div|li|h[1-6]|blockquote|td|th)$/.test(tag)) return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  /* 선택 텍스트를 span 으로 wrap 후 콜백으로 스타일 적용 */
  function wrapSelection (applyFn, markerClass) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString()) {
      notify('먼저 텍스트를 선택하세요');
      return null;
    }
    pushUndo(markerClass || 'wrap-span');
    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    if (markerClass) span.classList.add(markerClass);
    try {
      range.surroundContents(span);
      applyFn(span);
      scheduleSave();
      return span;
    } catch (e) {
      /* surroundContents 가 실패하면 (다중 노드 선택) insertHTML 폴백 */
      const text = sel.toString();
      const tmp = document.createElement('span');
      if (markerClass) tmp.classList.add(markerClass);
      tmp.textContent = text;
      applyFn(tmp);
      exec('insertHTML', tmp.outerHTML);
      scheduleSave();
      return tmp;
    }
  }

  /* ================================================================
     1. 자간 (letter-spacing)
     ================================================================ */
  async function openLetterSpacing () {
    const r = await prompt2('자간 설정', [
      { name: 'px', label: '자간 (px)', type: 'text', value: '0',
        placeholder: '0 = 기본, 양수 = 넓게, 음수 = 좁게 (-2 ~ 10)', required: true }
    ], { okLabel: '적용' });
    if (!r) return;
    const v = parseFloat(r.px);
    if (isNaN(v) || v < -5 || v > 20) { notify('자간은 -5 ~ 20 범위로 입력하세요'); return; }
    wrapSelection(span => { span.style.letterSpacing = v + 'px'; }, 'jan-letter-spacing');
    notify('자간 ' + v + 'px 적용');
  }

  /* ================================================================
     2. 장평 (horizontal scale) — transform scaleX
     ================================================================ */
  async function openCharScale () {
    const r = await prompt2('장평 설정', [
      { name: 'pct', label: '장평 (%)', type: 'text', value: '100',
        placeholder: '100 = 기본, 50 = 절반 너비, 150 = 1.5배 (50 ~ 200)', required: true }
    ], { okLabel: '적용' });
    if (!r) return;
    const v = parseInt(r.pct, 10);
    if (isNaN(v) || v < 50 || v > 200) { notify('장평은 50 ~ 200 범위로 입력하세요'); return; }
    wrapSelection(span => {
      span.style.display = 'inline-block';
      span.style.transform = 'scaleX(' + (v / 100) + ')';
      span.style.transformOrigin = '0 0';
      /* transform scaleX 은 레이아웃 폭을 변경하지 않음 — margin 으로 보정 */
      span.style.marginRight = ((v - 100) * 0.3) + 'px';
    }, 'jan-char-scale');
    notify('장평 ' + v + '% 적용');
  }

  /* ================================================================
     3. 첫 줄 들여쓰기 (text-indent)
     ================================================================ */
  async function openFirstLineIndent () {
    const block = getSelectedBlock();
    if (!block) { notify('문단을 먼저 클릭하세요'); return; }
    const current = parseInt(block.style.textIndent, 10) || 0;
    const r = await prompt2('첫 줄 들여쓰기', [
      { name: 'px', label: '들여쓰기 (px)', type: 'text', value: String(current),
        placeholder: '0 = 없음, 20 = 약 1cm', required: true }
    ], { okLabel: '적용' });
    if (!r) return;
    const v = parseInt(r.px, 10);
    if (isNaN(v) || v < 0 || v > 200) { notify('0 ~ 200 범위로 입력하세요'); return; }
    pushUndo('first-line-indent');
    block.style.textIndent = v + 'px';
    scheduleSave();
    notify('첫 줄 들여쓰기 ' + v + 'px 적용');
  }

  /* ================================================================
     4. 단락 간격 (margin before / after)
     ================================================================ */
  async function openParagraphSpacing () {
    const block = getSelectedBlock();
    if (!block) { notify('문단을 먼저 클릭하세요'); return; }
    const before = parseInt(getComputedStyle(block).marginTop, 10) || 0;
    const after = parseInt(getComputedStyle(block).marginBottom, 10) || 0;
    const r = await prompt2('단락 간격', [
      { name: 'before', label: '문단 앞 간격 (px)', type: 'text', value: String(before),
        placeholder: '0 ~ 100', required: true },
      { name: 'after', label: '문단 뒤 간격 (px)', type: 'text', value: String(after),
        placeholder: '0 ~ 100', required: true }
    ], { okLabel: '적용' });
    if (!r) return;
    const b = parseInt(r.before, 10);
    const a = parseInt(r.after, 10);
    if (isNaN(b) || isNaN(a) || b < 0 || b > 200 || a < 0 || a > 200) {
      notify('0 ~ 200 범위로 입력하세요'); return;
    }
    pushUndo('paragraph-spacing');
    block.style.marginTop = b + 'px';
    block.style.marginBottom = a + 'px';
    scheduleSave();
    notify('단락 간격 ' + b + '/' + a + 'px 적용');
  }

  /* ================================================================
     5. 글자 효과 (text-shadow) — 그림자·외곽선 프리셋 4종
     ================================================================ */
  function openTextEffects () {
    const presets = [
      { key: 'none',     label: '효과 없음',    shadow: 'none' },
      { key: 'soft',     label: '부드러운 그림자', shadow: '1px 1px 3px rgba(0,0,0,0.25)' },
      { key: 'hard',     label: '진한 그림자',   shadow: '2px 2px 0 rgba(0,0,0,0.35)' },
      { key: 'glow',     label: '은은한 빛',    shadow: '0 0 6px rgba(217,119,87,0.6), 0 0 12px rgba(217,119,87,0.3)' },
      { key: 'outline',  label: '외곽선',     shadow: '-1px 0 #fff, 0 1px #fff, 1px 0 #fff, 0 -1px #fff, 0 0 2px #222' },
      { key: '3d',       label: '3D 돌출',    shadow: '1px 1px 0 #999, 2px 2px 0 #888, 3px 3px 0 #777, 4px 4px 4px rgba(0,0,0,0.3)' }
    ];
    const modal = $('modal');
    const title = $('modalTitle');
    const body = $('modalBody');
    const ok = $('modalOk');
    const cancel = $('modalCancel');
    if (!modal || !body) return notify('UI 오류');

    const origOkDisp = ok.style.display;
    const origOkText = ok.textContent;
    const origCancelText = cancel.textContent;

    title.textContent = '글자 효과';
    body.innerHTML = '';
    const intro = document.createElement('div');
    intro.style.cssText = 'font-size:12px; color:#666; margin-bottom:10px; line-height:1.5;';
    intro.textContent = '선택한 텍스트에 글자 효과를 적용합니다. 먼저 텍스트를 선택하세요.';
    body.appendChild(intro);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns:repeat(2,1fr); gap:8px;';
    presets.forEach(p => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.cssText = 'padding:16px 12px; background:#fff; border:1px solid #e8e8e8; border-radius:8px; ' +
        'cursor:pointer; font-size:18px; font-weight:700; text-align:center; transition:all 0.12s; font-family:inherit;';
      btn.style.textShadow = p.shadow === 'none' ? '' : p.shadow;
      btn.textContent = p.label;
      btn.addEventListener('mouseenter', () => { btn.style.borderColor = '#D97757'; btn.style.background = '#fef5f1'; });
      btn.addEventListener('mouseleave', () => { btn.style.borderColor = '#e8e8e8'; btn.style.background = '#fff'; });
      btn.addEventListener('click', () => {
        restoreModal();
        wrapSelection(span => {
          if (p.shadow === 'none') span.style.textShadow = '';
          else span.style.textShadow = p.shadow;
        }, 'jan-text-effect');
        notify('글자 효과 ' + p.label + ' 적용');
      });
      grid.appendChild(btn);
    });
    body.appendChild(grid);

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

  /* ================================================================
     6. 강조 배경 (highlight box)
     ================================================================ */
  async function openHighlightBox () {
    const r = await prompt2('강조 배경 상자', [
      { name: 'color', label: '배경색 (hex 또는 rgba)', type: 'text', value: '#fef4c6',
        placeholder: '#fef4c6 / rgba(217,119,87,0.15)', required: true },
      { name: 'padding', label: '안쪽 여백 (px)', type: 'text', value: '3',
        placeholder: '0 ~ 20' }
    ], { okLabel: '적용' });
    if (!r) return;
    const p = parseInt(r.padding || '3', 10);
    wrapSelection(span => {
      span.style.background = r.color;
      span.style.padding = p + 'px 6px';
      span.style.borderRadius = '3px';
    }, 'jan-highlight-box');
    notify('강조 배경 적용');
  }

  /* ================================================================
     7. 페이지 여백 설정 (mm)
     ================================================================ */
  async function openPageMargins () {
    const page = getPageEl();
    if (!page) return notify('편집 영역을 찾을 수 없음');
    if (!page.classList.contains('jan-paged')) {
      notify('페이지 크기를 먼저 설정하세요 (페이지 > 페이지 크기 설정)'); return;
    }
    const computed = getComputedStyle(page);
    const curTop = parseFloat(computed.paddingTop) || 0;
    const curRight = parseFloat(computed.paddingRight) || 0;
    const curBottom = parseFloat(computed.paddingBottom) || 0;
    const curLeft = parseFloat(computed.paddingLeft) || 0;
    /* px → mm 변환: 1mm = 96/25.4 px */
    const pxToMm = (px) => Math.round(px * 25.4 / 96);
    const r = await prompt2('페이지 여백 설정 (mm)', [
      { name: 'top', label: '위 (mm)', type: 'text', value: String(pxToMm(curTop)), placeholder: '20' },
      { name: 'right', label: '오른쪽 (mm)', type: 'text', value: String(pxToMm(curRight)), placeholder: '20' },
      { name: 'bottom', label: '아래 (mm)', type: 'text', value: String(pxToMm(curBottom)), placeholder: '20' },
      { name: 'left', label: '왼쪽 (mm)', type: 'text', value: String(pxToMm(curLeft)), placeholder: '20' }
    ], { okLabel: '적용' });
    if (!r) return;
    const top = parseInt(r.top, 10), right = parseInt(r.right, 10),
          bottom = parseInt(r.bottom, 10), left = parseInt(r.left, 10);
    if ([top,right,bottom,left].some(n => isNaN(n) || n < 0 || n > 100)) {
      notify('0 ~ 100mm 범위로 입력하세요'); return;
    }
    pushUndo('page-margins');
    /* padding 을 직접 설정하여 CSS !important 를 이기도록 style.setProperty + important 사용 */
    page.style.setProperty('padding-top',    top + 'mm',    'important');
    page.style.setProperty('padding-right',  right + 'mm',  'important');
    page.style.setProperty('padding-bottom', bottom + 'mm', 'important');
    page.style.setProperty('padding-left',   left + 'mm',   'important');
    /* 탭 영속화 */
    try {
      if (typeof window.currentTab === 'function') {
        const t = window.currentTab();
        if (t) t.pageMargins = { top, right, bottom, left };
      }
    } catch {}
    scheduleSave();
    /* 페이지 시트 재계산 (margins 변경 → pageH 변경 → 페이지 수 변경 가능) */
    try {
      if (window.JANPaper && window.JANPaper.atoms && window.JANPaper.atoms.updatePageSheets) {
        window.JANPaper.atoms.updatePageSheets();
      }
    } catch {}
    notify('여백 ' + top + '/' + right + '/' + bottom + '/' + left + 'mm 적용');
  }

  /* ================================================================
     8. 책갈피 (bookmark) — 이름 있는 앵커
     ================================================================ */
  async function openBookmark () {
    const r = await prompt2('책갈피 삽입', [
      { name: 'name', label: '책갈피 이름', type: 'text',
        placeholder: '예: 도입부 (영문/숫자/하이픈 권장)', required: true }
    ], { okLabel: '삽입' });
    if (!r || !r.name) return;
    const id = 'bm-' + r.name.replace(/[^\w가-힣-]/g, '-').replace(/-+/g, '-');
    pushUndo('bookmark');
    const html = '<a id="' + id + '" class="jan-bookmark" data-bookmark-name="' + r.name.replace(/"/g, '&quot;') +
      '" style="background:rgba(217,119,87,0.1); border-bottom:1px dashed #D97757; padding:0 3px;" ' +
      'title="책갈피: ' + r.name.replace(/"/g, '&quot;') + '">' + r.name + '</a>';
    exec('insertHTML', html);
    scheduleSave();
    notify('책갈피 "' + r.name + '" 삽입됨');
  }

  /* ================================================================
     9. 텍스트 상자 (text box) — 선택 영역을 테두리 박스로 래핑
     ================================================================ */
  async function openTextBox () {
    const sel = window.getSelection();
    const hasSelection = sel && !sel.isCollapsed && sel.toString();
    const r = await prompt2('텍스트 상자', [
      { name: 'border',  label: '테두리 (color, 비우면 없음)', type: 'text', value: '#D97757' },
      { name: 'background',  label: '배경색 (비우면 투명)', type: 'text', value: '#fef9f6' },
      { name: 'content', label: hasSelection ? '내용 (선택 영역 무시하려면 여기에 입력)' : '내용', type: 'textarea',
        placeholder: '상자 안에 넣을 텍스트', value: hasSelection ? '' : '' }
    ], { okLabel: '삽입' });
    if (!r) return;
    const borderCss = r.border ? '2px solid ' + r.border : 'none';
    const bgCss = r.background || 'transparent';
    const text = r.content || (hasSelection ? sel.toString() : '텍스트 상자');
    const html = '<div class="jan-textbox" style="border:' + borderCss + '; background:' + bgCss +
      '; padding:12px 16px; border-radius:6px; margin:10px 0;">' +
      text.replace(/\n/g, '<br>') + '</div>';
    pushUndo('textbox');
    if (hasSelection && !r.content) {
      /* 선택 영역을 대체 */
      exec('delete');
    }
    exec('insertHTML', html);
    scheduleSave();
    notify('텍스트 상자 삽입됨');
  }

  /* ================================================================
     10. 구분선 스타일 (HR variants)
     ================================================================ */
  function openHRVariants () {
    const variants = [
      { label: '기본 (실선)',  style: '' },
      { label: '점선',       style: 'border:0;border-top:1px dashed #888;' },
      { label: '이중선',      style: 'border:0;border-top:3px double #888;' },
      { label: '굵은 실선',    style: 'border:0;border-top:3px solid #333;' },
      { label: '장식선',      style: 'border:0;border-top:1px solid #eee;margin:20px 0;position:relative;overflow:visible;"><span style="position:absolute;left:50%;top:-8px;transform:translateX(-50%);background:#fff;padding:0 10px;color:#D97757;font-size:14px;">§</span><span class="__jan_hide_' },
      { label: '그라데이션',   style: 'border:0;height:2px;background:linear-gradient(to right, transparent, #D97757, transparent);' }
    ];
    const modal = $('modal');
    const title = $('modalTitle');
    const body = $('modalBody');
    const ok = $('modalOk');
    const cancel = $('modalCancel');
    if (!modal || !body) return notify('UI 오류');

    const origOkDisp = ok.style.display;
    const origOkText = ok.textContent;
    const origCancelText = cancel.textContent;

    title.textContent = '구분선 스타일 선택';
    body.innerHTML = '<div style="font-size:12px;color:#666;margin-bottom:10px;line-height:1.5;">삽입할 구분선 스타일을 선택하세요.</div>';
    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
    variants.slice(0,5).forEach(v => {
      const card = document.createElement('button');
      card.type = 'button';
      card.style.cssText = 'padding:12px; background:#fafafa; border:1px solid #eee; border-radius:8px; cursor:pointer; text-align:left; font-family:inherit; transition:all 0.12s;';
      card.innerHTML = '<div style="font-size:12.5px; color:#333; font-weight:600; margin-bottom:6px;">' + v.label + '</div>' +
        '<hr style="margin:0; ' + v.style.replace(/">.*/, '') + '">';
      card.addEventListener('mouseenter', () => { card.style.background = '#fef5f1'; card.style.borderColor = '#D97757'; });
      card.addEventListener('mouseleave', () => { card.style.background = '#fafafa'; card.style.borderColor = '#eee'; });
      card.addEventListener('click', () => {
        restoreModal();
        pushUndo('hr-variant');
        const hrHtml = v.style
          ? '<hr style="' + v.style.replace(/"><span.*/, '') + '">'
          : '<hr>';
        exec('insertHTML', hrHtml);
        scheduleSave();
        notify('구분선 삽입됨 — ' + v.label);
      });
      list.appendChild(card);
    });
    body.appendChild(list);

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
  window.JANWordFeatures = {
    openLetterSpacing,
    openCharScale,
    openFirstLineIndent,
    openParagraphSpacing,
    openTextEffects,
    openHighlightBox,
    openPageMargins,
    openBookmark,
    openTextBox,
    openHRVariants
  };

  /* 명령 팔레트 등록 — 대기 후 삽입 */
  function registerPaletteCommands () {
    if (!window.JAN_COMMANDS) return false;
    const items = [
      { name: '자간 설정',           ico: 'i-case-title', run: openLetterSpacing },
      { name: '장평 설정',           ico: 'i-case-title', run: openCharScale },
      { name: '첫 줄 들여쓰기',       ico: 'i-align-left', run: openFirstLineIndent },
      { name: '단락 간격',           ico: 'i-align-left', run: openParagraphSpacing },
      { name: '글자 효과',           ico: 'i-sparkles',   run: openTextEffects },
      { name: '강조 배경 상자',       ico: 'i-highlight',  run: openHighlightBox },
      { name: '페이지 여백 설정',     ico: 'i-pages',      run: openPageMargins },
      { name: '책갈피 삽입',         ico: 'i-bookmark',   run: openBookmark },
      { name: '텍스트 상자 삽입',     ico: 'i-clipboard',  run: openTextBox },
      { name: '구분선 스타일',        ico: 'i-diamond',    run: openHRVariants }
    ];
    items.forEach(it => {
      if (!window.JAN_COMMANDS.some(c => c.name === it.name)) {
        window.JAN_COMMANDS.push(Object.assign({ desc: 'MS Word 공통 기능' }, it));
      }
    });
    return true;
  }
  let _regRetry = 0;
  const _regTimer = setInterval(() => {
    if (registerPaletteCommands() || ++_regRetry > 30) clearInterval(_regTimer);
  }, 500);

})();
