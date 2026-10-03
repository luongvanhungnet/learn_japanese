import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import ts from 'typescript'

// Use the reader's actual matcher, so auditing and hover links cannot drift apart.
const compiled = ts.transpileModule(readFileSync('src/novel.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, esModuleInterop: true } }).outputText
const moduleExports = {}
new Function('require', 'exports', compiled)(createRequire(resolve('src/novel.ts')), moduleExports)
const novel = JSON.parse(readFileSync('src/data/novel.json', 'utf8'))
const vocabulary = JSON.parse(readFileSync('src/data/n3.json', 'utf8'))
const counts = new Map()
const chapterCounts = []
const grammarOccurrences = new Map()
for (const chapter of novel.chapters) {
  const local = new Map()
  for (const paragraph of chapter.paragraphs) {
    for (const part of moduleExports.annotateText(paragraph)) for (const id of part.vocabularyIds.filter((id) => id.startsWith('n3:'))) {
      counts.set(id, (counts.get(id) ?? 0) + 1)
      local.set(id, (local.get(id) ?? 0) + 1)
    }
    for (const match of paragraph.matchAll(/\{\{(\d+)\|([^}]+)\}\}/g)) {
      const id = `n3-grammar:${match[1]}`
      grammarOccurrences.set(id, [...(grammarOccurrences.get(id) ?? []), { chapter: chapter.id, phrase: match[2] }])
    }
  }
  chapterCounts.push({ chapter: chapter.id, title: chapter.title, japaneseCharacters: chapter.characterCount,
    scheduledTargets: chapter.targetIds.length, targetOccurrences: Object.fromEntries(chapter.targetIds.map((id) => [id, local.get(id) ?? 0])),
    earlierTargetIdsReused: [...local.keys()].filter((id) => Number(id.split(':')[1]) <= (chapter.id - 1) * 44).length })
}
const words = vocabulary.map((entry) => ({ id: entry.id, sourceHeadword: entry.headword, storyHeadword: moduleExports.editorialCorrections[entry.id]?.headword ?? entry.headword,
  occurrences: counts.get(entry.id) ?? 0, sourceCorrection: moduleExports.editorialCorrections[entry.id]?.note ?? null }))
const missing = words.filter((entry) => entry.occurrences < 2)
const report = { title: novel.title, chapters: novel.chapters.length, japaneseCharacters: novel.characterCount,
  coveredAtLeastTwice: words.length - missing.length, totalTargetIds: words.length,
  counting: 'Story paragraphs only; longest dictionary/inflection matches; source alternatives and corrected spellings map to the original ID. Identical source rows are retained as separate IDs. Chapter study lists and dictionary/example cards are excluded. Character count includes Japanese scripts, punctuation and full-width characters; excludes spaces, Latin text and annotation markup.',
  curriculum: '44 scheduled study targets per chapter, in source order. Incidental common words can occur before their scheduled chapter; this is not a first-ever-appearance quota.',
  chapterCoverage: chapterCounts, grammarPassages: Object.fromEntries(grammarOccurrences), vocabulary: words }
writeFileSync('public/novel-coverage.json', JSON.stringify(report, null, 2) + '\n')
console.log(`${report.chapters} chapters; ${report.japaneseCharacters.toLocaleString()} Japanese characters; ${report.coveredAtLeastTwice}/880 IDs appear at least twice; ${grammarOccurrences.size} contextual grammar patterns`)
if (missing.length || report.chapters < 18 || report.chapters > 20 || report.japaneseCharacters < 40000 || report.japaneseCharacters > 70000) {
  console.error(missing)
  process.exitCode = 1
}
