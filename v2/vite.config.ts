import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// JustANotepad v2 — TipTap-based editor
// Deploy: /v2/ subdirectory on justanotepad.com (beta)
// Later: swap to root when fully migrated
export default defineConfig({
  base: '/v2/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
