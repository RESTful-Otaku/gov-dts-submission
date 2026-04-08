/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

const previewApiTarget = process.env.PREVIEW_API_PROXY ?? 'http://127.0.0.1:8080'

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
  preview: {
    // Playwright + `vite preview`: forward /api to the Go backend (same-origin as the UI).
    proxy: {
      '/api': {
        target: previewApiTarget,
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
      thresholds: {
        branches: 50,
        functions: 55,
        lines: 60,
        statements: 60,
      },
    },
  }
}))