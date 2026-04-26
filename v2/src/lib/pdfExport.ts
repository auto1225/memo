import {
  pageDimensions,
  useUIStore,
  type PageOrientation,
  type PageSizePreset,
  type PaperStyle,
} from '../store/uiStore'

const PAGED_CDN = 'https://unpkg.com/pagedjs/dist/paged.polyfill.js'

export interface PrintPageSettings {
  paperStyle: PaperStyle
  pageSize: PageSizePreset
  pageOrientation: PageOrientation
  pageMarginMm: number
}

export function currentPrintPageSettings(): PrintPageSettings {
  const ui = useUIStore.getState()
  return {
    paperStyle: ui.paperStyle,
    pageSize: ui.pageSize,
    pageOrientation: ui.pageOrientation,
    pageMarginMm: ui.pageMarginMm,
  }
}

export async function exportToPdf(html: string, title: string): Promise<void> {
  const settings = currentPrintPageSettings()
  const page = pageDimensions(settings.pageSize, settings.pageOrientation)
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-9999px'
  iframe.style.top = '-9999px'
  iframe.style.width = `${page.widthMm}mm`
  iframe.style.height = `${page.heightMm}mm`
  iframe.setAttribute('aria-hidden', 'true')
  document.body.appendChild(iframe)
  iframe.srcdoc = buildPrintHtml(html, title, settings, { includeHeaderTitle: false })

  await new Promise<void>((resolve) => {
    iframe.addEventListener('load', () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
        } catch (e) {
          console.warn('[pdfExport] print failed', e)
        }
        const cleanup = () => {
          try { document.body.removeChild(iframe) } catch {
            // The iframe may already be removed if the browser fires afterprint twice.
          }
          resolve()
        }
        iframe.contentWindow?.addEventListener('afterprint', cleanup)
        setTimeout(cleanup, 30000)
      }, 1500)
    })
  })
}

interface BuildPrintHtmlOptions {
  includeHeaderTitle?: boolean
  previewChrome?: boolean
}

export function buildPrintHtml(
  html: string,
  title: string,
  settings: PrintPageSettings = currentPrintPageSettings(),
  options: BuildPrintHtmlOptions = {}
): string {
  const titleAttr = escAttr(title)
  const titleCss = escCss(title)
  const page = pageDimensions(settings.pageSize, settings.pageOrientation)
  const pageSizeCss = `${page.widthMm}mm ${page.heightMm}mm`
  const marginMm = Math.max(0, Math.round(settings.pageMarginMm))
  const headerTitle = options.includeHeaderTitle === false
    ? ''
    : `@top-right { content: "${titleCss}"; font-size: 9pt; color:#888; }`
  const previewCss = options.previewChrome
    ? 'body{background:#ccc;}.pagedjs_page{margin:16px auto !important;box-shadow:0 4px 16px rgba(0,0,0,0.18);}'
    : 'body{background:#fff;}'

  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>${titleAttr}</title>
<style>
@page { size: ${pageSizeCss}; margin: ${marginMm}mm;
  ${headerTitle}
  @bottom-right { content: "Page " counter(page) " / " counter(pages); font-size:9pt; color:#888; }
}
html,body{margin:0;padding:0;}
body{font-family:"Noto Sans KR","Malgun Gothic",sans-serif;font-size:11pt;line-height:1.65;color:#222;}
body,#content,.pagedjs_page,.pagedjs_page_content{
  --jan-note-line: rgba(229,229,229,0.78);
  --jan-note-margin-line: rgba(217,119,87,0.5);
  background-color:#fff;
}
${paperBackgroundCss(settings.paperStyle)}
${previewCss}
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
</style></head><body data-paper="${settings.paperStyle}">
<div id="content" data-paper="${settings.paperStyle}">${html}</div>
<script src="${PAGED_CDN}"></script>
</body></html>`
}

function paperBackgroundCss(paperStyle: PaperStyle): string {
  const selector = `body[data-paper="${paperStyle}"],#content[data-paper="${paperStyle}"],body[data-paper="${paperStyle}"] .pagedjs_page,body[data-paper="${paperStyle}"] .pagedjs_page_content`
  switch (paperStyle) {
    case 'grid':
      return `${selector}{background-image:repeating-linear-gradient(to right, transparent 0, transparent 19px, var(--jan-note-line) 19px, var(--jan-note-line) 20px),repeating-linear-gradient(to bottom, transparent 0, transparent 19px, var(--jan-note-line) 19px, var(--jan-note-line) 20px);}`
    case 'dot':
      return `${selector}{background-image:radial-gradient(circle, var(--jan-note-line) 1px, transparent 1.5px);background-size:20px 20px;background-position:10px 18px;}`
    case 'blank':
      return `${selector}{background-image:none;}`
    case 'music':
      return `${selector}{background-image:repeating-linear-gradient(to bottom, transparent 0, transparent 34px, var(--jan-note-line) 34px, var(--jan-note-line) 35px, transparent 35px, transparent 42px, var(--jan-note-line) 42px, var(--jan-note-line) 43px, transparent 43px, transparent 50px, var(--jan-note-line) 50px, var(--jan-note-line) 51px, transparent 51px, transparent 58px, var(--jan-note-line) 58px, var(--jan-note-line) 59px, transparent 59px, transparent 66px, var(--jan-note-line) 66px, var(--jan-note-line) 67px, transparent 67px, transparent 110px);}`
    case 'cornell':
      return `${selector}{background-image:linear-gradient(to right, transparent 35%, var(--jan-note-line) 35%, var(--jan-note-line) calc(35% + 1px), transparent calc(35% + 1px)),repeating-linear-gradient(to bottom, transparent 0, transparent 27px, var(--jan-note-line) 27px, var(--jan-note-line) 28px);background-position:0 0, 0 8px;}`
    case 'lined':
    default:
      return `${selector}{background-image:linear-gradient(to right, transparent 34px, var(--jan-note-margin-line) 34px, var(--jan-note-margin-line) 35px, transparent 35px),repeating-linear-gradient(to bottom, transparent 0, transparent 27px, var(--jan-note-line) 27px, var(--jan-note-line) 28px);background-position:0 0, 0 8px;}`
  }
}

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function escCss(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
