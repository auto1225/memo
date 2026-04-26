import type { Editor } from '@tiptap/react'

export function installWordKeymap(editor: Editor, opts: {
  onSave?: () => void
  onOpen?: () => void
  onPrint?: () => void
}) {
  const handler = (e: KeyboardEvent) => {
    if (e.isComposing || e.keyCode === 229) return
    const ctrl = e.ctrlKey || e.metaKey
    const shift = e.shiftKey
    const alt = e.altKey
    const k = e.key.toLowerCase()

    if (ctrl && !shift && !alt && k === 's') { e.preventDefault(); opts.onSave?.(); return }
    if (ctrl && !shift && !alt && k === 'o') { e.preventDefault(); opts.onOpen?.(); return }
    if (ctrl && !shift && !alt && k === 'p') { e.preventDefault(); opts.onPrint?.(); return }
    if (ctrl && !shift && !alt && k === 'k') { e.preventDefault(); insertLink(editor); return }
    if (ctrl && !shift && !alt && k === 'l') { e.preventDefault(); editor.chain().focus().setTextAlign('left').run(); return }
    if (ctrl && !shift && !alt && k === 'e') { e.preventDefault(); editor.chain().focus().setTextAlign('center').run(); return }
    if (ctrl && !shift && !alt && k === 'r') { e.preventDefault(); editor.chain().focus().setTextAlign('right').run(); return }
    if (ctrl && !shift && !alt && k === 'j') { e.preventDefault(); editor.chain().focus().setTextAlign('justify').run(); return }
    if (ctrl && !shift && !alt && k === 'm') { e.preventDefault(); editor.chain().focus().sinkListItem('listItem').run(); return }
    if (ctrl && shift && !alt && k === 'm') { e.preventDefault(); editor.chain().focus().liftListItem('listItem').run(); return }
    if (ctrl && shift && !alt && k === 'l') { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); return }
    if (ctrl && !shift && !alt && k === ' ') { e.preventDefault(); editor.chain().focus().unsetAllMarks().clearNodes().run(); return }
    if (!ctrl && shift && !alt && k === 'f3') { e.preventDefault(); toggleSelectionCase(editor); return }
    if (ctrl && alt && !shift && (k === '1' || k === '2' || k === '3')) {
      e.preventDefault()
      const level = parseInt(k, 10) as 1 | 2 | 3
      editor.chain().focus().toggleHeading({ level }).run()
      return
    }
    if (ctrl && shift && !alt && k === 'n') { e.preventDefault(); editor.chain().focus().setParagraph().run(); return }
    if (ctrl && !shift && !alt && k === 'enter') {
      e.preventDefault()
      editor.chain().focus().insertContent('<div style="page-break-before:always;break-before:page;height:0;"></div><p></p>').run()
      return
    }
    if (ctrl && alt && !shift && k === 'f') {
      e.preventDefault()
      insertFootnote(editor)
      return
    }
  }

  document.addEventListener('keydown', handler, true)
  return () => document.removeEventListener('keydown', handler, true)
}

function insertLink(editor: Editor) {
  const previous = editor.getAttributes('link').href as string | undefined
  const selected = editor.state.selection.empty ? '' : editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ')
  const input = window.prompt('링크 URL:', previous || 'https://')
  if (input === null) return
  const href = input.trim()
  if (!href || href === 'https://') {
    editor.chain().focus().unsetLink().run()
    return
  }
  const label = selected || href
  if (selected) {
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
  } else {
    editor.chain().focus().insertContent(`<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`).run()
  }
}

function toggleSelectionCase(editor: Editor) {
  const { from, to, empty } = editor.state.selection
  if (empty) return
  const text = editor.state.doc.textBetween(from, to)
  if (!text) return
  const next = nextCase(text)
  editor.chain().focus().insertContentAt({ from, to }, next).setTextSelection({ from, to: from + next.length }).run()
}

function nextCase(text: string): string {
  const hasLetters = /[A-Za-z가-힣]/.test(text)
  if (!hasLetters) return text
  if (text === text.toUpperCase() && text !== text.toLowerCase()) return text.toLowerCase()
  if (text === text.toLowerCase() && text !== text.toUpperCase()) {
    return text.replace(/\b([A-Za-z])([A-Za-z]*)/g, (_, first: string, rest: string) => first.toUpperCase() + rest.toLowerCase())
  }
  return text.toUpperCase()
}

function insertFootnote(editor: Editor) {
  const count = document.querySelectorAll('.paper-fn-ref').length + 1
  editor.chain().focus().insertContent(`<sup class="paper-fn-ref">[${count}]</sup>`).run()
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;')
}
