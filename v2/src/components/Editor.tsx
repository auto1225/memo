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
import { useDocStore } from '../store/docStore'
import { useMemosStore } from '../store/memosStore'
import { saveToFile, openFile } from '../lib/fileOps'
import { installWordKeymap } from '../lib/keymap'

export function Editor() {
  const { fileHandle, setFileHandle, setSavedAt, setEditor } = useDocStore()
  const { currentId, current, updateCurrent } = useMemosStore()
  const memo = current()
  const [, setTick] = useState(0)

  const initialContent = memo?.content || '<p></p>'
  const title = memo?.title || '새 메모'

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
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
      attributes: { class: 'ProseMirror', spellcheck: 'false' },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      updateCurrent({ content: html })
    },
  })

  useEffect(() => {
    if (editor) setEditor(editor)
  }, [editor, setEditor])

  useEffect(() => {
    if (!editor || !memo) return
    const cur = editor.getHTML()
    if (cur !== memo.content) {
      editor.commands.setContent(memo.content)
    }
    setTick((n) => n + 1)
  }, [currentId, editor])

  useEffect(() => {
    if (!editor) return
    const detach = installWordKeymap(editor, {
      onSave: handleSave,
      onOpen: handleOpen,
      onPrint: () => window.print(),
    })
    return detach
  }, [editor, fileHandle])

  async function handleSave() {
    if (!editor) return
    const html = editor.getHTML()
    const result = await saveToFile({ title, content: html, handle: fileHandle })
    if (result.ok) {
      setSavedAt(Date.now())
      if (result.handle) setFileHandle(result.handle)
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
      />
      <div className="jan-editor-pages">
        <EditorContent editor={editor} />
      </div>
      <StatusBar editor={editor} />
      <CommandPalette editor={editor} />
    </div>
  )
}
