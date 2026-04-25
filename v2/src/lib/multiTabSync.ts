/**
 * Phase 11 — 다중 탭 동기화.
 * BroadcastChannel API 로 같은 origin 탭들 간 메모 변경 즉시 전파.
 * Zustand persist 의 `storage` 이벤트도 동작하지만 폴링 + 비동기.
 * BroadcastChannel 은 동기적이고 더 빠름.
 */
import { useMemosStore } from '../store/memosStore'

const CHANNEL = 'jan-v2-sync'

interface SyncMessage {
  type: 'memos-changed' | 'theme-changed' | 'settings-changed'
  ts: number
  origin: string
}

let channel: BroadcastChannel | null = null
const ORIGIN_ID = 'tab_' + Math.random().toString(36).slice(2, 10)
let suppressBroadcast = false

export function startMultiTabSync() {
  if (typeof BroadcastChannel === 'undefined') return
  if (channel) return
  channel = new BroadcastChannel(CHANNEL)

  channel.addEventListener('message', (e: MessageEvent<SyncMessage>) => {
    if (e.data.origin === ORIGIN_ID) return
    if (e.data.type === 'memos-changed') {
      // localStorage 에서 최신 상태 다시 hydrate
      try {
        const raw = localStorage.getItem('jan:v2:memos')
        if (!raw) return
        const data = JSON.parse(raw)
        suppressBroadcast = true
        useMemosStore.setState(data.state || {})
        suppressBroadcast = false
      } catch {}
    }
  })

  // memosStore 변경 감지 → broadcast
  useMemosStore.subscribe((_state, _prev) => {
    if (suppressBroadcast) return
    channel?.postMessage({ type: 'memos-changed', ts: Date.now(), origin: ORIGIN_ID } as SyncMessage)
  })
}

export function stopMultiTabSync() {
  channel?.close()
  channel = null
}
