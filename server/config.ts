import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ConnectionOptions } from 'node:tls'
import { config as dotenvConfig } from 'dotenv'
import { z } from 'zod'

export class ConfigurationError extends Error {}

export function loadEnvironment() {
  dotenvConfig({ path: resolve(process.cwd(), '.env.local'), quiet: true })
}

const DatabaseEnvironmentSchema = z.object({
  DATABASE_URL: z.string().url().refine(value => /^postgres(?:ql)?:\/\//.test(value)),
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),
  DATABASE_SSL_CA_FILE: z.string().min(1).optional(),
})

export function loadDatabaseConfig(environment: NodeJS.ProcessEnv = process.env) {
  const parsed = DatabaseEnvironmentSchema.safeParse(environment)
  if (!parsed.success) throw new ConfigurationError('Configure a valid DATABASE_URL and DATABASE_SSL (true or false).')
  const database = parsed.data
  const url = new URL(database.DATABASE_URL)
  if (['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat'].some(key => url.searchParams.has(key))) {
    throw new ConfigurationError('Remove connection-string SSL parameters; use DATABASE_SSL=true and DATABASE_SSL_CA_FILE for verified TLS.')
  }
  let ssl: false | ConnectionOptions = false
  if (database.DATABASE_SSL === 'true') {
    ssl = { rejectUnauthorized: true }
    if (database.DATABASE_SSL_CA_FILE) {
      try { ssl.ca = readFileSync(resolve(process.cwd(), database.DATABASE_SSL_CA_FILE), 'utf8') }
      catch { throw new ConfigurationError('DATABASE_SSL_CA_FILE could not be read.') }
    }
  } else if (database.DATABASE_SSL_CA_FILE) {
    throw new ConfigurationError('DATABASE_SSL_CA_FILE requires DATABASE_SSL=true.')
  }
  return { databaseUrl: database.DATABASE_URL, ssl }
}

const ServerEnvironmentSchema = z.object({
  SESSION_SECRET: z.string().min(32).max(512),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().trim().min(1).default('127.0.0.1'),
  APP_ORIGIN: z.string().optional(),
  NODE_ENV: z.string().optional(),
})

export function loadServerConfig(environment: NodeJS.ProcessEnv = process.env) {
  const parsed = ServerEnvironmentSchema.safeParse(environment)
  if (!parsed.success) throw new ConfigurationError('Configure SESSION_SECRET with at least 32 characters and a valid PORT/HOST.')
  const server = parsed.data
  const candidates = server.APP_ORIGIN?.split(',').map(value => value.trim()) ?? [
    'http://localhost:5173', 'http://127.0.0.1:5173', `http://localhost:${server.PORT}`, `http://127.0.0.1:${server.PORT}`,
  ]
  const allowedOrigins = candidates.map(value => {
    try {
      const url = new URL(value)
      if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error()
      return url.origin
    } catch { throw new ConfigurationError('APP_ORIGIN must contain comma-separated HTTP(S) origins without paths.') }
  })
  return {
    ...loadDatabaseConfig(environment), sessionSecret: server.SESSION_SECRET,
    port: server.PORT, host: server.HOST, production: server.NODE_ENV === 'production',
    allowedOrigins: [...new Set(allowedOrigins)],
  }
}
