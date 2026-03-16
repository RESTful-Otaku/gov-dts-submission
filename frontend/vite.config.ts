/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Ensure Vitest uses the browser build of Svelte (not the server one),
// otherwise Svelte 5's mount/onMount are unavailable and tests will fail.
export default defineConfig(({ mode }) => ({
  plugins: [svelte()],
  resolve: {
    // In test mode, prefer the "browser" condition so Svelte's browser entry is used.
    conditions: mode === 'test' ? ['browser'] : [],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.{js,ts}'],
  },
}))

