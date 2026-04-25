import { useEffect, useRef, useState } from 'react'

interface PrintPreviewProps {
  html: string
  title: string
  onClose: () => void
}

const PAGED_CDN = 'https://unpkg.com/pagedjs/dist/paged.polyfill.js'

/**
 * Phase 5 — Paged.js 기반 인쇄 미리보기.
 * iframe srcdoc 으로 콘텐츠 주입 + Paged.js 가 W3C @page 규칙으로 페이지 분할.
 */
export function PrintPreview({ html, title, onClose }: PrintPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [status, setStatus] = useState('페이지 분할 중...')

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
    ifr.srcdoc = buildHtml(html, title)
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
            if (!cancelled) setStatus(`${pages.length} 페이지 — 인쇄/PDF 가능`)
          }
        } catch {}
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
  }, [html, title])

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
          <span className="jan-print-title">인쇄 미리보기 — A4</span>
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

/** HTML attribute / element 텍스트 escape (한글은 그대로 유지). */
function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
/** CSS string content() 안전 escape — 백슬래시·따옴표만 처리, 한글/이모지 유지. */
function escCss(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function buildHtml(content: string, title: string): string {
  const titleAttr = escAttr(title)
  const titleCss = escCss(title)
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>${titleAttr}</title>
<style>
@page { size: A4; margin: 20mm;
  @top-right { content: "${titleCss}"; font-size: 9pt; color:#888; }
  @bottom-right { content: "Page " counter(page) " / " counter(pages); font-size:9pt; color:#888; }
}
html,body{margin:0;padding:0;}
body{font-family:"Noto Sans KR","Malgun Gothic",sans-serif;font-size:11pt;line-height:1.65;color:#222;background:#ccc;}
.pagedjs_page{margin:16px auto !important;box-shadow:0 4px 16px rgba(0,0,0,0.18);background:#fff;}
h1{font-size:22pt;font-weight:700;margin:1em 0 0.5em;}
h2{font-size:17pt;font-weight:700;margin:1em 0 0.4em;}
h3{font-size:14pt;font-weight:600;margin:0.8em 0 0.3em;}
p{margin:0.5em 0;}
table{border-collapse:collapse;margin:0.6em 0;width:100%;}
th,td{border:1px solid #999;padding:4px 8px;}
th{background:#f0f0f0;font-weight:600;}
pre,code{font-family:"D2Coding",monospace;background:#f5f5f5;padding:0 4px;border-radius:3px;}
pre{padding:8px 12px;overflow-x:auto;}
blockquote{border-left:3px solid #D97757;padding:4px 12px;margin:0.6em 0;color:#555;background:rgba(217,119,87,0.05);}
img{max-width:100%;height:auto;}
@media print{body{background:white;}.pagedjs_page{box-shadow:none !important;margin:0 !important;}}
</style></head><body>
<div id="content">${content}</div>
<script src="${PAGED_CDN}"><\/script>
</body></html>`
}
