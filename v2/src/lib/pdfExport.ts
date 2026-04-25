/**
 * Phase 11 — PDF 직접 export.
 * Paged.js 가 이미 인쇄 미리보기에 사용됨 → iframe.contentWindow.print() 가
 * Chrome/Edge 의 "PDF 로 저장" 으로 PDF 생성.
 *
 * 추가로 jsPDF 없이 브라우저 print API 만 사용 — 의존성 0KB.
 * 단, iframe 인쇄는 사용자 다이얼로그를 띄움 → "직접" 은 절대 X.
 *
 * 진정한 자동 PDF 는 html2canvas + jsPDF 조합 필요. 여기서는 가벼운 옵션으로
 * 인쇄 다이얼로그를 즉시 트리거 + 안내.
 */
const PAGED_CDN = 'https://unpkg.com/pagedjs/dist/paged.polyfill.js'

export async function exportToPdf(html: string, title: string): Promise<void> {
  // hidden iframe 생성 → Paged.js 로 페이지 분할 → window.print() → 사용자가 PDF 선택
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-9999px'
  iframe.style.top = '-9999px'
  iframe.style.width = '210mm'
  iframe.style.height = '297mm'
  iframe.setAttribute('aria-hidden', 'true')
  document.body.appendChild(iframe)

  const safeTitle = title.replace(/[<>&"']/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] || c
  ))
  const doc = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>${safeTitle}</title>
<style>
@page { size: A4; margin: 20mm; @bottom-right { content: counter(page) " / " counter(pages); font-size:9pt; color:#888; } }
html,body{margin:0;padding:0;}
body{font-family:"Noto Sans KR","Malgun Gothic",sans-serif;font-size:11pt;line-height:1.65;color:#222;}
h1{font-size:22pt;font-weight:700;margin:1em 0 0.5em;}
h2{font-size:17pt;font-weight:700;margin:1em 0 0.4em;}
h3{font-size:14pt;font-weight:600;margin:0.8em 0 0.3em;}
p{margin:0.5em 0;}
table{border-collapse:collapse;width:100%;margin:0.6em 0;}
th,td{border:1px solid #999;padding:4px 8px;}
th{background:#f0f0f0;}
pre,code{font-family:monospace;background:#f5f5f5;}
pre{padding:8px 12px;}
blockquote{border-left:3px solid #D97757;padding:4px 12px;margin:0.6em 0;color:#555;}
img{max-width:100%;height:auto;}
@media print{.pagedjs_page{box-shadow:none !important;margin:0 !important;}}
</style></head><body>${html}<script src="${PAGED_CDN}"><\/script></body></html>`

  iframe.srcdoc = doc

  await new Promise<void>((resolve) => {
    iframe.addEventListener('load', () => {
      // Paged.js 분할 대기 (~1.5초)
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
        } catch (e) {
          console.warn('[pdfExport] print failed', e)
        }
        // 인쇄 다이얼로그 닫힌 후 정리 — afterprint 이벤트 5초 fallback
        const cleanup = () => {
          try { document.body.removeChild(iframe) } catch {}
          resolve()
        }
        iframe.contentWindow?.addEventListener('afterprint', cleanup)
        setTimeout(cleanup, 30000)
      }, 1500)
    })
  })
}
