/**
 * Phase 11 — 첨부 파일 (IndexedDB).
 * 메모에 image/pdf/zip 등 binary blob 저장. localStorage 5MB 제한 회피.
 *
 * 사용 패턴:
 *   const id = await saveAttachment(file)
 *   editor.insertContent(`<a href="indexeddb:${id}">${file.name}</a>`)
 *   사용자 클릭 시 → loadAttachment(id) → URL.createObjectURL → window.open
 */
const DB_NAME = 'jan-v2-attachments'
const STORE = 'files'
const VERSION = 1

export interface Attachment {
  id: string
  name: string
  type: string
  size: number
  data: Blob
  memoId?: string
  createdAt: number
}

export interface AttachmentSnapshot {
  id: string
  name: string
  type: string
  size: number
  memoId?: string
  createdAt: number
  dataUrl: string
}

const memoryStore = new Map<string, Attachment>()

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined'
}

function openDB(): Promise<IDBDatabase> {
  if (!hasIndexedDb()) return Promise.reject(new Error('IndexedDB is not available'))
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, VERSION)
    r.onerror = () => reject(r.error)
    r.onsuccess = () => resolve(r.result)
    r.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('memoId', 'memoId', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
  })
}

function makeAttachmentId() {
  return 'att_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

async function putAttachment(att: Attachment): Promise<void> {
  if (!hasIndexedDb()) {
    memoryStore.set(att.id, att)
    return
  }
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE).put(att)
  })
  db.close()
}

export async function saveAttachment(file: File, memoId?: string): Promise<string> {
  const id = makeAttachmentId()
  const att: Attachment = {
    id,
    name: file.name,
    type: file.type,
    size: file.size,
    data: file,
    memoId,
    createdAt: Date.now(),
  }
  await putAttachment(att)
  return id
}

export async function loadAttachment(id: string): Promise<Attachment | null> {
  if (!hasIndexedDb()) return memoryStore.get(id) || null
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const r = tx.objectStore(STORE).get(id)
    r.onsuccess = () => { db.close(); resolve(r.result || null) }
    r.onerror = () => { db.close(); reject(r.error) }
  })
}

export async function listAttachments(memoId?: string): Promise<Array<Omit<Attachment, 'data'>>> {
  if (!hasIndexedDb()) {
    const all = Array.from(memoryStore.values())
    const filtered = memoId ? all.filter((a) => a.memoId === memoId) : all
    return filtered.map(({ id, name, type, size, memoId, createdAt }) => ({ id, name, type, size, memoId, createdAt }))
  }
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const r = tx.objectStore(STORE).getAll()
    r.onsuccess = () => {
      db.close()
      const all = (r.result || []) as Attachment[]
      const filtered = memoId ? all.filter((a) => a.memoId === memoId) : all
      resolve(filtered.map(({ id, name, type, size, memoId, createdAt }) => ({ id, name, type, size, memoId, createdAt })))
    }
    r.onerror = () => { db.close(); reject(r.error) }
  })
}

export async function deleteAttachment(id: string): Promise<void> {
  if (!hasIndexedDb()) {
    memoryStore.delete(id)
    return
  }
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE).delete(id)
  })
  db.close()
}

/** 첨부 ID 를 사용자에게 직접 보여주기 위한 Blob URL 생성. 호출 측에서 revokeObjectURL 책임. */
export async function attachmentObjectUrl(id: string): Promise<string | null> {
  const a = await loadAttachment(id)
  if (!a) return null
  return URL.createObjectURL(a.data)
}

export async function fileToDataUrl(file: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(reader.error || new Error('Failed to read attachment'))
      reader.readAsDataURL(file)
    })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  const encoded = btoa(binary)
  return `data:${file.type || 'application/octet-stream'};base64,${encoded}`
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/)
  if (!match) throw new Error('Invalid attachment data URL')
  const type = match[1] || 'application/octet-stream'
  const payload = match[3] || ''
  if (match[2]) {
    const binary = atob(payload)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type })
  }
  return new Blob([decodeURIComponent(payload)], { type })
}

export async function exportAttachments(memoId?: string): Promise<AttachmentSnapshot[]> {
  const rows = await listAttachments(memoId)
  const snapshots: AttachmentSnapshot[] = []
  for (const row of rows) {
    const att = await loadAttachment(row.id)
    if (!att) continue
    snapshots.push({
      id: att.id,
      name: att.name,
      type: att.type,
      size: att.size,
      memoId: att.memoId,
      createdAt: att.createdAt,
      dataUrl: await fileToDataUrl(att.data),
    })
  }
  return snapshots
}

export async function importAttachments(items: AttachmentSnapshot[] | unknown): Promise<number> {
  if (!Array.isArray(items)) return 0
  let imported = 0
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const raw = item as Partial<AttachmentSnapshot>
    if (!raw.id || !raw.name || !raw.dataUrl || typeof raw.dataUrl !== 'string') continue
    try {
      const blob = dataUrlToBlob(raw.dataUrl)
      const att: Attachment = {
        id: raw.id,
        name: raw.name,
        type: raw.type || blob.type || 'application/octet-stream',
        size: Number.isFinite(raw.size) ? Number(raw.size) : blob.size,
        data: blob,
        memoId: raw.memoId,
        createdAt: Number.isFinite(raw.createdAt) ? Number(raw.createdAt) : Date.now(),
      }
      await putAttachment(att)
      imported++
    } catch {
      continue
    }
  }
  return imported
}

export async function downloadAttachment(id: string, fallbackName?: string): Promise<boolean> {
  const att = await loadAttachment(id)
  if (!att) return false
  const url = URL.createObjectURL(att.data)
  const a = document.createElement('a')
  a.href = url
  a.download = att.name || fallbackName || 'attachment'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

export async function clearAttachmentsForTests(): Promise<void> {
  memoryStore.clear()
  if (!hasIndexedDb()) return
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.objectStore(STORE).clear()
    })
    db.close()
  } catch {
    return
  }
}
