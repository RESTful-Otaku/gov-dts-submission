import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/svelte'

import TaskPrioritySelect from '../../src/components/forms/TaskPrioritySelect.svelte'

describe('TaskPrioritySelect', () => {
  it('renders priority options', () => {
    const { container } = render(TaskPrioritySelect, {
      props: { id: 'pr', value: 'normal' },
    })
    expect(container.querySelector('#pr')).toBeTruthy()
  })
})
