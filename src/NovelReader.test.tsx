// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { LanguageProvider } from './i18n'
import { NovelReader } from './NovelReader'
import novel from './data/novel.json'


beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {}) })
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('keeps only the pinned word green and its sentence play button available after hovering elsewhere', () => {
  render(<LanguageProvider><NovelReader onClose={() => {}} /></LanguageProvider>)
  const sentences = document.querySelectorAll<HTMLElement>('.story-sentence')
  const first = sentences[0].querySelector<HTMLElement>('.story-token')!
  const second = sentences[3].querySelector<HTMLElement>('.story-token')!
  fireEvent.click(first)
  fireEvent.mouseLeave(first)
  fireEvent.blur(first)
  fireEvent.mouseEnter(second)
  expect(first.classList.contains('pinned-token')).toBe(true)
  expect(sentences[0].classList.contains('pinned-sentence')).toBe(true)
  expect(second.classList.contains('pinned-token')).toBe(false)
  fireEvent.click(second)
  expect(first.classList.contains('pinned-token')).toBe(false)
  expect(sentences[0].classList.contains('pinned-sentence')).toBe(false)
  expect(second.classList.contains('pinned-token')).toBe(true)
  expect(sentences[3].classList.contains('pinned-sentence')).toBe(true)
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(document.querySelector('.pinned-token')).toBeNull()
  expect(document.querySelector('.pinned-sentence')).toBeNull()
})

it('looks up words during playback, keeps pinned lookups during hover, and seeks only from the sentence play button', () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  render(<LanguageProvider><NovelReader onClose={() => {}} /></LanguageProvider>)
  const audio = document.querySelector('audio')!
  fireEvent.loadedMetadata(audio)
  fireEvent.play(audio)
  audio.currentTime = 15
  const sentences = document.querySelectorAll<HTMLElement>('.story-sentence')
  const first = sentences[0].querySelector<HTMLElement>('.story-token')!
  const second = sentences[3].querySelector<HTMLElement>('.story-token')!
  fireEvent.click(first)
  expect(audio.currentTime).toBe(15)
  fireEvent.mouseEnter(second)
  expect(document.querySelector('.lookup-surface')?.textContent).toBe(first.textContent)
  fireEvent.click(second)
  expect(audio.currentTime).toBe(15)
  expect(sentences[3].classList.contains('engaged-sentence')).toBe(true)
  fireEvent.click(sentences[3])
  expect(audio.currentTime).toBe(15)
  fireEvent.click(sentences[3].querySelector('.sentence-play')!)
  expect(audio.currentTime).not.toBe(15)
  expect(play).toHaveBeenCalled()
})

it('docks an offscreen pinned word at either edge, returns to it, and resumes quick lookup after unpinning', () => {
  let wordTop = 250
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains('story-token')) return new DOMRect(400, wordTop, 60, 30)
    if (this.classList.contains('lookup-card')) return new DOMRect(0, 0, 320, 300)
    if (this.classList.contains('novel-playback-panel')) return new DOMRect(0, 0, 1000, 180)
    return new DOMRect()
  })
  const scroll = vi.fn(() => { wordTop = 250; fireEvent.scroll(window) })
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll })
  render(<LanguageProvider><NovelReader onClose={() => {}} /></LanguageProvider>)
  scroll.mockClear()
  const words = document.querySelectorAll<HTMLElement>('.story-token')
  fireEvent.click(words[0])
  wordTop = -100
  fireEvent.scroll(window)
  expect(document.querySelector('.pinned-lookup-dock')?.getAttribute('data-edge')).toBe('top')
  fireEvent.mouseEnter(words[1])
  expect(document.querySelector('.lookup-surface')?.textContent).toBe(words[0].textContent)
  fireEvent.click(within(document.querySelector('.pinned-lookup-dock')!).getByRole('button', { name: 'Return to pinned word' }))
  expect(scroll).toHaveBeenCalled()
  expect(document.querySelector('.pinned-lookup-dock')).toBeNull()
  expect(document.querySelector<HTMLElement>('.lookup-card')?.style.visibility).toBe('visible')
  wordTop = window.innerHeight + 50
  fireEvent.scroll(window)
  expect(document.querySelector('.pinned-lookup-dock')?.getAttribute('data-edge')).toBe('bottom')
  fireEvent.click(within(document.querySelector('.pinned-lookup-dock')!).getByRole('button', { name: 'Unpin word' }))
  expect(document.querySelector('.lookup-card')).toBeNull()
  wordTop = 250
  fireEvent.mouseEnter(words[1])
  expect(document.querySelector('.lookup-surface')?.textContent).toBe(words[1].textContent)
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
})

it('combines reading and audio controls in one collapsible panel without unmounting narration', () => {
  render(<LanguageProvider><NovelReader onClose={() => {}} /></LanguageProvider>)
  const panel = document.querySelector<HTMLElement>('.novel-playback-panel')!
  expect(panel.contains(document.querySelector('.reader-controls'))).toBe(true)
  const audio = document.querySelector('audio')!
  const toggle = within(panel).getByRole('button', { name: 'Hide controls' })
  fireEvent.click(toggle)
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(document.querySelector('audio')).toBe(audio)
  expect(document.querySelector('#reader-control-content')?.hasAttribute('hidden')).toBe(true)
  fireEvent.click(within(panel).getByRole('button', { name: 'Show controls' }))
  expect(document.querySelector('#reader-control-content')?.hasAttribute('hidden')).toBe(false)
  expect(document.querySelector('.novel-resources')!.compareDocumentPosition(document.querySelector('.novel-prose')!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
})

it('anchors lookup to the hovered word and flips above after the word moves near the bottom', () => {
  let wordTop = 250
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains('story-token')) return new DOMRect(400, wordTop, 60, 30)
    if (this.classList.contains('lookup-card')) return new DOMRect(0, 0, 320, 300)
    if (this.classList.contains('novel-playback-panel')) return new DOMRect(0, 0, 1000, 180)
    return new DOMRect()
  })
  render(<LanguageProvider><NovelReader onClose={() => {}} /></LanguageProvider>)
  fireEvent.mouseEnter(document.querySelector('.story-token')!)
  const card = document.querySelector<HTMLElement>('.lookup-card')!
  expect(card.dataset.side).toBe('below')
  expect(card.style.top).toBe('290px')
  wordTop = 700
  fireEvent.scroll(window)
  expect(card.dataset.side).toBe('above')
  expect(card.style.top).toBe('390px')
})

it('renders all twenty chapters together and uses chapter selection to jump without removing text', () => {
  const scroll = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll })
  render(<LanguageProvider><NovelReader onClose={() => {}} /></LanguageProvider>)
  expect([...document.querySelectorAll('.novel-chapter h2')].map(item => item.textContent)).toEqual(novel.chapters.map(item => item.title))
  fireEvent.change(document.querySelector('.reader-controls select')!, { target: { value: '20' } })
  expect(scroll).toHaveBeenLastCalledWith({ block: 'start', behavior: 'instant' })
  expect(document.querySelector('#novel-chapter-1')).toBeTruthy()
  expect(document.querySelector('#novel-chapter-20')).toBeTruthy()
  expect(document.querySelector('audio')?.getAttribute('src')).toContain('chapter-20')
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
})

it('jumps for audio chapter navigation in automatic view and holds the page in free view', () => {
  const scroll = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll })
  render(<LanguageProvider><NovelReader onClose={() => {}} /></LanguageProvider>)
  const controls = within(document.querySelector('.novel-playback-panel')!)
  scroll.mockClear()
  fireEvent.click(controls.getByRole('button', { name: 'Next audio chapter' }))
  expect(scroll).toHaveBeenCalledOnce()
  fireEvent.click(controls.getByRole('switch', { name: 'Automatic view' }))
  scroll.mockClear()
  fireEvent.click(controls.getByRole('button', { name: 'Previous audio chapter' }))
  fireEvent.ended(document.querySelector('audio')!)
  expect(document.querySelector('audio')?.getAttribute('src')).toContain('chapter-02')
  expect(scroll).not.toHaveBeenCalled()
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
})

it('shows the selected language for supporting dictionary words including 仕事場', () => {
  render(<LanguageProvider><NovelReader onClose={() => {}} /></LanguageProvider>)
  fireEvent.mouseEnter(document.querySelector('.story-token[aria-label="仕事場 · Vocabulary"]')!)
  expect(within(document.querySelector('.reader-popup')!).getByRole('dialog').textContent).toContain('place where one works')
  fireEvent.click(within(document.querySelector('.novel-header')!).getByRole('button', { name: 'Tiếng Việt' }))
  const card = within(document.querySelector('.reader-popup')!).getByRole('dialog', { name: 'Tra từ & ngữ pháp' })
  expect(card.querySelector('dd[lang="vi"]')?.textContent).toBe('nơi làm việc · công trường · khu vực làm việc')
  expect(card.textContent).not.toContain('Nghĩa (English)')
  expect(card.textContent).not.toContain('place where one works')
  fireEvent.click(within(document.querySelector('.novel-header')!).getByRole('button', { name: 'English' }))
  expect(within(document.querySelector('.reader-popup')!).getByRole('dialog').textContent).toContain('place where one works')
})

it('switches between free viewing and following the highlighted sentence without stopping playback', () => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  const scroll = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll })
  render(<LanguageProvider><NovelReader onClose={() => {}} /></LanguageProvider>)
  const mode = within(document.querySelector('.novel-playback-panel')!).getByRole('switch', { name: 'Automatic view' })
  scroll.mockClear()
  expect(mode.getAttribute('aria-checked')).toBe('true')
  fireEvent.click(mode)
  expect(mode.getAttribute('aria-checked')).toBe('false')
  const audio = document.querySelector('audio')!
  fireEvent.loadedMetadata(audio)
  fireEvent.click(document.querySelector('button[aria-label="Play sentence 2"]')!)
  expect(document.querySelectorAll('.story-sentence')[1].classList.contains('speaking-sentence')).toBe(true)
  expect(scroll).not.toHaveBeenCalled()
  fireEvent.click(mode)
  expect(scroll).toHaveBeenCalled()
  expect(within(document.querySelector('.novel-playback-panel')!).getByRole('button', { name: 'Play narration' })).toBeTruthy()
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
})

it('updates lookup clearance when the sticky playback panel changes height', () => {
  let height = 180
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return new DOMRect(0, 0, 850, this.classList.contains('novel-playback-panel') ? height : 0)
  })
  let resized: (() => void) | undefined
  const disconnect = vi.fn()
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resized = callback }
    observe() {}
    disconnect = disconnect
  })
  const view = render(<LanguageProvider><NovelReader onClose={() => {}} /></LanguageProvider>)
  const shell = document.querySelector<HTMLElement>('.novel-shell')!
  expect(shell.style.getPropertyValue('--reader-controls-height')).toBe('180px')
  height = 270
  act(() => resized!())
  expect(shell.style.getPropertyValue('--reader-controls-height')).toBe('270px')
  view.unmount()
  expect(disconnect).toHaveBeenCalled()
})

it('opens a keyboard-accessible vocabulary and grammar lookup and changes chapters', () => {
  render(<LanguageProvider><NovelReader onClose={() => {}} /></LanguageProvider>)
  fireEvent.click(document.querySelector('.story-token[aria-label^="男性 ·"]')!)
  expect(within(document.querySelector('.reader-popup')!).getByRole('dialog', { name: 'Word & grammar lookup' }).textContent).toContain('だんせい')
  expect(within(document.querySelector('.reader-popup')!).getByRole('dialog').textContent).toContain('NAM TÍNH')
  fireEvent.click(within(document.querySelector('.reader-popup')!).getByRole('button', { name: 'Close lookup' }))
  fireEvent.change(within(document.querySelector('.reader-controls')!).getByLabelText('Chapter'), { target: { value: '2' } })
  expect(within(document.querySelector('.reader-controls')!).getByLabelText('Chapter').getAttribute('aria-label')).toBe('Chapter')
  expect((within(document.querySelector('.reader-controls')!).getByLabelText('Chapter') as HTMLSelectElement).value).toBe('2')
  expect(document.querySelector('#novel-chapter-2 h2')?.textContent).toContain('第二章')
})

it('shows contextual grammar details, closes with Escape, and restores the bookmarked chapter', () => {
  render(<LanguageProvider><NovelReader onClose={() => {}} /></LanguageProvider>)
  fireEvent.mouseEnter(document.querySelector('.grammar-token')!)
  expect(within(document.querySelector('.reader-popup')!).getByRole('dialog').textContent).toContain('Vru')
  expect(within(document.querySelector('.reader-popup')!).getByRole('dialog').textContent).toContain('Reading:')
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(within(document.querySelector('.reader-popup')!).queryByRole('dialog')).toBeNull()
  fireEvent.change(within(document.querySelector('.reader-controls')!).getByLabelText('Chapter'), { target: { value: '20' } })
  cleanup()
  render(<LanguageProvider><NovelReader onClose={() => {}} /></LanguageProvider>)
  expect((within(document.querySelector('.reader-controls')!).getByLabelText('Chapter') as HTMLSelectElement).value).toBe('20')
  expect(document.querySelector('#novel-chapter-20 h2')?.textContent).toContain('第二十章')
  fireEvent.click(within(document.querySelector('.novel-header')!).getByRole('button', { name: 'Tiếng Việt' }))
  fireEvent.mouseEnter(document.querySelector('.target-word')!)
  expect(within(document.querySelector('.reader-popup')!).getByRole('dialog', { name: 'Tra từ & ngữ pháp' })).toBeTruthy()
})

it('highlights narration and jumps with the sentence play button without losing word lookups', () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  render(<LanguageProvider><NovelReader onClose={() => {}} /></LanguageProvider>)
  const audio = document.querySelector('audio')!
  fireEvent.loadedMetadata(audio)
  fireEvent.click(within(document.querySelector('.novel-playback-panel')!).getByRole('button', { name: 'Play narration' }))
  fireEvent.play(audio)
  fireEvent.click(document.querySelector('button[aria-label="Play sentence 2"]')!)
  expect(play).toHaveBeenCalled()
  const second = document.querySelectorAll('.story-sentence')[1]
  expect(second.classList.contains('speaking-sentence')).toBe(true)
  fireEvent.mouseEnter(second.querySelector('.story-token')!)
  expect(within(document.querySelector('.reader-popup')!).getByRole('dialog', { name: 'Word & grammar lookup' })).toBeTruthy()
  fireEvent.click(document.querySelectorAll('.story-sentence')[3].querySelector('.sentence-play')!)
  expect(document.querySelectorAll('.story-sentence')[3].classList.contains('speaking-sentence')).toBe(true)
})
