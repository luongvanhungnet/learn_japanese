// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { AccountApp } from '../AccountApp'
import { deactivateUserData, readStudyValue } from '../accountData'

// Keep the actual account provider, persistence adapter, and study/flashcard
// views while avoiding thousands of unrelated vocabulary controls in this test.
vi.mock('../data/n3.json', () => ({ default: [
  { id: 'n3:1', level: 'N3', order: 1, headword: '男性', reading: 'だんせい', hanViet: 'NAM TÍNH', meanings: ['man'] },
] }))
vi.mock('../data/n2.json', () => ({ default: [
  { id: 'n2:1', level: 'N2', order: 1, headword: '男性', reading: 'だんせい', hanViet: 'NAM TÍNH', meanings: ['man'] },
] }))

afterEach(() => {
  cleanup()
  deactivateUserData()
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

test('persists an explicit flashcard deck choice after restoring the account', async () => {
  const user = { id: '28f11c8a-53f5-4bee-8bb8-4d6daf62ed18', email: 'learner@example.com', name: 'Learner' }
  const fetch = vi.fn(async (path: string, init: RequestInit = {}) => {
    if (path === '/api/auth/session') return response({ user })
    if (path === '/api/user-data' && init.method === 'PATCH') return response(JSON.parse(init.body as string))
    if (path === '/api/user-data') return response({ values: { 'mimikara-flashcard-deck-v1': 'N3' } })
    if (path === '/api/auth/logout') return response({ user: null })
    throw new Error(`Unexpected API call: ${path}`)
  })
  vi.stubGlobal('fetch', fetch)
  render(<AccountApp />)
  fireEvent.click(await screen.findByRole('button', { name: /^N2/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Flashcard' }))
  await screen.findByRole('heading', { name: 'Flashcard' })
  expect(screen.getByRole('button', { name: 'N2' }).getAttribute('aria-pressed')).toBe('true')
  expect(readStudyValue('mimikara-flashcard-deck-v1')).toBe('N2')
})
