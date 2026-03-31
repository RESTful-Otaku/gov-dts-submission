import type { StorybookConfig } from '@storybook/svelte-vite'

const config: StorybookConfig = {
  "stories": [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|ts|svelte)"
  ],
  "addons": [
    "@storybook/addon-a11y",
    "@storybook/addon-docs"
  ],
  "framework": "@storybook/svelte-vite",
  async viteFinal(config) {
    // Avoid esbuild prebundling deps that include raw `.svelte` files.
    config.optimizeDeps ??= {}
    config.optimizeDeps.exclude ??= []
    config.optimizeDeps.exclude.push('svelty-picker')
    // Docs/addons pull large chunks; avoid noisy Rollup "500 kB" warnings in CI.
    config.build ??= {}
    config.build.chunkSizeWarningLimit = 2500
    return config
  },
}
export default config