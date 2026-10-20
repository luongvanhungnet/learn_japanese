export type ExamChoice = 1 | 2 | 3 | 4
export type ExamSectionId = 'vocabulary' | 'grammar-reading'

export type ExamQuestion = {
  id: string
  number: number
  answer: ExamChoice | null
  page: number
  choices: 4
  group?: 'grammar' | 'reading'
  note?: string
}

export type ExamSection = {
  id: ExamSectionId
  durationMinutes: number
  pages: number[]
  questions: ExamQuestion[]
}

export type ExamPaper = {
  id: string
  level: 'N3'
  year: number
  month: number
  durationMinutes: number
  sections: ExamSection[]
  answerKeyPages: number[]
  notes?: string
}

export type ExamAttempt = {
  id: string
  paperId: string
  startedAt: number
  deadline: number
  answers: Record<string, ExamChoice>
  submittedAt: number | null
  reason: 'manual' | 'timeout' | null
}

export type ExamHistory = { version: 1; attempts: Record<string, ExamAttempt> }
export type ExamSectionScore = { id: ExamSectionId; correct: number; total: number; percentage: number }
export type ExamScore = { correct: number; total: number; percentage: number; unanswered: number; unansweredAll: number; unscored: number; sections: ExamSectionScore[] }

export const examStorageKey = 'mimikara-exams-v1'

const percentage = (correct: number, total: number) => total ? Math.round(correct / total * 100) : 0

export function scoreExam(paper: ExamPaper, attempt: ExamAttempt): ExamScore {
  const sections = paper.sections.map((section) => {
    const keyed = section.questions.filter((question) => question.answer !== null)
    const correct = keyed.filter((question) => Object.hasOwn(attempt.answers, question.id) && attempt.answers[question.id] === question.answer).length
    const total = keyed.length
    return { id: section.id, correct, total, percentage: percentage(correct, total) }
  })
  const correct = sections.reduce((sum, section) => sum + section.correct, 0)
  const total = sections.reduce((sum, section) => sum + section.total, 0)
  const questions = paper.sections.flatMap((section) => section.questions)
  const unanswered = questions.filter((question) => question.answer !== null && !Object.hasOwn(attempt.answers, question.id)).length
  const unansweredAll = questions.filter((question) => !Object.hasOwn(attempt.answers, question.id)).length
  return { correct, total, percentage: percentage(correct, total), unanswered, unansweredAll, unscored: questions.length - total, sections }
}

export function startExam(paper: ExamPaper, now = Date.now(), id: string = crypto.randomUUID()): ExamAttempt {
  return { id, paperId: paper.id, startedAt: now, deadline: now + paper.durationMinutes * 60_000, answers: {}, submittedAt: null, reason: null }
}

export function remainingExamSeconds(attempt: ExamAttempt, now = Date.now()): number {
  return Math.max(0, Math.ceil((attempt.deadline - now) / 1_000))
}

const validChoice = (value: unknown): value is ExamChoice => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 4

export function answerExam(paper: ExamPaper, attempt: ExamAttempt, questionId: string, choice: ExamChoice | null, now = Date.now()): ExamAttempt {
  if (attempt.submittedAt !== null || attempt.paperId !== paper.id || !Number.isFinite(now) || now < attempt.startedAt
    || !paper.sections.some((section) => section.questions.some((question) => question.id === questionId))
    || (choice !== null && !validChoice(choice))) return attempt
  const current = expireExam(attempt, now)
  if (current !== attempt) return current
  const prior = Object.hasOwn(attempt.answers, questionId) ? attempt.answers[questionId] : null
  if (prior === choice) return attempt
  const answers = { ...attempt.answers }
  if (choice === null) delete answers[questionId]
  else answers[questionId] = choice
  return { ...attempt, answers }
}

export function expireExam(attempt: ExamAttempt, now = Date.now()): ExamAttempt {
  return attempt.submittedAt === null && now >= attempt.deadline
    ? { ...attempt, submittedAt: attempt.deadline, reason: 'timeout' }
    : attempt
}

export function submitExam(attempt: ExamAttempt, now = Date.now()): ExamAttempt {
  const current = expireExam(attempt, now)
  if (current !== attempt || attempt.submittedAt !== null || now < attempt.startedAt) return current
  return { ...attempt, submittedAt: now, reason: 'manual' }
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,127}$/.test(value) && !['constructor', 'prototype', '__proto__'].includes(value)
const validTimestamp = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

function parseAttempt(id: string, value: unknown, paper: ExamPaper): ExamAttempt | null {
  if (!validId(id) || !isRecord(value) || value.id !== id || value.paperId !== paper.id
    || !validTimestamp(value.startedAt) || !validTimestamp(value.deadline)
    || value.deadline !== value.startedAt + paper.durationMinutes * 60_000
    || !isRecord(value.answers)) return null
  if (value.submittedAt === null) {
    if (value.reason !== null) return null
  } else if (!validTimestamp(value.submittedAt) || value.submittedAt < value.startedAt || value.submittedAt > value.deadline
    || (value.reason !== 'manual' && value.reason !== 'timeout')
    || (value.reason === 'timeout' && value.submittedAt !== value.deadline)) return null
  const knownQuestions = new Set(paper.sections.flatMap((section) => section.questions.map((question) => question.id)))
  const answers: Record<string, ExamChoice> = {}
  for (const [questionId, choice] of Object.entries(value.answers)) {
    if (!validId(questionId) || !knownQuestions.has(questionId) || !validChoice(choice)) return null
    answers[questionId] = choice
  }
  return { id, paperId: paper.id, startedAt: value.startedAt, deadline: value.deadline, answers, submittedAt: value.submittedAt as number | null, reason: value.reason as ExamAttempt['reason'] }
}

export function parseExamHistory(raw: string | null, papers: readonly ExamPaper[], now = Date.now()): ExamHistory {
  const empty: ExamHistory = { version: 1, attempts: {} }
  if (!raw) return empty
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.attempts)) return empty
    const knownPapers = new Map(papers.map((paper) => [paper.id, paper]))
    const attempts: Record<string, ExamAttempt> = {}
    for (const [id, value] of Object.entries(parsed.attempts)) {
      if (!isRecord(value) || typeof value.paperId !== 'string') continue
      const paper = knownPapers.get(value.paperId)
      const attempt = paper ? parseAttempt(id, value, paper) : null
      if (attempt) attempts[id] = expireExam(attempt, now)
    }
    return { version: 1, attempts: latestAttempts(attempts) }
  } catch {
    return empty
  }
}

function latestAttempts(attempts: Record<string, ExamAttempt>): Record<string, ExamAttempt> {
  return Object.fromEntries(Object.entries(attempts).sort(([, left], [, right]) => right.startedAt - left.startedAt || right.id.localeCompare(left.id)).slice(0, 30))
}

export function saveExamAttempt(history: ExamHistory, attempt: ExamAttempt): ExamHistory {
  if (Object.hasOwn(history.attempts, attempt.id) && history.attempts[attempt.id] === attempt) return history
  return { version: 1, attempts: latestAttempts({ ...history.attempts, [attempt.id]: attempt }) }
}
