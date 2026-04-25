import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'

interface OutlinePanelProps {
  editor: Editor | null
}

interface Heading {
  level: number
  text: string
  pos: number
}

/**
 * Phase 6 — 문서 자동 목차 (TOC).
 * 사이드바에 H1~H6 트리. 클릭 → 해당 위치로 스크롤.
 * Editor 의 transaction 마다 새로고침.
 */
export function OutlinePanel({ editor }: OutlinePanelProps) {
  const [headings, setHeadings] = useState<Heading[]>([])

  useEffect(() => {
    if (!editor) return
    function refresh() {
      if (!editor) return
      const list: Heading[] = []
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          list.push({
            level: node.attrs.level || 1,
            text: node.textContent || '(빈 제목)',
            pos,
          })
        }
        return true
      })
      setHeadings(list)
    }
    refresh()
    editor.on('update', refresh)
    return () => {
      editor.off('update', refresh)
    }
  }, [editor])

  function jump(pos: number) {
    if (!editor) return
    editor.chain().focus().setTextSelection(pos + 1).scrollIntoView().run()
  }

  if (!editor) return null

  return (
    <div className="jan-outline">
      <div className="jan-outline-head">목차</div>
      {headings.length === 0 && <div className="jan-outline-empty">제목이 없습니다.</div>}
      <ul className="jan-outline-list">
        {headings.map((h, i) => (
          <li
            key={i}
            className={'jan-outline-item lvl' + h.level}
            style={{ paddingLeft: 8 + (h.level - 1) * 12 }}
            onClick={() => jump(h.pos)}
            title={h.text}
          >
            {h.text}
          </li>
        ))}
      </ul>
    </div>
  )
}
