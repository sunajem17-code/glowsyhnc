import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    // Don't pre-bundle MediaPipe — it loads WASM files at runtime from /public/mediapipe/
    exclude: ['@mediapipe/face_mesh'],
  },
})
