import { expect, test } from 'vitest'
import n3 from './data/n3.json'
import n2 from './data/n2.json'
import radicals from './data/radicals.json'
import grammar from './data/n3-grammar.json'
import { flashcardDecks, sentenceFlashcards } from './flashcardDecks'

test('N3 has a complete sentence card for each of the 880 vocabulary entries, plus the original lunch example', () => {
  const cards = sentenceFlashcards.filter((card) => card.deck === 'N3')
  expect(n3).toHaveLength(880)
  expect(cards).toHaveLength(881)
  for (const entry of n3) {
    const matches = cards.filter((card) => card.vocabularyId === entry.id)
    expect(matches, entry.id).toHaveLength(1)
    expect(matches[0].id).toBe(`flashcard:${entry.id}`)
    expect(matches[0].reading).toBeTruthy()
    expect(matches[0].romaji).toMatch(/^[A-Z]/)
  }
  expect(cards[0]).toMatchObject({ id: 'flashcard:n3:taberu', en: 'I ate lunch.' })
})

test('sentence decks have stable unique IDs, bilingual sentences, and valid source targets', () => {
  const sources = new Map([
    ...[...n3, ...n2, ...radicals].map((entry) => [entry.id, entry.headword] as const),
    ...grammar.map((entry) => [entry.id, entry.pattern] as const),
  ])
  expect(new Set(sentenceFlashcards.map((card) => card.id)).size).toBe(sentenceFlashcards.length)
  for (const deck of flashcardDecks) expect(sentenceFlashcards.some((card) => card.deck === deck)).toBe(true)
  for (const card of sentenceFlashcards) {
    expect(card.japanese).not.toBe(card.target)
    expect(card.japanese).toMatch(/[。！？?!]/u)
    expect(card.en.trim()).not.toBe('')
    expect(card.vi.trim()).not.toBe('')
    if (card.vocabularyId) expect(sources.get(card.vocabularyId)).toBe(card.sourceTarget ?? card.target)
    if (card.reading) expect(card.reading).toMatch(/^[ぁ-ゖー、。！？「」・\s]+$/u)
  }
  expect(sentenceFlashcards.filter((card) => card.deck === 'N3-GRAMMAR')).toHaveLength(grammar.reduce((count, entry) => count + entry.examples.length, 0))
})
