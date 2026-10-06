import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * The same renderer built as a web app, served by the desktop's remote server at `/` and talking
 * to the core over HTTP + SSE instead of IPC (ADR 0022). Mirrors the renderer section of
 * electron.vite.config.ts.
 */
export default defineConfig({
  root: resolve('src/renderer'),
  base: './',
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  },
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve('out/web'),
    emptyOutDir: true,
    // xterm with its renderers (~510 kB) loads on demand as one chunk, not with the first page.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Libraries change less often than the app: a new version only re-downloads the app chunk.
        // Vite module ids use forward slashes on every platform.
        manualChunks(id) {
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
          if (/\/node_modules\/(@radix-ui|@floating-ui|@tanstack|zod)\//.test(id)) {
            return 'vendor'
          }
          return undefined
        }
      }
    }
  }
})
