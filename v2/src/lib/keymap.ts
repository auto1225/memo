import type { Editor } from '@tiptap/react'

export function installWordKeymap(editor: Editor, opts: {
  onSave?: () => void
  onOpen?: () => void
  onPrint?: () => void
}) {
  const handler = (e: KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey
    const shift = e.shiftKey
    const alt = e.altKey
    const k = e.key.toLowerCase()

    if (ctrl && !shift && !alt && k === 's') { e.preventDefault(); opts.onSave?.(); return }
    if (ctrl && !shift && !alt && k === 'o') { e.preventDefault(); opts.onOpen?.(); return }
    if (ctrl && !shift && !alt && k === 'p') { e.preventDefault(); opts.onPrint?.(); return }
    if (ctrl && !shift && !alt && k === 'l') { e.preventDefault(); editor.chain().focus().setTextAlign('left').run(); return }
    if (ctrl && !shift && !alt && k === 'e') { e.preventDefault(); editor.chain().focus().setTextAlign('center').run(); return }
    if (ctrl && !shift && !alt && k === 'r') { e.preventDefault(); editor.chain().focus().setTextAlign('right').run(); return }
    if (ctrl && !shift && !alt && k === 'j') { e.preventDefault(); editor.chain().focus().setTextAlign('justify').run(); return }
    if (ctrl && alt && !shift && (k === '1' || k === '2' || k === '3')) {
      e.preventDefault()
      const level = parseInt(k, 10) as 1 | 2 | 3
      editor.chain().focus().toggleHeading({ level }).run()
      return
    }
    if (ctrl && shift && !alt && k === 'n') { e.preventDefault(); editor.chain().focus().setParagraph().run(); return }
  }

  document.addEventListener('keydown', handler, true)
  return () => document.removeEventListener('keydown', handler, true)
}
