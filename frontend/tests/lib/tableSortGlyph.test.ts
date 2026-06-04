import { describe, expect, it } from 'vitest'

import {
  GLYPH_SORT_ASC,
  GLYPH_SORT_DESC,
  GLYPH_SORT_IDLE,
  tableSortGlyph,
} from '../../src/lib/ui/tableSortGlyph'

describe('tableSortGlyph', () => {
  it('shows idle glyph when column is not active', () => {
    expect(tableSortGlyph(false, true)).toBe(GLYPH_SORT_IDLE)
    expect(tableSortGlyph(false, false)).toBe(GLYPH_SORT_IDLE)
  })

  it('shows up or down when column is active', () => {
    expect(tableSortGlyph(true, true)).toBe(GLYPH_SORT_ASC)
    expect(tableSortGlyph(true, false)).toBe(GLYPH_SORT_DESC)
  })
})
