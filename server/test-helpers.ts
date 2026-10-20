import { randomUUID } from 'node:crypto'
import type { Server } from 'node:http'
import { afterEach } from 'vitest'
import type { StudyValues, User } from '../shared/contracts.ts'
import { createApp, type AppOptions } from './app.ts'
import { success, type AccountInput, type AccountRecord, type AuthStorage, type SessionInput } from './storage.ts'

export class MemoryStorage implements AuthStorage {
  accounts = new Map<string, AccountRecord>()
  sessions = new Map<string, SessionInput & { userId: string }>()
  values = new Map<string, StudyValues>()
  async createAccount(input: AccountInput, session: SessionInput) {
    if (this.accounts.has(input.email)) return { ok: false as const, error: 'EMAIL_TAKEN' as const }
    const account = { ...input, id: randomUUID() }
    this.accounts.set(input.email, account)
    await this.createSession(account.id, session)
    return success<User>({ id: account.id, email: account.email, name: account.name })
  }
  async findAccount(email: string) { return success(this.accounts.get(email) ?? null) }
  async createSession(userId: string, session: SessionInput) {
    this.sessions.set(session.tokenHash, { ...session, userId })
    return success(null)
  }
  async findSession(tokenHash: string) {
    const session = this.sessions.get(tokenHash)
    const account = [...this.accounts.values()].find(value => value.id === session?.userId)
    if (!session || !account) return success(null)
    return success({ user: { id: account.id, email: account.email, name: account.name }, expiresAt: session.expiresAt })
  }
  async deleteSession(tokenHash: string) { this.sessions.delete(tokenHash); return success(null) }
  async loadValues(userId: string) { return success(this.values.get(userId) ?? {}) }
  async mergeValues(userId: string, values: StudyValues) {
    const updated = { ...this.values.get(userId), ...values }
    this.values.set(userId, updated)
    return success(updated)
  }
  async health() { return success(null) }
}

const servers: Server[] = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
    server.closeAllConnections()
  })))
})

export async function testApp(options: Partial<AppOptions> = {}) {
  const storage = options.storage ?? new MemoryStorage()
  const app = createApp({ storage, sessionSecret: 'test-secret-of-at-least-thirty-two-bytes', allowedOrigins: ['http://localhost:5173'], ...options })
  const server = app.listen(0, '127.0.0.1')
  servers.push(server)
  await new Promise<void>(resolve => server.once('listening', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server has no address')
  const request = async (path: string, input: { method?: string; body?: unknown; cookie?: string; origin?: string | null; rawBody?: string; headers?: Record<string, string> } = {}) => {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: input.method ?? (input.body === undefined && input.rawBody === undefined ? 'GET' : 'POST'),
      headers: {
        Origin: 'http://localhost:5173',
        ...(input.body !== undefined || input.rawBody !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(input.cookie ? { Cookie: input.cookie } : {}),
        ...(input.origin !== undefined ? { Origin: input.origin ?? '' } : {}),
        ...input.headers,
      },
      body: input.rawBody ?? (input.body === undefined ? undefined : JSON.stringify(input.body)),
    })
    const body = await response.text()
    return { status: response.status, headers: response.headers, body: body.startsWith('{') ? JSON.parse(body) : body }
  }
  return { storage, request }
}

export const signup = { name: 'Reader', email: 'reader@example.com', password: 'Strong password 123' }
