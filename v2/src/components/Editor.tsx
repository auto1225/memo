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
import { useDocStore } from '../store/docStore'
import { useMemosStore } from '../store/memosStore'
import { saveToFile, openFile } from '../lib/fileOps'
import { installWordKeymap } from '../lib/keymap'
import { pushOne, syncConfigured } from '../lib/supabaseSync'

/**
 * JustANotepad v2 — Phase 5 통합.
 * 모달: AI 도우미, 설정, 인쇄 미리보기, 역할 팩, 논문, 포스트잇.
 */
export function Editor() {
  const { fileHandle, setFileHandle, setSavedAt, setEditor } = useDocStore()
  const { currentId, current, updateCurrent } = useMemosStore()
  const memo = current()
  const [, setTick] = useState(0)
  const [showAi, setShowAi] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [showRoles, setShowRoles] = useState(false)
  const [showPaper, setShowPaper] = useState(false)
  const [showPostit, setShowPostit] = useState(false)

  const initialContent = memo?.content || '<p></p>'
  const title = memo?.title || '새 메모'

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      Placeholder.configure({
        placeholder: '여기에 메모를 적어보세요... (Ctrl+B 굵게, Ctrl+I 기울임, Ctrl+U 밑줄)',
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
  }, [editor, setEditor])

  // 메모 전환 시 — content 를 새 메모로 교체.
  // emitUpdate=false 로 onUpdate 발화 차단 → 이전 메모로의 덮어쓰기 race 방지.
  useEffect(() => {
    if (!editor || !memo) return
    const cur = editor.getHTML()
    if (cur !== memo.content) {
      editor.commands.setContent(memo.content, { emitUpdate: false })
    }
    setTick((n) => n + 1)
  }, [currentId, editor])

  // Keyboard shortcuts (MS Word compatible).
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

  // 추가 단축키 — Ctrl+/ AI, Ctrl+, 설정, Ctrl+Shift+P 미리보기
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
      } else if (ctrl && e.shiftKey && !e.altKey && (e.key === 'P' || e.key === 'p')) {
        // Ctrl+Shift+P — Paged.js 미리보기. CommandPalette 도 같은 키 → CommandPalette 가 먼저 캡쳐.
        // 따라서 별도 handler 추가하지 않고 CommandPalette 안에서만 처리.
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
      // Phase 5 — Supabase 자동 푸시 (설정된 경우).
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
      />
      <div className="jan-editor-pages">
        <EditorContent editor={editor} />
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
    </div>
  )
}
