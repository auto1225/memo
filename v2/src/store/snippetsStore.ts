import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Phase 14 — 스니펫 라이브러리.
 * 자주 쓰는 텍스트/HTML 블록 저장 + 즉시 삽입.
 * 매크로와의 차이: 매크로는 trigger 자동 확장, 스니펫은 명시 선택.
 */
export interface Snippet {
  id: string
  name: string
  content: string // HTML
  category?: string
  createdAt: number
}

interface SnippetsState {
  snippets: Snippet[]
  add: (s: Omit<Snippet, 'id' | 'createdAt'>) => string
  remove: (id: string) => void
  update: (id: string, patch: Partial<Snippet>) => void
}

const DEFAULTS: Snippet[] = [
  {
    id: 's_meeting',
    name: '회의록 헤더',
    category: '업무',
    content: '<h2>회의록</h2><p><b>일시:</b> </p><p><b>참석자:</b> </p><p><b>안건:</b></p><ul><li></li></ul>',
    createdAt: 0,
  },
  {
    id: 's_signature',
    name: '서명 블록',
    category: '개인',
    content: '<hr><p>--<br>이름<br>이메일: </p>',
    createdAt: 0,
  },
  {
    id: 's_callout_warn',
    name: '경고 콜아웃',
    category: '서식',
    content: '<div data-callout="true" data-kind="warn"><p>주의: 이 부분은 검토 필요.</p></div>',
    createdAt: 0,
  },
  {
    id: 's_table_3x3',
    name: '3×3 빈 표',
    category: '서식',
    content: '<table><tr><th></th><th></th><th></th></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></table>',
    createdAt: 0,
  },
]

export const useSnippetsStore = create<SnippetsState>()(
  persist(
    (set) => ({
      snippets: DEFAULTS,
      add: (s) => {
        const id = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6)
        const snip: Snippet = { ...s, id, createdAt: Date.now() }
        set((st) => ({ snippets: [...st.snippets, snip] }))
        return id
      },
      remove: (id) => set((s) => ({ snippets: s.snippets.filter((sn) => sn.id !== id) })),
      update: (id, patch) =>
        set((s) => ({
          snippets: s.snippets.map((sn) => (sn.id === id ? { ...sn, ...patch } : sn)),
        })),
    }),
    { name: 'jan-v2-snippets' }
  )
)
