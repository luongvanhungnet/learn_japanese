import { describe, expect, it } from 'vitest'
import n2 from './data/n2.json'
import n3 from './data/n3.json'
import radicals from './data/radicals.json'
import vietnameseMeanings from './data/vi.json'
import grammar from './data/n3-grammar.json'

it('contains all 111 source grammar entries with bilingual examples and stable IDs', () => {
  expect(grammar).toHaveLength(111)
  for (const [index, entry] of grammar.entries()) {
    expect(entry.id).toBe(`n3-grammar:${index + 1}`)
    expect(entry.order).toBe(index + 1)
    expect(entry.sourcePage).toBeGreaterThanOrEqual(4)
    expect(entry.sourcePage).toBeLessThanOrEqual(31)
    expect(entry.pattern.trim()).not.toBe('')
    expect(entry.meanings.en.length).toBeGreaterThan(0)
    expect(entry.meanings.vi.length).toBeGreaterThan(0)
    expect(entry.examples.length).toBeGreaterThan(0)
    for (const example of entry.examples) {
      expect(example.japanese.trim()).not.toBe('')
      expect(example.en.trim()).not.toBe('')
      expect(example.vi.trim()).not.toBe('')
    }
  }
})

it('contains all 214 Kangxi radicals in order with bilingual practice and variant metadata', () => {
  expect(radicals).toHaveLength(214)
  expect(radicals.map((entry) => entry.order)).toEqual(Array.from({ length: 214 }, (_, index) => index + 1))
  expect(new Set(radicals.map((entry) => entry.headword)).size).toBe(214)
  for (const entry of radicals) {
    expect(entry.id).toBe(`radicals:${entry.order}`)
    expect(entry.level).toBe('RADICALS')
    expect(entry.reading).toMatch(/^[ぁ-ゖー・]+$/)
    expect(entry.readings).toContain(entry.reading)
    expect(entry.hanViet.trim()).not.toBe('')
    expect(entry.meanings.length).toBeGreaterThan(0)
    expect(entry.meaningsVi.length).toBeGreaterThan(0)
    expect([...entry.meanings, ...entry.meaningsVi].every((value) => value.trim())).toBe(true)
    expect(entry.strokes).toBeGreaterThanOrEqual(1)
    expect(entry.strokes).toBeLessThanOrEqual(17)
  }
  expect(radicals[8]).toMatchObject({ headword: '人', variants: ['亻'], meaningsVi: ['người'] })
  expect(radicals[162].variants).toEqual(['阝 (phải)'])
  expect(radicals[169].variants).toEqual(['阝 (trái)'])
  expect(radicals[213]).toMatchObject({ headword: '龠', strokes: 17, meaningsVi: ['sáo'] })
})

it('uses English meanings while preserving Sino-Vietnamese readings', () => {
  expect(n3[0].meanings).toContain('man')
  expect(n3[0].hanViet).toBe('NAM TÍNH')
  expect(n2[0].meanings).toContain('life')
  expect(n2[0].hanViet).toBe('NHÂN SANH')
  for (const entry of [...n3, ...n2]) {
    expect(entry.meanings.join(' ')).not.toMatch(/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i)
  }
})

for (const [level, entries, count] of [
  ['N3', n3, 880],
  ['N2', n2, 1160],
] as const) {
  describe(`${level} vocabulary`, () => {
    it('has every number once with complete practice data', () => {
      expect(entries).toHaveLength(count)
      expect(entries.map((entry) => entry.order)).toEqual(Array.from({ length: count }, (_, index) => index + 1))
      expect(new Set(entries.map((entry) => entry.id)).size).toBe(count)
      const translations = vietnameseMeanings[level] as Record<string, string[]>
      expect(Object.keys(translations).sort()).toEqual(entries.map((entry) => entry.id).sort())
      for (const entry of entries) {
        expect(entry.id).toBe(`${level.toLowerCase()}:${entry.order}`)
        expect(entry.level).toBe(level)
        expect(entry.headword.trim()).not.toBe('')
        expect(entry.reading.trim()).not.toBe('')
        expect(entry.reading).not.toMatch(/[\u4e00-\u9fff]/)
        expect(entry.meanings.length).toBeGreaterThan(0)
        expect(entry.meanings.every((meaning) => meaning.trim())).toBe(true)
        expect(translations[entry.id].length).toBeGreaterThan(0)
        expect(translations[entry.id].every((meaning) => meaning.trim())).toBe(true)
        expect(entry.hanViet !== null).toBe(/[\u4e00-\u9fff]/.test(entry.headword))
      }
    })
  })
}
