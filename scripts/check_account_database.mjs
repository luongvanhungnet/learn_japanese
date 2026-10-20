import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { createApp } from '../server/app.ts'
import { loadEnvironment, loadServerConfig } from '../server/config.ts'
import { PostgresStorage } from '../server/postgres.ts'

// Acceptance check against the configured real PostgreSQL database. It only
// removes the two temporary accounts it creates, with cascaded test sessions/data.
loadEnvironment()
const config = loadServerConfig()
const pool = new Pool({ connectionString: config.databaseUrl, ssl: config.ssl, connectionTimeoutMillis: 5000 })
const app = createApp({ storage: new PostgresStorage(pool), sessionSecret: config.sessionSecret, allowedOrigins: ['http://localhost:5173'] })
const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)) })
const url = `http://127.0.0.1:${server.address().port}`
const created = []
const suffix = randomUUID()
const password = randomBytes(24).toString('base64url')
let checks = 0
const check = (condition, message) => { assert(condition, message); checks++ }
async function request(route, { method = 'GET', cookie, account, body, origin = 'http://localhost:5173' } = {}) {
  const response = await fetch(`${url}/api/${route}`, { method, headers: {
    ...(method !== 'GET' ? { Origin: origin, 'Content-Type': 'application/json' } : {}),
    ...(cookie ? { Cookie: cookie } : {}), ...(account ? { 'X-Study-Account': account } : {}),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const data = await response.json()
  const setCookie = response.headers.get('set-cookie')
  return { status: response.status, data, cookie: setCookie?.split(';')[0], setCookie }
}
try {
  check((await request('health')).status === 200, 'PostgreSQL health check failed')
  const first = await request('auth/signup', { method: 'POST', body: { name: 'Database Check A', email: `check-a-${suffix}@example.invalid`, password } })
  check(first.status === 201 && !!first.data.user?.id, 'Account creation failed')
  created.push(first.data.user.id)
  check(first.setCookie.includes('HttpOnly') && first.setCookie.includes('SameSite=Lax'), 'Session cookie protections are missing')
  check(!('passwordHash' in first.data.user), 'Private password fields appeared in the response')
  const identity = { cookie: first.cookie, account: first.data.user.id }
  const restored = await request('auth/session', identity)
  check(restored.data.user?.id === first.data.user.id, 'Cookie session restore failed')
  check((await request('user-data')).status === 401, 'Unauthenticated study data was accessible')
  const values = {
    'mimikara-progress-v1': JSON.stringify({ 'n3:1:reading': { solved: true, unresolved: false, revealed: false, hints: 0, answer: 'だんせい' } }),
    'mimikara-flashcards-v1': JSON.stringify({ 'flashcard:n3:taberu': { dueAt: Date.now() + 86400000, reviewedAt: Date.now(), rating: 'medium', reviews: 1 } }),
    'mimikara-language': 'vi',
    'mimikara-exams-v1': JSON.stringify({ version: 1, attempts: { 'database-check': {
      id: 'database-check', paperId: 'n3-2022-07', startedAt: 1700000000000,
      deadline: 1700006000000, answers: { 'vocabulary-1': 1 },
      submittedAt: 1700000100000, reason: 'manual',
    } } }),
  }
  check((await request('user-data', { ...identity, method: 'PATCH', body: { values } })).status === 200, 'Study data save failed')
  const loaded = await request('user-data', identity)
  check(loaded.data.values['mimikara-progress-v1'] === values['mimikara-progress-v1'], 'Practice progress did not round-trip')
  check(loaded.data.values['mimikara-flashcards-v1'] === values['mimikara-flashcards-v1'], 'Flashcard schedule did not round-trip')
  check(loaded.data.values['mimikara-exams-v1'] === values['mimikara-exams-v1'], 'Exam attempts did not round-trip')
  const second = await request('auth/signup', { method: 'POST', body: { name: 'Database Check B', email: `check-b-${suffix}@example.invalid`, password } })
  check(second.status === 201, 'Second account creation failed')
  created.push(second.data.user.id)
  const secondIdentity = { cookie: second.cookie, account: second.data.user.id }
  check(Object.keys((await request('user-data', secondIdentity)).data.values).length === 0, 'Account B received account A data')
  check((await request('user-data', { ...secondIdentity, account: identity.account, method: 'PATCH', body: { values } })).status === 409, 'A stale account request was accepted')
  check(Object.keys((await request('user-data', secondIdentity)).data.values).length === 0, 'A stale request changed account B')
  check((await request('user-data', { ...identity, method: 'PATCH', origin: 'https://other.example', body: { values } })).status === 403, 'An untrusted origin could save data')
  check((await request('user-data', { ...identity, method: 'PATCH', body: { values: { DATABASE_URL: 'blocked' } } })).status === 400, 'Unrecognized study keys were accepted')
  check((await request('user-data', { ...identity, method: 'PATCH', body: { values: { 'mimikara-novel-chapter-v1': '2' } } })).status === 200, 'Partial preference update failed')
  check((await request('user-data', identity)).data.values['mimikara-progress-v1'] === values['mimikara-progress-v1'], 'Partial updates replaced existing progress')
  const record = await pool.query('SELECT u.password_hash, d.study_values FROM users u JOIN user_data d ON d.user_id = u.id WHERE u.id = $1', [identity.account])
  check(record.rowCount === 1 && record.rows[0].password_hash.startsWith('scrypt$') && !record.rows[0].password_hash.includes(password), 'PostgreSQL password storage is invalid')
  check(record.rows[0].study_values['mimikara-language'] === 'vi', 'Study data did not persist in PostgreSQL')
  check((await request('auth/logout', { ...identity, method: 'POST', body: {} })).status === 200, 'Logout failed')
  check((await request('auth/session', identity)).data.user === null, 'Logout did not revoke the session')
  check((await request('user-data', identity)).status === 401, 'Revoked sessions retained access')
  check((await request('auth/login', { method: 'POST', body: { email: `check-a-${suffix}@example.invalid`, password: `${password}wrong` } })).status === 401, 'Incorrect credentials were accepted')
  const login = await request('auth/login', { method: 'POST', body: { email: `CHECK-A-${suffix}@example.invalid`, password } })
  check(login.status === 200 && login.data.user?.id === identity.account, 'Login normalization failed')
  check((await request('user-data', { cookie: login.cookie, account: identity.account })).data.values['mimikara-progress-v1'] === values['mimikara-progress-v1'], 'Progress was lost after logging in again')
  check((await request('user-data', { cookie: login.cookie, account: identity.account })).data.values['mimikara-exams-v1'] === values['mimikara-exams-v1'], 'Exam answers and submission were lost after logging in again')
  console.log(`Passed ${checks} PostgreSQL acceptance checks: accounts, cookie sessions, login/logout, progress persistence, origin checks, and user isolation.`)
} catch (error) {
  console.error(error instanceof assert.AssertionError ? error.message : 'PostgreSQL account acceptance check failed. Verify .env.local and run migrations.')
  process.exitCode = 1
} finally {
  try { if (created.length) await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [created]) }
  finally { await new Promise(resolve => server.close(resolve)); await pool.end() }
}
