import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createLocalFirstStorage } from '../lib/localFirstStorage'

/**
 * Phase 12 — 워크스페이스 / 그룹.
 * 메모를 워크스페이스로 분리 (개인 / 업무 / 학습 등).
 * 메모 → workspaceId 매핑 + 워크스페이스 메타.
 */
export interface Workspace {
  id: string
  name: string
  color: string
  createdAt: number
}

interface WorkspaceState {
  workspaces: Record<string, Workspace>
  byMemo: Record<string, string> // memoId → workspaceId
  currentWsId: string | null

  createWorkspace: (name: string, color?: string) => string
  renameWorkspace: (id: string, name: string) => void
  setColor: (id: string, color: string) => void
  deleteWorkspace: (id: string) => void
  assignMemo: (memoId: string, wsId: string | null) => void
  setCurrentWs: (id: string | null) => void
  list: () => Workspace[]
}

const COLORS = ['#D97757', '#5D4037', '#1976D2', '#388E3C', '#FBC02D', '#E91E63', '#7B1FA2', '#00838F']
const DEFAULT_WS_ID = 'ws_default'

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaces: {
        [DEFAULT_WS_ID]: { id: DEFAULT_WS_ID, name: '기본', color: COLORS[0], createdAt: 0 },
      },
      byMemo: {},
      currentWsId: null, // null = 전체

      createWorkspace: (name, color) => {
        const id = 'ws_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6)
        const ws: Workspace = {
          id,
          name,
          color: color || COLORS[Object.keys(get().workspaces).length % COLORS.length],
          createdAt: Date.now(),
        }
        set((s) => ({ workspaces: { ...s.workspaces, [id]: ws } }))
        return id
      },

      renameWorkspace: (id, name) => {
        set((s) => {
          const w = s.workspaces[id]
          if (!w) return s
          return { workspaces: { ...s.workspaces, [id]: { ...w, name } } }
        })
      },

      setColor: (id, color) => {
        set((s) => {
          const w = s.workspaces[id]
          if (!w) return s
          return { workspaces: { ...s.workspaces, [id]: { ...w, color } } }
        })
      },

      deleteWorkspace: (id) => {
        if (id === DEFAULT_WS_ID) return
        set((s) => {
          const newWs = { ...s.workspaces }
          delete newWs[id]
          // 이 워크스페이스에 속한 메모는 default 로 이동
          const newBy: Record<string, string> = {}
          for (const [mid, wid] of Object.entries(s.byMemo)) {
            newBy[mid] = wid === id ? DEFAULT_WS_ID : wid
          }
          return {
            workspaces: newWs,
            byMemo: newBy,
            currentWsId: s.currentWsId === id ? null : s.currentWsId,
          }
        })
      },

      assignMemo: (memoId, wsId) => {
        set((s) => {
          const newBy = { ...s.byMemo }
          if (wsId == null) delete newBy[memoId]
          else newBy[memoId] = wsId
          return { byMemo: newBy }
        })
      },

      setCurrentWs: (id) => set({ currentWsId: id }),

      list: () => {
        const w = get().workspaces
        return Object.values(w).sort((a, b) => a.createdAt - b.createdAt)
      },
    }),
    {
      name: 'jan-v2-workspaces',
      storage: createJSONStorage(() => createLocalFirstStorage()),
    }
  )
)

export const DEFAULT_WORKSPACE_ID = DEFAULT_WS_ID
