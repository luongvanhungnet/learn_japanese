// Produce scratch OCR for visual review; never overwrite reviewed source data.
// First render PDF pages 4–31 with pdftoppm -scale-to 1700 -png.
// Run: node scripts/ocr_n3_grammar.mjs <directory> <page-prefix>
import { createWorker } from 'tesseract.js'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [directory, prefix = 'n3_grammar_source'] = process.argv.slice(2)
if (!directory) throw new Error('Usage: node scripts/ocr_n3_grammar.mjs <directory> <page-prefix>')
// Separate language workers avoid multilingual initialization errors in the
// bundled WASM runtime and make each language's OCR easier to compare.
const languages = ['jpn', 'vie']
const workers = await Promise.all(languages.map((language) => createWorker(language)))
try {
  for (let page = 4; page <= 31; page++) {
    const image = join(directory, `${prefix}-${String(page).padStart(2, '0')}.png`)
    const results = await Promise.all(workers.map((worker) => worker.recognize(image)))
    for (const [index, { data }] of results.entries()) {
      writeFileSync(join(directory, `n3-grammar-ocr-${page}-${languages[index]}.txt`), data.text, 'utf8')
    }
    console.log(`OCR page ${page}: ${results.map(({ data }, index) => `${languages[index]} ${Math.round(data.confidence)}%`).join(', ')}; visual review required`)
  }
} finally {
  await Promise.all(workers.map((worker) => worker.terminate()))
}
