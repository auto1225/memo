import { useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import { resolveBlobRefsInElement, saveDataUrlAsBlobRef } from '../lib/blobRefs'

const MAX_BYTES = 25 * 1024 * 1024

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function useImageDropPaste(editor: Editor | null) {
  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom

    async function insertFile(file: File) {
      if (!editor || !file.type.startsWith('image/')) return
      if (file.size > MAX_BYTES) {
        alert(`이미지가 너무 큽니다 (${Math.round(file.size / 1024 / 1024)}MB). 25MB 이하만 지원합니다.`)
        return
      }

      try {
        const dataUrl = await fileToDataUrl(file)
        const ref = await saveDataUrlAsBlobRef(dataUrl)
        editor.chain().focus().setImage({ src: ref }).run()
        window.setTimeout(() => {
          resolveBlobRefsInElement(editor.view.dom).catch(() => {})
        }, 0)
      } catch (e) {
        console.warn('[image] failed to read', e)
      }
    }

    function onDrop(e: DragEvent) {
      const files = e.dataTransfer?.files
      if (!files?.length) return
      const images = Array.from(files).filter((file) => file.type.startsWith('image/'))
      if (!images.length) return
      e.preventDefault()
      images.forEach(insertFile)
    }

    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
        const file = item.getAsFile()
        if (!file) continue
        e.preventDefault()
        insertFile(file)
        return
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
