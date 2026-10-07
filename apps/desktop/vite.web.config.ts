import { resolve } from 'path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * The same renderer built as a web app, served by the desktop's remote server at `/` and talking
 * to the core over HTTP + SSE instead of IPC (ADR 0022). Mirrors the renderer section of
 * electron.vite.config.ts.
 *
 * `--mode capacitor` builds it for the Android app instead (ADR 0027): the page then comes from
 * `http://localhost` and talks to whichever desktop the user names, so its CSP must allow that.
 */
export default defineConfig(({ mode }) => ({
  root: resolve('src/renderer'),
  base: './',
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  },
  plugins: [react(), tailwindcss(), ...(mode === 'capacitor' ? [connectAnywhere()] : [])],
  build: {
    outDir: resolve(mode === 'capacitor' ? 'out/capacitor' : 'out/web'),
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
}))

/** Lets the app's page reach any desktop: the address is the user's choice, http or https. */
function connectAnywhere(): Plugin {
  return {
    name: 'devhub-capacitor-csp',
    transformIndexHtml(html) {
      const next = html.replace("connect-src 'self'", "connect-src 'self' http: https:")
      if (next === html) throw new Error('index.html CSP has no connect-src to widen')
      return next
    }
  }
}
