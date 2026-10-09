import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import kuromoji from 'kuromoji'

const root = fileURLToPath(new URL('../', import.meta.url))

export function createTokenizer() {
  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: path.join(root, 'node_modules/kuromoji/dict') }).build((error, tokenizer) => {
      if (error) reject(error)
      else resolve(tokenizer)
    })
  })
}

const syllables = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'i', ゑ: 'e', を: 'wo', ゔ: 'vu',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゃ: 'ya', ゅ: 'yu', ょ: 'yo', ゎ: 'wa',
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo', ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho', じゃ: 'ja', じゅ: 'ju', じょ: 'jo',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho', ぢゃ: 'ja', ぢゅ: 'ju', ぢょ: 'jo',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo', ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
  びゃ: 'bya', びゅ: 'byu', びょ: 'byo', ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
  みゃ: 'mya', みゅ: 'myu', みょ: 'myo', りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
  ふぁ: 'fa', ふぃ: 'fi', ふぇ: 'fe', ふぉ: 'fo', ふゅ: 'fyu',
  てぃ: 'ti', でぃ: 'di', とぅ: 'tu', どぅ: 'du', しぇ: 'she', じぇ: 'je', ちぇ: 'che',
  つぁ: 'tsa', つぃ: 'tsi', つぇ: 'tse', つぉ: 'tso',
  ゔぁ: 'va', ゔぃ: 'vi', ゔぇ: 've', ゔぉ: 'vo', ゔゅ: 'vyu',
}

const punctuation = { '。': '.', '、': ',', '！': '!', '？': '?', '「': '“', '」': '”', '『': '“', '』': '”', '（': '(', '）': ')' }
const kana = (text) => [...text.normalize('NFKC')].map((character) => {
  const code = character.codePointAt(0)
  return code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : character
}).join('')

export function romanizeKana(text) {
  const source = kana(text)
  let result = ''
  let doubled = false
  for (let index = 0; index < source.length; index++) {
    const character = source[index]
    if (character === 'っ') { doubled = true; continue }
    if (character === 'ん') {
      const next = syllables[source.slice(index + 1, index + 3)] ?? syllables[source[index + 1]] ?? ''
      result += /^[aeiouy]/.test(next) ? "n'" : 'n'
      continue
    }
    if (character === 'ー') {
      result += [...result].reverse().find((letter) => /[aeiou]/.test(letter)) ?? '-'
      continue
    }
    const pair = syllables[source.slice(index, index + 2)]
    const roman = pair ?? syllables[character] ?? punctuation[character] ?? character
    if (doubled) {
      result += roman.startsWith('ch') ? 't' : /^[a-z]/.test(roman) ? roman[0] : "'"
      doubled = false
    }
    result += roman
    if (pair) index++
  }
  return result + (doubled ? "'" : '')
}

function prefixDistances(expected, actual) {
  let previous = Array.from({ length: actual.length + 1 }, (_, index) => index)
  for (let i = 1; i <= expected.length; i++) {
    const current = [i]
    for (let j = 1; j <= actual.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (expected[i - 1] === actual[j - 1] ? 0 : 1))
    }
    previous = current
  }
  return previous
}

// Anchor written kana and punctuation exactly, then find the closest readings
// for kanji tokens. A contextual reading must never consume an adjacent particle.
function alignReadings(tokens, actual) {
  const costs = Array.from({ length: tokens.length + 1 }, () => new Float64Array(actual.length + 1).fill(Infinity))
  const previous = Array.from({ length: tokens.length + 1 }, () => new Int32Array(actual.length + 1).fill(-1))
  costs[0][0] = 0
  for (const [index, token] of tokens.entries()) {
    const surface = kana(token.surface_form)
    const fixed = /^[ぁ-ゖー、。！？「」・]+$/u.test(surface)
    const prefix = surface.match(/^[ぁ-ゖー]+/u)?.[0] ?? ''
    const suffix = surface.match(/[ぁ-ゖー]+$/u)?.[0] ?? ''
    for (let start = 0; start < actual.length; start++) {
      if (!Number.isFinite(costs[index][start])) continue
      const distances = fixed ? null : prefixDistances(token.kana, actual.slice(start))
      const firstEnd = fixed ? start + surface.length : start + 1
      const lastEnd = fixed ? firstEnd : actual.length
      for (let end = firstEnd; end <= lastEnd; end++) {
        const chunk = actual.slice(start, end)
        if (fixed ? chunk !== surface : !/^[ぁ-ゖー]+$/u.test(chunk) || !chunk.startsWith(prefix) || !chunk.endsWith(suffix)) continue
        const cost = costs[index][start] + (fixed ? 0 : distances[end - start] + Math.abs(chunk.length - token.kana.length) * 0.01)
        if (cost < costs[index + 1][end]) { costs[index + 1][end] = cost; previous[index + 1][end] = start }
      }
    }
  }
  if (!Number.isFinite(costs[tokens.length][actual.length])) throw new Error(`Cannot align authored reading: ${actual}`)
  const readings = []
  let end = actual.length
  for (let index = tokens.length; index > 0; index--) {
    const start = previous[index][end]
    readings[index - 1] = actual.slice(start, end)
    end = start
  }
  return readings
}

export function romanizeSentence(japanese, reading, tokenizer) {
  const tokens = tokenizer.tokenize(japanese).map((token) => ({ ...token, kana: kana(token.reading ?? token.surface_form) }))
  const authored = kana(reading).replace(/\s/g, '')
  const readings = alignReadings(tokens, authored)
  const groups = []
  for (const [index, token] of tokens.entries()) {
    const text = readings[index]
    if (!text) continue
    const particle = token.pos === '助詞'
    const roman = particle && ['は', 'へ', 'を'].includes(text) ? ({ は: 'wa', へ: 'e', を: 'o' })[text]
      : particle && text.startsWith('を') ? `o ${romanizeKana(text.slice(1))}`
      : token.surface_form === '実は' ? 'jitsu wa'
      : token.surface_form === 'または' ? 'matawa' : null
    const previous = groups.at(-1)
    const joins = previous && !previous.particle && previous.pos !== '記号' && (
      token.pos === '助動詞' && !['です', 'だ'].includes(token.basic_form)
      || token.pos === '助詞' && token.pos_detail_1 === '接続助詞'
      || token.pos === '動詞' && ['非自立', '接尾'].includes(token.pos_detail_1)
      || token.pos === '名詞' && (token.pos_detail_1 === '接尾' || previous.pos === '名詞' && (!['副詞可能', '非自立'].includes(previous.detail) || token.surface_form === 'ご飯') && !['副詞可能', '形容動詞語幹', '代名詞'].includes(token.pos_detail_1))
      || previous.pos === '接頭詞'
    )
    if (joins) { previous.text += text; previous.pos = token.pos; previous.detail = token.pos_detail_1 }
    else groups.push({ text, particle, roman, pos: token.pos, detail: token.pos_detail_1 })
  }
  return groups.map((group) => group.roman ?? romanizeKana(group.text))
    .join(' ').replace(/\s+([.,!?;:)”])/g, '$1').replace(/([“(])\s+/g, '$1').replace(/[a-z]/, (letter) => letter.toUpperCase())
}

const readJson = async (relative) => JSON.parse(await fs.readFile(path.join(root, relative), 'utf8'))

export async function buildFlashcards() {
  const [vocabulary, base, corrections, ...batches] = await Promise.all([
    readJson('src/data/n3.json'),
    readJson('scripts/flashcard-sentences/base.json'),
    readJson('scripts/flashcard-sentences/corrections.json'),
    ...['041-320', '321-600', '601-880'].map((range) => readJson(`scripts/flashcard-sentences/n3-${range}.json`)),
  ])
  const authored = batches.flat()
  const ids = new Set(authored.map((sentence) => sentence.vocabularyId))
  if (authored.length !== 840 || ids.size !== 840) throw new Error('Expected 840 distinct new N3 sentences (entries 41–880).')
  const tokenizer = await createTokenizer()
  const newCards = vocabulary.filter((entry) => entry.order > 40).map((entry) => {
    const sentence = authored.find((item) => item.vocabularyId === entry.id)
    if (!sentence) throw new Error(`Missing sentence: ${entry.id}`)
    if (!['japanese', 'reading', 'en', 'vi'].every((field) => typeof sentence[field] === 'string' && sentence[field].trim())) throw new Error(`Incomplete sentence: ${entry.id}`)
    if (!/[。！？]$/u.test(sentence.japanese) || !/^[ぁ-ゖー、。！？「」・\s]+$/u.test(sentence.reading)) throw new Error(`Invalid sentence/reading: ${entry.id}`)
    if (sentence.japanese === entry.headword || /という言葉|という単語/u.test(sentence.japanese)) throw new Error(`Expected a contextual sentence: ${entry.id}`)
    const correction = corrections[entry.id] ?? {}
    const target = correction.target ?? entry.headword
    const romaji = romanizeSentence(sentence.japanese, sentence.reading, tokenizer)
    if (/[ぁ-ゖァ-ヺ一-龯]/u.test(romaji)) throw new Error(`Incomplete romaji: ${entry.id}`)
    return {
      id: `flashcard:${entry.id}`, deck: 'N3', vocabularyId: entry.id, target,
      targetReading: correction.targetReading ?? entry.reading,
      ...(target !== entry.headword ? { sourceTarget: entry.headword } : {}),
      japanese: sentence.japanese, reading: sentence.reading, romaji, en: sentence.en, vi: sentence.vi,
      ...(correction.notes ? { notes: correction.notes } : {}),
    }
  })
  const cards = [...base.filter((card) => card.deck === 'N3'), ...newCards, ...base.filter((card) => card.deck !== 'N3')]
  if (new Set(cards.map((card) => card.id)).size !== cards.length) throw new Error('Duplicate flashcard IDs.')
  for (const entry of vocabulary) {
    if (cards.filter((card) => card.vocabularyId === entry.id).length !== 1) throw new Error(`Expected one card for ${entry.id}`)
  }
  await fs.writeFile(path.join(root, 'src/data/flashcards.json'), `[\n${cards.map((card) => `  ${JSON.stringify(card)}`).join(',\n')}\n]\n`)
  console.log(`Built ${cards.filter((card) => card.deck === 'N3').length} N3 cards covering all ${vocabulary.length} vocabulary entries; ${cards.length} sentence cards total.`)
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await buildFlashcards()
}
