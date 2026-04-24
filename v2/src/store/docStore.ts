import { create } from 'zustand'
import type { Editor } from '@tiptap/react'

interface DocState {
  content: string
  title: string
  editor: Editor | null
  savedAt: number | null
  fileHandle: FileSystemFileHandle | null
  setContent: (html: string) => void
  setTitle: (title: string) => void
  setEditor: (editor: Editor | null) => void
  setSavedAt: (ts: number) => void
  setFileHandle: (handle: FileSystemFileHandle | null) => void
  reset: () => void
}

export const useDocStore = create<DocState>((set) => ({
  content: '',
  title: '새 메모',
  editor: null,
  savedAt: null,
  fileHandle: null,
  setContent: (html) => set({ content: html }),
  setTitle: (title) => set({ title }),
  setEditor: (editor) => set({ editor }),
  setSavedAt: (ts) => set({ savedAt: ts }),
  setFileHandle: (handle) => set({ fileHandle: handle }),
  reset: () => set({ content: '', title: '새 메모', savedAt: null, fileHandle: null }),
}))
