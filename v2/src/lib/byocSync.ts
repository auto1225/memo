import { useSettingsStore, type SyncProvider } from '../store/settingsStore'
import { exportV2ToJson, importV2FromJsonAsync } from './v1Import'

const DB_NAME = 'jan-v2-byoc'
const DB_VERSION = 1
const HANDLE_STORE = 'handles'
const LOCAL_ROOT_KEY = 'local-root'
const SNAPSHOT_PATH = 'JustANotepad-v2/snapshot.json'
const META_PATH = 'JustANotepad-v2/_meta.json'

const DROPBOX_TOKEN_KEY = 'jan.v2.dropbox.token'
const DROPBOX_REFRESH_KEY = 'jan.v2.dropbox.refresh'
const DROPBOX_EXPIRES_KEY = 'jan.v2.dropbox.expires'
const DROPBOX_PKCE_KEY = 'jan.v2.dropbox.pkce'
const DROPBOX_STATE_KEY = 'jan.v2.dropbox.state'

interface DropboxTokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

interface DropboxAccountResponse {
  email?: string
  name?: {
    display_name?: string
  }
}

interface ByocMeta {
  app: 'justanotepad'
  version: 2
  updatedAt: string
  provider: SyncProvider
}

type FileSystemPermissionMode = { mode: 'read' | 'readwrite' }
type PermissionedDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (permission: FileSystemPermissionMode) => Promise<PermissionState>
  requestPermission?: (permission: FileSystemPermissionMode) => Promise<PermissionState>
}

export interface ByocSyncResult {
  ok: boolean
  provider: SyncProvider
  pushed: number
  pulled: number
  error?: string
}

export interface ByocStatus {
  provider: SyncProvider
  ready: boolean
  label: string
  detail?: string
}

declare global {
  interface Window {
    DROPBOX_CLIENT_ID?: string
  }
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is not available'))
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(HANDLE_STORE)) db.createObjectStore(HANDLE_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'))
  })
  return dbPromise
}

async function handleStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, mode)
    const request = run(tx.objectStore(HANDLE_STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || tx.error || new Error('IndexedDB request failed'))
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'))
  })
}

function getSettingsProvider(): SyncProvider {
  return useSettingsStore.getState().syncProvider || 'supabase'
}

function getDropboxClientId(): string {
  const fromSettings = useSettingsStore.getState().dropboxClientId.trim()
  if (fromSettings) return fromSettings
  return typeof window !== 'undefined' ? window.DROPBOX_CLIENT_ID?.trim() || '' : ''
}

function getDropboxRedirectUri(): string {
  if (typeof window === 'undefined') return 'https://justanotepad.com/v2/'
  return `${window.location.origin}${window.location.pathname}`
}

function safeLocalGet(key: string): string {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function safeLocalSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    return
  }
}

function safeLocalRemove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    return
  }
}

async function sha256Base64Url(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = String.fromCharCode(...new Uint8Array(digest))
  return btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomToken(size = 48): string {
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function ensureWritePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const permissioned = handle as PermissionedDirectoryHandle
  const permission = { mode: 'readwrite' } as const
  if (!permissioned.queryPermission || !permissioned.requestPermission) return true
  if ((await permissioned.queryPermission(permission)) === 'granted') return true
  return (await permissioned.requestPermission(permission)) === 'granted'
}

async function putLocalRoot(handle: FileSystemDirectoryHandle): Promise<void> {
  await handleStore<IDBValidKey>('readwrite', (store) => store.put(handle, LOCAL_ROOT_KEY))
}

async function getStoredLocalRoot(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await handleStore<FileSystemDirectoryHandle | undefined>('readonly', (store) => store.get(LOCAL_ROOT_KEY))
    return handle || null
  } catch {
    return null
  }
}

async function getWritableLocalRoot(): Promise<FileSystemDirectoryHandle> {
  const handle = await getStoredLocalRoot()
  if (!handle) throw new Error('먼저 내 PC/클라우드 폴더를 선택하세요')
  if (!(await ensureWritePermission(handle))) throw new Error('선택한 폴더의 쓰기 권한이 필요합니다')
  return handle
}

async function getNestedFile(root: FileSystemDirectoryHandle, path: string, create: boolean): Promise<FileSystemFileHandle> {
  const parts = path.split('/').filter(Boolean)
  const fileName = parts.pop()
  if (!fileName) throw new Error('파일 경로가 비어 있습니다')
  let dir = root
  for (const part of parts) dir = await dir.getDirectoryHandle(part, { create })
  return dir.getFileHandle(fileName, { create })
}

async function writeLocalFile(path: string, data: string): Promise<void> {
  const root = await getWritableLocalRoot()
  const file = await getNestedFile(root, path, true)
  const writable = await file.createWritable()
  await writable.write(data)
  await writable.close()
}

async function readLocalFile(path: string): Promise<string> {
  const root = await getWritableLocalRoot()
  const file = await getNestedFile(root, path, false)
  return (await file.getFile()).text()
}

function saveDropboxTokens(tokens: DropboxTokenResponse) {
  if (tokens.access_token) safeLocalSet(DROPBOX_TOKEN_KEY, tokens.access_token)
  if (tokens.refresh_token) safeLocalSet(DROPBOX_REFRESH_KEY, tokens.refresh_token)
  if (tokens.expires_in) safeLocalSet(DROPBOX_EXPIRES_KEY, String(Date.now() + tokens.expires_in * 1000))
}

function clearDropboxTokens() {
  safeLocalRemove(DROPBOX_TOKEN_KEY)
  safeLocalRemove(DROPBOX_REFRESH_KEY)
  safeLocalRemove(DROPBOX_EXPIRES_KEY)
}

function hasDropboxToken(): boolean {
  return !!safeLocalGet(DROPBOX_TOKEN_KEY) || !!safeLocalGet(DROPBOX_REFRESH_KEY)
}

async function refreshDropboxToken(clientId: string): Promise<string> {
  const refreshToken = safeLocalGet(DROPBOX_REFRESH_KEY)
  if (!refreshToken) throw new Error('Dropbox 재로그인이 필요합니다')

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  })
  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = (await response.json()) as DropboxTokenResponse
  if (!response.ok || data.error) throw new Error(data.error_description || data.error || 'Dropbox 토큰 갱신 실패')
  saveDropboxTokens(data)
  return safeLocalGet(DROPBOX_TOKEN_KEY)
}

async function getDropboxAccessToken(): Promise<string> {
  const clientId = getDropboxClientId()
  if (!clientId) throw new Error('Dropbox Client ID를 설정하세요')

  const accessToken = safeLocalGet(DROPBOX_TOKEN_KEY)
  const expiresAt = Number(safeLocalGet(DROPBOX_EXPIRES_KEY) || '0')
  if (accessToken && Date.now() < expiresAt - 30_000) return accessToken
  if (safeLocalGet(DROPBOX_REFRESH_KEY)) return refreshDropboxToken(clientId)
  if (accessToken) return accessToken
  throw new Error('Dropbox 로그인이 필요합니다')
}

async function dropboxFetch<T>(
  endpoint: string,
  args: Record<string, unknown>,
  options: { content?: boolean; body?: string; download?: boolean } = {}
): Promise<T> {
  const token = await getDropboxAccessToken()
  const host = options.content ? 'content.dropboxapi.com' : 'api.dropboxapi.com'
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  }
  if (options.content) headers['Dropbox-API-Arg'] = JSON.stringify(args)
  else headers['Content-Type'] = 'application/json'
  if (options.body != null) headers['Content-Type'] = 'application/octet-stream'

  const response = await fetch(`https://${host}${endpoint}`, {
    method: 'POST',
    headers,
    body: options.body != null ? options.body : options.content ? undefined : JSON.stringify(args),
  })
  if (response.status === 401) {
    clearDropboxTokens()
    throw new Error('Dropbox 인증이 만료되었습니다. 다시 로그인하세요')
  }
  if (!response.ok) throw new Error(`Dropbox API 오류: ${response.status} ${await response.text()}`)
  if (options.download) return (await response.text()) as T
  return (await response.json()) as T
}

function toDropboxPath(path: string): string {
  return '/' + path.replace(/^\/+/, '')
}

function isMissingRemoteSnapshot(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /not.?found|path\/not_found|파일.*찾을 수 없습니다|not exist|404|409/i.test(error.message)
}

async function writeProviderFile(provider: SyncProvider, path: string, data: string): Promise<void> {
  if (provider === 'local') await writeLocalFile(path, data)
  else if (provider === 'dropbox') await writeDropboxFile(path, data)
  else throw new Error('개인 저장소 provider가 선택되지 않았습니다')
}

async function readProviderFile(provider: SyncProvider, path: string): Promise<string> {
  if (provider === 'local') return readLocalFile(path)
  if (provider === 'dropbox') return readDropboxFile(path)
  throw new Error('개인 저장소 provider가 선택되지 않았습니다')
}

async function writeDropboxFile(path: string, data: string): Promise<void> {
  await dropboxFetch('/2/files/upload', {
    path: toDropboxPath(path),
    mode: 'overwrite',
    autorename: false,
    mute: true,
    strict_conflict: false,
  }, { content: true, body: data })
}

async function readDropboxFile(path: string): Promise<string> {
  return dropboxFetch<string>('/2/files/download', { path: toDropboxPath(path) }, { content: true, download: true })
}

export async function chooseLocalSyncFolder(): Promise<ByocStatus> {
  const picker = (window as Window & {
    showDirectoryPicker?: (options?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
  }).showDirectoryPicker
  if (!picker) throw new Error('이 브라우저는 폴더 선택을 지원하지 않습니다. Chrome 또는 Edge에서 사용하거나 Dropbox를 사용하세요')
  const handle = await picker({ id: 'justanotepad-v2-sync', mode: 'readwrite' })
  if (!(await ensureWritePermission(handle))) throw new Error('폴더 쓰기 권한이 필요합니다')
  await putLocalRoot(handle)
  useSettingsStore.getState().setKey('syncProvider', 'local')
  useSettingsStore.getState().setKey('syncEnabled', true)
  return { provider: 'local', ready: true, label: '내 PC/클라우드 폴더', detail: handle.name }
}

export async function startDropboxOAuth(): Promise<void> {
  const clientId = getDropboxClientId()
  if (!clientId) throw new Error('Dropbox Client ID를 먼저 입력하세요')
  const verifier = randomToken(48)
  const challenge = await sha256Base64Url(verifier)
  const state = randomToken(20)
  safeLocalSet(DROPBOX_PKCE_KEY, verifier)
  safeLocalSet(DROPBOX_STATE_KEY, state)

  const url = new URL('https://www.dropbox.com/oauth2/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', getDropboxRedirectUri())
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('token_access_type', 'offline')
  url.searchParams.set('state', state)
  window.location.assign(url.toString())
}

export async function handleDropboxOAuthRedirectIfNeeded(): Promise<ByocStatus | null> {
  if (typeof window === 'undefined') return null
  const url = new URL(window.location.href)
  const error = url.searchParams.get('error')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!error && !code) return null
  if (error) throw new Error(`Dropbox OAuth 오류: ${url.searchParams.get('error_description') || error}`)
  if (!code) return null
  if (state !== safeLocalGet(DROPBOX_STATE_KEY)) throw new Error('Dropbox OAuth state가 일치하지 않습니다')
  const verifier = safeLocalGet(DROPBOX_PKCE_KEY)
  const clientId = getDropboxClientId()
  if (!verifier || !clientId) throw new Error('Dropbox OAuth 검증 정보가 없습니다')

  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: clientId,
    code_verifier: verifier,
    redirect_uri: getDropboxRedirectUri(),
  })
  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = (await response.json()) as DropboxTokenResponse
  if (!response.ok || data.error) throw new Error(data.error_description || data.error || 'Dropbox 토큰 교환 실패')
  saveDropboxTokens(data)
  safeLocalRemove(DROPBOX_PKCE_KEY)
  safeLocalRemove(DROPBOX_STATE_KEY)
  url.searchParams.delete('code')
  url.searchParams.delete('state')
  url.searchParams.delete('error')
  url.searchParams.delete('error_description')
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`)
  useSettingsStore.getState().setKey('syncProvider', 'dropbox')
  useSettingsStore.getState().setKey('syncEnabled', true)
  return getByocStatus('dropbox')
}

export async function getByocStatus(provider = getSettingsProvider()): Promise<ByocStatus> {
  if (provider === 'local') {
    const root = await getStoredLocalRoot()
    return {
      provider,
      ready: !!root,
      label: '내 PC/클라우드 폴더',
      detail: root?.name || '폴더 선택 필요',
    }
  }
  if (provider === 'dropbox') {
    if (!hasDropboxToken()) {
      return { provider, ready: false, label: 'Dropbox', detail: '로그인 필요' }
    }
    try {
      const account = await dropboxFetch<DropboxAccountResponse>('/2/users/get_current_account', {})
      return {
        provider,
        ready: true,
        label: 'Dropbox',
        detail: account.email || account.name?.display_name || '연결됨',
      }
    } catch (error: unknown) {
      return { provider, ready: false, label: 'Dropbox', detail: error instanceof Error ? error.message : String(error) }
    }
  }
  if (provider === 'supabase') return { provider, ready: true, label: 'Supabase', detail: '관리형 서버 동기화' }
  return { provider: 'none', ready: false, label: '오프라인', detail: '이 기기에만 저장' }
}

export async function pushByocSnapshot(): Promise<ByocSyncResult> {
  const provider = getSettingsProvider()
  if (provider !== 'local' && provider !== 'dropbox') {
    return { ok: false, provider, pushed: 0, pulled: 0, error: '개인 저장소 provider가 선택되지 않았습니다' }
  }
  try {
    const json = await exportV2ToJson()
    const meta: ByocMeta = {
      app: 'justanotepad',
      version: 2,
      updatedAt: new Date().toISOString(),
      provider,
    }
    await writeProviderFile(provider, SNAPSHOT_PATH, json)
    await writeProviderFile(provider, META_PATH, JSON.stringify(meta, null, 2))
    safeLocalSet('jan.v2.sync.lastAt', String(Date.now()))
    return { ok: true, provider, pushed: 1, pulled: 0 }
  } catch (error: unknown) {
    return { ok: false, provider, pushed: 0, pulled: 0, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function pullByocSnapshot(): Promise<ByocSyncResult> {
  const provider = getSettingsProvider()
  if (provider !== 'local' && provider !== 'dropbox') {
    return { ok: false, provider, pushed: 0, pulled: 0, error: '개인 저장소 provider가 선택되지 않았습니다' }
  }
  try {
    const json = await readProviderFile(provider, SNAPSHOT_PATH)
    const result = await importV2FromJsonAsync(json)
    if (result.errors.length) throw new Error(result.errors.join(', '))
    safeLocalSet('jan.v2.sync.lastAt', String(Date.now()))
    return { ok: true, provider, pushed: 0, pulled: result.imported }
  } catch (error: unknown) {
    return { ok: false, provider, pushed: 0, pulled: 0, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function syncByocNow(): Promise<ByocSyncResult> {
  const provider = getSettingsProvider()
  if (provider !== 'local' && provider !== 'dropbox') {
    return { ok: false, provider, pushed: 0, pulled: 0, error: '개인 저장소 provider가 선택되지 않았습니다' }
  }

  try {
    let pulled = 0
    try {
      const json = await readProviderFile(provider, SNAPSHOT_PATH)
      const result = await importV2FromJsonAsync(json)
      if (result.errors.length) throw new Error(result.errors.join(', '))
      pulled = result.imported
    } catch (error: unknown) {
      if (!isMissingRemoteSnapshot(error)) throw error
    }

    const pushed = await pushByocSnapshot()
    if (!pushed.ok) throw new Error(pushed.error || '개인 저장소 백업 실패')
    return { ok: true, provider, pushed: pushed.pushed, pulled }
  } catch (error: unknown) {
    return { ok: false, provider, pushed: 0, pulled: 0, error: error instanceof Error ? error.message : String(error) }
  }
}

export function isByocProvider(provider = getSettingsProvider()): boolean {
  return provider === 'local' || provider === 'dropbox'
}
