/**
 * @file vite.config.ts
 * @owner client-squad
 * @description Vite build config for the phone client (src/client).
 * The client is a React + TypeScript app; this replaces the old
 * "no build step" approach documented in docs/architecture/OVERVIEW.md.
 * Build output goes to dist/client (gitignored), alongside the server's dist.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'src/client',
  plugins: [react()],
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
})
