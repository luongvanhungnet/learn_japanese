import vocabulary from './data/n3.json'
import supportingLexicon from './data/novel-lexicon.json'
import translations from './data/vi.json'

// Corrections apply only to this reader; the imported study collection is preserved.
export const editorialCorrections: Record<string, { headword: string; reading: string; hanViet: string | null; en: string[]; vi: string[]; note: string }> = {
  'n3:445': { headword: 'だます', reading: 'だます', hanViet: null, en: ['deceive', 'trick'], vi: ['lừa', 'lừa dối'], note: 'Source だまる has the meaning of だます; the story uses だます.' },
  'n3:580': { headword: '適当な', reading: 'てきとうな', hanViet: 'THÍCH ĐƯƠNG', en: ['suitable', 'appropriate'], vi: ['thích hợp', 'phù hợp'], note: 'Source 敵とな / てきとな is corrected to 適当な.' },
  'n3:657': { headword: '表面', reading: 'ひょうめん', hanViet: 'BIỂU DIỆN', en: ['surface'], vi: ['bề mặt'], note: 'Source 鏡面 has the reading and meaning of 表面.' },
  'n3:682': { headword: '協調', reading: 'きょうちょう', hanViet: 'HIỆP ĐIỀU', en: ['cooperation', 'harmony'], vi: ['sự phối hợp', 'hòa hợp'], note: '協調 means cooperation; source English “emphasis” would be 強調.' },
  'n3:358': { headword: '自身', reading: 'じしん', hanViet: 'TỰ THÂN', en: ['oneself'], vi: ['bản thân'], note: '自身 means oneself; confidence is 自信.' },
  'n3:796': { headword: 'パートナー', reading: 'パートナー', hanViet: null, en: ['partner'], vi: ['cộng sự', 'đối tác'], note: 'Source パートナ is normalized to パートナー.' },
}

export type Annotation = { text: string; vocabularyIds: string[]; grammarId?: string }

export function lookupMeanings(entry: { id: string; meanings: string[]; meaningsVi?: string[] }, language: 'en' | 'vi'): string[] {
  const corrected = editorialCorrections[entry.id]
  if (corrected) return corrected[language]
  if (language === 'en') return entry.meanings
  const vietnamese = entry.meaningsVi?.length ? entry.meaningsVi : (translations.N3 as Record<string, string[]>)[entry.id]
  return vietnamese?.length ? vietnamese : ['Chưa có nghĩa tiếng Việt']
}
const ichidan = new Set([127,129,131,143,145,153,155,157,158,159,166,175,183,187,191,196,200,206,209,211,300,302,304,306,308,310,412,416,418,420,423,425,426,427,428,431,432,436,438,442,443,444,450,453,456,458,463,464,465,470,472,475,477,479,480,482,484,486,488,490,493,494,496,498,500,504,505,510,719,722,723,726,727,729,730,731,733,734,735,736,740,741,742,750,751,752,755,757,760,761,763,766,768,770,772,774,776,778,781,782,785,786,788,790,794,836,838,839,840,841,843,844])

export function vocabularyForms(entry: { id: string; headword: string; order: number }): string[] {
  const corrected = editorialCorrections[entry.id]?.headword ?? entry.headword
  const forms = new Set<string>()
  for (const word of corrected.split('・')) {
    forms.add(word)
    if (word.endsWith('な')) { forms.add(word.slice(0, -1)); continue }
    if (word.endsWith('する')) {
      const stem = word.slice(0, -2)
      for (const ending of ['した', 'して', 'しない', 'します', 'しよう', 'できる']) forms.add(stem + ending)
    } else if (word.endsWith('る') && ichidan.has(entry.order)) {
      const stem = word.slice(0, -1)
      for (const ending of ['た', 'て', 'ない', 'ます', 'ません', 'れば', 'よう', 'られる']) forms.add(stem + ending)
    } else if ('うくぐすつぬぶむる'.includes(word.at(-1) ?? ' ')) {
      const end = word.at(-1)!, stem = word.slice(0, -1)
      const index = 'うくぐすつぬぶむる'.indexOf(end)
      const a = ['わ','か','が','さ','た','な','ば','ま','ら'][index]
      const i = ['い','き','ぎ','し','ち','に','び','み','り'][index]
      const e = ['え','け','げ','せ','て','ね','べ','め','れ'][index]
      const te = ['って','いて','いで','して','って','んで','んで','んで','って'][index]
      const ta = te.replace('て','た').replace('で','だ')
      for (const ending of [a+'ない',i+'ます',i+'ません',e+'ば',te,ta]) forms.add(stem+ending)
    } else if (word.endsWith('い')) {
      for (const ending of ['く', 'かった', 'くない']) forms.add(word.slice(0, -1) + ending)
    }
  }
  return [...forms].filter(Boolean)
}

const lexicon = new Map<string, string[]>()
for (const entry of vocabulary) for (const form of vocabularyForms(entry)) lexicon.set(form, [...(lexicon.get(form) ?? []), entry.id])
const starters = new Map<string, string[]>()
for (const word of lexicon.keys()) starters.set(word[0], [...(starters.get(word[0]) ?? []), word])
for (const words of starters.values()) words.sort((a, b) => b.length - a.length)
const supportingForms = new Map<string, string[]>()
const supportingStarters = new Map<string, string[]>()
for (const entry of supportingLexicon) for (const form of entry.forms) {
  if (lexicon.has(form)) continue
  supportingForms.set(form, [...(supportingForms.get(form) ?? []), entry.id])
}
for (const form of supportingForms.keys()) supportingStarters.set(form[0], [...(supportingStarters.get(form[0]) ?? []), form])
for (const forms of supportingStarters.values()) forms.sort((a, b) => b.length - a.length)

export function annotateText(source: string): Annotation[] {
  const result: Annotation[] = []
  const parts = source.split(/(\{\{\d+\|[^}]+\}\})/g)
  for (const part of parts) {
    const marked = /^\{\{(\d+)\|([^}]+)\}\}$/.exec(part)
    const text = marked ? marked[2] : part
    const grammarId = marked ? `n3-grammar:${marked[1]}` : undefined
    let plain = ''
    const flush = () => { if (plain) { result.push({ text: plain, vocabularyIds: [], grammarId }); plain = '' } }
    for (let index = 0; index < text.length;) {
      const target = starters.get(text[index])?.find((value) => text.startsWith(value, index))
      const supporting = supportingStarters.get(text[index])?.find((value) => text.startsWith(value, index))
      const word = target && (!supporting || target.length >= supporting.length) ? target : supporting
      if (word) { flush(); result.push({ text: word, vocabularyIds: lexicon.get(word) ?? supportingForms.get(word)!, grammarId }); index += word.length }
      else { plain += text[index]; index++ }
    }
    flush()
  }
  return result
}

export const plainText = (text: string) => text.replace(/\{\{\d+\|([^}]+)\}\}/g, '$1')

export function grammarReference(pattern: string) {
  const readings: Record<string,string> = { 命令: 'めいれい', 禁止: 'きんし', 注意: 'ちゅうい', 最中: 'さいちゅう', 一方: 'いっぽう', 反面: 'はんめん', 間: 'あいだ', 限: 'かぎ', 対: 'たい', 言: 'い', 頼: 'たの', 決: 'き', 違: 'ちが', 通じ: 'つうじ', 通: 'とお', 上: 'あ', 切: 'き', 出: 'だ' }
  const hanViet: Record<string,string> = { 命: 'MỆNH', 令: 'LỆNH', 禁: 'CẤM', 止: 'CHỈ', 注: 'CHÚ', 意: 'Ý', 最: 'TỐI', 中: 'TRUNG', 一: 'NHẤT', 方: 'PHƯƠNG', 反: 'PHẢN', 面: 'DIỆN', 間: 'GIAN', 限: 'HẠN', 対: 'ĐỐI', 言: 'NGÔN', 頼: 'LẠI', 決: 'QUYẾT', 違: 'VI', 通: 'THÔNG', 上: 'THƯỢNG', 切: 'THIẾT', 出: 'XUẤT' }
  const reading = pattern.replace(new RegExp(Object.keys(readings).join('|'), 'g'), (word) => readings[word])
  const kanji = [...pattern].filter((letter) => /[一-龠]/.test(letter))
  return { reading, hanViet: [...new Set(kanji.map((letter) => hanViet[letter]).filter(Boolean))].join(' · ') || '—' }
}
