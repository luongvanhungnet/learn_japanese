import { expect, test } from 'vitest'
import { speedQuestions } from './speedExamData'
import { allSpeedTypes, questionType, selectSpeedQuestions, speedGroups } from './speedExamSelection'

test('groups N3 questions into four sections and fifteen task families', () => {
  expect(speedGroups.map(group => group.types.length)).toEqual([5, 3, 3, 4])
  expect(speedGroups.map(group => group.types.reduce((sum, type) => sum + type.count, 0))).toEqual([5, 5, 10, 10])
})

test('sorts and filters without changing the original bank; shuffle is stable for a round', () => {
  const original = speedQuestions.map(q => q.id)
  expect(selectSpeedQuestions(allSpeedTypes, 'reverse', 1).map(q => q.id)).toEqual([...original].reverse())
  const filtered = selectSpeedQuestions([questionType(speedQuestions[0]), questionType(speedQuestions[29])], 'type', 1)
  expect(filtered.map(q => q.id)).toEqual(['v1', 'l9', 'l10'])
  expect(selectSpeedQuestions([], 'random', 1)).toEqual([])
  const shuffled = selectSpeedQuestions(allSpeedTypes, 'random', 1).map(q => q.id)
  expect(shuffled).not.toEqual(original)
  expect([...shuffled].sort()).toEqual([...original].sort())
  expect(selectSpeedQuestions(allSpeedTypes, 'random', 1).map(q => q.id)).toEqual(shuffled)
  expect(selectSpeedQuestions(allSpeedTypes, 'random', 2).map(q => q.id)).not.toEqual(shuffled)
  expect(speedQuestions.map(q => q.id)).toEqual(original)
})
