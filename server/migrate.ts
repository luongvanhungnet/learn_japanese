import { Pool } from 'pg'
import { ConfigurationError, loadDatabaseConfig, loadEnvironment } from './config.ts'
import { runMigrations } from './migration-runner.ts'

async function main() {
  loadEnvironment()
  const database = loadDatabaseConfig()
  const pool = new Pool({ connectionString: database.databaseUrl, ssl: database.ssl, connectionTimeoutMillis: 5000, statement_timeout: 30000 })
  pool.on('error', () => console.error('A database connection became unavailable.'))
  try {
    const result = await runMigrations(pool)
    if (!result.ok) {
      console.error('Database migrations failed. Check PostgreSQL connectivity and the migration files.')
      process.exitCode = 1
      return
    }
    console.info(result.applied.length ? `Applied database migrations: ${result.applied.join(', ')}` : 'Database migrations are up to date.')
  } finally { await pool.end() }
}

main().catch(error => {
  console.error(error instanceof ConfigurationError ? error.message : 'Database migration configuration is unavailable.')
  process.exitCode = 1
})
