import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Phase 15 — 타이포그래피 설정.
 * 글꼴 / 줄간격 / 단락 간격 — body class 또는 CSS variable 로 적용.
 */
export type FontFamily = 'sans' | 'serif' | 'mono'

interface TypographyState {
  fontFamily: FontFamily
  lineHeight: number // 1.2 ~ 2.4
  paragraphSpacing: number // 0 ~ 24 (px)
  fontSize: number // 12 ~ 22 (px, ProseMirror base)
  setFontFamily: (f: FontFamily) => void
  setLineHeight: (n: number) => void
  setParagraphSpacing: (n: number) => void
  setFontSize: (n: number) => void
  apply: () => void
  reset: () => void
}

const FONT_STACK: Record<FontFamily, string> = {
  sans: '"Noto Sans KR","Malgun Gothic",-apple-system,BlinkMacSystemFont,sans-serif',
  serif: '"Noto Serif KR","Nanum Myeongjo",Georgia,serif',
  mono: '"D2Coding","Consolas","Courier New",monospace',
}

const DEFAULTS = {
  fontFamily: 'sans' as FontFamily,
  lineHeight: 1.7,
  paragraphSpacing: 8,
  fontSize: 14,
}

function applyVars(s: { fontFamily: FontFamily; lineHeight: number; paragraphSpacing: number; fontSize: number }) {
  if (typeof document === 'undefined') return
  const r = document.documentElement
  r.style.setProperty('--jan-editor-font', FONT_STACK[s.fontFamily])
  r.style.setProperty('--jan-editor-line', String(s.lineHeight))
  r.style.setProperty('--jan-editor-para', s.paragraphSpacing + 'px')
  r.style.setProperty('--jan-editor-size', s.fontSize + 'px')
}

export const useTypographyStore = create<TypographyState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      setFontFamily: (f) => { set({ fontFamily: f }); applyVars(get()) },
      setLineHeight: (n) => { set({ lineHeight: n }); applyVars(get()) },
      setParagraphSpacing: (n) => { set({ paragraphSpacing: n }); applyVars(get()) },
      setFontSize: (n) => { set({ fontSize: n }); applyVars(get()) },
      apply: () => applyVars(get()),
      reset: () => { set(DEFAULTS); applyVars(DEFAULTS) },
    }),
    { name: 'jan-v2-typography' }
  )
)
