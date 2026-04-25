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

interface Attachment {
  id: string
  name: string
  type: string
  size: number
  data: Blob
  memoId?: string
  createdAt: number
}

function openDB(): Promise<IDBDatabase> {
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

export async function saveAttachment(file: File, memoId?: string): Promise<string> {
  const db = await openDB()
  const id = 'att_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
  const att: Attachment = {
    id,
    name: file.name,
    type: file.type,
    size: file.size,
    data: file,
    memoId,
    createdAt: Date.now(),
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE).put(att)
  })
  db.close()
  return id
}

export async function loadAttachment(id: string): Promise<Attachment | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const r = tx.objectStore(STORE).get(id)
    r.onsuccess = () => { db.close(); resolve(r.result || null) }
    r.onerror = () => { db.close(); reject(r.error) }
  })
}

export async function listAttachments(memoId?: string): Promise<Array<Omit<Attachment, 'data'>>> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const r = tx.objectStore(STORE).getAll()
    r.onsuccess = () => {
      db.close()
      const all = (r.result || []) as Attachment[]
      const filtered = memoId ? all.filter((a) => a.memoId === memoId) : all
      resolve(filtered.map(({ data: _d, ...rest }) => rest))
    }
    r.onerror = () => { db.close(); reject(r.error) }
  })
}

export async function deleteAttachment(id: string): Promise<void> {
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
