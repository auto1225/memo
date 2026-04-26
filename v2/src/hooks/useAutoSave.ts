import { useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { useDocStore } from '../store/docStore'
import { saveToFile } from '../lib/fileOps'
import { pushActiveSnapshot } from '../lib/activeSync'
import { useMemosStore } from '../store/memosStore'
import { trackEvent } from '../lib/analytics'

/**
 * Phase 10 — 자동 저장.
 * fileHandle 이 있을 때만 → 사용자가 한 번 명시 저장한 후 자동 저장.
 * 변경 → debounce 2초 → saveToFile.
 */
const DEBOUNCE_MS = 2000

export function useAutoSave(editor: Editor | null, title: string) {
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!editor) return
    function onUpdate() {
      const { fileHandle } = useDocStore.getState()
      if (!fileHandle) return // 명시 저장 전엔 자동 저장 X
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(async () => {
        if (!editor) return
        const html = editor.getHTML()
        const result = await saveToFile({ title, content: html, handle: fileHandle })
        if (result.ok) {
          useDocStore.getState().setSavedAt(Date.now())
          const { currentId } = useMemosStore.getState()
          if (currentId) pushActiveSnapshot(currentId).catch(() => {})
          trackEvent('autosave')
        }
      }, DEBOUNCE_MS)
    }
    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [editor, title])
}
