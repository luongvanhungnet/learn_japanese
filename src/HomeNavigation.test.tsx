// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'

afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); vi.restoreAllMocks() })

test('opens speed practice as home and keeps instructions behind help', async () => {
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Ôn thi thần tốc' })).toBeTruthy()
  const help = screen.getByLabelText('Hướng dẫn').closest('details')!
  expect(help.open).toBe(false)
  fireEvent.click(screen.getByLabelText('Hướng dẫn'))
  expect(help.open).toBe(true)
  expect(document.querySelector('.focus-controls.is-visible')).toBeNull()
  fireEvent.mouseMove(window, { clientY: 2 })
  expect(document.querySelector('.focus-controls.is-visible')).toBeTruthy()
  fireEvent.mouseMove(window, { clientY: 900 })
  expect(document.querySelector('.focus-controls.is-visible')).toBeNull()
})

test('shared navigation changes modes and preserves explicit study route', async () => {
  window.scrollTo = vi.fn()
  render(<App />)
  await screen.findByRole('heading', { name: 'Ôn thi thần tốc' })
  fireEvent.click(screen.getByRole('button', { name: /Back to study/ }))
  expect(window.location.hash).toBe('#study')
  expect(screen.getByRole('button', { name: 'Word list' })).toBeTruthy()
  cleanup()
  render(<App />)
  expect(screen.getByRole('button', { name: 'Word list' })).toBeTruthy()
  fireEvent.click(screen.getAllByRole('button', { name: 'Ôn thi thần tốc' })[0])
  expect(await screen.findByRole('heading', { name: 'Ôn thi thần tốc' })).toBeTruthy()
  expect(window.location.hash).toBe('#speed-exam')
})
