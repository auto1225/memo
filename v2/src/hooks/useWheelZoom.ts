import { useEffect } from 'react'
import { useUIStore } from '../store/uiStore'

/**
 * Phase 17 — Ctrl+휠 줌.
 * 표준 워드/PDF 뷰어처럼 Ctrl 누르고 마우스 휠 → 줌 인/아웃.
 * 휠 단위 0.05.
 */
export function useWheelZoom() {
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      const ui = useUIStore.getState()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      const next = Math.max(0.6, Math.min(2, +(ui.zoom + delta).toFixed(2)))
      useUIStore.setState({ zoom: next })
    }
    // passive: false 가 필요 — preventDefault 사용
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [])
}
