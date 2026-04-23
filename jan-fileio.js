/**
 * JustANotepad · File I/O Helper (v1.0)
 * --------------------------------------------------------------------------
 * 모든 저장/불러오기 흐름을 통일된 API 로 처리. 사용자가 저장 폴더를
 * 명시적으로 선택할 수 있도록 네이티브 파일 대화상자 사용.
 *
 * 우선순위:
 *   1. showSaveFilePicker / showOpenFilePicker (File System Access API)
 *      — Chrome/Edge/WebView2 지원. 네이티브 폴더 내비게이션 포함.
 *   2. <a download> / <input type="file">
 *      — Safari/Firefox 폴백. 기본 Downloads 폴더로 저장.
 *
 * 최근 폴더 기억:
 *   - FSA 는 경로를 노출하지 않지만 브라우저 자체가 마지막 폴더를 세션 간에
 *     기억함 (WebView2 기준). 추가로 localStorage 에 마지막 파일명만 저장해
 *     기본 suggestedName 만들기.
 *
 * API:
 *   window.jnpIO.saveBlob(blob, suggestedName, filters?)   → saved path(?) or null
 *   window.jnpIO.saveText(text, suggestedName, mime?, filters?)
 *   window.jnpIO.saveDataUrl(dataUrl, suggestedName, filters?)
 *   window.jnpIO.loadFile(filters?, multiple?)             → {blob,name} | null
 *
 * filters 예시:
 *   [{ description:'이미지', accept:{'image/png':['.png']} }]
 *   [{ description:'텍스트', accept:{'text/plain':['.txt','.md']} }]
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.jnpIO) return;

  const hasFSA = typeof window.showSaveFilePicker === 'function';
  const hasOpenFSA = typeof window.showOpenFilePicker === 'function';

  // localStorage 에 마지막 사용한 suggestedName 기억 — 다음에 같은 종류 파일
  // 저장할 때 기본값 참고.
  const LS_LAST_DIR_HINT = 'jan.io.lastFolderHint';   // FSA 에선 경로 획득 불가.
  const LS_LAST_FILE_BY_EXT = 'jan.io.lastFileByExt'; // { ext: filename }

  function getLastFileName(ext) {
    try {
      const raw = localStorage.getItem(LS_LAST_FILE_BY_EXT);
      if (!raw) return null;
      const m = JSON.parse(raw);
      return m[ext] || null;
    } catch { return null; }
  }
  function setLastFileName(ext, name) {
    if (!ext || !name) return;
    try {
      const raw = localStorage.getItem(LS_LAST_FILE_BY_EXT);
      const m = raw ? JSON.parse(raw) : {};
      m[ext] = name;
      localStorage.setItem(LS_LAST_FILE_BY_EXT, JSON.stringify(m));
    } catch {}
  }

  function extOf(name) {
    if (!name) return '';
    const i = name.lastIndexOf('.');
    return i > 0 ? name.slice(i).toLowerCase() : '';
  }

  // FSA 에서 `startIn` 힌트 — 마지막으로 쓴 well-known directory 이름을 기억해
  // "documents" / "downloads" 등을 넘기면 그 폴더에서 dialog 가 시작됨.
  function getStartInHint() {
    try {
      const h = localStorage.getItem(LS_LAST_DIR_HINT);
      // 유효한 well-known 이름 목록
      if (['desktop','documents','downloads','music','pictures','videos'].includes(h)) return h;
    } catch {}
    return 'documents';
  }
  function setStartInHint(name) {
    try { localStorage.setItem(LS_LAST_DIR_HINT, name); } catch {}
  }

  // Tauri v2 네이티브 dialog + fs 우선 — WebView2 의 showSaveFilePicker 가
  // 보여주는 폴더 드롭다운(OneDrive/최근 경로)을 우회해 실제 Windows 파일
  // 탐색기를 열어 임의 폴더 선택 가능.
  async function trySaveBlobWithTauri(blob, suggestedName, filters) {
    try {
      const tauri = window.__TAURI__;
      if (!tauri) return null;
      const dlg = tauri.dialog;
      const fs  = tauri.fs;
      if (!dlg || !fs || typeof dlg.save !== 'function' || typeof fs.writeFile !== 'function') return null;

      // filters(FSA shape) → Tauri shape
      const tauriFilters = [];
      for (const f of (filters || [])) {
        const exts = [];
        for (const mime of Object.keys(f.accept || {})) {
          for (const e of (f.accept[mime] || [])) {
            exts.push(e.replace(/^\./,''));
          }
        }
        if (exts.length) tauriFilters.push({ name: f.description || 'file', extensions: exts });
      }

      const path = await dlg.save({
        defaultPath: suggestedName,
        filters: tauriFilters.length ? tauriFilters : undefined,
      });
      if (!path) return { cancelled: true };

      const buf = await blob.arrayBuffer();
      await fs.writeFile(path, new Uint8Array(buf));
      return { name: path, method: 'tauri' };
    } catch (e) {
      console.warn('[jnpIO.saveBlob Tauri 실패 → FSA]', e);
      return null;
    }
  }

  // ---- SAVE ------------------------------------------------------------
  async function saveBlob(blob, suggestedName, filters) {
    filters = filters || [{ description: '모든 파일', accept: { '*/*': ['*'] } }];
    const ext = extOf(suggestedName);

    // 0) Tauri 네이티브 save 다이얼로그 (데스크톱 앱 전용, 최우선)
    const tauriResult = await trySaveBlobWithTauri(blob, suggestedName, filters);
    if (tauriResult) {
      if (tauriResult.cancelled) return null;
      if (ext) setLastFileName(ext, suggestedName);
      return tauriResult;
    }

    // 1) FSA
    if (hasFSA) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          startIn: getStartInHint(),
          types: filters,
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        if (ext) setLastFileName(ext, handle.name || suggestedName);
        return { name: handle.name || suggestedName, method: 'fsa' };
      } catch (e) {
        if (e && (e.name === 'AbortError' || e.code === 20)) return null;   // user cancelled
        console.warn('[jnpIO.saveBlob FSA 실패 → 폴백]', e);
        // fall through to legacy
      }
    }

    // 2) Legacy <a download>
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return { name: suggestedName || 'download', method: 'legacy' };
  }

  async function saveText(text, suggestedName, mime, filters) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    return saveBlob(blob, suggestedName, filters);
  }

  async function saveDataUrl(dataUrl, suggestedName, filters) {
    const comma = dataUrl.indexOf(',');
    if (comma < 0) throw new Error('Invalid data URL');
    const header = dataUrl.slice(0, comma);
    const body = dataUrl.slice(comma + 1);
    const mime = (header.match(/data:([^;,]+)/) || [])[1] || 'application/octet-stream';
    let blob;
    if (/;base64/.test(header)) {
      const bin = atob(body);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      blob = new Blob([bytes], { type: mime });
    } else {
      blob = new Blob([decodeURIComponent(body)], { type: mime });
    }
    return saveBlob(blob, suggestedName, filters);
  }

  // ---- LOAD ------------------------------------------------------------
  async function loadFile(filters, multiple) {
    filters = filters || [];

    if (hasOpenFSA) {
      try {
        const opts = { startIn: getStartInHint(), multiple: !!multiple };
        if (filters.length) opts.types = filters;
        const handles = await window.showOpenFilePicker(opts);
        const out = [];
        for (const h of handles) {
          const f = await h.getFile();
          out.push({ blob: f, name: f.name, lastModified: f.lastModified, size: f.size });
        }
        return multiple ? out : (out[0] || null);
      } catch (e) {
        if (e && (e.name === 'AbortError' || e.code === 20)) return null;
        console.warn('[jnpIO.loadFile FSA 실패 → 폴백]', e);
      }
    }

    // Legacy <input type="file">
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      if (multiple) inp.multiple = true;
      // Convert FSA-shape filters → accept attribute
      if (filters.length) {
        const exts = [];
        for (const f of filters) {
          for (const mime of Object.keys(f.accept || {})) {
            for (const e of (f.accept[mime] || [])) {
              exts.push(e.startsWith('.') ? e : '.' + e);
              exts.push(mime);
            }
          }
        }
        if (exts.length) inp.accept = [...new Set(exts)].join(',');
      }
      inp.style.display = 'none';
      inp.addEventListener('change', () => {
        const files = inp.files ? Array.from(inp.files) : [];
        const mapped = files.map(f => ({ blob: f, name: f.name, lastModified: f.lastModified, size: f.size }));
        resolve(multiple ? mapped : (mapped[0] || null));
        inp.remove();
      }, { once: true });
      // If user cancels, 'change' never fires. Tie to window focus return as fallback.
      setTimeout(() => {
        document.body.appendChild(inp);
        inp.click();
      }, 0);
    });
  }

  // ---- 편의 헬퍼 --------------------------------------------------------
  // 이미지 변환기처럼 자주 쓰는 이미지 저장
  function imageFilters(ext) {
    switch ((ext || '').toLowerCase()) {
      case 'jpg': case 'jpeg':
        return [{ description:'JPEG 이미지', accept:{ 'image/jpeg':['.jpg','.jpeg'] } }];
      case 'png':
        return [{ description:'PNG 이미지', accept:{ 'image/png':['.png'] } }];
      case 'webp':
        return [{ description:'WebP 이미지', accept:{ 'image/webp':['.webp'] } }];
      case 'bmp':
        return [{ description:'BMP 이미지', accept:{ 'image/bmp':['.bmp'] } }];
      default:
        return [{ description:'이미지', accept:{ 'image/*':['.png','.jpg','.jpeg','.webp','.gif','.bmp'] } }];
    }
  }

  window.jnpIO = {
    saveBlob, saveText, saveDataUrl, loadFile,
    imageFilters,
    getLastFileName, setLastFileName,
    getStartInHint, setStartInHint,
    supportsFSA: hasFSA,
  };
  console.info('[jnpIO] ready. FSA:', hasFSA);
})();
