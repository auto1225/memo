import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Phase 17 — 일일 작성 목표.
 * 사용자가 목표 N자 설정 → 오늘 작성한 글자 수 추적 → 진행률 표시.
 *
 * 추적 로직: 매일 자정 리셋. todayCount 증가는 editor onUpdate 에서 호출.
 */
interface WritingGoalState {
  dailyTarget: number // 0 = 비활성
  todayCount: number
  todayKey: string // YYYY-MM-DD
  totalDays: number
  setTarget: (n: number) => void
  addChars: (n: number) => void
  rolloverIfNewDay: () => void
}

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const useWritingGoalStore = create<WritingGoalState>()(
  persist(
    (set, get) => ({
      dailyTarget: 0,
      todayCount: 0,
      todayKey: todayKey(),
      totalDays: 0,
      setTarget: (n) => set({ dailyTarget: Math.max(0, n) }),
      addChars: (n) => {
        if (n <= 0) return
        get().rolloverIfNewDay()
        set({ todayCount: get().todayCount + n })
      },
      rolloverIfNewDay: () => {
        const k = todayKey()
        const s = get()
        if (s.todayKey !== k) {
          // 어제 목표 달성했으면 streak 증가
          const inc = s.dailyTarget > 0 && s.todayCount >= s.dailyTarget ? 1 : 0
          set({ todayKey: k, todayCount: 0, totalDays: s.totalDays + inc })
        }
      },
    }),
    { name: 'jan-v2-writing-goal' }
  )
)
