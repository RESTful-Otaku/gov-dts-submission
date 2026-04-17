import type { Meta, StoryObj } from '@storybook/svelte'
import { fn } from 'storybook/test'

import ModalHeader from '../components/modals/ModalHeader.svelte'

const meta = {
  title: 'Modals/ModalHeader',
  component: ModalHeader,
  args: {
    titleId: 'story-modal-title',
    title: 'Modal title',
    onClose: fn(),
  },
} satisfies Meta<typeof ModalHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
