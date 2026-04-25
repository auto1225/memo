import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { saveAttachment, listAttachments, deleteAttachment, attachmentObjectUrl } from '../lib/attachments'
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

/**
 * Phase 12 — IndexedDB 첨부 매니저.
 * 파일 선택 → 저장 → 메모에 링크 삽입.
 * 기존 첨부 목록 + 다운로드 / 삭제.
 */
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
    refresh()
  }, [scope, memo?.id])

  async function pickFiles() {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files
      if (!files || files.length === 0) return
      setBusy(true)
      try {
        for (const f of Array.from(files)) {
          const id = await saveAttachment(f, memo?.id)
          // 메모에 링크 삽입
          if (editor) {
            if (f.type.startsWith('image/')) {
              const url = await attachmentObjectUrl(id)
              if (url) editor.chain().focus().setImage({ src: url }).run()
            } else {
              const link = `<p>📎 <a href="indexeddb:${id}" data-att="${id}" data-name="${escAttr(f.name)}">${escAttr(f.name)}</a> (${fmtSize(f.size)})</p>`
              editor.chain().focus().insertContent(link).run()
            }
          }
        }
        await refresh()
      } finally {
        setBusy(false)
      }
    }
    input.click()
  }

  async function open(id: string, name: string) {
    const url = await attachmentObjectUrl(id)
    if (!url) return alert('첨부를 찾을 수 없습니다')
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function del(id: string) {
    if (!confirm('첨부를 삭제할까요?')) return
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
              + 파일 추가
            </button>
            <select value={scope} onChange={(e) => setScope(e.target.value as any)}>
              <option value="memo">현재 메모만</option>
              <option value="all">전체</option>
            </select>
            <span className="jan-att-stats">{items.length}개 · {fmtSize(items.reduce((a, b) => a + b.size, 0))}</span>
          </div>
          <ul className="jan-att-list">
            {items.length === 0 && <li className="jan-att-empty">첨부 없음</li>}
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
