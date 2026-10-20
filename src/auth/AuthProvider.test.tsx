// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthProvider'

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

const user = { id: 'user-1', email: 'learner@example.com', name: 'Learner' }
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
function Probe() {
  const auth = useAuth()
  return <><span>{auth?.initializing ? 'Restoring' : auth?.user?.name ?? 'Guest'}</span>
    <button onClick={() => { void auth?.login('learner@example.com', 'wrongpassword').catch(() => {}) }}>Log in</button>
    <button onClick={() => { void auth?.signup('Learner', 'learner@example.com', 'strongpassword', { importGuest: true }).catch(() => {}) }}>Sign up</button>
    <button onClick={() => { void auth?.logout().catch(() => {}) }}>Log out</button>
    {auth?.loading && <span>Working</span>}
    {auth?.error && <span role="alert">{auth.error.message}</span>}
  </>
}

test('restores the cookie session only after account progress is hydrated', async () => {
  const fetch = vi.fn().mockResolvedValue(response({ user }))
  vi.stubGlobal('fetch', fetch)
  let finishHydration!: () => void
  const onAuthenticate = vi.fn(() => new Promise<void>((resolve) => { finishHydration = resolve }))
  render(<AuthProvider onAuthenticate={onAuthenticate}><Probe /></AuthProvider>)
  await waitFor(() => expect(onAuthenticate).toHaveBeenCalledWith(user, { importGuest: false }))
  expect(screen.getByText('Restoring')).toBeTruthy()
  expect(fetch).toHaveBeenCalledWith('/api/auth/session', expect.objectContaining({ credentials: 'same-origin' }))
  finishHydration()
  expect(await screen.findByText('Learner')).toBeTruthy()
})

test('flushes account study before logout and switches back to guest after the server confirms', async () => {
  const order: string[] = []
  const fetch = vi.fn().mockResolvedValueOnce(response({ user })).mockImplementationOnce(() => { order.push('request'); return Promise.resolve(response({ user: null })) })
  vi.stubGlobal('fetch', fetch)
  const beforeLogout = vi.fn(async () => { order.push('flush') })
  const onSignOut = vi.fn(async () => { order.push('guest') })
  render(<AuthProvider beforeLogout={beforeLogout} onSignOut={onSignOut}><Probe /></AuthProvider>)
  await screen.findByText('Learner')
  fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
  expect(await screen.findByText('Guest')).toBeTruthy()
  expect(beforeLogout).toHaveBeenCalledWith(user)
  expect(fetch).toHaveBeenLastCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST', credentials: 'same-origin' }))
  expect(order).toEqual(['flush', 'request', 'guest'])
})

test('sign-up passes the explicit guest-copy choice to hydration and prevents duplicate requests', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response({ user: null })).mockResolvedValueOnce(response({ user }))
  vi.stubGlobal('fetch', fetch)
  let finishHydration!: () => void
  const onAuthenticate = vi.fn(() => new Promise<void>((resolve) => { finishHydration = resolve }))
  render(<AuthProvider onAuthenticate={onAuthenticate}><Probe /></AuthProvider>)
  await screen.findByText('Guest')
  fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
  fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
  await waitFor(() => expect(onAuthenticate).toHaveBeenCalledWith(user, { importGuest: true }))
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(fetch).toHaveBeenLastCalledWith('/api/auth/signup', expect.objectContaining({ body: JSON.stringify({ name: 'Learner', email: 'learner@example.com', password: 'strongpassword' }) }))
  expect(screen.getByText('Working')).toBeTruthy()
  expect(screen.getByText('Guest')).toBeTruthy()
  finishHydration()
  expect(await screen.findByText('Learner')).toBeTruthy()
})

test('reports bad credentials and posts credentials only to the cookie endpoint', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response({ user: null })).mockResolvedValueOnce(response({ error: { code: 'invalid_credentials', message: 'Email or password is incorrect.' } }, 401))
  vi.stubGlobal('fetch', fetch)
  render(<AuthProvider><Probe /></AuthProvider>)
  await screen.findByText('Guest')
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Email or password is incorrect.')
  expect(fetch).toHaveBeenLastCalledWith('/api/auth/login', expect.objectContaining({
    method: 'POST', credentials: 'same-origin', body: JSON.stringify({ email: 'learner@example.com', password: 'wrongpassword' }),
  }))
  expect(screen.getByText('Guest')).toBeTruthy()
})

test('retains a hydration failure and clears the newly established cookie before staying in guest mode', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response({ user: null })).mockResolvedValueOnce(response({ user })).mockResolvedValueOnce(response({ user: null }))
  vi.stubGlobal('fetch', fetch)
  const onAuthenticate = vi.fn(async () => { throw new Error('Your saved progress could not be loaded. Please try again.') })
  render(<AuthProvider onAuthenticate={onAuthenticate}><Probe /></AuthProvider>)
  await screen.findByText('Guest')
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Your saved progress could not be loaded. Please try again.')
  expect(fetch).toHaveBeenLastCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST', credentials: 'same-origin' }))
  expect(screen.getByText('Guest')).toBeTruthy()
})

test('settles into guest mode when the startup account service times out', async () => {
  vi.useFakeTimers()
  const fetch = vi.fn((_path: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
  }))
  vi.stubGlobal('fetch', fetch)
  render(<AuthProvider><Probe /></AuthProvider>)
  expect(screen.getByText('Restoring')).toBeTruthy()
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
  expect(screen.getByText('Guest')).toBeTruthy()
  expect(screen.getByRole('alert').textContent).toContain('account service is unavailable')
})

test('requires logout before another login can replace an active account', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response({ user }))
  vi.stubGlobal('fetch', fetch)
  render(<AuthProvider><Probe /></AuthProvider>)
  await screen.findByText('Learner')
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Log in' })) })
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(screen.getByText('Learner')).toBeTruthy()
})

test('keeps the account active if the logout response does not confirm a cleared session', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response({ user })).mockResolvedValueOnce(response({ user }))
  vi.stubGlobal('fetch', fetch)
  const onSignOut = vi.fn()
  render(<AuthProvider onSignOut={onSignOut}><Probe /></AuthProvider>)
  await screen.findByText('Learner')
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Log out' })) })
  expect(screen.getByText('Learner')).toBeTruthy()
  expect(onSignOut).not.toHaveBeenCalled()
})
