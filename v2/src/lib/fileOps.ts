export interface SaveOptions {
  title?: string
  content: string
  handle?: FileSystemFileHandle | null
}

export interface SaveResult {
  ok: boolean
  handle?: FileSystemFileHandle
  error?: string
}

export async function saveToFile(opts: SaveOptions): Promise<SaveResult> {
  const { title = '메모', content, handle } = opts

  if ('showSaveFilePicker' in window) {
    try {
      let targetHandle = handle
      if (!targetHandle) {
        targetHandle = await (window as any).showSaveFilePicker({
          suggestedName: `${title}.html`,
          types: [{
            description: 'HTML 문서',
            accept: { 'text/html': ['.html', '.htm'] },
          }],
        })
      }
      const writable = await targetHandle!.createWritable()
      await writable.write(wrapHtml(title, content))
      await writable.close()
      return { ok: true, handle: targetHandle! }
    } catch (err: any) {
      if (err.name === 'AbortError') return { ok: false, error: '취소됨' }
      console.warn('[fileOps] FSA save failed, fallback:', err)
    }
  }

  try {
    const blob = new Blob([wrapHtml(title, content)], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err) }
  }
}

export async function openFile(): Promise<{ content: string; handle: FileSystemFileHandle; title: string } | null> {
  if (!('showOpenFilePicker' in window)) {
    throw new Error('이 브라우저는 파일 열기 API 를 지원하지 않습니다')
  }
  try {
    const [handle] = await (window as any).showOpenFilePicker({
      types: [{
        description: 'HTML 문서',
        accept: { 'text/html': ['.html', '.htm'] },
      }],
      multiple: false,
    })
    const file = await handle.getFile()
    const text = await file.text()
    const title = file.name.replace(/\.(html|htm)$/i, '')
    const content = extractBody(text)
    return { content, handle, title }
  } catch (err: any) {
    if (err.name === 'AbortError') return null
    throw err
  }
}

function wrapHtml(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; font-size: 11pt; line-height: 1.65; max-width: 210mm; margin: 20mm auto; padding: 0 22mm; }
  p { margin: 0.5em 0; }
  h1, h2, h3, h4, h5, h6 { font-weight: 600; margin: 1em 0 0.3em; }
  table { border-collapse: collapse; }
  table td, table th { border: 1px solid #999; padding: 4px 8px; }
  img { max-width: 100%; }
  blockquote { border-left: 3px solid #d97757; padding: 4px 12px; margin: 0.6em 0; background: rgba(217,119,87,0.05); }
  pre { background: #f5f5f5; padding: 8px 12px; border-radius: 4px; overflow-x: auto; }
  code { background: #f5f5f5; padding: 0 4px; border-radius: 3px; }
</style>
</head>
<body>
${content}
</body>
</html>`
}

function extractBody(html: string): string {
  const m = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  return m ? m[1].trim() : html
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  } as any)[c])
}
