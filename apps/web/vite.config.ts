import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  server: { port: 5173, fs: { allow: ['../..'] }, proxy: { '/v1': 'http://127.0.0.1:8787' } },
  preview: { port: 4173, proxy: { '/v1': 'http://127.0.0.1:8787' } },
  build: isSsrBuild ? { outDir: 'dist-ssr', emptyOutDir: true } : {
    manifest: true,
    rollupOptions: {
      input: {
        site: resolve(import.meta.dirname, 'index.html'),
        indigo: resolve(import.meta.dirname, 'hosts/indigo.html'),
        delta: resolve(import.meta.dirname, 'hosts/delta.html'),
        ba: resolve(import.meta.dirname, 'hosts/ba.html'),
      },
    },
  },
}))
