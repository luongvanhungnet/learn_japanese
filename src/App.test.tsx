// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'

vi.mock('./data/n3.json', () => ({ default: [
  { id: 'n3:1', level: 'N3', order: 1, headword: '男性', reading: 'だんせい', hanViet: 'NAM TÍNH', meanings: ['man'] },
  { id: 'n3:2', level: 'N3', order: 2, headword: '女性', reading: 'じょせい', hanViet: 'NỮ TÍNH', meanings: ['woman'] },
] }))
vi.mock('./data/n2.json', () => ({ default: [
  { id: 'n2:1', level: 'N2', order: 1, headword: '男性', reading: 'だんせい', hanViet: 'NAM TÍNH', meanings: ['man'] },
] }))
vi.mock('./data/vi.json', () => ({ default: {
  N3: { 'n3:1': ['đàn ông'], 'n3:2': ['phụ nữ'] },
  N2: { 'n2:1': ['đàn ông'] },
} }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
  window.localStorage.clear()
})

test('switches UI and accepted meanings to Vietnamese and remembers the language', () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Tiếng Việt' }))
  expect(screen.getByRole('columnheader', { name: 'Ngữ nghĩa' })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: 'Hán Việt' })).toBeTruthy()
  expect(document.documentElement.lang).toBe('vi')
  fireEvent.click(screen.getByRole('button', { name: 'Nhập Ngữ nghĩa cho từ số 1' }))
  const input = screen.getByRole('textbox', { name: 'Ngữ nghĩa cho từ số 1' })
  fireEvent.change(input, { target: { value: 'man' } })
  fireEvent.submit(input.closest('form')!)
  expect(screen.getByRole('alert').textContent).toContain('Chưa đúng')
  fireEvent.change(input, { target: { value: 'dan ong' } })
  fireEvent.submit(input.closest('form')!)
  expect(document.getElementById('practice-n3:1:meaning')!.textContent).toBe('dan ong✓')
  cleanup()
  render(<App />)
  expect(screen.getByRole('columnheader', { name: 'Ngữ nghĩa' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Tiếng Việt' }).getAttribute('aria-pressed')).toBe('true')
})

test('keeps meaning practice separate by language while sharing reading and Hán Việt progress', () => {
  window.localStorage.setItem('mimikara-progress-v1', JSON.stringify({
    'n3:1:meaning': { solved: true, unresolved: false, revealed: false, hints: 0, answer: 'man' },
    'n3:1:reading': { solved: true, unresolved: false, revealed: false, hints: 0, answer: 'だんせい' },
    'n3:1:hanViet': { solved: true, unresolved: false, revealed: false, hints: 0, answer: 'NAM TÍNH' },
  }))
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Tiếng Việt' }))
  expect(document.getElementById('practice-n3:1:reading')!.textContent).toBe('だんせい✓')
  expect(document.getElementById('practice-n3:1:hanViet')!.textContent).toBe('NAM TÍNH✓')
  fireEvent.click(screen.getByRole('button', { name: 'Nhập Ngữ nghĩa cho từ số 1' }))
  const input = screen.getByRole('textbox', { name: 'Ngữ nghĩa cho từ số 1' })
  fireEvent.change(input, { target: { value: 'đàn ông' } })
  fireEvent.submit(input.closest('form')!)
  fireEvent.click(screen.getByRole('button', { name: 'English' }))
  expect(document.getElementById('practice-n3:1:meaning')!.textContent).toBe('man✓')
  cleanup()
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Tiếng Việt' }))
  expect(document.getElementById('practice-n3:1:meaning')!.textContent).toBe('đàn ông✓')
})

test('switches focus mode, hints, answer previews, and overview labels together', () => {
  window.scrollTo = vi.fn()
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Focus' }))
  fireEvent.click(screen.getByRole('button', { name: 'Enter Meaning for 男性' }))
  fireEvent.click(screen.getByRole('button', { name: 'Tiếng Việt' }))
  expect(screen.queryByRole('textbox')).toBeNull()
  fireEvent.keyDown(document, { key: 'a', altKey: true })
  const first = within(screen.getByRole('group', { name: 'Từ 男性' }))
  expect(first.getByText(/Gợi ý:/).textContent).toContain('đ')
  fireEvent.click(first.getByRole('button', { name: /Đáp án/ }))
  expect(first.getByRole('status').textContent).toBe('đàn ông')
  fireEvent.click(screen.getByRole('button', { name: /Danh sách đầy đủ/ }))
  fireEvent.click(screen.getByRole('button', { name: /Tổng quan/ }))
  expect(screen.getByRole('dialog', { name: 'Tổng quan N3' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Đóng tổng quan' }))
  fireEvent.click(screen.getByRole('button', { name: 'English' }))
  fireEvent.click(screen.getByRole('button', { name: /Review mistakes/ }))
  expect(screen.getByRole('heading', { name: 'No mistakes left to review' })).toBeTruthy()
})

test('scrolls the table so the next input replaces the submitted input on screen', async () => {
  vi.useFakeTimers()
  render(<App />)
  const viewport = document.querySelector<HTMLElement>('.table-viewport')!
  viewport.scrollBy = vi.fn()
  fireEvent.click(screen.getByRole('button', { name: 'Enter Reading for word 1' }))
  const first = screen.getByRole('textbox', { name: 'Reading for word 1' })
  vi.spyOn(first, 'getBoundingClientRect').mockReturnValue({ top: 240 } as DOMRect)
  const geometry = vi.spyOn(HTMLInputElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 320 } as DOMRect)
  fireEvent.change(first, { target: { value: 'だんせい' } })
  fireEvent.submit(first.closest('form')!)
  await act(async () => { vi.advanceTimersByTime(20) })
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Reading for word 2' }))
  expect(viewport.scrollBy).toHaveBeenCalledWith({ top: 80, behavior: 'smooth' })
  geometry.mockRestore()
})

test('scrolls the page in focus mode only after a correct answer', async () => {
  vi.useFakeTimers()
  window.scrollTo = vi.fn()
  window.scrollBy = vi.fn()
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Focus' }))
  fireEvent.click(screen.getByRole('button', { name: 'Enter Meaning for 男性' }))
  const first = screen.getByRole('textbox', { name: 'Meaning for 男性' })
  vi.spyOn(first, 'getBoundingClientRect').mockReturnValue({ top: 240 } as DOMRect)
  vi.spyOn(HTMLInputElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 340 } as DOMRect)
  fireEvent.change(first, { target: { value: 'wrong' } })
  fireEvent.submit(first.closest('form')!)
  await act(async () => { vi.advanceTimersByTime(20) })
  expect(window.scrollBy).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(first)
  fireEvent.change(first, { target: { value: 'man' } })
  fireEvent.submit(first.closest('form')!)
  await act(async () => { vi.advanceTimersByTime(20) })
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Meaning for 女性' }))
  expect(window.scrollBy).toHaveBeenCalledWith({ top: 100, behavior: 'smooth' })
})

test('shows English meanings for saved Vietnamese answers and preserves accepted English answers and Hán Việt', () => {
  window.localStorage.setItem('mimikara-progress-v1', JSON.stringify({
    'n3:1:meaning': { solved: true, unresolved: false, revealed: false, hints: 0, answer: 'đàn ông' },
    'n3:2:meaning': { solved: true, unresolved: false, revealed: false, hints: 0, answer: 'WOMAN' },
    'n3:1:hanViet': { solved: true, unresolved: false, revealed: false, hints: 0, answer: 'NAM TÍNH' },
  }))
  render(<App />)
  expect(document.getElementById('practice-n3:1:meaning')!.textContent).toBe('man✓')
  expect(document.getElementById('practice-n3:2:meaning')!.textContent).toBe('WOMAN✓')
  expect(document.getElementById('practice-n3:1:hanViet')!.textContent).toBe('NAM TÍNH✓')
  expect(screen.getByRole('columnheader', { name: 'Hán Việt' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Overview/ }))
  expect(screen.getByRole('dialog', { name: 'N3 overview' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Go to word 1: 男性' })).toBeTruthy()
})

test('focus practice clears mistakes, previews briefly, and advances after a correct answer', async () => {
  window.scrollTo = vi.fn()
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Focus' }))

  const first = within(screen.getByRole('group', { name: 'Word 男性' }))
  fireEvent.click(first.getByRole('button', { name: 'Enter Meaning for 男性' }))
  const input = first.getByRole('textbox', { name: 'Meaning for 男性' }) as HTMLInputElement

  fireEvent.change(input, { target: { value: 'wrong' } })
  fireEvent.submit(input.closest('form')!)
  expect(input.value).toBe('')
  expect(document.activeElement).toBe(input)
  expect(first.getByRole('alert').textContent).toContain('Incorrect')

  fireEvent.keyDown(input, { key: 'a', altKey: true })
  expect(first.getByText(/Hint:/).textContent).toContain('m')

  vi.useFakeTimers()
  fireEvent.keyDown(input, { key: 's', altKey: true })
  expect(first.getByRole('status').textContent).toContain('man')
  expect(document.activeElement).toBe(input)
  await act(async () => { vi.advanceTimersByTime(1000) })
  expect(first.queryByRole('status')).toBeNull()
  expect(document.activeElement).toBe(input)
  vi.useRealTimers()

  fireEvent.change(input, { target: { value: 'man' } })
  fireEvent.submit(input.closest('form')!)
  const second = within(screen.getByRole('group', { name: 'Word 女性' }))
  expect(document.activeElement).toBe(second.getByRole('textbox', { name: 'Meaning for 女性' }))
})

test('the full table advances within the same column and answer button keeps typing focus', () => {
  render(<App />)
  const first = within(document.getElementById('practice-n3:1:reading')!)
  fireEvent.click(first.getByRole('button', { name: 'Enter Reading for word 1' }))
  const input = first.getByRole('textbox', { name: 'Reading for word 1' }) as HTMLInputElement
  fireEvent.click(first.getByRole('button', { name: /Answer/ }))
  expect(first.getByRole('status').textContent).toBe('だんせい')
  expect(document.activeElement).toBe(input)

  fireEvent.change(input, { target: { value: 'ダンセイ' } })
  fireEvent.submit(input.closest('form')!)
  const second = within(document.getElementById('practice-n3:2:reading')!)
  expect(document.activeElement).toBe(second.getByRole('textbox', { name: 'Reading for word 2' }))
})

test('Alt shortcuts work immediately in focus mode before opening a cell', () => {
  window.scrollTo = vi.fn()
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Focus' }))

  fireEvent.keyDown(document, { key: 'a', altKey: true })
  const first = within(screen.getByRole('group', { name: 'Word 男性' }))
  const input = first.getByRole('textbox', { name: 'Meaning for 男性' })
  expect(first.getByText(/Hint:/).textContent).toContain('m')
  expect(document.activeElement).toBe(input)

  fireEvent.keyDown(document, { key: 's', altKey: true })
  expect(first.getByRole('status').textContent).toContain('man')
  expect(document.activeElement).toBe(input)
})

test('Alt+S opens the current practice cell directly', () => {
  window.scrollTo = vi.fn()
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Focus' }))

  fireEvent.keyDown(document, { key: 's', altKey: true })
  const first = within(screen.getByRole('group', { name: 'Word 男性' }))
  expect(first.getByRole('status').textContent).toContain('man')
  expect(document.activeElement).toBe(first.getByRole('textbox', { name: 'Meaning for 男性' }))
})
