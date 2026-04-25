import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { importMarkdownFiles } from '../lib/bulkImport'
import { useMemosStore } from '../store/memosStore'
import { useUIStore } from '../store/uiStore'
import { useWorkspaceStore, DEFAULT_WORKSPACE_ID } from '../store/workspaceStore'

const TrashModal = lazy(() => import('./TrashModal').then((m) => ({ default: m.TrashModal })))

/**
 * Phase 12 — Sidebar 강화.
 * - collapse 버튼 (uiStore.sidebarCollapsed)
 * - 인라인 검색 필터 (제목/preview)
 * - 워크스페이스 선택 셀렉터 + 메모 별 ws 표시
 * - 드래그 reorder + 핀 + 정렬 (Phase 11 누적)
 */
export function Sidebar() {
  const {
    newMemo, setCurrent, deleteMemo, currentId, list, sortMode, setSortMode,
    togglePin, duplicate, trashedList, purgeOldTrash, reorder,
  } = useMemosStore()
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const { workspaces, byMemo: wsByMemo, currentWsId, setCurrentWs, list: wsList, assignMemo } = useWorkspaceStore()
  const [showTrash, setShowTrash] = useState(false)
  const [filter, setFilter] = useState('')
  const trashCount = trashedList().length

  useEffect(() => {
    purgeOldTrash()
  }, [])

  const memos = list()
  const filtered = useMemo(() => {
    let result = memos
    // 워크스페이스 필터
    if (currentWsId) {
      result = result.filter((m) => (wsByMemo[m.id] || DEFAULT_WORKSPACE_ID) === currentWsId)
    }
    // 검색 필터
    const q = filter.trim().toLowerCase()
    if (q) {
      result = result.filter((m) =>
        (m.title || '').toLowerCase().includes(q) ||
        (m.preview || '').toLowerCase().includes(q)
      )
    }
    return result
  }, [memos, currentWsId, wsByMemo, filter])

  if (sidebarCollapsed) {
    return (
      <aside className="jan-sidebar is-collapsed">
        <button className="jan-sidebar-toggle" onClick={toggleSidebar} title="사이드바 펼치기">▶</button>
      </aside>
    )
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter((f) => f.name.endsWith('.md') || f.name.endsWith('.txt') || f.type === 'text/markdown' || f.type === 'text/plain')
    if (files.length === 0) return
    await importMarkdownFiles(files)
  }

  return (
    <aside className="jan-sidebar" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <div className="jan-sidebar-head">
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="jan-sidebar-new" onClick={() => newMemo()} style={{ flex: 1 }}>+ 새 메모</button>
          <button className="jan-sidebar-toggle" onClick={toggleSidebar} title="사이드바 접기">◀</button>
        </div>
        <select
          className="jan-sidebar-ws"
          value={currentWsId || ''}
          onChange={(e) => setCurrentWs(e.target.value || null)}
          title="워크스페이스 필터"
        >
          <option value="">전체 워크스페이스</option>
          {wsList().map((w) => (
            <option key={w.id} value={w.id} style={{ color: w.color }}>● {w.name}</option>
          ))}
        </select>
        <input
          type="search"
          className="jan-sidebar-filter"
          placeholder="목록에서 검색..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select
          className="jan-sidebar-sort"
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as any)}
          title="정렬 방식"
        >
          <option value="recent">최근 수정순</option>
          <option value="title">제목순</option>
          <option value="created">생성순</option>
          <option value="manual">수동 (드래그)</option>
        </select>
      </div>
      <ul className="jan-sidebar-list">
        {filtered.length === 0 && (
          <li className="jan-sidebar-empty">
            {filter ? '검색 결과 없음' : '메모가 없습니다.'}
          </li>
        )}
        {filtered.map((m) => {
          const wsId = wsByMemo[m.id] || DEFAULT_WORKSPACE_ID
          const ws = workspaces[wsId]
          return (
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
                >
                  {m.pinned ? '★' : '☆'}
                </button>
                <div className="jan-sidebar-title" title={m.title}>{m.title || '무제'}</div>
                {ws && (
                  <span
                    className="jan-sidebar-ws-dot"
                    style={{ background: ws.color }}
                    title={ws.name}
                  />
                )}
              </div>
              {m.preview && <div className="jan-sidebar-preview">{m.preview}</div>}
              <div className="jan-sidebar-meta">
                <span>{new Date(m.updatedAt).toLocaleDateString('ko-KR')}</span>
                <span className="flex-spacer" />
                <select
                  className="jan-sidebar-ws-pick"
                  value={wsId}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => assignMemo(m.id, e.target.value)}
                  title="워크스페이스 변경"
                >
                  {wsList().map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
                <button className="jan-sidebar-act" onClick={(e) => { e.stopPropagation(); duplicate(m.id) }} title="복제">⎘</button>
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
          )
        })}
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
