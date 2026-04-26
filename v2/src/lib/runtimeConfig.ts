import { useSettingsStore } from '../store/settingsStore'

declare global {
  interface Window {
    SUPABASE_URL?: string
    SUPABASE_ANON_KEY?: string
  }
}

export interface SupabaseRuntimeConfig {
  url: string
  anonKey: string
  source: 'runtime' | 'settings' | 'missing'
}

export function getSupabaseRuntimeConfig(): SupabaseRuntimeConfig {
  const settings = useSettingsStore.getState()
  const settingsUrl = settings.supabaseUrl.trim()
  const settingsKey = settings.supabaseAnonKey.trim()
  if (settingsUrl && settingsKey) {
    return {
      url: settingsUrl.replace(/\/$/, ''),
      anonKey: settingsKey,
      source: 'settings',
    }
  }

  const runtimeUrl = typeof window !== 'undefined' ? window.SUPABASE_URL?.trim() || '' : ''
  const runtimeKey = typeof window !== 'undefined' ? window.SUPABASE_ANON_KEY?.trim() || '' : ''
  if (runtimeUrl && runtimeKey) {
    return {
      url: runtimeUrl.replace(/\/$/, ''),
      anonKey: runtimeKey,
      source: 'runtime',
    }
  }

  return { url: '', anonKey: '', source: 'missing' }
}

export function hasRuntimeSupabaseConfig(): boolean {
  const cfg = getSupabaseRuntimeConfig()
  return !!(cfg.url && cfg.anonKey)
}
