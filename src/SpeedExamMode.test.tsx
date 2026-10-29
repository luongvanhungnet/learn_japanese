// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { LanguageProvider } from './i18n'
import { SpeedExamMode } from './SpeedExamMode'
import { speedQuestions } from './speedExamData'

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
