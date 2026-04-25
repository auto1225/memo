import { useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'

interface FindReplaceBarProps {
  editor: Editor | null
  onClose: () => void
}

/**
 * Phase 15 — Find & Replace.
 * Ctrl+H. 본문에서 정규식 또는 평문 검색 + 치환.
 * 미리보기 매치 카운트 + 다음/이전 + 단일/전체 치환.
 */
export function FindReplaceBar({ editor, onClose }: FindReplaceBarProps) {
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [useRegex, setUseRegex] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [matchIdx, setMatchIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const matches = useMemo(() => {
    if (!editor || !findText) return [] as Array<{ from: number; to: number }>
    const text = editor.state.doc.textContent
    let re: RegExp
    try {
      re = useRegex
        ? new RegExp(findText, caseSensitive ? 'g' : 'gi')
        : new RegExp(escapeRegex(findText), caseSensitive ? 'g' : 'gi')
    } catch {
      return []
    }
    // doc 내 위치 추적 — textContent 위치 → ProseMirror pos 매핑은 정확히 어려움.
    // 단순화: textBetween 검색 후 pos 누적.
    const out: Array<{ from: number; to: number }> = []
    let m: RegExpExecArray | null
    // matches loop
    while ((m = re.exec(text)) !== null) {
      // 빈 매치 무한루프 방지
      if (m[0].length === 0) { re.lastIndex++; continue }
      out.push({ from: m.index, to: m.index + m[0].length })
      
      if (out.length > 500) break // 안전 한계
    }
    return out
  }, [editor, findText, useRegex, caseSensitive])

  function jumpTo(idx: number) {
    if (!editor || matches.length === 0) return
    const i = ((idx % matches.length) + matches.length) % matches.length
    setMatchIdx(i)
    const m = matches[i]
    // textContent index → ProseMirror pos: 단순 추정 (1 차이로 +1 보정)
    const from = m.from + 1
    const to = m.to + 1
    editor.chain().focus().setTextSelection({ from, to }).scrollIntoView().run()
  }

  function replaceOne() {
    if (!editor || matches.length === 0) return
    const m = matches[matchIdx]
    const from = m.from + 1
    const to = m.to + 1
    editor.chain().focus().setTextSelection({ from, to }).deleteSelection().insertContent(replaceText).run()
    // 다음 매치로 이동
    setTimeout(() => jumpTo(matchIdx), 0)
  }

  function replaceAll() {
    if (!editor || !findText) return
    const html = editor.getHTML()
    const div = document.createElement('div')
    div.innerHTML = html
    walkText(div, (txt) => {
      if (useRegex) {
        try {
          const re = new RegExp(findText, caseSensitive ? 'g' : 'gi')
          return txt.replace(re, replaceText)
        } catch {
          return txt
        }
      }
      const re = new RegExp(escapeRegex(findText), caseSensitive ? 'g' : 'gi')
      return txt.replace(re, replaceText)
    })
    editor.commands.setContent(div.innerHTML, { emitUpdate: true })
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) jumpTo(matchIdx - 1)
      else jumpTo(matchIdx + 1)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div className="jan-findbar" onKeyDown={onKey}>
      <input
        ref={inputRef}
        type="text"
        placeholder="찾기..."
        value={findText}
        onChange={(e) => setFindText(e.target.value)}
      />
      <input
        type="text"
        placeholder="바꾸기..."
        value={replaceText}
        onChange={(e) => setReplaceText(e.target.value)}
      />
      <label title="정규식"><input type="checkbox" checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)} />.*</label>
      <label title="대소문자 구분"><input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} />Aa</label>
      <span className="jan-findbar-count">{matches.length === 0 ? '0' : `${matchIdx + 1}/${matches.length}`}</span>
      <button onClick={() => jumpTo(matchIdx - 1)} disabled={matches.length === 0} title="이전 (Shift+Enter)">↑</button>
      <button onClick={() => jumpTo(matchIdx + 1)} disabled={matches.length === 0} title="다음 (Enter)">↓</button>
      <button onClick={replaceOne} disabled={matches.length === 0}>치환</button>
      <button onClick={replaceAll} disabled={matches.length === 0}>전체</button>
      <button onClick={onClose} title="닫기 (Esc)">×</button>
    </div>
  )
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function walkText(el: Element, fn: (s: string) => string) {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const next = fn(node.textContent || '')
      if (next !== node.textContent) node.textContent = next
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      walkText(node as Element, fn)
    }
  }
}
