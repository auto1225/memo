import type { Editor } from '@tiptap/react'
import { useEffect, useState } from 'react'
import { useDocStore } from '../store/docStore'
import { useMemosStore } from '../store/memosStore'
import { useCollab } from '../hooks/useCollab'
import { useWritingGoalStore } from '../store/writingGoalStore'
import { useUIStore } from '../store/uiStore'
import { PomodoroWidget } from './PomodoroWidget'

interface StatusBarProps {
  editor: Editor | null
}

interface TextStats {
  chars: number
  words: number
  blocks: number
}

const EMPTY_STATS: TextStats = { chars: 0, words: 0, blocks: 0 }

/**
 * Phase 17 — 강화된 StatusBar.
 * 글자/단어/단락 + 선택 영역 통계 + 저장 인디케이터 + 협업 + 줌 + 일일 목표 + 뽀모도로.
 */
export function StatusBar({ editor }: StatusBarProps) {
  const { savedAt } = useDocStore()
  const memo = useMemosStore((s) => s.current())
  const collab = useCollab()
  const goal = useWritingGoalStore()
  const zoom = useUIStore((s) => s.zoom)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!editor) return
    const fn = () => setTick((t) => t + 1)
    editor.on('selectionUpdate', fn)
    editor.on('update', fn)
    return () => {
      editor.off('selectionUpdate', fn)
      editor.off('update', fn)
    }
  }, [editor])

  const docStats = editor ? getDocumentStats(editor) : EMPTY_STATS
  const selectionStats = editor ? getSelectionStats(editor) : EMPTY_STATS
  const dirty = !!memo && !!savedAt && memo.updatedAt > savedAt

  if (!editor) return null

  const sel = editor.state.selection
  const hasSel = !sel.empty
  void tick

  let saveLabel: string, saveClass = 'jan-save-badge'
  if (!savedAt) { saveLabel = '저장 안 됨'; saveClass += ' is-unsaved' }
  else if (dirty) { saveLabel = '수정됨'; saveClass += ' is-dirty' }
  else { saveLabel = `저장: ${new Date(savedAt).toLocaleTimeString()}`; saveClass += ' is-saved' }

  const goalPct = goal.dailyTarget > 0 ? Math.min(100, Math.round((goal.todayCount / goal.dailyTarget) * 100)) : 0

  return (
    <div className="jan-statusbar">
      <span>{docStats.chars}자</span>
      <span className="divider" />
      <span>{docStats.words}단어</span>
      <span className="divider" />
      <span>{docStats.blocks}단락</span>
      {hasSel && (
        <>
          <span className="divider" />
          <span style={{ color: '#D97757' }}>선택 {selectionStats.chars}자/{selectionStats.words}단어</span>
        </>
      )}
      <span className="divider" />
      <span className={saveClass}>{saveLabel}</span>
      {zoom !== 1 && (
        <>
          <span className="divider" />
          <span title="Ctrl+휠 또는 Ctrl+0 으로 100%">{Math.round(zoom * 100)}%</span>
        </>
      )}
      {goal.dailyTarget > 0 && (
        <>
          <span className="divider" />
          <span title={`오늘 ${goal.todayCount} / 목표 ${goal.dailyTarget}자`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 60, height: 6, background: '#eee', borderRadius: 3, overflow: 'hidden' }}>
              <span style={{ display: 'block', width: goalPct + '%', height: '100%', background: goalPct >= 100 ? '#4CAF50' : '#D97757', transition: 'width 0.3s' }} />
            </span>
            {goalPct}%
          </span>
        </>
      )}
      {collab.status !== 'disconnected' && (
        <>
          <span className="divider" />
          <span className={'jan-collab-badge is-' + collab.status}>
            {collab.status === 'connected' ? `협업 ${collab.peers}명` : '연결 중...'}
          </span>
        </>
      )}
      <PomodoroWidget />
      <span className="flex-spacer" />
      <span className="hint">Ctrl+S · Ctrl+K 링크 · Ctrl+Shift+P · F1</span>
    </div>
  )
}

function getDocumentStats(editor: Editor): TextStats {
  const stats: TextStats = { chars: 0, words: 0, blocks: 0 }
  editor.state.doc.descendants((node) => {
    if (node.isText) {
      const text = node.text || ''
      stats.chars += text.length
      stats.words += countWords(text)
    } else if (node.type.name === 'paragraph' || node.type.name === 'heading' || node.type.name === 'listItem' || node.type.name === 'taskItem') {
      stats.blocks += 1
    }
  })
  return stats
}

function getSelectionStats(editor: Editor): TextStats {
  const selection = editor.state.selection
  if (selection.empty) return EMPTY_STATS
  const text = editor.state.doc.textBetween(selection.from, selection.to, ' ')
  return {
    chars: text.length,
    words: countWords(text),
    blocks: 0,
  }
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}
