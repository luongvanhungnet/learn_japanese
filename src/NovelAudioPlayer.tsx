import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import type { Ref } from 'react'
import { useLanguage } from './translations'
import type { AudioManifest } from './novelAudio'

type Props = {
  ref?: Ref<NovelAudioHandle>
  manifest: AudioManifest
  chapterId: number
  onChapterChange: (id: number) => void
  onSentenceChange: (id: string | null) => void
  onListeningChange: (listening: boolean) => void
}
export type NovelAudioHandle = { startSentence: (id: string) => void }

export function NovelAudioPlayer({ ref, manifest, chapterId, onChapterChange, onSentenceChange, onListeningChange }: Props) {
  const { language } = useLanguage()
  const vi = language === 'vi'
  const audioRef = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const audio = audioRef.current
    return () => audio?.pause()
  }, [])
  const continuePlaying = useRef(false)
  const loadedChapter = useRef<number | null>(null)
  const pendingSeek = useRef<number | null>(null)
  const requestedSentence = useRef<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(false)
  const [time, setTime] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [renderedChapter, setRenderedChapter] = useState(chapterId)
  const chapter = manifest.chapters.find(item => item.id === chapterId)!
  if (renderedChapter !== chapterId) {
    setRenderedChapter(chapterId)
    setTime(0)
    setPlaying(false)
    setError(false)
  }
  useLayoutEffect(() => {
    loadedChapter.current = null
    pendingSeek.current = null
    onSentenceChange(null)
    if (requestedSentence.current) {
      const sentence = chapter.sentences.find(item => item.id === requestedSentence.current)
      if (sentence) { pendingSeek.current = sentence.start; onSentenceChange(sentence.id) }
      requestedSentence.current = null
    }
    // Chapter selection, navigation, and automatic advancement share this path.
    // Playback resumes only when the preceding chapter was already playing.
  }, [chapterId, chapter.sentences, onSentenceChange])
  const play = async () => {
    setError(false)
    try { await audioRef.current?.play() } catch { continuePlaying.current = false; setError(true); setPlaying(false); onSentenceChange(null) }
  }
  const seek = (position: number) => {
    const target = Math.max(0, Math.min(chapter.duration, position))
    const audio = audioRef.current
    const alreadyLoaded = audio && audio.readyState >= 1 && audio.currentSrc.endsWith(chapter.src)
    if (audio && (loadedChapter.current === chapterId || alreadyLoaded)) {
      loadedChapter.current = chapterId
      audio.currentTime = target
      pendingSeek.current = null
    }
    else pendingSeek.current = target
    setTime(target)
    onSentenceChange(chapter.sentences.find(sentence => target >= sentence.start && target < sentence.end)?.id ?? null)
  }
  useImperativeHandle(ref, () => ({ startSentence(id) {
    const targetChapter = manifest.chapters.find(item => item.sentences.some(sentence => sentence.id === id))
    if (!targetChapter) return
    if (targetChapter.id !== chapterId) {
      requestedSentence.current = id
      continuePlaying.current = true
      onListeningChange(true)
      onChapterChange(targetChapter.id)
      return
    }
    const sentence = chapter.sentences.find(item => item.id === id)
    if (!sentence) return
    seek(sentence.start)
    onListeningChange(true)
    continuePlaying.current = true
    void play()
  } }))
  const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
  return <section className="novel-audio-player" aria-label={vi ? 'Nghe tiểu thuyết' : 'Novel narration'}>
    <div className="audio-heading"><strong>♫ {vi ? 'Nghe tiểu thuyết' : 'Listen to the story'}</strong><span>{vi ? 'Giọng Nhật · Keita · Tự động chuyển chương' : 'Japanese · Keita · Continuous chapters'}</span></div>
    <audio ref={audioRef} src={chapter.src} preload="metadata" onLoadedMetadata={() => {
      loadedChapter.current = chapterId
      if (audioRef.current) audioRef.current.playbackRate = speed
      if (pendingSeek.current !== null) { seek(pendingSeek.current); pendingSeek.current = null }
      if (continuePlaying.current) void play()
    }} onPlay={() => { continuePlaying.current = true; setPlaying(true); onListeningChange(true) }} onPause={() => {
      if (loadedChapter.current === chapterId) continuePlaying.current = false
      setPlaying(false)
    }} onEnded={() => {
      setPlaying(false)
      onSentenceChange(null)
      if (chapterId < manifest.chapters.length) { continuePlaying.current = true; onChapterChange(chapterId + 1) }
      else continuePlaying.current = false
    }} onTimeUpdate={event => {
      const time = event.currentTarget.currentTime
      setTime(time)
      onSentenceChange(chapter.sentences.find(sentence => time >= sentence.start && time < sentence.end)?.id ?? null)
    }} onError={() => { continuePlaying.current = false; setError(true); setPlaying(false); onSentenceChange(null) }} />
    <button className="audio-play" aria-label={vi ? playing ? 'Tạm dừng đọc' : 'Phát giọng đọc' : playing ? 'Pause narration' : 'Play narration'} onClick={() => {
      if (playing) { continuePlaying.current = false; audioRef.current?.pause() }
      else void play()
    }}>{playing ? '❚❚' : '▶'} {vi ? playing ? 'Tạm dừng' : 'Nghe' : playing ? 'Pause' : 'Listen'}</button>
    <button aria-label={vi ? 'Lùi 30 giây' : 'Back 30 seconds'} onClick={() => seek((audioRef.current?.currentTime ?? 0) - 30)}>−30s</button>
    <button aria-label={vi ? 'Tiến 30 giây' : 'Forward 30 seconds'} onClick={() => seek((audioRef.current?.currentTime ?? 0) + 30)}>+30s</button>
    <button disabled={chapterId === 1} aria-label={vi ? 'Nghe chương trước' : 'Previous audio chapter'} onClick={() => onChapterChange(chapterId - 1)}>⏮ {vi ? 'Trước' : 'Previous'}</button>
    <button disabled={chapterId === manifest.chapters.length} aria-label={vi ? 'Nghe chương tiếp' : 'Next audio chapter'} onClick={() => onChapterChange(chapterId + 1)}>{vi ? 'Tiếp' : 'Next'} ⏭</button>
    <label>{vi ? 'Tốc độ' : 'Speed'} <select aria-label={vi ? 'Tốc độ phát' : 'Playback speed'} value={speed} onChange={event => {
      const value = Number(event.target.value)
      setSpeed(value)
      if (audioRef.current) audioRef.current.playbackRate = value
    }}>{[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(rate => <option key={rate} value={rate}>{rate}×</option>)}</select></label>
    <div className="audio-timeline"><span>{clock(time)}</span><input type="range" aria-label={vi ? 'Vị trí phát' : 'Audio position'} min="0" max={chapter.duration} step="0.1" value={time} onChange={event => seek(Number(event.target.value))} /><span>{clock(chapter.duration)}</span></div>
    <div className="audio-downloads"><a href={chapter.src} download>{vi ? 'MP3 chương này' : 'Chapter MP3'}</a><a href={manifest.fullSrc} download>{vi ? 'MP3 toàn truyện' : 'Full novel MP3'}</a></div>
    {error && <p role="alert">{vi ? 'Không thể phát âm thanh. Hãy thử lại.' : 'Audio could not play. Please try again.'}</p>}
  </section>
}
