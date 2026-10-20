import { describe, expect, it } from 'vitest'
import { loadServerConfig } from './config.ts'

describe('server configuration', () => {
  it('parses local origins and ports, requires private secrets, and verifies certificates for optional remote PostgreSQL TLS', () => {
    const environment = {
      DATABASE_URL: 'postgresql://reader:private-password@localhost:5433/study',
      SESSION_SECRET: 'a'.repeat(64), PORT: '3001', APP_ORIGIN: 'http://localhost:5173,http://127.0.0.1:5173',
      DATABASE_SSL: 'true', NODE_ENV: 'production',
    }
    expect(loadServerConfig(environment)).toMatchObject({
      databaseUrl: environment.DATABASE_URL, sessionSecret: environment.SESSION_SECRET, port: 3001,
      allowedOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'], host: '127.0.0.1',
      production: true, ssl: { rejectUnauthorized: true },
    })
    for (const overrides of [{ SESSION_SECRET: 'short' }, { DATABASE_URL: '' }, { PORT: '99999' }, { APP_ORIGIN: 'https://evil.example/path' }, { DATABASE_SSL: 'skip-verification' }]) {
      expect(() => loadServerConfig({ ...environment, ...overrides })).toThrow()
    }
  })
  it('rejects connection-string TLS flags that could override certificate verification', () => {
    const environment = { SESSION_SECRET: 'a'.repeat(64), DATABASE_SSL: 'true' }
    for (const parameter of ['sslmode=no-verify', 'sslmode=require', 'ssl=false', 'sslcert=client.pem', 'sslkey=client.key', 'sslrootcert=root.pem']) {
      expect(() => loadServerConfig({ ...environment, DATABASE_URL: `postgresql://reader:secret@db.example/study?${parameter}` }))
        .toThrow('connection-string SSL')
    }
  })
})
