import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createLocalFirstStorage } from '../lib/localFirstStorage'

export interface CardMeeting {
  id: string
  date: string
  place: string
  note: string
  createdAt: number
}

export interface BusinessCard {
  id: string
  name: string
  nameEn: string
  company: string
  department: string
  position: string
  mobile: string
  phone: string
  fax: string
  email: string
  website: string
  address: string
  group: string
  tags: string[]
  memo: string
  favorite: boolean
  sns: Record<string, string>
  meetings: CardMeeting[]
  frontImage?: string
  backImage?: string
  createdAt: number
  updatedAt: number
}

interface BusinessCardsState {
  cards: Record<string, BusinessCard>
  groups: string[]
  myCardId: string | null
  addCard: (card: BusinessCardInput) => string
  updateCard: (id: string, patch: Partial<BusinessCardInput>) => void
  deleteCard: (id: string) => void
  toggleFavorite: (id: string) => void
  addGroup: (name: string) => void
  removeGroup: (name: string) => void
  renameGroup: (oldName: string, newName: string) => void
  setMyCard: (id: string | null) => void
  importCards: (cards: BusinessCardInput[]) => number
  addMeeting: (cardId: string, meeting: Omit<CardMeeting, 'id' | 'createdAt'>) => void
}

export type BusinessCardInput = Omit<BusinessCard, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string
  createdAt?: number
  updatedAt?: number
}

function makeId(prefix = 'bc'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizeTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map((tag) => tag.trim().replace(/^#/, '').toLowerCase()).filter(Boolean)))
}

function normalizeCard(input: BusinessCardInput): BusinessCard {
  const now = Date.now()
  return {
    id: input.id || makeId(),
    name: input.name?.trim() || '',
    nameEn: input.nameEn?.trim() || '',
    company: input.company?.trim() || '',
    department: input.department?.trim() || '',
    position: input.position?.trim() || '',
    mobile: input.mobile?.trim() || '',
    phone: input.phone?.trim() || '',
    fax: input.fax?.trim() || '',
    email: input.email?.trim() || '',
    website: input.website?.trim() || '',
    address: input.address?.trim() || '',
    group: input.group?.trim() || '',
    tags: normalizeTags(input.tags || []),
    memo: input.memo?.trim() || '',
    favorite: input.favorite === true,
    sns: input.sns || {},
    meetings: input.meetings || [],
    frontImage: input.frontImage,
    backImage: input.backImage,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  }
}

function mergeGroups(existing: string[], card: BusinessCard): string[] {
  if (!card.group || existing.includes(card.group)) return existing
  return [...existing, card.group].sort((a, b) => a.localeCompare(b, 'ko'))
}

export const useBusinessCardsStore = create<BusinessCardsState>()(
  persist(
    (set) => ({
      cards: {},
      groups: [],
      myCardId: null,

      addCard: (input) => {
        const card = normalizeCard(input)
        set((state) => ({
          cards: { ...state.cards, [card.id]: card },
          groups: mergeGroups(state.groups, card),
        }))
        return card.id
      },

      updateCard: (id, patch) => {
        set((state) => {
          const current = state.cards[id]
          if (!current) return state
          const card = normalizeCard({ ...current, ...patch, id, createdAt: current.createdAt, updatedAt: Date.now() })
          return {
            cards: { ...state.cards, [id]: card },
            groups: mergeGroups(state.groups, card),
          }
        })
      },

      deleteCard: (id) => {
        set((state) => {
          const cards = { ...state.cards }
          delete cards[id]
          return {
            cards,
            myCardId: state.myCardId === id ? null : state.myCardId,
          }
        })
      },

      toggleFavorite: (id) => {
        set((state) => {
          const card = state.cards[id]
          if (!card) return state
          return {
            cards: {
              ...state.cards,
              [id]: { ...card, favorite: !card.favorite, updatedAt: Date.now() },
            },
          }
        })
      },

      addGroup: (name) => {
        const clean = name.trim()
        if (!clean) return
        set((state) => ({
          groups: state.groups.includes(clean) ? state.groups : [...state.groups, clean].sort((a, b) => a.localeCompare(b, 'ko')),
        }))
      },

      removeGroup: (name) => {
        set((state) => {
          const cards: Record<string, BusinessCard> = {}
          for (const [id, card] of Object.entries(state.cards)) {
            cards[id] = card.group === name ? { ...card, group: '', updatedAt: Date.now() } : card
          }
          return {
            cards,
            groups: state.groups.filter((group) => group !== name),
          }
        })
      },

      renameGroup: (oldName, newName) => {
        const clean = newName.trim()
        if (!oldName || !clean) return
        set((state) => {
          const cards: Record<string, BusinessCard> = {}
          for (const [id, card] of Object.entries(state.cards)) {
            cards[id] = card.group === oldName ? { ...card, group: clean, updatedAt: Date.now() } : card
          }
          const groups = state.groups.map((group) => (group === oldName ? clean : group))
          return {
            cards,
            groups: Array.from(new Set(groups)).sort((a, b) => a.localeCompare(b, 'ko')),
          }
        })
      },

      setMyCard: (id) => set({ myCardId: id }),

      importCards: (inputs) => {
        const normalized = inputs.map(normalizeCard)
        set((state) => {
          const cards = { ...state.cards }
          let groups = state.groups
          for (const card of normalized) {
            cards[card.id] = card
            groups = mergeGroups(groups, card)
          }
          return { cards, groups }
        })
        return normalized.length
      },

      addMeeting: (cardId, meeting) => {
        set((state) => {
          const card = state.cards[cardId]
          if (!card) return state
          const next: CardMeeting = { ...meeting, id: makeId('mt'), createdAt: Date.now() }
          return {
            cards: {
              ...state.cards,
              [cardId]: { ...card, meetings: [next, ...card.meetings], updatedAt: Date.now() },
            },
          }
        })
      },
    }),
    {
      name: 'jan-v2-business-cards',
      version: 1,
      storage: createJSONStorage(() => createLocalFirstStorage()),
    }
  )
)
