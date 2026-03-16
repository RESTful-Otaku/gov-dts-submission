import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import("@sveltejs/vite-plugin-svelte").SvelteConfig} */
export default {
  // Use Svelte's default (runes-enabled) compilation so dependencies
  // like SveltyPicker that rely on $props continue to work correctly.
  preprocess: vitePreprocess(),
}

