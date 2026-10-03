import { expect, test } from 'vitest'
import { clearReveal, hintPrefix, isCorrect, nextHint, parseProgress, revealAnswer, submitAnswer } from './learning'

test('restores grammar formation and language-specific meaning progress', () => {
  const cell = { solved: true, unresolved: false, revealed: false, hints: 0 }
  const saved = { 'n3-grammar:1:formation': cell, 'n3-grammar:1:meaning:vi': cell, 'n3:1:reading': cell }
  expect(Object.keys(parseProgress(JSON.stringify(saved)))).toEqual(Object.keys(saved))
})

test('formation grading accepts notation spacing but preserves Japanese voicing', () => {
  expect(isCorrect('formation', ' N - no ', ['Vru', 'N-no'])).toBe(true)
  expect(isCorrect('formation', 'Vだ', ['Vた'])).toBe(false)
})

test('formation accepts equivalent romanized and Japanese source notation', () => {
  expect(isCorrect('formation', 'Vる', ['Vru'])).toBe(true)
  expect(isCorrect('formation', 'Vて', ['V-Te'])).toBe(true)
  expect(isCorrect('formation', 'Vた', ['Vta'])).toBe(true)
  expect(isCorrect('formation', 'N + の', ['N-no'])).toBe(true)
  expect(isCorrect('formation', 'Vない', ['Vnai'])).toBe(true)
})

test('accepts one of several Vietnamese meanings', () => {
  expect(isCorrect('meaning', 'rủ', ['mời', 'rủ'])).toBe(true)
  expect(isCorrect('meaning', '  CUỘC   ĐỜI! ', ['cuộc đời'])).toBe(true)
  expect(isCorrect('meaning', 'cuoc doi', ['cuộc đời'])).toBe(true)
  expect(isCorrect('meaning', 'day la vi du', ['đây là ví dụ'])).toBe(true)
  expect(isCorrect('hanViet', 'han viet', ['HÁN VIỆT'])).toBe(true)
  expect(isCorrect('reading', 'だんせい', ['だんぜい'])).toBe(false)
  expect(isCorrect('reading', 'ダンセイ', ['だんせい'])).toBe(true)
})

test('keeps a mistake unresolved after a correct answer in normal mode', () => {
  const wrong = submitAnswer({}, 'n3:1:reading', false, 'study')
  const right = submitAnswer(wrong, 'n3:1:reading', true, 'study')
  expect(right['n3:1:reading']).toMatchObject({ solved: true, unresolved: true })
})

test('clears a mistake only after a correct answer in review mode', () => {
  const wrong = submitAnswer({}, 'n3:1:reading', false, 'study')
  const fixed = submitAnswer(wrong, 'n3:1:reading', true, 'review', 'だんせい')
  expect(fixed['n3:1:reading']).toMatchObject({ solved: true, unresolved: false, revealed: false })
})

test('revealing an answer adds a mistake without marking it solved', () => {
  const result = revealAnswer({}, 'n2:1:reading')
  expect(result['n2:1:reading']).toMatchObject({ revealed: true, solved: false, unresolved: true })
})

test.each(['hint', 'answer'])('an assisted review using %s stays a mistake until a later unaided correct attempt', (aid) => {
  const key = 'n3:1:reading'
  const helped = aid === 'hint' ? nextHint({}, key, 'だんせい') : revealAnswer({}, key)
  expect(helped[key].unresolved).toBe(true)
  // Expiring visible help and reloading must not erase assistance for this attempt.
  const expired = clearReveal({ ...helped, [key]: { ...helped[key], hints: 0 } }, key)
  const restored = parseProgress(JSON.stringify(expired))
  const assistedCorrect = submitAnswer(restored, key, true, 'review', 'だんせい')
  expect(assistedCorrect[key]).toMatchObject({ solved: true, unresolved: true, hints: 0 })
  const unaidedCorrect = submitAnswer(assistedCorrect, key, true, 'review', 'だんせい')
  expect(unaidedCorrect[key].unresolved).toBe(false)
})

test('Hint+ reveals one grapheme at a time without counting spaces', () => {
  const progress = nextHint({}, 'n3:1:hanViet', 'NAM TÍNH')
  expect(hintPrefix('NAM TÍNH', progress['n3:1:hanViet'].hints)).toBe('N')
})

test('loads saved progress and ignores malformed storage', () => {
  const saved = '{"n2:1:reading":{"solved":true,"unresolved":false,"revealed":false,"hints":0}}'
  expect(parseProgress(saved)['n2:1:reading'].solved).toBe(true)
  expect(parseProgress('{broken')).toEqual({})
})
