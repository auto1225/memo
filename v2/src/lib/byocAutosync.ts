import { useMemosStore } from '../store/memosStore'
import { useSettingsStore } from '../store/settingsStore'
import { pushActiveSnapshot } from './activeSync'
import { isByocProvider } from './byocSync'

export const BYOC_AUTOSYNC_DEBOUNCE_MS = 2500

let unsubscribe: (() => void) | null = null
let timer: number | null = null
let pendingMemoId: string | null = null
let pushing = false
let pushAgainAfterCurrent = false

function clearTimer() {
  if (timer != null && typeof window !== 'undefined') window.clearTimeout(timer)
  timer = null
}

function canAutosync() {
  const settings = useSettingsStore.getState()
  return settings.syncEnabled && isByocProvider(settings.syncProvider)
}

function scheduleByocPush(memoId?: string | null) {
  if (typeof window === 'undefined') return
  if (!canAutosync()) {
    clearTimer()
    return
  }
  pendingMemoId = memoId ?? useMemosStore.getState().currentId
  clearTimer()
  timer = window.setTimeout(() => {
    timer = null
    void flushByocPush()
  }, BYOC_AUTOSYNC_DEBOUNCE_MS)
}

async function flushByocPush() {
  if (!canAutosync()) return
  if (pushing) {
    pushAgainAfterCurrent = true
    return
  }
  pushing = true
  try {
    await pushActiveSnapshot(pendingMemoId)
  } catch {
    // The settings screen exposes manual retry/status; autosync should never block editing.
  } finally {
    pushing = false
    if (pushAgainAfterCurrent) {
      pushAgainAfterCurrent = false
      scheduleByocPush(pendingMemoId)
    }
  }
}

export function startByocAutosync() {
  if (typeof window === 'undefined') return
  if (unsubscribe) return
  unsubscribe = useMemosStore.subscribe((state, previous) => {
    if (
      state.memos === previous.memos &&
      state.trashed === previous.trashed &&
      state.order === previous.order &&
      state.currentId === previous.currentId &&
      state.sortMode === previous.sortMode
    ) {
      return
    }
    scheduleByocPush(state.currentId)
  })
}

export function stopByocAutosync() {
  clearTimer()
  unsubscribe?.()
  unsubscribe = null
  pendingMemoId = null
  pushing = false
  pushAgainAfterCurrent = false
}
