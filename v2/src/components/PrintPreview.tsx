import { useEffect, useRef, useState } from 'react'
import { buildPrintHtml, currentPrintPageSettings } from '../lib/pdfExport'
import { PAGE_PRESETS, pageMarginsSummary, useUIStore } from '../store/uiStore'

interface PrintPreviewProps {
  html: string
  title: string
  onClose: () => void
}

export function PrintPreview({ html, title, onClose }: PrintPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [status, setStatus] = useState('페이지 분할 중...')
  const paperStyle = useUIStore((s) => s.paperStyle)
  const pageSize = useUIStore((s) => s.pageSize)
  const pageOrientation = useUIStore((s) => s.pageOrientation)
  const pageMarginMm = useUIStore((s) => s.pageMarginMm)
  const pageMarginsMm = useUIStore((s) => s.pageMarginsMm)
  const pageColumnCount = useUIStore((s) => s.pageColumnCount)
  const runningHeader = useUIStore((s) => s.runningHeader)
  const runningFooter = useUIStore((s) => s.runningFooter)
  const pageLabel = PAGE_PRESETS[pageSize]?.label || pageSize
  const orientationLabel = pageOrientation === 'landscape' ? '가로' : '세로'
  const marginLabel = pageMarginsSummary(pageMarginsMm, pageMarginMm)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const ifr = iframeRef.current
    if (!ifr) return
    ifr.srcdoc = buildPrintHtml(
      html,
      title,
      currentPrintPageSettings(),
      { previewChrome: true }
    )
    setStatus('페이지 분할 중...')
    let cancelled = false
    const handleLoad = () => {
      let waited = 0
      const t = setInterval(() => {
        waited += 200
        try {
          const doc = ifr.contentDocument
          const pages = doc?.querySelectorAll('.pagedjs_page')
          if (pages && pages.length > 0) {
            clearInterval(t)
            if (!cancelled) setStatus(`${pages.length}페이지 - 인쇄/PDF 가능`)
          }
        } catch {
          // The iframe can be between navigation states while Paged.js loads.
        }
        if (waited > 15000) {
          clearInterval(t)
          if (!cancelled) setStatus('준비 완료')
        }
      }, 200)
    }
    ifr.addEventListener('load', handleLoad)
    return () => {
      cancelled = true
      ifr.removeEventListener('load', handleLoad)
    }
  }, [html, title, paperStyle, pageSize, pageOrientation, pageMarginMm, pageMarginsMm, pageColumnCount, runningHeader, runningFooter])

  function doPrint() {
    const ifr = iframeRef.current
    if (!ifr?.contentWindow) return
    ifr.contentWindow.focus()
    ifr.contentWindow.print()
  }

  return (
    <div className="jan-print-modal" onClick={onClose}>
      <div className="jan-print-shell" onClick={(e) => e.stopPropagation()}>
        <div className="jan-print-bar">
          <span className="jan-print-title">인쇄 미리보기 - {pageLabel} {orientationLabel} / 여백 {marginLabel} / {pageColumnCount}단</span>
          <span className="jan-print-status">{status}</span>
          <div style={{ flex: 1 }} />
          <button onClick={doPrint} className="jan-print-btn primary">인쇄 / PDF</button>
          <button onClick={onClose} className="jan-print-btn">닫기 (Esc)</button>
        </div>
        <iframe ref={iframeRef} className="jan-print-iframe" title="인쇄 미리보기" />
      </div>
    </div>
  )
}
