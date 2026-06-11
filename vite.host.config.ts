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

const HOST_DEV_PORT = 5174

export default defineConfig({
  root: 'src/host',
  plugins: [react()],
  // base must match the Express mount point so built asset URLs are correct.
  // Without this, /assets/foo.js 404s because it hits the root handler, not /host.
  base: '/host',
  server: {
    port: HOST_DEV_PORT,
  },
  build: {
    outDir: '../../dist/host',
    emptyOutDir: true,
  },
})
