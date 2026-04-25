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
import { ImageWithWidth as Image } from '../extensions/ImageWithWidth'
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
// import { useMacroExpansion } from '../hooks/useMacroExpansion'
import { LinkCard } from '../extensions/LinkCard'
import { AudioNode, VideoNode } from '../extensions/Media'
import Highlight from '@tiptap/extension-highlight'
import { useTypographyStore } from '../store/typographyStore'
// import { useAiAutocomplete } from '../hooks/useAiAutocomplete'
import { useSettingsStore } from '../store/settingsStore'
import { dispatchWebhook } from '../lib/webhooks'
import { BubbleToolbar } from './BubbleToolbar'
import { ImageMenu } from './ImageMenu'
import { Lightbox } from './Lightbox'
// import { useHeadingAnchors } from '../hooks/useHeadingAnchors'
// import { useFormatPainter } from '../hooks/useFormatPainter'
// import { useCursorMemory } from '../hooks/useCursorMemory'
import { useWheelZoom } from '../hooks/useWheelZoom'
// useWritingGoalStore moved to inline call in onUpdate via dynamic import
import { useWritingGoalStore } from '../store/writingGoalStore'
import { SmartTypography } from '../extensions/Typography'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
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
const OcrModal = lazy(() => import('./OcrModal').then((m) => ({ default: m.OcrModal })))
const SnippetsModal = lazy(() => import('./SnippetsModal').then((m) => ({ default: m.SnippetsModal })))
const LinkCheckModal = lazy(() => import('./LinkCheckModal').then((m) => ({ default: m.LinkCheckModal })))
const AiChatPanel = lazy(() => import('./AiChatPanel').then((m) => ({ default: m.AiChatPanel })))
const FindReplaceBar = lazy(() => import('./FindReplaceBar').then((m) => ({ default: m.FindReplaceBar })))
const TypographyModal = lazy(() => import('./TypographyModal').then((m) => ({ default: m.TypographyModal })))
const InfoPanel = lazy(() => import('./InfoPanel').then((m) => ({ default: m.InfoPanel })))
const ActivityHeatmap = lazy(() => import('./ActivityHeatmap').then((m) => ({ default: m.ActivityHeatmap })))
const QuickCapture = lazy(() => import('./QuickCapture').then((m) => ({ default: m.QuickCapture })))
const TranslateModal = lazy(() => import('./TranslateModal').then((m) => ({ default: m.TranslateModal })))
const TemplatesModal = lazy(() => import('./TemplatesModal').then((m) => ({ default: m.TemplatesModal })))
const GistModal = lazy(() => import('./GistModal').then((m) => ({ default: m.GistModal })))

// 모달 lazy load 중 skeleton

/**
 * JustANotepad v2 — Phase 9 통합.
 */
export function Editor() {
  const { fileHandle, setFileHandle, setSavedAt, setEditor } = useDocStore()
  const { currentId, current, updateCurrent } = useMemosStore()
  const applyTheme = useThemeStore((s) => s.apply)
  const applyTypo = useTypographyStore((s) => s.apply)
  const aiAuto = useSettingsStore((s) => s.aiAutocomplete); void aiAuto
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
  const [showOcr, setShowOcr] = useState(false)
  const [showSnippets, setShowSnippets] = useState(false)
  const [showLinkCheck, setShowLinkCheck] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showFind, setShowFind] = useState(false)
  const [showTypo, setShowTypo] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [showQuick, setShowQuick] = useState(false)
  const [showTranslate, setShowTranslate] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showGist, setShowGist] = useState(false)

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
      AudioNode,
      VideoNode,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      SmartTypography,
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
      onUpdate: ({ editor, transaction }) => {
        const html = editor.getHTML()
        updateCurrent({ content: html })
        let inserted = 0
        transaction.steps.forEach((step: any) => {
          if (step.slice && step.slice.size > 0) inserted += step.slice.size
        })
        if (inserted > 0) useWritingGoalStore.getState().addChars(inserted)
      },
    },
    [editorExtensions]
  )

  useImageDropPaste(editor)
  // useMacroExpansion(editor) // disabled for debugging
  // useAiAutocomplete(editor, aiAuto) // disabled
  // useHeadingAnchors(editor) // disabled
  // useFormatPainter(editor) // disabled
  // useCursorMemory(editor, currentId) // disabled
  useWheelZoom()
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
    applyTypo()
    tauriSyncOnBoot().catch(() => {})
    trackEvent('app_boot')
  }, [editor, setEditor, applyTheme, applyTypo])

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
      } else if (ctrl && e.shiftKey && !e.altKey && (e.key === 'J' || e.key === 'j')) {
        e.preventDefault(); setShowQuick(true)
      } else if (ctrl && !e.shiftKey && !e.altKey && (e.key === 'H' || e.key === 'h')) {
        e.preventDefault(); setShowFind(true)
      } else if (ctrl && !e.shiftKey && !e.altKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault()
        const pinned = useMemosStore.getState().list().filter((m) => m.pinned)
        const idx = parseInt(e.key, 10) - 1
        if (pinned[idx]) useMemosStore.getState().setCurrent(pinned[idx].id)
      } else if (e.key === 'F3' && !e.shiftKey) {
        e.preventDefault(); setShowFind(true)
      } else if (ctrl && !e.shiftKey && !e.altKey && e.key === 'Enter') {
        // 강제 페이지 분할
        e.preventDefault()
        if (editor) editor.chain().focus().insertContent('<div style="page-break-before:always;break-before:page;height:0;"></div><p></p>').run()
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
      // Phase 15 — webhook
      if (memo) dispatchWebhook({ type: 'memo-saved', memoId: memo.id, title: memo.title, charCount: editor.state.doc.textContent.length }).catch(() => {})
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
        onOcr={() => setShowOcr(true)}
        onSnippets={() => setShowSnippets(true)}
        onLinkCheck={() => setShowLinkCheck(true)}
        onChat={() => setShowChat(true)}
        onFind={() => setShowFind(true)}
        onTypo={() => setShowTypo(true)}
        onInfo={() => setShowInfo(true)}
        onHeatmap={() => setShowHeatmap(true)}
        onQuick={() => setShowQuick(true)}
        onTranslate={() => setShowTranslate(true)}
        onTemplates={() => setShowTemplates(true)}
        onGist={() => setShowGist(true)}
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
      <BubbleToolbar editor={editor} />
      <ImageMenu editor={editor} />
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
        {showOcr && <OcrModal editor={editor} onClose={() => setShowOcr(false)} />}
        {showSnippets && <SnippetsModal editor={editor} onClose={() => setShowSnippets(false)} />}
        {showLinkCheck && <LinkCheckModal editor={editor} onClose={() => setShowLinkCheck(false)} />}
        {showChat && <AiChatPanel editor={editor} onClose={() => setShowChat(false)} />}
        {showFind && <FindReplaceBar editor={editor} onClose={() => setShowFind(false)} />}
        {showTypo && <TypographyModal onClose={() => setShowTypo(false)} />}
        {showInfo && <InfoPanel editor={editor} onClose={() => setShowInfo(false)} />}
        {showHeatmap && <ActivityHeatmap onClose={() => setShowHeatmap(false)} />}
        {showQuick && <QuickCapture onClose={() => setShowQuick(false)} />}
        {showTranslate && <TranslateModal editor={editor} onClose={() => setShowTranslate(false)} />}
        {showTemplates && <TemplatesModal onClose={() => setShowTemplates(false)} />}
        {showGist && <GistModal editor={editor} onClose={() => setShowGist(false)} />}
      </Suspense>
      <Lightbox />
    </div>
  )
}
