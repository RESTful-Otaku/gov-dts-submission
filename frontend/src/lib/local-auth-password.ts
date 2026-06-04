/**
 * Verifies passwords against hashes produced by the API seed (`passwordHashForSeed` in Go)
 * and by `hashPassword` in auth_session.go (salt.base64 format, Argon2id).
 */
import { argon2id } from 'hash-wasm'

const ARGON2_TIME = 1
const ARGON2_MEMORY_KIB = 64 * 1024
const ARGON2_PARALLELISM = 4
const ARGON2_HASH_LENGTH = 32

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let v = 0
  for (let i = 0; i < a.length; i++) v |= a[i]! ^ b[i]!
  return v === 0
}

export async function verifyPasswordArgon2id(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('.')
  if (parts.length !== 2) return false
  const saltB64 = parts[0]!
  const wantB64 = parts[1]!
  let salt: Uint8Array
  let want: Uint8Array
  try {
    salt = Uint8Array.from(atob(saltB64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
    const wantPad = wantB64.padEnd(wantB64.length + ((4 - (wantB64.length % 4)) % 4), '=')
    want = Uint8Array.from(atob(wantPad.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
  } catch {
    return false
  }
  const got = await argon2id({
    password,
    salt,
    iterations: ARGON2_TIME,
    memorySize: ARGON2_MEMORY_KIB,
    parallelism: ARGON2_PARALLELISM,
    hashLength: ARGON2_HASH_LENGTH,
    outputType: 'binary',
  })
  return constantTimeEqual(got, want)
}

export async function hashPasswordArgon2id(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hashBin = await argon2id({
    password,
    salt,
    iterations: ARGON2_TIME,
    memorySize: ARGON2_MEMORY_KIB,
    parallelism: ARGON2_PARALLELISM,
    hashLength: ARGON2_HASH_LENGTH,
    outputType: 'binary',
  })
  const b64 = (bytes: Uint8Array) => {
    let s = ''
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!)
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  return `${b64(salt)}.${b64(hashBin)}`
}
