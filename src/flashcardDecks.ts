import sentences from './data/flashcards.json'
import grammar from './data/n3-grammar.json'
import type { Flashcard, FlashcardDeck } from './flashcards'

export const flashcardDecks: FlashcardDeck[] = ['N3', 'N3-GRAMMAR', 'N2', 'RADICALS']
export const sentenceFlashcards: Flashcard[] = [
  ...sentences as Flashcard[],
  ...grammar.flatMap((entry) => entry.examples.map((example, index): Flashcard => ({
    id: `flashcard:${entry.id}:${index + 1}`,
    deck: 'N3-GRAMMAR',
    vocabularyId: entry.id,
    target: entry.pattern,
    japanese: example.japanese,
    en: example.en,
    vi: example.vi,
  }))),
]
