import { useEffect } from 'react'
import { Editor } from './components/Editor'
import { Sidebar } from './components/Sidebar'
import { useMemosStore } from './store/memosStore'
import { useI18nStore } from './lib/i18n'
import { useUIStore } from './store/uiStore'

function App() {
  const lang = useI18nStore((s) => s.lang)
  const { focusMode, toggleFocus, zoom, zoomIn, zoomOut, zoomReset, headingNumbers } = useUIStore()

  if (typeof window !== 'undefined') {
    try {
      if (localStorage.getItem('jan-show-pilcrow') === '1') {
        document.body.classList.add('jan-show-pilcrow')
      }
      document.documentElement.lang = lang
    } catch {}
  }

  // 포커스 모드 클래스 동기화 + 줌 변수
  useEffect(() => {
    document.body.classList.toggle('jan-focus-mode', focusMode)
    document.body.classList.toggle('jan-heading-numbers', headingNumbers)
    document.documentElement.style.setProperty('--jan-zoom', String(zoom))
  }, [focusMode, zoom, headingNumbers])

  // F11 포커스 모드, Ctrl+= / Ctrl+- 줌
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.isComposing || e.keyCode === 229) return
      if (e.key === 'F11' && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        toggleFocus()
      }
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && !e.shiftKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        zoomIn()
      } else if (ctrl && !e.shiftKey && e.key === '-') {
        e.preventDefault()
        zoomOut()
      } else if (ctrl && !e.shiftKey && e.key === '0') {
        e.preventDefault()
        zoomReset()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [toggleFocus, zoomIn, zoomOut, zoomReset])

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
      {!focusMode && <Sidebar />}
      <main className="jan-main" id="jan-editor" role="main" aria-label="JustANotepad editor">
        <Editor />
      </main>
      {focusMode && (
        <button
          className="jan-focus-exit"
          onClick={toggleFocus}
          title="포커스 모드 해제 (F11)"
          aria-label="포커스 모드 해제"
        >
          ⊟
        </button>
      )}
    </div>
  )
}

export default App
