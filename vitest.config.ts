import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('.', import.meta.url)),
      '@': fileURLToPath(new URL('.', import.meta.url))
    }
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', '.nuxt', '.output', 'dist'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['utils/**/*.ts', 'composables/**/*.ts'],
      exclude: ['**/*.d.ts', 'node_modules', '.nuxt', '.output']
    }
  }
})
