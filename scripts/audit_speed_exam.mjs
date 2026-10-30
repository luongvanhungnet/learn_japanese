import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'

const root = fileURLToPath(new URL('../src/data/speed-exam/', import.meta.url))
const files = readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).flatMap(dir =>
  readdirSync(path.join(root, dir.name)).filter(name => name.endsWith('.json')).map(name => path.join(root, dir.name, name)))
const questions = files.flatMap(file => {
  const items = JSON.parse(readFileSync(file, 'utf8'))
  assert.equal(items.length, 40, file)
  for (const q of items) assert.equal(q.section, path.basename(path.dirname(file)))
  return items
})
const normalize = text => text.normalize('NFKC').replace(/\s+/g, '')
assert.equal(questions.length, 600)
assert.equal(files.length, 15)
const ids = new Set(), contents = new Set()
for (const q of questions) {
  assert(!ids.has(q.id), `Duplicate id: ${q.id}`); ids.add(q.id)
  const content = normalize(`${q.passage ?? q.audioText ?? ''}${q.prompt}`)
  assert(!contents.has(content), `Duplicate question: ${q.id}`); contents.add(content)
  assert.equal(q.choices.length, 4, q.id)
  assert.equal(new Set(q.choices.map(normalize)).size, 4, q.id)
  assert(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, q.id)
  assert(q.explanation.length > 8, q.id)
  assert(q.batch >= 1 && q.batch <= 12, q.id)
  if (q.section === 'reading' || q.kind === 'Ngữ pháp trong đoạn văn') assert(q.passage, q.id)
  if (q.section === 'listening') assert(q.audioText, q.id)
  if (q.orderedFragments) assert.equal(q.choices[q.answer], q.orderedFragments[q.starIndex], q.id)
}
for (let batch = 1; batch <= 12; batch++) assert.equal(questions.filter(q => q.batch === batch).length, 50, `Batch ${batch}`)
// Similarity is a review aid, not a proof that a question has a unique semantic answer.
const grams = text => {
  const normalized = normalize(text)
  return new Set(Array.from({ length: Math.max(0, normalized.length - 2) }, (_, i) => normalized.slice(i, i + 3)))
}
const candidates = questions.map(q => ({ q, source: q.passage ?? q.audioText ?? q.prompt })).filter(item => item.source.length >= 80).map(item => ({ ...item, grams: grams(item.source) }))
const similar = []
for (let i = 0; i < candidates.length; i++) for (let j = i + 1; j < candidates.length; j++) {
  const a = candidates[i], b = candidates[j]
  if (a.source === b.source) continue // shared passage, different question: intentional
  const common = [...a.grams].filter(gram => b.grams.has(gram)).length
  const score = 2 * common / (a.grams.size + b.grams.size)
  if (score >= 0.8) similar.push({ ids: [a.q.id, b.q.id], similarity: Number(score.toFixed(3)) })
}
const summary = {
  questions: questions.length, files: files.length,
  sections: Object.fromEntries(['vocabulary', 'grammar', 'reading', 'listening'].map(section => [section, questions.filter(q => q.section === section).length])),
  batches: Array.from({ length: 12 }, (_, i) => ({ batch: i + 1, count: questions.filter(q => q.batch === i + 1).length })),
  answerPositions: Array.from({ length: 4 }, (_, answer) => questions.filter(q => q.answer === answer).length),
  readingPassages: new Set(questions.filter(q => q.section === 'reading').map(q => q.passage)).size,
  listeningScripts: new Set(questions.filter(q => q.section === 'listening').map(q => q.audioText)).size,
  nearDuplicateSources: similar,
}
console.log(JSON.stringify(summary, null, 2))
assert.equal(similar.length, 0, 'Review and resolve near-duplicate sources (similarity >= 0.8)')
