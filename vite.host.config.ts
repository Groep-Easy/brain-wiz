/**
 * @file vite.host.config.ts
 * @owner host-squad
 * @description Vite build config for the host display (src/host).
 * The host is a read-only React + TypeScript app shown on the TV / main
 * screen. Build output goes to dist/host (gitignored), alongside the
 * client and server output.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  root: 'src/host',
  plugins: [react()],
  // base must match the Express mount point so built asset URLs are correct.
  // The host app is now the root application containing the Welcome screen.
  base: '/',
  cacheDir: '../../node_modules/.vite/host',
  server: {
    port: Number(process.env['HOST_PORT']),
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/host'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@host': path.resolve(__dirname, 'src/host'),
      '@brain-wiz/shared': path.resolve(__dirname, 'src/shared'),
      '@config': path.resolve(__dirname, 'src/config'),
      '@minigames': path.resolve(__dirname, 'src/minigames'),
    },
  },
})
