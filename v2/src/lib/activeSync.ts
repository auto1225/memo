import { useSettingsStore } from '../store/settingsStore'
import { isByocProvider, pushByocSnapshot } from './byocSync'
import { pushOne, syncConfigured } from './supabaseSync'

export async function pushActiveSnapshot(memoId?: string | null): Promise<boolean> {
  const settings = useSettingsStore.getState()
  if (!settings.syncEnabled) return false
  if (isByocProvider(settings.syncProvider)) {
    const result = await pushByocSnapshot()
    return result.ok
  }
  if (settings.syncProvider === 'supabase' && memoId && syncConfigured()) {
    return pushOne(memoId)
  }
  return false
}
