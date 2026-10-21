import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { resolveBackendOrigin } from './src/utils/backend.js'

export default defineConfig(({ mode }) => {
  // Resolve env files relative to this config, not the shell's working
  // directory. Vite may be launched from the repository root, in which case
  // process.cwd() skips client/.env.local and points the proxy at a dead local API.
  const envDir = fileURLToPath(new URL('.', import.meta.url))
  const env = loadEnv(mode, envDir, 'VITE_')
  const target = resolveBackendOrigin(env.VITE_API_URL || 'http://localhost:3002')
  const proxy = Object.fromEntries(['/api', '/uploads', '/webhooks'].map(prefix => [
    prefix, { target, changeOrigin: true },
  ]))

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 3000,
      proxy,
    },
    optimizeDeps: {
      // Don't pre-bundle MediaPipe — it loads WASM files at runtime from /public/mediapipe/
      exclude: ['@mediapipe/face_mesh'],
    },
  }
})
