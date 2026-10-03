// Build-time only: no tokenizer or dictionary download is needed by the reader.
import { readFileSync, writeFileSync } from 'node:fs'
import kuromoji from 'kuromoji'

const tokenizer = await new Promise((resolve, reject) => kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((error, result) => error ? reject(error) : resolve(result)))
const novel = JSON.parse(readFileSync('src/data/novel.json', 'utf8'))
const found = new Map()
for (const chapter of novel.chapters) for (const paragraph of chapter.paragraphs) {
  const text = paragraph.replace(/\{\{\d+\|([^}]+)\}\}/g, '$1')
  for (const token of tokenizer.tokenize(text)) {
    if (token.pos === '記号') continue
    found.set(token.surface_form, { surface: token.surface_form, base: token.basic_form === '*' ? token.surface_form : token.basic_form, reading: token.reading ?? token.surface_form, pos: token.pos })
  }
}
writeFileSync('scripts/novel-tokens.json', JSON.stringify([...found.values()], null, 2) + '\n')
console.log(`${found.size} unique word forms`)
