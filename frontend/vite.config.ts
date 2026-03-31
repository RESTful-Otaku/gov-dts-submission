/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Always force the browser build of Svelte.
export default defineConfig(() => ({
  plugins: [svelte()],
  server: {
    // Dev only: avoid CORS by proxying API requests to the local backend.
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    // Always prefer the "browser" condition so Svelte's browser entry is used.
    conditions: ['browser'],
  },
  // svelty-picker ships .svelte sources in dist/; esbuild (optimizeDeps) cannot load them.
  optimizeDeps: {
    exclude: ['svelty-picker'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    coverage: {
      provider: 'v8' as const,
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{svelte,ts}'],
      exclude: ['src/**/*.d.ts', 'src/main.ts'],
    },
  }
}))