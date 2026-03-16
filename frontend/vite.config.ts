/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Always force the browser build of Svelte.
export default defineConfig(({ mode }) => ({
  plugins: [
    svelte(),
  ],
  resolve: {
    // Always prefer the "browser" condition so Svelte's browser entry is used.
    conditions: ['browser'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.{js,ts}'],
  },
}))

