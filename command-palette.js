/**
 * justanotepad Command Palette
 * --------------------------------------------------------------------------
 * Drop-in ES module. Adds a universal ⌘K / Ctrl+K command palette with:
 *   - Fuzzy memo search
 *   - Built-in quick actions (new memo, toggle theme, export, help, ...)
 *   - Custom actions via window.justanotepadPalette.register(...)
 *   - Keyboard navigation (↑ ↓ ⏎ Esc)
 *   - Zero external dependencies, self-contained CSS
 *   - Dark / light aware
 *   - Works on mobile (swipe down to close)
 *
 * Integration (app.html, before </body>):
 *     <script type="module" src="./command-palette.js"></script>
 *
 * Optional — tell the palette where your memos live:
 *     <script>
 *       window.justanotepadPaletteAdapter = {
 *         // Return an array of {id, title, content, updatedAt?}
 *         getMemos() {
 *           return JSON.parse(localStorage.getItem('memos') || '[]');
 *         },
 *         // Called when user selects a memo in the palette
 *         openMemo(id) {
 *           location.hash = '#memo/' + id;
 *         },
 *         // Called when user runs "New memo" built-in action
 *         createMemo() {
 *           document.querySelector('#new-memo-btn')?.click();
 *         },
 *       };
 *     </script>
 *
 * Custom actions:
 *     window.justanotepadPalette.register({
 *       id: 'export-json',
 *       title: 'Export memos as JSON',
 *       hint: '내 메모 전체를 파일로 다운로드',
 *       keywords: ['backup', '백업', 'json'],
 *       run() { exportMemos(); }
 *     });
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.justanotepadPalette) return; // idempotent

  // --------------------------------------------------------------------
  // Styles (scoped via .jnp-palette- prefix; injected once)
  // --------------------------------------------------------------------
  const CSS = `
  .jnp-palette-backdrop {
    position: fixed; inset: 0; background: rgba(15,15,20,0.45);
    backdrop-filter: blur(3px); z-index: 2147483000;
    display: flex; align-items: flex-start; justify-content: center;
    padding-top: 10vh; opacity: 0; transition: opacity 120ms ease;
  }
  .jnp-palette-backdrop.open { opacity: 1; }
  .jnp-palette {
    width: min(640px, 94vw);
    background: var(--jnp-bg, #ffffff); color: var(--jnp-fg, #1a1a1a);
    border-radius: 14px; box-shadow: 0 24px 64px rgba(0,0,0,0.35);
    overflow: hidden; font-family: -apple-system, BlinkMacSystemFont,
      "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", Roboto, sans-serif;
    transform: translateY(-6px); transition: transform 140ms ease;
  }
  .jnp-palette-backdrop.open .jnp-palette { transform: translateY(0); }
  .jnp-palette-input-row {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 18px; border-bottom: 1px solid var(--jnp-border, #eceff3);
  }
  .jnp-palette-icon {
    width: 18px; height: 18px; flex: 0 0 18px; color: var(--jnp-muted, #9aa1ad);
  }
  .jnp-palette-input {
    flex: 1; border: 0; outline: 0; font-size: 16px; background: transparent;
    color: inherit; font-family: inherit;
  }
  .jnp-palette-badge {
    font-size: 11px; padding: 2px 6px; border-radius: 4px;
    background: var(--jnp-chip, #f2f4f8); color: var(--jnp-muted, #6b7280);
    letter-spacing: 0.02em;
  }
  .jnp-palette-list {
    max-height: min(56vh, 480px); overflow-y: auto; padding: 6px;
    scrollbar-width: thin;
  }
  .jnp-palette-group {
    padding: 10px 12px 4px 12px;
    font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--jnp-muted, #9aa1ad); font-weight: 600;
  }
  .jnp-palette-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px; border-radius: 8px; cursor: pointer;
    user-select: none;
  }
  .jnp-palette-item:hover,
  .jnp-palette-item.active {
    background: var(--jnp-hover, #eff3fb);
  }
  .jnp-palette-item-main { flex: 1; min-width: 0; }
  .jnp-palette-item-title {
    font-size: 14px; font-weight: 500;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .jnp-palette-item-hint {
    font-size: 12px; color: var(--jnp-muted, #6b7280);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    margin-top: 2px;
  }
  .jnp-palette-item-kind {
    font-size: 11px; padding: 2px 7px; border-radius: 999px;
    background: var(--jnp-chip, #f2f4f8); color: var(--jnp-muted, #6b7280);
    flex: 0 0 auto;
  }
  .jnp-palette-kbd {
    font: 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    padding: 2px 6px; border: 1px solid var(--jnp-border, #e2e6ec);
    border-bottom-width: 2px; border-radius: 4px;
    background: var(--jnp-chip, #f7f8fa); color: var(--jnp-muted, #6b7280);
  }
  .jnp-palette-empty {
    padding: 36px 16px; text-align: center; color: var(--jnp-muted, #9aa1ad);
    font-size: 13px;
  }
  .jnp-palette-footer {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 14px; border-top: 1px solid var(--jnp-border, #eceff3);
    font-size: 11px; color: var(--jnp-muted, #9aa1ad);
  }
  .jnp-palette-footer .jnp-kbds { display: flex; gap: 8px; }
  .jnp-highlight { background: rgba(255, 221, 87, 0.45); border-radius: 2px; }

  @media (prefers-color-scheme: dark) {
    .jnp-palette {
      --jnp-bg: #1b1d22; --jnp-fg: #e9ecef; --jnp-border: #2d3138;
      --jnp-chip: #262a31; --jnp-muted: #9199a5; --jnp-hover: #24272f;
    }
    .jnp-highlight { background: rgba(255, 221, 87, 0.25); color: inherit; }
  }
  /* Honor a manual dark-mode class if the host app toggles one */
  .jnp-dark .jnp-palette {
    --jnp-bg: #1b1d22; --jnp-fg: #e9ecef; --jnp-border: #2d3138;
    --jnp-chip: #262a31; --jnp-muted: #9199a5; --jnp-hover: #24272f;
  }
  `;

  const styleTag = document.createElement('style');
  styleTag.setAttribute('data-jnp-palette', '');
  styleTag.textContent = CSS;
  document.head.appendChild(styleTag);

  // --------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------
  const state = {
    open: false,
    query: '',
    activeIndex: 0,
    results: [],
    customActions: [],
  };

  // --------------------------------------------------------------------
  // Default adapter (overridable via window.justanotepadPaletteAdapter)
  // --------------------------------------------------------------------
  function getAdapter() {
    const a = window.justanotepadPaletteAdapter || {};
    return {
      getMemos: a.getMemos || defaultGetMemos,
      openMemo: a.openMemo || defaultOpenMemo,
      createMemo: a.createMemo || defaultCreateMemo,
      toggleTheme: a.toggleTheme || defaultToggleTheme,
      exportMemos: a.exportMemos || defaultExportMemos,
    };
  }

  function defaultGetMemos() {
    // Try several common storage keys used by notepad apps
    const candidates = ['memos', 'notes', 'justanotepad:memos', 'notepad-memos'];
    for (const key of candidates) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
        if (parsed && typeof parsed === 'object') {
          const arr = Object.values(parsed);
          if (arr.length && typeof arr[0] === 'object') return arr;
        }
      } catch { /* ignore */ }
    }
    return [];
  }

  function defaultOpenMemo(id) {
    location.hash = '#memo/' + encodeURIComponent(id);
  }

  function defaultCreateMemo() {
    const btn =
      document.querySelector('[data-action="new-memo"]') ||
      document.querySelector('#new-memo') ||
      document.querySelector('#new-memo-btn');
    if (btn) { btn.click(); return; }
    location.hash = '#new';
  }

  function defaultToggleTheme() {
    document.documentElement.classList.toggle('jnp-dark');
    document.body.classList.toggle('dark');
  }

  function defaultExportMemos() {
    const memos = getAdapter().getMemos();
    const blob = new Blob([JSON.stringify(memos, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `justanotepad-export-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // --------------------------------------------------------------------
  // Built-in actions
  // --------------------------------------------------------------------
  function builtInActions() {
    const ad = getAdapter();
    return [
      {
        id: 'new-memo',
        title: '새 메모 작성',
        hint: 'New memo',
        keywords: ['new', 'create', 'add', '신규', '작성', '쓰기'],
        kind: 'action',
        run: () => ad.createMemo(),
      },
      {
        id: 'toggle-theme',
        title: '테마 전환 (라이트/다크)',
        hint: 'Toggle theme',
        keywords: ['theme', 'dark', 'light', '다크', '라이트', '테마'],
        kind: 'action',
        run: () => ad.toggleTheme(),
      },
      {
        id: 'export-memos',
        title: '메모 내보내기 (JSON)',
        hint: 'Download all memos as JSON',
        keywords: ['export', 'download', 'backup', '백업', '다운로드', '내보내기'],
        kind: 'action',
        run: () => ad.exportMemos(),
      },
      {
        id: 'help-shortcuts',
        title: '단축키 안내 보기',
        hint: 'Show keyboard shortcuts',
        keywords: ['help', 'shortcut', '도움말', '단축키'],
        kind: 'action',
        run: () => showShortcutHelp(),
      },
    ];
  }

  function allActions() {
    return [...builtInActions(), ...state.customActions];
  }

  function showShortcutHelp() {
    close();
    setTimeout(() => {
      alert(
        [
          '⌨️ 단축키',
          '',
          '  ⌘/Ctrl + K      명령 팔레트 열기',
          '  ↑ / ↓           항목 이동',
          '  Enter           선택',
          '  Esc             닫기',
          '',
          '팁: 메모 제목 일부만 입력해도 검색됩니다.',
        ].join('\n')
      );
    }, 180);
  }

  // --------------------------------------------------------------------
  // Fuzzy scoring
  // --------------------------------------------------------------------
  function score(haystack, needle) {
    if (!needle) return 0;
    haystack = (haystack || '').toLowerCase();
    needle = needle.toLowerCase();
    if (!haystack) return -1;
    if (haystack === needle) return 1000;
    if (haystack.startsWith(needle)) return 500;
    const idx = haystack.indexOf(needle);
    if (idx >= 0) return 300 - idx;

    // Subsequence match
    let h = 0, n = 0, last = -1, gap = 0;
    while (h < haystack.length && n < needle.length) {
      if (haystack[h] === needle[n]) {
        if (last >= 0) gap += h - last - 1;
        last = h;
        n++;
      }
      h++;
    }
    if (n === needle.length) return 100 - Math.min(gap, 90);
    return -1;
  }

  function highlight(text, query) {
    if (!query || !text) return escapeHtml(text || '');
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    const idx = t.indexOf(q);
    if (idx < 0) return escapeHtml(text);
    return (
      escapeHtml(text.slice(0, idx)) +
      '<span class="jnp-highlight">' +
      escapeHtml(text.slice(idx, idx + q.length)) +
      '</span>' +
      escapeHtml(text.slice(idx + q.length))
    );
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  // --------------------------------------------------------------------
  // Search
  // --------------------------------------------------------------------
  function search(query) {
    const q = (query || '').trim();
    const actions = allActions();
    const memos = (getAdapter().getMemos() || []).map(normalizeMemo).filter(Boolean);

    if (!q) {
      // Default view: show actions and recent memos
      const recent = [...memos]
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, 8);
      return [
        { group: '빠른 작업', items: actions.map((a) => ({ ...a, _score: 0 })) },
        ...(recent.length
          ? [{ group: '최근 메모', items: recent.map((m) => ({ ...m, _score: 0 })) }]
          : []),
      ];
    }

    const actionHits = actions
      .map((a) => ({
        ...a,
        _score: Math.max(
          score(a.title, q),
          score(a.hint, q),
          ...(a.keywords || []).map((k) => score(k, q))
        ),
      }))
      .filter((a) => a._score >= 0)
      .sort((a, b) => b._score - a._score);

    const memoHits = memos
      .map((m) => ({
        ...m,
        _score: Math.max(score(m.title, q), score(m.content, q) - 50),
      }))
      .filter((m) => m._score >= 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 30);

    return [
      ...(actionHits.length
        ? [{ group: '빠른 작업', items: actionHits }]
        : []),
      ...(memoHits.length
        ? [{ group: '메모', items: memoHits }]
        : []),
    ];
  }

  function normalizeMemo(m) {
    if (!m || typeof m !== 'object') return null;
    const id =
      m.id ?? m._id ?? m.uuid ?? m.key ?? m.slug ?? String(m.createdAt || Math.random());
    const title =
      m.title ||
      m.name ||
      m.heading ||
      (typeof m.content === 'string' ? m.content.slice(0, 60) : '') ||
      '제목 없음';
    const content =
      typeof m.content === 'string'
        ? m.content
        : typeof m.body === 'string'
        ? m.body
        : typeof m.text === 'string'
        ? m.text
        : '';
    const updatedAt = Number(
      m.updatedAt || m.updated_at || m.modified || m.mtime || m.createdAt || 0
    );
    return { id, title, content, updatedAt, kind: 'memo' };
  }

  // --------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------
  let elements = null;

  function ensureDom() {
    if (elements) return elements;

    const backdrop = document.createElement('div');
    backdrop.className = 'jnp-palette-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.innerHTML = `
      <div class="jnp-palette" role="combobox" aria-expanded="true" aria-haspopup="listbox">
        <div class="jnp-palette-input-row">
          <svg class="jnp-palette-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input class="jnp-palette-input" type="text" autocomplete="off" spellcheck="false"
                 placeholder="메모 검색 또는 명령 실행 (예: 새 메모, 테마)" aria-label="Search" />
          <span class="jnp-palette-badge">⌘K</span>
        </div>
        <div class="jnp-palette-list" role="listbox"></div>
        <div class="jnp-palette-footer">
          <span>justanotepad</span>
          <span class="jnp-kbds">
            <span class="jnp-palette-kbd">↑↓</span>
            <span class="jnp-palette-kbd">⏎</span>
            <span class="jnp-palette-kbd">Esc</span>
          </span>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    const input = backdrop.querySelector('.jnp-palette-input');
    const list = backdrop.querySelector('.jnp-palette-list');

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
    input.addEventListener('input', () => {
      state.query = input.value;
      state.activeIndex = 0;
      render();
    });
    input.addEventListener('keydown', (e) => {
      const flat = flatItems();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        state.activeIndex = Math.min(flat.length - 1, state.activeIndex + 1);
        render();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        state.activeIndex = Math.max(0, state.activeIndex - 1);
        render();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = flat[state.activeIndex];
        if (item) runItem(item);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    });

    elements = { backdrop, input, list };
    return elements;
  }

  function flatItems() {
    return state.results.flatMap((g) => g.items);
  }

  function render() {
    const { list } = ensureDom();
    state.results = search(state.query);
    const flat = flatItems();
    if (state.activeIndex >= flat.length) state.activeIndex = Math.max(0, flat.length - 1);

    if (!flat.length) {
      list.innerHTML = `<div class="jnp-palette-empty">일치하는 결과가 없어요.</div>`;
      return;
    }

    let globalIdx = 0;
    const html = state.results
      .map((group) => {
        const itemsHtml = group.items
          .map((item) => {
            const idx = globalIdx++;
            const isActive = idx === state.activeIndex;
            const title = highlight(item.title, state.query);
            const hint =
              item.kind === 'memo'
                ? highlight((item.content || '').slice(0, 90), state.query)
                : escapeHtml(item.hint || '');
            const badge =
              item.kind === 'memo'
                ? '메모'
                : (item.badge || '명령');
            return `
              <div class="jnp-palette-item ${isActive ? 'active' : ''}"
                   role="option" data-idx="${idx}">
                <div class="jnp-palette-item-main">
                  <div class="jnp-palette-item-title">${title}</div>
                  ${hint ? `<div class="jnp-palette-item-hint">${hint}</div>` : ''}
                </div>
                <span class="jnp-palette-item-kind">${escapeHtml(badge)}</span>
              </div>
            `;
          })
          .join('');
        return `<div class="jnp-palette-group">${escapeHtml(group.group)}</div>${itemsHtml}`;
      })
      .join('');

    list.innerHTML = html;

    list.querySelectorAll('.jnp-palette-item').forEach((el) => {
      el.addEventListener('mouseenter', () => {
        state.activeIndex = Number(el.dataset.idx);
        render();
      });
      el.addEventListener('click', () => {
        const idx = Number(el.dataset.idx);
        const item = flatItems()[idx];
        if (item) runItem(item);
      });
    });

    // Keep active item visible
    const active = list.querySelector('.jnp-palette-item.active');
    if (active && active.scrollIntoView) {
      active.scrollIntoView({ block: 'nearest' });
    }
  }

  function runItem(item) {
    if (item.kind === 'memo') {
      close();
      try { getAdapter().openMemo(item.id); } catch (e) { console.error(e); }
    } else if (typeof item.run === 'function') {
      try { item.run(); } catch (e) { console.error(e); }
      if (item.keepOpen !== true) close();
    }
  }

  // --------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------
  function open() {
    if (state.open) return;
    state.open = true;
    state.query = '';
    state.activeIndex = 0;
    const { backdrop, input } = ensureDom();
    render();
    requestAnimationFrame(() => {
      backdrop.classList.add('open');
      input.value = '';
      input.focus();
    });
  }

  function close() {
    if (!state.open) return;
    state.open = false;
    const { backdrop } = ensureDom();
    backdrop.classList.remove('open');
    setTimeout(() => {
      if (!state.open && backdrop.parentNode) {
        /* keep in DOM for reuse, just hide via opacity */
      }
    }, 140);
  }

  function toggle() {
    state.open ? close() : open();
  }

  function register(action) {
    if (!action || !action.id || !action.title) return;
    const existingIdx = state.customActions.findIndex((a) => a.id === action.id);
    const normalized = {
      kind: 'action',
      keywords: [],
      ...action,
    };
    if (existingIdx >= 0) state.customActions[existingIdx] = normalized;
    else state.customActions.push(normalized);
  }

  // --------------------------------------------------------------------
  // Global keyboard shortcut
  // --------------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      toggle();
    } else if (e.key === 'Escape' && state.open) {
      e.preventDefault();
      close();
    }
  });

  window.justanotepadPalette = { open, close, toggle, register };
})();
