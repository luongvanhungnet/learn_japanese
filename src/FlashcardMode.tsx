import { useCallback, useEffect, useMemo, useState } from 'react'
import { LanguageSwitch } from './i18n'
import { useLanguage } from './translations'
import { flashcardStorageKey, getNextFlashcardDueAt, parseFlashcardProgress, rateFlashcard, selectDueFlashcard } from './flashcards'
import type { FlashcardDeck, FlashcardRating } from './flashcards'
import { flashcardDecks, sentenceFlashcards } from './flashcardDecks'
import './FlashcardMode.css'

const deckStorageKey = 'mimikara-flashcard-deck-v1'

function readInitialDeck(initialDeck?: FlashcardDeck): FlashcardDeck {
  if (initialDeck) return initialDeck
  try {
    const saved = window.localStorage.getItem(deckStorageKey) as FlashcardDeck
    if (flashcardDecks.includes(saved)) return saved
  } catch { /* private browsing */ }
  return 'N3'
}

export function FlashcardMode({ initialDeck, onClose }: { initialDeck?: FlashcardDeck; onClose: () => void }) {
  const { t, language, locale } = useLanguage()
  const [deck, setDeck] = useState(() => readInitialDeck(initialDeck))
  const [flipped, setFlipped] = useState(false)
  const [sessionReviews, setSessionReviews] = useState(0)
  const [lastRating, setLastRating] = useState<FlashcardRating | null>(null)
  const [storageError, setStorageError] = useState(false)
  const [now, setNow] = useState(Date.now)
  const [progress, setProgress] = useState(() => {
    try { return parseFlashcardProgress(window.localStorage.getItem(flashcardStorageKey)) } catch { return {} }
  })
  const cards = useMemo(() => sentenceFlashcards.filter((item) => item.deck === deck), [deck])
  // Keep the sentence being studied in place when an older review becomes due.
  const [activeId, setActiveId] = useState(() => selectDueFlashcard(cards, progress, now)?.id ?? null)
  const card = cards.find((item) => item.id === activeId) ?? selectDueFlashcard(cards, progress, now)
  const nextDue = card ? null : getNextFlashcardDueAt(cards, progress)
  const dueCount = cards.filter((item) => progress[item.id]?.dueAt <= now).length
  const newCount = cards.filter((item) => !progress[item.id]).length
  const ratings = [
    { rating: 'instant', key: 'a', label: t('flashcardInstant'), interval: t('flashcardMinute') },
    { rating: 'hard', key: 's', label: t('flashcardHard'), interval: t('flashcardFiveMinutes') },
    { rating: 'medium', key: 'd', label: t('flashcardMedium'), interval: t('flashcardDay') },
    { rating: 'ez', key: 'f', label: t('flashcardEz'), interval: t('flashcardThreeDays') },
  ] as const
  const lastReview = ratings.find((item) => item.rating === lastRating)
  const chooseDeck = useCallback((selected: FlashcardDeck) => {
    if (selected === deck) return
    const timestamp = Date.now()
    setDeck(selected)
    setNow(timestamp)
    setActiveId(selectDueFlashcard(sentenceFlashcards.filter((item) => item.deck === selected), progress, timestamp)?.id ?? null)
    setFlipped(false)
    setLastRating(null)
  }, [deck, progress])
  useEffect(() => {
    try {
      window.localStorage.setItem(flashcardStorageKey, JSON.stringify(progress))
    } catch {
      // Report a real failure from the external storage system to the learner.
      // oxlint-disable-next-line react/set-state-in-effect
      setStorageError(true)
    }
  }, [progress])
  useEffect(() => {
    try { window.localStorage.setItem(deckStorageKey, deck) } catch { /* schedule storage reports failures */ }
  }, [deck])
  useEffect(() => {
    if (nextDue === null) return
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(2_147_483_647, Math.max(0, nextDue - Date.now())))
    return () => window.clearTimeout(timer)
  }, [nextDue, now])
  useEffect(() => {
    const refresh = () => setNow(Date.now())
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  const rate = useCallback((rating: FlashcardRating) => {
    if (!card || !flipped) return
    const reviewedAt = Date.now()
    const updated = rateFlashcard(progress, card.id, rating, reviewedAt)
    setProgress(updated)
    setActiveId(selectDueFlashcard(cards, updated, reviewedAt)?.id ?? null)
    setNow(reviewedAt)
    setFlipped(false)
    setSessionReviews((count) => count + 1)
    setLastRating(rating)
    setStorageError(false)
  }, [card, cards, progress, flipped])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]'))) return
      const key = event.key.toLowerCase()
      if (key === ' ' && card) {
        event.preventDefault()
        if (event.repeat) return
        setFlipped((value) => !value)
      } else {
        if (event.repeat) return
        const rating = ({ a: 'instant', s: 'hard', d: 'medium', f: 'ez' } as const)[key]
        if (rating && card && flipped) {
          event.preventDefault()
          rate(rating)
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [card, flipped, rate])
  return <main className="flashcard-shell">
    <header className="flashcard-header">
      <div className="brand"><span className="brand-mark">み</span><span>MIMIKARA <strong>STUDY</strong></span></div>
      <button className="flashcard-back" type="button" onClick={onClose}>{t('flashcardBack')}</button>
      <LanguageSwitch />
    </header>
    <section className="flashcard-workspace">
      <div className="flashcard-heading">
        <span className="eyebrow">{t('flashcardDaily')}</span>
        <h1>{t('flashcard')}</h1>
        <p>{t('flashcardInstructions')}</p>
      </div>
      <div className="flashcard-decks" role="group" aria-label={t('flashcardDecks')}>
        {flashcardDecks.map((item) => <button type="button" key={item} aria-pressed={deck === item} onClick={() => chooseDeck(item)}>{item === 'N3-GRAMMAR' ? t('grammar') : item === 'RADICALS' ? t('radicals') : item}</button>)}
      </div>
      <div className="flashcard-summary">
        <span>{t('flashcardCount', { count: cards.length })}</span>
        <span>{t('flashcardDue')} <strong>{dueCount}</strong></span>
        <span>{t('flashcardNew')} <strong>{newCount}</strong></span>
        <span>{t('flashcardScheduled')} <strong>{cards.length - dueCount - newCount}</strong></span>
        <span className="flashcard-summary-reviewed">{t('flashcardReviewed', { count: sessionReviews })}</span>
      </div>
      {card && <div className="flashcard-stage">
        <article key={card.id} tabIndex={0} className={`flashcard-card${flipped ? ' is-flipped' : ''}`} aria-label={t('flashcardSentence')}>
          <div className="flashcard-card-label">{t('flashcardSentence')}</div>
          <p className="flashcard-japanese" lang="ja">{card.japanese}</p>
          {!flipped && <p className="flashcard-card-label">{t('flashcardRecall')}</p>}
          {flipped && <div className="flashcard-answer">
            {card.reading && <p className="flashcard-reading" lang="ja">{card.reading}</p>}
            {card.romaji && <p className="flashcard-romaji">{card.romaji}</p>}
            <p className="flashcard-translation" lang={language}>{card[language]}</p>
            <div className="flashcard-word"><span>{t(deck === 'N3-GRAMMAR' ? 'grammarPattern' : deck === 'RADICALS' ? 'radicals' : 'vocabulary')}</span><strong lang="ja">{card.target}</strong></div>
            {card.notes && <p className="flashcard-translation flashcard-note" lang={language}>{card.notes[language]}</p>}
          </div>}
        </article>
        <div className="flashcard-actions">
          <button type="button" className="flashcard-flip" aria-label={t(flipped ? 'flashcardHide' : 'flashcardFlip')} aria-expanded={flipped} onClick={() => setFlipped((value) => !value)}>{t(flipped ? 'flashcardHide' : 'flashcardFlip')} <kbd aria-hidden="true">Space</kbd></button>
          <div className="flashcard-ratings">
            {ratings.map(({ rating, key, label, interval }) => <button type="button" key={rating} className={`flashcard-rating rating-${rating}`} disabled={!flipped} aria-label={`${label} · ${interval} · ${key.toUpperCase()}`} onClick={() => rate(rating)}><b>{label}</b><span>{interval}</span><kbd aria-hidden="true">{key.toUpperCase()}</kbd></button>)}
          </div>
        </div>
      </div>}
      {!card && <div className="flashcard-empty" role="status">
        <h2>{t('flashcardAllDone')}</h2>
        <p>{t('flashcardAllDoneHint')}</p>
        {nextDue !== null && <p className="flashcard-next-review">{t('flashcardNextReview', { time: new Date(nextDue).toLocaleString(locale) })}</p>}
      </div>}
      <p className="flashcard-shortcuts"><kbd>Space</kbd> {t('flashcardFlip')} · <kbd>A</kbd> {t('flashcardInstant')} · <kbd>S</kbd> {t('flashcardHard')} · <kbd>D</kbd> {t('flashcardMedium')} · <kbd>F</kbd> {t('flashcardEz')}<br />{t('flashcardRateHint')}</p>
      <p className="flashcard-feedback" role="status">{lastReview && t('flashcardReviewSaved', { rating: lastReview.label, interval: lastReview.interval })}</p>
      {storageError && <p className="flashcard-feedback" role="alert">{t('flashcardStorageError')}</p>}
      <footer className="flashcard-footer"><span>{t('flashcardScope')}</span><span>{t('savedProgress')}</span></footer>
    </section>
  </main>
}
