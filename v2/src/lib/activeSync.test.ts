import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pushActiveSnapshot } from './activeSync'
import { syncByocNow } from './byocSync'
import { pushOne } from './supabaseSync'
import { useSettingsStore } from '../store/settingsStore'

vi.mock('./byocSync', () => ({
  isByocProvider: vi.fn((provider: string) => provider === 'local' || provider === 'dropbox' || provider === 'onedrive'),
  syncByocNow: vi.fn(async () => ({ ok: true, provider: 'dropbox', pulled: 1, pushed: 1 })),
}))

vi.mock('./supabaseSync', () => ({
  pushOne: vi.fn(async () => true),
  syncConfigured: vi.fn(() => true),
}))

describe('active sync routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettingsStore.getState().reset()
  })

  it('pulls and merges personal storage before autosync pushes', async () => {
    useSettingsStore.setState({ syncEnabled: true, syncProvider: 'dropbox' })

    await expect(pushActiveSnapshot('memo-1')).resolves.toBe(true)

    expect(syncByocNow).toHaveBeenCalledTimes(1)
    expect(pushOne).not.toHaveBeenCalled()
  })

  it('does not sync when sync is disabled', async () => {
    useSettingsStore.setState({ syncEnabled: false, syncProvider: 'dropbox' })

    await expect(pushActiveSnapshot('memo-1')).resolves.toBe(false)

    expect(syncByocNow).not.toHaveBeenCalled()
    expect(pushOne).not.toHaveBeenCalled()
  })
})
