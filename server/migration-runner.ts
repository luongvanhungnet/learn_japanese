import { readdir, readFile } from 'node:fs/promises'
import type { Pool, PoolClient } from 'pg'

export type MigrationResult = { ok: true; applied: string[] } | { ok: false; error: 'MIGRATION_FAILED' }
export async function runMigrations(pool: Pool): Promise<MigrationResult> {
  let client: PoolClient | undefined
  try {
    const directory = new URL('./migrations/', import.meta.url)
    const files = (await readdir(directory)).filter(file => /^\d+_[a-z0-9_]+\.sql$/.test(file)).sort()
    client = await pool.connect()
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock($1)', [746219305])
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
    const previous = await client.query<{ version: string }>('SELECT version FROM schema_migrations')
    const appliedVersions = new Set(previous.rows.map(row => row.version))
    const applied: string[] = []
    for (const file of files) {
      if (appliedVersions.has(file)) continue
      await client.query(await readFile(new URL(file, directory), 'utf8'))
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file])
      applied.push(file)
    }
    await client.query('COMMIT')
    return { ok: true, applied }
  } catch {
    try { await client?.query('ROLLBACK') } catch { /* Keep connection details private. */ }
    return { ok: false, error: 'MIGRATION_FAILED' }
  } finally {
    try { client?.release() } catch { /* Preserve the typed migration result. */ }
  }
}
