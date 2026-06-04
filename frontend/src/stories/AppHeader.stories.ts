import type { Meta, StoryObj } from '@storybook/svelte'

import AppHeaderInteractive from '../../.storybook/components/AppHeaderInteractive.svelte'
import type { FontSize, Theme } from '../lib/app/types'

/**
 * Header with working theme + text size controls. Uses the same `syncRootAppearance` as the app,
 * so the Storybook canvas reflects light/dark CSS variables and root font scaling.
 *
 * Use the **Theme** and **Text size** toolbars for global canvas appearance; story-level `globals`
 * below are shortcuts for common presets.
 */
const meta = {
  title: 'Layout/AppHeader',
  component: AppHeaderInteractive,
  args: {
    initialTheme: 'light' as Theme,
    initialFontSize: 'md' as FontSize,
  },
  render: (args, ctx) => ({
    Component: AppHeaderInteractive,
    props: {
      initialTheme: (ctx.globals.theme as Theme) ?? args.initialTheme,
      initialFontSize: (ctx.globals.fontSize as FontSize) ?? args.initialFontSize,
    },
  }),
} satisfies Meta<typeof AppHeaderInteractive>

export default meta
type Story = StoryObj<typeof meta>

/** Default: follow toolbar (light + normal). */
export const Playground: Story = {
  args: { initialTheme: 'light', initialFontSize: 'md' },
}

export const Light: Story = {
  args: { initialTheme: 'light', initialFontSize: 'md' },
  globals: { theme: 'light', fontSize: 'md' },
}

export const Dark: Story = {
  args: { initialTheme: 'dark', initialFontSize: 'md' },
  globals: { theme: 'dark', fontSize: 'md' },
}

export const LargeText: Story = {
  args: { initialTheme: 'light', initialFontSize: 'lg' },
  globals: { theme: 'light', fontSize: 'lg' },
}

export const DarkLargeText: Story = {
  args: { initialTheme: 'dark', initialFontSize: 'xl' },
  globals: { theme: 'dark', fontSize: 'xl' },
}
