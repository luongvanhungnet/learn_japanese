import { expect, test } from 'vitest'
import { buildSearchIndex, normalizeSearch, searchVocabulary, vocabularySearchIndex } from './vocabularySearch'

test('normalizes Vietnamese accents and kana width without losing Japanese voicing', () => {
  expect(normalizeSearch('  ĐÀN ÔNG  ')).toBe('dan ong')
  expect(normalizeSearch('ﾀﾞﾝｾｲ')).toBe(normalizeSearch('だんせい'))
  expect(normalizeSearch('ば')).not.toBe(normalizeSearch('は'))
})
test('searches every collection by Japanese, readings, translations and aliases', () => {
  expect(searchVocabulary(vocabularySearchIndex, 'dan ong').some(e => e.source === 'N3' && e.headword === '男性')).toBe(true)
  expect(searchVocabulary(vocabularySearchIndex, 'ダンセイ').some(e => e.headword === '男性')).toBe(true)
  expect(searchVocabulary(vocabularySearchIndex, 'nam tinh').some(e => e.headword === '男性')).toBe(true)
  for (const source of ['N3', 'N2', 'RADICALS', 'N3-GRAMMAR', 'STORY', 'GAME']) {
    const sample = vocabularySearchIndex.find(i => i.entry.source === source)!.entry
    expect(searchVocabulary(vocabularySearchIndex, sample.headword).some(e => e.id === sample.id)).toBe(true)
  }
})
test('ranks exact matches first, requires every query token and handles empty or absent terms', () => {
  const index = buildSearchIndex([
    { id: '1', source: 'N3', headword: 'お水', reading: 'おみず', hanViet: null, en: ['cold water'], vi: [] },
    { id: '2', source: 'GAME', headword: '水', reading: 'みず', hanViet: null, en: ['water'], vi: [] },
  ])
  expect(searchVocabulary(index, 'water').map(e => e.id)).toEqual(['2', '1'])
  expect(searchVocabulary(index, 'cold water').map(e => e.id)).toEqual(['1'])
  expect(searchVocabulary(index, 'missing')).toEqual([])
  expect(searchVocabulary(index, '  ')).toEqual([])
})
