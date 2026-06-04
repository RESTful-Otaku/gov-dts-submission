import type { Preview } from '@storybook/svelte-vite'

import { syncRootAppearance } from '../src/lib/app/preferences'
import type { FontSize, Theme } from '../src/lib/app/types'
import '../src/app.css'

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Root appearance: sets html data-theme (same as production)',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', icon: 'sun', title: 'Light' },
          { value: 'dark', icon: 'moon', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
    fontSize: {
      description: 'Root font size on html (same as production)',
      defaultValue: 'normal',
      toolbar: {
        title: 'Text size',
        icon: 'accessibility',
        items: [
          { value: 'normal', title: 'Normal (16px)' },
          { value: 'large', title: 'Large (18px)' },
          { value: 'xlarge', title: 'Extra large (20px)' },
        ],
        dynamicTitle: true,
      },
    },
  },

  decorators: [
    (story, context) => {
      if (typeof document !== 'undefined') {
        const theme = (context.globals.theme as Theme) ?? 'light'
        const fontSize = (context.globals.fontSize as FontSize) ?? 'normal'
        syncRootAppearance(theme, fontSize)
      }
      return story(context)
    },
  ],

  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    /** Use Theme toolbar + app CSS variables instead of Storybook’s default backgrounds. */
    backgrounds: { disable: true },
    a11y: {
      test: 'todo',
    },
    docs: {
      toc: true,
    },
  },
}

export default preview
