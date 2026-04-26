/**
 * Supabase cloud sync for JustANotepad v2.
 *
 * v1 and production already use `user_data` as a per-user JSON blob protected by
 * Supabase Auth + RLS. v2 keeps that contract and stores a normalized snapshot,
 * instead of writing unauthenticated note rows.
 */
import { getSupabaseRuntimeConfig } from './runtimeConfig'
import type { V2Snapshot } from './snapshot'
import { useMemosStore } from '../store/memosStore'
import { useSettingsStore } from '../store/settingsStore'
import { createPortableV2Snapshot, importV2SnapshotDataAsync } from './v1Import'

interface SupabaseError {
  message?: string
}

export interface SupabaseSession {
  user: {
    id: string
    email?: string
  }
}

interface UserDataRow {
  data: unknown
  updated_at?: string
  version?: number
}

interface SupabaseQueryFilter {
  eq: (column: string, value: string) => SupabaseQueryFilter
  maybeSingle: () => Promise<{ data: UserDataRow | null; error: SupabaseError | null }>
}

interface SupabaseQueryBuilder {
  select: (columns: string) => SupabaseQueryFilter
  upsert: (payload: unknown) => Promise<{ error: SupabaseError | null }>
}

interface SupabaseClientLike {
  auth: {
    getSession: () => Promise<{ data: { session: SupabaseSession | null }; error: SupabaseError | null }>
    signInWithOAuth: (args: {
      provider: 'google'
      options: { redirectTo: string }
    }) => Promise<{ error: SupabaseError | null }>
    signOut: () => Promise<{ error: SupabaseError | null }>
  }
  from: (table: string) => SupabaseQueryBuilder
}

declare global {
  interface Window {
    supabase?: {
      createClient: (url: string, anonKey: string, options?: unknown) => SupabaseClientLike
    }
  }
}

interface SyncResult {
  ok: boolean
  pushed: number
  pulled: number
  error?: string
}

let client: SupabaseClientLike | null = null
let clientKey = ''
let clientPromise: Promise<SupabaseClientLike> | null = null
let clientPromiseKey = ''
let sdkPromise: Promise<void> | null = null

function configKey(url: string, anonKey: string): string {
  return `${url}|${anonKey.slice(0, 12)}`
}

function getRedirectUrl(): string {
  if (typeof window === 'undefined') return 'https://justanotepad.com/v2/'
  return `${window.location.origin}/v2/`
}

function loadSupabaseSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('브라우저 환경이 아닙니다'))
  if (window.supabase) return Promise.resolve()
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-jan-supabase-sdk="true"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Supabase SDK 로딩 실패')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
    script.async = true
    script.dataset.janSupabaseSdk = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Supabase SDK 로딩 실패'))
    document.head.appendChild(script)
  })

  return sdkPromise
}

async function getClient(): Promise<SupabaseClientLike> {
  const cfg = getSupabaseRuntimeConfig()
  if (!cfg.url || !cfg.anonKey) throw new Error('Supabase 설정이 없습니다')

  const key = configKey(cfg.url, cfg.anonKey)
  if (client && clientKey === key) return client
  if (clientPromise && clientPromiseKey === key) return clientPromise

  clientPromiseKey = key
  clientPromise = (async () => {
    await loadSupabaseSdk()
    if (!window.supabase) throw new Error('Supabase SDK를 사용할 수 없습니다')

    client = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
    clientKey = key
    return client
  })()

  try {
    return await clientPromise
  } finally {
    clientPromise = null
    clientPromiseKey = ''
  }
}

export function getSupabaseConfigStatus(): { configured: boolean; source: 'runtime' | 'settings' | 'missing'; url: string } {
  const cfg = getSupabaseRuntimeConfig()
  return { configured: !!(cfg.url && cfg.anonKey), source: cfg.source, url: cfg.url }
}

export function syncConfigured(): boolean {
  return getSupabaseConfigStatus().configured
}

export async function getSession(): Promise<SupabaseSession | null> {
  const sb = await getClient()
  const { data, error } = await sb.auth.getSession()
  if (error) throw new Error(error.message || '세션 확인 실패')
  return data.session
}

export async function signInGoogle(): Promise<{ ok: boolean; error?: string }> {
  try {
    const sb = await getClient()
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getRedirectUrl() },
    })
    if (error) return { ok: false, error: error.message || 'Google 로그인 실패' }
    useSettingsStore.getState().setKey('syncEnabled', true)
    return { ok: true }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function signOut(): Promise<{ ok: boolean; error?: string }> {
  try {
    const sb = await getClient()
    const { error } = await sb.auth.signOut()
    if (error) return { ok: false, error: error.message || '로그아웃 실패' }
    return { ok: true }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

async function fetchCloudSnapshot(session: SupabaseSession): Promise<UserDataRow | null> {
  const sb = await getClient()
  const { data, error } = await sb
    .from('user_data')
    .select('data, updated_at, version')
    .eq('user_id', session.user.id)
    .maybeSingle()
  if (error) throw new Error(error.message || '클라우드 데이터 조회 실패')
  return data
}

async function upsertCloudSnapshot(session: SupabaseSession, snapshot: V2Snapshot): Promise<void> {
  const sb = await getClient()
  const { error } = await sb.from('user_data').upsert({
    user_id: session.user.id,
    data: snapshot,
    version: 2,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message || '클라우드 데이터 저장 실패')
}

async function createCloudSnapshot(): Promise<V2Snapshot> {
  return createPortableV2Snapshot()
}

/** Full bidirectional sync. Remote v1 blobs are migrated into the v2 snapshot shape. */
export async function syncNow(): Promise<SyncResult> {
  if (!syncConfigured()) return { ok: false, pushed: 0, pulled: 0, error: 'Supabase 설정이 없습니다' }

  let pushed = 0
  let pulled = 0
  try {
    const session = await getSession()
    if (!session) return { ok: false, pushed, pulled, error: 'Google 로그인 후 동기화할 수 있습니다' }

    const cloud = await fetchCloudSnapshot(session)
    if (cloud?.data) {
      const imported = await importV2SnapshotDataAsync(cloud.data)
      if (imported.errors.length) return { ok: false, pushed, pulled, error: imported.errors[0] }
      pulled = imported.imported
    }

    await upsertCloudSnapshot(session, await createCloudSnapshot())
    pushed = 1
    useSettingsStore.getState().setKey('syncEnabled', true)
    try {
      localStorage.setItem('jan.v2.sync.lastAt', String(Date.now()))
    } catch {
      // Last-sync display is best-effort; sync success should not depend on localStorage.
    }
    return { ok: true, pushed, pulled }
  } catch (e: unknown) {
    return { ok: false, pushed, pulled, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Autosave hook entry point. The whole snapshot is uploaded to keep order/tags/workspaces coherent. */
export async function pushOne(id: string): Promise<boolean> {
  if (!syncConfigured()) return false
  if (!useSettingsStore.getState().syncEnabled) return false
  if (!useMemosStore.getState().memos[id]) return false

  try {
    const session = await getSession()
    if (!session) return false
    await upsertCloudSnapshot(session, await createCloudSnapshot())
    try {
      localStorage.setItem('jan.v2.sync.lastAt', String(Date.now()))
    } catch {
      // Last-sync display is best-effort; sync success should not depend on localStorage.
    }
    return true
  } catch {
    return false
  }
}
