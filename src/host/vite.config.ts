import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '../../'), '')
  return {
    root: __dirname,
    plugins: [react()],
    base: '/',
    cacheDir: path.resolve(__dirname, '../../node_modules/.vite/host'),
    server: {
      port: Number(env['HOST_PORT'] || 5174),
    },
    build: {
      outDir: path.resolve(__dirname, '../../dist/host'),
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        '@brain-wiz/shared': path.resolve(__dirname, '../shared'),
        '@brain-wiz/config': path.resolve(__dirname, '../config'),
        '@brain-wiz/minigames': path.resolve(__dirname, '../minigames'),
      },
    },
  }
})
