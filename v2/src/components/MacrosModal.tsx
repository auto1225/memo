import { useState } from 'react'
import { useMacrosStore } from '../store/macrosStore'

interface MacrosModalProps {
  onClose: () => void
}

/**
 * Phase 13 — 매크로 편집 UI.
 * 사용자가 자동완성 매크로 추가/수정/삭제.
 */
export function MacrosModal({ onClose }: MacrosModalProps) {
  const { macros, add, remove } = useMacrosStore()
  const [trigger, setTrigger] = useState('')
  const [expansion, setExpansion] = useState('')
  const [desc, setDesc] = useState('')

  function commit() {
    if (!trigger.trim() || !expansion) return
    const t = trigger.trim().startsWith(';') ? trigger.trim() : ';' + trigger.trim()
    add({ trigger: t, expansion, description: desc || undefined })
    setTrigger(''); setExpansion(''); setDesc('')
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-macros-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>매크로 ({macros.length})</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <div className="jan-settings-info">
            본문에 trigger 를 입력하면 즉시 expansion 으로 치환됩니다.
            변수: <code>{'{{date}}'}</code> <code>{'{{time}}'}</code> <code>{'{{datetime}}'}</code> <code>{'{{user}}'}</code>
          </div>

          <div className="jan-macros-form">
            <input
              placeholder="trigger (예: ;hi)"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              style={{ width: 140 }}
            />
            <input
              placeholder="expansion (예: 안녕하세요!)"
              value={expansion}
              onChange={(e) => setExpansion(e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              placeholder="설명 (선택)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              style={{ width: 160 }}
            />
            <button className="primary" onClick={commit}>추가</button>
          </div>

          <ul className="jan-macros-list">
            {macros.map((m) => (
              <li key={m.trigger}>
                <code className="jan-macros-trigger">{m.trigger}</code>
                <code className="jan-macros-expansion">{m.expansion.length > 60 ? m.expansion.slice(0, 60) + '...' : m.expansion}</code>
                <span className="jan-macros-desc">{m.description || ''}</span>
                <button onClick={() => remove(m.trigger)}>×</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
