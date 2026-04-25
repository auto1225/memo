import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { Image } from '@tiptap/extension-image'
import { PaginationPlus, PAGE_SIZES } from 'tiptap-pagination-plus'
import { useEffect, useState } from 'react'
import { Toolbar } from './Toolbar'
import { StatusBar } from './StatusBar'
import { CommandPalette } from './CommandPalette'
import { AiHelper } from './AiHelper'
import { SettingsModal } from './SettingsModal'
import { PrintPreview } from './PrintPreview'
import { RolesPanel } from './RolesPanel'
import { PaperPanel } from './PaperPanel'
import { PostitPanel } from './PostitPanel'
import { SearchPanel } from './SearchPanel'
import { PaintCanvas } from './PaintCanvas'
import { KeyboardHelp } from './KeyboardHelp'
import { OutlinePanel } from './OutlinePanel'
import { TagsBar } from './TagsBar'
import { useDocStore } from '../store/docStore'
import { useMemosStore } from '../store/memosStore'
import { useThemeStore } from '../store/themeStore'
import { saveToFile, openFile } from '../lib/fileOps'
import { installWordKeymap } from '../lib/keymap'
import { pushOne, syncConfigured } from '../lib/supabaseSync'
import { tauriSyncOnBoot } from '../lib/justpin'

/**
 * JustANotepad v2 — Phase 6 통합.
 * 모달: AI / 설정 / 인쇄 / 역할 / 논문 / 포스트잇 / 검색 / 그림판 / 도움말
 * 사이드 패널: 목차 (Outline)
 * 메인 영역: 태그 바 + TipTap 편집기
 */
export function Editor() {
  const { fileHandle, setFileHandle, setSavedAt, setEditor } = useDocStore()
  const { currentId, current, updateCurrent } = useMemosStore()
  const applyTheme = useThemeStore((s) => s.apply)
  const memo = current()
  const [, setTick] = useState(0)
  const [showAi, setShowAi] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [showRoles, setShowRoles] = useState(false)
  const [showPaper, setShowPaper] = useState(false)
  const [showPostit, setShowPostit] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showPaint, setShowPaint] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showOutline, setShowOutline] = useState(false)

  const initialContent = memo?.content || '<p></p>'
  const title = memo?.title || '새 메모'

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      Placeholder.configure({
        placeholder: '여기에 메모를 적어보세요... (Ctrl+B 굵게, F1 단축키)',
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
      PaginationPlus.configure({
        ...PAGE_SIZES.A4,
        pageGap: 24,
        pageBreakBackground: '#ffeef2',
        pageGapBorderSize: 0,
        pageGapBorderColor: 'transparent',
        contentMarginTop: 0,
        contentMarginBottom: 0,
        headerLeft: '',
        headerRight: '',
        footerLeft: '',
        footerRight: 'Page {page} / {total}',
        customHeader: {},
        customFooter: {},
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'ProseMirror',
        spellcheck: 'false',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      updateCurrent({ content: html })
    },
  })

  useEffect(() => {
    if (editor) setEditor(editor)
    // 부팅 시 — 테마 적용 + Tauri postit 동기화
    applyTheme()
    tauriSyncOnBoot().catch(() => {})
  }, [editor, setEditor, applyTheme])

  // 메모 전환 시 — content 를 새 메모로 교체.
  useEffect(() => {
    if (!editor || !memo) return
    const cur = editor.getHTML()
    if (cur !== memo.content) {
      editor.commands.setContent(memo.content, { emitUpdate: false })
    }
    setTick((n) => n + 1)
  }, [currentId, editor])

  // Word-style keymap
  useEffect(() => {
    if (!editor) return
    const detach = installWordKeymap(editor, {
      onSave: handleSave,
      onOpen: handleOpen,
      onPrint: () => window.print(),
    })
    return detach
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, fileHandle, title, currentId])

  // 추가 단축키
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && !e.shiftKey && !e.altKey && e.key === '/') {
        e.preventDefault()
        setShowAi(true)
      } else if (ctrl && !e.shiftKey && !e.altKey && e.key === ',') {
        e.preventDefault()
        setShowSettings(true)
      } else if (ctrl && e.altKey && !e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault()
        setShowPrint(true)
      } else if (ctrl && e.shiftKey && !e.altKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault()
        setShowSearch(true)
      } else if (e.key === 'F1' || (ctrl && e.shiftKey && e.key === '?')) {
        e.preventDefault()
        setShowHelp(true)
      }
    }
    document.addEventListener('keydown', h, true)
    return () => document.removeEventListener('keydown', h, true)
  }, [])

  async function handleSave() {
    if (!editor) return
    const html = editor.getHTML()
    const result = await saveToFile({ title, content: html, handle: fileHandle })
    if (result.ok) {
      setSavedAt(Date.now())
      if (result.handle) setFileHandle(result.handle)
      if (syncConfigured() && currentId) {
        pushOne(currentId).catch(() => {})
      }
    } else if (result.error !== '취소됨') {
      alert('저장 실패: ' + result.error)
    }
  }

  async function handleOpen() {
    if (!editor) return
    const result = await openFile()
    if (!result) return
    updateCurrent({ title: result.title, content: result.content })
    setFileHandle(result.handle)
    editor.commands.setContent(result.content)
  }

  return (
    <div className="jan-editor-wrap">
      <Toolbar
        editor={editor}
        title={title}
        onTitleChange={(t) => updateCurrent({ title: t })}
        onSave={handleSave}
        onOpen={handleOpen}
        onPrintPreview={() => setShowPrint(true)}
        onAi={() => setShowAi(true)}
        onRoles={() => setShowRoles(true)}
        onPaper={() => setShowPaper(true)}
        onPostit={() => setShowPostit(true)}
        onSearch={() => setShowSearch(true)}
        onPaint={() => setShowPaint(true)}
        onHelp={() => setShowHelp(true)}
        onToggleOutline={() => setShowOutline((v) => !v)}
        outlineOpen={showOutline}
      />
      <TagsBar />
      <div className={'jan-main' + (showOutline ? ' has-outline' : '')}>
        {showOutline && <OutlinePanel editor={editor} />}
        <div className="jan-editor-pages">
          <EditorContent editor={editor} />
        </div>
      </div>
      <StatusBar editor={editor} />
      <CommandPalette editor={editor} />
      {showAi && <AiHelper editor={editor} onClose={() => setShowAi(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showPrint && editor && (
        <PrintPreview html={editor.getHTML()} title={title} onClose={() => setShowPrint(false)} />
      )}
      {showRoles && <RolesPanel editor={editor} onClose={() => setShowRoles(false)} />}
      {showPaper && <PaperPanel editor={editor} onClose={() => setShowPaper(false)} />}
      {showPostit && <PostitPanel onClose={() => setShowPostit(false)} />}
      {showSearch && <SearchPanel onClose={() => setShowSearch(false)} />}
      {showPaint && <PaintCanvas editor={editor} onClose={() => setShowPaint(false)} />}
      {showHelp && <KeyboardHelp onClose={() => setShowHelp(false)} />}
    </div>
  )
}
