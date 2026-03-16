import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import("@sveltejs/vite-plugin-svelte").SvelteConfig} */
export default {
  // This app uses the classic Svelte component API (new App({...}))
  // rather than the Svelte 5 runes-based API, so disable runes.
  compilerOptions: {
    runes: false,
  },
  preprocess: vitePreprocess(),
}

