import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Full dictionary/novel integration tests create thousands of DOM controls.
  // Bound worker contention and allow slower desktop/CI machines to finish.
  test: { maxWorkers: 2, testTimeout: 15000 },
})
