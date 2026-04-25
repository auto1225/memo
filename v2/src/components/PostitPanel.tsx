import { useState, useEffect } from 'react'
import { listPostits, addPostit, removePostit, openPostitWindow, type Postit } from '../lib/justpin'

interface PostitPanelProps {
  onClose: () => void
}

const COLORS = ['#FFEB3B', '#FFC1A6', '#A6E3FF', '#C8E6C9', '#E1BEE7', '#FFCDD2']
const STORAGE_KEY = 'jan-v2-postits'

/**
 * Phase 5 — JustPin 포스트잇 매니저.
 * Top-bar 카드 그리드 + 새 포스트잇 + 클릭하면 별도 창에서 편집.
 * Storage 이벤트로 다른 창의 변경을 자동 반영.
 */
export function PostitPanel({ onClose }: PostitPanelProps) {
  const [items, setItems] = useState<Postit[]>(listPostits())
  const [text, setText] = useState('')
  const [color, setColor] = useState(COLORS[0])

  function refresh() {
    setItems(listPostits())
  }

  // 다른 창/탭에서 localStorage 변경 시 자동 새로고침
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) refresh()
    }
    window.addEventListener('storage', onStorage)
    // 폴링도 추가 (같은 origin 새 창은 storage 이벤트 발화 안 할 수 있음)
    const t = setInterval(refresh, 2000)
    return () => {
      window.removeEventListener('storage', onStorage)
      clearInterval(t)
    }
  }, [])

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
