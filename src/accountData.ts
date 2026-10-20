import type { StudyKey, StudyValues } from '../shared/contracts'
import { STUDY_KEYS } from '../shared/contracts'

export type { StudyKey, StudyValues }
export type SyncStatus = 'saved' | 'saving' | 'error' | 'guest'
type AccountScope = { id: string; values: StudyValues; pending: StudyValues; inFlight: Promise<void> | null }
let active: AccountScope | null = null
let activationVersion = 0
let activationInFlight: number | null = null
let syncStatus: SyncStatus = 'guest'
let debounce: ReturnType<typeof setTimeout> | null = null
const subscribers = new Set<() => void>()
const cacheKey = (id: string, key: StudyKey) => `mimikara-account:${id}:${key}`
const pendingKey = (id: string) => `mimikara-account:${id}:pending-v1`

function setStatus(value: SyncStatus): void {
  if (syncStatus === value) return
  syncStatus = value
  subscribers.forEach((callback) => callback())
}

function cancelDebounce(): void {
  if (debounce !== null) clearTimeout(debounce)
  debounce = null
}

function persistPending(scope: AccountScope): void {
  if (Object.keys(scope.pending).length) window.localStorage.setItem(pendingKey(scope.id), JSON.stringify(scope.pending))
  else window.localStorage.removeItem(pendingKey(scope.id))
}

function readPending(id: string): StudyValues {
  const raw = window.localStorage.getItem(pendingKey(id))
  if (raw === null) return {}
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
    const pending: StudyValues = {}
    for (const [key, item] of Object.entries(value)) {
      if (!STUDY_KEYS.includes(key as StudyKey) || (typeof item !== 'string' && item !== null)) throw new Error()
      pending[key as StudyKey] = item
    }
    return pending
  } catch { throw new Error('Pending account changes could not be read. Keep this browser data and try again.') }
}

function mergeValue(key: StudyKey, remote: string | null | undefined, incoming: string | null | undefined, incomingWins: boolean): string | null {
  if (remote == null) return incoming ?? null
  if (incoming == null) return remote
  if (key === 'mimikara-exams-v1') {
    try {
      const base = JSON.parse(remote)
      const addition = JSON.parse(incoming)
      const isHistory = (value: unknown): value is { version: 1; attempts: Record<string, unknown> } => {
        if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('attempts' in value)) return false
        return value.attempts !== null && typeof value.attempts === 'object' && !Array.isArray(value.attempts)
      }
      if (!isHistory(base) || !isHistory(addition)) return incomingWins ? incoming : remote
      const attempts = incomingWins ? { ...base.attempts, ...addition.attempts } : { ...addition.attempts, ...base.attempts }
      return JSON.stringify({ version: 1, attempts })
    } catch { return incomingWins ? incoming : remote }
  }
  if (key !== 'mimikara-progress-v1' && key !== 'mimikara-flashcards-v1') return incomingWins ? incoming : remote
  try {
    const base: unknown = JSON.parse(remote)
    const addition: unknown = JSON.parse(incoming)
    if (!base || typeof base !== 'object' || Array.isArray(base) || !addition || typeof addition !== 'object' || Array.isArray(addition)) return incomingWins ? incoming : remote
    if (incomingWins) return JSON.stringify({ ...base, ...addition })
    const missing = Object.fromEntries(Object.entries(addition).filter(([key]) => !Object.hasOwn(base, key)))
    return Object.keys(missing).length ? JSON.stringify({ ...base, ...missing }) : remote
  } catch { return incomingWins ? incoming : remote }
}

function scheduleSync(): void {
  cancelDebounce()
  if (activationInFlight !== null) return
  debounce = setTimeout(() => {
    debounce = null
    void flushUserData().catch(() => { /* Keep pending changes for retry. */ })
  }, 400)
}

function retrySync(): void {
  if (activationInFlight !== null) return
  if (active && Object.keys(active.pending).length) void flushUserData().catch(() => { /* Retry on the next online or visible event. */ })
}

function retryWhenVisible(): void {
  if (document.visibilityState === 'visible') retrySync()
}

function attachRetryListeners(): void {
  window.addEventListener('online', retrySync)
  document.addEventListener('visibilitychange', retryWhenVisible)
}

function detachRetryListeners(): void {
  window.removeEventListener('online', retrySync)
  document.removeEventListener('visibilitychange', retryWhenVisible)
}

async function requestValues(userId: string, init: RequestInit = {}): Promise<StudyValues> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  const timeoutError = () => new Error('Account data request timed out. Check your connection and try again.')
  try {
    let result: Response
    try {
      result = await fetch('/api/user-data', { ...init, signal: controller.signal, credentials: 'include', headers: { ...init.headers, 'X-Study-Account': userId } })
    } catch {
      if (controller.signal.aborted) throw timeoutError()
      throw new Error('Account data could not be synchronized. Check your connection and try again.')
    }
    let body: unknown
    try { body = await result.json() } catch {
      if (controller.signal.aborted) throw timeoutError()
      throw new Error('The account data response was invalid. Please try again.')
    }
    if (!result.ok) {
      const error = body && typeof body === 'object' && 'error' in body ? body.error : null
      const message = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : 'Account data could not be synchronized. Please try again.'
      throw new Error(message)
    }
    const values = body && typeof body === 'object' && 'values' in body ? body.values : null
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('The account data response was invalid. Please try again.')
    const parsed: StudyValues = {}
    for (const [key, value] of Object.entries(values)) {
      if (!STUDY_KEYS.includes(key as StudyKey) || (typeof value !== 'string' && value !== null)) throw new Error('The account data response was invalid. Please try again.')
      parsed[key as StudyKey] = value
    }
    return parsed
  } finally {
    clearTimeout(timeout)
  }
}

export function readStudyValue(key: StudyKey): string | null {
  return active ? active.values[key] ?? null : window.localStorage.getItem(key)
}

export function writeStudyValue(key: StudyKey, value: string): void {
  if (readStudyValue(key) === value) return
  if (!active) { window.localStorage.setItem(key, value); return }
  active.values[key] = value
  active.pending[key] = value
  try {
    window.localStorage.setItem(cacheKey(active.id, key), value)
    persistPending(active)
  } catch {
    setStatus('error')
    scheduleSync()
    throw new Error('Study changes could not be stored in this browser. Free some browser storage and retry saving before leaving this account.')
  }
  setStatus('saving')
  scheduleSync()
}

export async function activateUserData(userId: string, options?: { importGuest?: boolean }): Promise<void> {
  const version = ++activationVersion
  activationInFlight = version
  cancelDebounce()
  try {
    const values = await requestValues(userId)
    if (version !== activationVersion) throw new Error('Account activation was superseded by another account change.')
    const pending = readPending(userId)
    for (const key of STUDY_KEYS) {
      if (!Object.hasOwn(pending, key)) continue
      pending[key] = mergeValue(key, values[key], pending[key], true)
      values[key] = pending[key]
    }
    if (options?.importGuest) {
      for (const key of STUDY_KEYS) {
        const guest = window.localStorage.getItem(key)
        if (guest === null) continue
        const merged = mergeValue(key, values[key], guest, false)
        if (merged === (values[key] ?? null)) continue
        values[key] = merged
        pending[key] = merged
      }
    }
    const scope: AccountScope = { id: userId, values, pending, inFlight: null }
    try {
      for (const key of STUDY_KEYS) {
        const value = values[key]
        if (value == null) window.localStorage.removeItem(cacheKey(userId, key))
        else window.localStorage.setItem(cacheKey(userId, key), value)
      }
      persistPending(scope)
    } catch { throw new Error('Account data could not be stored in this browser. Free some browser storage and try again.') }
    active = scope
    attachRetryListeners()
    setStatus(Object.keys(pending).length ? 'saving' : 'saved')
  } finally {
    if (activationInFlight === version) {
      activationInFlight = null
      if (active && Object.keys(active.pending).length) scheduleSync()
    }
  }
}

export function deactivateUserData(): void {
  activationVersion += 1
  activationInFlight = null
  cancelDebounce()
  detachRetryListeners()
  active = null
  setStatus('guest')
}

export async function flushUserData(): Promise<void> {
  cancelDebounce()
  if (activationInFlight !== null) throw new Error('Account data is still loading. Try saving after it finishes.')
  const scope = active
  if (!scope) return
  if (scope.inFlight) return scope.inFlight
  if (!Object.keys(scope.pending).length) return
  setStatus('saving')
  scope.inFlight = (async () => {
    try {
      while (active === scope && Object.keys(scope.pending).length) {
        if (activationInFlight !== null) throw new Error('Account data is still loading. Pending changes remain in this browser.')
        const sent = { ...scope.pending }
        await requestValues(scope.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: sent }) })
        if (active !== scope) throw new Error('Account changed before pending changes finished saving. They remain in this browser for that account.')
        for (const key of STUDY_KEYS) {
          if (!Object.hasOwn(sent, key) || scope.pending[key] !== sent[key]) continue
          const value = sent[key]
          if (value == null) window.localStorage.removeItem(cacheKey(scope.id, key))
          else window.localStorage.setItem(cacheKey(scope.id, key), value)
          delete scope.pending[key]
        }
        persistPending(scope)
      }
      if (active === scope) setStatus('saved')
    } catch (error) {
      if (active === scope) setStatus('error')
      throw error
    } finally {
      scope.inFlight = null
    }
  })()
  return scope.inFlight
}

export function getActiveDataScope(): string | null { return active?.id ?? null }
export function getSyncStatus(): SyncStatus { return syncStatus }

export function subscribeSyncStatus(callback: () => void): () => void {
  subscribers.add(callback)
  return () => { subscribers.delete(callback) }
}
