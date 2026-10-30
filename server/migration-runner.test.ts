import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'
import { runMigrations } from './migration-runner.ts'

describe('database migrations', () => {
  it('serializes migrations in a transaction and skips previously applied versions', async () => {
    const query = vi.fn(async (sql: string) => ({ rows: sql.startsWith('SELECT version')
      ? [{ version: '001_auth.sql' }, { version: '002_exam_history.sql' }, { version: '003_word_flashcards.sql' }, { version: '004_game_progress.sql' }] : [] }))
    const release = vi.fn()
    const pool = { connect: vi.fn().mockResolvedValue({ query, release }) } as unknown as Pool
    expect(await runMigrations(pool)).toEqual({ ok: true, applied: [] })
    expect(query.mock.calls[0]![0]).toBe('BEGIN')
    expect(query.mock.calls[1]![0]).toContain('pg_advisory_xact_lock')
    expect(query.mock.calls.at(-1)![0]).toBe('COMMIT')
    expect(query.mock.calls.some(([sql]) => sql.includes('CREATE TABLE users'))).toBe(false)
    expect(release).toHaveBeenCalledOnce()
  })
  it('records successful migrations and rolls back failed SQL without exposing connection details', async () => {
    for (const failSql of [false, true]) {
      const query = vi.fn(async (sql: string) => {
        if (failSql && sql.includes('CREATE TABLE users')) throw new Error('postgres://private-password@database')
        return { rows: [] }
      })
      const release = vi.fn()
      const pool = { connect: vi.fn().mockResolvedValue({ query, release }) } as unknown as Pool
      expect(await runMigrations(pool)).toEqual(failSql ? { ok: false, error: 'MIGRATION_FAILED' }
        : { ok: true, applied: ['001_auth.sql', '002_exam_history.sql', '003_word_flashcards.sql', '004_game_progress.sql'] })
      expect(query.mock.calls.at(-1)).toEqual([failSql ? 'ROLLBACK' : 'COMMIT'])
      expect(release).toHaveBeenCalledOnce()
    }
  })
})
