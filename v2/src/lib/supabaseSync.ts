/**
 * Phase 5 — Supabase 동기화.
 *
 * 가벼운 REST 직접 호출 (supabase-js 추가 의존 없이) — anon key 로 RLS 인증.
 * 테이블 가정: notes (id text pk, title text, content text, updated_at timestamptz, owner_email text).
 *
 * 동기화 정책: last-write-wins (updated_at 비교).
 * 사용자가 RLS 정책을 직접 설정해야 함 (auth.email() = owner_email).
 */
import { useSettingsStore } from '../store/settingsStore'
import { useMemosStore } from '../store/memosStore'

interface RemoteNote {
  id: string
  title: string
  content: string
  updated_at: string
  owner_email: string
}

interface SyncResult {
  ok: boolean
  pushed: number
  pulled: number
  error?: string
}

function getCfg() {
  const s = useSettingsStore.getState()
  return {
    url: s.supabaseUrl.replace(/\/$/, ''),
    key: s.supabaseAnonKey,
    email: s.supabaseEmail,
    enabled: s.syncEnabled,
  }
}

export function syncConfigured(): boolean {
  const c = getCfg()
  return !!(c.url && c.key && c.email)
}

async function fetchRemote(): Promise<RemoteNote[]> {
  const c = getCfg()
  const r = await fetch(
    `${c.url}/rest/v1/notes?select=*&owner_email=eq.${encodeURIComponent(c.email)}`,
    {
      headers: { apikey: c.key, Authorization: `Bearer ${c.key}` },
    }
  )
  if (!r.ok) throw new Error(`Supabase 조회 실패: ${r.status} ${await r.text().catch(() => '')}`)
  return (await r.json()) as RemoteNote[]
}

async function upsertRemote(note: { id: string; title: string; content: string; updatedAt: number }) {
  const c = getCfg()
  const body = {
    id: note.id,
    title: note.title,
    content: note.content,
    updated_at: new Date(note.updatedAt).toISOString(),
    owner_email: c.email,
  }
  const r = await fetch(`${c.url}/rest/v1/notes?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: c.key,
      Authorization: `Bearer ${c.key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`upsert 실패 ${r.status}: ${await r.text().catch(() => '')}`)
}

/** 양방향 동기화. last-write-wins. */
export async function syncNow(): Promise<SyncResult> {
  if (!syncConfigured()) return { ok: false, pushed: 0, pulled: 0, error: '설정 미완료' }
  let pushed = 0,
    pulled = 0
  try {
    const local = useMemosStore.getState().memos
    const remote = await fetchRemote()
    const remoteMap = new Map(remote.map((r) => [r.id, r]))

    // local → remote (로컬이 더 최신)
    for (const id of Object.keys(local)) {
      const lo = local[id]
      const re = remoteMap.get(id)
      if (!re || new Date(re.updated_at).getTime() < lo.updatedAt) {
        await upsertRemote({ id: lo.id, title: lo.title, content: lo.content, updatedAt: lo.updatedAt })
        pushed++
      }
    }

    // remote → local (원격이 더 최신 또는 로컬에 없음)
    for (const re of remote) {
      const lo = local[re.id]
      const reTs = new Date(re.updated_at).getTime()
      if (!lo || lo.updatedAt < reTs) {
        useMemosStore.setState((s) => {
          const merged = {
            ...(lo || {
              id: re.id,
              createdAt: reTs,
            }),
            id: re.id,
            title: re.title || '무제',
            content: re.content || '<p></p>',
            updatedAt: reTs,
          }
          const newOrder = s.order.includes(re.id) ? s.order : [re.id, ...s.order]
          return { memos: { ...s.memos, [re.id]: merged as any }, order: newOrder }
        })
        pulled++
      }
    }
    return { ok: true, pushed, pulled }
  } catch (e: any) {
    return { ok: false, pushed, pulled, error: e.message || String(e) }
  }
}

/** 단일 메모만 푸시 (저장 시 호출). */
export async function pushOne(id: string): Promise<boolean> {
  if (!syncConfigured()) return false
  const m = useMemosStore.getState().memos[id]
  if (!m) return false
  try {
    await upsertRemote({ id: m.id, title: m.title, content: m.content, updatedAt: m.updatedAt })
    return true
  } catch {
    return false
  }
}
