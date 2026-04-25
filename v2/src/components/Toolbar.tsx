import { useState, useRef, useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import { downloadHwpx } from '../lib/hwpxExport'
import { downloadMd } from '../lib/markdownIO'
import { exportToPdf } from '../lib/pdfExport'
import { VoiceButton } from './VoiceButton'
import { TTSButton } from './TTSButton'
import { ColorPicker } from './ColorPicker'
import { Icon } from './Icons'
import type { IconName } from './Icons'

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
  onAtt: () => void
  onLock: () => void
  onStats: () => void
  onMindMap: () => void
  onMacros: () => void
  onDiff: () => void
  onOcr: () => void
  onSnippets: () => void
  onLinkCheck: () => void
  onChat: () => void
  onFind: () => void
  onTypo: () => void
  onInfo: () => void
  onHeatmap: () => void
  onQuick: () => void
  onTranslate: () => void
  onTemplates: () => void
  onGist: () => void
}

interface MenuItem {
  label: string
  hint?: string
  icon?: IconName
  divider?: string
  onClick?: () => void
}
interface MenuGroup {
  label: string
  items: MenuItem[]
}

export function Toolbar(p: ToolbarProps) {
  const editor = p.editor
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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
    try {
      const on = document.body.classList.contains('jan-show-pilcrow')
      localStorage.setItem('jan-show-pilcrow', on ? '1' : '0')
    } catch {}
  }
  const insertTable = () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  const insertImage = () => {
    const url = window.prompt('이미지 URL:')
    if (url) editor.chain().focus().setImage({ src: url }).run()
  }
  const toggleLink = () => {
    const prev = editor.getAttributes('link').href
    const url = window.prompt('링크 URL:', prev || '')
    if (url === null) return
    if (url === '') editor.chain().focus().unsetLink().run()
    else editor.chain().focus().setLink({ href: url }).run()
  }
  const exportHwpx = async () => { try { await downloadHwpx(editor.getHTML(), p.title || '메모') } catch (e: any) { alert('HWPX 실패: ' + (e.message || e)) } }
  const exportMd = () => { try { downloadMd(editor.getHTML(), p.title || '메모') } catch (e: any) { alert('MD 실패: ' + (e.message || e)) } }
  const exportPdf = async () => { try { await exportToPdf(editor.getHTML(), p.title || '메모') } catch (e: any) { alert('PDF 실패: ' + (e.message || e)) } }
  function close() { setOpenMenu(null) }
  function run(fn: () => void) { fn(); close() }

  const groups: MenuGroup[] = [
    {
      label: '파일',
      items: [
        { label: '저장', hint: 'Ctrl+S', icon: 'save', onClick: () => run(p.onSave) },
        { label: '열기', hint: 'Ctrl+O', icon: 'open', onClick: () => run(p.onOpen) },
        { label: '인쇄 미리보기', hint: 'Ctrl+Alt+P', icon: 'preview', onClick: () => run(p.onPrintPreview) },
        { label: '인쇄', hint: 'Ctrl+P', icon: 'print', onClick: () => run(() => window.print()) },
        { divider: '내보내기', label: '' },
        { label: 'HWPX (한글)', icon: 'file-text', onClick: () => run(exportHwpx) },
        { label: 'Markdown (.md)', icon: 'file-text', onClick: () => run(exportMd) },
        { label: 'PDF', icon: 'file-text', onClick: () => run(exportPdf) },
        { label: 'GitHub Gist', icon: 'cloud', onClick: () => run(p.onGist) },
        { label: '공유 링크', icon: 'link', onClick: () => run(p.onShare) },
        { label: 'Markdown 미리보기', icon: 'preview', onClick: () => run(p.onMdPreview) },
      ],
    },
    {
      label: '편집',
      items: [
        { label: '찾기/바꾸기', hint: 'Ctrl+H', icon: 'find', onClick: () => run(p.onFind) },
        { label: '실행 취소', hint: 'Ctrl+Z', icon: 'undo', onClick: () => run(() => editor.chain().focus().undo().run()) },
        { label: '다시 실행', hint: 'Ctrl+Shift+Z', icon: 'redo', onClick: () => run(() => editor.chain().focus().redo().run()) },
        { divider: '정렬', label: '' },
        { label: '왼쪽', hint: 'Ctrl+L', icon: 'align-left', onClick: () => run(() => editor.chain().focus().setTextAlign('left').run()) },
        { label: '가운데', hint: 'Ctrl+E', icon: 'align-center', onClick: () => run(() => editor.chain().focus().setTextAlign('center').run()) },
        { label: '오른쪽', hint: 'Ctrl+R', icon: 'align-right', onClick: () => run(() => editor.chain().focus().setTextAlign('right').run()) },
        { label: '양쪽', hint: 'Ctrl+J', icon: 'align-justify', onClick: () => run(() => editor.chain().focus().setTextAlign('justify').run()) },
      ],
    },
    {
      label: '삽입',
      items: [
        { label: '표 (3×3)', icon: 'table', onClick: () => run(insertTable) },
        { label: '이미지 URL', icon: 'image', onClick: () => run(insertImage) },
        { label: '링크', icon: 'link', onClick: () => run(toggleLink) },
        { divider: '노드', label: '' },
        { label: '체크리스트', icon: 'list-check', onClick: () => run(() => (editor.chain() as any).focus().toggleList('taskList', 'taskItem').run()) },
        { label: '콜아웃 (정보)', icon: 'info', onClick: () => run(() => (editor.chain() as any).focus().setCallout('info').run()) },
        { label: '콜아웃 (경고)', icon: 'bell', onClick: () => run(() => (editor.chain() as any).focus().setCallout('warn').run()) },
        { label: '수식 (LaTeX)', icon: 'hash', onClick: () => { const t = window.prompt('LaTeX:'); if (t) (editor.chain() as any).focus().setMath(t).run(); close() } },
        { label: '다이어그램 (Mermaid)', icon: 'hash', onClick: () => { const c = window.prompt('Mermaid:', 'graph TD\n  A-->B'); if (c) (editor.chain() as any).focus().setMermaid(c).run(); close() } },
        { label: '임베드 URL', icon: 'globe', onClick: () => { const u = window.prompt('URL:'); if (u) (editor.chain() as any).focus().setEmbed(u).run(); close() } },
        { divider: '빠른', label: '' },
        { label: '빠른 메모', hint: 'Ctrl+Shift+J', icon: 'plus', onClick: () => run(p.onQuick) },
        { label: '스니펫', icon: 'file-plus', onClick: () => run(p.onSnippets) },
        { label: '매크로', icon: 'wand', onClick: () => run(p.onMacros) },
        { label: '템플릿', icon: 'file-text', onClick: () => run(p.onTemplates) },
        { label: '역할 팩', icon: 'user', onClick: () => run(p.onRoles) },
      ],
    },
    {
      label: 'AI',
      items: [
        { label: 'AI 도우미', hint: 'Ctrl+/', icon: 'ai', onClick: () => run(p.onAi) },
        { label: 'AI 챗 패널', icon: 'sparkle', onClick: () => run(p.onChat) },
        { label: '다국어 번역', icon: 'translate', onClick: () => run(p.onTranslate) },
        { label: 'OCR (이미지→텍스트)', icon: 'image-text', onClick: () => run(p.onOcr) },
      ],
    },
    {
      label: '메모',
      items: [
        { label: '전체 검색', hint: 'Ctrl+Shift+F', icon: 'search', onClick: () => run(p.onSearch) },
        { label: '메모 정보', icon: 'info', onClick: () => run(p.onInfo) },
        { label: '버전 히스토리', icon: 'undo', onClick: () => run(p.onVersions) },
        { label: '메모 비교', icon: 'replace', onClick: () => run(p.onDiff) },
        { divider: '보호/통계', label: '' },
        { label: '비밀번호 잠금', icon: 'lock', onClick: () => run(p.onLock) },
        { label: '메모 통계', icon: 'hash', onClick: () => run(p.onStats) },
        { label: '활동 히트맵', icon: 'hash', onClick: () => run(p.onHeatmap) },
        { label: '마인드맵', icon: 'sparkle', onClick: () => run(p.onMindMap) },
        { divider: '콘텐츠', label: '' },
        { label: '논문 모드', icon: 'file-text', onClick: () => run(p.onPaper) },
        { label: '첨부 파일', icon: 'paperclip', onClick: () => run(p.onAtt) },
        { label: '포스트잇', icon: 'pin', onClick: () => run(p.onPostit) },
        { label: '그림판', icon: 'paint', onClick: () => run(p.onPaint) },
        { label: '깨진 링크 검사', icon: 'unlink', onClick: () => run(p.onLinkCheck) },
      ],
    },
    {
      label: '보기',
      items: [
        { label: '목차 ' + (p.outlineOpen ? '✓' : ''), icon: 'list-bullet', onClick: () => run(p.onToggleOutline) },
        { label: '엔터 표시 토글', icon: 'paragraph', onClick: () => run(togglePilcrow) },
        { label: '타이포그래피', icon: 'palette', onClick: () => run(p.onTypo) },
        { label: '단축키 도움말', hint: 'F1', icon: 'help', onClick: () => run(p.onHelp) },
        { label: '버전 / 변경 내역', icon: 'info', onClick: () => run(p.onAbout) },
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
          {group.label}<Icon name="chevron-down" size={11} className="jan-menu-arrow" />
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
    <>
      {/* 1줄: 제목 + 빠른 액세스 + 우측 도구 */}
      <div className="jan-titlebar" ref={containerRef}>
        <input
          type="text"
          value={p.title}
          onChange={(e) => p.onTitleChange(e.target.value)}
          placeholder="제목"
          className="jan-title-input"
        />
        <div className="jan-quick-actions">
          <button onClick={p.onSave} title="저장 (Ctrl+S)" className="jan-icon-btn"><Icon name="save" size={16} /></button>
          <button onClick={p.onOpen} title="열기 (Ctrl+O)" className="jan-icon-btn"><Icon name="open" size={16} /></button>
          <button onClick={() => editor.chain().focus().undo().run()} title="실행 취소 (Ctrl+Z)" className="jan-icon-btn"><Icon name="undo" size={16} /></button>
          <button onClick={() => editor.chain().focus().redo().run()} title="다시 실행 (Ctrl+Shift+Z)" className="jan-icon-btn"><Icon name="redo" size={16} /></button>
        </div>
        <div className="jan-spacer" />
        <VoiceButton editor={editor} />
        <TTSButton editor={editor} />
      </div>

      {/* 2줄: 메뉴 그룹 */}
      <div className="jan-ribbon" ref={containerRef}>
        {groups.map((g) => <MenuButton key={g.label} group={g} />)}
      </div>

      {/* 3줄: 서식 도구 */}
      <div className="jan-toolbar">
        <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'is-active' : ''} title="굵게 (Ctrl+B)"><Icon name="bold" /></button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'is-active' : ''} title="기울임 (Ctrl+I)"><Icon name="italic" /></button>
        <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive('underline') ? 'is-active' : ''} title="밑줄 (Ctrl+U)"><Icon name="underline" /></button>
        <button onClick={() => editor.chain().focus().toggleStrike().run()} className={editor.isActive('strike') ? 'is-active' : ''} title="취소선"><Icon name="strike" /></button>
        <button onClick={() => (editor.chain() as any).focus().toggleHighlight({ color: '#FFEB3B' }).run()} className={editor.isActive('highlight') ? 'is-active' : ''} title="형광펜"><Icon name="highlight" /></button>
        <ColorPicker editor={editor} />
        <span className="divider" />
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''} title="제목 1"><Icon name="h1" size={18} /></button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''} title="제목 2"><Icon name="h2" size={18} /></button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''} title="제목 3"><Icon name="h3" size={18} /></button>
        <span className="divider" />
        <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''} title="왼쪽 정렬"><Icon name="align-left" /></button>
        <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''} title="가운데 정렬"><Icon name="align-center" /></button>
        <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''} title="오른쪽 정렬"><Icon name="align-right" /></button>
        <button onClick={() => editor.chain().focus().setTextAlign('justify').run()} className={editor.isActive({ textAlign: 'justify' }) ? 'is-active' : ''} title="양쪽 정렬"><Icon name="align-justify" /></button>
        <span className="divider" />
        <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'is-active' : ''} title="글머리 기호"><Icon name="list-bullet" /></button>
        <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'is-active' : ''} title="번호 목록"><Icon name="list-numbered" /></button>
        <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive('blockquote') ? 'is-active' : ''} title="인용"><Icon name="quote" /></button>
        <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={editor.isActive('codeBlock') ? 'is-active' : ''} title="코드 블록"><Icon name="code" /></button>
        <span className="divider" />
        <button onClick={insertTable} title="표 삽입"><Icon name="table" /></button>
        <button onClick={insertImage} title="이미지"><Icon name="image" /></button>
        <button onClick={toggleLink} title="링크"><Icon name="link" /></button>
      </div>
    </>
  )
}
