import { expect, test } from 'vitest'
import { flashcardIntervals, flashcardStorageKey, getNextFlashcardDueAt, parseFlashcardProgress, rateFlashcard, selectDueFlashcard } from './flashcards'
import type { Flashcard } from './flashcards'

const card = (id: string): Flashcard => ({
  id, deck: 'N3', target: '食べる', japanese: '私は昼ご飯を食べました。',
  en: 'I ate lunch.', vi: 'Tôi đã ăn trưa.',
})

test('uses the four requested fixed review intervals', () => {
  expect(flashcardIntervals).toEqual({
    instant: 60_000,
    hard: 300_000,
    medium: 86_400_000,
    ez: 259_200_000,
  })
})

test('rating a new card schedules from now with one review for every interval', () => {
  const now = 1_000_000
  for (const rating of ['instant', 'hard', 'medium', 'ez'] as const) {
    expect(rateFlashcard({}, 'sentence:taberu', rating, now)).toEqual({
      'sentence:taberu': { dueAt: now + flashcardIntervals[rating], reviewedAt: now, rating, reviews: 1 },
    })
  }
})

test('repeated ratings increment the review count without mutating saved progress', () => {
  const progress = rateFlashcard({}, 'sentence:taberu', 'instant', 1_000)
  const original = structuredClone(progress)
  const result = rateFlashcard(progress, 'sentence:taberu', 'medium', 61_000)
  expect(result['sentence:taberu']).toEqual({ dueAt: 86_461_000, reviewedAt: 61_000, rating: 'medium', reviews: 2 })
  expect(progress).toEqual(original)
  expect(result).not.toBe(progress)
})

test('restores a JSON storage round trip under the flashcard storage key', () => {
  expect(flashcardStorageKey).toBe('mimikara-flashcards-v1')
  const progress = rateFlashcard(rateFlashcard({}, 'sentence:taberu', 'hard', 123_000), 'sentence:taberu', 'ez', 423_000)
  expect(parseFlashcardProgress(JSON.stringify(progress))).toEqual(progress)
})

test('ignores missing storage, invalid JSON, and non-object storage roots', () => {
  for (const raw of [null, '', '{broken', 'null', '[]', '42', '"text"', 'true']) {
    expect(parseFlashcardProgress(raw)).toEqual({})
  }
})

test('keeps valid reviews and discards malformed review fields', () => {
  const valid = { dueAt: 60_000, reviewedAt: 0, rating: 'instant', reviews: 1 }
  const malformed = {
    valid,
    missing: {},
    null: null,
    array: [],
    text: 'review',
    invalidRating: { ...valid, rating: 'easy' },
    invalidDue: { ...valid, dueAt: '60000' },
    invalidReviewed: { ...valid, reviewedAt: -1 },
    nonfiniteDue: { ...valid, dueAt: null },
    nonfiniteReviewed: { ...valid, reviewedAt: null },
    zeroReviews: { ...valid, reviews: 0 },
    fractionalReviews: { ...valid, reviews: 1.5 },
    stringReviews: { ...valid, reviews: '1' },
  }
  expect(parseFlashcardProgress(JSON.stringify(malformed))).toEqual({ valid })
  expect(parseFlashcardProgress('{"nonfinite":{"dueAt":1e309,"reviewedAt":0,"rating":"instant","reviews":1}}')).toEqual({})
})

test('rejects unsafe card keys and strips unexpected persisted properties', () => {
  const review = '{"dueAt":60000,"reviewedAt":0,"rating":"instant","reviews":1}'
  const parsed = parseFlashcardProgress(`{"__proto__":${review},"constructor":${review},"prototype":${review},"":${review},"n3:1":${review.slice(0, -1)},"extra":true}}`)
  expect(Object.keys(parsed)).toEqual(['n3:1'])
  expect(parsed['n3:1']).toEqual({ dueAt: 60_000, reviewedAt: 0, rating: 'instant', reviews: 1 })
  expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype)
})

test('selects unseen cards in deck order and handles an empty deck', () => {
  const cards = [card('second'), card('first')]
  expect(selectDueFlashcard(cards, {}, 10_000)).toBe(cards[0])
  expect(selectDueFlashcard([], {}, 10_000)).toBeNull()
})

test('prioritizes due reviews over unseen cards and orders reviews by oldest due', () => {
  const cards = [card('unseen'), card('recent'), card('oldest'), card('future')]
  const progress = {
    ...rateFlashcard({}, 'recent', 'instant', 2_000),
    ...rateFlashcard({}, 'oldest', 'instant', 1_000),
    ...rateFlashcard({}, 'future', 'instant', 100_000),
  }
  const original = cards.slice()
  expect(selectDueFlashcard(cards, progress, 62_000)).toBe(cards[2])
  expect(selectDueFlashcard(cards, rateFlashcard(progress, 'oldest', 'hard', 62_000), 62_000)).toBe(cards[1])
  expect(cards).toEqual(original)
})

test('excludes future reviews and makes cards eligible exactly at their due time', () => {
  const cards = [card('reviewed'), card('unseen')]
  const progress = rateFlashcard({}, 'reviewed', 'instant', 1_000)
  expect(selectDueFlashcard(cards, progress, 60_999)).toBe(cards[1])
  expect(selectDueFlashcard([cards[0]], progress, 60_999)).toBeNull()
  expect(selectDueFlashcard(cards, progress, 61_000)).toBe(cards[0])
})

test('finds the earliest review time only for cards in the active deck', () => {
  const cards = [card('late'), card('unseen'), card('early')]
  const progress = {
    ...rateFlashcard({}, 'late', 'medium', 10_000),
    ...rateFlashcard({}, 'early', 'hard', 10_000),
    ...rateFlashcard({}, 'other-deck', 'instant', 10_000),
  }
  expect(getNextFlashcardDueAt(cards, progress)).toBe(310_000)
  expect(getNextFlashcardDueAt([cards[1]], progress)).toBeNull()
  expect(getNextFlashcardDueAt([], progress)).toBeNull()
})

test('treats ordinary Object prototype property names as unseen without saved reviews', () => {
  const cards = [card('toString'), card('valueOf')]
  expect(selectDueFlashcard(cards, {}, 0)).toBe(cards[0])
  expect(getNextFlashcardDueAt(cards, {})).toBeNull()
})
