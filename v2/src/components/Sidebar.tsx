import { useMemosStore } from '../store/memosStore'

export function Sidebar() {
  const { newMemo, setCurrent, deleteMemo, currentId, list } = useMemosStore()
  const memos = list()

  return (
    <aside className="jan-sidebar">
      <div className="jan-sidebar-head">
        <button className="jan-sidebar-new" onClick={() => newMemo()}>+ 새 메모</button>
      </div>
      <ul className="jan-sidebar-list">
        {memos.length === 0 && (
          <li className="jan-sidebar-empty">메모가 없습니다.<br />위 버튼으로 만드세요.</li>
        )}
        {memos.map((m) => (
          <li
            key={m.id}
            className={'jan-sidebar-item' + (m.id === currentId ? ' is-active' : '')}
            onClick={() => setCurrent(m.id)}
          >
            <div className="jan-sidebar-title">{m.title || '무제'}</div>
            {m.preview && <div className="jan-sidebar-preview">{m.preview}</div>}
            <div className="jan-sidebar-meta">
              <span>{new Date(m.updatedAt).toLocaleDateString('ko-KR')}</span>
              <button
                className="jan-sidebar-del"
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm(`"${m.title || '무제'}" 삭제할까요?`)) deleteMemo(m.id)
                }}
                title="삭제"
              >
                X
              </button>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}
