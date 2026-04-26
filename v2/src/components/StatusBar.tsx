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
  const [dirty, setDirty] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!memo || !savedAt) { setDirty(false); return }
    setDirty(memo.updatedAt > savedAt)
  }, [memo?.updatedAt, savedAt])

  // selection 변경 시 재렌더
  useEffect(() => {
    if (!editor) return
    const fn = () => setTick((t) => t + 1)
    editor.on('selectionUpdate', fn)
    return () => { editor.off('selectionUpdate', fn) }
  }, [editor])

  if (!editor) return null

  const sel = editor.state.selection
  const hasSel = !sel.empty
  const allText = editor.state.doc.textContent
  const chars = allText.length
  const words = allText.split(/\s+/).filter(Boolean).length
  const lines = (editor.getHTML().match(/<p|<h[1-6]|<li/g) || []).length

  let selChars = 0, selWords = 0
  if (hasSel) {
    const selText = editor.state.doc.textBetween(sel.from, sel.to, ' ')
    selChars = selText.length
    selWords = selText.split(/\s+/).filter(Boolean).length
  }

  let saveLabel: string, saveClass = 'jan-save-badge'
  if (!savedAt) { saveLabel = '저장 안 됨'; saveClass += ' is-unsaved' }
  else if (dirty) { saveLabel = '수정됨'; saveClass += ' is-dirty' }
  else { saveLabel = `저장: ${new Date(savedAt).toLocaleTimeString()}`; saveClass += ' is-saved' }

  const goalPct = goal.dailyTarget > 0 ? Math.min(100, Math.round((goal.todayCount / goal.dailyTarget) * 100)) : 0

  // tick 사용 (선언만 — render trigger 용)
  void tick

  return (
    <div className="jan-statusbar">
      <span>{chars}자</span>
      <span className="divider" />
      <span>{words}단어</span>
      <span className="divider" />
      <span>{lines}단락</span>
      {hasSel && (
        <>
          <span className="divider" />
          <span style={{ color: '#D97757' }}>선택 {selChars}자/{selWords}단어</span>
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
