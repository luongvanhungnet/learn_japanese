import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import n2Data from './data/n2.json'
import n3Data from './data/n3.json'
import vietnameseMeanings from './data/vi.json'
import { LanguageProvider, LanguageSwitch } from './i18n'
import { useLanguage } from './translations'
import type { Language } from './translations'
import { hintPrefix, isCorrect, nextHint, parseProgress, submitAnswer } from './learning'
import type { CellProgress, Field, Mode, Progress } from './learning'
import './App.css'

type Level = 'N3' | 'N2'
type VocabularyEntry = {
  id: string
  level: Level
  order: number
  headword: string
  reading: string
  hanViet: string | null
  meanings: string[]
}

const collections: Record<Level, VocabularyEntry[]> = {
  N3: n3Data as VocabularyEntry[],
  N2: n2Data as VocabularyEntry[],
}
const fields: Field[] = ['reading', 'hanViet', 'meaning']
const storageKey = 'mimikara-progress-v1'
const storedKey = (key: string, language: Language) => language === 'vi' && key.endsWith(':meaning') ? `${key}:vi` : key

function getAnswer(entry: VocabularyEntry, field: Field): string {
  if (field === 'reading') return entry.reading
  if (field === 'hanViet') return entry.hanViet ?? ''
  return entry.meanings[0] ?? ''
}

function getAccepted(entry: VocabularyEntry, field: Field): string[] {
  if (field === 'meaning') return entry.meanings
  return [getAnswer(entry, field)]
}

type CellProps = {
  entry: VocabularyEntry
  field: Field
  status?: CellProgress
  mode: Mode
  focus?: boolean
  preview: boolean
  onSubmit: (key: string, input: string, correct: boolean) => void
  onHint: (key: string, answer: string) => void
  onPreview: (key: string) => void
}

const PracticeCell = memo(function PracticeCell({
  entry, field, status, mode, focus = false, preview, onSubmit, onHint, onPreview,
}: CellProps) {
  const { t, labels } = useLanguage()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => {
    if (editing) inputRef.current?.focus({ preventScroll: true })
  }, [editing])
  const key = `${entry.id}:${field}`
  const answer = getAnswer(entry, field)
  const unavailable = !answer
  const hiddenInReview = mode === 'review' && !status?.unresolved
  const solved = Boolean(status?.solved && !(mode === 'review' && status.unresolved))
  const hint = hintPrefix(answer, status?.hints ?? 0)
  const targetLabel = focus ? entry.headword : t('wordNumber', { order: entry.order })
  const showAnswer = () => {
    onPreview(key)
    inputRef.current?.focus({ preventScroll: true })
  }

  if (unavailable || hiddenInReview) {
    return <span className="cell-unavailable" aria-label={unavailable ? t('noReading') : t('noReview')}>—</span>
  }
  if (solved) {
    const savedAnswer = status?.answer
    const displayAnswer = savedAnswer && (field !== 'meaning' || isCorrect(field, savedAnswer, entry.meanings)) ? savedAnswer : answer
    return <div className="answer-value answer-correct" title={getAccepted(entry, field).join(' · ')}>{displayAnswer}<span aria-hidden="true">✓</span></div>
  }
  if (!editing) {
    return (
      <button type="button" className={`concealed-cell ${status?.unresolved ? 'has-mistake' : ''}`} onClick={() => setEditing(true)} aria-label={t('enterLabel', { field: labels[field], target: targetLabel })}>
        {hint ? <span className="hint-text">{hint}<span className="hint-cursor">···</span></span> : <span className="concealed-label">{t('clickAnswer')} <span aria-hidden="true">↗</span></span>}
      </button>
    )
  }
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const correct = isCorrect(field, draft, getAccepted(entry, field))
    onSubmit(key, draft.trim(), correct)
    setError(!correct)
    if (correct) {
      setEditing(false)
      setDraft('')
    } else {
      setDraft('')
      inputRef.current?.focus({ preventScroll: true })
    }
  }
  return (
    <form className={`practice-form ${error ? 'input-error' : ''}`} onSubmit={handleSubmit}>
      <div className="input-line">
        <input
          ref={inputRef}
          aria-label={t('inputLabel', { field: labels[field], target: targetLabel })}
          value={draft}
          onChange={(event) => { setDraft(event.target.value); setError(false) }}
          placeholder={field === 'reading' ? t('kanaPlaceholder') : field === 'hanViet' ? t('hanVietPlaceholder') : t('meaningPlaceholder')}
        />
        <button type="submit" className="check-button" aria-label={t('checkAnswer')}>↵</button>
      </div>
      <div className="cell-tools">
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onHint(key, answer); inputRef.current?.focus({ preventScroll: true }) }}>Hint+ <kbd>Alt+A</kbd></button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={showAnswer}>{t('answer')} <kbd>Alt+S</kbd></button>
        <button type="button" onClick={() => { setEditing(false); setError(false) }}>{t('close')}</button>
      </div>
      {hint && <span className="hint-line">{t('hint')} {hint}</span>}
      {error && <span className="error-line" role="alert">{t('incorrect')}</span>}
      {preview && <div className="answer-preview" role="status">{field === 'meaning' ? entry.meanings.join(', ') : answer}</div>}
    </form>
  )
})

type RowProps = {
  entry: VocabularyEntry
  mode: Mode
  reading?: CellProgress
  hanViet?: CellProgress
  meaning?: CellProgress
  previewKey: string | null
  onSubmit: CellProps['onSubmit']
  onHint: CellProps['onHint']
  onPreview: CellProps['onPreview']
}

const VocabularyRow = memo(function VocabularyRow({
  entry, mode, reading, hanViet, meaning, previewKey, onSubmit, onHint, onPreview,
}: RowProps) {
  const statuses = { reading, hanViet, meaning }
  return (
    <tr id={`row-${entry.id}`}>
      <th scope="row" className="number-cell">{String(entry.order).padStart(3, '0')}</th>
      <td className="word-cell"><span lang="ja">{entry.headword}</span></td>
      {fields.map((field) => (
        <td key={field} id={`practice-${entry.id}:${field}`} data-practice-key={`${entry.id}:${field}`} className={`practice-cell practice-${field}`}>
          <PracticeCell entry={entry} field={field} status={statuses[field]} mode={mode} preview={previewKey === `${entry.id}:${field}`} onSubmit={onSubmit} onHint={onHint} onPreview={onPreview} />
        </td>
      ))}
    </tr>
  )
})

type OverviewProps = {
  entries: VocabularyEntry[]
  level: Level
  progress: Progress
  onClose: () => void
  onJump: (order: number) => void
}

function Overview({ entries, level, progress, onClose, onJump }: OverviewProps) {
  const { t, locale } = useLanguage()
  const [height, setHeight] = useState(window.innerHeight)
  useEffect(() => {
    const update = () => setHeight(window.innerHeight)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  const rows = Math.max(20, Math.floor((height - 120) / 11))
  const columns = Math.ceil(entries.length / rows)
  return (
    <div className="overview-overlay" role="dialog" aria-modal="true" aria-label={t('overviewLabel', { level })}>
      <div className="overview-head">
        <div><span className="eyebrow">{t('vocabularyMap')}</span><h2>{level} <small>· {entries.length.toLocaleString(locale)} {t('words')}</small></h2></div>
        <div className="overview-head-right"><span>{t('selectWord')}</span><button type="button" className="close-overview" onClick={onClose} aria-label={t('closeOverview')}>✕</button></div>
      </div>
      <div className="overview-grid" style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {entries.map((entry) => {
          const statuses = fields.filter((field) => getAnswer(entry, field)).map((field) => progress[`${entry.id}:${field}`])
          const hasMistake = statuses.some((status) => status?.unresolved)
          const complete = statuses.length > 0 && statuses.every((status) => status?.solved)
          return <button key={entry.id} type="button" className={`overview-tile ${hasMistake ? 'tile-mistake' : complete ? 'tile-done' : ''}`} title={`${entry.order}. ${entry.headword}`} onClick={() => onJump(entry.order)} aria-label={t('goToWord', { order: entry.order, word: entry.headword })}><span>{entry.headword}</span></button>
        })}
      </div>
      <div className="overview-legend"><span><i className="legend-dot" /> {t('notStudied')}</span><span><i className="legend-dot done" /> {t('correct')}</span><span><i className="legend-dot mistake" /> {t('needsReview')}</span></div>
    </div>
  )
}

function StudyApp() {
  const { t, labels, locale, language } = useLanguage()
  const [level, setLevel] = useState<Level>('N3')
  const [mode, setMode] = useState<Mode>('study')
  const [focused, setFocused] = useState(false)
  const [focusField, setFocusField] = useState<Field>('meaning')
  const [zoom, setZoom] = useState(100)
  const [overview, setOverview] = useState(false)
  const [jumpTarget, setJumpTarget] = useState<number | null>(null)
  const [previewKey, setPreviewKey] = useState<string | null>(null)
  const advanceFromRef = useRef<{ key: string; top: number } | null>(null)
  const selectedKeyRef = useRef<string | null>(null)
  const previewTimerRef = useRef<number | null>(null)
  const [allProgress, setProgress] = useState<Progress>(() => {
    try { return parseProgress(window.localStorage.getItem(storageKey)) } catch { return {} }
  })
  const progress = useMemo(() => {
    const selected: Progress = {}
    for (const [key, value] of Object.entries(allProgress)) {
      if (key.endsWith(':meaning:vi')) {
        if (language === 'vi') selected[key.slice(0, -3)] = value
      } else if (language === 'en' || !key.endsWith(':meaning')) {
        selected[key] = value
      }
    }
    return selected
  }, [allProgress, language])

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(allProgress)) } catch { /* private browsing */ }
  }, [allProgress])
  useEffect(() => {
    if (overview || jumpTarget === null) return
    const frame = requestAnimationFrame(() => {
      document.getElementById(`row-${level.toLowerCase()}:${jumpTarget}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      setJumpTarget(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [overview, jumpTarget, level, mode])

  const entries = useMemo(() => language === 'en' ? collections[level] : collections[level].map((entry) => ({ ...entry, meanings: (vietnameseMeanings[level] as Record<string, string[]>)[entry.id] ?? entry.meanings })), [level, language])
  const unresolved = useMemo(() => Object.entries(progress).filter(([key, value]) => key.startsWith(level.toLowerCase() + ':') && value.unresolved).length, [progress, level])
  const visible = useMemo(() => mode === 'study' ? entries : entries.filter((entry) => fields.some((field) => progress[`${entry.id}:${field}`]?.unresolved)), [entries, mode, progress])
  useEffect(() => {
    const advanceFrom = advanceFromRef.current
    if (!advanceFrom) return
    advanceFromRef.current = null
    const separator = advanceFrom.key.lastIndexOf(':')
    const source = entries.find((entry) => entry.id === advanceFrom.key.slice(0, separator))
    const field = advanceFrom.key.slice(separator + 1)
    if (source) {
      for (const entry of entries) {
        if (entry.order <= source.order) continue
        const cell = document.getElementById(`practice-${entry.id}:${field}`)
        const input = cell?.querySelector<HTMLInputElement>('input')
        const button = cell?.querySelector<HTMLButtonElement>('button.concealed-cell')
        if (!input && !button) continue
        if (input) input.focus({ preventScroll: true })
        else button?.click()
        const frame = requestAnimationFrame(() => {
          const nextInput = cell?.querySelector<HTMLInputElement>('input')
          if (!nextInput) return
          const distance = nextInput.getBoundingClientRect().top - advanceFrom.top
          if (Math.abs(distance) < 1) return
          const viewport = cell?.closest<HTMLElement>('.table-viewport')
          if (viewport) viewport.scrollBy({ top: distance, behavior: 'smooth' })
          else window.scrollBy({ top: distance, behavior: 'smooth' })
        })
        return () => cancelAnimationFrame(frame)
      }
    }
  }, [entries, visible, focused, focusField, progress])
  const totalCells = useMemo(() => entries.reduce((sum, entry) => sum + fields.filter((field) => getAnswer(entry, field)).length, 0), [entries])
  const solvedCells = useMemo(() => entries.reduce((sum, entry) => sum + fields.filter((field) => getAnswer(entry, field) && progress[`${entry.id}:${field}`]?.solved).length, 0), [entries, progress])
  const completedPercent = Math.round((solvedCells / totalCells) * 100)
  const onSubmit = useCallback((key: string, input: string, correct: boolean) => {
    if (correct) {
      const sourceInput = document.getElementById(`practice-${key}`)?.querySelector('input')
      if (sourceInput) advanceFromRef.current = { key, top: sourceInput.getBoundingClientRect().top }
    }
    setProgress((old) => submitAnswer(old, storedKey(key, language), correct, mode, input))
  }, [mode, language])
  const onHint = useCallback((key: string, answer: string) => setProgress((old) => nextHint(old, storedKey(key, language), answer)), [language])
  const onPreview = useCallback((key: string) => {
    if (previewTimerRef.current !== null) window.clearTimeout(previewTimerRef.current)
    setPreviewKey(key)
    previewTimerRef.current = window.setTimeout(() => { setPreviewKey(null); previewTimerRef.current = null }, 1000)
  }, [])
  useEffect(() => () => { if (previewTimerRef.current !== null) window.clearTimeout(previewTimerRef.current) }, [])
  useEffect(() => {
    const onFocus = (event: FocusEvent) => {
      const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-practice-key]')
      if (cell?.dataset.practiceKey) selectedKeyRef.current = cell.dataset.practiceKey
    }
    const onShortcut = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || overview) return
      const shortcut = event.key.toLowerCase()
      const hint = shortcut === 'a' || event.code === 'KeyA'
      const answer = shortcut === 's' || event.code === 'KeyS'
      if (!hint && !answer) return

      const active = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-practice-key]')
      const selected = active ?? (selectedKeyRef.current ? document.getElementById(`practice-${selectedKeyRef.current}`) : null)
      const available = (cell: HTMLElement | null) => Boolean(cell?.querySelector('input, button.concealed-cell'))
      const cell = available(selected) ? selected : Array.from(document.querySelectorAll<HTMLElement>('[data-practice-key]')).find(available)
      const key = cell?.dataset.practiceKey
      if (!key) return
      const separator = key.lastIndexOf(':')
      const entry = entries.find((item) => item.id === key.slice(0, separator))
      const field = key.slice(separator + 1) as Field
      if (!entry || !fields.includes(field)) return

      event.preventDefault()
      event.stopPropagation()
      selectedKeyRef.current = key
      cell.querySelector<HTMLButtonElement>('button.concealed-cell')?.click()
      if (hint) onHint(key, getAnswer(entry, field))
      else onPreview(key)
    }
    document.addEventListener('focusin', onFocus)
    document.addEventListener('keydown', onShortcut, true)
    return () => {
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('keydown', onShortcut, true)
    }
  }, [entries, onHint, onPreview, overview])
  const jump = (order: number) => { setMode('study'); setOverview(false); setJumpTarget(order) }

  if (focused) {
    return (
      <main className="focus-shell" style={{ '--scale': 1 } as React.CSSProperties} aria-label={t('focusMode')}>
        <div className="focus-controls"><LanguageSwitch />
          <button type="button" className="focus-exit" onClick={() => setFocused(false)}>← {t('fullList')}</button>
          <div className="focus-options" role="group" aria-label={t('selectSet')}>
            {(['N3', 'N2'] as Level[]).map((item) => <button key={item} type="button" aria-pressed={level === item} onClick={() => setLevel(item)}>{item}</button>)}
          </div>
          <div className="focus-options" role="group" aria-label={t('selectColumn')}>
            {fields.map((field) => <button key={field} type="button" aria-pressed={focusField === field} onClick={() => setFocusField(field)}>{labels[field]}</button>)}
          </div>
        </div>
        <div className="focus-list" key={`${level}-${focusField}`}>
          {entries.map((entry) => (
            <div className="focus-row" key={`${entry.id}-${language}`} role="group" aria-label={t('wordLabel', { word: entry.headword })}>
              <span className="focus-word" lang="ja">{entry.headword}</span>
              <div className="focus-practice" id={`practice-${entry.id}:${focusField}`} data-practice-key={`${entry.id}:${focusField}`}>
                <PracticeCell entry={entry} field={focusField} status={progress[`${entry.id}:${focusField}`]} mode="study" focus preview={previewKey === `${entry.id}:${focusField}`} onSubmit={onSubmit} onHint={onHint} onPreview={onPreview} />
              </div>
            </div>
          ))}
        </div>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand"><span className="brand-mark">み</span><span>MIMIKARA <strong>STUDY</strong></span></div>
        <div className="header-right"><LanguageSwitch /><span className="header-note">{t('headerNote')}</span><span className="local-badge"><i /> {t('savedDevice')}</span></div>
      </header>
      <main className="main-content">
        <section className="intro">
          <div>
            <span className="eyebrow">{t('dailyPractice')}</span>
            <h1>{t('headline')}<br /><em>{t('headlineAccent')}</em></h1>
            <p>{t('instructions')}</p>
          </div>
          <div className="intro-decoration" aria-hidden="true"><span>語</span><small>一語ずつ</small></div>
        </section>

        <section className="workspace" aria-label={t('practiceTable')}>
          <div className="workspace-top">
            <div className="level-group" role="group" aria-label={t('selectLevel')}>
              {(['N3', 'N2'] as Level[]).map((item) => <button type="button" key={item} className={level === item ? 'selected' : ''} onClick={() => { setLevel(item); setMode('study'); setOverview(false) }}>{item}<small>{collections[item].length.toLocaleString(locale)} {t('words')}</small></button>)}
            </div>
            <div className="progress-summary"><div><strong>{solvedCells.toLocaleString(locale)}</strong><span> / {totalCells.toLocaleString(locale)} {t('cellsCorrect')}</span><b>{completedPercent}%</b></div><div className="progress-track"><span style={{ width: `${completedPercent}%` }} /></div></div>
          </div>
          <div className="toolbar">
            <div className="mode-group" role="group" aria-label={t('studyMode')}><button type="button" className={mode === 'study' ? 'active' : ''} onClick={() => setMode('study')}>{t('wordList')}</button><button type="button" className={mode === 'review' ? 'active' : ''} onClick={() => setMode('review')}>{t('reviewMistakes')} <span>{unresolved}</span></button><button type="button" onClick={() => { setMode('study'); setOverview(false); setFocused(true); window.scrollTo({ top: 0 }) }}>{t('focus')}</button></div>
            <div className="zoom-controls"><span>{t('zoom')}</span><button type="button" aria-label={t('zoomOut')} onClick={() => setZoom((value) => Math.max(70, value - 10))}>−</button><input type="range" min="70" max="140" step="10" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label={t('listZoom')} /><button type="button" aria-label={t('zoomIn')} onClick={() => setZoom((value) => Math.min(140, value + 10))}>+</button><output>{zoom}%</output><button type="button" className="overview-button" onClick={() => setOverview(true)}>▦ {t('overview')}</button></div>
          </div>
          <div className="table-caption"><span>{mode === 'study' ? t('showingAll', { count: entries.length.toLocaleString(locale), level }) : t('showingReview', { count: visible.length.toLocaleString(locale) })}</span><span>{t('hintExplanation')}</span></div>
          {mode === 'review' && visible.length === 0 ? (
            <div className="empty-state"><span>✓</span><h2>{t('noMistakes')}</h2><p>{t('reviewExplanation')}</p><button type="button" onClick={() => setMode('study')}>{t('backToList')}</button></div>
          ) : (
            <div key={`${level}-${mode}`} className="table-viewport" style={{ '--scale': zoom / 100 } as React.CSSProperties}>
              <table className="vocab-table"><thead><tr><th scope="col" className="number-cell">{t('number')}</th><th scope="col" className="word-cell">{t('vocabulary')}</th><th scope="col">{t('reading')} <small>ひらがな / カタカナ</small></th><th scope="col">Hán Việt</th><th scope="col">{t('meaning')}</th></tr></thead><tbody>{visible.map((entry) => <VocabularyRow key={`${entry.id}-${language}`} entry={entry} mode={mode} reading={progress[`${entry.id}:reading`]} hanViet={progress[`${entry.id}:hanViet`]} meaning={progress[`${entry.id}:meaning`]} previewKey={previewKey} onSubmit={onSubmit} onHint={onHint} onPreview={onPreview} />)}</tbody></table>
            </div>
          )}
        </section>
        <footer className="page-footer"><span>Mimikara Study · N3 / N2 · {t('englishMeanings')} <a href="https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project">JMdict</a> (<a href="/JMdict-LICENSE.txt">CC BY-SA 4.0</a>)</span><span>{t('savedProgress')}</span></footer>
      </main>
      {overview && <Overview entries={entries} level={level} progress={progress} onClose={() => setOverview(false)} onJump={jump} />}
    </div>
  )
}

export default function App() {
  return <LanguageProvider><StudyApp /></LanguageProvider>
}
