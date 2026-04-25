/**
 * Phase 7 — Yjs 실시간 협업.
 * 사용자가 설정에서 WebSocket URL + 룸 이름 입력 → 다중 사용자 동시 편집.
 *
 * 무료 공개 서버: wss://demos.yjs.dev/ws (테스트용, 영속 X)
 * 자체 호스팅: y-websocket-server (Node.js)
 */
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

let activeDoc: Y.Doc | null = null
let activeProvider: WebsocketProvider | null = null

export interface CollabHandle {
  ydoc: Y.Doc
  provider: WebsocketProvider
  destroy: () => void
}

export function startCollab(wsUrl: string, room: string, userName: string): CollabHandle | null {
  if (!wsUrl || !room) return null
  stopCollab()
  const ydoc = new Y.Doc()
  const provider = new WebsocketProvider(wsUrl, room, ydoc)
  provider.awareness.setLocalStateField('user', {
    name: userName || 'Anonymous',
    color: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'),
  })
  activeDoc = ydoc
  activeProvider = provider
  return {
    ydoc,
    provider,
    destroy: stopCollab,
  }
}

export function stopCollab() {
  if (activeProvider) {
    activeProvider.disconnect()
    activeProvider.destroy()
    activeProvider = null
  }
  if (activeDoc) {
    activeDoc.destroy()
    activeDoc = null
  }
}

export function isCollabActive(): boolean {
  return !!activeProvider
}
