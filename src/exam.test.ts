import { expect, test } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { examPapers, examSource } from './examData'
import { answerExam, expireExam, parseExamHistory, remainingExamSeconds, saveExamAttempt, scoreExam, startExam, submitExam } from './exam'
import type { ExamHistory } from './exam'
import type { ExamAttempt, ExamPaper } from './exam'

const paper: ExamPaper = {
  id: 'n3-2022-07', level: 'N3', year: 2022, month: 7, durationMinutes: 100,
  answerKeyPages: [9],
  sections: [
    { id: 'vocabulary', durationMinutes: 30, pages: [1, 2], questions: [
      { id: 'vocabulary-1', number: 1, answer: 2, page: 1, choices: 4 },
      { id: 'vocabulary-2', number: 2, answer: 4, page: 2, choices: 4 },
    ] },
    { id: 'grammar-reading', durationMinutes: 70, pages: [3, 4], questions: [
      { id: 'grammar-reading-1', number: 1, answer: 1, page: 3, choices: 4, group: 'grammar' },
      { id: 'grammar-reading-2', number: 2, answer: 3, page: 4, choices: 4, group: 'reading' },
    ] },
  ],
}

const attempt: ExamAttempt = {
  id: 'attempt-1', paperId: paper.id, startedAt: 1_000, deadline: 6_001_000,
  answers: { 'vocabulary-1': 2, 'grammar-reading-1': 3 },
  submittedAt: 50_000, reason: 'manual',
}

test('scores only supplied correct answers and includes unanswered questions in each section total', () => {
  expect(scoreExam(paper, attempt)).toEqual({
    correct: 1, total: 4, percentage: 25, unanswered: 2, unansweredAll: 2, unscored: 0,
    sections: [
      { id: 'vocabulary', correct: 1, total: 2, percentage: 50 },
      { id: 'grammar-reading', correct: 0, total: 2, percentage: 0 },
    ],
  })
})

test('excludes ambiguous source questions from scored totals without marking them wrong', () => {
  const ambiguous: ExamPaper = { ...paper, sections: [
    { ...paper.sections[0], questions: [...paper.sections[0].questions, { id: 'vocabulary-3', number: 3, answer: null, note: 'Source omits a choice.', page: 2, choices: 4 }] },
    paper.sections[1],
  ] }
  expect(scoreExam(ambiguous, attempt)).toEqual({
    correct: 1, total: 4, percentage: 25, unanswered: 2, unansweredAll: 3, unscored: 1,
    sections: [
      { id: 'vocabulary', correct: 1, total: 2, percentage: 50 },
      { id: 'grammar-reading', correct: 0, total: 2, percentage: 0 },
    ],
  })
})

test('starts with one absolute deadline and computes remaining seconds across reload or offline time', () => {
  const started = startExam(paper, 1_000, 'attempt-new')
  expect(started).toEqual({ id: 'attempt-new', paperId: paper.id, startedAt: 1_000, deadline: 6_001_000, answers: {}, submittedAt: null, reason: null })
  expect(remainingExamSeconds(started, 1_000)).toBe(6_000)
  expect(remainingExamSeconds(started, 61_001)).toBe(5_940)
  expect(remainingExamSeconds(started, 6_000_999)).toBe(1)
  expect(remainingExamSeconds(started, 6_001_000)).toBe(0)
  expect(remainingExamSeconds(started, 6_010_000)).toBe(0)
})

test('records and clears active answers immutably while refusing unknown questions and invalid choices', () => {
  const started = startExam(paper, 1_000, 'attempt-new')
  const answered = answerExam(paper, started, 'vocabulary-1', 4, 2_000)
  expect(answered.answers).toEqual({ 'vocabulary-1': 4 })
  expect(started.answers).toEqual({})
  expect(answered.deadline).toBe(started.deadline)
  expect(answerExam(paper, answered, 'unknown', 1, 3_000)).toBe(answered)
  expect(answerExam(paper, answered, 'vocabulary-1', 5 as 1, 3_000)).toBe(answered)
  expect(answerExam(paper, answered, 'vocabulary-1', 4, 3_000)).toBe(answered)
  expect(answerExam(paper, answered, 'vocabulary-1', null, 3_000).answers).toEqual({})
})

test('auto submits exactly at the absolute deadline and refuses late answers', () => {
  const started = startExam(paper, 1_000, 'attempt-new')
  expect(expireExam(started, started.deadline - 1)).toBe(started)
  const expired = expireExam(started, started.deadline + 100_000)
  expect(expired.submittedAt).toBe(started.deadline)
  expect(expired.reason).toBe('timeout')
  expect(expired.answers).toEqual({})
  expect(answerExam(paper, started, 'vocabulary-1', 2, started.deadline)).toEqual(expired)
  expect(answerExam(paper, expired, 'vocabulary-1', 2, started.deadline + 1)).toBe(expired)
  expect(expireExam(expired, started.deadline + 200_000)).toBe(expired)
})

test('manual submission freezes answers and a late manual submission becomes timeout', () => {
  const started = answerExam(paper, startExam(paper, 1_000, 'attempt-new'), 'vocabulary-1', 2, 2_000)
  const submitted = submitExam(started, 3_000)
  expect(submitted.submittedAt).toBe(3_000)
  expect(submitted.reason).toBe('manual')
  expect(submitted.answers).toEqual(started.answers)
  expect(answerExam(paper, submitted, 'vocabulary-1', 4, 4_000)).toBe(submitted)
  expect(submitExam(submitted, 5_000)).toBe(submitted)
  expect(submitExam(started, started.deadline)).toEqual({ ...started, submittedAt: started.deadline, reason: 'timeout' })
  expect(submitExam(started, 999)).toBe(started)
})

test('restores known exam attempts from storage and safely ignores corrupt history roots', () => {
  const raw = JSON.stringify({ version: 1, attempts: { [attempt.id]: attempt } })
  expect(parseExamHistory(raw, [paper], 100_000)).toEqual({ version: 1, attempts: { [attempt.id]: attempt } })
  for (const broken of [null, '', '{bad', 'null', '[]', '42', '{}', '{"version":2,"attempts":{}}']) {
    expect(parseExamHistory(broken, [paper], 100_000)).toEqual({ version: 1, attempts: {} })
  }
})

test('drops malformed or tampered attempts while retaining clean known-paper data and stripping extra fields', () => {
  const invalid = [
    { ...attempt, paperId: 'missing' },
    { ...attempt, id: 'different-id' },
    { ...attempt, startedAt: -1 },
    { ...attempt, startedAt: '1000' },
    { ...attempt, deadline: attempt.deadline + 1 },
    { ...attempt, deadline: Number.POSITIVE_INFINITY },
    { ...attempt, answers: [] },
    { ...attempt, answers: { unknown: 1 } },
    { ...attempt, answers: { 'vocabulary-1': 5 } },
    { ...attempt, answers: { 'vocabulary-1': '2' } },
    { ...attempt, submittedAt: 999 },
    { ...attempt, submittedAt: attempt.deadline + 1 },
    { ...attempt, submittedAt: null, reason: 'manual' },
    { ...attempt, submittedAt: 50_000, reason: null },
    { ...attempt, reason: 'timeout' },
  ]
  for (const value of invalid) {
    expect(parseExamHistory(JSON.stringify({ version: 1, attempts: { [attempt.id]: value } }), [paper], 100_000).attempts).toEqual({})
  }
  const extra = { ...attempt, password: 'discard', answers: { ...attempt.answers } }
  expect(parseExamHistory(JSON.stringify({ version: 1, attempts: { [attempt.id]: extra } }), [paper], 100_000).attempts).toEqual({ [attempt.id]: attempt })
  expect(parseExamHistory(`{"version":1,"attempts":{"__proto__":${JSON.stringify({ ...attempt, id: '__proto__' })}}}`, [paper], 100_000).attempts).toEqual({})
})

test('rehydration submits an unfinished attempt that expired while the app was closed', () => {
  const started = startExam(paper, 1_000, 'attempt-new')
  const raw = JSON.stringify({ version: 1, attempts: { [started.id]: started } })
  expect(parseExamHistory(raw, [paper], started.deadline - 1).attempts[started.id]).toEqual(started)
  expect(parseExamHistory(raw, [paper], started.deadline + 86_400_000).attempts[started.id]).toEqual({ ...started, submittedAt: started.deadline, reason: 'timeout' })
})

test('retains the latest 30 attempts without mutating history and enforces the same limit on hydration', () => {
  let history: ExamHistory = { version: 1, attempts: {} }
  const all: ExamHistory = { version: 1, attempts: {} }
  for (let index = 0; index < 35; index += 1) {
    const next = startExam(paper, 1_000 + index, `attempt-${index}`)
    const before = JSON.stringify(history)
    const prior = history
    history = saveExamAttempt(history, next)
    expect(JSON.stringify(prior)).toBe(before)
    all.attempts[next.id] = next
  }
  expect(Object.keys(history.attempts)).toHaveLength(30)
  expect(history.attempts['attempt-4']).toBeUndefined()
  expect(history.attempts['attempt-5']).toBeDefined()
  expect(history.attempts['attempt-34']).toBeDefined()
  expect(parseExamHistory(JSON.stringify(all), [paper], 2_000)).toEqual(history)
  expect(saveExamAttempt(history, history.attempts['attempt-34'])).toBe(history)
})

test('ignores stale or invalid answer actions before applying timeout to the current paper', () => {
  const started = startExam(paper, 1_000, 'attempt-new')
  const otherPaper = { ...paper, id: 'n3-other' }
  expect(answerExam(otherPaper, started, 'vocabulary-1', 2, started.deadline)).toBe(started)
  expect(answerExam(paper, started, 'missing', 2, started.deadline)).toBe(started)
  expect(answerExam(paper, started, 'vocabulary-1', 5 as 1, started.deadline)).toBe(started)
  expect(answerExam(paper, started, 'vocabulary-1', 2, Number.NaN)).toBe(started)
})

test('ships all six source written exams with valid, distinct question mappings and no answer-key pages in the active viewer', () => {
  expect(examSource.filename).toBe('de_thi_cac_nam.pdf')
  expect(examSource.pageCount).toBe(189)
  expect(examSource.sha256).toMatch(/^[a-f0-9]{64}$/)
  expect(examSource.answerKeyKind).toBe('reviewed-practice')
  expect(examPapers.map((sourcePaper) => sourcePaper.id).sort()).toEqual(['n3-2022-07', 'n3-2022-12', 'n3-2023-07', 'n3-2023-12', 'n3-2024-07', 'n3-2024-12'])
  for (const sourcePaper of examPapers) {
    expect(sourcePaper.level).toBe('N3')
    expect(sourcePaper.durationMinutes).toBe(sourcePaper.sections.reduce((minutes, section) => minutes + section.durationMinutes, 0))
    expect(sourcePaper.sections.map((section) => section.id)).toEqual(['vocabulary', 'grammar-reading'])
    const ids: string[] = []
    for (const section of sourcePaper.sections) {
      expect(section.questions.length).toBeGreaterThan(0)
      expect(section.questions.map((question) => question.number)).toEqual(Array.from({ length: section.questions.length }, (_, index) => index + 1))
      expect(new Set(section.pages).size).toBe(section.pages.length)
      for (const page of section.pages) {
        expect(Number.isInteger(page) && page >= 1 && page <= examSource.pageCount).toBe(true)
        expect(sourcePaper.answerKeyPages).not.toContain(page)
        expect(existsSync(resolve('public/exams/pages', `${String(page).padStart(3, '0')}.webp`))).toBe(true)
      }
      for (const question of section.questions) {
        ids.push(question.id)
        expect(section.pages).toContain(question.page)
        expect(question.choices).toBe(4)
        expect(question.answer === null || [1, 2, 3, 4].includes(question.answer)).toBe(true)
        if (question.answer === null) expect(question.note?.trim().length).toBeGreaterThan(0)
      }
    }
    expect(new Set(ids).size).toBe(ids.length)
  }
})
