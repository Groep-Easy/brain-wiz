import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  base: '/client',
  cacheDir: path.resolve(__dirname, '../../node_modules/.vite/client'),
  server: {
    port: Number(process.env['CLIENT_PORT']),
  },
  build: {
    outDir: path.resolve(__dirname, '../../dist/client'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@brain-wiz/minigames': path.resolve(__dirname, '../minigames'),
      '@brain-wiz/shared': path.resolve(__dirname, '../shared'),
      '@brain-wiz/config': path.resolve(__dirname, '../config'),
    },
  },
})
