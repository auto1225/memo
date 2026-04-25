import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Phase 10 — UI 상태 (포커스 모드 + 페이지 줌).
 */
interface UIState {
  focusMode: boolean
  zoom: number // 0.6 ~ 2.0
  toggleFocus: () => void
  setFocus: (v: boolean) => void
  zoomIn: () => void
  zoomOut: () => void
  zoomReset: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      focusMode: false,
      zoom: 1,
      toggleFocus: () => set({ focusMode: !get().focusMode }),
      setFocus: (v) => set({ focusMode: v }),
      zoomIn: () => set({ zoom: Math.min(2, +(get().zoom + 0.1).toFixed(2)) }),
      zoomOut: () => set({ zoom: Math.max(0.6, +(get().zoom - 0.1).toFixed(2)) }),
      zoomReset: () => set({ zoom: 1 }),
    }),
    { name: 'jan-v2-ui' }
  )
)
