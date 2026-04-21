/**
 * JustANotepad — Template Picker Widget
 * --------------------------------------------------------------------------
 * Drop-in script that exposes a `window.JANTemplatePicker` API.
 * Intended for use by app.html. Loads templates from cms_templates
 * (public read), renders a modal grid, and calls back with the chosen
 * template body when the user picks one.
 *
 * USAGE from app.html:
 *    window.JANTemplatePicker.open({
 *      onPick: (tpl) => {
 *        // tpl = { slug, name, body, category, description }
 *        insertIntoEditor(tpl.body);
 *      }
 *    });
 *
 * Also auto-opens if the URL has ?template=<slug> (loads that one directly),
 * or ?template=1 (opens the picker).
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.JANTemplatePicker) return;

  const URL_ = window.SUPABASE_URL;
  const KEY  = window.SUPABASE_ANON_KEY;

  // 내장 프로 템플릿 (templates-pro.js 가 먼저 로드됨)
  const builtin = () => (Array.isArray(window.JAN_BUILTIN_TEMPLATES) ? window.JAN_BUILTIN_TEMPLATES : []);

  const API = {
    async list() {
      // 1) 내장 프로 템플릿 (항상 먼저, is_official=true)
      const pro = builtin().map(t => ({ ...t, _source: 'builtin' }));
      // 2) DB 템플릿 (Supabase, 있으면)
      let remote = [];
      if (URL_ && KEY) {
        try {
          const r = await fetch(`${URL_}/rest/v1/cms_templates?select=slug,name,category,description,body,icon,is_official&is_public=eq.true&order=is_official.desc,sort_order.asc`, {
            headers: { apikey: KEY, Authorization: 'Bearer ' + KEY },
          });
          if (r.ok) remote = await r.json();
        } catch {}
        remote = (remote || []).map(t => ({ ...t, _source: 'remote' }));
      }
      // 같은 slug 는 내장 우선 (내장이 품질 보장)
      const seen = new Set(pro.map(t => t.slug));
      const merged = [...pro, ...remote.filter(t => !seen.has(t.slug))];
      return merged;
    },
    async getBySlug(slug) {
      if (!slug) return null;
      // 내장 먼저 확인
      const b = (window.JAN_BUILTIN_TEMPLATE_MAP || {})[slug];
      if (b) return b;
      if (!URL_ || !KEY) return null;
      try {
        const r = await fetch(`${URL_}/rest/v1/cms_templates?select=*&slug=eq.${encodeURIComponent(slug)}&limit=1`, {
          headers: { apikey: KEY, Authorization: 'Bearer ' + KEY },
        });
        if (!r.ok) return null;
        const rows = await r.json();
        return rows[0] || null;
      } catch { return null; }
    },
    async incrementUse(slug) {
      // 내장 템플릿은 서버 카운트 의미 없음 — skip
      if ((window.JAN_BUILTIN_TEMPLATE_MAP || {})[slug]) return;
      if (!URL_ || !KEY) return;
      // Best-effort — RLS may block for anon; silently fail
      try {
        const current = await API.getBySlug(slug);
        if (!current) return;
        await fetch(`${URL_}/rest/v1/cms_templates?slug=eq.${encodeURIComponent(slug)}`, {
          method: 'PATCH',
          headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ use_count: (current.use_count || 0) + 1 }),
        });
      } catch {}
    },
  };

  let stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const css = `
      .jan-tpl-overlay {
        position:fixed; inset:0; background:rgba(20,20,20,0.45);
        display:flex; align-items:center; justify-content:center;
        z-index:10000; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Apple SD Gothic Neo","Noto Sans KR",sans-serif;
        animation: jan-fadein 0.15s ease; backdrop-filter:blur(4px);
      }
      @keyframes jan-fadein { from { opacity:0; } to { opacity:1; } }
      .jan-tpl-modal {
        background:#fff; width:min(880px, 94vw); max-height:85vh;
        border-radius:12px; box-shadow:0 20px 60px rgba(0,0,0,0.18);
        display:flex; flex-direction:column; overflow:hidden;
      }
      .jan-tpl-hd {
        padding:20px 24px 14px; border-bottom:1px solid #e5e7eb;
        display:flex; align-items:center; gap:12px;
      }
      .jan-tpl-hd h2 { margin:0; font-size:18px; font-weight:700; flex:1; }
      .jan-tpl-hd input {
        padding:8px 12px; border:1px solid #e5e7eb; border-radius:8px;
        font-size:13px; width:200px; font-family:inherit;
      }
      .jan-tpl-hd .x {
        width:32px; height:32px; border:0; background:#f3f4f6; border-radius:50%;
        cursor:pointer; font-size:18px; color:#6b7280;
      }
      .jan-tpl-hd .x:hover { background:#e5e7eb; }
      .jan-tpl-bd {
        padding:20px 24px; overflow-y:auto; flex:1;
      }
      .jan-tpl-cats { display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap; }
      .jan-tpl-cat {
        padding:5px 12px; border:1px solid #e5e7eb; border-radius:999px;
        font-size:12px; background:#fff; cursor:pointer; color:#6b7280;
        font-family:inherit;
      }
      .jan-tpl-cat.active { background:#141414; color:#fff; border-color:#141414; }
      .jan-tpl-grid {
        display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px;
      }
      .jan-tpl-tile {
        border:1px solid #e5e7eb; border-radius:10px; padding:16px;
        cursor:pointer; background:#fafaf7;
        transition:transform 0.12s, border-color 0.12s, background 0.12s;
      }
      .jan-tpl-tile:hover {
        transform:translateY(-2px); border-color:#D97757; background:#fff;
      }
      .jan-tpl-tile .c { color:#D97757; font-size:10px; font-weight:700;
        text-transform:uppercase; letter-spacing:0.06em; }
      .jan-tpl-tile .n { font-weight:700; font-size:14px; margin:4px 0; color:#1f2937; }
      .jan-tpl-tile .d { color:#6b7280; font-size:12px; line-height:1.5; }
      .jan-tpl-tile .b {
        display:inline-block; padding:2px 6px; background:#fef3c7; color:#92400e;
        font-size:9px; font-weight:700; border-radius:3px; margin-top:8px;
      }
      .jan-tpl-empty { padding:60px 20px; text-align:center; color:#9ca3af; font-size:14px; }
      .jan-tpl-ft { padding:12px 24px; border-top:1px solid #e5e7eb;
        display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#9ca3af; }
      .jan-tpl-ft a { color:#D97757; text-decoration:none; font-weight:600; }
    `;
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  function escape(s) {
    return String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'})[c]);
  }

  async function open(opts) {
    opts = opts || {};
    injectStyles();
    const templates = await API.list();
    const categories = [...new Set(templates.map(t => t.category).filter(Boolean))];
    let activeCat = 'all';
    let filter = '';

    const overlay = document.createElement('div');
    overlay.className = 'jan-tpl-overlay';
    overlay.innerHTML = `
      <div class="jan-tpl-modal" role="dialog" aria-label="템플릿 선택">
        <div class="jan-tpl-hd">
          <h2>템플릿으로 시작하기</h2>
          <input type="search" placeholder="이름/설명 검색" aria-label="검색" id="jan-tpl-q">
          <button class="x" aria-label="닫기" id="jan-tpl-x">×</button>
        </div>
        <div class="jan-tpl-bd">
          <div class="jan-tpl-cats" id="jan-tpl-cats">
            <button class="jan-tpl-cat active" data-cat="all">전체 (${templates.length})</button>
            ${categories.map(c => `<button class="jan-tpl-cat" data-cat="${escape(c)}">${escape(c)}</button>`).join('')}
            <button class="jan-tpl-cat" data-cat="__blank">빈 노트로 시작</button>
          </div>
          <div class="jan-tpl-grid" id="jan-tpl-grid"></div>
        </div>
        <div class="jan-tpl-ft">
          <span>총 ${templates.length}개의 템플릿</span>
          <a href="/admin" target="_blank" rel="noopener">템플릿 추가하기 →</a>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => { overlay.remove(); };
    const pick = (tpl) => {
      close();
      if (tpl && tpl.slug) API.incrementUse(tpl.slug);
      if (opts.onPick) opts.onPick(tpl);
    };

    const render = () => {
      let list = templates;
      if (activeCat === '__blank') { pick({ slug:'__blank', name:'빈 노트', body:'' }); return; }
      if (activeCat !== 'all') list = list.filter(t => t.category === activeCat);
      if (filter) {
        const q = filter.toLowerCase();
        list = list.filter(t => (t.name+' '+(t.description||'')+' '+(t.body||'')).toLowerCase().includes(q));
      }
      const grid = overlay.querySelector('#jan-tpl-grid');
      if (!list.length) {
        grid.innerHTML = `<div class="jan-tpl-empty">일치하는 템플릿이 없습니다.</div>`;
        return;
      }
      // 타일 아이콘: 내장 템플릿은 SVG 스프라이트 참조 (i-*), DB 는 텍스트 이모지였어도 무시.
      // 이모지 절대 사용 금지 규칙.
      const tileIconFn = window.JAN_TEMPLATE_TILE_ICON || (() => '');
      grid.innerHTML = list.map(t => {
        const iconHtml = (t.icon && /^i-[\w-]+$/.test(t.icon))
          ? `<div class="ic" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:6px;background:color-mix(in srgb, var(--accent, #FAE100) 20%, transparent);color:var(--ink, #111);margin-bottom:6px;">${tileIconFn(t.icon)}</div>`
          : '';
        return `
        <div class="jan-tpl-tile" data-slug="${escape(t.slug)}">
          ${iconHtml}
          ${t.category ? `<div class="c">${escape(t.category)}</div>` : ''}
          <div class="n">${escape(t.name)}</div>
          ${t.description ? `<div class="d">${escape(t.description)}</div>` : ''}
          ${t.is_official ? '<div class="b">공식</div>' : ''}
        </div>`;
      }).join('');
      grid.querySelectorAll('.jan-tpl-tile').forEach(el => el.addEventListener('click', () => {
        const slug = el.dataset.slug;
        const tpl = templates.find(t => t.slug === slug);
        pick(tpl);
      }));
    };

    overlay.querySelector('#jan-tpl-x').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#jan-tpl-q').addEventListener('input', (e) => { filter = e.target.value; render(); });
    overlay.querySelectorAll('.jan-tpl-cat').forEach(btn => btn.addEventListener('click', () => {
      overlay.querySelectorAll('.jan-tpl-cat').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCat = btn.dataset.cat;
      render();
    }));
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(); }
    });

    render();
  }

  window.JANTemplatePicker = {
    open,
    list: API.list,
    getBySlug: API.getBySlug,
  };

  // Auto-open if query param ?template=...
  if (typeof location !== 'undefined') {
    const params = new URLSearchParams(location.search);
    const tpl = params.get('template');
    if (tpl && tpl !== '1') {
      // Specific slug requested
      API.getBySlug(tpl).then(t => {
        if (t) {
          document.dispatchEvent(new CustomEvent('jan:template-selected', { detail: t }));
          API.incrementUse(tpl);
        }
      });
    } else if (tpl === '1') {
      // Open picker on load (after DOM ready)
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => open({
          onPick: (t) => document.dispatchEvent(new CustomEvent('jan:template-selected', { detail: t })),
        }));
      } else {
        open({
          onPick: (t) => document.dispatchEvent(new CustomEvent('jan:template-selected', { detail: t })),
        });
      }
    }
  }
})();
