import { randomUUID } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import type { AccountInput, AccountRecord, AuthStorage, SessionInput, StorageFailure } from './storage.ts'
import { success, unavailable } from './storage.ts'
import type { StudyValues, User } from '../shared/contracts.ts'

const SESSION_INSERT_SQL = `WITH expired AS (DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP)
  INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)`

function databaseFailure(error: unknown): StorageFailure {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
    && 'constraint' in error && error.constraint === 'users_email_key') return { ok: false, error: 'EMAIL_TAKEN' }
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23514'
    && 'constraint' in error && error.constraint === 'user_data_size_limit') return { ok: false, error: 'DATA_TOO_LARGE' }
  return unavailable()
}

export class PostgresStorage implements AuthStorage {
  private pool: Pool
  constructor(pool: Pool) { this.pool = pool }
  async createAccount(input: AccountInput, session: SessionInput) {
    let client: PoolClient | undefined
    try {
      client = await this.pool.connect()
      await client.query('BEGIN')
      const inserted = await client.query<User>(
        'INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, email, name',
        [randomUUID(), input.email, input.name, input.passwordHash],
      )
      const user = inserted.rows[0]!
      await client.query(SESSION_INSERT_SQL,
        [session.tokenHash, user.id, session.expiresAt])
      await client.query('COMMIT')
      return success(user)
    } catch (error) {
      try { await client?.query('ROLLBACK') } catch { /* Driver failures stay private. */ }
      return databaseFailure(error)
    } finally {
      try { client?.release() } catch { /* Do not turn a result into an exception. */ }
    }
  }
  async findAccount(email: string) {
    try {
      const result = await this.pool.query<User & { password_hash: string }>(
        'SELECT id, email, name, password_hash FROM users WHERE email = $1', [email])
      const row = result.rows[0]
      return success<AccountRecord | null>(row ? { id: row.id, email: row.email, name: row.name, passwordHash: row.password_hash } : null)
    } catch (error) { return databaseFailure(error) }
  }
  async createSession(userId: string, session: SessionInput) {
    try {
      await this.pool.query(
        SESSION_INSERT_SQL,
        [session.tokenHash, userId, session.expiresAt],
      )
      return success(null)
    } catch (error) { return databaseFailure(error) }
  }
  async findSession(tokenHash: string) {
    try {
      const result = await this.pool.query<User & { expires_at: Date }>(
        `SELECT u.id, u.email, u.name, s.expires_at FROM sessions s
         JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1`, [tokenHash])
      const row = result.rows[0]
      return success(row ? { user: { id: row.id, email: row.email, name: row.name }, expiresAt: row.expires_at } : null)
    } catch (error) { return databaseFailure(error) }
  }
  async deleteSession(tokenHash: string) {
    try {
      await this.pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash])
      return success(null)
    } catch (error) { return databaseFailure(error) }
  }
  async loadValues(userId: string) {
    try {
      const result = await this.pool.query<{ study_values: StudyValues }>('SELECT study_values FROM user_data WHERE user_id = $1', [userId])
      return success(result.rows[0]?.study_values ?? {})
    } catch (error) { return databaseFailure(error) }
  }
  async mergeValues(userId: string, values: StudyValues) {
    try {
      const result = await this.pool.query<{ study_values: StudyValues }>(
        `INSERT INTO user_data (user_id, study_values) VALUES ($1, $2::jsonb)
         ON CONFLICT (user_id) DO UPDATE
         SET study_values = user_data.study_values || EXCLUDED.study_values, updated_at = CURRENT_TIMESTAMP
         RETURNING study_values`,
        [userId, JSON.stringify(values)],
      )
      return success(result.rows[0]!.study_values)
    } catch (error) { return databaseFailure(error) }
  }
  async health() {
    try {
      await this.pool.query('SELECT 1 FROM users LIMIT 1')
      return success(null)
    } catch (error) { return databaseFailure(error) }
  }
}
