// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { LanguageProvider } from './i18n'
import { ExamMode } from './ExamMode'
import { activateUserData, deactivateUserData } from './accountData'

afterEach(() => {
  cleanup()
  deactivateUserData()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

const renderExam = () => render(<LanguageProvider><ExamMode onClose={() => {}} /></LanguageProvider>)

vi.mock('./examData', () => ({
  examSource: { filename: 'de_thi_cac_nam.pdf', sha256: 'test', pageCount: 189, answerKeyKind: 'reviewed-practice' },
  examPapers: [{
    id: 'n3-2022-07', level: 'N3', year: 2022, month: 7, durationMinutes: 100, answerKeyPages: [9],
    sections: [
      { id: 'vocabulary', durationMinutes: 30, pages: [1, 2], questions: [
        { id: 'vocabulary-1', number: 1, answer: 2, page: 1, choices: 4 },
        { id: 'vocabulary-2', number: 2, answer: 4, page: 2, choices: 4 },
      ] },
      { id: 'grammar-reading', durationMinutes: 70, pages: [3, 4], questions: [
        { id: 'grammar-reading-1', number: 1, answer: 1, page: 3, choices: 4, group: 'grammar' },
        { id: 'grammar-reading-2', number: 2, answer: null, page: 4, choices: 4, group: 'reading', note: 'Source question is ambiguous.' },
      ] },
    ],
  }],
}))

test('introduces timed written practice and explains the score and listening limits in both languages', () => {
  renderExam()
  expect(screen.getByRole('heading', { name: 'Exam' })).toBeTruthy()
  expect(screen.getByText(/100 minutes/)).toBeTruthy()
  expect(screen.getByText(/Listening is excluded/)).toBeTruthy()
  expect(screen.getByText(/practice percentage/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Tiếng Việt' }))
  expect(screen.getByRole('heading', { name: 'Thi thử' })).toBeTruthy()
  expect(screen.getByText(/Không có phần nghe/)).toBeTruthy()
})

test('keeps keys hidden until confirmed submission, scores written answers, and reviews unscored items separately', () => {
  renderExam()
  fireEvent.click(screen.getByRole('button', { name: 'Start exam' }))
  expect(screen.getByRole('timer').textContent).toBe('100:00')
  expect(screen.queryByText('Correct answer')).toBeNull()
  expect(screen.queryByText('Source question is ambiguous.')).toBeNull()
  expect((screen.getByRole('img', { name: /Source page 1/ }) as HTMLImageElement).src).toContain('/exams/pages/001.webp')
  expect(screen.queryByRole('option', { name: 'Source page 9' })).toBeNull()
  const pageScroll = screen.getByRole('img').parentElement!
  pageScroll.scrollTop = 200
  fireEvent.click(screen.getByRole('button', { name: 'View question Grammar and reading question 1' }))
  expect((screen.getByRole('img', { name: /Source page 3/ }) as HTMLImageElement).src).toContain('/exams/pages/003.webp')
  expect(pageScroll.scrollTop).toBe(0)
  fireEvent.click(screen.getByRole('radio', { name: 'Vocabulary question 1, choice 2' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Grammar and reading question 1, choice 3' }))
  fireEvent.click(screen.getByRole('button', { name: 'Submit exam' }))
  expect(screen.queryByRole('heading', { name: 'Your result' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Submit and see score' }))
  expect(screen.getByRole('heading', { name: 'Your result' })).toBeTruthy()
  expect(screen.getByText('1 / 3')).toBeTruthy()
  expect(screen.getByText('33%')).toBeTruthy()
  expect(screen.getByText('Source question is ambiguous.')).toBeTruthy()
  const review = screen.getByRole('region', { name: 'Answer review' })
  expect(within(review).getByText('Not scored — source ambiguity')).toBeTruthy()
  expect(screen.queryByRole('radio')).toBeNull()
})

test('resumes the saved absolute deadline after reopening and auto submits on wake even while confirming', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-12T12:00:00Z'))
  const startedAt = Date.now()
  renderExam()
  fireEvent.click(screen.getByRole('button', { name: 'Start exam' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Vocabulary question 1, choice 2' }))
  cleanup()
  vi.setSystemTime(startedAt + 5 * 60_000)
  renderExam()
  expect(screen.getByRole('timer').textContent).toBe('95:00')
  expect((screen.getByRole('radio', { name: 'Vocabulary question 1, choice 2' }) as HTMLInputElement).checked).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Submit exam' }))
  vi.setSystemTime(startedAt + 100 * 60_000 + 1_000)
  act(() => { document.dispatchEvent(new Event('visibilitychange')) })
  expect(screen.getByRole('heading', { name: 'Your result' })).toBeTruthy()
  expect(screen.getByText(/submitted automatically/)).toBeTruthy()
  expect(screen.queryByRole('alertdialog')).toBeNull()
  expect(screen.getByText('1 / 3')).toBeTruthy()
  const saved = JSON.parse(window.localStorage.getItem('mimikara-exams-v1')!)
  expect(Object.values(saved.attempts)[0]).toMatchObject({ startedAt, deadline: startedAt + 100 * 60_000, submittedAt: startedAt + 100 * 60_000, reason: 'timeout' })
})

test('persists an account attempt that expires while the exam screen is closed', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-12T12:00:00Z'))
  const deadline = Date.now() - 1_000
  const remote = JSON.stringify({ version: 1, attempts: { closed: {
    id: 'closed', paperId: 'n3-2022-07', startedAt: deadline - 100 * 60_000, deadline,
    answers: { 'vocabulary-1': 2 }, submittedAt: null, reason: null,
  } } })
  const fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => new Response(JSON.stringify({ values: init.method === 'PATCH' ? JSON.parse(init.body as string).values : { 'mimikara-exams-v1': remote } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetch)
  await activateUserData('exam-account')
  renderExam()
  expect(screen.getByRole('heading', { name: 'Your result' })).toBeTruthy()
  await act(async () => { await vi.advanceTimersByTimeAsync(400) })
  expect(fetch).toHaveBeenCalledTimes(2)
  const patch = fetch.mock.calls.find(([, init]) => init.method === 'PATCH')!
  const saved = JSON.parse(JSON.parse(patch[1].body as string).values['mimikara-exams-v1'])
  expect(saved.attempts.closed).toMatchObject({ deadline, submittedAt: deadline, reason: 'timeout' })
})

test('does not count an ambiguous source question twice in the result breakdown', () => {
  renderExam()
  fireEvent.click(screen.getByRole('button', { name: 'Start exam' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Vocabulary question 1, choice 2' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Grammar and reading question 1, choice 3' }))
  fireEvent.click(screen.getByRole('button', { name: 'Submit exam' }))
  fireEvent.click(screen.getByRole('button', { name: 'Submit and see score' }))
  const result = screen.getByRole('region', { name: 'Written practice score' })
  expect(result.textContent).toContain('Unanswered: 1')
  expect(result.textContent).toContain('Not scored: 1')
})
