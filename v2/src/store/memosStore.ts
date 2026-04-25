import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SortMode = 'recent' | 'title' | 'created'

export interface MemoSummary {
  id: string
  title: string
  updatedAt: number
  pinned?: boolean
  preview?: string
}

export interface Memo {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  pinned?: boolean
}

export interface TrashedMemo extends Memo {
  trashedAt: number
}

interface MemosState {
  memos: Record<string, Memo>
  trashed: Record<string, TrashedMemo>
  currentId: string | null
  order: string[]
  sortMode: SortMode

  newMemo: () => string
  setCurrent: (id: string) => void
  updateCurrent: (patch: { title?: string; content?: string }) => void
  togglePin: (id: string) => void
  duplicate: (id: string) => string | null
  deleteMemo: (id: string) => void // → 휴지통으로
  restore: (id: string) => void
  permaDelete: (id: string) => void
  emptyTrash: () => void
  purgeOldTrash: () => void // 30일 지난 것 자동 정리
  setSortMode: (m: SortMode) => void
  list: () => MemoSummary[]
  trashedList: () => TrashedMemo[]
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

const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30일

export const useMemosStore = create<MemosState>()(
  persist(
    (set, get) => ({
      memos: {},
      trashed: {},
      currentId: null,
      order: [],
      sortMode: 'recent',

      newMemo: () => {
        const memo = makeBlankMemo()
        set((s) => ({
          memos: { ...s.memos, [memo.id]: memo },
          currentId: memo.id,
          order: [memo.id, ...s.order],
        }))
        return memo.id
      },

      setCurrent: (id) => {
        if (get().memos[id]) set({ currentId: id })
      },

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

      togglePin: (id) => {
        set((s) => {
          const m = s.memos[id]
          if (!m) return s
          return { memos: { ...s.memos, [id]: { ...m, pinned: !m.pinned } } }
        })
      },

      duplicate: (id) => {
        const s = get()
        const src = s.memos[id]
        if (!src) return null
        const now = Date.now()
        const copy: Memo = {
          ...src,
          id: makeId(),
          title: src.title + ' (복사본)',
          createdAt: now,
          updatedAt: now,
          pinned: false,
        }
        set((st) => ({
          memos: { ...st.memos, [copy.id]: copy },
          order: [copy.id, ...st.order],
          currentId: copy.id,
        }))
        return copy.id
      },

      deleteMemo: (id) => {
        set((s) => {
          const m = s.memos[id]
          if (!m) return s
          const newMemos = { ...s.memos }
          delete newMemos[id]
          const newOrder = s.order.filter((x) => x !== id)
          let newCurrent = s.currentId === id ? newOrder[0] || null : s.currentId
          const newTrashed = { ...s.trashed, [id]: { ...m, trashedAt: Date.now() } as TrashedMemo }
          if (newOrder.length === 0) {
            const blank = makeBlankMemo()
            return {
              memos: { [blank.id]: blank },
              order: [blank.id],
              currentId: blank.id,
              trashed: newTrashed,
            }
          }
          return { memos: newMemos, order: newOrder, currentId: newCurrent, trashed: newTrashed }
        })
      },

      restore: (id) => {
        set((s) => {
          const t = s.trashed[id]
          if (!t) return s
          const newTrashed = { ...s.trashed }
          delete newTrashed[id]
          const { trashedAt: _ta, ...rest } = t
          const restored: Memo = { ...rest, updatedAt: Date.now() }
          return {
            memos: { ...s.memos, [id]: restored },
            order: [id, ...s.order.filter((x) => x !== id)],
            trashed: newTrashed,
          }
        })
      },

      permaDelete: (id) => {
        set((s) => {
          const newTrashed = { ...s.trashed }
          delete newTrashed[id]
          return { trashed: newTrashed }
        })
      },

      emptyTrash: () => set({ trashed: {} }),

      purgeOldTrash: () => {
        const now = Date.now()
        set((s) => {
          const next: Record<string, TrashedMemo> = {}
          for (const [id, t] of Object.entries(s.trashed)) {
            if (now - t.trashedAt < TRASH_TTL_MS) next[id] = t
          }
          return { trashed: next }
        })
      },

      setSortMode: (m) => set({ sortMode: m }),

      list: () => {
        const s = get()
        const summaries: MemoSummary[] = s.order
          .map((id) => s.memos[id])
          .filter(Boolean)
          .map((m) => ({
            id: m.id,
            title: m.title,
            updatedAt: m.updatedAt,
            pinned: !!m.pinned,
            preview: makePreview(m.content),
          }))

        // 정렬: 핀 → sortMode
        const cmp = (() => {
          switch (s.sortMode) {
            case 'title':
              return (a: MemoSummary, b: MemoSummary) => a.title.localeCompare(b.title)
            case 'created':
              return (a: MemoSummary, b: MemoSummary) => {
                const am = s.memos[a.id]
                const bm = s.memos[b.id]
                return (bm?.createdAt || 0) - (am?.createdAt || 0)
              }
            default: // recent
              return (a: MemoSummary, b: MemoSummary) => b.updatedAt - a.updatedAt
          }
        })()
        summaries.sort((a, b) => {
          if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
          return cmp(a, b)
        })
        return summaries
      },

      trashedList: () => {
        const s = get()
        return Object.values(s.trashed).sort((a, b) => b.trashedAt - a.trashedAt)
      },

      current: () => {
        const s = get()
        return s.currentId ? s.memos[s.currentId] : null
      },
    }),
    { name: 'jan:v2:memos', version: 2 }
  )
)
