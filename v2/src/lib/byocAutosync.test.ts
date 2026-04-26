import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMemosStore, type Memo } from '../store/memosStore'
import { useSettingsStore } from '../store/settingsStore'
import { pushActiveSnapshot } from './activeSync'
import { BYOC_AUTOSYNC_DEBOUNCE_MS, startByocAutosync, stopByocAutosync } from './byocAutosync'

vi.mock('./activeSync', () => ({
  pushActiveSnapshot: vi.fn(async () => true),
}))

function memo(id: string, title: string): Memo {
  const now = Date.now()
  return {
    id,
    title,
    content: `<p>${title}</p>`,
    createdAt: now,
    updatedAt: now,
  }
}

describe('BYOC autosync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(pushActiveSnapshot).mockClear()
    stopByocAutosync()
    useMemosStore.setState({ memos: {}, trashed: {}, currentId: null, order: [], sortMode: 'recent' })
    useSettingsStore.setState({ syncEnabled: false, syncProvider: 'none' })
  })

  afterEach(() => {
    stopByocAutosync()
    vi.useRealTimers()
  })

  it('does not push normal edits while personal storage sync is disabled', async () => {
    startByocAutosync()
    const first = memo('m_disabled', 'disabled')
    useMemosStore.setState({
      memos: { [first.id]: first },
      trashed: {},
      currentId: first.id,
      order: [first.id],
      sortMode: 'recent',
    })

    await vi.advanceTimersByTimeAsync(BYOC_AUTOSYNC_DEBOUNCE_MS + 100)

    expect(pushActiveSnapshot).not.toHaveBeenCalled()
  })

  it('pushes a debounced snapshot after memo edits when local personal storage sync is enabled', async () => {
    const first = memo('m_local_sync', 'local sync')
    useSettingsStore.setState({ syncEnabled: true, syncProvider: 'local' })
    startByocAutosync()

    useMemosStore.setState({
      memos: { [first.id]: first },
      trashed: {},
      currentId: first.id,
      order: [first.id],
      sortMode: 'recent',
    })
    useMemosStore.getState().updateMemo(first.id, { title: 'local sync edited' })

    await vi.advanceTimersByTimeAsync(BYOC_AUTOSYNC_DEBOUNCE_MS - 1)
    expect(pushActiveSnapshot).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    expect(pushActiveSnapshot).toHaveBeenCalledTimes(1)
    expect(pushActiveSnapshot).toHaveBeenCalledWith(first.id)
  })
})
