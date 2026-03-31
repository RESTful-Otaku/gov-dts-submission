import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/svelte'

import TaskSearchField from '../../src/components/tasks/TaskSearchField.svelte'

describe('TaskSearchField', () => {
  it('emits input changes', async () => {
    const onInput = vi.fn()
    const { getByPlaceholderText } = render(TaskSearchField, {
      props: {
        searchTerm: '',
        searchInput: null,
        placeholder: 'Search…',
        title: 'Search',
        onInput,
      },
    })
    await fireEvent.input(getByPlaceholderText('Search…'), { target: { value: 'abc' } })
    expect(onInput).toHaveBeenCalledWith('abc')
  })

  it('calls onFocus when the input is focused', async () => {
    const onInput = vi.fn()
    const onFocus = vi.fn()
    const { getByPlaceholderText } = render(TaskSearchField, {
      props: {
        searchTerm: '',
        searchInput: null,
        placeholder: 'Search…',
        title: 'Search',
        onInput,
        onFocus,
      },
    })
    await fireEvent.focus(getByPlaceholderText('Search…'))
    expect(onFocus).toHaveBeenCalledTimes(1)
  })
})
