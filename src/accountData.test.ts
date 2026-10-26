// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { activateUserData, deactivateUserData, flushUserData, getActiveDataScope, getSyncStatus, readStudyValue, subscribeSyncStatus, writeStudyValue } from './accountData'

const language = 'mimikara-language'
const response = (values: Record<string, string | null> = {}, status = 200) => new Response(JSON.stringify({ values }), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => { deactivateUserData(); localStorage.clear() })
afterEach(() => { deactivateUserData(); vi.useRealTimers(); vi.unstubAllGlobals() })

test('imports guest exam attempts without losing account attempts or replacing an account result', async () => {
  const key = 'mimikara-exams-v1'
  const guest = { version: 1, attempts: { guest: { score: 3 }, shared: { score: 1 } } }
  const remote = { version: 1, attempts: { account: { score: 4 }, shared: { score: 2 } } }
  localStorage.setItem(key, JSON.stringify(guest))
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ [key]: JSON.stringify(remote) })))
  await activateUserData('alice', { importGuest: true })
  expect(JSON.parse(readStudyValue(key)!)).toEqual({
    version: 1, attempts: { guest: { score: 3 }, account: { score: 4 }, shared: { score: 2 } },
  })
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(guest)
})

test('isolates guest and account caches without automatically importing guest values', async () => {
  writeStudyValue(language, 'vi')
  const fetch = vi.fn().mockImplementation(async () => response())
  vi.stubGlobal('fetch', fetch)
  await activateUserData('alice')
  expect(getActiveDataScope()).toBe('alice')
  expect(readStudyValue(language)).toBeNull()
  writeStudyValue(language, 'en')
  expect(localStorage.getItem('mimikara-account:alice:mimikara-language')).toBe('en')
  await activateUserData('bob')
  expect(readStudyValue(language)).toBeNull()
  writeStudyValue(language, 'vi')
  expect(localStorage.getItem('mimikara-account:alice:mimikara-language')).toBe('en')
  deactivateUserData()
  expect(readStudyValue(language)).toBe('vi')
})

test('hydrates all remote values using the session cookie before exposing the account', async () => {
  writeStudyValue(language, 'vi')
  let finish!: (value: Response) => void
  const fetch = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve }))
  vi.stubGlobal('fetch', fetch)
  const activating = activateUserData('alice')
  expect(getActiveDataScope()).toBeNull()
  expect(readStudyValue(language)).toBe('vi')
  finish(response({ [language]: 'en', 'mimikara-novel-chapter-v1': '3' }))
  await activating
  expect(fetch).toHaveBeenCalledWith('/api/user-data', expect.objectContaining({ credentials: 'include' }))
  expect(readStudyValue(language)).toBe('en')
  expect(readStudyValue('mimikara-novel-chapter-v1')).toBe('3')
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('keeps the current scope and cache intact when loading another account fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ [language]: 'en' }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'database_unavailable', message: 'Account data could not be loaded.' } }), { status: 503 })))
  await activateUserData('alice')
  await expect(activateUserData('bob')).rejects.toThrow('Account data could not be loaded.')
  expect(getActiveDataScope()).toBe('alice')
  expect(readStudyValue(language)).toBe('en')
  expect(localStorage.getItem('mimikara-account:bob:mimikara-language')).toBeNull()
})

test('persists pending edits immediately and debounces cookie-authenticated patches', async () => {
  vi.useFakeTimers()
  const fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) =>
    init.method === 'PATCH' ? response(JSON.parse(init.body as string).values) : response({ [language]: 'en' }))
  vi.stubGlobal('fetch', fetch)
  await activateUserData('alice')
  writeStudyValue(language, 'en')
  await vi.advanceTimersByTimeAsync(400)
  expect(fetch).toHaveBeenCalledTimes(1)
  writeStudyValue(language, 'vi')
  writeStudyValue('mimikara-novel-chapter-v1', '3')
  expect(getSyncStatus()).toBe('saving')
  expect(JSON.parse(localStorage.getItem('mimikara-account:alice:pending-v1')!)).toEqual({ [language]: 'vi', 'mimikara-novel-chapter-v1': '3' })
  await vi.advanceTimersByTimeAsync(399)
  expect(fetch).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(1)
  expect(fetch).toHaveBeenLastCalledWith('/api/user-data', expect.objectContaining({ method: 'PATCH', credentials: 'include', headers: expect.objectContaining({ 'Content-Type': 'application/json' }), body: JSON.stringify({ values: { [language]: 'vi', 'mimikara-novel-chapter-v1': '3' } }) }))
  expect(getSyncStatus()).toBe('saved')
  expect(localStorage.getItem('mimikara-account:alice:pending-v1')).toBeNull()
})

test('restores unsent account changes after reactivation while merging remote study cells', async () => {
  vi.useFakeTimers()
  const progress = 'mimikara-progress-v1'
  const localCell = { solved: true, unresolved: false, hints: 0 }
  const remoteCell = { solved: false, unresolved: true, hints: 1 }
  const fetch = vi.fn().mockResolvedValueOnce(response({ [language]: 'en' }))
    .mockResolvedValueOnce(response({ [language]: 'en', [progress]: JSON.stringify({ remote: remoteCell, shared: remoteCell }) }))
    .mockImplementation(async (_url: string, init: RequestInit) => response(JSON.parse(init.body as string).values))
  vi.stubGlobal('fetch', fetch)
  await activateUserData('alice')
  writeStudyValue(language, 'vi')
  writeStudyValue(progress, JSON.stringify({ local: localCell, shared: localCell }))
  deactivateUserData()
  await activateUserData('alice')
  expect(readStudyValue(language)).toBe('vi')
  expect(JSON.parse(readStudyValue(progress)!)).toEqual({ remote: remoteCell, local: localCell, shared: localCell })
  expect(getSyncStatus()).toBe('saving')
  await flushUserData()
  expect(fetch).toHaveBeenLastCalledWith('/api/user-data', expect.objectContaining({ body: JSON.stringify({ values: { [language]: 'vi', [progress]: JSON.stringify({ remote: remoteCell, shared: localCell, local: localCell }) } }) }))
  expect(getSyncStatus()).toBe('saved')
})

test('rejects an older hydration response after a newer account has activated', async () => {
  let finishAlice!: (value: Response) => void
  const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>((resolve) => { finishAlice = resolve }))
    .mockResolvedValueOnce(response({ [language]: 'vi' }))
  vi.stubGlobal('fetch', fetch)
  const alice = activateUserData('alice')
  const superseded = expect(alice).rejects.toThrow('superseded')
  await activateUserData('bob')
  finishAlice(response({ [language]: 'en' }))
  await superseded
  expect(getActiveDataScope()).toBe('bob')
  expect(readStudyValue(language)).toBe('vi')
  expect(localStorage.getItem('mimikara-account:alice:mimikara-language')).toBeNull()
})

test('retains failed writes, rejects logout flushing, and retries when connectivity returns', async () => {
  vi.useFakeTimers()
  const fetch = vi.fn().mockResolvedValueOnce(response({ [language]: 'en' }))
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce(response({ [language]: 'vi' }))
  vi.stubGlobal('fetch', fetch)
  const statuses: string[] = []
  const unsubscribe = subscribeSyncStatus(() => statuses.push(getSyncStatus()))
  await activateUserData('alice')
  writeStudyValue(language, 'vi')
  await expect(flushUserData()).rejects.toThrow('Check your connection')
  expect(getSyncStatus()).toBe('error')
  expect(readStudyValue(language)).toBe('vi')
  expect(localStorage.getItem('mimikara-account:alice:pending-v1')).toContain('vi')
  window.dispatchEvent(new Event('online'))
  await vi.waitFor(() => expect(getSyncStatus()).toBe('saved'))
  expect(statuses).toEqual(['saved', 'saving', 'error', 'saving', 'saved'])
  expect(localStorage.getItem('mimikara-account:alice:pending-v1')).toBeNull()
  unsubscribe()
})

test('pins both hydration and queued writes to their expected authenticated account', async () => {
  const fetch = vi.fn().mockImplementation(async () => response())
  vi.stubGlobal('fetch', fetch)
  await activateUserData('alice')
  expect(fetch).toHaveBeenCalledWith('/api/user-data', expect.objectContaining({ headers: expect.objectContaining({ 'X-Study-Account': 'alice' }) }))
  writeStudyValue(language, 'vi')
  await flushUserData()
  expect(fetch).toHaveBeenLastCalledWith('/api/user-data', expect.objectContaining({ method: 'PATCH', headers: expect.objectContaining({ 'X-Study-Account': 'alice' }) }))
})

test.each(['mimikara-flashcards-v1', 'mimikara-word-flashcards-v1'] as const)('imports missing guest reviews for %s while preserving remote conflicts and preferences', async (flashcards) => {
  vi.useFakeTimers()
  const progress = 'mimikara-progress-v1'
  const guestCell = { solved: true, unresolved: false, hints: 0 }
  const remoteCell = { solved: false, unresolved: true, hints: 1 }
  const guestReview = { dueAt: 100, reviewedAt: 20, rating: 'ez', reviews: 2 }
  const remoteReview = { dueAt: 200, reviewedAt: 30, rating: 'hard', reviews: 3 }
  writeStudyValue(progress, JSON.stringify({ guest: guestCell, shared: guestCell }))
  writeStudyValue(flashcards, JSON.stringify({ guest: guestReview, shared: guestReview }))
  writeStudyValue(language, 'vi')
  writeStudyValue('mimikara-novel-chapter-v1', '4')
  const fetch = vi.fn().mockResolvedValueOnce(response({ [language]: 'en', [progress]: JSON.stringify({ shared: remoteCell }), [flashcards]: JSON.stringify({ shared: remoteReview }) }))
    .mockImplementation(async (_url: string, init: RequestInit) => response(JSON.parse(init.body as string).values))
  vi.stubGlobal('fetch', fetch)
  await activateUserData('alice', { importGuest: true })
  expect(JSON.parse(readStudyValue(progress)!)).toEqual({ guest: guestCell, shared: remoteCell })
  expect(JSON.parse(readStudyValue(flashcards)!)).toEqual({ guest: guestReview, shared: remoteReview })
  expect(readStudyValue(language)).toBe('en')
  expect(readStudyValue('mimikara-novel-chapter-v1')).toBe('4')
  await flushUserData()
  const sent = JSON.parse(fetch.mock.calls[1][1].body as string).values
  expect(sent).not.toHaveProperty(language)
  expect(JSON.parse(sent[progress])).toEqual({ guest: guestCell, shared: remoteCell })
  expect(localStorage.getItem(progress)).toContain('guest')
})

test('serializes patches and keeps a newer edit when an earlier response arrives', async () => {
  let finishFirstPatch!: (value: Response) => void
  const chapter = 'mimikara-novel-chapter-v1'
  const fetch = vi.fn().mockResolvedValueOnce(response({ [chapter]: '1' }))
    .mockImplementationOnce(() => new Promise<Response>((resolve) => { finishFirstPatch = resolve }))
    .mockResolvedValueOnce(response({ [chapter]: '3' }))
  vi.stubGlobal('fetch', fetch)
  await activateUserData('alice')
  writeStudyValue(chapter, '2')
  const first = flushUserData()
  writeStudyValue(chapter, '3')
  const second = flushUserData()
  expect(fetch).toHaveBeenCalledTimes(2)
  finishFirstPatch(response({ [chapter]: '2' }))
  await Promise.all([first, second])
  expect(fetch).toHaveBeenCalledTimes(3)
  expect(readStudyValue(chapter)).toBe('3')
  expect(JSON.parse(fetch.mock.calls[2][1].body as string)).toEqual({ values: { [chapter]: '3' } })
  expect(getSyncStatus()).toBe('saved')
})

test('keeps queue ownership and rejects an interrupted flush when switching accounts', async () => {
  let finishAlicePatch!: (value: Response) => void
  const fetch = vi.fn().mockResolvedValueOnce(response({ [language]: 'en' }))
    .mockImplementationOnce(() => new Promise<Response>((resolve) => { finishAlicePatch = resolve }))
    .mockResolvedValueOnce(response({ [language]: 'en' }))
  vi.stubGlobal('fetch', fetch)
  await activateUserData('alice')
  writeStudyValue(language, 'vi')
  const flushingAlice = flushUserData()
  const interrupted = expect(flushingAlice).rejects.toThrow('Account changed')
  await activateUserData('bob')
  writeStudyValue('mimikara-novel-chapter-v1', '5')
  finishAlicePatch(response({ [language]: 'vi' }))
  await interrupted
  expect(getActiveDataScope()).toBe('bob')
  expect(readStudyValue(language)).toBe('en')
  expect(getSyncStatus()).toBe('saving')
  expect(localStorage.getItem('mimikara-account:alice:pending-v1')).toContain('vi')
  expect(localStorage.getItem('mimikara-account:bob:pending-v1')).toContain('5')
})

test('preserves the active account when guest import exceeds browser storage capacity', async () => {
  writeStudyValue('mimikara-novel-chapter-v1', '9'.repeat(1_800_000))
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => response({ [language]: 'en' })))
  await activateUserData('alice')
  await expect(activateUserData('bob', { importGuest: true })).rejects.toThrow()
  expect(getActiveDataScope()).toBe('alice')
  expect(readStudyValue(language)).toBe('en')
  expect(getSyncStatus()).toBe('saved')
})

test('pauses the old account queue while the next account is being hydrated', async () => {
  vi.useFakeTimers()
  let finishBob!: (value: Response) => void
  const fetch = vi.fn().mockResolvedValueOnce(response({ [language]: 'en' }))
    .mockImplementationOnce(() => new Promise<Response>((resolve) => { finishBob = resolve }))
  vi.stubGlobal('fetch', fetch)
  await activateUserData('alice')
  writeStudyValue(language, 'vi')
  const activating = activateUserData('bob')
  window.dispatchEvent(new Event('online'))
  await vi.advanceTimersByTimeAsync(500)
  expect(fetch).toHaveBeenCalledTimes(2)
  finishBob(response({ [language]: 'en' }))
  await activating
  expect(readStudyValue(language)).toBe('en')
  expect(localStorage.getItem('mimikara-account:alice:pending-v1')).toContain('vi')
})

test('reports a browser quota failure and retains the edit for an explicit server flush', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ [language]: 'en' })).mockResolvedValueOnce(response({ [language]: 'vi' })))
  await activateUserData('alice')
  localStorage.setItem('capacity', 'x'.repeat(4_999_900))
  expect(() => writeStudyValue(language, 'vi')).toThrow()
  expect(getSyncStatus()).toBe('error')
  expect(readStudyValue(language)).toBe('vi')
  await flushUserData()
  expect(getSyncStatus()).toBe('saved')
})

test('preserves the current snapshot when refreshing that same account fails to store an import', async () => {
  writeStudyValue('mimikara-novel-chapter-v1', '9'.repeat(1_800_000))
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => response({ [language]: 'en' })))
  await activateUserData('alice')
  await expect(activateUserData('alice', { importGuest: true })).rejects.toThrow()
  expect(getActiveDataScope()).toBe('alice')
  expect(readStudyValue('mimikara-novel-chapter-v1')).toBeNull()
  expect(readStudyValue(language)).toBe('en')
})

test('aborts stalled hydration after ten seconds and keeps the previous scope', async () => {
  vi.useFakeTimers()
  const fetch = vi.fn().mockResolvedValueOnce(response({ [language]: 'en' }))
    .mockImplementationOnce((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('Request aborted', 'AbortError')))
    }))
  vi.stubGlobal('fetch', fetch)
  await activateUserData('alice')
  await vi.advanceTimersByTimeAsync(0)
  expect(vi.getTimerCount()).toBe(0)
  const activating = activateUserData('bob')
  const timedOut = expect(activating).rejects.toThrow('timed out')
  await vi.advanceTimersByTimeAsync(10_000)
  await timedOut
  expect(fetch.mock.calls[1][1].signal!.aborted).toBe(true)
  expect(getActiveDataScope()).toBe('alice')
  expect(readStudyValue(language)).toBe('en')
  expect(vi.getTimerCount()).toBe(0)
})

test('keeps pending edits when a patch response body stalls past the request deadline', async () => {
  vi.useFakeTimers()
  const fetch = vi.fn().mockResolvedValueOnce(response({ [language]: 'en' }))
    .mockImplementationOnce(async (_url: string, init: RequestInit) => ({
      ok: true,
      json: () => new Promise((_resolve, reject) => {
        init.signal!.addEventListener('abort', () => reject(new DOMException('Response aborted', 'AbortError')))
      }),
    } as Response))
  vi.stubGlobal('fetch', fetch)
  await activateUserData('alice')
  await vi.advanceTimersByTimeAsync(0)
  writeStudyValue(language, 'vi')
  const flushing = flushUserData()
  const timedOut = expect(flushing).rejects.toThrow('timed out')
  await vi.advanceTimersByTimeAsync(10_000)
  await timedOut
  expect(getActiveDataScope()).toBe('alice')
  expect(getSyncStatus()).toBe('error')
  expect(readStudyValue(language)).toBe('vi')
  expect(localStorage.getItem('mimikara-account:alice:pending-v1')).toContain('vi')
  expect(vi.getTimerCount()).toBe(0)
})
