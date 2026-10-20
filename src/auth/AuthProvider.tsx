import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AuthContext, AuthError } from './AuthContext'
import type { AuthenticateOptions, AuthProviderProps, AuthUser } from './AuthContext'
export { AuthError, useAuth } from './AuthContext'
export type { AuthenticateOptions, AuthContextValue, AuthProviderProps, AuthUser } from './AuthContext'

function asAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) return error
  if (error instanceof Error) return new AuthError('code' in error && typeof error.code === 'string' ? error.code : 'account_unavailable', error.message)
  return new AuthError('server_unavailable', 'The account service is unavailable. Please try again.')
}

async function requestAccount(path: string, signal: AbortSignal, body?: object): Promise<AuthUser | null> {
  try {
    const response = await fetch(`/api/auth/${path}`, {
      credentials: 'same-origin', signal,
      ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    })
    const data = await response.json() as { user: AuthUser | null; error?: { code: string; message: string } }
    if (!response.ok) {
      if (data.error?.code && data.error.message) throw new AuthError(data.error.code, data.error.message)
      throw new AuthError('server_unavailable', 'The account service is unavailable. Please try again.')
    }
    if (data.user !== null && (!data.user || typeof data.user.id !== 'string' || typeof data.user.email !== 'string' || typeof data.user.name !== 'string')) {
      throw new AuthError('server_unavailable', 'The account service is unavailable. Please try again.')
    }
    return data.user
  } catch (error) {
    if (error instanceof AuthError) throw error
    throw new AuthError('server_unavailable', 'The account service is unavailable. Please try again.')
  }
}

export function AuthProvider(props: AuthProviderProps) {
  const { children } = props
  const callbacks = useRef(props)
  useLayoutEffect(() => { callbacks.current = props }, [props])
  const [user, setUser] = useState<AuthUser | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<AuthError | null>(null)
  const currentState = useRef({ user, initializing })
  useLayoutEffect(() => { currentState.current = { user, initializing } }, [user, initializing])
  const busy = useRef(false)
  const hydrateAccount = useCallback(async (authenticated: AuthUser, options: AuthenticateOptions) => {
    try {
      await callbacks.current.onAuthenticate?.(authenticated, options)
    } catch (failure) {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 3_000)
      try { await requestAccount('logout', controller.signal, {}) } catch { /* Keep the original progress error. */ }
      finally { window.clearTimeout(timeout) }
      throw failure
    }
  }, [])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 10_000)
    void (async () => {
      try {
        const restored = await requestAccount('session', controller.signal)
        window.clearTimeout(timeout)
        if (!active) return
        if (restored) await hydrateAccount(restored, { importGuest: false })
        if (active) setUser(restored)
      } catch (failure) {
        if (active) setError(asAuthError(failure))
      } finally {
        window.clearTimeout(timeout)
        if (active) setInitializing(false)
      }
    })()
    return () => { active = false; controller.abort(); window.clearTimeout(timeout) }
  }, [hydrateAccount])

  const authenticate = useCallback(async (path: 'login' | 'signup', body: object, options: AuthenticateOptions): Promise<AuthUser> => {
    if (busy.current || currentState.current.initializing) throw new AuthError('request_pending', 'Please wait for the current request to finish.')
    if (currentState.current.user) throw new AuthError('account_active', 'Log out before using another account.')
    busy.current = true
    setLoading(true)
    setError(null)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 10_000)
    try {
      const authenticated = await requestAccount(path, controller.signal, body)
      window.clearTimeout(timeout)
      if (!authenticated) throw new AuthError('server_unavailable', 'The account service is unavailable. Please try again.')
      await hydrateAccount(authenticated, options)
      setUser(authenticated)
      return authenticated
    } catch (failure) {
      const authError = asAuthError(failure)
      setError(authError)
      throw authError
    } finally {
      window.clearTimeout(timeout)
      busy.current = false
      setLoading(false)
    }
  }, [hydrateAccount])
  const login = useCallback((email: string, password: string) => authenticate('login', { email, password }, { importGuest: false }), [authenticate])
  const signup = useCallback((name: string, email: string, password: string, options: AuthenticateOptions = {}) => authenticate('signup', { name, email, password }, options), [authenticate])
  const logout = useCallback(async (): Promise<void> => {
    if (!user) return
    if (busy.current) throw new AuthError('request_pending', 'Please wait for the current request to finish.')
    busy.current = true
    setLoading(true)
    setError(null)
    const controller = new AbortController()
    let timeout: number | undefined
    try {
      await callbacks.current.beforeLogout?.(user)
      timeout = window.setTimeout(() => controller.abort(), 10_000)
      const loggedOut = await requestAccount('logout', controller.signal, {})
      window.clearTimeout(timeout)
      if (loggedOut !== null) throw new AuthError('server_unavailable', 'Your session could not be closed. Please try logging out again.')
      await callbacks.current.onSignOut?.()
      setUser(null)
    } catch (failure) {
      const authError = asAuthError(failure)
      setError(authError)
      throw authError
    } finally {
      window.clearTimeout(timeout)
      busy.current = false
      setLoading(false)
    }
  }, [user])

  const clearError = useCallback(() => setError(null), [])
  return <AuthContext.Provider value={{ user, initializing, loading, error, login, signup, logout, clearError }}>{children}</AuthContext.Provider>
}

