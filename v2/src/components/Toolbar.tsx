import type { Editor } from '@tiptap/react'
import { downloadHwpx } from '../lib/hwpxExport'
import { downloadMd } from '../lib/markdownIO'
import { exportToPdf } from '../lib/pdfExport'
import { VoiceButton } from './VoiceButton'
import { TTSButton } from './TTSButton'
import { useThemeStore } from '../store/themeStore'

interface ToolbarProps {
  editor: Editor | null
  title: string
  onTitleChange: (title: string) => void
  onSave: () => void
  onOpen: () => void
  onPrintPreview: () => void
  onAi: () => void
  onRoles: () => void
  onPaper: () => void
  onPostit: () => void
  onSearch: () => void
  onPaint: () => void
  onHelp: () => void
  onToggleOutline: () => void
  outlineOpen: boolean
  onAbout: () => void
  onVersions: () => void
  onMdPreview: () => void
  onShare: () => void
}

export function Toolbar({
  editor, title, onTitleChange, onSave, onOpen,
  onPrintPreview, onAi, onRoles, onPaper, onPostit,
  onSearch, onPaint, onHelp, onToggleOutline, outlineOpen, onAbout, onVersions, onMdPreview, onShare,
}: ToolbarProps) {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  if (!editor) return null

  const togglePilcrow = () => {
    document.body.classList.toggle('jan-show-pilcrow')
    try {
      const on = document.body.classList.contains('jan-show-pilcrow')
      localStorage.setItem('jan-show-pilcrow', on ? '1' : '0')
    } catch {}
  }

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  const insertImage = () => {
    const url = window.prompt('이미지 URL:')
    if (url) editor.chain().focus().setImage({ src: url }).run()
  }

  const toggleLink = () => {
    const prev = editor.getAttributes('link').href
    const url = window.prompt('링크 URL:', prev || '')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().unsetLink().run()
    } else {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }

  const exportHwpx = async () => {
    const html = editor.getHTML()
    try {
      await downloadHwpx(html, title || '메모')
    } catch (e: any) {
      alert('HWPX 내보내기 실패: ' + (e.message || e))
    }
  }

  const exportPdf = async () => {
    if (!editor) return
    try { await exportToPdf(editor.getHTML(), title || '메모') }
    catch (e: any) { alert('PDF export 실패: ' + (e.message || e)) }
  }

  const exportMd = () => {
    try {
      downloadMd(editor.getHTML(), title || '메모')
    } catch (e: any) {
      alert('Markdown 내보내기 실패: ' + (e.message || e))
    }
  }

  const cycleTheme = () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'auto' : 'light'
    setTheme(next)
  }

  return (
    <>
      <div className="jan-titlebar">
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="제목"
          className="jan-title-input"
        />
        <button onClick={onSave} title="Ctrl+S 저장">저장</button>
        <button onClick={onOpen} title="Ctrl+O 열기">열기</button>
        <button onClick={onPrintPreview} title="Ctrl+Alt+P 인쇄 미리보기 (Paged.js)">미리보기</button>
        <button onClick={() => window.print()} title="Ctrl+P 인쇄">인쇄</button>
        <button onClick={exportHwpx} title="HWPX (한글) 내보내기">HWPX</button>
        <button onClick={exportMd} title="Markdown 내보내기">MD</button>
        <button onClick={exportPdf} title="PDF 내보내기">PDF</button>
        <button onClick={onMdPreview} title="Markdown 미리보기">MD↔</button>
        <button onClick={onShare} title="공유 링크">공유</button>
        <span className="divider" />
        <button onClick={onSearch} title="Ctrl+Shift+F 전체 검색">검색</button>
        <button onClick={onAi} title="Ctrl+/ AI 도우미">AI</button>
        <button onClick={onRoles} title="역할 팩 — 템플릿 삽입">역할</button>
        <button onClick={onPaper} title="논문 모드 — 인용 관리">논문</button>
        <button onClick={onPaint} title="그림판">그림</button>
        <button onClick={onPostit} title="JustPin 포스트잇">포스트잇</button>
        <button onClick={onToggleOutline} className={outlineOpen ? 'is-active' : ''} title="목차 패널">목차</button>
        <span className="divider" />
        <button onClick={cycleTheme} title={`테마: ${theme}`}>{theme === 'dark' ? '☾' : theme === 'auto' ? 'A' : '☀'}</button>
        <button onClick={onVersions} title="버전 히스토리">⟲</button>
        <button onClick={onHelp} title="F1 단축키 도움말">?</button>
        <VoiceButton editor={editor} />
        <TTSButton editor={editor} />
                <button onClick={onAbout} title="버전 / 변경 내역">v</button>
      </div>
      <div className="jan-toolbar">
        <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'is-active' : ''} title="Ctrl+B 굵게"><b>B</b></button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'is-active' : ''} title="Ctrl+I 기울임"><i>I</i></button>
        <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive('underline') ? 'is-active' : ''} title="Ctrl+U 밑줄"><u>U</u></button>
        <button onClick={() => editor.chain().focus().toggleStrike().run()} className={editor.isActive('strike') ? 'is-active' : ''} title="취소선"><s>S</s></button>
        <span className="divider" />
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''} title="Ctrl+Alt+1 제목 1">H1</button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''} title="Ctrl+Alt+2 제목 2">H2</button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''} title="Ctrl+Alt+3 제목 3">H3</button>
        <span className="divider" />
        <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''} title="Ctrl+L 왼쪽">L</button>
        <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''} title="Ctrl+E 가운데">C</button>
        <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''} title="Ctrl+R 오른쪽">R</button>
        <button onClick={() => editor.chain().focus().setTextAlign('justify').run()} className={editor.isActive({ textAlign: 'justify' }) ? 'is-active' : ''} title="Ctrl+J 양쪽">J</button>
        <span className="divider" />
        <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'is-active' : ''} title="글머리 기호">•</button>
        <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'is-active' : ''} title="번호 목록">1.</button>
        <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive('blockquote') ? 'is-active' : ''} title="인용">&quot;</button>
        <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={editor.isActive('codeBlock') ? 'is-active' : ''} title="코드 블록">{'<>'}</button>
        <span className="divider" />
        <button onClick={insertTable} title="표 삽입">Table</button>
        <button onClick={insertImage} title="이미지">Img</button>
        <button onClick={toggleLink} title="링크">Link</button>
        <span className="divider" />
        <button onClick={() => editor.chain().focus().undo().run()} title="Ctrl+Z">Undo</button>
        <button onClick={() => editor.chain().focus().redo().run()} title="Ctrl+Shift+Z">Redo</button>
        <span className="divider" />
        <button onClick={togglePilcrow} title="엔터 표시">&para;</button>
      </div>
    </>
  )
}
