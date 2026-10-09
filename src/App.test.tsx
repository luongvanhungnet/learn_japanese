// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
beforeEach(() => { vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {}) })

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
  window.history.replaceState(null, '', '/')
})

test('opens flashcard mode from the study toolbar and returns to the list', async () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Flashcard' }))
  expect(await screen.findByRole('heading', { name: 'Flashcard' })).toBeTruthy()
  expect(window.location.hash).toBe('#flashcard')
  fireEvent.click(screen.getByRole('button', { name: 'Back to study' }))
  expect(screen.getByRole('button', { name: 'Word list' })).toBeTruthy()
  expect(window.location.hash).toBe('')
})

test('reopening the flashcard route restores its saved deck', async () => {
  window.localStorage.setItem('mimikara-flashcard-deck-v1', 'N2')
  window.history.replaceState(null, '', '/#flashcard')
  render(<App />)
  expect(await screen.findByText('留学は私の人生を大きく変えました。')).toBeTruthy()
})

test.each([false, true])('resumes the last practice box after reload in its saved collection (focus: %s)', (focused) => {
  window.scrollTo = vi.fn()
  const scroll = vi.fn()
  const original = HTMLElement.prototype.scrollIntoView
  HTMLElement.prototype.scrollIntoView = scroll
  try {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /N2/ }))
    if (focused) fireEvent.click(screen.getByRole('button', { name: 'Focus' }))
    fireEvent.click(within(document.getElementById('practice-n2:1:meaning')!).getByRole('button'))
    cleanup()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Resume last box' }))
    expect(Boolean(document.querySelector('.focus-shell'))).toBe(focused)
    const input = within(document.getElementById('practice-n2:1:meaning')!).getByRole('textbox')
    expect(document.activeElement).toBe(input)
    expect(scroll).toHaveBeenCalledWith({ block: 'center', inline: 'nearest', behavior: 'smooth' })
  } finally {
    HTMLElement.prototype.scrollIntoView = original
  }
})

test('Alt+R resumes the box reached by automatic advance, including a hidden green answer', () => {
  window.scrollTo = vi.fn()
  const original = HTMLElement.prototype.scrollIntoView
  HTMLElement.prototype.scrollIntoView = vi.fn()
  try {
    window.localStorage.setItem('mimikara-progress-v1', JSON.stringify({
      'n3:2:meaning': { solved: true, unresolved: false, revealed: false, hints: 0, answer: 'woman' },
    }))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Meaning display mode' }), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enter Meaning for 男性' }))
    const first = screen.getByRole('textbox', { name: 'Meaning for 男性' })
    fireEvent.change(first, { target: { value: 'man' } })
    fireEvent.submit(first.closest('form')!)
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Meaning for 女性' }))
    const savedProgress = window.localStorage.getItem('mimikara-progress-v1')
    cleanup()
    render(<App />)
    fireEvent.keyDown(document, { key: 'r', altKey: true })
    const resumed = screen.getByRole('textbox', { name: 'Meaning for 女性' }) as HTMLInputElement
    expect(document.activeElement).toBe(resumed)
    expect(resumed.value).toBe('')
    expect(window.localStorage.getItem('mimikara-progress-v1')).toBe(savedProgress)
  } finally {
    HTMLElement.prototype.scrollIntoView = original
  }
})

test('resumes a saved review box even when its correct answer still needs unaided review', () => {
  const original = HTMLElement.prototype.scrollIntoView
  HTMLElement.prototype.scrollIntoView = vi.fn()
  try {
    window.localStorage.setItem('mimikara-progress-v1', JSON.stringify({
      'n3:1:reading': { solved: true, unresolved: true, revealed: false, hints: 0, answer: 'だんせい' },
    }))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Review mistakes/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Enter Reading for word 1' }))
    cleanup()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Resume last box' }))
    expect(document.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Reading for word 1' }))
  } finally {
    HTMLElement.prototype.scrollIntoView = original
  }
})

test.each([
  null,
  '{broken',
  JSON.stringify({ level: 'N2', key: 'n3:1:meaning', focused: true }),
  JSON.stringify({ level: 'N3', key: 'n3:999:meaning', focused: true }),
  JSON.stringify({ level: 'N3-GRAMMAR', key: 'n3-grammar:10:formation', focused: true }),
])('ignores an absent or invalid saved practice position (%s)', (saved) => {
  if (saved !== null) window.localStorage.setItem('mimikara-last-practice-v1', saved)
  render(<App />)
  expect((screen.getByRole('button', { name: 'Resume last box' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.keyDown(document, { key: 'r', altKey: true })
  expect(screen.queryByRole('textbox')).toBeNull()
})

test('opens the novel reader and returns to the existing selected practice collection', async () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /N3 Grammar/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Read N3 novel' }))
  await waitFor(() => expect(document.querySelector('.novel-title h1')?.textContent).toBe('異世界で日本語しか使えません！'), { timeout: 10000 })
  fireEvent.click(within(document.querySelector('.novel-header')!).getByRole('button', { name: '← Practice' }))
  expect(screen.getByRole('columnheader', { name: 'Formation' })).toBeTruthy()
  expect(document.querySelectorAll('tbody tr')).toHaveLength(111)
})

test('opens a direct novel link and clears the reading route when returning to practice', async () => {
  window.history.replaceState(null, '', '/#novel')
  render(<App />)
  await waitFor(() => expect(document.querySelector('.novel-title h1')?.textContent).toBe('異世界で日本語しか使えません！'), { timeout: 10000 })
  fireEvent.click(within(document.querySelector('.novel-header')!).getByRole('button', { name: '← Practice' }))
  expect(window.location.hash).toBe('')
})

test('selects N3 grammar with formation and meaning practice and translated examples', () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /N3 Grammar/ }))
  expect(document.querySelectorAll('tbody tr')).toHaveLength(111)
  expect(screen.getByRole('columnheader', { name: 'Formation' })).toBeTruthy()
  expect(screen.queryByRole('columnheader', { name: 'Hán Việt' })).toBeNull()
  const row = within(document.getElementById('row-n3-grammar:1')!)
  fireEvent.click(row.getByText('Examples'))
  expect(row.getByText(/While I am in Japan/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Tiếng Việt' }))
  expect(within(document.getElementById('row-n3-grammar:1')!).getByText(/Trong lúc ở Nhật/)).toBeTruthy()
})

test('grammar saves formation across languages and keeps meaning progress separate on reload', () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /N3 Grammar/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Enter Formation for pattern 1' }))
  const formation = screen.getByRole('textbox', { name: 'Formation for pattern 1' })
  fireEvent.change(formation, { target: { value: 'N-no' } })
  fireEvent.submit(formation.closest('form')!)
  fireEvent.click(screen.getByRole('button', { name: 'Enter Meaning for pattern 1' }))
  const meaning = screen.getByRole('textbox', { name: 'Meaning for pattern 1' })
  fireEvent.change(meaning, { target: { value: 'during' } })
  fireEvent.submit(meaning.closest('form')!)
  fireEvent.click(screen.getByRole('button', { name: 'Tiếng Việt' }))
  expect(document.getElementById('practice-n3-grammar:1:formation')!.textContent).toBe('N-no✓')
  expect(document.getElementById('practice-n3-grammar:1:meaning')!.textContent).not.toContain('✓')
  fireEvent.click(screen.getByRole('button', { name: 'Nhập Ngữ nghĩa cho mẫu số 1' }))
  const viMeaning = screen.getByRole('textbox', { name: 'Ngữ nghĩa cho mẫu số 1' })
  fireEvent.change(viMeaning, { target: { value: 'trong luc' } })
  fireEvent.submit(viMeaning.closest('form')!)
  cleanup()
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /Ngữ pháp N3/ }))
  expect(document.getElementById('practice-n3-grammar:1:meaning')!.textContent).toBe('Trong khi, Trong lúc, Trong lúc đang✓')
  fireEvent.click(screen.getByRole('button', { name: 'English' }))
  expect(document.getElementById('practice-n3-grammar:1:meaning')!.textContent).toBe('while, during, while there is still time✓')
  expect(document.getElementById('practice-n3-grammar:1:formation')!.textContent).toBe('N-no✓')
})

test('grammar assistance requires a subsequent unaided review answer to clear the mistake', () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /N3 Grammar/ }))
  const open = () => {
    const cell = within(document.getElementById('practice-n3-grammar:1:formation')!)
    fireEvent.click(cell.getByRole('button', { name: 'Enter Formation for pattern 1' }))
    return cell
  }
  let cell = open()
  fireEvent.click(cell.getByRole('button', { name: /Hint\+/ }))
  fireEvent.click(screen.getByRole('button', { name: /Review mistakes/ }))
  expect(document.querySelectorAll('tbody tr')).toHaveLength(1)
  cell = open()
  fireEvent.click(cell.getByRole('button', { name: /Answer/ }))
  let input = cell.getByRole('textbox')
  fireEvent.change(input, { target: { value: 'Vru' } })
  fireEvent.submit(input.closest('form')!)
  expect(document.querySelectorAll('tbody tr')).toHaveLength(1)
  cell = open()
  input = cell.getByRole('textbox')
  fireEvent.change(input, { target: { value: 'N-no' } })
  fireEvent.submit(input.closest('form')!)
  expect(screen.getByRole('heading', { name: 'No mistakes left to review' })).toBeTruthy()
})

test('grammar focus uses two practice columns, skips missing formation rules and saves display modes', () => {
  window.scrollTo = vi.fn()
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /N3 Grammar/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Focus' }))
  expect(screen.getAllByRole('combobox')).toHaveLength(2)
  expect(document.getElementById('practice-n3-grammar:10:formation')!.textContent).toBe('—')
  const input = () => document.activeElement as HTMLInputElement
  fireEvent.click(screen.getByRole('button', { name: 'Enter Formation for うちに' }))
  fireEvent.keyDown(input(), { key: 'x', altKey: true })
  expect(input().getAttribute('aria-label')).toBe('Meaning for うちに')
  fireEvent.keyDown(input(), { key: 'z', altKey: true })
  expect(input().getAttribute('aria-label')).toBe('Formation for うちに')
  fireEvent.click(screen.getByRole('button', { name: 'Enter Formation for ついでに' }))
  fireEvent.keyDown(input(), { key: 'v', altKey: true })
  expect(input().getAttribute('aria-label')).toBe('Formation for くらい / ほど')
  fireEvent.keyDown(input(), { key: 'c', altKey: true })
  expect(input().getAttribute('aria-label')).toBe('Formation for ついでに')
  fireEvent.change(screen.getByRole('combobox', { name: 'Formation display mode' }), { target: { value: '3' } })
  expect(document.getElementById('practice-n3-grammar:1:formation')!.textContent).toContain('Vru, N-no, A(na), A(i)')
  expect(JSON.parse(window.localStorage.getItem('mimikara-display-modes-v1')!).formation).toBe('3')
})

test('grammar overview counts available fields and jumps to the correct grammar row', async () => {
  vi.useFakeTimers()
  const scroll = vi.fn()
  const original = HTMLElement.prototype.scrollIntoView
  HTMLElement.prototype.scrollIntoView = scroll
  try {
    window.localStorage.setItem('mimikara-progress-v1', JSON.stringify({
      'n3-grammar:10:meaning': { solved: true, unresolved: false, revealed: false, hints: 0, answer: 'at least' },
    }))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /N3 Grammar/ }))
    expect(document.querySelector('.progress-summary')!.textContent).toContain('/ 200')
    fireEvent.click(screen.getByRole('button', { name: /Overview/ }))
    const dialog = within(screen.getByRole('dialog', { name: 'N3 Grammar overview' }))
    expect(dialog.getAllByRole('button')).toHaveLength(112)
    expect(dialog.getByRole('button', { name: 'Go to pattern 10: ぐらい' }).className).toContain('tile-done')
    fireEvent.click(dialog.getByRole('button', { name: 'Go to pattern 111: Vます + がち' }))
    await act(async () => { vi.advanceTimersByTime(20) })
    expect(scroll.mock.instances[0]).toBe(document.getElementById('row-n3-grammar:111'))
  } finally {
    HTMLElement.prototype.scrollIntoView = original
  }
})

test('practices all 214 radicals and restores their separate progress after reload', () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /Kanji radicals/ }))
  expect(document.querySelectorAll('tbody tr')).toHaveLength(214)
  expect(document.getElementById('row-radicals:214')!.textContent).toContain('龠')
  fireEvent.click(screen.getByRole('button', { name: 'Tiếng Việt' }))
  fireEvent.click(screen.getByRole('button', { name: 'Nhập Ngữ nghĩa cho từ số 1' }))
  const input = screen.getByRole('textbox', { name: 'Ngữ nghĩa cho từ số 1' })
  fireEvent.change(input, { target: { value: 'một' } })
  fireEvent.submit(input.closest('form')!)
  expect(document.getElementById('practice-radicals:1:meaning')!.textContent).toBe('một✓')
  cleanup()
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /Bộ thủ Kanji/ }))
  expect(document.getElementById('practice-radicals:1:meaning')!.textContent).toBe('một✓')
  expect(document.getElementById('practice-radicals:1:hanViet')!.textContent).not.toContain('✓')
})

test('focus controls appear near the top and stay visible while moving through the header', () => {
  window.scrollTo = vi.fn()
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Focus' }))
  const header = document.querySelector<HTMLElement>('.focus-controls')!
  expect(header.classList.contains('is-visible')).toBe(false)
  fireEvent.mouseMove(window, { clientY: 20 })
  expect(header.classList.contains('is-visible')).toBe(true)
  vi.spyOn(header, 'getBoundingClientRect').mockReturnValue({ bottom: 200 } as DOMRect)
  fireEvent.mouseMove(window, { clientY: 180 })
  expect(header.classList.contains('is-visible')).toBe(true)
  fireEvent.mouseMove(window, { clientY: 300 })
  expect(header.classList.contains('is-visible')).toBe(false)
})

test('the focus fullscreen button enters and exits browser fullscreen and tracks Escape', async () => {
  window.scrollTo = vi.fn()
  const request = vi.fn().mockResolvedValue(undefined)
  const exit = vi.fn().mockResolvedValue(undefined)
  let fullscreen: Element | null = null
  Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: request })
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit })
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreen })
  try {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }))
    fireEvent.mouseMove(window, { clientY: 20 })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Full screen' })) })
    expect(request).toHaveBeenCalledOnce()
    fullscreen = document.documentElement
    fireEvent(document, new Event('fullscreenchange'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Exit full screen' })) })
    expect(exit).toHaveBeenCalledOnce()
    // Escape also changes the browser state independently of this button.
    fullscreen = null
    fireEvent(document, new Event('fullscreenchange'))
    expect(screen.getByRole('button', { name: 'Full screen' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tiếng Việt' }))
    expect(screen.getByRole('button', { name: 'Toàn màn hình' })).toBeTruthy()
  } finally {
    Reflect.deleteProperty(document.documentElement, 'requestFullscreen')
    Reflect.deleteProperty(document, 'exitFullscreen')
    Reflect.deleteProperty(document, 'fullscreenElement')
  }
})

test.each(['Hint+', 'Answer'])('%s adds a mistake and an assisted review answer keeps it for an unaided retry', async (aid) => {
  vi.useFakeTimers()
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Enter Reading for word 1' }))
  const cell = () => within(document.getElementById('practice-n3:1:reading')!)
  fireEvent.click(cell().getByRole('button', { name: new RegExp(aid.replace('+', '\\+')) }))
  fireEvent.click(screen.getByRole('button', { name: /Review mistakes/ }))
  expect(screen.queryByRole('heading', { name: 'No mistakes left to review' })).toBeNull()
  fireEvent.click(cell().getByRole('button', { name: 'Enter Reading for word 1' }))
  fireEvent.click(cell().getByRole('button', { name: new RegExp(aid.replace('+', '\\+')) }))
  await act(async () => { vi.advanceTimersByTime(5000) })
  const input = cell().getByRole('textbox', { name: 'Reading for word 1' })
  fireEvent.change(input, { target: { value: 'だんせい' } })
  fireEvent.submit(input.closest('form')!)
  expect(JSON.parse(window.localStorage.getItem('mimikara-progress-v1')!)['n3:1:reading'].unresolved).toBe(true)
  fireEvent.click(cell().getByRole('button', { name: 'Enter Reading for word 1' }))
  const retry = cell().getByRole('textbox', { name: 'Reading for word 1' })
  fireEvent.change(retry, { target: { value: 'だんせい' } })
  fireEvent.submit(retry.closest('form')!)
  expect(screen.getByRole('heading', { name: 'No mistakes left to review' })).toBeTruthy()
})

test.each(['key', 'code'])('focus mode navigates left/right/up/down with Alt+Z/X/C/V (%s)', (eventProperty) => {
  window.scrollTo = vi.fn()
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Focus' }))
  const move = (key: string) => fireEvent.keyDown(document.activeElement!, {
    altKey: true,
    ...(eventProperty === 'key' ? { key } : { key: 'Unidentified', code: `Key${key.toUpperCase()}` }),
  })
  const row = within(screen.getByRole('group', { name: 'Word 男性' }))
  expect(row.getByRole('button', { name: 'Enter Reading for 男性' })).toBeTruthy()
  expect(row.getByRole('button', { name: 'Enter Hán Việt for 男性' })).toBeTruthy()
  fireEvent.click(row.getByRole('button', { name: 'Enter Meaning for 男性' }))
  move('z')
  expect(document.activeElement).toBe(row.getByRole('textbox', { name: 'Hán Việt for 男性' }))
  move('x')
  expect(document.activeElement).toBe(row.getByRole('textbox', { name: 'Meaning for 男性' }))
  move('v')
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Meaning for 女性' }))
  move('c')
  expect(document.activeElement).toBe(row.getByRole('textbox', { name: 'Meaning for 男性' }))
  move('x')
  expect(document.activeElement).toBe(row.getByRole('textbox', { name: 'Meaning for 男性' }))
})

test('display modes keep correct cells green, hide their text, or reveal all answers without changing progress', () => {
  window.scrollTo = vi.fn()
  window.localStorage.setItem('mimikara-progress-v1', JSON.stringify({
    'n3:1:meaning': { solved: true, unresolved: false, revealed: false, hints: 0, answer: 'man' },
  }))
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Focus' }))
  const first = document.getElementById('practice-n3:1:meaning')!
  expect(first.textContent).toBe('man✓')
  const savedProgress = window.localStorage.getItem('mimikara-progress-v1')
  fireEvent.change(screen.getByRole('combobox', { name: 'Meaning display mode' }), { target: { value: '2' } })
  expect(first.textContent).toBe('')
  expect(first.querySelector('.answer-correct')).toBeTruthy()
  expect(first.querySelector('[title]')).toBeNull()
  fireEvent.change(screen.getByRole('combobox', { name: 'Meaning display mode' }), { target: { value: '3' } })
  expect(first.textContent).toBe('man✓')
  expect(document.getElementById('practice-n3:2:meaning')!.textContent).toBe('woman')
  expect(document.getElementById('practice-n3:2:meaning')!.querySelector('.answer-correct')).toBeNull()
  expect(window.localStorage.getItem('mimikara-progress-v1')).toBe(savedProgress)
  expect(document.getElementById('practice-n3:1:reading')!.textContent).toContain('Click to answer')
  fireEvent.change(screen.getByRole('combobox', { name: 'Meaning display mode' }), { target: { value: '1' } })
  expect(first.textContent).toBe('man✓')
  expect(document.getElementById('practice-n3:2:meaning')!.textContent).toContain('Click to answer')
  first.querySelector<HTMLButtonElement>('button')!.focus()
  fireEvent.keyDown(document.activeElement!, { key: 'z', altKey: true })
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Hán Việt for 男性' }))
})

test('hidden correct answers can be reopened with an empty input and submitted again', () => {
  window.scrollTo = vi.fn()
  window.localStorage.setItem('mimikara-progress-v1', JSON.stringify({
    'n3:1:meaning': { solved: true, unresolved: false, revealed: false, hints: 0, answer: 'man' },
  }))
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Focus' }))
  fireEvent.change(screen.getByRole('combobox', { name: 'Meaning display mode' }), { target: { value: '2' } })
  const cell = within(document.getElementById('practice-n3:1:meaning')!)
  const savedProgress = window.localStorage.getItem('mimikara-progress-v1')
  fireEvent.click(cell.getByRole('button'))
  const input = cell.getByRole('textbox', { name: 'Meaning for 男性' }) as HTMLInputElement
  expect(document.activeElement).toBe(input)
  expect(input.value).toBe('')
  expect(window.localStorage.getItem('mimikara-progress-v1')).toBe(savedProgress)
  fireEvent.change(input, { target: { value: 'MAN' } })
  fireEvent.submit(input.closest('form')!)
  expect(cell.queryByRole('textbox')).toBeNull()
  expect(cell.getByRole('button').textContent).toBe('')
  expect(cell.getByRole('button').classList.contains('answer-correct')).toBe(true)
  expect(JSON.parse(window.localStorage.getItem('mimikara-progress-v1')!)['n3:1:meaning']).toMatchObject({ solved: true, answer: 'MAN' })
})

test.each([
  ['reading', 'Reading', 'だんせい', 'じょせい'],
  ['hanViet', 'Hán Việt', 'NAM TÍNH', 'NỮ TÍNH'],
  ['meaning', 'Meaning', 'man', 'woman'],
])('hide correct answers advances into the green %s box below without changing its progress', (field, label, firstAnswer, nextAnswer) => {
  window.scrollTo = vi.fn()
  const nextStatus = { solved: true, unresolved: false, revealed: false, hints: 0, answer: nextAnswer }
  window.localStorage.setItem('mimikara-progress-v1', JSON.stringify({ [`n3:2:${field}`]: nextStatus }))
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Focus' }))
  fireEvent.change(screen.getByRole('combobox', { name: `${label} display mode` }), { target: { value: '2' } })
  const firstCell = within(document.getElementById(`practice-n3:1:${field}`)!)
  const nextCell = within(document.getElementById(`practice-n3:2:${field}`)!)
  expect(nextCell.getByRole('button').classList.contains('answer-correct')).toBe(true)
  fireEvent.click(firstCell.getByRole('button'))
  const firstInput = firstCell.getByRole('textbox')
  fireEvent.change(firstInput, { target: { value: firstAnswer } })
  fireEvent.submit(firstInput.closest('form')!)
  const nextInput = nextCell.getByRole('textbox') as HTMLInputElement
  expect(document.activeElement).toBe(nextInput)
  expect(nextInput.value).toBe('')
  expect(JSON.parse(window.localStorage.getItem('mimikara-progress-v1')!)[`n3:2:${field}`]).toMatchObject(nextStatus)
  fireEvent.change(nextInput, { target: { value: nextAnswer } })
  fireEvent.submit(nextInput.closest('form')!)
  expect(nextCell.queryByRole('textbox')).toBeNull()
  expect(nextCell.getByRole('button').classList.contains('answer-correct')).toBe(true)
})

test.each([false, true])('correct meaning and Hán Việt submissions show source answers (focus: %s)', (focus) => {
  window.scrollTo = vi.fn()
  render(<App />)
  if (focus) fireEvent.click(screen.getByRole('button', { name: 'Focus' }))
  for (const [field, response, expected] of [['meaning', 'MAN', 'man'], ['hanViet', 'nam tính', 'NAM TÍNH']]) {
    const cell = document.getElementById(`practice-n3:1:${field}`)!
    fireEvent.click(within(cell).getByRole('button'))
    const input = within(cell).getByRole('textbox')
    fireEvent.change(input, { target: { value: response } })
    fireEvent.submit(input.closest('form')!)
    expect(cell.textContent).toBe(`${expected}✓`)
    expect(cell.querySelector('.answer-correct')).toBeTruthy()
  }
})

test('show all meanings displays the source answer instead of the saved response', () => {
  window.scrollTo = vi.fn()
  window.localStorage.setItem('mimikara-progress-v1', JSON.stringify({
    'n3:1:meaning': { solved: true, unresolved: false, revealed: false, hints: 0, answer: 'MAN' },
  }))
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Focus' }))
  const cell = document.getElementById('practice-n3:1:meaning')!
  const savedProgress = window.localStorage.getItem('mimikara-progress-v1')
  expect(cell.textContent).toBe('man✓')
  fireEvent.change(screen.getByRole('combobox', { name: 'Meaning display mode' }), { target: { value: '3' } })
  expect(cell.textContent).toBe('man✓')
  expect(cell.querySelector('.answer-correct')).toBeTruthy()
  expect(window.localStorage.getItem('mimikara-progress-v1')).toBe(savedProgress)
  fireEvent.change(screen.getByRole('combobox', { name: 'Meaning display mode' }), { target: { value: '1' } })
  expect(cell.textContent).toBe('man✓')
})

test('Hint+ restarts its five-second timer and clears only that cell’s hint count', async () => {
  vi.useFakeTimers()
  render(<App />)
  const cell = within(document.getElementById('practice-n3:1:meaning')!)
  fireEvent.click(cell.getByRole('button', { name: 'Enter Meaning for word 1' }))
  const input = cell.getByRole('textbox')
  fireEvent.change(input, { target: { value: 'wrong' } })
  fireEvent.submit(input.closest('form')!)
  fireEvent.click(cell.getByRole('button', { name: /Hint\+/ }))
  expect(cell.getByText(/Hint:/).textContent).toBe('Hint: m')
  await act(async () => { vi.advanceTimersByTime(3000) })
  fireEvent.keyDown(input, { key: 'a', altKey: true })
  expect(cell.getByText(/Hint:/).textContent).toBe('Hint: ma')
  await act(async () => { vi.advanceTimersByTime(4999) })
  expect(cell.getByText(/Hint:/).textContent).toBe('Hint: ma')
  await act(async () => { vi.advanceTimersByTime(1) })
  expect(cell.queryByText(/Hint:/)).toBeNull()
  const saved = JSON.parse(window.localStorage.getItem('mimikara-progress-v1')!)
  expect(saved['n3:1:meaning']).toMatchObject({ hints: 0, solved: false, unresolved: true })
  expect(document.activeElement).toBe(input)
  fireEvent.click(cell.getByRole('button', { name: /Hint\+/ }))
  expect(cell.getByText(/Hint:/).textContent).toBe('Hint: m')
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
  expect(document.getElementById('practice-n3:1:meaning')!.textContent).toBe('đàn ông✓')
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

test('the vocabulary map shows learned words green even when previous review flags remain', () => {
  window.localStorage.setItem('mimikara-progress-v1', JSON.stringify({
    'n3:1:reading': { solved: true, unresolved: true, revealed: false, hints: 0, answer: 'だんせい' },
    'n3:1:hanViet': { solved: true, unresolved: false, revealed: false, hints: 0, answer: 'NAM TÍNH' },
    'n3:1:meaning': { solved: true, unresolved: true, revealed: false, hints: 0, answer: 'man' },
  }))
  render(<App />)
  const savedProgress = window.localStorage.getItem('mimikara-progress-v1')
  fireEvent.click(screen.getByRole('button', { name: /Overview/ }))
  const learned = screen.getByRole('button', { name: 'Go to word 1: 男性' })
  expect(learned.classList.contains('tile-done')).toBe(true)
  expect(learned.classList.contains('tile-mistake')).toBe(false)
  expect(screen.getByRole('button', { name: 'Go to word 2: 女性' }).className).toBe('overview-tile ')
  expect(window.localStorage.getItem('mimikara-progress-v1')).toBe(savedProgress)
})

test.each(['reading', 'hanViet', 'meaning'])('the vocabulary map turns a word green after only its %s answer is correct', (field) => {
  window.localStorage.setItem('mimikara-progress-v1', JSON.stringify({
    [`n3:1:${field}`]: { solved: true, unresolved: true, revealed: false, hints: 0 },
    'n3:2:reading': { solved: false, unresolved: true, revealed: false, hints: 0 },
  }))
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /Overview/ }))
  const learned = screen.getByRole('button', { name: 'Go to word 1: 男性' })
  expect(learned.classList.contains('tile-done')).toBe(true)
  expect(learned.classList.contains('tile-mistake')).toBe(false)
  expect(screen.getByRole('button', { name: 'Go to word 2: 女性' }).classList.contains('tile-mistake')).toBe(true)
})

test('shows source English meanings and Hán Việt for saved correct answers', () => {
  window.localStorage.setItem('mimikara-progress-v1', JSON.stringify({
    'n3:1:meaning': { solved: true, unresolved: false, revealed: false, hints: 0, answer: 'đàn ông' },
    'n3:2:meaning': { solved: true, unresolved: false, revealed: false, hints: 0, answer: 'WOMAN' },
    'n3:1:hanViet': { solved: true, unresolved: false, revealed: false, hints: 0, answer: 'NAM TÍNH' },
  }))
  render(<App />)
  expect(document.getElementById('practice-n3:1:meaning')!.textContent).toBe('man✓')
  expect(document.getElementById('practice-n3:2:meaning')!.textContent).toBe('woman✓')
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
