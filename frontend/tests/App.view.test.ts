import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import App from '../src/App.svelte'

/** Normalise fetch() input to a pathname for routing mocks (handles absolute Request URLs in Vitest/jsdom). */
function fetchPathname(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input.startsWith('http') ? new URL(input).pathname : input.split('?')[0]
  }
  if (input instanceof Request) {
    return new URL(input.url).pathname
  }
  return new URL(input.href).pathname
}

describe('App.svelte', () => {
  let store: Map<string, string>

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    store = new Map<string, string>()
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
    const { getByRole } = render(App)
    expect(getByRole('heading', { name: 'Caseworker task manager' })).toBeVisible()
    // Visible label is "Create task"; accessible name is aria-label "Create a new task".
    expect(getByRole('button', { name: 'Create a new task' })).toBeVisible()
  })

  it('toggles view mode between cards and list', async () => {
    const user = userEvent.setup()
    const { getByRole } = render(App)
    const cardsButton = getByRole('button', { name: 'Summary' })
    const listButton = getByRole('button', { name: 'List' })

    expect(cardsButton).toHaveClass('selected')
    expect(listButton).not.toHaveClass('selected')

    await user.click(listButton)

    expect(listButton).toHaveClass('selected')
    expect(cardsButton).not.toHaveClass('selected')
  })

  it('opens create modal from button', async () => {
    const user = userEvent.setup()
    const { getByRole, queryByRole } = render(App)

    expect(queryByRole('heading', { name: 'Create a new task' })).not.toBeInTheDocument()
    await user.click(getByRole('button', { name: 'Create a new task' }))

    expect(getByRole('heading', { name: 'Create a new task' })).toBeVisible()
  })

  it('shows health banner when API is down', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const path = fetchPathname(input)
      if (path === '/api/ready' || path.endsWith('/api/ready')) {
        return Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({ error: 'Service unavailable' }),
        })
      }
      if (path === '/api/tasks' || path.endsWith('/api/tasks')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([]),
        })
      }
      // Images and other assets: empty success (not JSON — callers use json() only on /api/*).
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('not json')),
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(App)

    await waitFor(
      () => {
        const el = document.querySelector('.health-banner')
        expect(el).toBeTruthy()
        expect(el!.textContent).toContain('The service is currently unavailable.')
      },
      { timeout: 3000 },
    )
  })

  it('opens advanced filters panel from toggle', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const path = fetchPathname(input)
      if (path === '/api/ready' || path.endsWith('/api/ready')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: 'ready' }),
        })
      }
      if (path === '/api/tasks' || path.endsWith('/api/tasks')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([]),
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('not json')),
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { getByRole } = render(App)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())

    await user.click(getByRole('button', { name: 'Toggle filters' }))
    expect(getByRole('region', { name: 'Advanced filters and sorting' })).toBeVisible()
  })
})
