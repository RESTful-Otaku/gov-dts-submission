/** Single-field checks for inline auth/task validation (after blur). */

export function emailFieldOk(value: string): boolean {
  const s = value.trim()
  return s.length > 3 && s.includes('@')
}

export function nonEmptyOk(value: string): boolean {
  return value.trim().length > 0
}

export function passwordStrengthOk(password: string): boolean {
  if (password.length < 10) return false
  if (!/[A-Z]/.test(password)) return false
  if (!/[0-9]/.test(password)) return false
  if (!/[^A-Za-z0-9]/.test(password)) return false
  return true
}

export function passwordsMatchOk(a: string, b: string): boolean {
  return a.length > 0 && a === b
}

export function taskTitleOk(title: string): boolean {
  return title.trim().length > 0
}
