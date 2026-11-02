// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { LanguageProvider } from './i18n'
import { GameMode } from './GameMode'
import { gameCards } from './game'
afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); vi.restoreAllMocks() })
test('plays a run, rejects repeated answers, awards once, unlocks cards and persists', () => {
  vi.useFakeTimers()
  render(<LanguageProvider><GameMode onClose={() => {}} /></LanguageProvider>)
  fireEvent.click(screen.getByRole('button', { name: /Start playing/ }))
  const word = document.querySelector('.game-question h2')?.textContent
  const card = gameCards.find(c => c.word === word)!
  const correct = screen.getByRole('button', { name: card.en })
  fireEvent.click(correct); fireEvent.click(correct)
  expect(screen.getByText('✓ Correct!')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Finish & collect rewards' }))
  expect(screen.getByText('+12 EXP')).toBeTruthy()
  expect(screen.getByText('✓ 1/1')).toBeTruthy()
  expect(screen.getByText('New cards unlocked')).toBeTruthy()
  const saved = JSON.parse(localStorage.getItem('mimikara-game-v1')!)
  expect(saved.xp).toBe(12)
  expect(saved.unlocked).toHaveLength(2)
  act(() => vi.advanceTimersByTime(70000))
  expect(JSON.parse(localStorage.getItem('mimikara-game-v1')!).xp).toBe(12)
})
test('question timeouts reset combo and session ends automatically without rewards for no answers', () => {
  vi.useFakeTimers()
  render(<LanguageProvider><GameMode onClose={() => {}} /></LanguageProvider>)
  fireEvent.click(screen.getByRole('button', { name: /Start playing/ }))
  act(() => vi.advanceTimersByTime(10100))
  expect(screen.getByText('Keep learning!')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Next question/ }))
  act(() => vi.advanceTimersByTime(50000))
  expect(screen.getByText('Well played!')).toBeTruthy()
  expect(screen.getByText('+0 EXP')).toBeTruthy()
  expect(screen.queryByText('New cards unlocked')).toBeNull()
})
test('requires three selected cards and lets the user return to study', () => {
  const close = vi.fn()
  render(<LanguageProvider><GameMode onClose={close} /></LanguageProvider>)
  fireEvent.click(screen.getByRole('button', { name: /水/ }))
  fireEvent.click(screen.getByRole('button', { name: /注文/ }))
  expect((screen.getByRole('button', { name: /Start playing/ }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: /Back to study/ }))
  expect(close).toHaveBeenCalledOnce()
})
