import type { Meta, StoryObj } from '@storybook/svelte'

import Toasts from '../components/notifications/Toasts.svelte'

const meta = {
  title: 'Notifications/Toasts',
  component: Toasts,
  args: {
    toasts: [
      { id: 1, message: 'Notification message', type: 'notification', timeoutId: 0 },
      { id: 2, message: 'Warning message', type: 'warning', timeoutId: 0 },
      { id: 3, message: 'Error message', type: 'error', timeoutId: 0, exiting: true },
    ],
    dismissToast: () => {},
  },
} satisfies Meta<typeof Toasts>

export default meta
type Story = StoryObj<typeof meta>

export const Mixed: Story = {}

