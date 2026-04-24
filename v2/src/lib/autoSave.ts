const DRAFT_KEY = 'jan:v2:draft'
const TITLE_KEY = 'jan:v2:title'

export function saveDraft(content: string, title: string) {
  try {
    localStorage.setItem(DRAFT_KEY, content)
    localStorage.setItem(TITLE_KEY, title)
    localStorage.setItem(DRAFT_KEY + ':ts', String(Date.now()))
  } catch (err) {
    console.warn('[autoSave] draft save failed:', err)
  }
}

export function loadDraft(): { content: string; title: string; ts: number } | null {
  try {
    const content = localStorage.getItem(DRAFT_KEY)
    if (!content) return null
    const title = localStorage.getItem(TITLE_KEY) || '새 메모'
    const ts = parseInt(localStorage.getItem(DRAFT_KEY + ':ts') || '0', 10)
    return { content, title, ts }
  } catch {
    return null
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY)
    localStorage.removeItem(TITLE_KEY)
    localStorage.removeItem(DRAFT_KEY + ':ts')
  } catch {}
}

let saveTimer: number | null = null
export function scheduleDraftSave(content: string, title: string, delayMs = 800) {
  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    saveDraft(content, title)
    saveTimer = null
  }, delayMs)
}
