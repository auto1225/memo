import { Editor } from './components/Editor'

/**
 * JustANotepad v2 — TipTap-based.
 * Phase 1: single Editor component.
 * Phase 2+: tab system, sidebar (postits/memos), command palette.
 */
function App() {
  // Pilcrow toggle state restore
  if (typeof window !== 'undefined') {
    try {
      if (localStorage.getItem('jan-show-pilcrow') === '1') {
        document.body.classList.add('jan-show-pilcrow')
      }
    } catch {}
  }

  return <Editor />
}

export default App
