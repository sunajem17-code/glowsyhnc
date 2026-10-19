import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolveBackendOrigin } from './src/utils/backend.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
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
