import { useEffect } from 'react'
import { useUIStore } from '../store/uiStore'

/**
 * Phase 17 — Ctrl+휠 줌 (호환성 강화).
 *
 * 1. document/window capture phase + 양쪽 등록 → ProseMirror stopPropagation 회피
 * 2. CSS 변수 + 인라인 style 동시 적용 → CSS cascade/specificity 우회
 * 3. zoom 속성 (Chromium/Edge/Firefox126+/Safari18+) + transform:scale fallback (구버전)
 */
function applyZoom(zoom: number) {
  const root = document.documentElement
  root.style.setProperty('--jan-zoom', String(zoom))
  // 인라인 style 직접 적용 — 가장 높은 specificity
  document.querySelectorAll<HTMLElement>('.jan-editor-pages').forEach((el) => {
    // zoom 속성 (모던 브라우저)
    el.style.zoom = String(zoom)
    // transform fallback (구버전)
    el.style.transformOrigin = 'top center'
    el.style.transform = `scale(${zoom})`
    // 너비 보정 (transform 은 layout 영향 X)
    if (zoom !== 1) {
      el.style.width = `${100 / zoom}%`
    } else {
      el.style.width = ''
    }
  })
}

export function useWheelZoom() {
  // 줌 변경 시 즉시 적용
  useEffect(() => {
    const unsub = useUIStore.subscribe((state) => {
      applyZoom(state.zoom)
    })
    // 초기 적용
    applyZoom(useUIStore.getState().zoom)
    return unsub
  }, [])

  // wheel 핸들러
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      e.stopPropagation()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      const cur = useUIStore.getState().zoom
      const next = Math.max(0.6, Math.min(2, +(cur + delta).toFixed(2)))
      if (next !== cur) {
        useUIStore.setState({ zoom: next })
      }
    }
    document.addEventListener('wheel', onWheel, { passive: false, capture: true })
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      document.removeEventListener('wheel', onWheel, { capture: true } as any)
      window.removeEventListener('wheel', onWheel)
    }
  }, [])
}
