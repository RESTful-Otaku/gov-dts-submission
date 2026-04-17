import { describe, expect, it } from 'vitest'
import { verifyPasswordArgon2id } from '../src/lib/local-auth-password'

/** Matches `go run ./cmd/printseedhash` with password DemoPass123! */
const DEMO_HASH =
  'ZHRzLXNlZWQtc3RhdGljLXNhbHQ.iksu6ZH6hbv9/hnscrqzw1U3oRvBKL3mi886+Ga8XQ0'

describe('local-auth-password', () => {
  it('verifies DemoPass123! against Go seed hash', async () => {
    expect(await verifyPasswordArgon2id('DemoPass123!', DEMO_HASH)).toBe(true)
    expect(await verifyPasswordArgon2id('wrong', DEMO_HASH)).toBe(false)
  })
})
