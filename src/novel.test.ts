import { expect, it } from 'vitest'
import { annotateText, lookupMeanings } from './novel'
import novel from './data/novel.json'
import vocabulary from './data/n3.json'
import supportingLexicon from './data/novel-lexicon.json'
import grammar from './data/n3-grammar.json'

it('provides bundled Vietnamese meanings for every supporting lookup entry', () => {
  expect(supportingLexicon.filter(entry => !entry.meaningsVi.length || entry.meaningsVi.some(meaning => !meaning.trim())).map(entry => entry.headword)).toEqual([])
  expect(supportingLexicon.find(entry => entry.headword === '仕事場')?.meaningsVi).toContain('nơi làm việc')
})

it('selects Vietnamese lookup meanings without ever falling back to English', () => {
  const entry = { id: 'story:missing', meanings: ['English definition'], meaningsVi: ['nghĩa tiếng Việt'] }
  expect(lookupMeanings(entry, 'vi')).toEqual(['nghĩa tiếng Việt'])
  expect(lookupMeanings({ ...entry, meaningsVi: [] }, 'vi')).toEqual(['Chưa có nghĩa tiếng Việt'])
  expect(lookupMeanings(entry, 'en')).toEqual(['English definition'])
  expect(lookupMeanings({ id: 'n3:1', meanings: ['man'] }, 'vi')).toEqual(['đàn ông'])
  expect(lookupMeanings({ id: 'n3:358', meanings: ['confidence'] }, 'vi')).toEqual(['bản thân'])
})

it('matches conjugated vocabulary and an explicitly contextual grammar span together', () => {
  const result = annotateText('男性は{{1|町にいるうちに}}働いた。')
  expect(result.find((part) => part.text === '男性')?.vocabularyIds).toContain('n3:1')
  expect(result.filter((part) => part.grammarId === 'n3-grammar:1').map((part) => part.text).join('')).toBe('町にいるうちに')
  expect(result.map((part) => part.text).join('')).toBe('男性は町にいるうちに働いた。')
})

it('also annotates everyday words outside the N3 target list', () => {
  const parts = annotateText('大学の図書館で、悠斗は待っていた。')
  expect(parts.find((part) => part.text === '大学')?.vocabularyIds[0]).toMatch(/^story:/)
})

it('keeps irregular-looking ichidan verbs and godan verbs linked to their correct lemmas', () => {
  const ids = annotateText('起きた。尋ねて、離れた。増えて、折った。めくった。煮た。炒めた。').flatMap((part) => part.vocabularyIds)
  expect(ids).toEqual(expect.arrayContaining(['n3:129', 'n3:131', 'n3:183', 'n3:431', 'n3:489', 'n3:462', 'n3:839', 'n3:840']))
})

it('covers every source vocabulary ID at least twice in the story prose', () => {
  const counts = new Map<string, number>()
  for (const chapter of novel.chapters) for (const paragraph of chapter.paragraphs) for (const part of annotateText(paragraph)) for (const id of part.vocabularyIds) counts.set(id, (counts.get(id) ?? 0) + 1)
  const missing = vocabulary.filter((word) => (counts.get(word.id) ?? 0) < 2).map((word) => `${word.order} ${word.headword}: ${counts.get(word.id) ?? 0}`)
  expect(missing).toEqual([])
})

it('bundles the requested novel length, all scheduled targets, valid grammar references and a complete supporting dictionary', () => {
  expect(novel.chapters).toHaveLength(20)
  expect(novel.characterCount).toBeGreaterThanOrEqual(40000)
  expect(novel.characterCount).toBeLessThanOrEqual(70000)
  expect(novel.chapters.flatMap((chapter) => chapter.targetIds)).toEqual(vocabulary.map((entry) => entry.id))
  const patterns = new Set(grammar.map((entry) => entry.id))
  for (const chapter of novel.chapters) {
    expect(chapter.targetIds).toHaveLength(44)
    for (const paragraph of chapter.paragraphs) for (const part of annotateText(paragraph)) if (part.grammarId) expect(patterns.has(part.grammarId)).toBe(true)
  }
  for (const entry of supportingLexicon) {
    expect(entry.meanings.length).toBeGreaterThan(0)
    expect(entry.reading).toMatch(/^[ぁ-ゖァ-ヺー・]+$/)
    expect(entry.forms).toContain(entry.headword)
  }
})
