import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/session': 'http://localhost:8000',
      '/me': 'http://localhost:8000',
      '/rounds': 'http://localhost:8000',
      '/flaw-reports': 'http://localhost:8000',
      '/tells': 'http://localhost:8000',
      '/data': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    }
  }
})
