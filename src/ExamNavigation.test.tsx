// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'
import { speedQuestions } from './speedExamData'

vi.mock('./data/n3.json', () => ({ default: [{
  id: 'n3:1', level: 'N3', order: 1, headword: '男性', reading: 'だんせい', hanViet: 'NAM TÍNH', meanings: ['man'],
}] }))
vi.mock('./ExamMode', () => ({ ExamMode: ({ onClose }: { onClose: () => void }) => <main>
  <h1>Exam papers</h1><button onClick={onClose}>Back to study</button>
</main> }))
afterEach(() => { cleanup(); localStorage.clear(); window.history.replaceState(null, '', '/') })

test('opens Exam from study controls and returns to study', async () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Exam' }))
  expect(await screen.findByRole('heading', { name: 'Exam papers' })).toBeTruthy()
  expect(window.location.hash).toBe('#exam')
  fireEvent.click(screen.getByRole('button', { name: 'Back to study' }))
  expect(screen.getByRole('button', { name: 'Word list' })).toBeTruthy()
  expect(window.location.hash).toBe('')
})

test('opens speed practice from study controls and returns to study', async () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Ôn thi thần tốc' }))
  expect(await screen.findByRole('heading', { name: 'Ôn thi thần tốc' })).toBeTruthy()
  expect(window.location.hash).toBe('#speed-exam')
  fireEvent.click(screen.getByRole('button', { name: '← Back to study' }))
  expect(screen.getByRole('button', { name: 'Word list' })).toBeTruthy()
  expect(window.location.hash).toBe('')
})

test('opens speed practice directly from its hash', async () => {
  window.history.replaceState(null, '', '/#speed-exam')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Ôn thi thần tốc' })).toBeTruthy()
  expect(screen.getByText(`Câu 1 / ${speedQuestions.length}`)).toBeTruthy()
})

test('production bank shows computed counts and filters 600 questions by listening task family', async () => {
  window.history.replaceState(null, '', '/#speed-exam')
  render(<App />)
  await screen.findByRole('heading', { name: 'Ôn thi thần tốc' })
  fireEvent.click(screen.getByText(/Filter · Lọc câu hỏi/))
  expect(screen.getByRole('checkbox', { name: 'Toàn bộ từ vựng (200)' })).toBeTruthy()
  expect(screen.getByRole('checkbox', { name: 'Toàn bộ ngữ pháp (120)' })).toBeTruthy()
  expect(screen.getByRole('checkbox', { name: 'Toàn bộ đọc hiểu (120)' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Bỏ chọn tất cả' }))
  expect(screen.getByRole('button', { name: `Chọn tất cả ${speedQuestions.length} câu` })).toBeTruthy()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Toàn bộ nghe hiểu (160)' }))
  expect(screen.getByText('Câu 1 / 160')).toBeTruthy()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Hiểu nhiệm vụ (40)' }))
  expect(screen.getByText('Câu 1 / 120')).toBeTruthy()
})
