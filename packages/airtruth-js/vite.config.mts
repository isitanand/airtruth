import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: { dedupe: ['lucide'] },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'AirTruth',
      formats: ['es', 'umd'],
      fileName: (format) => (format === 'es' ? 'airtruth.mjs' : 'airtruth.js'),
    },
  },
})
