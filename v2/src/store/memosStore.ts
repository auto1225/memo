import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface MemoSummary {
  id: string
  title: string
  updatedAt: number
  preview?: string
}

export interface Memo {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
}

interface MemosState {
  memos: Record<string, Memo>
  currentId: string | null
  order: string[]
  newMemo: () => string
  setCurrent: (id: string) => void
  updateCurrent: (patch: { title?: string; content?: string }) => void
  deleteMemo: (id: string) => void
  list: () => MemoSummary[]
  current: () => Memo | null
}

function makeId(): string {
  return 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

function makeBlankMemo(): Memo {
  const now = Date.now()
  return { id: makeId(), title: '새 메모', content: '<p></p>', createdAt: now, updatedAt: now }
}

function makePreview(html: string): string {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.slice(0, 80)
}

export const useMemosStore = create<MemosState>()(
  persist(
    (set, get) => ({
      memos: {},
      currentId: null,
      order: [],
      newMemo: () => {
        const memo = makeBlankMemo()
        set((s) => ({
          memos: { ...s.memos, [memo.id]: memo },
          currentId: memo.id,
          order: [memo.id, ...s.order],
        }))
        return memo.id
      },
      setCurrent: (id) => { if (get().memos[id]) set({ currentId: id }) },
      updateCurrent: (patch) => {
        set((s) => {
          if (!s.currentId) return s
          const cur = s.memos[s.currentId]
          if (!cur) return s
          const next: Memo = { ...cur, ...patch, updatedAt: Date.now() }
          const newOrder = [s.currentId, ...s.order.filter((id) => id !== s.currentId)]
          return { memos: { ...s.memos, [s.currentId]: next }, order: newOrder }
        })
      },
      deleteMemo: (id) => {
        set((s) => {
          const next = { ...s.memos }
          delete next[id]
          const newOrder = s.order.filter((x) => x !== id)
          let newCurrent = s.currentId === id ? newOrder[0] || null : s.currentId
          if (newOrder.length === 0) {
            const blank = makeBlankMemo()
            return { memos: { [blank.id]: blank }, order: [blank.id], currentId: blank.id }
          }
          return { memos: next, order: newOrder, currentId: newCurrent }
        })
      },
      list: () => {
        const s = get()
        return s.order.map((id) => {
          const m = s.memos[id]
          return { id: m.id, title: m.title, updatedAt: m.updatedAt, preview: makePreview(m.content) }
        })
      },
      current: () => {
        const s = get()
        return s.currentId ? s.memos[s.currentId] : null
      },
    }),
    { name: 'jan:v2:memos', version: 1 }
  )
)
