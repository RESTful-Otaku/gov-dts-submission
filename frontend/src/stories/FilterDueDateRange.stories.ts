import type { Meta, StoryObj } from '@storybook/svelte'

import FilterDueDateRange from '../components/filters/FilterDueDateRange.svelte'
import { PICKER_I18N } from '../lib/app/constants'

const meta = {
  title: 'Filters/FilterDueDateRange',
  component: FilterDueDateRange,
  args: {
    filterFrom: '',
    filterTo: '',
    dateFormat: 'dd-mm-yyyy',
    pickerI18n: PICKER_I18N,
  },
} satisfies Meta<typeof FilterDueDateRange>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
