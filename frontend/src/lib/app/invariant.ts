const shouldThrowUiInvariant = import.meta.env.DEV || import.meta.env.MODE === 'test'

export function assertInvariant(
  condition: boolean,
  message: string,
  options?: { critical?: boolean },
): boolean {
  if (condition) return true
  if (options?.critical || shouldThrowUiInvariant) {
    throw new Error(message)
  }
  return false
}
