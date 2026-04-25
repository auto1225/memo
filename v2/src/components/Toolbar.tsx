import { useState, useRef, useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import { downloadHwpx } from '../lib/hwpxExport'
import { downloadMd } from '../lib/markdownIO'
import { exportToPdf } from '../lib/pdfExport'
import { VoiceButton } from './VoiceButton'
import { TTSButton } from './TTSButton'
import { ColorPicker } from './ColorPicker'

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
  icon?: string
  onClick: () => void
}

interface MenuGroup {
  label: string
  items: MenuItem[]
}

/**
 * Phase 18 — v1 스타일 Ribbon Toolbar.
 * 카테고리별 ▼ 드롭다운으로 그룹화. 메인 행에는 핵심 버튼만 노출.
 * 글자 깨짐 방지 — white-space:nowrap, flex-shrink:0.
 */
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
  const exportHwpx = async () => {
    try { await downloadHwpx(editor.getHTML(), p.title || '메모') }
    catch (e: any) { alert('HWPX 실패: ' + (e.message || e)) }
  }
  const exportMd = () => {
    try { downloadMd(editor.getHTML(), p.title || '메모') }
    catch (e: any) { alert('MD 실패: ' + (e.message || e)) }
  }
  const exportPdf = async () => {
    try { await exportToPdf(editor.getHTML(), p.title || '메모') }
    catch (e: any) { alert('PDF 실패: ' + (e.message || e)) }
  }
  function close() { setOpenMenu(null) }
  function run(fn: () => void) { fn(); close() }

  const groups: MenuGroup[] = [
    {
      label: '파일',
      items: [
        { label: '저장', hint: 'Ctrl+S', onClick: () => run(p.onSave) },
        { label: '열기', hint: 'Ctrl+O', onClick: () => run(p.onOpen) },
        { label: '인쇄 미리보기', hint: 'Ctrl+Alt+P', onClick: () => run(p.onPrintPreview) },
        { label: '인쇄', hint: 'Ctrl+P', onClick: () => run(() => window.print()) },
        { label: '── 내보내기 ──', onClick: () => {} },
        { label: 'HWPX (한글)', onClick: () => run(exportHwpx) },
        { label: 'Markdown (.md)', onClick: () => run(exportMd) },
        { label: 'PDF', onClick: () => run(exportPdf) },
        { label: 'GitHub Gist', onClick: () => run(p.onGist) },
        { label: '공유 링크 (URL)', onClick: () => run(p.onShare) },
        { label: 'Markdown 미리보기', onClick: () => run(p.onMdPreview) },
      ],
    },
    {
      label: '편집',
      items: [
        { label: '찾기/바꾸기', hint: 'Ctrl+H', onClick: () => run(p.onFind) },
        { label: '실행 취소', hint: 'Ctrl+Z', onClick: () => run(() => editor.chain().focus().undo().run()) },
        { label: '다시 실행', hint: 'Ctrl+Shift+Z', onClick: () => run(() => editor.chain().focus().redo().run()) },
        { label: '── 정렬 ──', onClick: () => {} },
        { label: '왼쪽', hint: 'Ctrl+L', onClick: () => run(() => editor.chain().focus().setTextAlign('left').run()) },
        { label: '가운데', hint: 'Ctrl+E', onClick: () => run(() => editor.chain().focus().setTextAlign('center').run()) },
        { label: '오른쪽', hint: 'Ctrl+R', onClick: () => run(() => editor.chain().focus().setTextAlign('right').run()) },
        { label: '양쪽', hint: 'Ctrl+J', onClick: () => run(() => editor.chain().focus().setTextAlign('justify').run()) },
      ],
    },
    {
      label: '삽입',
      items: [
        { label: '표 (3×3)', onClick: () => run(insertTable) },
        { label: '이미지 URL', onClick: () => run(insertImage) },
        { label: '링크', onClick: () => run(toggleLink) },
        { label: '── 노드 ──', onClick: () => {} },
        { label: '체크리스트', onClick: () => run(() => (editor.chain() as any).focus().toggleList('taskList', 'taskItem').run()) },
        { label: '콜아웃 (정보)', onClick: () => run(() => (editor.chain() as any).focus().setCallout('info').run()) },
        { label: '콜아웃 (경고)', onClick: () => run(() => (editor.chain() as any).focus().setCallout('warn').run()) },
        { label: '수식 (LaTeX)', onClick: () => { const t = window.prompt('LaTeX:'); if (t) (editor.chain() as any).focus().setMath(t).run(); close() } },
        { label: '다이어그램 (Mermaid)', onClick: () => { const c = window.prompt('Mermaid:', 'graph TD\n  A-->B'); if (c) (editor.chain() as any).focus().setMermaid(c).run(); close() } },
        { label: '임베드 (URL)', onClick: () => { const u = window.prompt('URL:'); if (u) (editor.chain() as any).focus().setEmbed(u).run(); close() } },
        { label: '── 빠른 ──', onClick: () => {} },
        { label: '빠른 메모', hint: 'Ctrl+Shift+J', onClick: () => run(p.onQuick) },
        { label: '스니펫', onClick: () => run(p.onSnippets) },
        { label: '매크로', onClick: () => run(p.onMacros) },
        { label: '템플릿', onClick: () => run(p.onTemplates) },
        { label: '역할 팩', onClick: () => run(p.onRoles) },
      ],
    },
    {
      label: 'AI',
      items: [
        { label: 'AI 도우미', hint: 'Ctrl+/', onClick: () => run(p.onAi) },
        { label: 'AI 챗 패널', onClick: () => run(p.onChat) },
        { label: '다국어 번역', onClick: () => run(p.onTranslate) },
        { label: 'OCR (이미지→텍스트)', onClick: () => run(p.onOcr) },
      ],
    },
    {
      label: '메모',
      items: [
        { label: '전체 검색', hint: 'Ctrl+Shift+F', onClick: () => run(p.onSearch) },
        { label: '메모 정보', onClick: () => run(p.onInfo) },
        { label: '버전 히스토리', onClick: () => run(p.onVersions) },
        { label: '메모 비교 (diff)', onClick: () => run(p.onDiff) },
        { label: '── 보호/통계 ──', onClick: () => {} },
        { label: '비밀번호 잠금', onClick: () => run(p.onLock) },
        { label: '메모 통계', onClick: () => run(p.onStats) },
        { label: '활동 히트맵', onClick: () => run(p.onHeatmap) },
        { label: '마인드맵', onClick: () => run(p.onMindMap) },
        { label: '── 콘텐츠 ──', onClick: () => {} },
        { label: '논문 모드', onClick: () => run(p.onPaper) },
        { label: '첨부 파일', onClick: () => run(p.onAtt) },
        { label: '포스트잇 (JustPin)', onClick: () => run(p.onPostit) },
        { label: '그림판', onClick: () => run(p.onPaint) },
        { label: '깨진 링크 검사', onClick: () => run(p.onLinkCheck) },
      ],
    },
    {
      label: '보기',
      items: [
        { label: '목차 ' + (p.outlineOpen ? '✓' : ''), onClick: () => run(p.onToggleOutline) },
        { label: '엔터 표시 토글', onClick: () => run(togglePilcrow) },
        { label: '타이포그래피', onClick: () => run(p.onTypo) },
        { label: '단축키 도움말', hint: 'F1', onClick: () => run(p.onHelp) },
        { label: '버전 / 변경 내역', onClick: () => run(p.onAbout) },
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
          {group.label} <span className="jan-menu-arrow">▾</span>
        </button>
        {isOpen && (
          <div className="jan-menu-dropdown" onMouseDown={(e) => e.stopPropagation()}>
            {group.items.map((it, i) => {
              if (it.label.startsWith('──')) return <div key={i} className="jan-menu-divider">{it.label.replace(/──/g, '').trim()}</div>
              return (
                <button key={i} className="jan-menu-item" onClick={it.onClick}>
                  <span>{it.label}</span>
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
      {/* 1줄: 제목 + 빠른 액세스 */}
      <div className="jan-titlebar" ref={containerRef}>
        <input
          type="text"
          value={p.title}
          onChange={(e) => p.onTitleChange(e.target.value)}
          placeholder="제목"
          className="jan-title-input"
        />
        <div className="jan-quick-actions">
          <button onClick={p.onSave} title="Ctrl+S 저장" className="jan-icon-btn">💾</button>
          <button onClick={p.onOpen} title="Ctrl+O 열기" className="jan-icon-btn">📂</button>
          <button onClick={() => editor.chain().focus().undo().run()} title="Ctrl+Z" className="jan-icon-btn">↶</button>
          <button onClick={() => editor.chain().focus().redo().run()} title="Ctrl+Shift+Z" className="jan-icon-btn">↷</button>
        </div>
        <div className="jan-spacer" />
        <VoiceButton editor={editor} />
        <TTSButton editor={editor} />
      </div>

      {/* 2줄: 메뉴 그룹 (v1 ribbon style) */}
      <div className="jan-ribbon" ref={containerRef}>
        {groups.map((g) => <MenuButton key={g.label} group={g} />)}
      </div>

      {/* 3줄: 서식 도구 */}
      <div className="jan-toolbar">
        <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'is-active' : ''} title="Ctrl+B"><b>B</b></button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'is-active' : ''} title="Ctrl+I"><i>I</i></button>
        <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive('underline') ? 'is-active' : ''} title="Ctrl+U"><u>U</u></button>
        <button onClick={() => editor.chain().focus().toggleStrike().run()} className={editor.isActive('strike') ? 'is-active' : ''} title="취소선"><s>S</s></button>
        <button onClick={() => (editor.chain() as any).focus().toggleHighlight({ color: '#FFEB3B' }).run()} className={editor.isActive('highlight') ? 'is-active' : ''} title="형광펜"><mark style={{ padding: 0, background: '#FFEB3B' }}>H</mark></button>
        <ColorPicker editor={editor} />
        <span className="divider" />
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''} title="제목 1">H1</button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''} title="제목 2">H2</button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''} title="제목 3">H3</button>
        <span className="divider" />
        <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''} title="왼쪽">⇤</button>
        <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''} title="가운데">≡</button>
        <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''} title="오른쪽">⇥</button>
        <span className="divider" />
        <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'is-active' : ''} title="글머리">•</button>
        <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'is-active' : ''} title="번호">1.</button>
        <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive('blockquote') ? 'is-active' : ''} title="인용">&quot;</button>
        <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={editor.isActive('codeBlock') ? 'is-active' : ''} title="코드">{'<>'}</button>
        <span className="divider" />
        <button onClick={insertTable} title="표">⊞</button>
        <button onClick={insertImage} title="이미지">🖼</button>
        <button onClick={toggleLink} title="링크">🔗</button>
      </div>
    </>
  )
}
