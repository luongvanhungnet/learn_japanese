import fs from 'node:fs'
import ts from 'typescript'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, resolveJsonModule: true, esModuleInterop: true } }).outputText, filename)
const { chapterSentences } = require('../src/novelAudio.ts')
const novel = JSON.parse(fs.readFileSync('src/data/novel.json', 'utf8'))
fs.mkdirSync('.novel-audio-cache', { recursive: true })
fs.writeFileSync('.novel-audio-cache/input.json', JSON.stringify(novel.chapters.map(chapter => ({ id: chapter.id, sentences: chapterSentences(chapter.id, chapter.paragraphs).map(({ id, text }) => ({ id, text })) })), null, 2))
console.log('Prepared sentence text for all chapters.')
