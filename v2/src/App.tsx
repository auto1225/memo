import { useEffect } from 'react'
import { Editor } from './components/Editor'
import { Sidebar } from './components/Sidebar'
import { useMemosStore } from './store/memosStore'
import { useI18nStore } from './lib/i18n'

function App() {
  const lang = useI18nStore((s) => s.lang)

  if (typeof window !== 'undefined') {
    try {
      if (localStorage.getItem('jan-show-pilcrow') === '1') {
        document.body.classList.add('jan-show-pilcrow')
      }
      // 접근성: <html lang> 동기화
      document.documentElement.lang = lang
    } catch {}
  }

  const { currentId, newMemo, list } = useMemosStore()

  useEffect(() => {
    if (!currentId && list().length === 0) {
      newMemo()
    } else if (!currentId && list().length > 0) {
      const first = list()[0]
      if (first) useMemosStore.getState().setCurrent(first.id)
    }
  }, [])

  return (
    <div className="jan-app">
      <a href="#jan-editor" className="skip-to-content">본문으로 건너뛰기</a>
      <Sidebar />
      <main className="jan-main" id="jan-editor" role="main" aria-label="JustANotepad editor">
        <Editor />
      </main>
    </div>
  )
}

export default App
