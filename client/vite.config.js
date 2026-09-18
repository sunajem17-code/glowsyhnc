import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_TARGET = process.env.VITE_API_URL
  ? (/^https?:\/\//.test(process.env.VITE_API_URL) ? process.env.VITE_API_URL : `https://${process.env.VITE_API_URL}`)
  : 'https://glowsyhnc-production-e16b.up.railway.app'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    // Don't pre-bundle MediaPipe — it loads WASM files at runtime from /public/mediapipe/
    exclude: ['@mediapipe/face_mesh'],
  },
})
