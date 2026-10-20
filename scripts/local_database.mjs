import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'dotenv'
import pg from 'pg'

const project = fileURLToPath(new URL('../', import.meta.url))
const envPath = path.join(project, '.env.local')
const dataPath = path.join(project, '.postgres-data.local')
const logPath = path.join(project, '.postgres-server.local.log')
const port = 5433
const database = 'mimikara_study'
const admin = 'mimikara_local_admin'
const appUser = 'mimikara_app'
let source = await fs.readFile(envPath, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error })
const settings = parse(source)
const exists = async target => fs.access(target).then(() => true, () => false)

function run(command, args) {
  const result = spawnSync(command, args, { cwd: project, stdio: 'ignore', windowsHide: true, timeout: 60000 })
  if (result.error || result.status !== 0) throw new Error(`${path.basename(command)} failed. ${result.error?.code === 'ENOENT' ? 'Add the PostgreSQL bin directory to PATH.' : 'Check the local PostgreSQL log and port 5433.'}`)
}

async function appendSetting(key, value) {
  if (settings[key]) return
  source += `${source && !source.endsWith('\n') ? '\n' : ''}${key}=${value}\n`
  settings[key] = value
  await fs.writeFile(envPath, source, { mode: 0o600 })
}

try {
  const initialized = await exists(path.join(dataPath, 'PG_VERSION'))
  if (settings.DATABASE_URL && !initialized) {
    await appendSetting('SESSION_SECRET', randomBytes(48).toString('base64url'))
    await appendSetting('APP_ORIGIN', 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,http://localhost:3001,http://127.0.0.1:3001')
    await appendSetting('PORT', '3001')
    console.log('Keeping the existing DATABASE_URL in .env.local. Run npm run db:migrate to prepare it.')
    process.exit(0)
  }
  await appendSetting('PG_LOCAL_ADMIN_PASSWORD', randomBytes(32).toString('base64url'))
  await appendSetting('PG_LOCAL_APP_PASSWORD', randomBytes(32).toString('base64url'))
  await appendSetting('SESSION_SECRET', randomBytes(48).toString('base64url'))
  await appendSetting('APP_ORIGIN', 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,http://localhost:3001,http://127.0.0.1:3001')
  await appendSetting('PORT', '3001')
  const command = name => process.env.PG_BIN ? path.join(process.env.PG_BIN, `${name}${process.platform === 'win32' ? '.exe' : ''}`) : name
  if (!initialized) {
    const passwordFile = path.join(project, '.postgres-password.local')
    await fs.writeFile(passwordFile, settings.PG_LOCAL_ADMIN_PASSWORD, { mode: 0o600 })
    try { run(command('initdb'), ['-D', dataPath, '-U', admin, '--encoding=UTF8', '--auth=scram-sha-256', `--pwfile=${passwordFile}`]) }
    finally { await fs.unlink(passwordFile) }
  }
  const status = spawnSync(command('pg_ctl'), ['-D', dataPath, 'status'], { cwd: project, encoding: 'utf8', windowsHide: true })
  if (status.status !== 0) run(command('pg_ctl'), ['-D', dataPath, '-l', logPath, '-o', `-p ${port} -h 127.0.0.1`, '-w', 'start'])
  const client = new pg.Client({ host: '127.0.0.1', port, database: 'postgres', user: admin, password: settings.PG_LOCAL_ADMIN_PASSWORD })
  await client.connect()
  try {
    const role = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [appUser])
    if (!role.rowCount) {
      // The identifier is fixed, and the generated password contains only base64url characters.
      if (!/^[A-Za-z0-9_-]+$/.test(settings.PG_LOCAL_APP_PASSWORD)) throw new Error('Invalid local application password format.')
      await client.query(`CREATE ROLE ${appUser} LOGIN PASSWORD '${settings.PG_LOCAL_APP_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE`)
    }
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database])
    if (!existing.rowCount) await client.query(`CREATE DATABASE ${database} OWNER ${appUser}`)
  } finally { await client.end() }
  await appendSetting('DATABASE_URL', `postgresql://${appUser}:${settings.PG_LOCAL_APP_PASSWORD}@127.0.0.1:${port}/${database}`)
  console.log(`Local PostgreSQL is ready on 127.0.0.1:${port}; database ${database}. Secrets are saved in .env.local.`)
} catch {
  console.error('Local database setup failed. Check PostgreSQL bin tools on PATH, port 5433, and .postgres-server.local.log. Existing data was kept.')
  process.exitCode = 1
}
