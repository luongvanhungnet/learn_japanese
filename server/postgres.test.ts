import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'
import { PostgresStorage } from './postgres.ts'

describe('PostgreSQL storage adapter', () => {
  it('creates an account and session in one transaction using parameterized SQL', async () => {
    const user = { id: randomUUID(), email: 'reader@example.com', name: 'Reader' }
    const query = vi.fn().mockResolvedValue({ rows: [] })
      .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [user] })
    const release = vi.fn()
    const pool = { connect: vi.fn().mockResolvedValue({ query, release }) } as unknown as Pool
    const passwordHash = 'scrypt$' + 'a'.repeat(32) + '$' + 'b'.repeat(128)
    const session = { tokenHash: 'c'.repeat(64), expiresAt: new Date('2026-10-17T12:00:00Z') }
    expect(await new PostgresStorage(pool).createAccount({ ...user, passwordHash }, session)).toEqual({ ok: true, value: user })
    expect(query.mock.calls[0]![0]).toBe('BEGIN')
    expect(query.mock.calls[1]![0]).toContain('INSERT INTO users')
    expect(query.mock.calls[1]![0]).toContain('$1')
    expect(query.mock.calls[1]![1]).toEqual([expect.any(String), user.email, user.name, passwordHash])
    expect(query.mock.calls[2]![0]).toContain('INSERT INTO sessions')
    expect(query.mock.calls[2]![1]).toEqual([session.tokenHash, user.id, session.expiresAt])
    expect(query.mock.calls[3]![0]).toBe('COMMIT')
    expect(release).toHaveBeenCalledOnce()
  })
  it('looks up credentials and session owners without interpolating identifiers and revokes a single opaque session', async () => {
    const user = { id: randomUUID(), email: 'reader@example.com', name: 'Reader' }
    const expiresAt = new Date('2026-10-17T12:00:00Z')
    const query = vi.fn().mockResolvedValue({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...user, password_hash: 'private-hash' }] })
      .mockResolvedValueOnce({ rows: [{ ...user, expires_at: expiresAt }] })
    const storage = new PostgresStorage({ query } as unknown as Pool)
    const email = "reader@example.com'; DROP TABLE users; --"
    expect(await storage.findAccount(email)).toEqual({ ok: true, value: { ...user, passwordHash: 'private-hash' } })
    expect(await storage.findSession('hashed-token')).toEqual({ ok: true, value: { user, expiresAt } })
    expect(await storage.createSession(user.id, { tokenHash: 'fresh-hash', expiresAt })).toEqual({ ok: true, value: null })
    expect(await storage.deleteSession('hashed-token')).toEqual({ ok: true, value: null })
    expect(query.mock.calls[0]![1]).toEqual([email])
    expect(query.mock.calls[0]![0]).not.toContain(email)
    expect(query.mock.calls[1]![1]).toEqual(['hashed-token'])
    expect(query.mock.calls[2]![1]).toEqual(['fresh-hash', user.id, expiresAt])
    expect(query.mock.calls[3]![0]).toContain('DELETE FROM sessions WHERE token_hash = $1')
  })
  it('loads only the session user’s data and merges patches atomically in PostgreSQL', async () => {
    const userId = randomUUID()
    const values = { 'mimikara-language': 'en', 'mimikara-progress-v1': null }
    const query = vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ study_values: values }] })
    const storage = new PostgresStorage({ query } as unknown as Pool)
    expect(await storage.loadValues(userId)).toEqual({ ok: true, value: {} })
    expect(await storage.mergeValues(userId, values)).toEqual({ ok: true, value: values })
    expect(query.mock.calls[0]![0]).toContain('WHERE user_id = $1')
    expect(query.mock.calls[0]![1]).toEqual([userId])
    expect(query.mock.calls[1]![0]).toContain('ON CONFLICT (user_id) DO UPDATE')
    expect(query.mock.calls[1]![0]).toContain('user_data.study_values || EXCLUDED.study_values')
    expect(query.mock.calls[1]![1]).toEqual([userId, JSON.stringify(values)])
  })
  it('returns a typed size failure when an otherwise valid patch would make stored data exceed the limit', async () => {
    const query = vi.fn().mockRejectedValue({ code: '23514', constraint: 'user_data_size_limit', detail: 'private stored data' })
    const storage = new PostgresStorage({ query } as unknown as Pool)
    expect(await storage.mergeValues(randomUUID(), { 'mimikara-language': 'en' })).toEqual({ ok: false, error: 'DATA_TOO_LARGE' })
  })
  it('checks migrated database health and hides unavailable database details', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(new Error('postgres://secret-password@private-db'))
    const storage = new PostgresStorage({ query } as unknown as Pool)
    expect(await storage.health()).toEqual({ ok: true, value: null })
    expect(await storage.health()).toEqual({ ok: false, error: 'DATABASE_UNAVAILABLE' })
    expect(query.mock.calls[0]![0]).toContain('FROM users')
  })
  it('rolls back a duplicate-email race and session insertion failures without leaking driver details', async () => {
    for (const failure of [
      { at: 2, error: { code: '23505', constraint: 'users_email_key', detail: 'private email' }, expected: 'EMAIL_TAKEN' },
      { at: 3, error: new Error('postgres://private-password@database'), expected: 'DATABASE_UNAVAILABLE' },
    ]) {
      const user = { id: randomUUID(), email: 'reader@example.com', name: 'Reader' }
      let call = 0
      const query = vi.fn(async () => {
        call++
        if (call === failure.at) throw failure.error
        return { rows: call === 2 ? [user] : [] }
      })
      const release = vi.fn()
      const pool = { connect: vi.fn().mockResolvedValue({ query, release }) } as unknown as Pool
      expect(await new PostgresStorage(pool).createAccount({ ...user, passwordHash: 'private hash' }, { tokenHash: 'opaque hash', expiresAt: new Date() }))
        .toEqual({ ok: false, error: failure.expected })
      expect(query.mock.calls.at(-1)).toEqual(['ROLLBACK'])
      expect(release).toHaveBeenCalledOnce()
    }
  })
})
