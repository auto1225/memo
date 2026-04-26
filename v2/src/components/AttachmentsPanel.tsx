import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { deleteAttachment, downloadAttachment, fileToDataUrl, listAttachments, saveAttachment } from '../lib/attachments'
import { resolveBlobRefsInElement, saveDataUrlAsBlobRef } from '../lib/blobRefs'
import { useMemosStore } from '../store/memosStore'

interface AttachmentsPanelProps {
  editor: Editor | null
  onClose: () => void
}

interface AttRow {
  id: string
  name: string
  type: string
  size: number
  memoId?: string
  createdAt: number
}

export function AttachmentsPanel({ editor, onClose }: AttachmentsPanelProps) {
  const memo = useMemosStore((s) => s.current())
  const [items, setItems] = useState<AttRow[]>([])
  const [scope, setScope] = useState<'all' | 'memo'>('memo')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const list = await listAttachments(scope === 'memo' ? memo?.id : undefined)
    setItems(list as AttRow[])
  }

  useEffect(() => {
    let cancelled = false
    void listAttachments(scope === 'memo' ? memo?.id : undefined).then((list) => {
      if (!cancelled) setItems(list as AttRow[])
    })
    return () => { cancelled = true }
  }, [scope, memo?.id])

  async function insertAttachment(file: File, id: string) {
    if (!editor) return
    if (file.type.startsWith('image/')) {
      const ref = await saveDataUrlAsBlobRef(await fileToDataUrl(file))
      editor.chain().focus().setImage({ src: ref, alt: file.name, title: `attachment:${id}` }).run()
      window.setTimeout(() => resolveBlobRefsInElement(editor.view.dom).catch(() => {}), 0)
      return
    }

    const name = escAttr(file.name)
    const link = `<p>첨부 <a href="indexeddb:${id}" data-att="${id}" data-name="${name}">${name}</a> (${fmtSize(file.size)})</p>`
    editor.chain().focus().insertContent(link).run()
  }

  async function pickFiles() {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files
      if (!files || files.length === 0) return
      setBusy(true)
      try {
        for (const file of Array.from(files)) {
          const id = await saveAttachment(file, memo?.id)
          await insertAttachment(file, id)
        }
        await refresh()
      } finally {
        setBusy(false)
      }
    }
    input.click()
  }

  async function open(id: string, name: string) {
    const ok = await downloadAttachment(id, name)
    if (!ok) alert('첨부파일을 찾을 수 없습니다.')
  }

  async function del(id: string) {
    if (!confirm('첨부파일을 삭제할까요?')) return
    await deleteAttachment(id)
    await refresh()
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-att-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>첨부 파일</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <div className="jan-att-tools">
            <button onClick={pickFiles} disabled={busy} className="primary">
              {busy ? '추가 중...' : '+ 파일 추가'}
            </button>
            <select value={scope} onChange={(e) => setScope(e.target.value as 'all' | 'memo')}>
              <option value="memo">현재 메모만</option>
              <option value="all">전체</option>
            </select>
            <span className="jan-att-stats">{items.length}개 · {fmtSize(items.reduce((a, b) => a + b.size, 0))}</span>
          </div>
          <ul className="jan-att-list">
            {items.length === 0 && <li className="jan-att-empty">첨부 파일 없음</li>}
            {items.map((a) => (
              <li key={a.id} className="jan-att-item">
                <span className="jan-att-name" title={a.name}>{a.name}</span>
                <span className="jan-att-meta">
                  {fmtSize(a.size)} · {new Date(a.createdAt).toLocaleDateString('ko-KR')}
                </span>
                <span className="flex-spacer" />
                <button onClick={() => open(a.id, a.name)}>다운로드</button>
                <button onClick={() => del(a.id)}>삭제</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function fmtSize(b: number): string {
  if (b < 1024) return `${b}B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`
  return `${(b / 1024 / 1024).toFixed(1)}MB`
}

function escAttr(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c))
}
