import type { Editor } from '@tiptap/react'
import { useEffect, useState } from 'react'
import { useDocStore } from '../store/docStore'
import { useMemosStore } from '../store/memosStore'
import { useCollab } from '../hooks/useCollab'

interface StatusBarProps {
  editor: Editor | null
}

/**
 * Phase 9 — 강화된 StatusBar.
 * 글자 수 + 단어 수 + 저장 인디케이터 (저장됨/수정중/저장중) + 협업 상태.
 */
export function StatusBar({ editor }: StatusBarProps) {
  const { savedAt } = useDocStore()
  const memo = useMemosStore((s) => s.current())
  const collab = useCollab()
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!memo || !savedAt) {
      setDirty(false)
      return
    }
    setDirty(memo.updatedAt > savedAt)
  }, [memo?.updatedAt, savedAt])

  if (!editor) return null

  const chars = editor.state.doc.textContent.length
  const words = editor.state.doc.textContent.split(/\s+/).filter(Boolean).length
  const lines = (editor.getHTML().match(/<p|<h[1-6]|<li/g) || []).length

  let saveLabel: string
  let saveClass = 'jan-save-badge'
  if (!savedAt) {
    saveLabel = '저장 안 됨'
    saveClass += ' is-unsaved'
  } else if (dirty) {
    saveLabel = '수정됨'
    saveClass += ' is-dirty'
  } else {
    saveLabel = `저장: ${new Date(savedAt).toLocaleTimeString()}`
    saveClass += ' is-saved'
  }

  return (
    <div className="jan-statusbar">
      <span>{chars}자</span>
      <span className="divider" />
      <span>{words} 단어</span>
      <span className="divider" />
      <span>{lines} 단락</span>
      <span className="divider" />
      <span className={saveClass}>{saveLabel}</span>
      {collab.status !== 'disconnected' && (
        <>
          <span className="divider" />
          <span className={'jan-collab-badge is-' + collab.status}>
            {collab.status === 'connected' ? `협업 ${collab.peers}명` : '연결 중...'}
          </span>
        </>
      )}
      <span className="flex-spacer" />
      <span className="hint">Ctrl+S · Ctrl+/ · Ctrl+K · F1</span>
    </div>
  )
}
