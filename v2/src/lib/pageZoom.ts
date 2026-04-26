import { normalizeZoom, pageDimensionsPx, useUIStore } from '../store/uiStore'

type PageZoomFitMode = 'width' | 'page'

const DESKTOP_RULER_WIDTH_PX = 34
const DESKTOP_RULER_HEIGHT_PX = 34
const DESKTOP_PAGE_PADDING_X_PX = 32
const DESKTOP_PAGE_PADDING_BOTTOM_PX = 40
const MOBILE_PAGE_PADDING_X_PX = 24

export function setPageZoom(zoom: number) {
  const next = normalizeZoom(zoom)
  useUIStore.getState().setZoom(next)
  return next
}

export function fitPageZoom(mode: PageZoomFitMode) {
  const state = useUIStore.getState()
  const main = document.querySelector<HTMLElement>('.jan-editor-main')
  const availableWidth = Math.max(240, (main?.clientWidth || window.innerWidth) - 32)
  const availableHeight = Math.max(240, (main?.clientHeight || window.innerHeight) - 32)
  const pagePx = pageDimensionsPx(state.pageSize, state.pageOrientation)
  const desktopRulers = state.showRulers && window.matchMedia('(min-width: 861px)').matches
  const rulerWidth = desktopRulers ? DESKTOP_RULER_WIDTH_PX : 0
  const rulerHeight = desktopRulers ? DESKTOP_RULER_HEIGHT_PX : 0
  const paddingX = desktopRulers ? DESKTOP_PAGE_PADDING_X_PX : MOBILE_PAGE_PADDING_X_PX
  const baseWidth = pagePx.pageWidth + rulerWidth + paddingX
  const baseHeight = pagePx.pageHeight + rulerHeight + DESKTOP_PAGE_PADDING_BOTTOM_PX
  const widthZoom = availableWidth / baseWidth
  const pageZoom = Math.min(widthZoom, availableHeight / baseHeight)
  return setPageZoom(mode === 'width' ? widthZoom : pageZoom)
}
