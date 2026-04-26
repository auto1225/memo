import { useState, useRef, useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import { downloadHwpx } from '../lib/hwpxExport'
import { downloadMd } from '../lib/markdownIO'
import { exportToPdf } from '../lib/pdfExport'
import { ColorPicker } from './ColorPicker'
import { Icon } from './Icons'
import type { IconName } from './Icons'
import { normalizeFontFamily, useTypographyStore } from '../store/typographyStore'
import { PAPER_STYLES, pageMarginsSummary, useUIStore } from '../store/uiStore'
import { useMemosStore } from '../store/memosStore'
import { exportV2ToJson, importV2FromJsonAsync } from '../lib/v1Import'
import { fileToDataUrl } from '../lib/attachments'
import { saveDataUrlAsBlobRef } from '../lib/blobRefs'
import { fitPageZoom, setPageZoom } from '../lib/pageZoom'
import { PAGE_BREAK_HTML } from '../lib/pageBreak'

interface ToolbarProps {
  editor: Editor | null
  onPrintPreview: () => void
  onAi: () => void
  onRoles: () => void
  onPaper: () => void
  onPostit: () => void
  onPaint: () => void
  onToggleOutline: () => void
  outlineOpen: boolean
  onAbout: () => void
  onVersions: () => void
  onMdPreview: () => void
  onShare: () => void
  onAtt: () => void
  onLock: () => void
  onStats: () => void
  onMindMap: () => void
  onMacros: () => void
  onDiff: () => void
  onSnippets: () => void
  onLinkCheck: () => void
  onFind: () => void
  onTypo: () => void
  onInfo: () => void
  onHeatmap: () => void
  onQuick: () => void
  onTranslate: () => void
  onTemplates: () => void
  onGist: () => void
  onOcr: () => void
  onChat: () => void
  onSearch: () => void
  onSave: () => void
  onOpen: () => void
  onPageSettings: () => void
  onLectureNotes: () => void
  onMeetingNotes: () => void
}

interface MenuItem { label: string; hint?: string; icon?: IconName; divider?: string; onClick?: () => void }
interface MenuGroup { label: string; items: MenuItem[] }

/**
 * Phase 24 — v1 8개 카테고리 메뉴 모든 기능 실제 구현 (stub 제거).
 * editor.commands 직접 호출 / Web API (SpeechRecognition, getDisplayMedia, MediaRecorder)
 * / 본문 HTML 블록 삽입 / 모달 호출 등으로 모두 작동.
 */
export function Toolbar(p: ToolbarProps) {
  const editor = p.editor
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const typo = useTypographyStore()
  const ui = useUIStore()

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpenMenu(null)
    }
    if (openMenu) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [openMenu])

  if (!editor) return null

  /* ============================================================
   * 헬퍼 / 실제 기능 구현
   * ============================================================ */

  const insertHTML = (html: string) => editor.chain().focus().insertContent(html).run()

  const togglePilcrow = () => {
    document.body.classList.toggle('jan-show-pilcrow')
    try { localStorage.setItem('jan-show-pilcrow', document.body.classList.contains('jan-show-pilcrow') ? '1' : '0') } catch {}
  }
  const insertTable = () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  const insertImageURL = () => { const url = window.prompt('이미지 URL:'); if (url) editor.chain().focus().setImage({ src: url }).run() }
  const uploadImage = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'
    inp.onchange = () => {
      const file = inp.files?.[0]; if (!file) return
      const r = new FileReader()
      r.onload = () => editor.chain().focus().setImage({ src: String(r.result) }).run()
      r.readAsDataURL(file)
    }
    inp.click()
  }
  const toggleLink = () => {
    const prev = editor.getAttributes('link').href
    const url = window.prompt('링크 URL:', prev || '')
    if (url === null) return
    if (url === '') editor.chain().focus().unsetLink().run()
    else editor.chain().focus().setLink({ href: url }).run()
  }
  const insertHr = () => editor.chain().focus().setHorizontalRule().run()
  const insertPageBreak = () => insertHTML(PAGE_BREAK_HTML)
  const insertDateTime = () => {
    const d = new Date()
    const s = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    editor.chain().focus().insertContent(s).run()
  }
  const insertYouTube = () => {
    const url = window.prompt('YouTube URL:'); if (!url) return
    const m = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/)
    if (!m) { alert('유효한 YouTube URL 이 아님'); return }
    insertHTML(`<div class="jan-yt"><iframe src="https://www.youtube.com/embed/${m[1]}" width="560" height="315" frameborder="0" allowfullscreen></iframe></div>`)
  }
  const wrapAsPage = () => {
    const html = editor.getHTML()
    editor.commands.setContent(`<div class="jan-page-wrap">${html}</div>`)
  }

  /* === 논문 구성 요소 === */
  const insertAuthorBlock = () => insertHTML(`
<div class="paper-authors" style="text-align:center;margin:1em 0;">
  <p style="font-weight:600;font-size:1.05em;">저자 1<sup>1</sup>, 저자 2<sup>2</sup>, 교신저자 3<sup>1,*</sup></p>
  <p style="font-size:0.9em;color:#555;"><sup>1</sup>소속 1, 도시, 국가 · <sup>2</sup>소속 2, 도시, 국가</p>
  <p style="font-size:0.85em;color:#777;"><sup>*</sup>교신저자: example@email.com</p>
</div><p></p>`)
  const insertAbstract = () => insertHTML(`
<div class="paper-abstract" style="border:1px solid #ddd;background:#fafafa;padding:1em 1.2em;margin:1em 0;border-radius:4px;">
  <strong style="letter-spacing:0.05em;">ABSTRACT</strong>
  <p style="margin:0.4em 0 0;font-size:0.95em;line-height:1.6;">여기에 초록을 작성하세요. 연구 배경 · 방법 · 결과 · 결론을 200단어 내외로 요약합니다.</p>
</div><p></p>`)
  const insertKeywords = () => insertHTML(`
<p class="paper-keywords" style="margin:0.5em 0 1em;font-size:0.95em;"><strong>KEYWORDS</strong>&nbsp;&nbsp;키워드1 · 키워드2 · 키워드3 · 키워드4 · 키워드5</p>`)
  const insertAcknowledgments = () => insertHTML(`
<h2 style="font-size:1.1em;margin-top:1.5em;">Acknowledgments</h2>
<p>본 연구는 [기관명/과제번호] 의 지원으로 수행되었습니다. ...</p>`)
  const insertFootnote = () => {
    const n = (document.querySelectorAll('.paper-footnote').length || 0) + 1
    /* 1) 커서 위치에 sup 삽입 */
    insertHTML(`<sup class="paper-fn-ref">[${n}]</sup>`)
    /* 2) 문서 끝에 footnote 블록 추가 */
    const root = document.querySelector('.ProseMirror') as HTMLElement | null
    if (root) {
      const div = document.createElement('div')
      div.className = 'paper-footnote'
      div.style.cssText = 'font-size:0.85em;color:#444;border-top:1px solid #ccc;padding-top:0.4em;margin-top:1em;'
      div.textContent = `[${n}] 각주 내용 — 더블클릭해서 편집`  
      root.appendChild(div)
      editor.commands.setContent(root.innerHTML)
    }
  }
  const insertCitation = () => {
    const cite = window.prompt('인용 (예: Smith, 2024):', 'Author, 2024')
    if (cite) insertHTML(`<sup class="paper-cite">(${cite})</sup>`)
  }
  const insertReference = () => {
    const ref = window.prompt('참고문헌 항목:', 'Author, A. (2024). Title. Journal, 1(1), 1-10.')
    if (ref) insertHTML(`<div class="paper-ref" style="text-indent:-1.5em;padding-left:1.5em;font-size:0.9em;margin:0.3em 0;">${ref}</div>`)
  }
  const renumberFootnotes = () => {
    const root = document.querySelector('.ProseMirror'); if (!root) return
    const fns = root.querySelectorAll('.paper-fn-ref'); fns.forEach((el, i) => el.textContent = `[${i+1}]`)
    const notes = root.querySelectorAll('.paper-footnote'); notes.forEach((el, i) => { const t = (el.textContent||'').replace(/^\[\d+\]\s*/, ''); el.textContent = `[${i+1}] ${t}` })
    editor.commands.setContent(root.innerHTML)
  }
  const cyclePageColumns = () => {
    const current = ui.pageColumnCount || 1
    ui.setPageColumnCount(current === 1 ? 2 : current === 2 ? 3 : 1)
  }
  const setRunningHeader = () => {
    const header = window.prompt('머리글:', ui.runningHeader)
    if (header === null) return
    const footer = window.prompt('꼬리말:', ui.runningFooter || 'Page {page} / {total}')
    if (footer === null) return
    ui.setRunningHeader(header)
    ui.setRunningFooter(footer)
  }

  /* === 페이지 설정 === */
  const orientationLabel = ui.pageOrientation === 'landscape' ? '가로' : '세로'
  const currentPaperLabel = PAPER_STYLES.find((style) => style.value === ui.paperStyle)?.label.replace(' (기본)', '') || '줄노트'
  const pageColumnLabel = `${ui.pageColumnCount || 1}단`
  const pageMarginLabel = pageMarginsSummary(ui.pageMarginsMm, ui.pageMarginMm)
  const viewLayoutLabel = ui.viewLayout === 'draft' ? '초안 레이아웃' : '인쇄 레이아웃'
  const openPageSettings = () => p.onPageSettings()

  /* === 책갈피 / 텍스트 상자 / 구분선 스타일 === */
  const insertBookmark = () => {
    const id = window.prompt('책갈피 ID (앵커):', 'bm-' + Date.now()); if (!id) return
    insertHTML(`<a id="${id}" class="paper-bookmark" title="책갈피: ${id}">⚓</a>`)
  }
  const insertTextBox = () => insertHTML(`
<div class="text-box" style="border:1px solid #ccc;background:#fafafa;padding:1em;margin:1em 0;border-radius:6px;">
  여기에 텍스트를 입력하세요.
</div>`)
  const insertHrStyle = () => {
    const s = window.prompt('구분선 스타일 (1=실선, 2=점선, 3=이중선, 4=별표):', '1')
    const styles: Record<string, string> = {
      '1': '<hr style="border:0;border-top:1px solid #888;margin:1em 0;" />',
      '2': '<hr style="border:0;border-top:1px dashed #888;margin:1em 0;" />',
      '3': '<hr style="border:0;border-top:3px double #888;margin:1em 0;" />',
      '4': '<p style="text-align:center;color:#888;letter-spacing:0.6em;margin:1em 0;">＊ ＊ ＊</p>',
    }
    if (s && styles[s]) insertHTML(styles[s])
  }

  /* === 특수 문자 === */
  const insertSymbol = () => {
    const popular = '— – … · • ◦ ★ ☆ ◆ ◇ ▲ ▼ → ← ↑ ↓ ⇒ ⇐ ✓ ✗ ✦ ✧ ¶ § © ® ™ ° ± × ÷ ≈ ≠ ≤ ≥ ∞ Σ Π ∫ √ α β γ δ ε ζ η θ λ μ π σ τ φ ψ ω Ω'
    const c = window.prompt('특수 문자 (복사 붙여넣기):\n' + popular, '—')
    if (c) editor.chain().focus().insertContent(c).run()
  }

  /* === 한국어 타이포 인라인 === */
  const setLetterSpacing = () => {
    const v = window.prompt('자간 (em, 예: -0.05 좁게 / 0.1 넓게):', localStorage.getItem('jan-letter-spacing') || '0')
    if (v === null) return
    localStorage.setItem('jan-letter-spacing', v)
    const id = 'jan-letter-spacing-style'
    const s = document.getElementById(id) || (() => { const e = document.createElement('style'); e.id = id; document.head.appendChild(e); return e })()
    s.textContent = `.ProseMirror { letter-spacing: ${v}em; }`
  }
  const setCharScale = () => {
    const v = window.prompt('장평 (% — 기본 100):', localStorage.getItem('jan-char-scale') || '100')
    if (v === null) return
    localStorage.setItem('jan-char-scale', v)
    const id = 'jan-char-scale-style'
    const s = document.getElementById(id) || (() => { const e = document.createElement('style'); e.id = id; document.head.appendChild(e); return e })()
    if (Number(v) === 100) { s.textContent = ''; return }
    const ratio = Number(v)/100
    const compW = (100/ratio).toFixed(2)
    s.textContent = `.ProseMirror p, .ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6, .ProseMirror li, .ProseMirror blockquote { transform: scaleX(${ratio}); transform-origin: left top; width: ${compW}%; }`
  }
  const toggleFirstLineIndent = () => {
    const cur = localStorage.getItem('jan-first-line-indent') === '1'
    const next = !cur
    localStorage.setItem('jan-first-line-indent', next ? '1' : '0')
    const id = 'jan-first-line-style'
    const s = document.getElementById(id) || (() => { const e = document.createElement('style'); e.id = id; document.head.appendChild(e); return e })()
    s.textContent = next ? '.ProseMirror p { text-indent: 1.5em; }' : ''
  }
  const setParagraphSpacing = () => {
    const v = window.prompt('단락 간격 (em, 예: 0.8):', localStorage.getItem('jan-para-space') || '0.6')
    if (v === null) return
    localStorage.setItem('jan-para-space', v)
    const id = 'jan-para-space-style'
    const s = document.getElementById(id) || (() => { const e = document.createElement('style'); e.id = id; document.head.appendChild(e); return e })()
    s.textContent = `.ProseMirror p { margin: ${v}em 0; }`
  }
  const setTextEffect = () => {
    const v = window.prompt('글자 효과 (1=그림자, 2=네온, 3=조각, 0=해제):', '1')
    const effects: Record<string, string> = {
      '0': '',
      '1': 'text-shadow: 1px 1px 2px rgba(0,0,0,0.25);',
      '2': 'text-shadow: 0 0 4px #ff0, 0 0 8px #ff0; color:#600;',
      '3': 'text-shadow: 1px 1px 0 #fff, -1px -1px 0 #999; color:#666;',
    }
    if (v && effects[v] !== undefined) {
      const id = 'jan-text-effect-style'
      const s = document.getElementById(id) || (() => { const e = document.createElement('style'); e.id = id; document.head.appendChild(e); return e })()
      s.textContent = effects[v] ? `.ProseMirror { ${effects[v]} }` : ''
    }
  }
  const insertHighlightBox = () => insertHTML(`
<div class="highlight-box" style="background:#FFF8C4;border-left:4px solid #FAE100;padding:0.8em 1em;margin:1em 0;border-radius:4px;">
  <strong>강조 :</strong> 여기에 강조 내용을 작성하세요.
</div>`)

  /* === 미디어 / Web API === */
  const captureScreen = async () => {
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true })
      const track = stream.getVideoTracks()[0]
      const cap = new (window as any).ImageCapture(track)
      const bitmap = await cap.grabFrame()
      const cv = document.createElement('canvas'); cv.width = bitmap.width; cv.height = bitmap.height
      cv.getContext('2d')!.drawImage(bitmap, 0, 0)
      track.stop()
      const dataUrl = cv.toDataURL('image/png')
      editor.chain().focus().setImage({ src: dataUrl }).run()
    } catch (e: any) { alert('화면 캡쳐 취소 또는 실패: ' + (e.message || e)) }
  }
  const openGallery = () => {
    const root = document.querySelector('.ProseMirror'); if (!root) return
    const imgs = root.querySelectorAll('img')
    if (!imgs.length) { alert('현재 메모에 이미지가 없습니다.'); return }
    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) return
    let html = `<!doctype html><html><head><title>갤러리</title><style>body{margin:0;background:#111;color:#fff;font-family:sans-serif;padding:1em;} .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;} .grid img{width:100%;border-radius:4px;cursor:pointer;}</style></head><body><h2>갤러리 — ${imgs.length}개</h2><div class="grid">`
    imgs.forEach(img => { html += `<a href="${img.src}" target="_blank"><img src="${img.src}" /></a>` })
    html += '</div></body></html>'
    w.document.write(html); w.document.close()
  }
  const startVoiceInput = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('이 브라우저는 음성 인식을 지원하지 않습니다.'); return }
    const r = new SR(); r.lang = 'ko-KR'; r.interimResults = true; r.continuous = false
    let final = ''
    r.onresult = (e: any) => { for (let i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) final += e.results[i][0].transcript } }
    r.onend = () => { if (final) editor.chain().focus().insertContent(final).run(); else alert('인식된 음성 없음') }
    r.onerror = (e: any) => alert('음성 인식 오류: ' + e.error)
    r.start()
    alert('말하세요... (한 문장 인식 후 자동 종료)')
  }
  const speakSelection = () => {
    const sel = window.getSelection()?.toString() || editor.state.doc.textContent.slice(0, 1000)
    if (!sel) return
    const u = new SpeechSynthesisUtterance(sel); u.lang = 'ko-KR'; u.rate = 1.0
    speechSynthesis.cancel(); speechSynthesis.speak(u)
  }
  const recordAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream); const chunks: Blob[] = []
      rec.ondataavailable = (e) => chunks.push(e.data)
      rec.onstop = async () => {
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
        const ref = await saveDataUrlAsBlobRef(await fileToDataUrl(blob))
        editor.chain().focus().insertContent(`<audio controls src="${ref}" style="width:100%;margin:0.5em 0;"></audio><p></p>`).run()
        stream.getTracks().forEach(t => t.stop())
      }
      rec.start()
      const stop = () => { try { rec.stop() } catch {} }
      /* Auto-stop after 30 sec or user click */
      setTimeout(stop, 30000)
      const overlay = document.createElement('div')
      overlay.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#FAE100;color:#333;padding:16px 24px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.2);z-index:99999;font-weight:600;cursor:pointer;'
      overlay.textContent = '녹음 중... 클릭하면 정지'
      overlay.onclick = () => { stop(); overlay.remove() }
      document.body.appendChild(overlay)
      rec.onstart = () => {}
      rec.addEventListener('stop', () => overlay.remove())
    } catch (e: any) { alert('마이크 접근 실패: ' + (e.message || e)) }
  }
  const meetingNote = () => {
    insertHTML(`
<div class="meeting-note" style="border:1px solid #ddd;padding:1em;margin:1em 0;border-radius:6px;background:#fcfcfc;">
  <h3 style="margin:0 0 0.5em;">회의 노트 — ${new Date().toLocaleString('ko-KR')}</h3>
  <p><strong>참석자:</strong> </p>
  <p><strong>안건:</strong> </p>
  <p><strong>결정사항:</strong> </p>
  <p><strong>액션 아이템:</strong> </p>
</div>`)
  }
  const aiImageStub = () => {
    const prompt = window.prompt('AI 이미지 프롬프트:', '오브젝트의 단순한 라인아트')
    if (!prompt) return
    const u = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true`
    editor.chain().focus().setImage({ src: u, title: prompt } as any).run()
  }

  /* === 도구 === */
  const wordCloud = () => {
    const text = editor.state.doc.textContent
    const words: Record<string, number> = {}
    text.split(/[\s,.\-—()\[\]{}!?;:'"]+/).forEach(w => {
      w = w.trim(); if (w.length < 2) return
      words[w] = (words[w] || 0) + 1
    })
    const sorted = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 60)
    if (!sorted.length) { alert('단어가 없습니다.'); return }
    const max = sorted[0][1]
    const w = window.open('', '_blank', 'width=900,height=600'); if (!w) return
    let html = `<!doctype html><html><head><title>워드 클라우드</title><style>body{font-family:sans-serif;padding:2em;line-height:2;text-align:center;background:#fff8e7;} span{display:inline-block;margin:0.2em 0.4em;color:hsl(${Math.random()*360},60%,40%);}</style></head><body><h2>워드 클라우드 — ${sorted.length}개</h2><div>`
    sorted.forEach(([word, n]) => { const sz = Math.round(12 + (n / max) * 36); html += `<span style="font-size:${sz}px;">${word}</span> ` })
    html += '</div></body></html>'; w.document.write(html); w.document.close()
  }
  const flashcards = () => {
    const root = document.querySelector('.ProseMirror'); if (!root) return
    const headings = root.querySelectorAll('h1, h2, h3'); const cards: { q: string, a: string }[] = []
    headings.forEach(h => {
      let next = h.nextElementSibling; let body = ''
      while (next && !/^H[1-3]$/.test(next.tagName)) { body += next.textContent + ' '; next = next.nextElementSibling }
      cards.push({ q: h.textContent || '', a: body.trim() })
    })
    if (!cards.length) { alert('제목 (H1/H2/H3) 이 없어 플래시카드를 만들 수 없습니다.'); return }
    const w = window.open('', '_blank', 'width=600,height=500'); if (!w) return
    w.document.write(`<!doctype html><html><head><title>플래시카드</title><style>body{font-family:sans-serif;padding:2em;background:#FFFBE5;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:90vh;} .card{background:#fff;border:1px solid #ccc;border-radius:12px;padding:2em;width:80%;max-width:480px;box-shadow:0 4px 16px rgba(0,0,0,0.1);text-align:center;cursor:pointer;min-height:200px;display:flex;align-items:center;justify-content:center;} button{padding:0.6em 1.4em;margin:0.5em;background:#FAE100;border:0;border-radius:6px;font-weight:600;cursor:pointer;}</style></head><body><div class="card" id="c"></div><div><button id="prev">←</button> <span id="i">1</span>/${cards.length} <button id="next">→</button> <button id="flip">뒤집기</button></div><script>const cards=${JSON.stringify(cards)};let idx=0;let face=0;function show(){const c=cards[idx];document.getElementById('c').innerHTML=face?c.a:c.q;document.getElementById('i').textContent=idx+1;}show();document.getElementById('prev').onclick=()=>{idx=(idx-1+cards.length)%cards.length;face=0;show()};document.getElementById('next').onclick=()=>{idx=(idx+1)%cards.length;face=0;show()};document.getElementById('flip').onclick=()=>{face=1-face;show()};document.getElementById('c').onclick=()=>{face=1-face;show()};</script></body></html>`)
    w.document.close()
  }
  const startPomodoro = () => {
    const min = Number(window.prompt('포모도로 시간 (분):', '25')); if (!min) return
    const end = Date.now() + min * 60000
    let id = setInterval(() => {
      const left = Math.max(0, end - Date.now())
      const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000)
      const el = document.getElementById('jan-pomo-display') || (() => { const d = document.createElement('div'); d.id = 'jan-pomo-display'; d.style.cssText = 'position:fixed;top:8px;right:8px;background:#FAE100;color:#333;padding:6px 12px;border-radius:6px;font-weight:700;z-index:9999;'; document.body.appendChild(d); return d })()
      el.textContent = `포모도로 ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      el.onclick = () => { clearInterval(id); el.remove() }
      if (left <= 0) { clearInterval(id); el.remove(); alert('포모도로 완료! 5분 휴식하세요.'); try { new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEA').play() } catch {} }
    }, 500)
  }
  const toggleSpellCheck = () => {
    const cur = useUIStore.getState().spellCheck
    useUIStore.setState({ spellCheck: !cur })
    document.querySelectorAll('.ProseMirror').forEach(el => el.setAttribute('spellcheck', !cur ? 'true' : 'false'))
    alert(`맞춤법 검사 ${!cur ? '켬' : '끔'}`)
  }

  /* === 파일 / 백업 === */
  const exportHwpx = async () => { try { await downloadHwpx(editor.getHTML(), '메모') } catch (e: any) { alert('HWPX 실패: ' + (e.message || e)) } }
  const exportMd = () => { try { downloadMd(editor.getHTML(), '메모') } catch (e: any) { alert('MD 실패: ' + (e.message || e)) } }
  const exportPdf = async () => { try { await exportToPdf(editor.getHTML(), '메모') } catch (e: any) { alert('PDF 실패: ' + (e.message || e)) } }
  const exportHtml = () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>메모</title></head><body>${editor.getHTML()}</body></html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = '메모.html'
    document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 800)
  }
  const exportDocx = () => {
    /* HTML 을 Word 가 인식하는 .doc (HTML application) 로 저장 — 가장 단순한 docx 호환 */
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>메모</title></head><body>${editor.getHTML()}</body></html>`
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = '메모.doc'
    document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 800)
  }
  const exportJsonBackup = async () => {
    const json = await exportV2ToJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `JustANotepad-backup-${Date.now()}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 800)
  }
  const importJsonBackup = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json'
    inp.onchange = () => {
      const file = inp.files?.[0]; if (!file) return
      const r = new FileReader()
      r.onload = async () => {
        try {
          const result = await importV2FromJsonAsync(String(r.result))
          if (result.errors.length) {
            alert(`가져오기 오류 ${result.errors.length}개: ${result.errors[0]}`)
            return
          }
          alert(`백업 가져오기 완료: ${result.imported}개 항목 반영`)
        } catch (e: any) { alert('가져오기 실패: ' + (e.message || e)) }
      }
      r.readAsText(file)
    }
    inp.click()
  }
  const importV1 = async () => {
    if (!confirm('v1 의 localStorage 메모를 v2 로 가져옵니다. 진행하시겠습니까?')) return
    try {
      /* v1 은 같은 origin 의 localStorage 에 'jan_memos' 같은 키로 저장 */
      const candidates = ['jan-memos', 'jan_memos', 'memos', 'sticky_memos']
      let imported = 0
      for (const k of candidates) {
        const raw = localStorage.getItem(k); if (!raw) continue
        try {
          const data = JSON.parse(raw)
          const list = Array.isArray(data) ? data : (data.memos || data.list || [])
          const store = useMemosStore.getState() as any
          list.forEach((m: any) => {
            if (store.newMemo && store.updateCurrent) {
              store.newMemo()
              store.updateCurrent({ title: m.title || m.t || '가져온 메모', content: m.content || m.html || m.body || '<p></p>' })
              imported++
            }
          })
        } catch {}
      }
      alert(imported ? `${imported}개 가져오기 완료` : 'v1 메모를 찾지 못했습니다.')
    } catch (e: any) { alert('실패: ' + (e.message || e)) }
  }
  const openTrash = () => {
    const all = useMemosStore.getState().list()
    const trashed = all.filter((m: any) => m.deleted || m.trashed)
    if (!trashed.length) { alert('휴지통이 비어있습니다.'); return }
    const w = window.open('', '_blank', 'width=600,height=500'); if (!w) return
    let html = `<!doctype html><html><head><title>휴지통</title><style>body{font-family:sans-serif;padding:1em;}li{padding:0.5em;border-bottom:1px solid #eee;}</style></head><body><h2>휴지통 (${trashed.length})</h2><ul>`
    trashed.forEach((m: any) => { html += `<li>${m.title || '제목없음'}</li>` })
    html += '</ul></body></html>'; w.document.write(html); w.document.close()
  }

  /* === 명령 팔레트 / 검색 등 === */
  const cmdPalette = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true, bubbles: true }))

  function close() { setOpenMenu(null) }
  function run(fn: () => void) { fn(); close() }

  /* ============================================================
   * 8 카테고리 메뉴
   * ============================================================ */
  const groups: MenuGroup[] = [
    /* 1. 논문 */
    {
      label: '논문', items: [
        { label: '논문 시작 (Science 포맷 샘플)', hint: '3페이지', icon: 'file-text', onClick: () => run(p.onPaper) },
        { label: '논문 포맷으로 자동 변환', icon: 'wand', onClick: () => run(p.onPaper) },
        { label: '변환 되돌리기', hint: 'Ctrl+Z', icon: 'undo', onClick: () => run(() => editor.chain().focus().undo().run()) },
        { divider: '논문 구성 요소', label: '' },
        { label: '저자 · 소속 · 교신 블록', icon: 'user', onClick: () => run(insertAuthorBlock) },
        { label: 'Abstract 박스', icon: 'file-text', onClick: () => run(insertAbstract) },
        { label: 'Keywords 블록', icon: 'hash', onClick: () => run(insertKeywords) },
        { label: 'TOC (목차) 자동 생성', icon: 'list-bullet', onClick: () => run(p.onToggleOutline) },
        { label: 'Acknowledgments (감사의 말)', icon: 'heart', onClick: () => run(insertAcknowledgments) },
        { divider: '레이아웃', label: '' },
        { label: `다단 레이아웃: ${pageColumnLabel}`, icon: 'columns', onClick: () => run(cyclePageColumns) },
        { label: '페이지 구분 삽입', hint: 'Ctrl+Enter', icon: 'page-break', onClick: () => run(insertPageBreak) },
        { label: '페이지로 감싸기', icon: 'page', onClick: () => run(wrapAsPage) },
        { label: '러닝 헤더 · 꼬리말 설정', icon: 'pin', onClick: () => run(setRunningHeader) },
        { divider: '참조 & 인용', label: '' },
        { label: '각주 삽입', icon: 'sup', onClick: () => run(insertFootnote) },
        { label: '인용 삽입', icon: 'quote', onClick: () => run(insertCitation) },
        { label: '참고문헌 항목 추가', icon: 'file-text', onClick: () => run(insertReference) },
        { label: '번호 재정렬', icon: 'hash', onClick: () => run(renumberFootnotes) },
        { divider: '논문 도구', label: '' },
        { label: '템플릿 (학술 논문)', icon: 'file-text', onClick: () => run(p.onTemplates) },
        { label: '내 도구 / 역할 팩', icon: 'briefcase', onClick: () => run(p.onRoles) },
      ],
    },

    /* 2. 서식 */
    {
      label: '서식', items: [
        { label: '굵게', hint: 'Ctrl+B', icon: 'bold', onClick: () => run(() => editor.chain().focus().toggleBold().run()) },
        { label: '기울임', hint: 'Ctrl+I', icon: 'italic', onClick: () => run(() => editor.chain().focus().toggleItalic().run()) },
        { label: '밑줄', hint: 'Ctrl+U', icon: 'underline', onClick: () => run(() => editor.chain().focus().toggleUnderline().run()) },
        { label: '취소선', icon: 'strike', onClick: () => run(() => editor.chain().focus().toggleStrike().run()) },
        { label: '형광펜', icon: 'highlight', onClick: () => run(() => (editor.chain() as any).focus().toggleHighlight({ color: '#FFEB3B' }).run()) },
        { divider: '제목', label: '' },
        { label: '제목 1', hint: 'Ctrl+Alt+1', icon: 'h1', onClick: () => run(() => editor.chain().focus().toggleHeading({ level: 1 }).run()) },
        { label: '제목 2', hint: 'Ctrl+Alt+2', icon: 'h2', onClick: () => run(() => editor.chain().focus().toggleHeading({ level: 2 }).run()) },
        { label: '제목 3', hint: 'Ctrl+Alt+3', icon: 'h3', onClick: () => run(() => editor.chain().focus().toggleHeading({ level: 3 }).run()) },
        { label: '일반 문단', icon: 'paragraph', onClick: () => run(() => editor.chain().focus().setParagraph().run()) },
        { divider: '정렬', label: '' },
        { label: '왼쪽 정렬', hint: 'Ctrl+L', icon: 'align-left', onClick: () => run(() => editor.chain().focus().setTextAlign('left').run()) },
        { label: '가운데 정렬', hint: 'Ctrl+E', icon: 'align-center', onClick: () => run(() => editor.chain().focus().setTextAlign('center').run()) },
        { label: '오른쪽 정렬', hint: 'Ctrl+R', icon: 'align-right', onClick: () => run(() => editor.chain().focus().setTextAlign('right').run()) },
        { label: '양쪽 정렬', hint: 'Ctrl+J', icon: 'align-justify', onClick: () => run(() => editor.chain().focus().setTextAlign('justify').run()) },
        { divider: '한국어 타이포', label: '' },
        { label: '자간 설정', icon: 'palette', onClick: () => run(setLetterSpacing) },
        { label: '장평 설정', icon: 'palette', onClick: () => run(setCharScale) },
        { label: '첫 줄 들여쓰기 토글', icon: 'paragraph', onClick: () => run(toggleFirstLineIndent) },
        { label: '단락 간격', icon: 'paragraph', onClick: () => run(setParagraphSpacing) },
        { label: '글자 효과', icon: 'sparkle', onClick: () => run(setTextEffect) },
        { label: '강조 배경 상자', icon: 'highlight', onClick: () => run(insertHighlightBox) },
        { divider: '기타', label: '' },
        { label: '문서 스타일', icon: 'palette', onClick: () => run(p.onTypo) },
        { label: '서식 지우기', icon: 'wand', onClick: () => run(() => editor.chain().focus().unsetAllMarks().clearNodes().run()) },
        { label: '엔터 표시(¶) 켬/끔', icon: 'paragraph', onClick: () => run(togglePilcrow) },
      ],
    },

    /* 3. 삽입 */
    {
      label: '삽입', items: [
        { label: '표 (3×3)', icon: 'table', onClick: () => run(insertTable) },
        { label: '이미지 URL', icon: 'image', onClick: () => run(insertImageURL) },
        { label: '이미지 업로드', icon: 'image', onClick: () => run(uploadImage) },
        { label: '링크', hint: 'Ctrl+K', icon: 'link', onClick: () => run(toggleLink) },
        { label: '구분선', icon: 'minus', onClick: () => run(insertHr) },
        { divider: '리스트', label: '' },
        { label: '글머리 기호', icon: 'list-bullet', onClick: () => run(() => editor.chain().focus().toggleBulletList().run()) },
        { label: '번호 매기기', icon: 'list-numbered', onClick: () => run(() => editor.chain().focus().toggleOrderedList().run()) },
        { label: '체크리스트', icon: 'list-check', onClick: () => run(() => (editor.chain() as any).focus().toggleList('taskList', 'taskItem').run()) },
        { label: '인용', icon: 'quote', onClick: () => run(() => editor.chain().focus().toggleBlockquote().run()) },
        { label: '코드 블록', icon: 'code', onClick: () => run(() => editor.chain().focus().toggleCodeBlock().run()) },
        { divider: '논문 요소', label: '' },
        { label: '목차 (TOC) 자동 생성', icon: 'list-bullet', onClick: () => run(p.onToggleOutline) },
        { label: '각주 삽입', icon: 'sup', onClick: () => run(insertFootnote) },
        { label: '인용 번호 삽입', icon: 'quote', onClick: () => run(insertCitation) },
        { label: '책갈피 삽입', icon: 'pin', onClick: () => run(insertBookmark) },
        { label: '텍스트 상자', icon: 'box', onClick: () => run(insertTextBox) },
        { label: '구분선 스타일', icon: 'minus', onClick: () => run(insertHrStyle) },
        { divider: '특수 노드', label: '' },
        { label: '수식 (LaTeX)', icon: 'hash', onClick: () => run(() => { const t = window.prompt('LaTeX:'); if (t) (editor.chain() as any).focus().setMath(t).run() }) },
        { label: '다이어그램 (Mermaid)', icon: 'hash', onClick: () => run(() => { const c = window.prompt('Mermaid:', 'graph TD\n  A-->B'); if (c) (editor.chain() as any).focus().setMermaid(c).run() }) },
        { label: '콜아웃 (정보)', icon: 'info', onClick: () => run(() => (editor.chain() as any).focus().setCallout('info').run()) },
        { label: '콜아웃 (경고)', icon: 'bell', onClick: () => run(() => (editor.chain() as any).focus().setCallout('warn').run()) },
        { label: '임베드 URL', icon: 'globe', onClick: () => run(() => { const u = window.prompt('URL:'); if (u) (editor.chain() as any).focus().setEmbed(u).run() }) },
        { divider: '빠른 입력', label: '' },
        { label: '날짜/시간', icon: 'clock', onClick: () => run(insertDateTime) },
        { label: '특수 문자', icon: 'sparkle', onClick: () => run(insertSymbol) },
        { label: '빠른 메모', hint: 'Ctrl+Shift+J', icon: 'plus', onClick: () => run(p.onQuick) },
      ],
    },

    /* 4. 페이지 */
    {
      label: '페이지', items: [
        { label: `페이지 크기 설정: ${ui.pageSize} · ${orientationLabel}`, icon: 'page', onClick: () => run(openPageSettings) },
        { label: `노트 배경 스타일: ${currentPaperLabel}`, icon: 'palette', onClick: () => run(openPageSettings) },
        { label: `페이지 여백 설정: ${pageMarginLabel}`, icon: 'sliders', onClick: () => run(openPageSettings) },
        { divider: '페이지 동작', label: '' },
        { label: '페이지 구분 삽입', hint: 'Ctrl+Enter', icon: 'page-break', onClick: () => run(insertPageBreak) },
        { label: `다단 레이아웃: ${pageColumnLabel}`, icon: 'columns', onClick: () => run(cyclePageColumns) },
        { label: '페이지로 감싸기', icon: 'page', onClick: () => run(wrapAsPage) },
        { label: '러닝 헤더 · 꼬리말', icon: 'pin', onClick: () => run(setRunningHeader) },
        { divider: '미리보기 / 인쇄', label: '' },
        { label: '엔터 표시(¶) 켬/끔', icon: 'paragraph', onClick: () => run(togglePilcrow) },
        { label: '인쇄 미리보기 (Paged.js)', hint: 'Ctrl+Alt+P', icon: 'preview', onClick: () => run(p.onPrintPreview) },
        { label: '인쇄', hint: 'Ctrl+P', icon: 'print', onClick: () => run(() => window.print()) },
      ],
    },

    /* 5. 미디어 */
    {
      label: '미디어', items: [
        { label: '이미지 업로드', icon: 'image', onClick: () => run(uploadImage) },
        { label: '이미지 URL', icon: 'image', onClick: () => run(insertImageURL) },
        { label: 'YouTube 임베드', icon: 'globe', onClick: () => run(insertYouTube) },
        { label: '화면 캡쳐', icon: 'preview', onClick: () => run(captureScreen) },
        { label: '갤러리 뷰', icon: 'image', onClick: () => run(openGallery) },
        { divider: '오디오', label: '' },
        { label: '음성 입력 (받아쓰기)', icon: 'mic', onClick: () => run(startVoiceInput) },
        { label: '읽어주기 (TTS)', icon: 'speaker', onClick: () => run(speakSelection) },
        { label: '음성 녹음', icon: 'mic', onClick: () => run(recordAudio) },
        { label: '회의 노트 (녹음+받아쓰기)', icon: 'users', onClick: () => run(p.onMeetingNotes) },
        { label: '강의 노트 (녹음+받아쓰기)', icon: 'mic', onClick: () => run(p.onLectureNotes) },
        { label: '회의록 템플릿 삽입', icon: 'file-plus', onClick: () => run(meetingNote) },
        { divider: '파일 / 첨부', label: '' },
        { label: '파일 첨부', icon: 'paperclip', onClick: () => run(p.onAtt) },
        { divider: '드로잉', label: '' },
        { label: '손글씨 / 스케치', icon: 'paint', onClick: () => run(p.onPaint) },
        { label: '그림판 (Paint)', icon: 'paint', onClick: () => run(p.onPaint) },
        { label: '포스트잇 (JustPin)', icon: 'pin', onClick: () => run(p.onPostit) },
        { divider: 'AI', label: '' },
        { label: 'AI 이미지 생성 (Pollinations)', icon: 'sparkle', onClick: () => run(aiImageStub) },
      ],
    },

    /* 6. 도구 */
    {
      label: '도구', items: [
        { label: '명령 팔레트', hint: 'Ctrl+Shift+P', icon: 'sparkle', onClick: () => run(cmdPalette) },
        { label: 'AI 도우미', hint: 'Ctrl+/', icon: 'ai', onClick: () => run(p.onAi) },
        { label: 'AI 챗 패널', icon: 'ai', onClick: () => run(p.onChat) },
        { divider: '검색 / 편집', label: '' },
        { label: '검색', hint: 'Ctrl+Shift+F', icon: 'find', onClick: () => run(p.onSearch) },
        { label: '찾아 바꾸기', hint: 'Ctrl+H', icon: 'replace', onClick: () => run(p.onFind) },
        { label: '깨진 링크 검사', icon: 'unlink', onClick: () => run(p.onLinkCheck) },
        { divider: '분석', label: '' },
        { label: '통계 / 대시보드', icon: 'hash', onClick: () => run(p.onStats) },
        { label: '활동 히트맵', icon: 'hash', onClick: () => run(p.onHeatmap) },
        { label: '메모 정보', icon: 'info', onClick: () => run(p.onInfo) },
        { label: '메모 비교 (diff)', icon: 'replace', onClick: () => run(p.onDiff) },
        { label: '워드 클라우드', icon: 'sparkle', onClick: () => run(wordCloud) },
        { divider: '언어', label: '' },
        { label: '번역', icon: 'translate', onClick: () => run(p.onTranslate) },
        { label: '맞춤법 검사 켬/끔', icon: 'check', onClick: () => run(toggleSpellCheck) },
        { divider: '학습 / 시각화', label: '' },
        { label: '마인드맵', icon: 'sparkle', onClick: () => run(p.onMindMap) },
        { label: '플래시카드 학습', icon: 'list-bullet', onClick: () => run(flashcards) },
        { divider: 'OCR / 자동화', label: '' },
        { label: 'OCR (이미지 → 텍스트)', icon: 'image', onClick: () => run(p.onOcr) },
        { label: '템플릿', icon: 'file-text', onClick: () => run(p.onTemplates) },
        { label: '스니펫', icon: 'file-plus', onClick: () => run(p.onSnippets) },
        { label: '매크로', icon: 'wand', onClick: () => run(p.onMacros) },
        { label: '포모도로 타이머', icon: 'clock', onClick: () => run(startPomodoro) },
      ],
    },

    /* 7. 보기 */
    {
      label: '보기', items: [
        { label: `문서 보기: ${viewLayoutLabel}`, icon: 'preview', onClick: () => run(() => ui.setViewLayout(ui.viewLayout === 'draft' ? 'print' : 'draft')) },
        { label: '인쇄 레이아웃', icon: 'page', onClick: () => run(() => ui.setViewLayout('print')) },
        { label: '초안 레이아웃', icon: 'file-text', onClick: () => run(() => ui.setViewLayout('draft')) },
        { divider: '창', label: '' },
        { label: '집중 모드', hint: 'F11', icon: 'focus', onClick: () => run(() => ui.toggleFocus()) },
        { label: '읽기 모드', hint: 'Shift+F11', icon: 'preview', onClick: () => run(() => ui.toggleReading()) },
        { label: '사이드바 토글', icon: 'list-bullet', onClick: () => run(() => ui.toggleSidebar()) },
        { label: `눈금자 ${ui.showRulers ? '숨기기' : '표시'}`, icon: 'columns', onClick: () => run(() => ui.toggleRulers()) },
        { divider: '줌', label: '' },
        { label: '줌 인', hint: 'Ctrl+=', icon: 'plus', onClick: () => run(() => ui.zoomIn()) },
        { label: '줌 아웃', hint: 'Ctrl+-', icon: 'minus', onClick: () => run(() => ui.zoomOut()) },
        { label: '줌 리셋 (100%)', hint: 'Ctrl+0', icon: 'undo', onClick: () => run(() => ui.zoomReset()) },
        { label: '페이지 너비에 맞춤', icon: 'maximize', onClick: () => run(() => fitPageZoom('width')) },
        { label: '한 페이지 보기', icon: 'page', onClick: () => run(() => fitPageZoom('page')) },
        { label: '75%', icon: 'zoom-out', onClick: () => run(() => setPageZoom(0.75)) },
        { label: '125%', icon: 'zoom-in', onClick: () => run(() => setPageZoom(1.25)) },
        { divider: '아웃라인 / 미리보기', label: '' },
        { label: `목차 ${p.outlineOpen ? '닫기' : '열기'}`, icon: 'list-bullet', onClick: () => run(p.onToggleOutline) },
        { label: 'Markdown 미리보기', icon: 'preview', onClick: () => run(p.onMdPreview) },
        { label: '인쇄 미리보기', hint: 'Ctrl+Alt+P', icon: 'preview', onClick: () => run(p.onPrintPreview) },
        { divider: '표시', label: '' },
        { label: '엔터 표시(¶) 켬/끔', icon: 'paragraph', onClick: () => run(togglePilcrow) },
        { label: '제목 번호 매기기 토글', icon: 'hash', onClick: () => run(() => ui.toggleHeadingNumbers && ui.toggleHeadingNumbers()) },
      ],
    },

    /* 8. 파일 */
    {
      label: '파일', items: [
        { label: '새 메모', hint: 'Ctrl+N', icon: 'plus', onClick: () => run(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, bubbles: true }))) },
        { label: '열기...', hint: 'Ctrl+O', icon: 'open', onClick: () => run(p.onOpen) },
        { label: '저장', hint: 'Ctrl+S', icon: 'save', onClick: () => run(p.onSave) },
        { label: '다른 이름으로 저장', icon: 'save', onClick: () => run(p.onSave) },
        { divider: '내보내기', label: '' },
        { label: '인쇄', hint: 'Ctrl+P', icon: 'print', onClick: () => run(() => window.print()) },
        { label: 'PDF 내보내기', icon: 'file-text', onClick: () => run(exportPdf) },
        { label: 'HTML 내보내기', icon: 'globe', onClick: () => run(exportHtml) },
        { label: 'Markdown(.md) 저장', icon: 'file-text', onClick: () => run(exportMd) },
        { label: 'HWPX (한글) 내보내기', icon: 'file-text', onClick: () => run(exportHwpx) },
        { label: 'Word(.doc) 내보내기', icon: 'file-text', onClick: () => run(exportDocx) },
        { divider: '공유 / 백업', label: '' },
        { label: 'GitHub Gist 로 공유', icon: 'cloud', onClick: () => run(p.onGist) },
        { label: '공유 링크', icon: 'link', onClick: () => run(p.onShare) },
        { label: 'JSON 백업 내보내기', icon: 'cloud', onClick: () => run(exportJsonBackup) },
        { label: 'JSON 백업 가져오기', icon: 'cloud', onClick: () => run(importJsonBackup) },
        { label: 'v1 메모 가져오기', icon: 'undo', onClick: () => run(importV1) },
        { divider: '관리', label: '' },
        { label: '버전 기록', icon: 'undo', onClick: () => run(p.onVersions) },
        { label: '잠금 / 비밀번호', icon: 'lock', onClick: () => run(p.onLock) },
        { label: '휴지통', icon: 'box', onClick: () => run(openTrash) },
        { label: '정보 / 버전', icon: 'info', onClick: () => run(p.onAbout) },
      ],
    },
  ]

  function MenuButton({ group }: { group: MenuGroup }) {
    const isOpen = openMenu === group.label
    return (
      <div className="jan-menu-wrap">
        <button
          className={'jan-menu-btn' + (isOpen ? ' is-open' : '')}
          onClick={() => setOpenMenu(isOpen ? null : group.label)}
          aria-expanded={isOpen}
        >
          <span>{group.label}</span>
          <Icon name="chevron-down" size={10} className="jan-menu-arrow" />
        </button>
        {isOpen && (
          <div className="jan-menu-dropdown" onMouseDown={(e) => e.stopPropagation()}>
            {group.items.map((it, i) => {
              if (it.divider) return <div key={i} className="jan-menu-divider">{it.divider}</div>
              return (
                <button key={i} className="jan-menu-item" onClick={it.onClick}>
                  {it.icon && <Icon name={it.icon} size={14} />}
                  <span className="jan-menu-label">{it.label}</span>
                  {it.hint && <span className="jan-menu-hint">{it.hint}</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="jan-toolbar-row" ref={containerRef}>
      <select
        className="jan-toolbar-select"
        value={typo.fontFamily}
        onChange={(e) => typo.setFontFamily(normalizeFontFamily(e.target.value))}
        title="글꼴"
      >
        <option value="sans">기본 폰트</option>
        <option value="serif">명조</option>
        <option value="mono">고정폭</option>
      </select>
      <select
        className="jan-toolbar-select"
        value={typo.fontSize}
        onChange={(e) => typo.setFontSize(Number(e.target.value))}
        title="글자 크기"
        style={{ minWidth: 56 }}
      >
        {[10, 11, 12, 13, 14, 16, 18, 20, 22].map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <span className="divider" />

      <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'is-active' : ''} title="굵게 (Ctrl+B)"><Icon name="bold" /></button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'is-active' : ''} title="기울임 (Ctrl+I)"><Icon name="italic" /></button>
      <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive('underline') ? 'is-active' : ''} title="밑줄 (Ctrl+U)"><Icon name="underline" /></button>
      <button onClick={() => editor.chain().focus().toggleStrike().run()} className={editor.isActive('strike') ? 'is-active' : ''} title="취소선"><Icon name="strike" /></button>
      <button onClick={() => (editor.chain() as any).focus().toggleHighlight({ color: '#FFEB3B' }).run()} className={editor.isActive('highlight') ? 'is-active' : ''} title="형광펜"><Icon name="highlight" /></button>
      <ColorPicker editor={editor} />
      <span className="divider" />

      <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''} title="왼쪽 정렬"><Icon name="align-left" /></button>
      <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''} title="가운데 정렬"><Icon name="align-center" /></button>
      <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''} title="오른쪽 정렬"><Icon name="align-right" /></button>
      <span className="divider" />

      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'is-active' : ''} title="글머리 기호"><Icon name="list-bullet" /></button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'is-active' : ''} title="번호 목록"><Icon name="list-numbered" /></button>
      <button onClick={() => (editor.chain() as any).focus().toggleList('taskList', 'taskItem').run()} title="체크리스트"><Icon name="list-check" /></button>
      <span className="divider" />

      <button onClick={() => editor.chain().focus().undo().run()} title="실행 취소 (Ctrl+Z)"><Icon name="undo" /></button>
      <button onClick={() => editor.chain().focus().redo().run()} title="다시 실행 (Ctrl+Shift+Z)"><Icon name="redo" /></button>

      <span className="jan-spacer" />

      {groups.map((g) => <MenuButton key={g.label} group={g} />)}
    </div>
  )
}
