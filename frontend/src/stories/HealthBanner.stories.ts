import type { Meta, StoryObj } from '@storybook/svelte'

import HealthBanner from '../components/health/HealthBanner.svelte'

const meta = {
  title: 'Health/HealthBanner',
  component: HealthBanner,
  args: {
    refreshHealth: () => {},
  },
} satisfies Meta<typeof HealthBanner>

export default meta
type Story = StoryObj<typeof meta>

export const Down: Story = {
  args: { healthStatus: 'down', healthMessage: 'Service unavailable' },
}

export const Degraded: Story = {
  args: {
    healthStatus: 'degraded',
    healthMessage: 'Service is responding but not fully ready.',
  },
}

