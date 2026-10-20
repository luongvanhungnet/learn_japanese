import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', proxy: { '/api': 'http://127.0.0.1:3001' } },
  preview: { host: '127.0.0.1', proxy: { '/api': 'http://127.0.0.1:3001' } },
  // Full dictionary/novel integration tests create thousands of DOM controls.
  // Bound worker contention and allow slower desktop/CI machines to finish.
  test: { maxWorkers: 2, testTimeout: 15000 },
})
