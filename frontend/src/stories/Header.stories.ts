import type { Meta, StoryObj } from '@storybook/svelte'
import { fn } from 'storybook/test'

import Header from './Header.svelte'

const meta = {
  title: 'Example/Header',
  component: Header,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    onLogin: fn(),
    onLogout: fn(),
    onCreateAccount: fn(),
  },
} satisfies Meta<typeof Header>

export default meta
type Story = StoryObj<typeof meta>

export const LoggedIn: Story = { args: { user: { name: 'Jane Doe' } } }
export const LoggedOut: Story = {}

