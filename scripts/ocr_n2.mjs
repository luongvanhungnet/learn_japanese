// OCR the per-cell PNGs prepared by prepare_n2.py.
// Run: node scripts/ocr_n2.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createWorker, PSM } from 'tesseract.js'

const root = join(tmpdir(), 'mimikara_n2_cells')
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'))
const specs = [
  ['reading', 'jpn', PSM.SINGLE_LINE],
  ['headword', 'jpn', PSM.SINGLE_LINE],
  ['hanViet', 'vie', PSM.SINGLE_LINE],
  ['meaning', 'vie', PSM.SINGLE_BLOCK],
]

const workers = await Promise.all(specs.map(async ([, lang, mode]) => {
  const worker = await createWorker(lang)
  await worker.setParameters({ tessedit_pageseg_mode: mode })
  return worker
}))

const result = []
let lastPage = 0
for (const item of manifest) {
  if (item.page !== lastPage) {
    if (lastPage) {
      writeFileSync(join(root, 'ocr-progress.json'), JSON.stringify(result, null, 2))
      console.log(`Finished page ${lastPage}, entries ${result.length}`)
    }
    lastPage = item.page
  }
  const values = await Promise.all(specs.map(async ([field], index) => {
    const data = (await workers[index].recognize(item.cells[field])).data
    return [field, { text: data.text.trim(), confidence: Math.round(data.confidence) }]
  }))
  result.push({ order: item.order, page: item.page, row: item.row, ...Object.fromEntries(values) })
}
writeFileSync(join(root, 'ocr-progress.json'), JSON.stringify(result, null, 2))
console.log(`Finished page ${lastPage}, entries ${result.length}`)
await Promise.all(workers.map(worker => worker.terminate()))
