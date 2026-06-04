/** Glyph for the active sort column, ascending. */
export const GLYPH_SORT_ASC = '↑'
/** Glyph for the active sort column, descending. */
export const GLYPH_SORT_DESC = '↓'
/**
 * Glyph for a sortable column that is not the primary sort (distinct from ↑/↓ so the active column is obvious).
 */
export const GLYPH_SORT_IDLE = '⇕'

export function tableSortGlyph(isActiveColumn: boolean, ascending: boolean): string {
  if (!isActiveColumn) return GLYPH_SORT_IDLE
  return ascending ? GLYPH_SORT_ASC : GLYPH_SORT_DESC
}
