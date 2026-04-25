import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerV2ServiceWorker } from './lib/swRegister'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Phase 7 — 오프라인 지원
registerV2ServiceWorker()
