// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { LanguageProvider } from './i18n'
import { SpeedExamMode } from './SpeedExamMode'
import { speedQuestions } from './speedExamData'

// A compact bank keeps keyboard/timer tests independent of the production bank size.
vi.mock('./speedExamData', async () => {
  const { default: questions } = await import('./test/fixtures/speedExam.json')
  return { speedQuestions: questions }
})

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })
const mount = () => render(<LanguageProvider><SpeedExamMode onClose={() => {}} /></LanguageProvider>)
const advance = () => act(() => { vi.advanceTimersByTime(2000) })

test('has 30 original questions, four choices and all N3 task families', () => {
  expect(new Set(speedQuestions.map(q => q.id)).size).toBe(30)
  for (const [section, count, kinds] of [['vocabulary', 5, 5], ['grammar', 5, 3], ['reading', 10, 3], ['listening', 10, 4]] as const) {
    const questions = speedQuestions.filter(q => q.section === section)
    expect(questions).toHaveLength(count)
    // Reading labels additionally describe the comprehension skill being practised.
    expect(new Set(questions.map(q => q.kind.split(' · ')[0])).size).toBe(kinds)
  }
  for (const q of speedQuestions) {
    expect(q.choices).toHaveLength(4)
    expect(new Set(q.choices).size).toBe(4)
    expect(q.answer).toBeGreaterThanOrEqual(0)
    expect(q.answer).toBeLessThan(4)
    expect(q.explanation).toBeTruthy()
    if (q.section === 'listening') expect(q.audioText).toBeTruthy()
  }
})

test('wrong answer resets at 2s; correct answer advances only at 2s; rapid inputs are locked', () => {
  vi.useFakeTimers()
  mount()
  fireEvent.click(screen.getByRole('button', { name: /B ↑/ }))
  expect(screen.getByRole('button', { name: /B ↑/ }).className).toBe('incorrect')
  fireEvent.keyDown(window, { key: 'ArrowLeft' })
  act(() => { vi.advanceTimersByTime(1999) })
  expect(screen.getByText('Câu 1 / 30')).toBeTruthy()
  expect(screen.getByRole('button', { name: /B ↑/ }).hasAttribute('disabled')).toBe(true)
  act(() => { vi.advanceTimersByTime(1) })
  expect(screen.getByRole('button', { name: /B ↑/ }).className).toBe('')
  expect(screen.getByRole('button', { name: /B ↑/ }).hasAttribute('disabled')).toBe(false)
  fireEvent.keyDown(window, { key: 'ArrowLeft' })
  expect(screen.getByRole('button', { name: /A ←/ }).className).toBe('correct')
  act(() => { vi.advanceTimersByTime(1999) })
  expect(screen.getByText('Câu 1 / 30')).toBeTruthy()
  act(() => { vi.advanceTimersByTime(1) })
  expect(screen.getByText('Câu 2 / 30')).toBeTruthy()
})

test('all arrows select ABCD; completes the full set and can restart', () => {
  vi.useFakeTimers()
  mount()
  const arrows = ['ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight']
  for (const q of speedQuestions) {
    fireEvent.keyDown(window, { key: arrows[q.answer], repeat: true })
    expect(document.querySelector('.correct')).toBeNull()
    fireEvent.keyDown(window, { key: arrows[q.answer] })
    expect(document.querySelector('.correct')).toBeTruthy()
    advance()
  }
  expect(screen.getByRole('heading', { name: 'Hoàn thành 30 câu!' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Luyện lại' }))
  expect(screen.getByText('Câu 1 / 30')).toBeTruthy()
})

test('listening speaks Japanese without displaying its transcript and cancels on exit', () => {
  vi.useFakeTimers()
  const speak = vi.fn(), cancel = vi.fn()
  vi.stubGlobal('speechSynthesis', { speak, cancel, getVoices: () => [{ lang: 'ja-JP' }] })
  vi.stubGlobal('SpeechSynthesisUtterance', class { text: string; constructor(text: string) { this.text = text } })
  const view = mount()
  for (const q of speedQuestions.slice(0, 20)) {
    fireEvent.keyDown(window, { key: ['ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight'][q.answer] })
    advance()
  }
  expect(screen.queryByText(speedQuestions[20].audioText!)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Nghe câu hỏi/ }))
  expect(speak).toHaveBeenCalledWith(expect.objectContaining({ lang: 'ja-JP', text: speedQuestions[20].audioText }))
  view.unmount()
  expect(cancel).toHaveBeenCalled()
})

test('cleans up pending transitions on unmount', () => {
  vi.useFakeTimers()
  const view = mount()
  fireEvent.keyDown(window, { key: 'ArrowLeft' })
  view.unmount()
  expect(vi.getTimerCount()).toBe(0)
})

test('filters by section and type, handles empty selection and completes only the selected questions', () => {
  vi.useFakeTimers()
  mount()
  fireEvent.click(screen.getByText(/Filter · Lọc câu hỏi/))
  fireEvent.click(screen.getByRole('button', { name: 'Bỏ chọn tất cả' }))
  expect(screen.getByRole('heading', { name: 'Chưa chọn dạng câu hỏi' })).toBeTruthy()
  fireEvent.keyDown(window, { key: 'ArrowLeft' })
  advance()
  expect(screen.getByRole('heading', { name: 'Chưa chọn dạng câu hỏi' })).toBeTruthy()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Toàn bộ ngữ pháp (5)' }))
  expect(screen.getByText('Câu 1 / 5')).toBeTruthy()
  expect(screen.getByRole('heading', { name: speedQuestions[5].prompt })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Bỏ chọn tất cả' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Sắp xếp câu ★ (1)' }))
  expect(screen.getByText('Câu 1 / 1')).toBeTruthy()
  fireEvent.keyDown(window, { key: 'ArrowRight' })
  advance()
  expect(screen.getByRole('heading', { name: 'Hoàn thành 1 câu!' })).toBeTruthy()
  expect(screen.getByRole('progressbar').getAttribute('max')).toBe('1')
  fireEvent.click(screen.getByRole('button', { name: 'Luyện lại' }))
  expect(screen.getByText('Câu 1 / 1')).toBeTruthy()
})

test('changing sort or filter cancels pending feedback and starts the new selection at question one', () => {
  vi.useFakeTimers()
  mount()
  fireEvent.keyDown(window, { key: 'ArrowLeft' })
  fireEvent.change(screen.getByRole('combobox', { name: 'Sort · Sắp xếp' }), { target: { value: 'reverse' } })
  expect(screen.getByRole('heading', { name: speedQuestions[29].prompt })).toBeTruthy()
  expect(document.querySelector('.correct')).toBeNull()
  advance()
  expect(screen.getByText('Câu 1 / 30')).toBeTruthy()
  fireEvent.click(screen.getByText(/Filter · Lọc câu hỏi/))
  fireEvent.click(screen.getByRole('button', { name: 'Bỏ chọn tất cả' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Cách đọc kanji (1)' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn cách viết (1)' }))
  expect(screen.getByText('Câu 1 / 2')).toBeTruthy()
  expect(screen.getByRole('heading', { name: speedQuestions[1].prompt })).toBeTruthy()
  const input = screen.getByRole('checkbox', { name: 'Toàn bộ từ vựng (5)' }) as HTMLInputElement
  expect(input.indeterminate).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Chọn tất cả' }))
  expect(screen.getByText('Câu 1 / 30')).toBeTruthy()
})

test('jumps to a numbered question and cancels pending automatic advancement', () => {
  vi.useFakeTimers()
  mount()
  fireEvent.keyDown(window, { key: 'ArrowLeft' })
  fireEvent.click(screen.getByRole('button', { name: 'Câu 1 / 30' }))
  const input = screen.getByRole('spinbutton', { name: 'Chuyển tới câu' })
  fireEvent.change(input, { target: { value: '12' } })
  fireEvent.keyDown(input, { key: 'ArrowRight' })
  fireEvent.click(screen.getByRole('button', { name: 'Chuyển' }))
  expect(screen.getByRole('button', { name: 'Câu 12 / 30' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: speedQuestions[11].prompt })).toBeTruthy()
  expect(document.querySelector('.correct')).toBeNull()
  advance()
  expect(screen.getByText('Câu 12 / 30')).toBeTruthy()
  fireEvent.keyDown(window, { key: ['ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight'][speedQuestions[11].answer] })
  advance()
  expect(screen.getByText('Câu 13 / 30')).toBeTruthy()
})

test('validates jump bounds and uses the filtered and sorted question positions', () => {
  mount()
  fireEvent.change(screen.getByRole('combobox', { name: 'Sort · Sắp xếp' }), { target: { value: 'reverse' } })
  fireEvent.click(screen.getByText(/Filter · Lọc câu hỏi/))
  fireEvent.click(screen.getByRole('button', { name: 'Bỏ chọn tất cả' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Toàn bộ từ vựng (5)' }))
  fireEvent.click(screen.getByRole('button', { name: 'Câu 1 / 5' }))
  const input = screen.getByRole('spinbutton', { name: 'Chuyển tới câu' })
  for (const value of ['', '0', '6', '1.5', '-1']) {
    fireEvent.change(input, { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: 'Chuyển' }))
    expect(screen.getByRole('alert').textContent).toBe('Nhập số nguyên từ 1 đến 5.')
    expect(screen.getByText('Câu 1 / 5')).toBeTruthy()
  }
  fireEvent.change(input, { target: { value: '5' } })
  fireEvent.click(screen.getByRole('button', { name: 'Chuyển' }))
  expect(screen.getByText('Câu 5 / 5')).toBeTruthy()
  expect(screen.getByRole('heading', { name: speedQuestions[0].prompt })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Câu 5 / 5' }))
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
  expect(screen.queryByRole('spinbutton')).toBeNull()
  expect(screen.getByText('Câu 5 / 5')).toBeTruthy()
})
