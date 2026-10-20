import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const derivePassword = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
    if (error) reject(error)
    else resolve(key)
  })
})

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const key = await derivePassword(password, salt)
  return `scrypt$${salt}$${key.toString('hex')}`
}

export function createSessionToken(secret: string) {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashSessionToken(token, secret) }
}

export function hashSessionToken(token: string, secret: string) {
  return createHmac('sha256', secret).update(token).digest('hex')
}

// Fixed dummy input makes unknown accounts take the same expensive derivation
// path as a real account; it is never accepted as an account password.
export async function verifyPassword(password: string, passwordHash: string | null) {
  const match = passwordHash?.match(/^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/)
  const actual = await derivePassword(password, match?.[1] ?? '0'.repeat(32))
  const expected = Buffer.from(match?.[2] ?? '0'.repeat(128), 'hex')
  return timingSafeEqual(actual, expected) && !!match
}
