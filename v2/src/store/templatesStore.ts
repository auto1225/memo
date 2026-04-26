import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createLocalFirstStorage } from '../lib/localFirstStorage'

/**
 * Phase 16 — 사용자 메모 템플릿.
 * 스니펫이 작은 블록이라면, 템플릿은 메모 1개 분량의 큰 골조.
 * "현재 메모를 템플릿으로 저장" + "템플릿으로 새 메모 만들기".
 */
export interface MemoTemplate {
  id: string
  name: string
  title: string // 제목 패턴 ({{date}} 변수 OK)
  content: string // HTML
  category?: string
  createdAt: number
}

interface TemplatesState {
  templates: MemoTemplate[]
  add: (t: Omit<MemoTemplate, 'id' | 'createdAt'>) => string
  remove: (id: string) => void
  update: (id: string, patch: Partial<MemoTemplate>) => void
}

export const useTemplatesStore = create<TemplatesState>()(
  persist(
    (set) => ({
      templates: [],
      add: (t) => {
        const id = 'tpl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6)
        set((s) => ({ templates: [...s.templates, { ...t, id, createdAt: Date.now() }] }))
        return id
      },
      remove: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),
      update: (id, patch) =>
        set((s) => ({ templates: s.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
    }),
    {
      name: 'jan-v2-templates',
      storage: createJSONStorage(() => createLocalFirstStorage()),
    }
  )
)
