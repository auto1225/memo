import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createLocalFirstStorage } from '../lib/localFirstStorage'
import type { RoleToolId } from '../lib/roles'

export interface TimetableCell { name: string; room?: string; prof?: string; color: string }
export interface LedgerEntry { id: string; type: 'expense' | 'income'; date: string; category: string; amount: number; note?: string }
export interface CourseEntry { id: string; name: string; credit: number; grade: number }
export interface DdayEntry { id: string; title: string; date: string; memo?: string }
export interface MedEntry { id: string; name: string; dose?: string; times: string[] }
export interface VitalEntry { id: string; type: 'bp' | 'glucose' | 'weight'; dt: string; v1: number; v2?: number; pulse?: number; note?: string }
export interface ShopEntry { id: string; name: string; cat: string; done: boolean }
export interface TimeEntry { id: string; name: string; start: number; end: number }
export interface CurrentTimer { name: string; start: number }
export interface AttendanceEntry { id: string; course: string; attended: number; total: number }
export interface SimpleTask { id: string; title: string; owner?: string; due?: string; status?: string; note?: string }
export interface MealPlan { [key: string]: string }

export interface RoleToolData {
  timetable?: { semester: string; cells: Record<string, TimetableCell> }
  ledger?: { entries: LedgerEntry[] }
  gpa?: { scale: number; courses: CourseEntry[] }
  dday?: { list: DdayEntry[] }
  med?: { list: MedEntry[]; log: Record<string, Record<string, number>> }
  vital?: { records: VitalEntry[] }
  shop?: { list: ShopEntry[] }
  meal?: { week: string; plans: Record<string, MealPlan> }
  timetrack?: { entries: TimeEntry[]; current: CurrentTimer | null }
  attendance?: { list: AttendanceEntry[] }
  groupProj?: { tasks: SimpleTask[] }
  examPlan?: { tasks: SimpleTask[] }
  projPipe?: { tasks: SimpleTask[] }
  paperList?: { tasks: SimpleTask[] }
}

interface RoleToolsState {
  selectedRoleIds: string[]
  roleData: RoleToolData
  setSelectedRoleIds: (ids: string[]) => void
  toggleRole: (id: string) => void
  updateTool: <K extends RoleToolId>(id: K, updater: (prev: RoleToolData[K]) => RoleToolData[K]) => void
}

export const makeRoleToolId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`

export const isoDate = () => new Date().toISOString().slice(0, 10)

export const isoMonth = () => new Date().toISOString().slice(0, 7)

export const isoWeek = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const week = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

export const useRoleToolsStore = create<RoleToolsState>()(
  persist(
    (set) => ({
      selectedRoleIds: [],
      roleData: {},
      setSelectedRoleIds: (ids) => set({ selectedRoleIds: [...new Set(ids)] }),
      toggleRole: (id) =>
        set((s) => {
          const selected = s.selectedRoleIds.includes(id)
            ? s.selectedRoleIds.filter((x) => x !== id)
            : [...s.selectedRoleIds, id]
          return { selectedRoleIds: selected }
        }),
      updateTool: (id, updater) =>
        set((s) => ({
          roleData: {
            ...s.roleData,
            [id]: updater(s.roleData[id]),
          },
        })),
    }),
    {
      name: 'jan-v2-role-tools',
      version: 1,
      storage: createJSONStorage(() => createLocalFirstStorage()),
    }
  )
)
