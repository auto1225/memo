import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { Editor } from '@tiptap/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { findTextMatches, getReplacementText, type FindReplaceOptions } from '../lib/findReplace'

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
  const [wholeWord, setWholeWord] = useState(false)
  const [matchIdx, setMatchIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const docSnapshot = useEditorDocSnapshot(editor)

  useEffect(() => { inputRef.current?.focus() }, [])

  const findOptions = useMemo<FindReplaceOptions>(() => ({
    query: findText,
    useRegex,
    caseSensitive,
    wholeWord,
    limit: 1000,
  }), [caseSensitive, findText, useRegex, wholeWord])

  const matches = useMemo(() => {
    if (!docSnapshot || !findText) return []
    return findTextMatches(docSnapshot, findOptions)
  }, [docSnapshot, findOptions, findText])

  const activeMatchIdx = matches.length === 0 ? 0 : Math.min(matchIdx, matches.length - 1)

  function jumpTo(idx: number) {
    if (!editor || matches.length === 0) return
    const i = ((idx % matches.length) + matches.length) % matches.length
    setMatchIdx(i)
    const m = matches[i]
    editor.chain().focus().setTextSelection({ from: m.from, to: m.to }).scrollIntoView().run()
  }

  function replaceOne() {
    if (!editor || matches.length === 0) return
    const m = matches[activeMatchIdx]
    replaceTextRange(editor, m.from, m.to, getReplacementText(m, findOptions, replaceText))
    setMatchIdx(activeMatchIdx)
  }

  function replaceAll() {
    if (!editor || matches.length === 0) return
    const tr = editor.state.tr
    for (const m of [...matches].reverse()) {
      tr.insertText(getReplacementText(m, findOptions, replaceText), m.from, m.to)
    }
    editor.view.dispatch(tr.scrollIntoView())
    editor.view.focus()
    setMatchIdx(0)
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
      <label title="전체 단어만"><input type="checkbox" checked={wholeWord} onChange={(e) => setWholeWord(e.target.checked)} />단어</label>
      <span className="jan-findbar-count">{matches.length === 0 ? '0' : `${activeMatchIdx + 1}/${matches.length}`}</span>
      <button onClick={() => jumpTo(activeMatchIdx - 1)} disabled={matches.length === 0} title="이전 (Shift+Enter)">↑</button>
      <button onClick={() => jumpTo(activeMatchIdx + 1)} disabled={matches.length === 0} title="다음 (Enter)">↓</button>
      <button onClick={replaceOne} disabled={matches.length === 0}>바꾸기</button>
      <button onClick={replaceAll} disabled={matches.length === 0}>전체</button>
      <button onClick={onClose} title="닫기 (Esc)">×</button>
    </div>
  )
}

function useEditorDocSnapshot(editor: Editor | null): ProseMirrorNode | null {
  const subscribe = useCallback((emit: () => void) => {
    if (!editor) return () => {}
    editor.on('update', emit)
    return () => editor.off('update', emit)
  }, [editor])

  const getSnapshot = useCallback(() => editor?.state.doc ?? null, [editor])

  return useSyncExternalStore(subscribe, getSnapshot, () => null)
}

function replaceTextRange(editor: Editor, from: number, to: number, replacement: string) {
  editor.view.dispatch(editor.state.tr.insertText(replacement, from, to).scrollIntoView())
  editor.view.focus()
}
