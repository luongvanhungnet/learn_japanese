import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import express from 'express'
import { Pool } from 'pg'
import { createApp } from './app.ts'
import { ConfigurationError, loadEnvironment, loadServerConfig } from './config.ts'
import { PostgresStorage } from './postgres.ts'

function main() {
  loadEnvironment()
  const configuration = loadServerConfig()
  const pool = new Pool({ connectionString: configuration.databaseUrl, ssl: configuration.ssl, max: 10, connectionTimeoutMillis: 5000, statement_timeout: 15000 })
  pool.on('error', () => console.error('A database connection became unavailable.'))
  const app = createApp({
    storage: new PostgresStorage(pool), sessionSecret: configuration.sessionSecret,
    allowedOrigins: configuration.allowedOrigins, production: configuration.production,
  })
  const distribution = resolve(process.cwd(), 'dist')
  const indexFile = resolve(distribution, 'index.html')
  if (existsSync(indexFile)) {
    app.use(express.static(distribution))
    app.get(/.*/, (_request, response) => response.sendFile(indexFile))
  }
  const server = app.listen(configuration.port, configuration.host, () => {
    console.info(`Japanese study app listening at http://${configuration.host}:${configuration.port}`)
  })
  server.on('error', () => { console.error('The server could not listen on the configured host and port.'); process.exitCode = 1; void pool.end() })
  let closing = false
  const shutdown = () => {
    if (closing) return
    closing = true
    server.close(() => { void pool.end() })
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

try { main() } catch (error) {
  console.error(error instanceof ConfigurationError ? error.message : 'Server configuration is unavailable.')
  process.exitCode = 1
}
