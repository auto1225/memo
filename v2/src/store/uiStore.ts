import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type PaperStyle = 'lined' | 'grid' | 'dot' | 'blank' | 'music' | 'cornell'
export type PageSizePreset = 'A4' | 'A3' | 'B4' | 'A5' | 'B5' | 'Letter'
export type PageOrientation = 'portrait' | 'landscape'

export const PAPER_STYLES: Array<{ value: PaperStyle; label: string; description: string }> = [
  { value: 'lined', label: '줄노트 (기본)', description: 'v1 기본 노트 배경' },
  { value: 'grid', label: '모눈종이', description: '20px 격자' },
  { value: 'dot', label: '점격자', description: '점으로 된 격자' },
  { value: 'blank', label: '무지', description: '빈 종이' },
  { value: 'music', label: '오선지', description: '악보용 줄' },
  { value: 'cornell', label: '코넬 노트', description: '좌측 큐 영역 + 줄노트' },
]

export const PAGE_PRESETS: Record<PageSizePreset, { label: string; widthMm: number; heightMm: number }> = {
  A4: { label: 'A4', widthMm: 210, heightMm: 297 },
  A3: { label: 'A3', widthMm: 297, heightMm: 420 },
  B4: { label: 'B4', widthMm: 250, heightMm: 353 },
  A5: { label: 'A5', widthMm: 148, heightMm: 210 },
  B5: { label: 'B5', widthMm: 176, heightMm: 250 },
  Letter: { label: 'Letter', widthMm: 216, heightMm: 279 },
}

export function pageDimensions(size: PageSizePreset, orientation: PageOrientation) {
  const preset = PAGE_PRESETS[size] || PAGE_PRESETS.A4
  const portrait = { widthMm: preset.widthMm, heightMm: preset.heightMm }
  return orientation === 'landscape'
    ? { widthMm: portrait.heightMm, heightMm: portrait.widthMm }
    : portrait
}

export function pageDimensionsPx(size: PageSizePreset, orientation: PageOrientation) {
  const { widthMm, heightMm } = pageDimensions(size, orientation)
  const mmToPx = (mm: number) => Math.round((mm * 96) / 25.4)
  return { pageWidth: mmToPx(widthMm), pageHeight: mmToPx(heightMm) }
}

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
  paperStyle: PaperStyle
  pageSize: PageSizePreset
  pageOrientation: PageOrientation
  pageMarginMm: number
  runningHeader: string
  runningFooter: string
  toggleFocus: () => void
  setFocus: (v: boolean) => void
  toggleReading: () => void
  toggleSpellCheck: () => void
  toggleSidebar: () => void
  toggleHeadingNumbers: () => void
  zoomIn: () => void
  zoomOut: () => void
  zoomReset: () => void
  setPaperStyle: (style: PaperStyle) => void
  setPageSize: (size: PageSizePreset) => void
  setPageOrientation: (orientation: PageOrientation) => void
  setPageMarginMm: (margin: number) => void
  setRunningHeader: (value: string) => void
  setRunningFooter: (value: string) => void
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
      paperStyle: 'lined',
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMarginMm: 20,
      runningHeader: '',
      runningFooter: 'Page {page} / {total}',
      toggleFocus: () => set({ focusMode: !get().focusMode }),
      toggleReading: () => set({ readingMode: !get().readingMode }),
      toggleSpellCheck: () => set({ spellCheck: !get().spellCheck }),
      setFocus: (v) => set({ focusMode: v }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      toggleHeadingNumbers: () => set({ headingNumbers: !get().headingNumbers }),
      zoomIn: () => set({ zoom: Math.min(2, +(get().zoom + 0.1).toFixed(2)) }),
      zoomOut: () => set({ zoom: Math.max(0.6, +(get().zoom - 0.1).toFixed(2)) }),
      zoomReset: () => set({ zoom: 1 }),
      setPaperStyle: (style) => set({ paperStyle: style }),
      setPageSize: (size) => set({ pageSize: size }),
      setPageOrientation: (orientation) => set({ pageOrientation: orientation }),
      setPageMarginMm: (margin) => set({ pageMarginMm: Math.max(8, Math.min(60, Math.round(margin))) }),
      setRunningHeader: (value) => set({ runningHeader: value.trim() }),
      setRunningFooter: (value) => set({ runningFooter: value.trim() }),
    }),
    { name: 'jan-v2-ui' }
  )
)
