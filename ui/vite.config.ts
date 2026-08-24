import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy API calls to the SynapseVault gateway so the UI can use
    // relative `/api/...` paths both in local dev and inside Docker
    // (where "localhost" would point at the UI container itself).
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})