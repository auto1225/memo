import { useEffect } from 'react'
import { Editor } from './components/Editor'
import { Sidebar } from './components/Sidebar'
import { useMemosStore } from './store/memosStore'
import { useI18nStore } from './lib/i18n'
import { useUIStore } from './store/uiStore'

function App() {
  const lang = useI18nStore((s) => s.lang)
  const { focusMode, toggleFocus, zoom, zoomIn, zoomOut, zoomReset, headingNumbers, readingMode, toggleReading, spellCheck, sidebarCollapsed } = useUIStore()

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  useEffect(() => {
    try {
      document.body.classList.toggle('jan-show-pilcrow', localStorage.getItem('jan-show-pilcrow') === '1')
    } catch {
      document.body.classList.remove('jan-show-pilcrow')
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('jan-focus-mode', focusMode)
    document.body.classList.toggle('jan-heading-numbers', headingNumbers)
    document.body.classList.toggle('jan-reading-mode', readingMode)
    document.body.classList.toggle('jan-sidebar-hidden', sidebarCollapsed)
    document.documentElement.style.setProperty('--jan-zoom', String(zoom))
    document.querySelectorAll('.ProseMirror').forEach((el) => el.setAttribute('spellcheck', spellCheck ? 'true' : 'false'))
  }, [focusMode, zoom, headingNumbers, readingMode, spellCheck, sidebarCollapsed])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.isComposing || e.keyCode === 229) return
      if (e.key === 'F11' && !e.ctrlKey && !e.altKey) { e.preventDefault(); toggleFocus() }
      else if (e.key === 'F11' && e.shiftKey) { e.preventDefault(); toggleReading() }
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && !e.shiftKey && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomIn() }
      else if (ctrl && !e.shiftKey && e.key === '-') { e.preventDefault(); zoomOut() }
      else if (ctrl && !e.shiftKey && e.key === '0') { e.preventDefault(); zoomReset() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [toggleFocus, zoomIn, zoomOut, zoomReset, toggleReading])

  const { currentId, newMemo, list } = useMemosStore()

  useEffect(() => {
    if (!currentId && list().length === 0) newMemo()
    else if (!currentId && list().length > 0) {
      const first = list()[0]
      if (first) useMemosStore.getState().setCurrent(first.id)
    }
  }, [])

  return (
    <div className="jan-app">
      <a href="#jan-editor" className="skip-to-content">본문으로 건너뛰기</a>
      <Editor sidebar={!focusMode && <Sidebar />} />
    </div>
  )
}

export default App
