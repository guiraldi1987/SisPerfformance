import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: ['ieeegp-performance.loca.lt'],
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  build: {
    sourcemap: true,
  },
})
