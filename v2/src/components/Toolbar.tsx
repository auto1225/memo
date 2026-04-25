import { useState, useRef, useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import { downloadHwpx } from '../lib/hwpxExport'
import { downloadMd } from '../lib/markdownIO'
import { exportToPdf } from '../lib/pdfExport'
import { ColorPicker } from './ColorPicker'
import { Icon } from './Icons'
import type { IconName } from './Icons'
import { useTypographyStore, type FontFamily } from '../store/typographyStore'

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
 * Phase 19 — v1 스타일 단일 행 Toolbar.
 * 좌측: 폰트 select + 폰트 크기 + 서식(B/I/U) + 색상 + 정렬 + 리스트 + Undo/Redo
 * 우측: 카테고리 ▾ 메뉴 (논문/서식/삽입/페이지/미디어/도구/보기/파일)
 */
export function Toolbar(p: ToolbarProps) {
  const editor = p.editor
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const typo = useTypographyStore()

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
  const exportHwpx = async () => { try { await downloadHwpx(editor.getHTML(), '메모') } catch (e: any) { alert('HWPX 실패: ' + (e.message || e)) } }
  const exportMd = () => { try { downloadMd(editor.getHTML(), '메모') } catch (e: any) { alert('MD 실패: ' + (e.message || e)) } }
  const exportPdf = async () => { try { await exportToPdf(editor.getHTML(), '메모') } catch (e: any) { alert('PDF 실패: ' + (e.message || e)) } }
  function close() { setOpenMenu(null) }
  function run(fn: () => void) { fn(); close() }

  const groups: MenuGroup[] = [
    {
      label: '논문', items: [
        { label: '논문 모드', icon: 'file-text', onClick: () => run(p.onPaper) },
        { label: '역할 팩', icon: 'user', onClick: () => run(p.onRoles) },
        { label: '템플릿', icon: 'file-text', onClick: () => run(p.onTemplates) },
        { label: '스니펫', icon: 'file-plus', onClick: () => run(p.onSnippets) },
      ],
    },
    {
      label: '서식', items: [
        { label: '타이포그래피 (글꼴/줄간격)', icon: 'palette', onClick: () => run(p.onTypo) },
        { label: '엔터 표시 토글', icon: 'paragraph', onClick: () => run(togglePilcrow) },
      ],
    },
    {
      label: '삽입', items: [
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
        { divider: '빠른 입력', label: '' },
        { label: '빠른 메모', hint: 'Ctrl+Shift+J', icon: 'plus', onClick: () => run(p.onQuick) },
        { label: '매크로 편집', icon: 'wand', onClick: () => run(p.onMacros) },
      ],
    },
    {
      label: '페이지', items: [
        { label: '인쇄 미리보기', hint: 'Ctrl+Alt+P', icon: 'preview', onClick: () => run(p.onPrintPreview) },
        { label: '인쇄', hint: 'Ctrl+P', icon: 'print', onClick: () => run(() => window.print()) },
      ],
    },
    {
      label: '미디어', items: [
        { label: '첨부 파일', icon: 'paperclip', onClick: () => run(p.onAtt) },
        { label: '그림판', icon: 'paint', onClick: () => run(p.onPaint) },
        { label: '포스트잇', icon: 'pin', onClick: () => run(p.onPostit) },
      ],
    },
    {
      label: '도구', items: [
        { label: '찾기/바꾸기', hint: 'Ctrl+H', icon: 'find', onClick: () => run(p.onFind) },
        { label: 'AI 도우미', hint: 'Ctrl+/', icon: 'ai', onClick: () => run(p.onAi) },
        { label: '다국어 번역', icon: 'translate', onClick: () => run(p.onTranslate) },
        { divider: '메모 분석', label: '' },
        { label: '메모 정보', icon: 'info', onClick: () => run(p.onInfo) },
        { label: '버전 히스토리', icon: 'undo', onClick: () => run(p.onVersions) },
        { label: '메모 비교 (diff)', icon: 'replace', onClick: () => run(p.onDiff) },
        { label: '비밀번호 잠금', icon: 'lock', onClick: () => run(p.onLock) },
        { label: '메모 통계', icon: 'hash', onClick: () => run(p.onStats) },
        { label: '활동 히트맵', icon: 'hash', onClick: () => run(p.onHeatmap) },
        { label: '마인드맵', icon: 'sparkle', onClick: () => run(p.onMindMap) },
        { label: '깨진 링크 검사', icon: 'unlink', onClick: () => run(p.onLinkCheck) },
      ],
    },
    {
      label: '보기', items: [
        { label: '목차 ' + (p.outlineOpen ? '✓' : ''), icon: 'list-bullet', onClick: () => run(p.onToggleOutline) },
        { label: 'Markdown 미리보기', icon: 'preview', onClick: () => run(p.onMdPreview) },
      ],
    },
    {
      label: '파일', items: [
        { label: '저장', hint: 'Ctrl+S', icon: 'save', onClick: () => run(p.onSave) },
        { label: '열기', hint: 'Ctrl+O', icon: 'open', onClick: () => run(p.onOpen) },
        { divider: '내보내기', label: '' },
        { label: 'HWPX (한글)', icon: 'file-text', onClick: () => run(exportHwpx) },
        { label: 'Markdown (.md)', icon: 'file-text', onClick: () => run(exportMd) },
        { label: 'PDF', icon: 'file-text', onClick: () => run(exportPdf) },
        { label: 'GitHub Gist', icon: 'cloud', onClick: () => run(p.onGist) },
        { label: '공유 링크', icon: 'link', onClick: () => run(p.onShare) },
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
