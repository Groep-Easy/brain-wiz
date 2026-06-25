import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react({})],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      '@brain-wiz/shared': resolve(__dirname, './src/shared'),
      '@brain-wiz/minigames': resolve(__dirname, './src/minigames'),
    }
  }
})
