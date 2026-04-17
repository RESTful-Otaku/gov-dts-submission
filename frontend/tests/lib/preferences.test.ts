import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  applyDensity,
  applyFontSize,
  applyMotionPreference,
  applyTheme,
  parseStoredTagFilters,
  loadTaskUiBootstrapFromStorage,
  stringifyTagFiltersForStorage,
  syncRootAppearance,
  systemPreferredTheme,
  TASK_UI_LS,
} from '../../src/lib/app/preferences'

describe('syncRootAppearance', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.fontSize = ''
  })

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.fontSize = ''
  })

  it('sets html data-theme and font size like production (without localStorage)', () => {
    syncRootAppearance('dark', 'lg')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.fontSize).toBe('18px')
  })
})

describe('applyTheme', () => {
  let store: Record<string, string>

  beforeEach(() => {
    store = {}
    vi.stubGlobal(
      'localStorage',
      {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => {
          store[k] = v
        },
        removeItem: (k: string) => {
          delete store[k]
        },
        clear: () => {
          store = {}
        },
        get length() {
          return Object.keys(store).length
        },
        key: (i: number) => Object.keys(store)[i] ?? null,
      } as Storage,
    )
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.documentElement.removeAttribute('data-theme')
  })

  it('persist false updates the document only', () => {
    applyTheme('dark', false)
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(store[TASK_UI_LS.theme]).toBeUndefined()
  })

  it('persist true writes localStorage', () => {
    applyTheme('light', true)
    expect(store[TASK_UI_LS.theme]).toBe('light')
  })
})

function mockMediaQueryList(matches: boolean, media: string): MediaQueryList {
  return {
    matches,
    media,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as MediaQueryList
}

describe('systemPreferredTheme', () => {
  it('is dark when prefers-color-scheme: dark', () => {
    const spy = vi.spyOn(window, 'matchMedia').mockImplementation((query: string) =>
      query === '(prefers-color-scheme: dark)'
        ? mockMediaQueryList(true, query)
        : mockMediaQueryList(false, query),
    )
    expect(systemPreferredTheme()).toBe('dark')
    spy.mockRestore()
  })

  it('is light when prefers-color-scheme is not dark', () => {
    const spy = vi.spyOn(window, 'matchMedia').mockImplementation((query: string) =>
      mockMediaQueryList(false, query),
    )
    expect(systemPreferredTheme()).toBe('light')
    spy.mockRestore()
  })
})

describe('tag filter persistence', () => {
  it('round-trips tag arrays and migrates legacy single-string storage', () => {
    expect(parseStoredTagFilters(null)).toEqual([])
    expect(parseStoredTagFilters('')).toEqual([])
    expect(parseStoredTagFilters('evidence')).toEqual(['evidence'])
    expect(parseStoredTagFilters('["a","b"]')).toEqual(['a', 'b'])
    expect(stringifyTagFiltersForStorage(['a', 'b'])).toBe('["a","b"]')
  })
})

describe('advanced settings persistence', () => {
  let store: Record<string, string>

  beforeEach(() => {
    store = {}
    vi.stubGlobal(
      'localStorage',
      {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => {
          store[k] = v
        },
        removeItem: (k: string) => {
          delete store[k]
        },
        clear: () => {
          store = {}
        },
        get length() {
          return Object.keys(store).length
        },
        key: (i: number) => Object.keys(store)[i] ?? null,
      } as Storage,
    )
    document.documentElement.removeAttribute('data-density')
    document.documentElement.removeAttribute('data-motion')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.documentElement.removeAttribute('data-density')
    document.documentElement.removeAttribute('data-motion')
  })

  it('applies density and stores it', () => {
    applyDensity('compact')
    expect(document.documentElement.dataset.density).toBe('compact')
    expect(store[TASK_UI_LS.density]).toBe('compact')
  })

  it('applies reduced motion and can revert to system mode', () => {
    applyMotionPreference('reduced')
    expect(document.documentElement.dataset.motion).toBe('reduced')
    expect(store[TASK_UI_LS.motionPreference]).toBe('reduced')

    applyMotionPreference('system')
    expect(document.documentElement.dataset.motion).toBeUndefined()
    expect(store[TASK_UI_LS.motionPreference]).toBe('system')
  })

  it('loads advanced settings from storage', () => {
    store[TASK_UI_LS.density] = 'compact'
    store[TASK_UI_LS.motionPreference] = 'full'
    store[TASK_UI_LS.startupViewMode] = 'kanban'
    store[TASK_UI_LS.defaultSortKey] = 'priority'
    store[TASK_UI_LS.defaultSortAscending] = 'false'

    const loaded = loadTaskUiBootstrapFromStorage()
    expect(loaded.density).toBe('compact')
    expect(loaded.motionPreference).toBe('full')
    expect(loaded.startupViewMode).toBe('kanban')
    expect(loaded.defaultSortKey).toBe('priority')
    expect(loaded.defaultSortAscending).toBe(false)
  })

  it('maps legacy font-size values from older builds', () => {
    store[TASK_UI_LS.fontSize] = 'large'
    expect(loadTaskUiBootstrapFromStorage().fontSize).toBe('lg')
    store[TASK_UI_LS.fontSize] = 'xlarge'
    expect(loadTaskUiBootstrapFromStorage().fontSize).toBe('xl')
  })

  it('supports six-step font sizes', () => {
    applyFontSize('xxl')
    expect(document.documentElement.style.fontSize).toBe('22px')
    expect(store[TASK_UI_LS.fontSize]).toBe('xxl')
  })
})
