import { useEffect, useRef, useState } from 'react'
import { useMemosStore } from '../store/memosStore'

interface QuickCaptureProps {
  onClose: () => void
}

/**
 * Phase 16 — Quick Capture (Ctrl+Shift+J).
 * 어디서든 떠오르는 작은 메모 popup — 즉시 적고 새 메모로 저장.
 * 또는 현재 메모 끝에 "추가" 옵션.
 */
export function QuickCapture({ onClose }: QuickCaptureProps) {
  const memo = useMemosStore((s) => s.current())
  const updateCurrent = useMemosStore((s) => s.updateCurrent)
  const newMemo = useMemosStore((s) => s.newMemo)
  const setCurrent = useMemosStore((s) => s.setCurrent)
  const [text, setText] = useState('')
  const [target, setTarget] = useState<'new' | 'append'>('new')
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  function commit() {
    const t = text.trim()
    if (!t) {
      onClose()
      return
    }
    const html = htmlFromText(t)
    if (target === 'new') {
      const id = newMemo()
      const firstLine = t.split('\n')[0].slice(0, 60)
      // updateCurrent applies to currentId — 새 메모가 currentId 가 됨
      updateCurrent({ title: firstLine, content: html })
      setCurrent(id)
    } else if (memo) {
      const merged = (memo.content || '') + html
      updateCurrent({ content: merged })
    }
    onClose()
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      commit()
    }
  }

  return (
    <div className="jan-quick-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="jan-quick" onClick={(e) => e.stopPropagation()}>
        <div className="jan-quick-head">
          <span>Quick Capture</span>
          <span className="jan-quick-hint">Ctrl+Enter 저장 · Esc 취소</span>
        </div>
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="떠오르는 메모를 입력... 첫 줄이 제목"
          rows={6}
        />
        <div className="jan-quick-foot">
          <label>
            <input type="radio" checked={target === 'new'} onChange={() => setTarget('new')} /> 새 메모
          </label>
          <label>
            <input type="radio" checked={target === 'append'} onChange={() => setTarget('append')} disabled={!memo} /> 현재 메모 끝에 추가
          </label>
          <span className="flex-spacer" />
          <button onClick={commit} disabled={!text.trim()}>저장</button>
        </div>
      </div>
    </div>
  )
}

function htmlFromText(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
