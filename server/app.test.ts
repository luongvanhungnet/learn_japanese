import { describe, expect, it } from 'vitest'
import { MemoryStorage, signup, testApp } from './test-helpers.ts'
import { unavailable } from './storage.ts'
import { MAX_USER_DATA_BYTES } from '../shared/contracts.ts'

describe('authentication API', () => {
  it('signs up with a private salted password and opaque seven-day session cookie', async () => {
    const storage = new MemoryStorage()
    const { request } = await testApp({ storage })
    const response = await request('/api/auth/signup', { body: signup })
    expect(response.status).toBe(201)
    expect(response.body).toEqual({ user: { id: expect.any(String), email: signup.email, name: signup.name } })
    const cookie = response.headers.get('set-cookie')!
    expect(cookie).toMatch(/mimikara_session=[A-Za-z0-9_-]{43};/)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Max-Age=604800')
    const account = storage.accounts.get(signup.email)!
    expect(account.passwordHash).toMatch(/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/)
    expect(account.passwordHash).not.toContain(signup.password)
    const session = [...storage.sessions.values()][0]!
    expect(session.tokenHash).toMatch(/^[a-f0-9]{64}$/)
    expect(cookie).not.toContain(session.tokenHash)
  })
  it('persists only the password hash and gives equal passwords different salts', async () => {
    const storage = new MemoryStorage()
    const { request } = await testApp({ storage })
    await request('/api/auth/signup', { body: signup })
    await request('/api/auth/signup', { body: { ...signup, email: 'another@example.com' } })
    const accounts = [...storage.accounts.values()]
    expect(accounts[0]).not.toHaveProperty('password')
    expect(accounts[0]!.passwordHash).not.toEqual(accounts[1]!.passwordHash)
  })
  it('restores an active session and rejects absent, tampered, and expired cookies', async () => {
    let time = new Date('2026-10-10T12:00:00Z')
    const { request } = await testApp({ now: () => time })
    expect((await request('/api/auth/session')).body).toEqual({ user: null })
    const created = await request('/api/auth/signup', { body: signup })
    const cookie = created.headers.get('set-cookie')!.split(';')[0]!
    const restored = await request('/api/auth/session', { cookie })
    expect(restored.status).toBe(200)
    expect(restored.body).toEqual(created.body)
    expect((await request('/api/auth/session', { cookie: 'mimikara_session=' + 'x'.repeat(43) })).body).toEqual({ user: null })
    time = new Date(time.getTime() + 7 * 24 * 60 * 60 * 1000)
    const expired = await request('/api/auth/session', { cookie })
    expect(expired.body).toEqual({ user: null })
    expect(expired.headers.get('set-cookie')).toContain('Expires=Thu, 01 Jan 1970')
  })
  it('logs in with normalized email and returns the same generic error for unknown accounts or wrong passwords', async () => {
    const { request } = await testApp()
    const created = await request('/api/auth/signup', { body: signup })
    const wrong = await request('/api/auth/login', { body: { email: signup.email, password: 'wrong password' } })
    const unknown = await request('/api/auth/login', { body: { email: 'missing@example.com', password: 'wrong password' } })
    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(unknown.body).toEqual(wrong.body)
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS')
    const loggedIn = await request('/api/auth/login', { body: { email: ' READER@EXAMPLE.COM ', password: signup.password } })
    expect(loggedIn.status).toBe(200)
    expect(loggedIn.body).toEqual(created.body)
    expect(loggedIn.headers.get('set-cookie')).not.toEqual(created.headers.get('set-cookie'))
    expect((await request('/api/auth/session', { cookie: loggedIn.headers.get('set-cookie')!.split(';')[0] })).body).toEqual(created.body)
  })
  it('logs out by revoking the server session and clearing its cookie', async () => {
    const storage = new MemoryStorage()
    const { request } = await testApp({ storage })
    const created = await request('/api/auth/signup', { body: signup })
    const cookie = created.headers.get('set-cookie')!.split(';')[0]!
    const loggedOut = await request('/api/auth/logout', { method: 'POST', cookie })
    expect(loggedOut.status).toBe(200)
    expect(loggedOut.body).toEqual({ user: null })
    expect(loggedOut.headers.get('set-cookie')).toContain('Expires=Thu, 01 Jan 1970')
    expect(storage.sessions.size).toBe(0)
    expect((await request('/api/auth/session', { cookie })).body).toEqual({ user: null })
    expect((await request('/api/auth/logout', { method: 'POST' })).body).toEqual({ user: null })
  })
  it('keeps study data private to each user and merges patches while preserving explicit null resets', async () => {
    const { request } = await testApp()
    expect((await request('/api/user-data')).status).toBe(401)
    expect((await request('/api/user-data', { method: 'PATCH', body: { values: {} } })).status).toBe(401)
    const first = await request('/api/auth/signup', { body: signup })
    const second = await request('/api/auth/signup', { body: { ...signup, email: 'second@example.com' } })
    const firstCookie = first.headers.get('set-cookie')!.split(';')[0]!
    const secondCookie = second.headers.get('set-cookie')!.split(';')[0]!
    expect((await request('/api/user-data', { cookie: firstCookie })).body).toEqual({ values: {} })
    const patch = { 'mimikara-language': 'en', 'mimikara-progress-v1': '{"1":"done"}' }
    expect((await request('/api/user-data', { method: 'PATCH', cookie: firstCookie, body: { values: patch } })).body).toEqual({ values: patch })
    const reset = await request('/api/user-data', { method: 'PATCH', cookie: firstCookie, body: { values: { 'mimikara-language': null } } })
    expect(reset.body).toEqual({ values: { ...patch, 'mimikara-language': null } })
    expect((await request('/api/user-data', { cookie: firstCookie })).body).toEqual(reset.body)
    expect((await request('/api/user-data', { cookie: secondCookie })).body).toEqual({ values: {} })
  })
  it('rejects absent and untrusted origins on every unsafe API before changing state', async () => {
    const { request } = await testApp()
    const created = await request('/api/auth/signup', { body: signup })
    const cookie = created.headers.get('set-cookie')!.split(';')[0]!
    for (const origin of [null, 'null', 'https://attacker.example', 'http://localhost:5173.attacker.example']) {
      for (const [path, body, method] of [
        ['/api/auth/signup', { ...signup, email: 'evil@example.com' }, 'POST'],
        ['/api/auth/login', { email: signup.email, password: signup.password }, 'POST'],
        ['/api/auth/logout', undefined, 'POST'],
        ['/api/user-data', { values: { 'mimikara-language': 'evil' } }, 'PATCH'],
      ] as const) {
        const blocked = await request(path, { body, method, origin, cookie })
        expect(blocked.status).toBe(403)
        expect(blocked.body.error.code).toBe('INVALID_ORIGIN')
      }
    }
    expect((await request('/api/auth/session', { cookie })).body).toEqual(created.body)
    expect((await request('/api/user-data', { cookie })).body).toEqual({ values: {} })
  })
  it('rate limits signup and login by socket IP, advertises retry time, and resets the window', async () => {
    let time = new Date('2026-10-10T12:00:00Z')
    const { request } = await testApp({ now: () => time, rateLimits: { login: 2, signup: 1, windowMs: 1000 } })
    expect((await request('/api/auth/signup', { body: signup })).status).toBe(201)
    const signupBlocked = await request('/api/auth/signup', { body: { ...signup, email: 'two@example.com' } })
    expect(signupBlocked.status).toBe(429)
    expect(signupBlocked.body.error.code).toBe('RATE_LIMITED')
    expect(signupBlocked.headers.get('retry-after')).toBe('1')
    for (let attempt = 0; attempt < 2; attempt++) {
      expect((await request('/api/auth/login', { body: { email: signup.email, password: 'wrong password' } })).status).toBe(401)
    }
    expect((await request('/api/auth/login', { body: { email: signup.email, password: signup.password }, headers: { 'X-Forwarded-For': '203.0.113.44' } })).status).toBe(429)
    time = new Date(time.getTime() + 1001)
    expect((await request('/api/auth/login', { body: { email: signup.email, password: signup.password } })).status).toBe(200)
  })
  it('rejects stale account headers so a delayed patch cannot write to a switched account', async () => {
    const { request } = await testApp()
    const first = await request('/api/auth/signup', { body: signup })
    const second = await request('/api/auth/signup', { body: { ...signup, email: 'second@example.com' } })
    const cookie = second.headers.get('set-cookie')!.split(';')[0]!
    for (const method of ['GET', 'PATCH']) {
      const stale = await request('/api/user-data', {
        cookie, method, headers: { 'X-Study-Account': first.body.user.id },
        ...(method === 'PATCH' ? { body: { values: { 'mimikara-language': 'en' } } } : {}),
      })
      expect(stale.status).toBe(409)
      expect(stale.body.error.code).toBe('ACCOUNT_CHANGED')
    }
    expect((await request('/api/user-data', { cookie, headers: { 'X-Study-Account': second.body.user.id } })).body).toEqual({ values: {} })
  })
  it('uses secure production cookies, private response headers, typed malformed-input errors, and database-aware health', async () => {
    const storage = new MemoryStorage()
    const { request } = await testApp({ storage, production: true })
    const created = await request('/api/auth/signup', { body: signup })
    expect(created.headers.get('set-cookie')).toContain('Secure')
    expect(created.headers.get('cache-control')).toBe('no-store')
    expect(created.headers.get('x-content-type-options')).toBe('nosniff')
    expect(created.headers.get('x-frame-options')).toBe('DENY')
    expect(created.headers.get('strict-transport-security')).toContain('max-age=31536000')
    expect(created.headers.get('x-powered-by')).toBeNull()
    const invalidJson = await request('/api/auth/login', { rawBody: '{broken' })
    expect(invalidJson.status).toBe(400)
    expect(invalidJson.body.error.code).toBe('INVALID_INPUT')
    expect((await request('/api/health')).body).toEqual({ status: 'ok' })
    storage.health = async () => unavailable()
    const unhealthy = await request('/api/health')
    expect(unhealthy.status).toBe(503)
    expect(unhealthy.body.error.code).toBe('DATABASE_UNAVAILABLE')
    expect((await request('/api/unknown')).body.error.code).toBe('NOT_FOUND')
  })
  it('keeps database outages distinct from signed-out sessions and reports oversize bodies without saving them', async () => {
    const storage = new MemoryStorage()
    const { request } = await testApp({ storage })
    const created = await request('/api/auth/signup', { body: signup })
    const cookie = created.headers.get('set-cookie')!.split(';')[0]!
    const oversize = await request('/api/user-data', {
      method: 'PATCH', cookie,
      rawBody: '{"values":{"mimikara-progress-v1":"' + 'x'.repeat(MAX_USER_DATA_BYTES) + '"}}',
    })
    expect(oversize.status).toBe(413)
    expect(oversize.body.error.code).toBe('REQUEST_TOO_LARGE')
    expect(storage.values.size).toBe(0)
    storage.findSession = async () => unavailable()
    const unavailableSession = await request('/api/auth/session', { cookie })
    expect(unavailableSession.status).toBe(503)
    expect(unavailableSession.body.error.code).toBe('DATABASE_UNAVAILABLE')
    expect(unavailableSession.body).not.toHaveProperty('user')
    expect((await request('/api/user-data', { cookie })).status).toBe(503)
  })
})
