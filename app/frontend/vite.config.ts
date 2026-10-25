import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/session': 'http://127.0.0.1:8000',
      '/me': 'http://127.0.0.1:8000',
      '/rounds': 'http://127.0.0.1:8000',
      '/flaw-reports': 'http://127.0.0.1:8000',
      '/tells': 'http://127.0.0.1:8000',
      '/data': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
    }
  }
})
