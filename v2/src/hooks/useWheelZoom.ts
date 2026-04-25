import { useEffect } from 'react'
import { useUIStore } from '../store/uiStore'

/**
 * Phase 17 — Ctrl+휠 줌.
 * 표준 워드/PDF 뷰어처럼 Ctrl 누르고 마우스 휠 → 줌 인/아웃.
 * 휠 단위 0.1.
 *
 * IMPORTANT — capture phase + document 에 등록.
 * (ProseMirror/PaginationPlus 가 wheel stopPropagation 시 window 에 도달 안 할 수 있음)
 */
export function useWheelZoom() {
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      if (!(e.ctrlKey || e.metaKey)) return
      // 브라우저 기본 줌 차단 (가장 우선)
      e.preventDefault()
      e.stopPropagation()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      const cur = useUIStore.getState().zoom
      const next = Math.max(0.6, Math.min(2, +(cur + delta).toFixed(2)))
      if (next !== cur) {
        useUIStore.setState({ zoom: next })
      }
    }
    // capture: true — ProseMirror 가 stopPropagation 해도 우리가 먼저 받음
    document.addEventListener('wheel', onWheel, { passive: false, capture: true })
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      document.removeEventListener('wheel', onWheel, { capture: true } as any)
      window.removeEventListener('wheel', onWheel)
    }
  }, [])
}
