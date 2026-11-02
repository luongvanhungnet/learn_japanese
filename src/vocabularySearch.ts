import n3 from './data/n3.json'
import n2 from './data/n2.json'
import radicals from './data/radicals.json'
import grammar from './data/n3-grammar.json'
import lexicon from './data/novel-lexicon.json'
import vietnamese from './data/vi.json'
import { gameCards } from './game'

export type SearchEntry = { id: string; source: string; headword: string; reading: string; hanViet: string | null; en: string[]; vi: string[]; order?: number; aliases?: string[] }
export const normalizeSearch = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').trim().replace(/\s+/g, ' ')
export function buildSearchIndex(entries: SearchEntry[]) {
  return entries.map(entry => ({ entry, fields: [entry.headword, entry.reading, entry.hanViet ?? '', ...entry.vi, ...entry.en, ...(entry.aliases ?? [])].map(normalizeSearch) }))
}
export function searchVocabulary(index: ReturnType<typeof buildSearchIndex>, query: string) {
  const normalized = normalizeSearch(query)
  if (!normalized) return []
  const tokens = normalized.split(' ')
  return index.flatMap(({ entry, fields }) => {
    if (!tokens.every(token => fields.some(field => field.includes(token)))) return []
    const score = fields.some(field => field === normalized) ? 0 : fields.some(field => field.startsWith(normalized)) ? 1 : 2
    return [{ entry, score }]
  }).sort((a, b) => a.score - b.score).map(result => result.entry)
}
const entries: SearchEntry[] = [
  ...n3.map(e => ({ ...e, source: 'N3', en: e.meanings, vi: (vietnamese.N3 as Record<string, string[]>)[e.id] ?? [] })),
  ...n2.map(e => ({ ...e, source: 'N2', en: e.meanings, vi: (vietnamese.N2 as Record<string, string[]>)[e.id] ?? [] })),
  ...radicals.map(e => ({ ...e, aliases: [...e.readings, ...e.variants], source: 'RADICALS', en: e.meanings, vi: e.meaningsVi })),
  ...grammar.map(e => ({ id: e.id, source: 'N3-GRAMMAR', headword: e.pattern, reading: '', hanViet: null, en: e.meanings.en, vi: e.meanings.vi, order: e.order })),
  ...lexicon.map(e => ({ ...e, aliases: e.forms, source: 'STORY', en: e.meanings, vi: e.meaningsVi })),
  ...gameCards.map(c => ({ id: `game:${c.id}`, source: 'GAME', headword: c.word, reading: c.kana, hanViet: null, en: [c.en], vi: [c.vi] })),
]
export const vocabularySearchIndex = buildSearchIndex(entries)
