import { useEffect } from 'react'
import { Editor } from './components/Editor'
import { Sidebar } from './components/Sidebar'
import { useMemosStore } from './store/memosStore'

function App() {
  if (typeof window !== 'undefined') {
    try {
      if (localStorage.getItem('jan-show-pilcrow') === '1') {
        document.body.classList.add('jan-show-pilcrow')
      }
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
      <Sidebar />
      <main className="jan-main">
        <Editor />
      </main>
    </div>
  )
}

export default App
