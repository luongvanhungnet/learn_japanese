// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'

vi.mock('./data/n3.json', () => ({ default: [
  { id: 'n3:1', level: 'N3', order: 1, headword: '男性', reading: 'だんせい', hanViet: 'NAM TÍNH', meanings: ['đàn ông'] },
  { id: 'n3:2', level: 'N3', order: 2, headword: '女性', reading: 'じょせい', hanViet: 'NỮ TÍNH', meanings: ['phụ nữ'] },
] }))
vi.mock('./data/n2.json', () => ({ default: [
  { id: 'n2:1', level: 'N2', order: 1, headword: '男性', reading: 'だんせい', hanViet: 'NAM TÍNH', meanings: ['đàn ông'] },
] }))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  window.localStorage.clear()
})

test('focus practice clears mistakes, previews briefly, and advances after a correct answer', async () => {
  window.scrollTo = vi.fn()
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Tập trung' }))

  const first = within(screen.getByRole('group', { name: 'Từ 男性' }))
  fireEvent.click(first.getByRole('button', { name: 'Nhập Ngữ nghĩa cho 男性' }))
  const input = first.getByRole('textbox', { name: 'Ngữ nghĩa cho 男性' }) as HTMLInputElement

  fireEvent.change(input, { target: { value: 'không đúng' } })
  fireEvent.submit(input.closest('form')!)
  expect(input.value).toBe('')
  expect(document.activeElement).toBe(input)
  expect(first.getByRole('alert').textContent).toContain('Chưa đúng')

  fireEvent.keyDown(input, { key: 'a', altKey: true })
  expect(first.getByText(/Gợi ý:/).textContent).toContain('đ')

  vi.useFakeTimers()
  fireEvent.keyDown(input, { key: 's', altKey: true })
  expect(first.getByRole('status').textContent).toContain('đàn ông')
  expect(document.activeElement).toBe(input)
  await act(async () => { vi.advanceTimersByTime(1000) })
  expect(first.queryByRole('status')).toBeNull()
  expect(document.activeElement).toBe(input)
  vi.useRealTimers()

  fireEvent.change(input, { target: { value: 'dan ong' } })
  fireEvent.submit(input.closest('form')!)
  const second = within(screen.getByRole('group', { name: 'Từ 女性' }))
  expect(document.activeElement).toBe(second.getByRole('textbox', { name: 'Ngữ nghĩa cho 女性' }))
})

test('the full table advances within the same column and answer button keeps typing focus', () => {
  render(<App />)
  const first = within(document.getElementById('practice-n3:1:reading')!)
  fireEvent.click(first.getByRole('button', { name: 'Nhập Cách đọc cho từ số 1' }))
  const input = first.getByRole('textbox', { name: 'Cách đọc cho từ số 1' }) as HTMLInputElement
  fireEvent.click(first.getByRole('button', { name: /Đáp án/ }))
  expect(first.getByRole('status').textContent).toBe('だんせい')
  expect(document.activeElement).toBe(input)

  fireEvent.change(input, { target: { value: 'ダンセイ' } })
  fireEvent.submit(input.closest('form')!)
  const second = within(document.getElementById('practice-n3:2:reading')!)
  expect(document.activeElement).toBe(second.getByRole('textbox', { name: 'Cách đọc cho từ số 2' }))
})

test('Alt shortcuts work immediately in focus mode before opening a cell', () => {
  window.scrollTo = vi.fn()
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Tập trung' }))

  fireEvent.keyDown(document, { key: 'a', altKey: true })
  const first = within(screen.getByRole('group', { name: 'Từ 男性' }))
  const input = first.getByRole('textbox', { name: 'Ngữ nghĩa cho 男性' })
  expect(first.getByText(/Gợi ý:/).textContent).toContain('đ')
  expect(document.activeElement).toBe(input)

  fireEvent.keyDown(document, { key: 's', altKey: true })
  expect(first.getByRole('status').textContent).toContain('đàn ông')
  expect(document.activeElement).toBe(input)
})

test('Alt+S opens the current practice cell directly', () => {
  window.scrollTo = vi.fn()
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Tập trung' }))

  fireEvent.keyDown(document, { key: 's', altKey: true })
  const first = within(screen.getByRole('group', { name: 'Từ 男性' }))
  expect(first.getByRole('status').textContent).toContain('đàn ông')
  expect(document.activeElement).toBe(first.getByRole('textbox', { name: 'Ngữ nghĩa cho 男性' }))
})
