import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Phase 17 — UI 상태 (포커스/읽기 모드 + 페이지 줌 + spellcheck + collapse + heading 번호).
 */
interface UIState {
  focusMode: boolean
  readingMode: boolean
  spellCheck: boolean
  sidebarCollapsed: boolean
  headingNumbers: boolean
  zoom: number // 0.6 ~ 2.0
  toggleFocus: () => void
  setFocus: (v: boolean) => void
  toggleReading: () => void
  toggleSpellCheck: () => void
  toggleSidebar: () => void
  toggleHeadingNumbers: () => void
  zoomIn: () => void
  zoomOut: () => void
  zoomReset: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      focusMode: false,
      readingMode: false,
      spellCheck: false,
      sidebarCollapsed: false,
      headingNumbers: false,
      zoom: 1,
      toggleFocus: () => set({ focusMode: !get().focusMode }),
      toggleReading: () => set({ readingMode: !get().readingMode }),
      toggleSpellCheck: () => set({ spellCheck: !get().spellCheck }),
      setFocus: (v) => set({ focusMode: v }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      toggleHeadingNumbers: () => set({ headingNumbers: !get().headingNumbers }),
      zoomIn: () => set({ zoom: Math.min(2, +(get().zoom + 0.1).toFixed(2)) }),
      zoomOut: () => set({ zoom: Math.max(0.6, +(get().zoom - 0.1).toFixed(2)) }),
      zoomReset: () => set({ zoom: 1 }),
    }),
    { name: 'jan-v2-ui' }
  )
)
