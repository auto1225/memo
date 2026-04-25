import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Phase 12 — 자동완성 매크로.
 * `;today` `;now` `;sig` 등 사용자 정의 단축어 → expansion 자동 치환.
 * 변수 치환: {{date}} {{time}} {{user}}.
 */
export interface Macro {
  trigger: string // ';today'
  expansion: string // '{{date}}'
  description?: string
}

interface MacrosState {
  macros: Macro[]
  add: (m: Macro) => void
  remove: (trigger: string) => void
  update: (trigger: string, m: Partial<Macro>) => void
}

const DEFAULT_MACROS: Macro[] = [
  { trigger: ';today', expansion: '{{date}}', description: '오늘 날짜 (예: 2026. 4. 25.)' },
  { trigger: ';now', expansion: '{{datetime}}', description: '날짜 + 시간' },
  { trigger: ';time', expansion: '{{time}}', description: '현재 시간' },
  { trigger: ';sig', expansion: '\n\n--\n작성자: 이름\n', description: '서명 블록' },
  { trigger: ';todo', expansion: '☐ 할 일: ', description: '체크박스 + 라벨' },
  { trigger: ';lorem', expansion: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', description: '플레이스홀더 텍스트' },
]

export const useMacrosStore = create<MacrosState>()(
  persist(
    (set) => ({
      macros: DEFAULT_MACROS,
      add: (m) =>
        set((s) => {
          const filtered = s.macros.filter((x) => x.trigger !== m.trigger)
          return { macros: [...filtered, m] }
        }),
      remove: (trigger) => set((s) => ({ macros: s.macros.filter((m) => m.trigger !== trigger) })),
      update: (trigger, patch) =>
        set((s) => ({
          macros: s.macros.map((m) => (m.trigger === trigger ? { ...m, ...patch } : m)),
        })),
    }),
    { name: 'jan-v2-macros' }
  )
)

/** {{var}} 치환. */
export function expandVars(text: string): string {
  const now = new Date()
  return text
    .replace(/\{\{date\}\}/g, now.toLocaleDateString('ko-KR'))
    .replace(/\{\{time\}\}/g, now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))
    .replace(/\{\{datetime\}\}/g, now.toLocaleString('ko-KR'))
    .replace(/\{\{user\}\}/g, '사용자')
}
