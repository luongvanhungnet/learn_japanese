// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { LanguageProvider } from './i18n'
import { VocabularyFlashcardMode } from './VocabularyFlashcardMode'
import { parseWordProgress, reviewWord, selectWord, wordDeckKey, wordDecks, wordIntervals, wordProgressKey } from './vocabularyFlashcards'
import { StudyValuesSchema } from '../shared/contracts'

const mount = () => render(<LanguageProvider><VocabularyFlashcardMode onClose={() => {}} /></LanguageProvider>)
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); localStorage.clear() })

test('has all 880 N3 words and 214 radicals; reveals meaning, kana and Han Viet only on Up', () => {
  expect(wordDecks.N3).toHaveLength(880)
  expect(wordDecks.RADICALS).toHaveLength(214)
  mount()
  expect(screen.getByText('男性')).toBeTruthy()
  expect(screen.queryByText('だんせい')).toBeNull()
  fireEvent.keyDown(document, { key: 'ArrowUp' })
  expect(screen.getByText('だんせい')).toBeTruthy()
  expect(screen.getByText('NAM TÍNH')).toBeTruthy()
  expect(screen.getByText('man · male')).toBeTruthy()
  fireEvent.keyDown(document, { key: 'ArrowUp' })
  expect(screen.getByText('だんせい')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Tiếng Việt' }))
  expect(screen.getByText('đàn ông')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Bộ thủ Kanji' }))
  expect(screen.getByText('一')).toBeTruthy()
  expect(screen.queryByText('いち')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Hiện đáp án/ }))
  expect(screen.getByText('いち')).toBeTruthy()
  expect(screen.getByText('NHẤT')).toBeTruthy()
  expect(screen.getByText('một')).toBeTruthy()
})

test.each([['ArrowLeft', 'minutes'], ['ArrowRight', 'hours'], ['ArrowDown', 'week']] as const)('%s schedules the exact interval, advances and persists separately from sentence cards', (key, rating) => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-26T10:00:00Z'))
  localStorage.setItem('mimikara-flashcards-v1', '{"sentence":"untouched"}')
  const view = mount()
  fireEvent.keyDown(document, { key })
  const progress = parseWordProgress(localStorage.getItem(wordProgressKey))
  expect(progress['n3:1']).toEqual({ rating, dueAt: Date.now() + wordIntervals[rating], reviewedAt: Date.now(), reviews: 1 })
  expect(screen.getByText('女性')).toBeTruthy()
  expect(screen.queryByText('だんせい')).toBeNull()
  expect(localStorage.getItem('mimikara-flashcards-v1')).toBe('{"sentence":"untouched"}')
  view.unmount()
  mount()
  expect(screen.getByText('女性')).toBeTruthy()
})

test('ignores held keys, typing and dialogs; prevents arrow scrolling for valid shortcuts', () => {
  mount()
  fireEvent.keyDown(document, { key: 'ArrowRight', repeat: true })
  fireEvent.keyDown(document, { key: 'ArrowRight', ctrlKey: true })
  const input = document.createElement('input')
  document.body.append(input)
  fireEvent.keyDown(input, { key: 'ArrowRight' })
  input.remove()
  const dialog = document.createElement('div')
  dialog.setAttribute('role', 'dialog')
  document.body.append(dialog)
  fireEvent.keyDown(dialog, { key: 'ArrowRight' })
  dialog.remove()
  expect(screen.getByText('男性')).toBeTruthy()
  const arrow = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })
  fireEvent(document, arrow)
  expect(arrow.defaultPrevented).toBe(true)
  expect(screen.getByText('だんせい')).toBeTruthy()
})

test('prioritizes due reviews and wakes automatically when the deck is completed', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-26T10:00:00Z'))
  const progress = Object.fromEntries(wordDecks.N3.map(card => [card.id, reviewWord({}, card.id, 'week', Date.now())[card.id]]))
  progress['n3:1'] = reviewWord({}, 'n3:1', 'minutes', Date.now())['n3:1']
  localStorage.setItem(wordProgressKey, JSON.stringify(progress))
  mount()
  expect(screen.queryByText('男性')).toBeNull()
  act(() => vi.advanceTimersByTime(300_000))
  expect(screen.getByText('男性')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /5 hours/ }))
  expect(screen.queryByText('男性')).toBeNull()
  expect(parseWordProgress(localStorage.getItem(wordProgressKey))['n3:1'].reviews).toBe(2)
  expect(selectWord(wordDecks.N3, { ...progress, 'n3:2': { ...progress['n3:2'], dueAt: Date.now() - 1 } }, Date.now())).toBe('n3:2')
})

test('restores the radical deck and supports native fullscreen with a graceful fallback', async () => {
  localStorage.setItem(wordDeckKey, 'RADICALS')
  mount()
  expect(screen.getByText('一')).toBeTruthy()
  const request = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: request })
  try {
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }))
    await act(async () => {})
    expect(request).toHaveBeenCalledOnce()
    request.mockRejectedValueOnce(new Error('denied'))
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }))
    await act(async () => {})
    expect(screen.getByRole('alert').textContent).toContain('Full screen is unavailable')
  } finally { Reflect.deleteProperty(HTMLElement.prototype, 'requestFullscreen') }
})

test('rejects invalid saved progress and accepts the new keys for account sync', () => {
  expect(parseWordProgress('{"n3:1":{"rating":"week","dueAt":-1,"reviews":1,"reviewedAt":1}}')).toEqual({})
  expect(parseWordProgress('null')).toEqual({})
  expect(StudyValuesSchema.safeParse({ [wordProgressKey]: '{}', [wordDeckKey]: 'RADICALS' }).success).toBe(true)
})
