import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/svelte'

import TaskStatusSelect from '../../src/components/forms/TaskStatusSelect.svelte'

describe('TaskStatusSelect', () => {
  it('renders status options', () => {
    const { container } = render(TaskStatusSelect, {
      props: { id: 'st', value: 'todo' },
    })
    expect(container.querySelector('#st')).toBeTruthy()
    expect((container.querySelector('#st') as HTMLSelectElement).value).toBe('todo')
  })
})
