/**
 * Same-origin tab sync.
 *
 * v2 now persists memo data through IndexedDB-backed local-first storage.
 * BroadcastChannel therefore carries the latest memo payload directly so a
 * second tab does not race an async IndexedDB write.
 */
import { useMemosStore } from '../store/memosStore'
import { readPersistedJson } from './localFirstStorage'

const CHANNEL = 'jan-v2-sync'

type MemosPayload = Pick<ReturnType<typeof useMemosStore.getState>, 'memos' | 'trashed' | 'currentId' | 'order' | 'sortMode'>

interface SyncMessage {
  type: 'memos-changed' | 'theme-changed' | 'settings-changed'
  ts: number
  origin: string
  memos?: MemosPayload
}

let channel: BroadcastChannel | null = null
const ORIGIN_ID = 'tab_' + Math.random().toString(36).slice(2, 10)
let suppressBroadcast = false

export function startMultiTabSync() {
  if (typeof BroadcastChannel === 'undefined') return
  if (channel) return
  channel = new BroadcastChannel(CHANNEL)

  channel.addEventListener('message', async (e: MessageEvent<SyncMessage>) => {
    if (e.data.origin === ORIGIN_ID) return
    if (e.data.type !== 'memos-changed') return

    try {
      const data = e.data.memos || (await readPersistedJson<MemosPayload>('jan:v2:memos'))?.state
      if (!data) return
      suppressBroadcast = true
      useMemosStore.setState(data)
      suppressBroadcast = false
    } catch {
      suppressBroadcast = false
    }
  })

  useMemosStore.subscribe((state) => {
    if (suppressBroadcast) return
    channel?.postMessage({
      type: 'memos-changed',
      ts: Date.now(),
      origin: ORIGIN_ID,
      memos: {
        memos: state.memos,
        trashed: state.trashed,
        currentId: state.currentId,
        order: state.order,
        sortMode: state.sortMode,
      },
    } as SyncMessage)
  })
}

export function stopMultiTabSync() {
  channel?.close()
  channel = null
}
