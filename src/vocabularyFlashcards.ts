import n3 from './data/n3.json'
import radicals from './data/radicals.json'
import vietnamese from './data/vi.json'

export type WordDeck = 'N3' | 'RADICALS'
export type WordRating = 'minutes' | 'hours' | 'week'
export type WordReview = { dueAt: number; reviewedAt: number; rating: WordRating; reviews: number }
export type WordProgress = Record<string, WordReview>
export const wordProgressKey = 'mimikara-word-flashcards-v1'
export const wordDeckKey = 'mimikara-word-flashcard-deck-v1'
export const wordIntervals = { minutes: 5 * 60_000, hours: 5 * 60 * 60_000, week: 7 * 24 * 60 * 60_000 }
export const wordDecks = {
  N3: n3.map(entry => ({ ...entry, meaningsVi: (vietnamese.N3 as Record<string, string[]>)[entry.id] ?? entry.meanings })),
  RADICALS: radicals,
}

export function parseWordProgress(raw: string | null): WordProgress {
  try {
    const value: unknown = JSON.parse(raw ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter(([id, review]) =>
      /^(n3|radicals):\d+$/.test(id) && review && typeof review === 'object'
      && Number.isFinite(review.dueAt) && review.dueAt >= 0
      && Number.isFinite(review.reviewedAt) && review.reviewedAt >= 0
      && Object.hasOwn(wordIntervals, review.rating)
      && Number.isSafeInteger(review.reviews) && review.reviews > 0,
    ))
  } catch { return {} }
}

export function selectWord(cards: { id: string }[], progress: WordProgress, now: number): string | null {
  let due: string | null = null
  for (const { id } of cards) {
    if (progress[id]?.dueAt <= now && (due === null || progress[id].dueAt < progress[due].dueAt)) due = id
  }
  return due ?? cards.find(({ id }) => !progress[id])?.id ?? null
}

export function reviewWord(progress: WordProgress, id: string, rating: WordRating, now: number): WordProgress {
  return { ...progress, [id]: { dueAt: now + wordIntervals[rating], reviewedAt: now, rating, reviews: (progress[id]?.reviews ?? 0) + 1 } }
}
