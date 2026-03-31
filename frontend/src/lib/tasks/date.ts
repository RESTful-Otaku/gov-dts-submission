export function formatUKDateString(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}-${month}-${year}`
}

/**
 * Parse strict DD-MM-YYYY (rejects ambiguous formats).
 * Returns a Date in local time at 00:00:00.
 */
export function parseUKDate(dateStr: string): Date | null {
  const trimmed = dateStr.trim()
  if (!trimmed) return null

  // Accept strictly DD-MM-YYYY to avoid US-style ambiguity.
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed)
  if (!match) return null

  const [, dd, mm, yyyy] = match
  const day = Number(dd)
  const month = Number(mm)
  const year = Number(yyyy)

  const d = new Date(year, month - 1, day)
  if (
    Number.isNaN(d.getTime()) ||
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null
  }
  return d
}

/** Parses a date string from either a native date input (YYYY-MM-DD) or UK text (DD-MM-YYYY). */
export function parseDateInput(dateStr: string): Date | null {
  const trimmed = dateStr.trim()
  if (!trimmed) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    // Use a midday timestamp to reduce timezone edge cases.
    const d = new Date(trimmed + 'T12:00:00')
    return Number.isNaN(d.getTime()) ? null : d
  }

  return parseUKDate(trimmed)
}

/** Returns DD-MM-YYYY for display in any date field (e.g. from localStorage). */
export function toDisplayDate(dateStr: string): string {
  const d = parseDateInput(dateStr)
  return d ? formatUKDateString(d) : ''
}

export function parse12HourTime(
  timeStr: string,
  period: 'AM' | 'PM',
): { hours: number; minutes: number } | null {
  const trimmed = timeStr.trim()
  if (!trimmed) return null

  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed)
  if (!match) return null

  let hours = Number(match[1])
  const minutes = Number(match[2])

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null

  if (period === 'PM' && hours < 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0

  return { hours, minutes }
}

/**
 * Value for SveltyPicker datetime in UK format: dd-mm-yyyy HH:ii AM/PM
 * Note: this intentionally uses 12-hour time with "AM"/"PM" to match UI expectations.
 */
export function toDateTimePickerValue(d: Date): string {
  const datePart = formatUKDateString(d)
  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const period: 'AM' | 'PM' = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  if (hours === 0) hours = 12
  const hh = String(hours).padStart(2, '0')
  return `${datePart} ${hh}:${minutes} ${period}`
}

/**
 * Parse SveltyPicker datetime string (dd-mm-yyyy HH:ii P) to ISO string, or null if invalid.
 *
 * Output is a full ISO string, e.g. `2026-02-01T15:05:00.000Z`.
 */
export function parseDateTimeUK(s: string): string | null {
  const trimmed = s?.trim()
  if (!trimmed) return null

  const parts = trimmed.split(/\s+/)
  if (parts.length < 3) return null

  const datePart = parts[0]
  const timePart = parts[1]
  const periodPart = (parts[2]?.toUpperCase() === 'PM' ? 'PM' : 'AM') as 'AM' | 'PM'

  const d = parseUKDate(datePart)
  const t = parse12HourTime(timePart, periodPart)
  if (!d || !t) return null

  const due = new Date(d.getFullYear(), d.getMonth(), d.getDate(), t.hours, t.minutes, 0, 0)
  return Number.isNaN(due.getTime()) ? null : due.toISOString()
}

/**
 * Format an ISO timestamp as `DD-MM-YYYY hh:mm AM/PM` for UI and text search.
 * Returns original `value` unchanged if invalid.
 */
export function formatDate(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value

  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()

  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const period = hours >= 12 ? 'PM' : 'AM'

  hours = hours % 12
  if (hours === 0) hours = 12
  const hh = String(hours).padStart(2, '0')

  return `${day}-${month}-${year} ${hh}:${minutes} ${period}`
}

