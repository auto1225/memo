import type { Editor } from '@tiptap/react'
import { useDocStore } from '../store/docStore'

interface StatusBarProps {
  editor: Editor | null
}

export function StatusBar({ editor }: StatusBarProps) {
  const { savedAt } = useDocStore()

  if (!editor) return null

  const chars = editor.state.doc.textContent.length
  const words = editor.state.doc.textContent.split(/\s+/).filter(Boolean).length

  return (
    <div className="jan-statusbar">
      <span>{chars}자</span>
      <span className="divider" />
      <span>{words} 단어</span>
      <span className="divider" />
      <span>{savedAt ? `저장: ${new Date(savedAt).toLocaleTimeString()}` : '저장 안 됨'}</span>
      <span className="flex-spacer" />
      <span className="hint">Ctrl+S 저장 · Ctrl+O 열기 · Ctrl+P 인쇄</span>
    </div>
  )
}
