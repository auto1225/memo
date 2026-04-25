/**
 * Phase 9 — 드래그앤드롭 + 클립보드 이미지 → editor 삽입.
 * 파일 → FileReader → data URL → editor.setImage.
 */
import { useEffect } from 'react'
import type { Editor } from '@tiptap/react'

const MAX_BYTES = 8 * 1024 * 1024 // 8MB

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

export function useImageDropPaste(editor: Editor | null) {
  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom

    async function insertFile(file: File) {
      if (!editor) return
      if (!file.type.startsWith('image/')) return
      if (file.size > MAX_BYTES) {
        alert(`이미지가 너무 큽니다 (${Math.round(file.size / 1024 / 1024)}MB). 8MB 이하만 지원.`)
        return
      }
      try {
        const url = await fileToDataUrl(file)
        editor.chain().focus().setImage({ src: url }).run()
      } catch (e) {
        console.warn('[image] failed to read', e)
      }
    }

    function onDrop(e: DragEvent) {
      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return
      const images = Array.from(files).filter((f) => f.type.startsWith('image/'))
      if (images.length === 0) return
      e.preventDefault()
      images.forEach(insertFile)
    }

    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const f = it.getAsFile()
          if (f) {
            e.preventDefault()
            insertFile(f)
            return
          }
        }
      }
    }

    dom.addEventListener('drop', onDrop)
    dom.addEventListener('paste', onPaste)
    return () => {
      dom.removeEventListener('drop', onDrop)
      dom.removeEventListener('paste', onPaste)
    }
  }, [editor])
}
