import { useState } from 'react'
import { listPostits, addPostit, removePostit, openPostitWindow, type Postit } from '../lib/justpin'

interface PostitPanelProps {
  onClose: () => void
}

const COLORS = ['#FFEB3B', '#FFC1A6', '#A6E3FF', '#C8E6C9', '#E1BEE7', '#FFCDD2']

/**
 * Phase 5 — JustPin 포스트잇 매니저.
 * Top-bar 카드 그리드 + 새 포스트잇 + 클릭하면 별도 창에서 편집.
 */
export function PostitPanel({ onClose }: PostitPanelProps) {
  const [items, setItems] = useState<Postit[]>(listPostits())
  const [text, setText] = useState('')
  const [color, setColor] = useState(COLORS[0])

  function refresh() {
    setItems(listPostits())
  }

  function create() {
    if (!text.trim()) return
    const p = addPostit(text.trim(), color)
    setText('')
    refresh()
    openPostitWindow(p)
  }

  function del(id: string) {
    removePostit(id)
    refresh()
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-postit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>JustPin 포스트잇</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <div className="jan-postit-create">
            <textarea
              placeholder="새 포스트잇 내용..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
            />
            <div className="jan-postit-colors">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={'jan-postit-color' + (c === color ? ' is-active' : '')}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  title="색상 선택"
                />
              ))}
            </div>
            <button className="jan-postit-add" onClick={create}>새 포스트잇 (별도 창)</button>
          </div>

          <div className="jan-postit-grid">
            {items.length === 0 && <div className="jan-postit-empty">포스트잇이 없습니다.</div>}
            {items.map((p) => (
              <div key={p.id} className="jan-postit-card" style={{ background: p.color }}>
                <div className="jan-postit-text">{p.text.slice(0, 120) || '(빈 메모)'}</div>
                <div className="jan-postit-actions">
                  <button onClick={() => openPostitWindow(p)}>열기</button>
                  <button onClick={() => del(p.id)}>삭제</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
