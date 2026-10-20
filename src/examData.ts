import manifest from './data/exams.json'
import type { ExamPaper } from './exam'

export type ExamSource = {
  filename: string
  sha256: string
  pageCount: number
  answerKeyKind: 'reviewed-practice'
  [key: string]: unknown
}

export const examPapers = manifest.papers as ExamPaper[]
export const examSource = manifest.source as ExamSource
