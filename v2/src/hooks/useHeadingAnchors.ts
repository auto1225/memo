import { useEffect } from 'react'
import type { Editor } from '@tiptap/react'

/**
 * Phase 16 — 자동 헤딩 anchor.
 * editor.update 마다 모든 h1~h6 에 id 부여 (slug). 
 * OutlinePanel/SVG 미니맵에서 jump 가능.
 * id 는 DOM 에만 추가 — TipTap state 에 attribute 추가 X (간단/안전).
 */
function slug(s: string): string {
  return (
    s
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\u00C0-\uFFFF\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 60) || 'h'
  )
}

export function useHeadingAnchors(editor: Editor | null) {
  useEffect(() => {
    if (!editor) return
    function apply() {
      if (!editor) return
      const dom = editor.view.dom as HTMLElement
      const seen = new Map<string, number>()
      dom.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => {
        const base = slug(h.textContent || 'h')
        const cnt = seen.get(base) || 0
        seen.set(base, cnt + 1)
        const id = cnt === 0 ? base : `${base}-${cnt + 1}`
        h.id = id
      })
    }
    apply()
    editor.on('update', apply)
    return () => {
      editor.off('update', apply)
    }
  }, [editor])
}
