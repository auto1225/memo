import { migrateV1Html } from './migration'
import { useMemosStore } from '../store/memosStore'

export interface V1ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

export function importV1FromLocalStorage(): V1ImportResult {
  const result: V1ImportResult = { imported: 0, skipped: 0, errors: [] }
  const store = useMemosStore.getState()

  try {
    const tabsJson = localStorage.getItem('jan-tabs')
    if (tabsJson) {
      try {
        const tabs = JSON.parse(tabsJson) as Array<{ id?: string; title?: string; content?: string; html?: string }>
        if (Array.isArray(tabs)) {
          for (const tab of tabs) {
            const html = tab.content || tab.html || ''
            if (!html.trim()) { result.skipped++; continue }
            const migrated = migrateV1Html(html)
            const id = store.newMemo()
            useMemosStore.setState((s) => {
              const cur = s.memos[id]
              if (!cur) return s
              return { memos: { ...s.memos, [id]: { ...cur, title: tab.title || `v1 메모 ${result.imported + 1}`, content: migrated, updatedAt: Date.now() } } }
            })
            result.imported++
          }
        }
      } catch (e: any) {
        result.errors.push('jan-tabs 파싱 실패: ' + e.message)
      }
    }

    const single = localStorage.getItem('jan-content')
    if (single && single.trim()) {
      const migrated = migrateV1Html(single)
      const id = store.newMemo()
      useMemosStore.setState((s) => {
        const cur = s.memos[id]
        if (!cur) return s
        return { memos: { ...s.memos, [id]: { ...cur, title: 'v1 메모 (단일)', content: migrated, updatedAt: Date.now() } } }
      })
      result.imported++
    }

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith('jan:tab:')) continue
      const html = localStorage.getItem(key)
      if (!html || !html.trim()) { result.skipped++; continue }
      try {
        const migrated = migrateV1Html(html)
        const id = store.newMemo()
        useMemosStore.setState((s) => {
          const cur = s.memos[id]
          if (!cur) return s
          return { memos: { ...s.memos, [id]: { ...cur, title: key.replace('jan:tab:', '메모 '), content: migrated, updatedAt: Date.now() } } }
        })
        result.imported++
      } catch (e: any) {
        result.errors.push(`${key}: ${e.message}`)
      }
    }
  } catch (e: any) {
    result.errors.push('localStorage 접근 실패: ' + e.message)
  }

  return result
}

export function exportV2ToJson(): string {
  const state = useMemosStore.getState()
  return JSON.stringify({ version: 2, exportedAt: Date.now(), memos: state.memos, order: state.order }, null, 2)
}

export function importV2FromJson(json: string): V1ImportResult {
  const result: V1ImportResult = { imported: 0, skipped: 0, errors: [] }
  try {
    const data = JSON.parse(json)
    if (!data.memos || typeof data.memos !== 'object') {
      result.errors.push('유효하지 않은 백업 파일')
      return result
    }
    const store = useMemosStore.getState()
    for (const memo of Object.values(data.memos as Record<string, any>)) {
      if (!memo || typeof memo !== 'object' || !memo.content) { result.skipped++; continue }
      const id = store.newMemo()
      useMemosStore.setState((s) => {
        const cur = s.memos[id]
        if (!cur) return s
        return { memos: { ...s.memos, [id]: { ...cur, title: memo.title || '무제', content: memo.content || '<p></p>', updatedAt: Date.now() } } }
      })
      result.imported++
    }
  } catch (e: any) {
    result.errors.push('백업 파일 파싱 실패: ' + e.message)
  }
  return result
}
