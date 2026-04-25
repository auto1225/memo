import { useEffect, useState, lazy, Suspense } from 'react'
import { useMemosStore } from '../store/memosStore'

const TrashModal = lazy(() => import('./TrashModal').then((m) => ({ default: m.TrashModal })))

/**
 * Phase 10 — Sidebar 강화.
 * - 정렬 (recent / title / created)
 * - 핀 토글
 * - 메모 복제
 * - 휴지통 모달
 */
export function Sidebar() {
  const { newMemo, setCurrent, deleteMemo, currentId, list, sortMode, setSortMode, togglePin, duplicate, trashedList, purgeOldTrash, reorder } = useMemosStore()
  const memos = list()
  const [showTrash, setShowTrash] = useState(false)
  const trashCount = trashedList().length

  useEffect(() => {
    purgeOldTrash() // 부팅 시 30일 지난 휴지통 자동 정리
  }, [])

  return (
    <aside className="jan-sidebar">
      <div className="jan-sidebar-head">
        <button className="jan-sidebar-new" onClick={() => newMemo()}>+ 새 메모</button>
        <select
          className="jan-sidebar-sort"
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as any)}
          title="정렬 방식"
        >
          <option value="recent">최근 수정순</option>
          <option value="manual">수동 (드래그)</option>
          <option value="title">제목순</option>
          <option value="created">생성순</option>
        </select>
      </div>
      <ul className="jan-sidebar-list">
        {memos.length === 0 && (
          <li className="jan-sidebar-empty">메모가 없습니다.<br />위 버튼으로 만드세요.</li>
        )}
        {memos.map((m) => (
          <li
            key={m.id}
            className={'jan-sidebar-item' + (m.id === currentId ? ' is-active' : '') + (m.pinned ? ' is-pinned' : '')}
            onClick={() => setCurrent(m.id)}
            draggable={sortMode === 'manual'}
            onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', m.id) }}
            onDragOver={(e) => { if (sortMode === 'manual') e.preventDefault() }}
            onDrop={(e) => { e.preventDefault(); const fromId = e.dataTransfer.getData('text/plain'); if (fromId && fromId !== m.id) reorder(fromId, m.id) }}
          >
            <div className="jan-sidebar-row">
              <button
                className={'jan-sidebar-pin' + (m.pinned ? ' is-on' : '')}
                onClick={(e) => { e.stopPropagation(); togglePin(m.id) }}
                title={m.pinned ? '핀 해제' : '핀 고정'}
                aria-pressed={m.pinned}
              >
                {m.pinned ? '★' : '☆'}
              </button>
              <div className="jan-sidebar-title" title={m.title}>{m.title || '무제'}</div>
            </div>
            {m.preview && <div className="jan-sidebar-preview">{m.preview}</div>}
            <div className="jan-sidebar-meta">
              <span>{new Date(m.updatedAt).toLocaleDateString('ko-KR')}</span>
              <span className="flex-spacer" />
              <button
                className="jan-sidebar-act"
                onClick={(e) => { e.stopPropagation(); duplicate(m.id) }}
                title="복제"
              >
                ⎘
              </button>
              <button
                className="jan-sidebar-del"
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm(`"${m.title || '무제'}" 휴지통으로 이동?`)) deleteMemo(m.id)
                }}
                title="휴지통으로"
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="jan-sidebar-foot">
        <button className="jan-sidebar-trash" onClick={() => setShowTrash(true)}>
          휴지통 ({trashCount})
        </button>
      </div>
      <Suspense fallback={null}>
        {showTrash && <TrashModal onClose={() => setShowTrash(false)} />}
      </Suspense>
    </aside>
  )
}
