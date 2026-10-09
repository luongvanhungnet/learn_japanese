import { beforeAll, expect, test } from 'vitest'
import { createTokenizer, romanizeSentence } from '../scripts/build_flashcards.mjs'

let tokenizer: Awaited<ReturnType<typeof createTokenizer>>
beforeAll(async () => { tokenizer = await createTokenizer() })

test('builds readable sentence romaji with grammatical particles and verb endings', () => {
  expect(romanizeSentence('私は昼ご飯を食べました。', 'わたしはひるごはんをたべました。', tokenizer)).toBe('Watashi wa hirugohan o tabemashita.')
})

test('preserves authored contextual readings, gemination, and long vowels', () => {
  expect(romanizeSentence('二人で学校へ行きました。', 'ふたりでがっこうへいきました。', tokenizer)).toBe('Futari de gakkou e ikimashita.')
  expect(romanizeSentence('全員でコーヒーを一杯飲みました。', 'ぜんいんでこーひーをいっぱいのみました。', tokenizer)).toBe("Zen'in de koohii o ippai nomimashita.")
})

test('keeps particles and contextual kanji readings intact when dictionary readings differ', () => {
  expect(romanizeSentence('山を下りました。', 'やまをくだりました。', tokenizer)).toBe('Yama o kudarimashita.')
  expect(romanizeSentence('雲の間から月が見えました。', 'くものあいだからつきがみえました。', tokenizer)).toBe('Kumo no aida kara tsuki ga miemashita.')
})

test('pronounces compound particles and conjunctions correctly', () => {
  expect(romanizeSentence('実は、まだです。', 'じつは、まだです。', tokenizer)).toBe('Jitsu wa, mada desu.')
  expect(romanizeSentence('電話またはメールでお願いします。', 'でんわまたはめーるでおねがいします。', tokenizer)).toBe('Denwa matawa meeru de onegai shimasu.')
  expect(romanizeSentence('問題をめぐって話し合いました。', 'もんだいをめぐってはなしあいました。', tokenizer)).toBe('Mondai o megutte hanashiaimashita.')
})
