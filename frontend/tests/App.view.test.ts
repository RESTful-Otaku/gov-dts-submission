import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import App from '../src/App.svelte'

describe('App.svelte', () => {
  let originalAnimate: typeof Element.prototype.animate | undefined

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    // jsdom does not implement Element.animate (Web Animations API). Svelte transitions use it.
    originalAnimate = Element.prototype.animate
    Element.prototype.animate = function () {
      return {
        cancel: () => {},
        finish: () => {},
        get finished() {
          return Promise.resolve()
        },
      } as unknown as Animation
    }
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
    if (originalAnimate !== undefined) {
      Element.prototype.animate = originalAnimate
    }
  })

  it('renders header and create task button', () => {
    const { getByText } = render(App)
    expect(getByText('Caseworker task manager')).toBeTruthy()
    expect(getByText('Create task')).toBeTruthy()
  })

  it('toggles view mode between cards and list', async () => {
    const { getByText } = render(App)
    const cardsButton = getByText('Summary')
    const listButton = getByText('List')

    // default is cards view
    expect(cardsButton.classList.contains('selected')).toBe(true)
    expect(listButton.classList.contains('selected')).toBe(false)

    await fireEvent.click(listButton)

    expect(listButton.classList.contains('selected')).toBe(true)
    expect(cardsButton.classList.contains('selected')).toBe(false)
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

