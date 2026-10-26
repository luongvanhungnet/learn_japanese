import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LanguageSwitch } from './i18n'
import { useLanguage } from './translations'
import { AccountMenu } from './AccountMenu'
import { useAuth } from './auth/AuthProvider'
import { readStudyValue } from './accountData'
import { useStudyPersistence } from './useStudyPersistence'
import { parseWordProgress, reviewWord, selectWord, wordDeckKey, wordDecks, wordProgressKey } from './vocabularyFlashcards'
import type { WordDeck, WordRating } from './vocabularyFlashcards'
import './VocabularyFlashcardMode.css'

export function VocabularyFlashcardMode({ initialDeck, onClose }: { initialDeck?: WordDeck; onClose: () => void }) {
  const { t, language, locale } = useLanguage()
  const auth = useAuth()
  const busy = Boolean(auth?.loading || auth?.initializing)
  const vi = language === 'vi'
  const root = useRef<HTMLElement>(null)
  const [deck, setDeck] = useState<WordDeck>(() => {
    if (initialDeck) return initialDeck
    try { return readStudyValue(wordDeckKey) === 'RADICALS' ? 'RADICALS' : 'N3' } catch { return 'N3' }
  })
  const [progress, setProgress] = useState(() => {
    try { return parseWordProgress(readStudyValue(wordProgressKey)) } catch { return {} }
  })
  const [now, setNow] = useState(Date.now)
  const cards = wordDecks[deck]
  const [activeId, setActiveId] = useState<string | null>(() => selectWord(cards, progress, now))
  const card = cards.find(item => item.id === activeId) ?? cards.find(item => item.id === selectWord(cards, progress, now))
  const [revealed, setRevealed] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [fullscreenError, setFullscreenError] = useState(false)
  const [lastReview, setLastReview] = useState<WordRating | null>(null)
  const reportError = useCallback(() => setStorageError(true), [])
  useStudyPersistence(wordProgressKey, useMemo(() => JSON.stringify(progress), [progress]), reportError)
  useStudyPersistence(wordDeckKey, deck, reportError)
  const dueCount = cards.filter(item => !progress[item.id] || progress[item.id].dueAt <= now).length
  const nextDue = card ? null : Math.min(...cards.map(item => progress[item.id]?.dueAt ?? Infinity))
  const intervals = {
    minutes: vi ? '5 phút' : '5 minutes',
    hours: vi ? '5 giờ' : '5 hours',
    week: vi ? '7 ngày' : '7 days',
  }
  const rate = useCallback((rating: WordRating) => {
    if (!card || busy) return
    const timestamp = Date.now()
    const updated = reviewWord(progress, card.id, rating, timestamp)
    setProgress(updated)
    setActiveId(selectWord(cards, updated, timestamp))
    setNow(timestamp)
    setRevealed(false)
    setLastReview(rating)
    setStorageError(false)
  }, [card, cards, progress, busy])
  const chooseDeck = useCallback((selected: WordDeck) => {
    const timestamp = Date.now()
    setDeck(selected)
    setActiveId(selectWord(wordDecks[selected], progress, timestamp))
    setNow(timestamp)
    setRevealed(false)
    setLastReview(null)
  }, [progress])
  useEffect(() => {
    if (nextDue === null || !Number.isFinite(nextDue)) return
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(2_147_483_647, Math.max(0, nextDue - Date.now())))
    return () => window.clearTimeout(timer)
  }, [nextDue, now])
  useEffect(() => {
    const refresh = () => setNow(Date.now())
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (busy || event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"], .auth-controls')) return
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) || !card) return
      event.preventDefault()
      if (event.repeat) return
      if (event.key === 'ArrowUp') setRevealed(true)
      else rate(event.key === 'ArrowDown' ? 'week' : event.key === 'ArrowLeft' ? 'minutes' : 'hours')
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [busy, card, rate])
  useEffect(() => {
    const element = root.current
    const change = () => setFullscreen(document.fullscreenElement === element)
    document.addEventListener('fullscreenchange', change)
    return () => {
      document.removeEventListener('fullscreenchange', change)
      if (element && document.fullscreenElement === element) void document.exitFullscreen().catch(() => {})
    }
  }, [])
  const toggleFullscreen = async () => {
    try {
      setFullscreenError(false)
      if (document.fullscreenElement) await document.exitFullscreen()
      else await root.current?.requestFullscreen()
    } catch { setFullscreenError(true) }
  }
  return <main className="word-flashcards" ref={root}>
    <header className="word-flashcards-header">
      <button type="button" onClick={onClose}>← {t('flashcardBack')}</button>
      <h1>{t('wordFlashcard')}</h1>
      <button type="button" onClick={() => void toggleFullscreen()}>{t(fullscreen ? 'exitFullscreen' : 'fullscreen')}</button>
      <LanguageSwitch /><AccountMenu />
    </header>
    <div className="word-flashcards-tools">
      <div role="group" aria-label={t('flashcardDecks')}>
        {(['N3', 'RADICALS'] as const).map(item => <button type="button" key={item} aria-pressed={deck === item} onClick={() => chooseDeck(item)}>{item === 'N3' ? 'N3' : t('radicals')}</button>)}
      </div>
      <span>{dueCount} / {cards.length} {vi ? 'thẻ cần học' : 'cards to study'}</span>
    </div>
    {fullscreenError && <p role="alert">{t('fullscreenError')}</p>}
    <section className="word-flashcards-stage" aria-label={t('wordFlashcard')}>
      {card ? <article className="word-flashcards-card" key={card.id} aria-label={card.headword}>
        <span className="word-flashcards-tag">{deck === 'N3' ? 'N3' : t('radicals')} · {card.order} / {cards.length}</span>
        <p className="word-flashcards-word" lang="ja">{card.headword}</p>
        {revealed ? <dl className="word-flashcards-answer">
          <div><dt>{t('meaning')}</dt><dd lang={language}>{(vi ? card.meaningsVi : card.meanings).join(' · ')}</dd></div>
          <div><dt>Hiragana / Katakana</dt><dd lang="ja">{card.reading || '—'}</dd></div>
          <div><dt>{t('hanViet')}</dt><dd>{card.hanViet || '—'}</dd></div>
        </dl> : <p className="word-flashcards-prompt">{vi ? 'Nhớ nghĩa và cách đọc, rồi nhấn ↑ để xem đáp án' : 'Recall the meaning and reading, then press ↑ to reveal'}</p>}
      </article> : <div className="word-flashcards-empty" role="status">
        <h2>{t('flashcardAllDone')}</h2>
        {nextDue !== null && Number.isFinite(nextDue) && <p>{t('flashcardNextReview', { time: new Date(nextDue).toLocaleString(locale) })}</p>}
      </div>}
    </section>
    <footer className="word-flashcards-footer">
      <div className="word-flashcards-actions">
        <button type="button" disabled={!card || busy} onClick={() => rate('minutes')}><kbd>←</kbd><span>{intervals.minutes}</span></button>
        <button type="button" disabled={!card || busy} aria-expanded={revealed} onClick={() => setRevealed(true)}><kbd>↑</kbd><span>{vi ? 'Hiện đáp án' : 'Show answer'}</span></button>
        <button type="button" disabled={!card || busy} onClick={() => rate('week')}><kbd>↓</kbd><span>{intervals.week}</span></button>
        <button type="button" disabled={!card || busy} onClick={() => rate('hours')}><kbd>→</kbd><span>{intervals.hours}</span></button>
      </div>
      <p className="word-flashcards-feedback" role="status">{lastReview ? (vi ? `Đã lưu · Ôn lại sau ${intervals[lastReview]}` : `Saved · Review in ${intervals[lastReview]}`) : (vi ? 'Chọn thời gian ôn lại bằng phím mũi tên hoặc nút bấm.' : 'Choose your next review with the arrow keys or buttons.')}</p>
      {storageError && <p role="alert">{t('flashcardStorageError')}</p>}
      <small>{t(auth?.user ? 'accountAutoSave' : 'savedProgress')}</small>
    </footer>
  </main>
}
