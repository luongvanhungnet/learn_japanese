import { expect, test } from 'vitest'
import { hintPrefix, isCorrect, nextHint, parseProgress, revealAnswer, submitAnswer } from './learning'

test('accepts one of several Vietnamese meanings', () => {
  expect(isCorrect('meaning', 'rủ', ['mời', 'rủ'])).toBe(true)
  expect(isCorrect('meaning', '  CUỘC   ĐỜI! ', ['cuộc đời'])).toBe(true)
  expect(isCorrect('meaning', 'cuoc doi', ['cuộc đời'])).toBe(false)
  expect(isCorrect('reading', 'ダンセイ', ['だんせい'])).toBe(true)
})

test('keeps a mistake unresolved after a correct answer in normal mode', () => {
  const wrong = submitAnswer({}, 'n3:1:reading', false, 'study')
  const right = submitAnswer(wrong, 'n3:1:reading', true, 'study')
  expect(right['n3:1:reading']).toMatchObject({ solved: true, unresolved: true })
})

test('clears a mistake only after a correct answer in review mode', () => {
  const wrong = submitAnswer({}, 'n3:1:reading', false, 'study')
  const shown = revealAnswer(wrong, 'n3:1:reading')
  expect(shown['n3:1:reading'].unresolved).toBe(true)
  const fixed = submitAnswer(shown, 'n3:1:reading', true, 'review', 'だんせい')
  expect(fixed['n3:1:reading']).toMatchObject({ solved: true, unresolved: false, revealed: false })
})

test('revealing an answer never marks it solved or as a mistake', () => {
  const result = revealAnswer({}, 'n2:1:reading')
  expect(result['n2:1:reading']).toMatchObject({ revealed: true, solved: false, unresolved: false })
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
