// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { LanguageProvider } from './i18n'
import { FlashcardMode } from './FlashcardMode'
import { flashcardStorageKey, rateFlashcard } from './flashcards'
import { sentenceFlashcards } from './flashcardDecks'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  window.localStorage.clear()
})

const renderCards = () => render(<LanguageProvider><FlashcardMode initialDeck="N3" onClose={() => {}} /></LanguageProvider>)

test('Spacebar shows and hides the sentence answer and replaces G', () => {
  renderCards()
  expect(screen.getByText('私は昼ご飯を食べました。')).toBeTruthy()
  expect(screen.queryByText('I ate lunch.')).toBeNull()
  fireEvent.keyDown(document, { key: 'g' })
  expect(screen.queryByText('I ate lunch.')).toBeNull()
  const show = new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true })
  fireEvent(document, show)
  expect(show.defaultPrevented).toBe(true)
  expect(screen.getByText('I ate lunch.')).toBeTruthy()
  expect(screen.getByText('Watashi wa hirugohan o tabemashita.')).toBeTruthy()
  fireEvent.keyDown(document, { key: ' ', code: 'Space' })
  expect(screen.queryByText('I ate lunch.')).toBeNull()
})

test('Spacebar consumes held repeats and does not activate a focused rating button', () => {
  renderCards()
  fireEvent.keyDown(document, { key: ' ', code: 'Space' })
  const rating = screen.getByRole('button', { name: 'Medium · 1 day · D' })
  rating.focus()
  const repeat = new KeyboardEvent('keydown', { key: ' ', code: 'Space', repeat: true, bubbles: true, cancelable: true })
  fireEvent(rating, repeat)
  expect(repeat.defaultPrevented).toBe(true)
  expect(screen.getByText('I ate lunch.')).toBeTruthy()
  const hide = new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true })
  fireEvent(rating, hide)
  expect(hide.defaultPrevented).toBe(true)
  expect(screen.queryByText('I ate lunch.')).toBeNull()
  expect(window.localStorage.getItem(flashcardStorageKey)).toBe('{}')
})

test('rating requires a flip, schedules the card, advances, and survives reopening', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-07T12:00:00Z'))
  const now = Date.now()
  renderCards()
  const instant = screen.getByRole('button', { name: 'Instant · 1 min · A' }) as HTMLButtonElement
  expect(instant.disabled).toBe(true)
  fireEvent.keyDown(document, { key: 'a' })
  expect(window.localStorage.getItem(flashcardStorageKey)).toBe('{}')
  fireEvent.click(screen.getByRole('button', { name: 'Show answer' }))
  fireEvent.click(instant)
  const card = sentenceFlashcards.find((item) => item.deck === 'N3')!
  expect(JSON.parse(window.localStorage.getItem(flashcardStorageKey)!)[card.id]).toMatchObject({
    rating: 'instant', dueAt: now + 60_000, reviewedAt: now, reviews: 1,
  })
  expect(screen.queryByText(card.japanese)).toBeNull()
  expect((screen.getByRole('button', { name: 'Instant · 1 min · A' }) as HTMLButtonElement).disabled).toBe(true)
  cleanup()
  renderCards()
  expect(screen.queryByText(card.japanese)).toBeNull()
  expect(document.querySelector('.flashcard-japanese')?.textContent).toBe(sentenceFlashcards.filter((item) => item.deck === 'N3')[1].japanese)
})

test('waits for scheduled cards and restores a due sentence at the exact review time', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-07T12:00:00Z'))
  const cards = sentenceFlashcards.filter((item) => item.deck === 'N3')
  const progress = cards.reduce((saved, card) => rateFlashcard(saved, card.id, 'instant', Date.now()), {})
  window.localStorage.setItem(flashcardStorageKey, JSON.stringify(progress))
  renderCards()
  expect(screen.getByRole('heading', { name: 'All caught up' })).toBeTruthy()
  expect(screen.getByText(/Next review:/)).toBeTruthy()
  act(() => { vi.advanceTimersByTime(59_999) })
  expect(document.querySelector('.flashcard-japanese')).toBeNull()
  act(() => { vi.advanceTimersByTime(1) })
  expect(screen.getByText(cards[0].japanese)).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'All caught up' })).toBeNull()
  expect(screen.queryByText(cards[0].en)).toBeNull()
})

test('switches sentence decks, hides the answer, and shares scheduling between languages', () => {
  renderCards()
  fireEvent.keyDown(document, { key: ' ' })
  fireEvent.keyDown(document, { key: 'd' })
  const saved = window.localStorage.getItem(flashcardStorageKey)
  fireEvent.keyDown(document, { key: ' ' })
  fireEvent.click(screen.getByRole('button', { name: 'N2' }))
  const n2 = sentenceFlashcards.find((item) => item.deck === 'N2')!
  expect(screen.getByText(n2.japanese)).toBeTruthy()
  expect(screen.queryByText(n2.en)).toBeNull()
  fireEvent.keyDown(document, { key: ' ' })
  fireEvent.click(screen.getByRole('button', { name: 'Tiếng Việt' }))
  expect(screen.getByText(n2.vi)).toBeTruthy()
  expect(screen.queryByText(n2.en)).toBeNull()
  expect(window.localStorage.getItem(flashcardStorageKey)).toBe(saved)
  fireEvent.click(screen.getByRole('button', { name: 'Ngữ pháp N3' }))
  const grammar = sentenceFlashcards.find((item) => item.deck === 'N3-GRAMMAR')!
  expect(screen.getByText(grammar.japanese)).toBeTruthy()
  expect(screen.queryByText(grammar.vi)).toBeNull()
  fireEvent.keyDown(document, { key: ' ' })
  expect(screen.getByText(grammar.vi)).toBeTruthy()
})

test.each([{ repeat: true }, { altKey: true }, { ctrlKey: true }, { metaKey: true }, { isComposing: true }])('ignores held or modified shortcuts (%j)', (flags) => {
  renderCards()
  fireEvent.keyDown(document, { key: ' ', ...flags })
  expect(screen.queryByText('I ate lunch.')).toBeNull()
  fireEvent.keyDown(document, { key: ' ' })
  fireEvent.keyDown(document, { key: 'a', ...flags })
  expect(screen.getByText('I ate lunch.')).toBeTruthy()
  expect(window.localStorage.getItem(flashcardStorageKey)).toBe('{}')
})

test('does not flip or rate while typing into an editable field', () => {
  render(<LanguageProvider><FlashcardMode initialDeck="N3" onClose={() => {}} /><input aria-label="Draft" /><div contentEditable><span>Editable text</span></div></LanguageProvider>)
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Draft' }), { key: ' ' })
  fireEvent.keyDown(screen.getByText('Editable text'), { key: ' ' })
  expect(screen.queryByText('I ate lunch.')).toBeNull()
  fireEvent.keyDown(document, { key: ' ' })
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Draft' }), { key: 'a' })
  expect(screen.getByText('I ate lunch.')).toBeTruthy()
  expect(window.localStorage.getItem(flashcardStorageKey)).toBe('{}')
})

test('restores the selected deck on reload while an explicit starting deck takes priority', () => {
  renderCards()
  fireEvent.click(screen.getByRole('button', { name: 'N2' }))
  cleanup()
  render(<LanguageProvider><FlashcardMode onClose={() => {}} /></LanguageProvider>)
  const n2 = sentenceFlashcards.find((item) => item.deck === 'N2')!
  expect(screen.getByText(n2.japanese)).toBeTruthy()
  cleanup()
  renderCards()
  expect(screen.getByText('私は昼ご飯を食べました。')).toBeTruthy()
})

test.each([
  ['a', 'instant', 60_000], ['s', 'hard', 300_000],
  ['d', 'medium', 86_400_000], ['f', 'ez', 259_200_000],
])('%s rates the revealed sentence as %s', (key, rating, interval) => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-07T12:00:00Z'))
  const now = Date.now()
  renderCards()
  fireEvent.keyDown(document, { key: ' ' })
  fireEvent.keyDown(document, { key })
  const first = sentenceFlashcards.find((item) => item.deck === 'N3')!
  expect(JSON.parse(window.localStorage.getItem(flashcardStorageKey)!)[first.id]).toMatchObject({ rating, dueAt: now + Number(interval) })
  expect(screen.queryByText(first.japanese)).toBeNull()
})

test('keeps the open sentence stable when another card becomes due and reviews that card next', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-07T12:00:00Z'))
  const cards = sentenceFlashcards.filter((item) => item.deck === 'N3')
  window.localStorage.setItem(flashcardStorageKey, JSON.stringify(rateFlashcard({}, cards[0].id, 'instant', Date.now())))
  renderCards()
  fireEvent.keyDown(document, { key: ' ' })
  act(() => { vi.advanceTimersByTime(60_000); window.dispatchEvent(new Event('focus')) })
  expect(screen.getByText(cards[1].japanese)).toBeTruthy()
  expect(screen.getByText(cards[1].en)).toBeTruthy()
  fireEvent.keyDown(document, { key: 'd' })
  expect(screen.getByText(cards[0].japanese)).toBeTruthy()
  expect(screen.queryByText(cards[0].en)).toBeNull()
})
