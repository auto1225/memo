/**
 * JustANotepad — app.html integration for the CMS features
 * --------------------------------------------------------------------------
 * Bridges the standalone widgets (template-picker, home-hub) to the main
 * editor's internal state. The app already has its own wikilinks
 * (processWikiLinks) and tags (state.tabs[].tag) so we reuse those.
 *
 * Responsibilities:
 *   1. Listen for `jan:template-selected` and create a new tab with the
 *      template body (Markdown → HTML).
 *   2. Register Ctrl+Shift+T to open the template picker.
 *   3. Auto-open picker on ?template=1 / auto-load on ?template=<slug>.
 *   4. Expose window.JANAppState — read-only snapshot for widgets (tags,
 *      pending todos, recent tabs) so the home-hub drawer can surface them.
 *   5. Add "홈 허브에 정보 공급" — update a shared state snapshot any time
 *      the editor saves.
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.__janAppIntegration__) return;
  window.__janAppIntegration__ = true;

  // ---- Markdown → HTML --------------------------------------------------
  // Lazy-load marked. Cached after first load.
  let markedReady = null;
  function loadMarked() {
    if (markedReady) return markedReady;
    markedReady = new Promise((resolve) => {
      if (window.marked) return resolve(window.marked);
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
      s.onload = () => resolve(window.marked);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
    return markedReady;
  }

  async function markdownToEditorHtml(md) {
    const lib = await loadMarked();
    if (!lib) {
      // Crude fallback: just wrap lines in <div>
      return (md || '').split('\n').map(l => `<div>${l ? escapeHtml(l) : '<br>'}</div>`).join('');
    }
    return lib.parse(md || '');
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'})[c]);
  }

  // body 가 HTML 인지 markdown 인지 판별.
  // 프로 템플릿 (templates-pro.js) 은 <h1>·<table> 같이 태그로 시작하는 리치 HTML.
  // 옛날 마크다운 템플릿은 "# 제목" / "## 소제목" 으로 시작.
  function looksLikeHtml(s) {
    if (!s) return false;
    const trimmed = String(s).trimStart();
    // < 로 시작하고, 바로 뒤에 태그 이름 문자 → HTML
    return /^<[a-zA-Z!][\w:-]*/.test(trimmed);
  }

  // ---- Tab creation from template --------------------------------------
  async function createTabFromTemplate(tpl) {
    // Wait for app's addTab to exist (app.html loads after scripts at bottom — should be present)
    if (typeof window.addTab !== 'function') {
      // Expose it? The app declares addTab in a closure, so we can't reach in.
      // Fall back to dispatching a custom handler that the app could pick up.
      console.warn('[JAN] addTab() not globally available. Adding a custom-event listener fallback.');
      document.dispatchEvent(new CustomEvent('jan:create-tab-request', { detail: tpl }));
      return;
    }
    const body = tpl.body || '';
    // HTML 이면 변환 없이 그대로 삽입 → 표/체크박스/인용구 원형 유지
    const html = looksLikeHtml(body) ? body : await markdownToEditorHtml(body);
    const name = tpl.name || '(무제)';
    window.addTab(name, html);
    if (window.toast) window.toast(`"${name}" 템플릿으로 새 탭 생성`);
  }

  // Hook: when template picker fires its event, create the tab
  document.addEventListener('jan:template-selected', async (e) => {
    const tpl = e.detail;
    if (!tpl) return;
    if (tpl.slug === '__blank') {
      if (typeof window.addTab === 'function') window.addTab('새 메모', '');
      return;
    }
    await createTabFromTemplate(tpl);
  });

  // ---- Keyboard shortcut Ctrl+Shift+T ----------------------------------
  document.addEventListener('keydown', (e) => {
    // Don't conflict with native new-tab on desktop browsers
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 't') {
      e.preventDefault();
      if (window.JANTemplatePicker) {
        window.JANTemplatePicker.open({
          onPick: (tpl) => document.dispatchEvent(new CustomEvent('jan:template-selected', { detail: tpl })),
        });
      }
    }
  });

  // ---- URL param support -----------------------------------------------
  function handleUrlParams() {
    const params = new URLSearchParams(location.search);
    const tpl = params.get('template');
    if (!tpl) return;
    if (tpl === '1') {
      // Picker auto-opens via template-picker.js itself
      return;
    }
    // Specific slug
    if (window.JANTemplatePicker?.getBySlug) {
      window.JANTemplatePicker.getBySlug(tpl).then((t) => {
        if (t) document.dispatchEvent(new CustomEvent('jan:template-selected', { detail: t }));
      });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(handleUrlParams, 400));
  } else {
    setTimeout(handleUrlParams, 400);
  }

  // ---- App state snapshot for widgets ----------------------------------
  // The editor's `state` is in a closure (not globally exposed), so we
  // re-read the localStorage key the app uses. Keep this passive (read-only).
  function readAppState() {
    try {
      // Try common storage keys the app might use
      for (const k of ['sticky-memo-v4', 'jan.notepad', 'justanotepad.v4', 'sticky-memo.v4', 'sticky-memo']) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const d = JSON.parse(raw);
        if (d?.tabs?.length) return { key: k, data: d };
      }
    } catch {}
    return null;
  }

  function extractTodos(html) {
    if (!html) return { total: 0, done: 0 };
    const div = document.createElement('div');
    div.innerHTML = html;
    // Look for checkbox patterns: - [ ], - [x], <input type="checkbox">
    const text = div.innerText || '';
    const unchecked = (text.match(/^\s*[-*]\s*\[ \]/gm) || []).length;
    const checked   = (text.match(/^\s*[-*]\s*\[x\]/gim) || []).length;
    const inputs = div.querySelectorAll('input[type="checkbox"]');
    let inpDone = 0, inpTotal = inputs.length;
    inputs.forEach(i => { if (i.checked) inpDone++; });
    return { total: unchecked + checked + inpTotal, done: checked + inpDone };
  }

  window.JANAppState = {
    snapshot() {
      const s = readAppState();
      if (!s) return null;
      const tabs = s.data.tabs || [];
      const tags = {};
      const todos = { total: 0, done: 0 };
      for (const t of tabs) {
        if (t.tag) tags[t.tag] = (tags[t.tag] || 0) + 1;
        const td = extractTodos(t.html || '');
        todos.total += td.total;
        todos.done  += td.done;
      }
      // Sort tabs by modified desc
      const recent = [...tabs]
        .sort((a, b) => (b.modified || 0) - (a.modified || 0))
        .slice(0, 8)
        .map(t => ({ id: t.id, name: t.name, tag: t.tag, modified: t.modified, starred: t.starred }));
      return {
        tabsTotal: tabs.length,
        wsTotal: (s.data.workspaces || []).length,
        tags, todos, recent,
        storageKey: s.key,
      };
    },
  };
})();
