import { describe, expect, test } from 'vitest'
import { availableCards, earnRewards, gameCards, makeQuestion, normalizeKana, parseGameProgress, questionSeconds, shuffle } from './game'
const empty = () => parseGameProgress(null)
describe('game loop', () => {
  test('shuffles without mutating the deck and avoids consecutive repeated cards', () => {
    const deck = availableCards('ramen', empty())
    expect(shuffle(deck, () => 0)).not.toEqual(deck)
    expect(deck).toEqual(gameCards.slice(0, 4))
    for (let i = 0; i < 50; i++) {
      const question = makeQuestion(deck, i, true, 'vi', true, deck[0].id)
      expect(question.card.id).not.toBe(deck[0].id)
      expect(question.options).toContain(question.answer)
      expect(new Set(question.options).size).toBe(4)
    }
  })
  test('advanced mode covers all skills and skips listening when disabled', () => {
    const deck = availableCards('ramen', empty())
    expect([0, 1, 2, 3].map(i => makeQuestion(deck, i, true, 'en', true).skill)).toEqual(['meaning', 'listening', 'kana', 'context'])
    expect([0, 1, 2].map(i => makeQuestion(deck, i, true, 'en', false).skill)).toEqual(['meaning', 'kana', 'context'])
    expect(questionSeconds('challenge', 100)).toBe(2)
    expect(questionSeconds('challenge', 4)).toBe(8)
    expect(questionSeconds('gentle', 100)).toBe(10)
    expect(normalizeKana(' ミズ ')).toBe('みず')
  })
  test('rewards unlock only two scene cards, retain records and do not reward empty runs', () => {
    const first = earnRewards(empty(), 'ramen', 3, 360, 'ramen:gentle')
    expect(first.xp).toBe(36)
    expect(first.coins).toBe(9)
    expect(first.unlocked).toHaveLength(2)
    expect(availableCards('ramen', first.progress)).toHaveLength(6)
    expect(availableCards('directions', first.progress)).toHaveLength(4)
    const second = earnRewards(first.progress, 'ramen', 0, 0, 'ramen:gentle')
    expect(second.unlocked).toHaveLength(0)
    expect(second.progress).toEqual(first.progress)
    expect(parseGameProgress('{"xp":-2,"coins":1}')).toEqual(empty())
    expect(parseGameProgress('broken')).toEqual(empty())
  })
})
