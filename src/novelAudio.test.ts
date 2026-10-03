/// <reference types="node" />
import { expect, it } from 'vitest'
import { chapterSentences } from './novelAudio'
import novel from './data/novel.json'
import manifest from './data/novel-audio.json'
import { readFileSync } from 'node:fs'

it('splits spoken sentences while preserving grammar, quotes, and all prose', () => {
  const sentences = chapterSentences(2, ['「{{9|買い物のついでに}}来た。そうなの？」彼は笑った。', '次へ'])
  expect(sentences.map(s => s.text)).toEqual(['「買い物のついでに来た。', 'そうなの？」', '彼は笑った。', '次へ'])
  expect(sentences[0].parts.some(p => p.grammarId === 'n3-grammar:9')).toBe(true)
  expect(sentences.map(s => s.id)).toEqual(['2:0:0', '2:0:1', '2:0:2', '2:1:0'])
})

it('bundles every sentence in all twenty playable chapter MP3s with ordered audio timings', () => {
  expect(manifest.chapters).toHaveLength(20)
  for (const chapter of novel.chapters) {
    const audio = manifest.chapters.find(item => item.id === chapter.id)!
    const sentences = chapterSentences(chapter.id, chapter.paragraphs)
    expect(audio.sentences.map(s => [s.id, s.text])).toEqual(sentences.map(s => [s.id, s.text]))
    expect(audio.duration).toBeGreaterThan(60)
    expect(readFileSync(`public${audio.src}`).length).toBeGreaterThan(100000)
    let previous = -1
    for (const sentence of audio.sentences) {
      expect(sentence.start).toBeGreaterThanOrEqual(previous)
      expect(sentence.end).toBeGreaterThan(sentence.start)
      expect(sentence.end).toBeLessThanOrEqual(audio.duration + 0.15)
      previous = sentence.end
    }
  }
  expect(readFileSync(`public${manifest.fullSrc}`).length).toBeGreaterThan(1000000)
})
