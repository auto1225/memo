import { migrateV1Html } from './migration'
import { useMemosStore } from '../store/memosStore'
import { applyV2Snapshot, createV2Snapshot, snapshotFromCloudData, type V2Snapshot } from './snapshot'
import { externalizeLargeDataUrlsInHtml, importV1BlobRefsInHtml, resolveBlobRefsInHtml } from './blobRefs'

export interface V1ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

async function prepareImportedHtml(html: string): Promise<string> {
  const migrated = migrateV1Html(html)
  const withV1Blobs = await importV1BlobRefsInHtml(migrated)
  return externalizeLargeDataUrlsInHtml(withV1Blobs)
}

async function prepareCardImage(value: unknown): Promise<unknown> {
  if (typeof value !== 'string') return value
  const withV1Blobs = await importV1BlobRefsInHtml(value)
  return externalizeLargeDataUrlsInHtml(withV1Blobs)
}

async function prepareLegacyTabHtml(value: unknown): Promise<unknown> {
  if (typeof value !== 'string') return value
  const withV1Blobs = await importV1BlobRefsInHtml(value)
  return externalizeLargeDataUrlsInHtml(withV1Blobs)
}

async function prepareLegacyBlob(raw: unknown): Promise<unknown> {
  const cloned = JSON.parse(JSON.stringify(raw))

  if (Array.isArray(cloned.tabs)) {
    for (const tab of cloned.tabs) {
      tab.html = await prepareLegacyTabHtml(tab.html)
      tab.content = await prepareLegacyTabHtml(tab.content)
    }
  }

  for (const bucket of ['businessCards'] as const) {
    if (!Array.isArray(cloned[bucket])) continue
    for (const card of cloned[bucket]) {
      for (const key of ['photoBase64', 'frontImage', 'backImage', 'frontImg', 'backImg']) {
        card[key] = await prepareCardImage(card[key])
      }
    }
  }

  if (cloned.myCard && typeof cloned.myCard === 'object') {
    for (const key of ['photoBase64', 'frontImage', 'backImage', 'frontImg', 'backImg']) {
      cloned.myCard[key] = await prepareCardImage(cloned.myCard[key])
    }
  }

  return cloned
}

async function hydrateSnapshotForJson(snapshot: V2Snapshot): Promise<V2Snapshot> {
  const cloned = JSON.parse(JSON.stringify(snapshot)) as V2Snapshot

  for (const memo of Object.values(cloned.memos)) memo.content = await resolveBlobRefsInHtml(memo.content)
  for (const memo of Object.values(cloned.trashed)) memo.content = await resolveBlobRefsInHtml(memo.content)

  for (const card of Object.values(cloned.businessCards.cards)) {
    if (card.frontImage) card.frontImage = await resolveBlobRefsInHtml(card.frontImage)
    if (card.backImage) card.backImage = await resolveBlobRefsInHtml(card.backImage)
  }

  if (cloned.extras?.templates) {
    for (const template of cloned.extras.templates) template.content = await resolveBlobRefsInHtml(template.content)
  }
  if (cloned.extras?.snippets) {
    for (const snippet of cloned.extras.snippets) snippet.content = await resolveBlobRefsInHtml(snippet.content)
  }
  if (cloned.extras?.versions?.byMemo) {
    for (const versions of Object.values(cloned.extras.versions.byMemo)) {
      for (const version of versions) version.content = await resolveBlobRefsInHtml(version.content)
    }
  }

  return cloned
}

function applySnapshotImport(snapshot: V2Snapshot, result: V1ImportResult) {
  const applied = applyV2Snapshot(snapshot)
  result.imported +=
    applied.memosChanged +
    applied.trashChanged +
    applied.tagsChanged +
    applied.workspacesChanged +
    applied.cardsChanged +
    applied.extrasChanged
}

export async function importV1FromLocalStorage(): Promise<V1ImportResult> {
  const result: V1ImportResult = { imported: 0, skipped: 0, errors: [] }
  const store = useMemosStore.getState()

  try {
    const stickyJson = localStorage.getItem('sticky-memo-v4')
    if (stickyJson) {
      try {
        const legacy = await prepareLegacyBlob(JSON.parse(stickyJson))
        const snapshot = snapshotFromCloudData(legacy)
        if (snapshot) applySnapshotImport(snapshot, result)
        else result.skipped++
      } catch (e: unknown) {
        result.errors.push('sticky-memo-v4 파싱 실패: ' + (e instanceof Error ? e.message : String(e)))
      }
    }

    const tabsJson = localStorage.getItem('jan-tabs')
    if (tabsJson) {
      try {
        const tabs = JSON.parse(tabsJson) as Array<{ id?: string; title?: string; content?: string; html?: string }>
        if (Array.isArray(tabs)) {
          for (const tab of tabs) {
            const html = tab.content || tab.html || ''
            if (!html.trim()) {
              result.skipped++
              continue
            }
            const migrated = await prepareImportedHtml(html)
            const id = store.newMemo()
            useMemosStore.setState((state) => {
              const cur = state.memos[id]
              if (!cur) return state
              return {
                memos: {
                  ...state.memos,
                  [id]: {
                    ...cur,
                    title: tab.title || `v1 메모 ${result.imported + 1}`,
                    content: migrated,
                    updatedAt: Date.now(),
                  },
                },
              }
            })
            result.imported++
          }
        }
      } catch (e: unknown) {
        result.errors.push('jan-tabs 파싱 실패: ' + (e instanceof Error ? e.message : String(e)))
      }
    }

    const single = localStorage.getItem('jan-content')
    if (single?.trim()) {
      const migrated = await prepareImportedHtml(single)
      const id = store.newMemo()
      useMemosStore.setState((state) => {
        const cur = state.memos[id]
        if (!cur) return state
        return { memos: { ...state.memos, [id]: { ...cur, title: 'v1 메모 (단일)', content: migrated, updatedAt: Date.now() } } }
      })
      result.imported++
    }

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith('jan:tab:')) continue
      const html = localStorage.getItem(key)
      if (!html?.trim()) {
        result.skipped++
        continue
      }
      try {
        const migrated = await prepareImportedHtml(html)
        const id = store.newMemo()
        useMemosStore.setState((state) => {
          const cur = state.memos[id]
          if (!cur) return state
          return {
            memos: {
              ...state.memos,
              [id]: { ...cur, title: key.replace('jan:tab:', '메모 '), content: migrated, updatedAt: Date.now() },
            },
          }
        })
        result.imported++
      } catch (e: unknown) {
        result.errors.push(`${key}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  } catch (e: unknown) {
    result.errors.push('localStorage 접근 실패: ' + (e instanceof Error ? e.message : String(e)))
  }

  return result
}

export async function exportV2ToJson(): Promise<string> {
  return JSON.stringify(await hydrateSnapshotForJson(createV2Snapshot()), null, 2)
}

export function importV2FromJson(json: string): V1ImportResult {
  const result: V1ImportResult = { imported: 0, skipped: 0, errors: [] }
  try {
    const data = JSON.parse(json)
    const snapshot = snapshotFromCloudData(data)
    if (!snapshot) {
      result.errors.push('유효하지 않은 백업 파일')
      return result
    }
    applySnapshotImport(snapshot, result)
  } catch (e: unknown) {
    result.errors.push('백업 파일 파싱 실패: ' + (e instanceof Error ? e.message : String(e)))
  }
  return result
}
