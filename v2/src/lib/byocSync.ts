import { useSettingsStore, type SyncProvider } from '../store/settingsStore'
import { importV2FromJsonAsync } from './v1Import'
import { createV2Snapshot, type V2Snapshot } from './snapshot'
import { exportAttachments, type AttachmentSnapshot } from './attachments'
import { readBlobRef } from './blobRefs'

const DB_NAME = 'jan-v2-byoc'
const DB_VERSION = 1
const HANDLE_STORE = 'handles'
const LOCAL_ROOT_KEY = 'local-root'
const SNAPSHOT_PATH = 'JustANotepad-v2/snapshot.json'
const META_PATH = 'JustANotepad-v2/_meta.json'
const CONTENT_BLOB_PREFIX = 'jan-blob://'
const ATTACHMENT_REF_PREFIX = 'jan-byoc-attachment://'
const SIDECAR_EXT = '.dataurl'

const DROPBOX_TOKEN_KEY = 'jan.v2.dropbox.token'
const DROPBOX_REFRESH_KEY = 'jan.v2.dropbox.refresh'
const DROPBOX_EXPIRES_KEY = 'jan.v2.dropbox.expires'
const DROPBOX_PKCE_KEY = 'jan.v2.dropbox.pkce'
const DROPBOX_STATE_KEY = 'jan.v2.dropbox.state'

const ONEDRIVE_TOKEN_KEY = 'jan.v2.onedrive.token'
const ONEDRIVE_REFRESH_KEY = 'jan.v2.onedrive.refresh'
const ONEDRIVE_EXPIRES_KEY = 'jan.v2.onedrive.expires'
const ONEDRIVE_PKCE_KEY = 'jan.v2.onedrive.pkce'
const ONEDRIVE_STATE_KEY = 'jan.v2.onedrive.state'
const ONEDRIVE_SCOPE = 'offline_access Files.ReadWrite.AppFolder User.Read'

interface DropboxTokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

interface OneDriveTokenResponse {
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

interface OneDriveAccountResponse {
  displayName?: string
  mail?: string
  userPrincipalName?: string
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
    ONEDRIVE_CLIENT_ID?: string
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

function getOneDriveClientId(): string {
  const fromSettings = useSettingsStore.getState().onedriveClientId.trim()
  if (fromSettings) return fromSettings
  return typeof window !== 'undefined' ? window.ONEDRIVE_CLIENT_ID?.trim() || '' : ''
}

function getDropboxRedirectUri(): string {
  if (typeof window === 'undefined') return 'https://justanotepad.com/v2/'
  return `${window.location.origin}${window.location.pathname}`
}

function getOneDriveRedirectUri(): string {
  if (typeof window === 'undefined') return 'https://justanotepad.com/v2/'
  return `${window.location.origin}${window.location.pathname}`
}

function isPersonalStorageProvider(provider: SyncProvider): provider is 'local' | 'dropbox' | 'onedrive' {
  return provider === 'local' || provider === 'dropbox' || provider === 'onedrive'
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

function encodePathSegment(value: string): string {
  return encodeURIComponent(value).replace(/\./g, '%2E')
}

function blobSidecarPath(id: string): string {
  return `JustANotepad-v2/blobs/${encodePathSegment(id)}${SIDECAR_EXT}`
}

function attachmentSidecarPath(id: string): string {
  return `JustANotepad-v2/attachments/${encodePathSegment(id)}${SIDECAR_EXT}`
}

function attachmentRef(id: string): string {
  return ATTACHMENT_REF_PREFIX + encodeURIComponent(id)
}

function attachmentRefId(ref: string): string {
  const raw = ref.slice(ATTACHMENT_REF_PREFIX.length)
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function collectBlobIdsFromText(text: string): string[] {
  const ids = new Set<string>()
  for (const match of text.matchAll(/jan-blob:\/\/([a-z0-9]+)/gi)) {
    if (match[1]) ids.add(match[1])
  }
  return Array.from(ids).sort()
}

async function writeBlobSidecars(provider: SyncProvider, snapshot: V2Snapshot): Promise<void> {
  for (const id of collectBlobIdsFromText(JSON.stringify(snapshot))) {
    const dataUrl = await readBlobRef(CONTENT_BLOB_PREFIX + id)
    if (!dataUrl) continue
    await writeProviderFile(provider, blobSidecarPath(id), dataUrl)
  }
}

async function addAttachmentSidecars(provider: SyncProvider, snapshot: V2Snapshot): Promise<void> {
  const attachments = await exportAttachments()
  if (!attachments.length) return
  snapshot.extras = snapshot.extras || {}
  const manifest: AttachmentSnapshot[] = []
  for (const item of attachments) {
    await writeProviderFile(provider, attachmentSidecarPath(item.id), item.dataUrl)
    manifest.push({ ...item, dataUrl: attachmentRef(item.id) })
  }
  snapshot.extras.attachments = manifest
}

async function createByocSnapshotJson(provider: SyncProvider): Promise<string> {
  const snapshot = createV2Snapshot()
  await writeBlobSidecars(provider, snapshot)
  await addAttachmentSidecars(provider, snapshot)
  return JSON.stringify(snapshot, null, 2)
}

async function readMissingTolerant(provider: SyncProvider, path: string): Promise<string | null> {
  try {
    return await readProviderFile(provider, path)
  } catch (error: unknown) {
    if (isMissingRemoteSnapshot(error)) return null
    throw error
  }
}

async function hydrateByocBlobRefs(provider: SyncProvider, json: string): Promise<string> {
  let next = json
  for (const id of collectBlobIdsFromText(json)) {
    const dataUrl = await readMissingTolerant(provider, blobSidecarPath(id))
    if (!dataUrl) continue
    next = next.split(CONTENT_BLOB_PREFIX + id).join(dataUrl)
  }
  return next
}

async function hydrateByocAttachmentRefs(provider: SyncProvider, json: string): Promise<string> {
  const snapshot = JSON.parse(json) as V2Snapshot
  const attachments = snapshot.extras?.attachments
  if (!attachments?.length) return json
  snapshot.extras = snapshot.extras || {}
  snapshot.extras.attachments = await Promise.all(attachments.map(async (item) => {
    if (!item.dataUrl?.startsWith(ATTACHMENT_REF_PREFIX)) return item
    const dataUrl = await readMissingTolerant(provider, attachmentSidecarPath(attachmentRefId(item.dataUrl)))
    return { ...item, dataUrl: dataUrl || '' }
  }))
  return JSON.stringify(snapshot)
}

async function hydrateByocSnapshotJson(provider: SyncProvider, json: string): Promise<string> {
  const withBlobPayloads = await hydrateByocBlobRefs(provider, json)
  return hydrateByocAttachmentRefs(provider, withBlobPayloads)
}

async function writeProviderFile(provider: SyncProvider, path: string, data: string): Promise<void> {
  if (provider === 'local') await writeLocalFile(path, data)
  else if (provider === 'dropbox') await writeDropboxFile(path, data)
  else if (provider === 'onedrive') await writeOneDriveFile(path, data)
  else throw new Error('개인 저장소 provider가 선택되지 않았습니다')
}

async function readProviderFile(provider: SyncProvider, path: string): Promise<string> {
  if (provider === 'local') return readLocalFile(path)
  if (provider === 'dropbox') return readDropboxFile(path)
  if (provider === 'onedrive') return readOneDriveFile(path)
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

function saveOneDriveTokens(tokens: OneDriveTokenResponse) {
  if (tokens.access_token) safeLocalSet(ONEDRIVE_TOKEN_KEY, tokens.access_token)
  if (tokens.refresh_token) safeLocalSet(ONEDRIVE_REFRESH_KEY, tokens.refresh_token)
  if (tokens.expires_in) safeLocalSet(ONEDRIVE_EXPIRES_KEY, String(Date.now() + tokens.expires_in * 1000))
}

function clearOneDriveTokens() {
  safeLocalRemove(ONEDRIVE_TOKEN_KEY)
  safeLocalRemove(ONEDRIVE_REFRESH_KEY)
  safeLocalRemove(ONEDRIVE_EXPIRES_KEY)
}

function hasOneDriveToken(): boolean {
  return !!safeLocalGet(ONEDRIVE_TOKEN_KEY) || !!safeLocalGet(ONEDRIVE_REFRESH_KEY)
}

async function refreshOneDriveToken(clientId: string): Promise<string> {
  const refreshToken = safeLocalGet(ONEDRIVE_REFRESH_KEY)
  if (!refreshToken) throw new Error('OneDrive 재로그인이 필요합니다')

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: ONEDRIVE_SCOPE,
  })
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = (await response.json()) as OneDriveTokenResponse
  if (!response.ok || data.error) throw new Error(data.error_description || data.error || 'OneDrive 토큰 갱신 실패')
  saveOneDriveTokens(data)
  return safeLocalGet(ONEDRIVE_TOKEN_KEY)
}

async function getOneDriveAccessToken(): Promise<string> {
  const clientId = getOneDriveClientId()
  if (!clientId) throw new Error('OneDrive Client ID를 설정하세요')

  const accessToken = safeLocalGet(ONEDRIVE_TOKEN_KEY)
  const expiresAt = Number(safeLocalGet(ONEDRIVE_EXPIRES_KEY) || '0')
  if (accessToken && Date.now() < expiresAt - 30_000) return accessToken
  if (safeLocalGet(ONEDRIVE_REFRESH_KEY)) return refreshOneDriveToken(clientId)
  if (accessToken) return accessToken
  throw new Error('OneDrive 로그인이 필요합니다')
}

function toOneDriveContentPath(path: string): string {
  const encoded = path.split('/').filter(Boolean).map(encodeURIComponent).join('/')
  return `/me/drive/special/approot:/${encoded}:/content`
}

function toOneDriveItemPath(path: string): string {
  const encoded = path.split('/').filter(Boolean).map(encodeURIComponent).join('/')
  return encoded ? `/me/drive/special/approot:/${encoded}` : '/me/drive/special/approot'
}

function toOneDriveChildrenPath(parts: string[]): string {
  if (!parts.length) return '/me/drive/special/approot/children'
  const encoded = parts.map(encodeURIComponent).join('/')
  return `/me/drive/special/approot:/${encoded}:/children`
}

async function oneDriveFetch<T>(
  path: string,
  init: RequestInit = {},
  options: { text?: boolean } = {}
): Promise<T> {
  const token = await getOneDriveAccessToken()
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(init.headers as Record<string, string> | undefined),
  }
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers,
  })
  if (response.status === 401) {
    clearOneDriveTokens()
    throw new Error('OneDrive 인증이 만료되었습니다. 다시 로그인하세요')
  }
  if (!response.ok) throw new Error(`OneDrive API 오류: ${response.status} ${await response.text()}`)
  if (options.text) return (await response.text()) as T
  if (response.status === 204) return {} as T
  return (await response.json()) as T
}

async function writeOneDriveFile(path: string, data: string): Promise<void> {
  await ensureOneDriveParent(path)
  await oneDriveFetch(toOneDriveContentPath(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: data,
  })
}

async function readOneDriveFile(path: string): Promise<string> {
  return oneDriveFetch<string>(toOneDriveContentPath(path), { method: 'GET' }, { text: true })
}

async function ensureOneDriveParent(path: string): Promise<void> {
  const parts = path.split('/').filter(Boolean)
  parts.pop()
  const current: string[] = []
  for (const part of parts) {
    current.push(part)
    try {
      await oneDriveFetch(toOneDriveItemPath(current.join('/')), { method: 'GET' })
    } catch (error: unknown) {
      if (!isMissingRemoteSnapshot(error)) throw error
      try {
        await oneDriveFetch(toOneDriveChildrenPath(current.slice(0, -1)), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: part,
            folder: {},
            '@microsoft.graph.conflictBehavior': 'fail',
          }),
        })
      } catch (createError: unknown) {
        if (!/409|conflict/i.test(createError instanceof Error ? createError.message : String(createError))) throw createError
      }
    }
  }
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

export async function startOneDriveOAuth(): Promise<void> {
  const clientId = getOneDriveClientId()
  if (!clientId) throw new Error('OneDrive Client ID를 먼저 입력하세요')
  const verifier = randomToken(48)
  const challenge = await sha256Base64Url(verifier)
  const state = randomToken(20)
  safeLocalSet(ONEDRIVE_PKCE_KEY, verifier)
  safeLocalSet(ONEDRIVE_STATE_KEY, state)

  const url = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', getOneDriveRedirectUri())
  url.searchParams.set('response_mode', 'query')
  url.searchParams.set('scope', ONEDRIVE_SCOPE)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
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
  if (state && state !== safeLocalGet(DROPBOX_STATE_KEY)) return null
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

export async function handleOneDriveOAuthRedirectIfNeeded(): Promise<ByocStatus | null> {
  if (typeof window === 'undefined') return null
  const url = new URL(window.location.href)
  const error = url.searchParams.get('error')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!error && !code) return null
  if (state && state !== safeLocalGet(ONEDRIVE_STATE_KEY)) return null
  if (error) throw new Error(`OneDrive OAuth 오류: ${url.searchParams.get('error_description') || error}`)
  if (!code) return null
  if (state !== safeLocalGet(ONEDRIVE_STATE_KEY)) throw new Error('OneDrive OAuth state가 일치하지 않습니다')
  const verifier = safeLocalGet(ONEDRIVE_PKCE_KEY)
  const clientId = getOneDriveClientId()
  if (!verifier || !clientId) throw new Error('OneDrive OAuth 검증 정보가 없습니다')

  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: clientId,
    code_verifier: verifier,
    redirect_uri: getOneDriveRedirectUri(),
    scope: ONEDRIVE_SCOPE,
  })
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = (await response.json()) as OneDriveTokenResponse
  if (!response.ok || data.error) throw new Error(data.error_description || data.error || 'OneDrive 토큰 교환 실패')
  saveOneDriveTokens(data)
  safeLocalRemove(ONEDRIVE_PKCE_KEY)
  safeLocalRemove(ONEDRIVE_STATE_KEY)
  url.searchParams.delete('code')
  url.searchParams.delete('state')
  url.searchParams.delete('error')
  url.searchParams.delete('error_description')
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`)
  useSettingsStore.getState().setKey('syncProvider', 'onedrive')
  useSettingsStore.getState().setKey('syncEnabled', true)
  return getByocStatus('onedrive')
}

export async function handleByocOAuthRedirectIfNeeded(): Promise<ByocStatus | null> {
  if (typeof window === 'undefined') return null
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const state = url.searchParams.get('state')
  if (!code && !error) return null
  if (state === safeLocalGet(DROPBOX_STATE_KEY)) return handleDropboxOAuthRedirectIfNeeded()
  if (state === safeLocalGet(ONEDRIVE_STATE_KEY)) return handleOneDriveOAuthRedirectIfNeeded()
  if (error) throw new Error(`OAuth 오류: ${url.searchParams.get('error_description') || error}`)
  throw new Error('알 수 없는 개인 저장소 OAuth 응답입니다')
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
  if (provider === 'onedrive') {
    if (!hasOneDriveToken()) {
      return { provider, ready: false, label: 'OneDrive', detail: '로그인 필요' }
    }
    try {
      const account = await oneDriveFetch<OneDriveAccountResponse>('/me')
      return {
        provider,
        ready: true,
        label: 'OneDrive',
        detail: account.mail || account.userPrincipalName || account.displayName || '연결됨',
      }
    } catch (error: unknown) {
      return { provider, ready: false, label: 'OneDrive', detail: error instanceof Error ? error.message : String(error) }
    }
  }
  if (provider === 'supabase') return { provider, ready: true, label: 'Supabase', detail: '관리형 서버 동기화' }
  return { provider: 'none', ready: false, label: '오프라인', detail: '이 기기에만 저장' }
}

export async function pushByocSnapshot(): Promise<ByocSyncResult> {
  const provider = getSettingsProvider()
  if (!isPersonalStorageProvider(provider)) {
    return { ok: false, provider, pushed: 0, pulled: 0, error: '개인 저장소 provider가 선택되지 않았습니다' }
  }
  try {
    const json = await createByocSnapshotJson(provider)
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
  if (!isPersonalStorageProvider(provider)) {
    return { ok: false, provider, pushed: 0, pulled: 0, error: '개인 저장소 provider가 선택되지 않았습니다' }
  }
  try {
    const json = await readProviderFile(provider, SNAPSHOT_PATH)
    const result = await importV2FromJsonAsync(await hydrateByocSnapshotJson(provider, json))
    if (result.errors.length) throw new Error(result.errors.join(', '))
    safeLocalSet('jan.v2.sync.lastAt', String(Date.now()))
    return { ok: true, provider, pushed: 0, pulled: result.imported }
  } catch (error: unknown) {
    return { ok: false, provider, pushed: 0, pulled: 0, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function syncByocNow(): Promise<ByocSyncResult> {
  const provider = getSettingsProvider()
  if (!isPersonalStorageProvider(provider)) {
    return { ok: false, provider, pushed: 0, pulled: 0, error: '개인 저장소 provider가 선택되지 않았습니다' }
  }

  try {
    let pulled = 0
    try {
      const json = await readProviderFile(provider, SNAPSHOT_PATH)
      const result = await importV2FromJsonAsync(await hydrateByocSnapshotJson(provider, json))
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
  return isPersonalStorageProvider(provider)
}
