import { annotateText } from './novel'
import type { Annotation } from './novel'

export type SpokenSentence = { id: string; paragraphIndex: number; text: string; parts: Annotation[] }
export type SentenceTiming = { id: string; text: string; start: number; end: number }
export type ChapterAudio = { id: number; src: string; duration: number; sentences: SentenceTiming[] }
export type AudioManifest = { voice: string; chapters: ChapterAudio[]; fullSrc: string }

export function chapterSentences(chapterId: number, paragraphs: string[]): SpokenSentence[] {
  return paragraphs.flatMap((paragraph, paragraphIndex) => {
    const parts = annotateText(paragraph)
    const text = parts.map(part => part.text).join('')
    const ends = [...text.matchAll(/[。！？!?]+[」』”’）)]*/g)].map(match => match.index + match[0].length)
    if (ends.at(-1) !== text.length) ends.push(text.length)
    let start = 0
    return ends.map((end, index) => {
      let offset = 0
      const pieces = parts.flatMap(part => {
        const from = Math.max(0, start - offset), to = Math.min(part.text.length, end - offset)
        offset += part.text.length
        return to > from ? [{ ...part, text: part.text.slice(from, to) }] : []
      })
      const sentence = { id: `${chapterId}:${paragraphIndex}:${index}`, paragraphIndex, text: text.slice(start, end), parts: pieces }
      start = end
      return sentence
    }).filter(sentence => sentence.text.trim())
  })
}
