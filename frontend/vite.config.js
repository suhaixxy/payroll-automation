import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The auth + payroll pages fetch relative '/api/...' paths; in dev those
    // must be forwarded to the Express backend on port 5000.
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
})
