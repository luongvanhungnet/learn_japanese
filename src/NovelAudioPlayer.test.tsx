// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NovelAudioPlayer } from './NovelAudioPlayer'
import { LanguageProvider } from './i18n'
import { createRef } from 'react'
import type { NovelAudioHandle } from './NovelAudioPlayer'

const manifest = { voice: 'ja-JP-KeitaNeural', fullSrc: '/full.mp3', chapters: [1, 2].map(id => ({ id, src: `/${id}.mp3`, duration: 90, sentences: [{ id: `${id}:0:0`, text: 'こんにちは。', start: 0.1, end: 5 }, { id: `${id}:0:1`, text: '元気ですか。', start: 6, end: 12 }] })) }
beforeEach(() => { vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {}) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('starts a sentence from another chapter at its own timing after loading the new audio', () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  const ref = createRef<NovelAudioHandle>(), highlight = vi.fn(), move = vi.fn()
  const props = { ref, manifest, onChapterChange: move, onSentenceChange: highlight, onListeningChange: vi.fn() }
  const view = render(<LanguageProvider><NovelAudioPlayer {...props} chapterId={1} /></LanguageProvider>)
  act(() => ref.current!.startSentence('2:0:1'))
  expect(move).toHaveBeenLastCalledWith(2)
  view.rerender(<LanguageProvider><NovelAudioPlayer {...props} chapterId={2} /></LanguageProvider>)
  const audio = document.querySelector('audio')!
  fireEvent.loadedMetadata(audio)
  expect(audio.currentTime).toBe(6)
  expect(highlight).toHaveBeenLastCalledWith('2:0:1')
  expect(play).toHaveBeenCalled()
})

it('plays and pauses MP3 narration, highlighting the sentence at the audio time', async () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  const highlight = vi.fn()
  render(<LanguageProvider><NovelAudioPlayer manifest={manifest} chapterId={1} onChapterChange={() => {}} onSentenceChange={highlight} onListeningChange={() => {}} /></LanguageProvider>)
  const audio = document.querySelector('audio')!
  fireEvent.loadedMetadata(audio)
  fireEvent.click(screen.getByRole('button', { name: 'Play narration' }))
  expect(play).toHaveBeenCalled()
  fireEvent.play(audio)
  audio.currentTime = 7
  fireEvent.timeUpdate(audio)
  expect(highlight).toHaveBeenLastCalledWith('1:0:1')
  fireEvent.click(screen.getByRole('button', { name: 'Pause narration' }))
  expect(pause).toHaveBeenCalled()
  expect(audio.getAttribute('src')).toBe('/1.mp3')
})

it('seeks by real seconds with bounds, changes playback speed, and offers MP3 downloads', () => {
  render(<LanguageProvider><NovelAudioPlayer manifest={manifest} chapterId={1} onChapterChange={() => {}} onSentenceChange={() => {}} onListeningChange={() => {}} /></LanguageProvider>)
  const audio = document.querySelector('audio')!
  fireEvent.loadedMetadata(audio)
  audio.currentTime = 10
  fireEvent.click(screen.getByRole('button', { name: 'Back 30 seconds' }))
  expect(audio.currentTime).toBe(0)
  fireEvent.click(screen.getByRole('button', { name: 'Forward 30 seconds' }))
  expect(audio.currentTime).toBe(30)
  audio.currentTime = 80
  fireEvent.click(screen.getByRole('button', { name: 'Forward 30 seconds' }))
  expect(audio.currentTime).toBe(90)
  fireEvent.change(screen.getByLabelText('Playback speed'), { target: { value: '1.5' } })
  expect(audio.playbackRate).toBe(1.5)
  fireEvent.change(screen.getByLabelText('Audio position'), { target: { value: '6' } })
  expect(audio.currentTime).toBe(6)
  expect(screen.getByRole('link', { name: 'Chapter MP3' }).getAttribute('href')).toBe('/1.mp3')
  expect(screen.getByRole('link', { name: 'Full novel MP3' }).getAttribute('href')).toBe('/full.mp3')
})

it('continues through chapter changes and stops after the final chapter', () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  const move = vi.fn(), highlight = vi.fn()
  const view = render(<LanguageProvider><NovelAudioPlayer manifest={manifest} chapterId={1} onChapterChange={move} onSentenceChange={highlight} onListeningChange={() => {}} /></LanguageProvider>)
  const audio = document.querySelector('audio')!
  fireEvent.loadedMetadata(audio)
  fireEvent.play(audio)
  fireEvent.click(screen.getByRole('button', { name: 'Next audio chapter' }))
  expect(move).toHaveBeenLastCalledWith(2)
  view.rerender(<LanguageProvider><NovelAudioPlayer manifest={manifest} chapterId={2} onChapterChange={move} onSentenceChange={highlight} onListeningChange={() => {}} /></LanguageProvider>)
  fireEvent.loadedMetadata(audio)
  expect(audio.getAttribute('src')).toBe('/2.mp3')
  expect(play).toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Next audio chapter' }).hasAttribute('disabled')).toBe(true)
  fireEvent.ended(audio)
  expect(screen.getByRole('button', { name: 'Play narration' })).toBeTruthy()
  expect(highlight).toHaveBeenLastCalledWith(null)
  fireEvent.click(screen.getByRole('button', { name: 'Previous audio chapter' }))
  expect(move).toHaveBeenLastCalledWith(1)
})

it('starts at a clicked sentence, including a click before audio metadata is ready', () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  const ref = createRef<NovelAudioHandle>(), highlight = vi.fn()
  render(<LanguageProvider><NovelAudioPlayer ref={ref} manifest={manifest} chapterId={1} onChapterChange={() => {}} onSentenceChange={highlight} onListeningChange={() => {}} /></LanguageProvider>)
  ref.current!.startSentence('1:0:1')
  const audio = document.querySelector('audio')!
  fireEvent.loadedMetadata(audio)
  expect(audio.currentTime).toBe(6)
  expect(play).toHaveBeenCalled()
  expect(highlight).toHaveBeenLastCalledWith('1:0:1')
})

it('reports playback errors and stops audio when the reader is unmounted', async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('Unavailable'))
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause')
  const highlight = vi.fn()
  const view = render(<LanguageProvider><NovelAudioPlayer manifest={manifest} chapterId={1} onChapterChange={() => {}} onSentenceChange={highlight} onListeningChange={() => {}} /></LanguageProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Play narration' }))
  expect(await screen.findByRole('alert')).toBeTruthy()
  const audio = document.querySelector('audio')!
  fireEvent.error(audio)
  expect(highlight).toHaveBeenLastCalledWith(null)
  view.unmount()
  expect(pause).toHaveBeenCalled()
})

it('seeks already-loaded audio even when metadata was loaded before the listener mounted', () => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  const ref = createRef<NovelAudioHandle>()
  render(<LanguageProvider><NovelAudioPlayer ref={ref} manifest={manifest} chapterId={1} onChapterChange={() => {}} onSentenceChange={() => {}} onListeningChange={() => {}} /></LanguageProvider>)
  const audio = document.querySelector('audio')!
  Object.defineProperty(audio, 'readyState', { value: 4 })
  Object.defineProperty(audio, 'currentSrc', { value: 'http://localhost/1.mp3' })
  ref.current!.startSentence('1:0:1')
  expect(audio.currentTime).toBe(6)
})
