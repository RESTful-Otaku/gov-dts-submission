/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Always force the browser build of Svelte, and use the classic
// component API (mount / new App) rather than the server bundle.
export default defineConfig(({ mode }) => ({
  plugins: [
    svelte({
      compilerOptions: {
        // Be explicit that we want the classic component API.
        runes: false,
      },
    }),
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

