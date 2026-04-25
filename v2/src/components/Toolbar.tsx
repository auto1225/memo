import { useState, useRef, useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import { downloadHwpx } from '../lib/hwpxExport'
import { downloadMd } from '../lib/markdownIO'
import { exportToPdf } from '../lib/pdfExport'
import { ColorPicker } from './ColorPicker'
import { Icon } from './Icons'
import type { IconName } from './Icons'
import { useTypographyStore, type FontFamily } from '../store/typographyStore'
import { useUIStore } from '../store/uiStore'

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
  onSave: () => void
  onOpen: () => void
}

interface MenuItem { label: string; hint?: string; icon?: IconName; divider?: string; onClick?: () => void }
interface MenuGroup { label: string; items: MenuItem[] }

/**
 * Phase 23 — v1 의 8개 카테고리 메뉴를 v2 에 완전 이식.
 * 항목/라벨/순서는 v1 (paper-features.js, word-features.js, app.html, command-palette.js) 에서 추출.
 * 각 항목은 1) 존재하는 props 핸들러 2) editor 직접 명령 3) "준비 중" stub 으로 와이어됨.
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

  const togglePilcrow = () => {
    document.body.classList.toggle('jan-show-pilcrow')
    try { localStorage.setItem('jan-show-pilcrow', document.body.classList.contains('jan-show-pilcrow') ? '1' : '0') } catch {}
  }
  const insertTable = () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  const insertImage = () => { const url = window.prompt('이미지 URL:'); if (url) editor.chain().focus().setImage({ src: url }).run() }
  const toggleLink = () => {
    const prev = editor.getAttributes('link').href
    const url = window.prompt('링크 URL:', prev || '')
    if (url === null) return
    if (url === '') editor.chain().focus().unsetLink().run()
    else editor.chain().focus().setLink({ href: url }).run()
  }
  const insertHr = () => editor.chain().focus().setHorizontalRule().run()
  const insertPageBreak = () => editor.chain().focus().insertContent('<hr class="jan-page-break" data-page-break="1" /><p></p>').run()
  const insertDateTime = () => {
    const d = new Date()
    const s = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    editor.chain().focus().insertContent(s).run()
  }
  const insertYouTube = () => {
    const url = window.prompt('YouTube URL:')
    if (!url) return
    const m = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/)
    if (!m) { alert('유효한 YouTube URL 이 아님'); return }
    editor.chain().focus().insertContent(
      `<div class="jan-yt"><iframe src="https://www.youtube.com/embed/${m[1]}" width="560" height="315" frameborder="0" allowfullscreen></iframe></div>`
    ).run()
  }
  const wrapAsPage = () => {
    const html = editor.getHTML()
    editor.commands.setContent(`<div class="jan-page-wrap">${html}</div>`)
  }
  const exportHwpx = async () => { try { await downloadHwpx(editor.getHTML(), '메모') } catch (e: any) { alert('HWPX 실패: ' + (e.message || e)) } }
  const exportMd = () => { try { downloadMd(editor.getHTML(), '메모') } catch (e: any) { alert('MD 실패: ' + (e.message || e)) } }
  const exportPdf = async () => { try { await exportToPdf(editor.getHTML(), '메모') } catch (e: any) { alert('PDF 실패: ' + (e.message || e)) } }
  const exportHtml = () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>메모</title></head><body>${editor.getHTML()}</body></html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = '메모.html'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 800)
  }
  const stub = (label: string) => () => alert(label + ' — v1 기능 이식 준비 중')
  const cmdPalette = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
  const fireSearch = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', ctrlKey: true, shiftKey: true, bubbles: true }))

  function close() { setOpenMenu(null) }
  function run(fn: () => void) { fn(); close() }

  /* ============================================================
   * v1 의 8개 카테고리 — paper-features.js / word-features.js / app.html 에서 추출
   * ============================================================ */
  const groups: MenuGroup[] = [
    /* 1. 논문 — paper-features.js v11 의 paperMenuDrop 4개 섹션 */
    {
      label: '논문', items: [
        { label: '논문 시작 (Science 포맷 샘플)', hint: '3페이지', icon: 'file-text', onClick: () => run(p.onPaper) },
        { label: '논문 포맷으로 자동 변환', icon: 'wand', onClick: () => run(p.onPaper) },
        { label: '변환 되돌리기', hint: 'Ctrl+Z', icon: 'undo', onClick: () => run(() => editor.chain().focus().undo().run()) },
        { divider: '논문 구성 요소', label: '' },
        { label: '저자 · 소속 · 교신 블록', icon: 'user', onClick: () => run(stub('저자 블록')) },
        { label: 'Abstract 박스', icon: 'file-text', onClick: () => run(stub('Abstract 박스')) },
        { label: 'Keywords 블록', icon: 'hash', onClick: () => run(stub('Keywords 블록')) },
        { label: 'TOC (목차) 자동 생성', icon: 'list-bullet', onClick: () => run(p.onToggleOutline) },
        { label: 'Acknowledgments (감사의 말)', icon: 'heart', onClick: () => run(stub('Acknowledgments')) },
        { divider: '레이아웃', label: '' },
        { label: '2단 레이아웃 토글', icon: 'columns', onClick: () => run(stub('2단 레이아웃')) },
        { label: '페이지 구분 삽입', hint: 'Ctrl+Enter', icon: 'page-break', onClick: () => run(insertPageBreak) },
        { label: '페이지로 감싸기', icon: 'page', onClick: () => run(wrapAsPage) },
        { label: '러닝 헤더 · 꼬리말 설정', icon: 'pin', onClick: () => run(stub('러닝 헤더/꼬리말')) },
        { divider: '참조 & 인용', label: '' },
        { label: '각주 삽입', icon: 'sup', onClick: () => run(stub('각주')) },
        { label: '인용 삽입', icon: 'quote', onClick: () => run(stub('인용')) },
        { label: '참고문헌 항목 추가', icon: 'file-text', onClick: () => run(stub('참고문헌')) },
        { label: '번호 재정렬', icon: 'hash', onClick: () => run(stub('번호 재정렬')) },
        { divider: '논문 도구', label: '' },
        { label: '템플릿 (학술 논문)', icon: 'file-text', onClick: () => run(p.onTemplates) },
        { label: '역할 팩 (전문 글쓰기)', icon: 'user', onClick: () => run(p.onRoles) },
      ],
    },

    /* 2. 서식 — word-features.js + 기본 마크 */
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
        { label: '자간 설정', icon: 'palette', onClick: () => run(p.onTypo) },
        { label: '장평 설정', icon: 'palette', onClick: () => run(p.onTypo) },
        { label: '첫 줄 들여쓰기', icon: 'paragraph', onClick: () => run(stub('첫 줄 들여쓰기')) },
        { label: '단락 간격', icon: 'paragraph', onClick: () => run(p.onTypo) },
        { label: '글자 효과', icon: 'sparkle', onClick: () => run(stub('글자 효과')) },
        { label: '강조 배경 상자', icon: 'highlight', onClick: () => run(stub('강조 배경 상자')) },
        { divider: '기타', label: '' },
        { label: '서식 지우기', icon: 'wand', onClick: () => run(() => editor.chain().focus().unsetAllMarks().clearNodes().run()) },
        { label: '엔터 표시(¶) 켬/끔', icon: 'paragraph', onClick: () => run(togglePilcrow) },
      ],
    },

    /* 3. 삽입 — 표/이미지/링크/리스트/코드/수식/특수문자 */
    {
      label: '삽입', items: [
        { label: '표 (3×3)', icon: 'table', onClick: () => run(insertTable) },
        { label: '이미지 URL', icon: 'image', onClick: () => run(insertImage) },
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
        { label: '각주 삽입', icon: 'sup', onClick: () => run(stub('각주')) },
        { label: '인용 번호 삽입', icon: 'quote', onClick: () => run(stub('인용 번호')) },
        { label: '책갈피 삽입', icon: 'pin', onClick: () => run(stub('책갈피')) },
        { label: '텍스트 상자', icon: 'box', onClick: () => run(stub('텍스트 상자')) },
        { label: '구분선 스타일', icon: 'minus', onClick: () => run(stub('구분선 스타일')) },
        { divider: '특수 노드', label: '' },
        { label: '수식 (LaTeX)', icon: 'hash', onClick: () => run(() => { const t = window.prompt('LaTeX:'); if (t) (editor.chain() as any).focus().setMath(t).run() }) },
        { label: '다이어그램 (Mermaid)', icon: 'hash', onClick: () => run(() => { const c = window.prompt('Mermaid:', 'graph TD\n  A-->B'); if (c) (editor.chain() as any).focus().setMermaid(c).run() }) },
        { label: '콜아웃 (정보)', icon: 'info', onClick: () => run(() => (editor.chain() as any).focus().setCallout('info').run()) },
        { label: '콜아웃 (경고)', icon: 'bell', onClick: () => run(() => (editor.chain() as any).focus().setCallout('warn').run()) },
        { label: '임베드 URL', icon: 'globe', onClick: () => run(() => { const u = window.prompt('URL:'); if (u) (editor.chain() as any).focus().setEmbed(u).run() }) },
        { divider: '빠른 입력', label: '' },
        { label: '날짜/시간', icon: 'clock', onClick: () => run(insertDateTime) },
        { label: '특수 문자', icon: 'sparkle', onClick: () => run(stub('특수 문자')) },
        { label: '빠른 메모', hint: 'Ctrl+Shift+J', icon: 'plus', onClick: () => run(p.onQuick) },
      ],
    },

    /* 4. 페이지 — paged-preview.js + 페이지 관련 기능 */
    {
      label: '페이지', items: [
        { label: '페이지 크기 설정 (A4/Letter/A5)', icon: 'page', onClick: () => run(stub('페이지 크기')) },
        { label: '페이지 여백 설정 (mm)', icon: 'page', onClick: () => run(stub('페이지 여백')) },
        { divider: '페이지 동작', label: '' },
        { label: '페이지 구분 삽입', hint: 'Ctrl+Enter', icon: 'page-break', onClick: () => run(insertPageBreak) },
        { label: '2단 레이아웃 토글', icon: 'columns', onClick: () => run(stub('2단 레이아웃')) },
        { label: '페이지로 감싸기', icon: 'page', onClick: () => run(wrapAsPage) },
        { label: '러닝 헤더 · 꼬리말', icon: 'pin', onClick: () => run(stub('러닝 헤더/꼬리말')) },
        { divider: '미리보기 / 인쇄', label: '' },
        { label: '엔터 표시(¶) 켬/끔', icon: 'paragraph', onClick: () => run(togglePilcrow) },
        { label: '인쇄 미리보기 (Paged.js)', hint: 'Ctrl+Alt+P', icon: 'preview', onClick: () => run(p.onPrintPreview) },
        { label: '인쇄', hint: 'Ctrl+P', icon: 'print', onClick: () => run(() => window.print()) },
      ],
    },

    /* 5. 미디어 — 이미지/오디오/비디오/그림판/포스트잇 */
    {
      label: '미디어', items: [
        { label: '이미지 업로드', icon: 'image', onClick: () => run(insertImage) },
        { label: 'YouTube 임베드', icon: 'globe', onClick: () => run(insertYouTube) },
        { label: '화면 캡쳐', icon: 'preview', onClick: () => run(stub('화면 캡쳐')) },
        { label: '갤러리 뷰', icon: 'image', onClick: () => run(stub('갤러리 뷰')) },
        { divider: '오디오', label: '' },
        { label: '음성 입력 (받아쓰기)', icon: 'mic', onClick: () => run(stub('음성 입력')) },
        { label: '읽어주기 (TTS)', icon: 'speaker', onClick: () => run(stub('TTS 읽어주기')) },
        { label: '음성 녹음', icon: 'mic', onClick: () => run(stub('음성 녹음')) },
        { label: '회의 노트 (녹음+요약)', icon: 'mic', onClick: () => run(stub('회의 노트')) },
        { divider: '파일 / 첨부', label: '' },
        { label: '파일 첨부', icon: 'paperclip', onClick: () => run(p.onAtt) },
        { divider: '드로잉', label: '' },
        { label: '손글씨 / 스케치', icon: 'paint', onClick: () => run(p.onPaint) },
        { label: '그림판 (Paint)', icon: 'paint', onClick: () => run(p.onPaint) },
        { label: '포스트잇 (JustPin)', icon: 'pin', onClick: () => run(p.onPostit) },
        { divider: 'AI', label: '' },
        { label: 'AI 이미지 생성', icon: 'sparkle', onClick: () => run(stub('AI 이미지 생성')) },
      ],
    },

    /* 6. 도구 — 검색/번역/통계/마인드맵/매크로/스니펫/OCR */
    {
      label: '도구', items: [
        { label: '명령 팔레트', hint: 'Ctrl+K', icon: 'sparkle', onClick: () => run(cmdPalette) },
        { label: 'AI 도우미', hint: 'Ctrl+/', icon: 'ai', onClick: () => run(p.onAi) },
        { divider: '검색 / 편집', label: '' },
        { label: '검색', hint: 'Ctrl+Shift+F', icon: 'find', onClick: () => run(fireSearch) },
        { label: '찾아 바꾸기', hint: 'Ctrl+H', icon: 'replace', onClick: () => run(p.onFind) },
        { label: '깨진 링크 검사', icon: 'unlink', onClick: () => run(p.onLinkCheck) },
        { divider: '분석', label: '' },
        { label: '통계 / 대시보드', icon: 'hash', onClick: () => run(p.onStats) },
        { label: '활동 히트맵', icon: 'hash', onClick: () => run(p.onHeatmap) },
        { label: '메모 정보', icon: 'info', onClick: () => run(p.onInfo) },
        { label: '메모 비교 (diff)', icon: 'replace', onClick: () => run(p.onDiff) },
        { divider: '언어', label: '' },
        { label: '번역', icon: 'translate', onClick: () => run(p.onTranslate) },
        { label: '맞춤법 검사', icon: 'check', onClick: () => run(stub('맞춤법 검사')) },
        { divider: '학습 / 시각화', label: '' },
        { label: '마인드맵', icon: 'sparkle', onClick: () => run(p.onMindMap) },
        { label: '플래시카드 학습', icon: 'list-bullet', onClick: () => run(stub('플래시카드')) },
        { label: '워드 클라우드', icon: 'sparkle', onClick: () => run(stub('워드 클라우드')) },
        { divider: 'OCR / 자동화', label: '' },
        { label: 'OCR (이미지 → 텍스트)', icon: 'image', onClick: () => run(stub('OCR — AppHeader 의 OCR 버튼 사용')) },
        { label: '템플릿', icon: 'file-text', onClick: () => run(p.onTemplates) },
        { label: '스니펫', icon: 'file-plus', onClick: () => run(p.onSnippets) },
        { label: '매크로', icon: 'wand', onClick: () => run(p.onMacros) },
        { label: '포모도로 타이머', icon: 'clock', onClick: () => run(stub('포모도로')) },
      ],
    },

    /* 7. 보기 — 사이드바/줌/테마/아웃라인/MD 미리보기 */
    {
      label: '보기', items: [
        { label: '집중 모드', hint: 'F11', icon: 'focus', onClick: () => run(() => ui.toggleFocus()) },
        { label: '읽기 모드', hint: 'Shift+F11', icon: 'preview', onClick: () => run(() => ui.toggleReading()) },
        { label: '사이드바 토글', icon: 'list-bullet', onClick: () => run(() => ui.toggleSidebar()) },
        { divider: '줌', label: '' },
        { label: '줌 인', hint: 'Ctrl+=', icon: 'plus', onClick: () => run(() => ui.zoomIn()) },
        { label: '줌 아웃', hint: 'Ctrl+-', icon: 'minus', onClick: () => run(() => ui.zoomOut()) },
        { label: '줌 리셋 (100%)', hint: 'Ctrl+0', icon: 'undo', onClick: () => run(() => ui.zoomReset()) },
        { divider: '아웃라인 / 미리보기', label: '' },
        { label: `목차 ${p.outlineOpen ? '닫기' : '열기'}`, icon: 'list-bullet', onClick: () => run(p.onToggleOutline) },
        { label: 'Markdown 미리보기', icon: 'preview', onClick: () => run(p.onMdPreview) },
        { label: '인쇄 미리보기', hint: 'Ctrl+Alt+P', icon: 'preview', onClick: () => run(p.onPrintPreview) },
        { divider: '표시', label: '' },
        { label: '엔터 표시(¶) 켬/끔', icon: 'paragraph', onClick: () => run(togglePilcrow) },
        { label: '제목 번호 매기기 토글', icon: 'hash', onClick: () => run(() => ui.toggleHeadingNumbers && ui.toggleHeadingNumbers()) },
      ],
    },

    /* 8. 파일 — 새/열기/저장/내보내기/공유/잠금/버전/휴지통 */
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
        { label: 'Word(.docx) 내보내기', icon: 'file-text', onClick: () => run(stub('Word 내보내기')) },
        { divider: '공유 / 백업', label: '' },
        { label: 'GitHub Gist 로 공유', icon: 'cloud', onClick: () => run(p.onGist) },
        { label: '공유 링크', icon: 'link', onClick: () => run(p.onShare) },
        { label: 'JSON 백업 / 가져오기', icon: 'cloud', onClick: () => run(stub('JSON 백업/가져오기')) },
        { label: 'v1 메모 가져오기', icon: 'undo', onClick: () => run(stub('v1 메모 가져오기')) },
        { divider: '관리', label: '' },
        { label: '버전 기록', icon: 'undo', onClick: () => run(p.onVersions) },
        { label: '잠금 / 비밀번호', icon: 'lock', onClick: () => run(p.onLock) },
        { label: '휴지통', icon: 'box', onClick: () => run(stub('휴지통')) },
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
      {/* 폰트 select */}
      <select
        className="jan-toolbar-select"
        value={typo.fontFamily}
        onChange={(e) => typo.setFontFamily(e.target.value as FontFamily)}
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

      {/* 서식 */}
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'is-active' : ''} title="굵게 (Ctrl+B)"><Icon name="bold" /></button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'is-active' : ''} title="기울임 (Ctrl+I)"><Icon name="italic" /></button>
      <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive('underline') ? 'is-active' : ''} title="밑줄 (Ctrl+U)"><Icon name="underline" /></button>
      <button onClick={() => editor.chain().focus().toggleStrike().run()} className={editor.isActive('strike') ? 'is-active' : ''} title="취소선"><Icon name="strike" /></button>
      <button onClick={() => (editor.chain() as any).focus().toggleHighlight({ color: '#FFEB3B' }).run()} className={editor.isActive('highlight') ? 'is-active' : ''} title="형광펜"><Icon name="highlight" /></button>
      <ColorPicker editor={editor} />
      <span className="divider" />

      {/* 정렬 */}
      <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''} title="왼쪽 정렬"><Icon name="align-left" /></button>
      <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''} title="가운데 정렬"><Icon name="align-center" /></button>
      <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''} title="오른쪽 정렬"><Icon name="align-right" /></button>
      <span className="divider" />

      {/* 리스트 */}
      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'is-active' : ''} title="글머리 기호"><Icon name="list-bullet" /></button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'is-active' : ''} title="번호 목록"><Icon name="list-numbered" /></button>
      <button onClick={() => (editor.chain() as any).focus().toggleList('taskList', 'taskItem').run()} title="체크리스트"><Icon name="list-check" /></button>
      <span className="divider" />

      {/* Undo/Redo */}
      <button onClick={() => editor.chain().focus().undo().run()} title="실행 취소 (Ctrl+Z)"><Icon name="undo" /></button>
      <button onClick={() => editor.chain().focus().redo().run()} title="다시 실행 (Ctrl+Shift+Z)"><Icon name="redo" /></button>

      <span className="jan-spacer" />

      {/* 우측: 카테고리 ▾ */}
      {groups.map((g) => <MenuButton key={g.label} group={g} />)}
    </div>
  )
}
