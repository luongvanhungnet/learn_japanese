// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { LanguageProvider } from './i18n'
import { GameMode } from './GameMode'
afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers() })
test('plants, grows, harvests, upgrades and persists the garden alongside previous progress', () => {
  vi.useFakeTimers()
  localStorage.setItem('mimikara-game-v1', JSON.stringify({ xp: 120, coins: 40, unlocked: [], records: { best: 200 } }))
  const mount = () => render(<LanguageProvider><GameMode onClose={() => {}} /></LanguageProvider>)
  const view = mount()
  const plot = screen.getByRole('article', { name: 'Plot 1' })
  fireEvent.click(within(plot).getByRole('button', { name: /Plant/ }))
  let saved = JSON.parse(localStorage.getItem('mimikara-game-v1')!)
  expect(saved.coins).toBe(37)
  expect(within(plot).getByRole('button', { name: /Harvest/ }).hasAttribute('disabled')).toBe(true)
  act(() => vi.advanceTimersByTime(60000))
  fireEvent.click(within(plot).getByRole('button', { name: /Harvest/ }))
  fireEvent.click(screen.getByRole('button', { name: /Upgrade/ }))
  saved = JSON.parse(localStorage.getItem('mimikara-game-v1')!)
  expect(saved.coins).toBe(5)
  expect(saved.garden.baseLevel).toBe(2)
  expect(saved.records.best).toBe(200)
  expect(saved.xp).toBe(120)
  expect(screen.getByRole('button', { name: /Mandarin/ }).hasAttribute('disabled')).toBe(false)
  view.unmount()
  mount()
  expect(screen.getByText('Base · Lv. 2', { exact: false })).toBeTruthy()
  expect(screen.getByRole('article', { name: 'Plot 3' }).textContent).toContain('Plant')
})
