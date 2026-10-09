export type FlashcardRating = 'instant' | 'hard' | 'medium' | 'ez'
export type FlashcardDeck = 'N3' | 'N2' | 'RADICALS' | 'N3-GRAMMAR'

export type Flashcard = {
  id: string
  deck: FlashcardDeck
  vocabularyId?: string
  target: string
  targetReading?: string
  sourceTarget?: string
  notes?: { en: string; vi: string }
  japanese: string
  reading?: string
  romaji?: string
  en: string
  vi: string
}

export type FlashcardReview = {
  dueAt: number
  reviewedAt: number
  rating: FlashcardRating
  reviews: number
}

export type FlashcardProgress = Record<string, FlashcardReview>

export const flashcardIntervals: Record<FlashcardRating, number> = {
  instant: 60_000,
  hard: 300_000,
  medium: 86_400_000,
  ez: 259_200_000,
}

export const flashcardStorageKey = 'mimikara-flashcards-v1'

const savedReview = (progress: FlashcardProgress, id: string): FlashcardReview | undefined =>
  Object.hasOwn(progress, id) ? progress[id] : undefined

export function rateFlashcard(progress: FlashcardProgress, id: string, rating: FlashcardRating, now: number): FlashcardProgress {
  return {
    ...progress,
    [id]: { dueAt: now + flashcardIntervals[rating], reviewedAt: now, rating, reviews: (savedReview(progress, id)?.reviews ?? 0) + 1 },
  }
}

export function parseFlashcardProgress(raw: string | null): FlashcardProgress {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: FlashcardProgress = {}
    for (const [id, value] of Object.entries(parsed)) {
      if (!id.trim() || id === '__proto__' || id === 'prototype' || id === 'constructor') continue
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue
      const review = value as Record<string, unknown>
      if (typeof review.dueAt !== 'number' || !Number.isFinite(review.dueAt) || review.dueAt < 0
        || typeof review.reviewedAt !== 'number' || !Number.isFinite(review.reviewedAt) || review.reviewedAt < 0
        || typeof review.rating !== 'string' || !Object.hasOwn(flashcardIntervals, review.rating)
        || typeof review.reviews !== 'number' || !Number.isSafeInteger(review.reviews) || review.reviews < 1) continue
      result[id] = { dueAt: review.dueAt, reviewedAt: review.reviewedAt, rating: review.rating as FlashcardRating, reviews: review.reviews }
    }
    return result
  } catch {
    return {}
  }
}

export function selectDueFlashcard(cards: Flashcard[], progress: FlashcardProgress, now: number): Flashcard | null {
  let due: Flashcard | null = null
  for (const card of cards) {
    const review = savedReview(progress, card.id)
    if (review && review.dueAt <= now && (!due || review.dueAt < progress[due.id].dueAt)) due = card
  }
  return due ?? cards.find((card) => !savedReview(progress, card.id)) ?? null
}

export function getNextFlashcardDueAt(cards: Flashcard[], progress: FlashcardProgress): number | null {
  let next: number | null = null
  for (const card of cards) {
    const review = savedReview(progress, card.id)
    if (review && (next === null || review.dueAt < next)) next = review.dueAt
  }
  return next
}
