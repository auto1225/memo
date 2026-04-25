/**
 * Phase 5 — JustPin 포스트잇 (단순화 버전).
 *
 * v1 의 postit-desktop.js 는 Tauri subprocess 로 Windows top-most 창을 띄움.
 * v2 에서는 우선 브라우저 window.open 으로 작은 sticky-note 창을 열고,
 * Tauri 환경이면 추후 IPC 로 native top-most 창 띄우는 hook 만 남겨둠.
 */
const STORAGE = 'jan-v2-postits'

export interface Postit {
  id: string
  text: string
  color: string
  createdAt: number
}

function load(): Postit[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || '[]')
  } catch {
    return []
  }
}
function save(list: Postit[]) {
  localStorage.setItem(STORAGE, JSON.stringify(list))
}

export function listPostits(): Postit[] {
  return load()
}

export function addPostit(text: string, color = '#FFEB3B'): Postit {
  const p: Postit = { id: 'p' + Date.now(), text, color, createdAt: Date.now() }
  const list = load()
  list.unshift(p)
  save(list)
  return p
}

export function removePostit(id: string) {
  save(load().filter((p) => p.id !== id))
}

/**
 * 작은 sticky-note 창 띄우기. window.open 으로 320x320 popup.
 * 닫혀도 텍스트는 localStorage 에 영속.
 */
export function openPostitWindow(p: Postit) {
  const safe = (p.text || '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c))
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>JustPin</title>
<style>
  html,body{margin:0;padding:0;height:100%;background:${p.color};font-family:"Malgun Gothic",sans-serif;}
  textarea{box-sizing:border-box;width:100%;height:calc(100% - 32px);background:transparent;border:0;outline:none;padding:14px;font-size:14px;line-height:1.5;resize:none;}
  .bar{height:32px;display:flex;align-items:center;justify-content:flex-end;padding:0 8px;background:rgba(0,0,0,0.06);}
  .bar button{background:none;border:0;cursor:pointer;font-size:14px;padding:0 8px;}
</style></head><body>
  <div class="bar"><button onclick="window.close()" title="닫기">×</button></div>
  <textarea id="t" placeholder="짧은 메모...">${safe}</textarea>
  <script>
    const ta = document.getElementById('t');
    const id = '${p.id}';
    ta.addEventListener('input', () => {
      try {
        const list = JSON.parse(localStorage.getItem('${STORAGE}') || '[]');
        const i = list.findIndex(x => x.id === id);
        if (i >= 0) { list[i].text = ta.value; localStorage.setItem('${STORAGE}', JSON.stringify(list)); }
      } catch(e) {}
    });
  <\/script>
</body></html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, 'justpin_' + p.id, 'width=320,height=320,resizable=yes')
  if (!win) {
    URL.revokeObjectURL(url)
    alert('팝업 차단을 해제하세요')
  }
}
