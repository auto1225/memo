import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Phase 6 — 다크 모드.
 * <body> 에 .jan-theme-dark / .jan-theme-light 토글.
 */
export type Theme = 'light' | 'dark' | 'auto'

interface ThemeState {
  theme: Theme
  setTheme: (t: Theme) => void
  apply: () => void
}

function detectAuto(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light'
}

function applyClass(t: Theme) {
  if (typeof document === 'undefined') return
  const effective = t === 'auto' ? detectAuto() : t
  document.body.classList.toggle('jan-theme-dark', effective === 'dark')
  document.body.classList.toggle('jan-theme-light', effective === 'light')
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light' as Theme,
      setTheme: (t) => {
        set({ theme: t })
        applyClass(t)
      },
      apply: () => applyClass(get().theme),
    }),
    { name: 'jan-v2-theme' }
  )
)

// 시스템 테마 변경 감지 (auto 모드일 때)
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const s = useThemeStore.getState()
    if (s.theme === 'auto') applyClass('auto')
  })
}
