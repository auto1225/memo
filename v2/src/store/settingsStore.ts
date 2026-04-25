import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 사용자 설정 — API 키, 동기화, 인용 스타일.
 * Phase 5+: AI proxy 모드 추가 (서버 키 사용).
 */
export type CitationStyle = 'apa' | 'ieee' | 'mla'
export type AiProvider = 'anthropic' | 'openai' | 'proxy' | 'none'

interface SettingsState {
  anthropicKey: string
  openaiKey: string
  aiProvider: AiProvider
  aiModel: string

  supabaseUrl: string
  supabaseAnonKey: string
  supabaseEmail: string
  syncEnabled: boolean

  citationStyle: CitationStyle

  setKey: (k: keyof SettingsState, v: string | boolean) => void
  reset: () => void
}

const DEFAULTS = {
  anthropicKey: '',
  openaiKey: '',
  aiProvider: 'none' as AiProvider,
  aiModel: 'claude-sonnet-4-6',
  supabaseUrl: '',
  supabaseAnonKey: '',
  supabaseEmail: '',
  syncEnabled: false,
  citationStyle: 'apa' as CitationStyle,
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setKey: (k, v) => set((s) => ({ ...s, [k]: v })),
      reset: () => set(DEFAULTS),
    }),
    { name: 'jan-v2-settings' }
  )
)
