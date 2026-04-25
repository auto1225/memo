import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/v2/',
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || /node_modules[\\/]react[\\/]/.test(id)) return 'react'
            if (id.includes('tiptap-pagination-plus')) return 'pagination'
            if (id.includes('@tiptap/extension-table')) return 'tiptap-table'
            if (id.includes('@tiptap')) return 'tiptap'
            if (id.includes('zustand')) return 'state'
          }
        },
      },
    },
  },
})
