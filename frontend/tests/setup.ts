/**
 * Shared Vitest + jsdom setup for Svelte component tests.
 * Keeps browser-only APIs predictable across the suite.
 */
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// jsdom: mock `svelty-picker` to a simple <input>.
vi.mock('svelty-picker', async () => {
  const mod = await import('./mocks/SveltyPickerMock.svelte')
  return { default: mod.default }
})

// jsdom: Web Animations API (Svelte transitions)
const noopAnimation = {
  cancel: () => {},
  finish: () => {},
  get finished() {
    return Promise.resolve()
  },
} as unknown as Animation

if (typeof Element !== 'undefined' && !Element.prototype.animate) {
  Element.prototype.animate = function () {
    return noopAnimation
  }
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
