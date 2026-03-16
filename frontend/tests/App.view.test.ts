import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import App from '../src/App.svelte'

describe('App.svelte', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    // Prevent tests from touching real localStorage or document font size between runs
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
      clear: () => store.clear(),
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders header and create task button', () => {
    const { getByText } = render(App)
    expect(getByText('Caseworker task manager')).toBeTruthy()
    expect(getByText('Create task')).toBeTruthy()
  })

  it('toggles view mode between cards and list', async () => {
    const { getByText, container } = render(App)
    const listButton = getByText('List')

    // default is cards view
    expect(container.querySelector('.tasks-grid')).toBeTruthy()

    await fireEvent.click(listButton)

    expect(container.querySelector('.list-wrapper')).toBeTruthy()
  })

  it('opens create modal from button', async () => {
    const { getByText, queryByText } = render(App)

    expect(queryByText('Create a new task')).toBeNull()
    const button = getByText('Create task')

    await fireEvent.click(button)

    expect(getByText('Create a new task')).toBeTruthy()
  })

  it('shows health banner when API is down', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ error: 'Service unavailable' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { findByText } = render(App)

    const msg = await findByText('The service is currently unavailable.')
    expect(msg).toBeTruthy()
  })
})

