import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/svelte'
import { en as pickerEn } from 'svelty-picker/i18n'

import FilterDueDateRange from '../../src/components/filters/FilterDueDateRange.svelte'

describe('FilterDueDateRange', () => {
  it('renders two date pickers', () => {
    const { container } = render(FilterDueDateRange, {
      props: {
        filterFrom: '',
        filterTo: '',
        dateFormat: 'dd-mm-yyyy',
        pickerI18n: { ...pickerEn, weekStart: 1 },
      },
    })
    expect(container.querySelector('.date-range')).toBeTruthy()
    expect(container.querySelectorAll('.filter-due-input').length).toBe(2)
  })
})
