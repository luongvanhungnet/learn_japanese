// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'

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
  expect(screen.getByText('Câu 1 / 30')).toBeTruthy()
})
