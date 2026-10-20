import express, { type NextFunction, type Request, type Response } from 'express'
import { LoginInputSchema, SignupInputSchema, UserDataInputSchema, type ApiErrorCode, type User } from '../shared/contracts.ts'
import { createSessionToken, hashPassword, hashSessionToken, verifyPassword } from './crypto.ts'
import { success, type AuthStorage, type StorageFailure, type StorageResult } from './storage.ts'
import { IpRateLimiter } from './rate-limit.ts'

export interface AppOptions {
  storage: AuthStorage
  sessionSecret: string
  allowedOrigins: string[]
  production?: boolean
  now?: () => Date
  rateLimits?: { login: number; signup: number; windowMs: number }
}

export const SESSION_COOKIE = 'mimikara_session'
const SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000

function respondError(response: Response, status: number, code: ApiErrorCode, message: string) {
  response.status(status).json({ error: { code, message } })
}

function storageError(response: Response, result: StorageFailure) {
  if (result.error === 'EMAIL_TAKEN') respondError(response, 409, 'EMAIL_TAKEN', 'An account with that email already exists.')
  else if (result.error === 'DATA_TOO_LARGE') respondError(response, 413, 'REQUEST_TOO_LARGE', 'Your saved study data exceeds the size limit.')
  else respondError(response, 503, 'DATABASE_UNAVAILABLE', 'Account storage is temporarily unavailable. Please try again.')
}

function cookieToken(request: Request) {
  const matching = (request.headers.cookie ?? '').split(';').map(value => value.trim())
    .filter(value => value.startsWith(`${SESSION_COOKIE}=`))
  if (matching.length !== 1) return null
  const token = matching[0]!.slice(SESSION_COOKIE.length + 1)
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null
}

export function createApp(options: AppOptions) {
  const app = express()
  app.disable('x-powered-by')
  const now = options.now ?? (() => new Date())
  const allowedOrigins = new Set(options.allowedOrigins)
  const rateLimits = options.rateLimits ?? { login: 30, signup: 10, windowMs: 15 * 60 * 1000 }
  const limiter = new IpRateLimiter()
  const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: !!options.production, path: '/' }
  const sessionUser = async (request: Request, response: Response): Promise<StorageResult<User | null>> => {
    const token = cookieToken(request)
    if (!token) return success(null)
    const tokenHash = hashSessionToken(token, options.sessionSecret)
    const result = await options.storage.findSession(tokenHash)
    if (!result.ok) return result
    if (!result.value) return success(null)
    if (result.value.expiresAt.getTime() <= now().getTime()) {
      await options.storage.deleteSession(tokenHash)
      response.clearCookie(SESSION_COOKIE, cookieOptions)
      return success(null)
    }
    return success(result.value.user)
  }
  const authenticatedUser = async (request: Request, response: Response) => {
    const result = await sessionUser(request, response)
    if (!result.ok) { storageError(response, result); return null }
    if (!result.value) { respondError(response, 401, 'AUTH_REQUIRED', 'Sign in to access your study data.'); return null }
    const expectedAccount = request.get('X-Study-Account')
    if (expectedAccount !== undefined && expectedAccount !== result.value.id) {
      respondError(response, 409, 'ACCOUNT_CHANGED', 'Your signed-in account changed. Reload your account before syncing.')
      return null
    }
    return result.value
  }
  app.use('/api', (request, response, next) => {
    response.set({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    })
    if (options.production) response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !allowedOrigins.has(request.headers.origin ?? '')) {
      respondError(response, 403, 'INVALID_ORIGIN', 'This request did not come from an allowed application origin.')
      return
    }
    next()
  })
  app.use('/api/auth', (request, response, next) => {
    const action = request.path === '/login' ? 'login' : request.path === '/signup' ? 'signup' : null
    if (request.method === 'POST' && action) {
      const ip = request.ip ?? request.socket.remoteAddress ?? 'unknown'
      const retry = limiter.take(`${action}:${ip}`, rateLimits[action], rateLimits.windowMs, now().getTime())
      if (retry !== null) {
        response.setHeader('Retry-After', retry)
        respondError(response, 429, 'RATE_LIMITED', 'Too many attempts. Please try again later.')
        return
      }
    }
    next()
  })
  app.use(express.json({ limit: '8mb' }))
  app.get('/api/auth/session', async (request, response) => {
    const result = await sessionUser(request, response)
    if (!result.ok) { storageError(response, result); return }
    response.json({ user: result.value })
  })
  app.post('/api/auth/signup', async (request, response) => {
    const parsed = SignupInputSchema.safeParse(request.body)
    if (!parsed.success) {
      respondError(response, 400, 'INVALID_INPUT', 'Enter a valid email, a name of 2–80 characters, and a password of 8–128 characters.')
      return
    }
    const { token, tokenHash } = createSessionToken(options.sessionSecret)
    const result = await options.storage.createAccount({ name: parsed.data.name, email: parsed.data.email, passwordHash: await hashPassword(parsed.data.password) }, {
      tokenHash, expiresAt: new Date(now().getTime() + SESSION_AGE_MS),
    })
    if (!result.ok) { storageError(response, result); return }
    response.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_AGE_MS })
    response.status(201).json({ user: result.value })
  })
  app.post('/api/auth/login', async (request, response) => {
    const parsed = LoginInputSchema.safeParse(request.body)
    if (!parsed.success) { respondError(response, 400, 'INVALID_INPUT', 'Enter a valid email and password.'); return }
    const found = await options.storage.findAccount(parsed.data.email)
    if (!found.ok) { storageError(response, found); return }
    const valid = await verifyPassword(parsed.data.password, found.value?.passwordHash ?? null)
    if (!valid || !found.value) {
      respondError(response, 401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
      return
    }
    const { token, tokenHash } = createSessionToken(options.sessionSecret)
    const stored = await options.storage.createSession(found.value.id, { tokenHash, expiresAt: new Date(now().getTime() + SESSION_AGE_MS) })
    if (!stored.ok) { storageError(response, stored); return }
    response.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_AGE_MS })
    response.json({ user: { id: found.value.id, email: found.value.email, name: found.value.name } })
  })
  app.post('/api/auth/logout', async (request, response) => {
    const token = cookieToken(request)
    if (token) {
      const result = await options.storage.deleteSession(hashSessionToken(token, options.sessionSecret))
      if (!result.ok) { storageError(response, result); return }
    }
    response.clearCookie(SESSION_COOKIE, cookieOptions)
    response.json({ user: null })
  })
  app.get('/api/user-data', async (request, response) => {
    const user = await authenticatedUser(request, response)
    if (!user) return
    const result = await options.storage.loadValues(user.id)
    if (!result.ok) { storageError(response, result); return }
    response.json({ values: result.value })
  })
  app.patch('/api/user-data', async (request, response) => {
    const user = await authenticatedUser(request, response)
    if (!user) return
    const parsed = UserDataInputSchema.safeParse(request.body)
    if (!parsed.success) { respondError(response, 400, 'INVALID_INPUT', 'Study data contains an invalid key, value, or size.'); return }
    const result = await options.storage.mergeValues(user.id, parsed.data.values)
    if (!result.ok) { storageError(response, result); return }
    response.json({ values: result.value })
  })
  app.get('/api/health', async (_request, response) => {
    const result = await options.storage.health()
    if (!result.ok) { storageError(response, result); return }
    response.json({ status: 'ok' })
  })
  app.use('/api', (_request, response) => respondError(response, 404, 'NOT_FOUND', 'API endpoint not found.'))
  app.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (response.headersSent) { next(error); return }
    const type = typeof error === 'object' && error !== null && 'type' in error ? error.type : null
    if (type === 'entity.too.large') respondError(response, 413, 'REQUEST_TOO_LARGE', 'The request is too large.')
    else if (type === 'entity.parse.failed') respondError(response, 400, 'INVALID_INPUT', 'Send a valid JSON request body.')
    else respondError(response, 500, 'INTERNAL_ERROR', 'The request could not be completed. Please try again.')
  })
  return app
}
