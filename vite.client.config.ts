/**
 * @file vite.client.config.ts
 * @owner client-squad
 * @description Vite build config for the phone client (src/client).
 * The client is a React + TypeScript app; this replaces the old
 * "no build step" approach documented in docs/architecture/OVERVIEW.md.
 * Build output goes to dist/client (gitignored), alongside the server's dist.
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  root: 'src/client',
  plugins: [react()],
  // base must match the Express mount point so built asset URLs are correct.
  // Without this, /assets/foo.js 404s because it hits the root handler, not /client.
  base: '/client',
  cacheDir: '../../node_modules/.vite/client',
  server: {
    port: Number(process.env['CLIENT_PORT']),
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/client'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@client': path.resolve(__dirname, 'src/client'),
      '@minigames': path.resolve(__dirname, 'src/minigames'),
      '@brain-wiz/shared': path.resolve(__dirname, 'src/shared'),
      '@brain-wiz/config': path.resolve(__dirname, 'src/config'),
    },
  },
})
