import { useEffect, useState, useMemo } from 'react'
import type { Editor } from '@tiptap/react'
import { useMemosStore } from '../store/memosStore'

interface Command {
  id: string
  label: string
  hint?: string
  run: () => void
}

interface CommandPaletteProps {
  editor: Editor | null
}

export function CommandPalette({ editor }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const { newMemo } = useMemosStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      if ((ctrl && e.shiftKey && e.key.toLowerCase() === 'p') ||
          (ctrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k')) {
        e.preventDefault()
        setOpen((v) => !v)
        setQuery('')
        setSelected(0)
        return
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        setOpen(false)
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [open])

  const commands: Command[] = useMemo(() => {
    if (!editor) return []
    return [
      { id: 'new', label: '새 메모', hint: 'Ctrl+N', run: () => newMemo() },
      { id: 'print', label: '인쇄', hint: 'Ctrl+P', run: () => window.print() },
      { id: 'bold', label: '굵게', hint: 'Ctrl+B', run: () => editor.chain().focus().toggleBold().run() },
      { id: 'italic', label: '기울임', hint: 'Ctrl+I', run: () => editor.chain().focus().toggleItalic().run() },
      { id: 'underline', label: '밑줄', hint: 'Ctrl+U', run: () => editor.chain().focus().toggleUnderline().run() },
      { id: 'strike', label: '취소선', run: () => editor.chain().focus().toggleStrike().run() },
      { id: 'h1', label: '제목 1', hint: 'Ctrl+Alt+1', run: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
      { id: 'h2', label: '제목 2', hint: 'Ctrl+Alt+2', run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
      { id: 'h3', label: '제목 3', hint: 'Ctrl+Alt+3', run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
      { id: 'p', label: '일반 문단', hint: 'Ctrl+Shift+N', run: () => editor.chain().focus().setParagraph().run() },
      { id: 'left', label: '왼쪽 정렬', hint: 'Ctrl+L', run: () => editor.chain().focus().setTextAlign('left').run() },
      { id: 'center', label: '가운데 정렬', hint: 'Ctrl+E', run: () => editor.chain().focus().setTextAlign('center').run() },
      { id: 'right', label: '오른쪽 정렬', hint: 'Ctrl+R', run: () => editor.chain().focus().setTextAlign('right').run() },
      { id: 'justify', label: '양쪽 정렬', hint: 'Ctrl+J', run: () => editor.chain().focus().setTextAlign('justify').run() },
      { id: 'ul', label: '글머리 기호 목록', run: () => editor.chain().focus().toggleBulletList().run() },
      { id: 'ol', label: '번호 매기기 목록', run: () => editor.chain().focus().toggleOrderedList().run() },
      { id: 'quote', label: '인용', run: () => editor.chain().focus().toggleBlockquote().run() },
      { id: 'code', label: '코드 블록', run: () => editor.chain().focus().toggleCodeBlock().run() },
      { id: 'table', label: '표 삽입', run: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
      { id: 'image', label: '이미지 삽입', run: () => {
        const url = window.prompt('이미지 URL:')
        if (url) editor.chain().focus().setImage({ src: url }).run()
      }},
      { id: 'link', label: '링크 삽입', run: () => {
        const url = window.prompt('링크 URL:')
        if (url) editor.chain().focus().setLink({ href: url }).run()
      }},
      { id: 'undo', label: '실행 취소', hint: 'Ctrl+Z', run: () => editor.chain().focus().undo().run() },
      { id: 'redo', label: '다시 실행', hint: 'Ctrl+Shift+Z', run: () => editor.chain().focus().redo().run() },
      { id: 'pilcrow', label: '엔터 표시 켬/끔', run: () => {
        document.body.classList.toggle('jan-show-pilcrow')
        try { localStorage.setItem('jan-show-pilcrow', document.body.classList.contains('jan-show-pilcrow') ? '1' : '0') } catch {}
      }},
    ]
  }, [editor, newMemo])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.id.includes(q))
  }, [query, commands])

  useEffect(() => { setSelected(0) }, [query])

  if (!open) return null

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = filtered[selected]
      if (cmd) { cmd.run(); setOpen(false); setQuery('') }
    }
  }

  return (
    <div className="jan-cp-overlay" onClick={() => setOpen(false)}>
      <div className="jan-cp" onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          className="jan-cp-input"
          autoFocus
          placeholder="명령 검색... (Ctrl+K 또는 Ctrl+Shift+P)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <ul className="jan-cp-list">
          {filtered.length === 0 && <li className="jan-cp-empty">검색 결과 없음</li>}
          {filtered.map((cmd, i) => (
            <li
              key={cmd.id}
              className={'jan-cp-item' + (i === selected ? ' is-selected' : '')}
              onClick={() => { cmd.run(); setOpen(false); setQuery('') }}
              onMouseEnter={() => setSelected(i)}
            >
              <span className="jan-cp-label">{cmd.label}</span>
              {cmd.hint && <span className="jan-cp-hint">{cmd.hint}</span>}
            </li>
          ))}
        </ul>
        <div className="jan-cp-footer">
          위/아래 이동 · Enter 실행 · Esc 닫기
        </div>
      </div>
    </div>
  )
}
