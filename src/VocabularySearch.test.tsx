// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { LanguageProvider } from './i18n'
import { VocabularySearch } from './VocabularySearch'
afterEach(() => { cleanup(); localStorage.clear() })
test('shows results for accentless meanings, supports keyboard selection and closes on Escape', async () => {
  const select = vi.fn()
  render(<LanguageProvider><VocabularySearch onSelect={select} /></LanguageProvider>)
  const input = screen.getByRole('searchbox', { name: 'Search all vocabulary' })
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'dan ong' } })
  const result = await screen.findByRole('button', { name: /男性/ })
  fireEvent.keyDown(input, { key: 'ArrowDown' })
  expect(document.activeElement).toBe(result)
  fireEvent.keyDown(result, { key: 'Escape' })
  expect(input.getAttribute('aria-expanded')).toBe('false')
  expect(document.activeElement).toBe(input)
  fireEvent.change(input, { target: { value: 'だんせい' } })
  fireEvent.click(await screen.findByRole('button', { name: /男性/ }))
  expect(select).toHaveBeenCalledWith(expect.objectContaining({ id: 'n3:1', source: 'N3' }))
  expect(screen.queryByRole('region')).toBeNull()
})
test('shows an empty state and clears the query', async () => {
  render(<LanguageProvider><VocabularySearch /></LanguageProvider>)
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzznomatchzzzz' } })
  expect(await screen.findByText('No matching vocabulary.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
  await waitFor(() => expect(screen.getByRole('searchbox').getAttribute('value')).toBe(''))
  expect(await screen.findByText(/Type Kanji/)).toBeTruthy()
})
