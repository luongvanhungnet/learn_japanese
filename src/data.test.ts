import { describe, expect, it } from 'vitest'
import n2 from './data/n2.json'
import n3 from './data/n3.json'

for (const [level, entries, count] of [
  ['N3', n3, 880],
  ['N2', n2, 1160],
] as const) {
  describe(`${level} vocabulary`, () => {
    it('has every number once with complete practice data', () => {
      expect(entries).toHaveLength(count)
      expect(entries.map((entry) => entry.order)).toEqual(Array.from({ length: count }, (_, index) => index + 1))
      expect(new Set(entries.map((entry) => entry.id)).size).toBe(count)
      for (const entry of entries) {
        expect(entry.id).toBe(`${level.toLowerCase()}:${entry.order}`)
        expect(entry.level).toBe(level)
        expect(entry.headword.trim()).not.toBe('')
        expect(entry.reading.trim()).not.toBe('')
        expect(entry.reading).not.toMatch(/[\u4e00-\u9fff]/)
        expect(entry.meanings.length).toBeGreaterThan(0)
        expect(entry.meanings.every((meaning) => meaning.trim())).toBe(true)
        expect(entry.hanViet !== null).toBe(/[\u4e00-\u9fff]/.test(entry.headword))
      }
    })
  })
}
