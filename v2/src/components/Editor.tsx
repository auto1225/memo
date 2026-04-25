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
import { Collaboration } from '@tiptap/extension-collaboration'
import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { useEffect, useState, lazy, Suspense, useMemo } from 'react'
import { Toolbar } from './Toolbar'
import { StatusBar } from './StatusBar'
import { CommandPalette } from './CommandPalette'
import { TagsBar } from './TagsBar'
import { OutlinePanel } from './OutlinePanel'
import { SlashMenu } from './SlashMenu'
import { useDocStore } from '../store/docStore'
import { useMemosStore } from '../store/memosStore'
import { useThemeStore } from '../store/themeStore'
import { saveToFile, openFile } from '../lib/fileOps'
import { installWordKeymap } from '../lib/keymap'
import { pushOne, syncConfigured } from '../lib/supabaseSync'
import { tauriSyncOnBoot } from '../lib/justpin'
import { trackEvent } from '../lib/analytics'
import { MathInline } from '../extensions/Math'
import { Mermaid } from '../extensions/Mermaid'
import { MentionExt } from '../extensions/MentionConfig'
import { Callout } from '../extensions/Callout'
import { Embed } from '../extensions/Embed'
import { useCollab } from '../hooks/useCollab'
import { useImageDropPaste } from '../hooks/useImageDropPaste'
import { useAutoSave } from '../hooks/useAutoSave'
import { useVersionsStore } from '../store/versionsStore'
import { TableMenu } from './TableMenu'
import { useMacroExpansion } from '../hooks/useMacroExpansion'
import { LinkCard } from '../extensions/LinkCard'
import { ModalSkeleton } from './ModalSkeleton'

const AiHelper = lazy(() => import('./AiHelper').then((m) => ({ default: m.AiHelper })))
const SettingsModal = lazy(() => import('./SettingsModal').then((m) => ({ default: m.SettingsModal })))
const PrintPreview = lazy(() => import('./PrintPreview').then((m) => ({ default: m.PrintPreview })))
const RolesPanel = lazy(() => import('./RolesPanel').then((m) => ({ default: m.RolesPanel })))
const PaperPanel = lazy(() => import('./PaperPanel').then((m) => ({ default: m.PaperPanel })))
const PostitPanel = lazy(() => import('./PostitPanel').then((m) => ({ default: m.PostitPanel })))
const SearchPanel = lazy(() => import('./SearchPanel').then((m) => ({ default: m.SearchPanel })))
const PaintCanvas = lazy(() => import('./PaintCanvas').then((m) => ({ default: m.PaintCanvas })))
const KeyboardHelp = lazy(() => import('./KeyboardHelp').then((m) => ({ default: m.KeyboardHelp })))
const AboutModal = lazy(() => import('./AboutModal').then((m) => ({ default: m.AboutModal })))
const VersionsPanel = lazy(() => import('./VersionsPanel').then((m) => ({ default: m.VersionsPanel })))
const MarkdownPreview = lazy(() => import('./MarkdownPreview').then((m) => ({ default: m.MarkdownPreview })))
const ShareModal = lazy(() => import('./ShareModal').then((m) => ({ default: m.ShareModal })))
const AttachmentsPanel = lazy(() => import('./AttachmentsPanel').then((m) => ({ default: m.AttachmentsPanel })))
const LockModal = lazy(() => import('./LockModal').then((m) => ({ default: m.LockModal })))
const StatsDashboard = lazy(() => import('./StatsDashboard').then((m) => ({ default: m.StatsDashboard })))
const MindMap = lazy(() => import('./MindMap').then((m) => ({ default: m.MindMap })))
const MacrosModal = lazy(() => import('./MacrosModal').then((m) => ({ default: m.MacrosModal })))
const DiffModal = lazy(() => import('./DiffModal').then((m) => ({ default: m.DiffModal })))

// 모달 lazy load 중 skeleton

/**
 * JustANotepad v2 — Phase 9 통합.
 */
export function Editor() {
  const { fileHandle, setFileHandle, setSavedAt, setEditor } = useDocStore()
  const { currentId, current, updateCurrent } = useMemosStore()
  const applyTheme = useThemeStore((s) => s.apply)
  const collab = useCollab()
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
  const [showAbout, setShowAbout] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [showMd, setShowMd] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showAtt, setShowAtt] = useState(false)
  const [showLock, setShowLock] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showMindMap, setShowMindMap] = useState(false)
  const [showMacros, setShowMacros] = useState(false)
  const [showDiff, setShowDiff] = useState(false)

  const initialContent = memo?.content || '<p></p>'
  const title = memo?.title || '새 메모'

  // 협업 활성 시 Collaboration extension 추가, 비활성 시 표준 모드.
  // editor 가 ydoc 변경에 따라 재구성 — collab.ydoc 을 deps 에.
  const editorExtensions = useMemo(() => {
    const base = [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        undoRedo: collab.ydoc ? false : undefined, // collab 모드에서는 Yjs history 사용
      }),
      Placeholder.configure({
        placeholder: '여기에 메모를 적어보세요... (/ 슬래시 명령, F1 단축키)',
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
      MathInline,
      Mermaid,
      MentionExt,
      Callout,
      Embed,
      LinkCard,
      TaskList,
      TaskItem.configure({ nested: true }),
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
    ]
    if (collab.ydoc && collab.provider) {
      base.push(
        Collaboration.configure({ document: collab.ydoc }) as any,
        CollaborationCursor.configure({ provider: collab.provider }) as any,
      )
    }
    return base
  }, [collab.ydoc, collab.provider])

  const editor = useEditor(
    {
      extensions: editorExtensions,
      content: collab.ydoc ? '' : initialContent,
      editorProps: {
        attributes: { class: 'ProseMirror', spellcheck: 'false' },
      },
      onUpdate: ({ editor }) => {
        const html = editor.getHTML()
        updateCurrent({ content: html })
      },
    },
    [editorExtensions]
  )

  useImageDropPaste(editor)
  useMacroExpansion(editor)
  useAutoSave(editor, title)
  // 5분 / 1KB 단위 자동 버전 스냅샷
  const takeSnapshot = useVersionsStore((s) => s.takeSnapshot)
  useEffect(() => {
    if (!editor || !memo) return
    const t = setInterval(() => {
      if (editor && memo) takeSnapshot(memo.id, memo.title, editor.getHTML())
    }, 60000)
    return () => clearInterval(t)
  }, [editor, memo?.id, takeSnapshot])

  useEffect(() => {
    if (editor) setEditor(editor)
    applyTheme()
    tauriSyncOnBoot().catch(() => {})
    trackEvent('app_boot')
  }, [editor, setEditor, applyTheme])

  useEffect(() => {
    if (!editor || !memo) return
    if (collab.ydoc) return // collab 모드에서는 ydoc 가 source of truth
    const cur = editor.getHTML()
    if (cur !== memo.content) {
      editor.commands.setContent(memo.content, { emitUpdate: false })
    }
    setTick((n) => n + 1)
  }, [currentId, editor, collab.ydoc])

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

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && !e.shiftKey && !e.altKey && e.key === '/') {
        e.preventDefault(); setShowAi(true); trackEvent('open_ai')
      } else if (ctrl && !e.shiftKey && !e.altKey && e.key === ',') {
        e.preventDefault(); setShowSettings(true); trackEvent('open_settings')
      } else if (ctrl && e.altKey && !e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault(); setShowPrint(true); trackEvent('open_preview')
      } else if (ctrl && e.shiftKey && !e.altKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault(); setShowSearch(true); trackEvent('open_search')
      } else if (e.key === 'F1' || (ctrl && e.shiftKey && e.key === '?')) {
        e.preventDefault(); setShowHelp(true); trackEvent('open_help')
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
      trackEvent('save_file')
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
    trackEvent('open_file')
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
        onAbout={() => setShowAbout(true)}
        onVersions={() => setShowVersions(true)}
        onMdPreview={() => setShowMd(true)}
        onShare={() => setShowShare(true)}
        onAtt={() => setShowAtt(true)}
        onLock={() => setShowLock(true)}
        onStats={() => setShowStats(true)}
        onMindMap={() => setShowMindMap(true)}
        onMacros={() => setShowMacros(true)}
        onDiff={() => setShowDiff(true)}
        onToggleOutline={() => setShowOutline((v) => !v)}
        outlineOpen={showOutline}
      />
      <TagsBar />
      <div className={'jan-editor-main' + (showOutline ? ' has-outline' : '')}>
        {showOutline && <OutlinePanel editor={editor} />}
        <div className="jan-editor-pages">
          <EditorContent editor={editor} />
        </div>
      </div>
      <StatusBar editor={editor} />
      <CommandPalette editor={editor} />
      <SlashMenu editor={editor} />
      <TableMenu editor={editor} />
      <Suspense fallback={<ModalSkeleton />}>
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
        {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
        {showVersions && <VersionsPanel onClose={() => setShowVersions(false)} />}
        {showMd && <MarkdownPreview editor={editor} onClose={() => setShowMd(false)} />}
        {showShare && <ShareModal onClose={() => setShowShare(false)} />}
        {showAtt && <AttachmentsPanel editor={editor} onClose={() => setShowAtt(false)} />}
        {showLock && <LockModal editor={editor} onClose={() => setShowLock(false)} />}
        {showStats && <StatsDashboard onClose={() => setShowStats(false)} />}
        {showMindMap && <MindMap editor={editor} onClose={() => setShowMindMap(false)} />}
        {showMacros && <MacrosModal onClose={() => setShowMacros(false)} />}
        {showDiff && <DiffModal onClose={() => setShowDiff(false)} />}
      </Suspense>
    </div>
  )
}
