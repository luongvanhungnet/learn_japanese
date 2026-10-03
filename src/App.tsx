import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import n2Data from './data/n2.json'
import n3Data from './data/n3.json'
import grammarData from './data/n3-grammar.json'
import radicalsData from './data/radicals.json'
import vietnameseMeanings from './data/vi.json'
import { LanguageProvider, LanguageSwitch } from './i18n'
import { FocusHeader } from './FocusHeader'
import { useLanguage } from './translations'
import type { Language } from './translations'
import { hintPrefix, isCorrect, nextHint, parseProgress, revealAnswer, submitAnswer } from './learning'
import type { CellProgress, Field, Mode, Progress } from './learning'
import './App.css'
const NovelReader = lazy(() => import('./NovelReader').then((module) => ({ default: module.NovelReader })))

type Level = 'N3' | 'N2' | 'RADICALS' | 'N3-GRAMMAR'
type DisplayMode = '1' | '2' | '3'
type VocabularyEntry = {
  id: string
  level: Level
  order: number
  headword: string
  reading: string
  hanViet: string | null
  meanings: string[]
  meaningsVi?: string[]
  readings?: string[]
  strokes?: number
  variants?: string[]
  formations?: string[]
  examples?: { japanese: string; en: string; vi: string; sourceJapanese?: string; furigana: { text: string; reading: string }[] }[]
  notes?: { en: string; vi: string }
  sourcePage?: number
}

const collections: Record<Level, VocabularyEntry[]> = {
  N3: n3Data as VocabularyEntry[],
  N2: n2Data as VocabularyEntry[],
  RADICALS: radicalsData as VocabularyEntry[],
  'N3-GRAMMAR': grammarData.map((entry) => ({ ...entry, level: 'N3-GRAMMAR', headword: entry.pattern, reading: '', hanViet: null, meanings: entry.meanings.en, meaningsVi: entry.meanings.vi })),
}
const levels: Level[] = ['N3', 'N3-GRAMMAR', 'N2', 'RADICALS']
const vocabularyFields: Field[] = ['reading', 'hanViet', 'meaning']
const grammarFields: Field[] = ['formation', 'meaning']
const collectionFields = (level: Level) => level === 'N3-GRAMMAR' ? grammarFields : vocabularyFields
const storageKey = 'mimikara-progress-v1'
const storedKey = (key: string, language: Language) => language === 'vi' && key.endsWith(':meaning') ? `${key}:vi` : key

function getAnswer(entry: VocabularyEntry, field: Field): string {
  if (field === 'formation') return entry.formations?.[0] ?? ''
  if (field === 'reading') return entry.reading
  if (field === 'hanViet') return entry.hanViet ?? ''
  return entry.meanings[0] ?? ''
}

function getAccepted(entry: VocabularyEntry, field: Field): string[] {
  if (field === 'formation') return entry.formations ?? []
  if (field === 'meaning') return entry.meanings
  if (field === 'reading' && entry.readings) return entry.readings
  return [getAnswer(entry, field)]
}

type CellProps = {
  entry: VocabularyEntry
  field: Field
  status?: CellProgress
  mode: Mode
  focus?: boolean
  displayMode?: DisplayMode
  preview: boolean
  onSubmit: (key: string, input: string, correct: boolean) => void
  onHint: (key: string, answer: string) => void
  onPreview: (key: string) => void
}

const PracticeCell = memo(function PracticeCell({
  entry, field, status, mode, focus = false, displayMode = '1', preview, onSubmit, onHint, onPreview,
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
  const targetLabel = focus ? entry.headword : t(entry.level === 'N3-GRAMMAR' ? 'grammarNumber' : 'wordNumber', { order: entry.order })
  const showAnswer = () => {
    onPreview(key)
    inputRef.current?.focus({ preventScroll: true })
  }

  if (unavailable || hiddenInReview) {
    return <span className="cell-unavailable" aria-label={unavailable ? t(field === 'formation' ? 'noFormation' : 'noReading') : t('noReview')}>—</span>
  }
  if (solved) {
    const savedAnswer = status?.answer
    const displayAnswer = field === 'meaning' || field === 'hanViet'
      ? getAccepted(entry, field).join(', ')
      : savedAnswer || answer
    const content = displayMode === '2' ? null : <>{displayAnswer}<span aria-hidden="true">✓</span></>
    const title = displayMode === '2' ? undefined : getAccepted(entry, field).join(' · ')
    if (focus) return <button type="button" data-cell-focus className="answer-value answer-correct" title={title} aria-label={`${t('inputLabel', { field: labels[field], target: targetLabel })} · ${t('correct')}`}>{content}</button>
    return <div className="answer-value answer-correct" title={title}>{content}</div>
  }
  if (!editing) {
    return (
      <button type="button" className={`concealed-cell ${status?.unresolved ? 'has-mistake' : ''}`} onClick={() => setEditing(true)} aria-label={t('enterLabel', { field: labels[field], target: targetLabel })}>
        {displayMode === '3' ? <span className="revealed-value">{getAccepted(entry, field).join(', ')}</span> : hint ? <span className="hint-text">{hint}<span className="hint-cursor">···</span></span> : <span className="concealed-label">{t('clickAnswer')} <span aria-hidden="true">↗</span></span>}
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
      {displayMode === '3' && <div className="revealed-value">{getAccepted(entry, field).join(', ')}</div>}
      <div className="input-line">
        <input
          ref={inputRef}
          aria-label={t('inputLabel', { field: labels[field], target: targetLabel })}
          value={draft}
          onChange={(event) => { setDraft(event.target.value); setError(false) }}
          placeholder={field === 'formation' ? t('formationPlaceholder') : field === 'reading' ? t('kanaPlaceholder') : field === 'hanViet' ? t('hanVietPlaceholder') : t('meaningPlaceholder')}
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
      {preview && <div className="answer-preview" role="status">{getAccepted(entry, field).join(', ')}</div>}
    </form>
  )
})

type RowProps = {
  entry: VocabularyEntry
  mode: Mode
  reading?: CellProgress
  hanViet?: CellProgress
  meaning?: CellProgress
  formation?: CellProgress
  previewKey: string | null
  onSubmit: CellProps['onSubmit']
  onHint: CellProps['onHint']
  onPreview: CellProps['onPreview']
}

const VocabularyRow = memo(function VocabularyRow({
  entry, mode, reading, hanViet, meaning, formation, previewKey, onSubmit, onHint, onPreview,
}: RowProps) {
  const statuses = { reading, hanViet, meaning, formation }
  const fields = collectionFields(entry.level)
  return (
    <tr id={`row-${entry.id}`}>
      <th scope="row" className="number-cell">{String(entry.order).padStart(3, '0')}</th>
      <td className="word-cell"><span lang="ja">{entry.headword}</span><RadicalDetails entry={entry} /><GrammarExamples entry={entry} /></td>
      {fields.map((field) => (
        <td key={field} id={`practice-${entry.id}:${field}`} data-practice-key={`${entry.id}:${field}`} className={`practice-cell practice-${field}`}>
          <PracticeCell entry={entry} field={field} status={statuses[field]} mode={mode} preview={previewKey === `${entry.id}:${field}`} onSubmit={onSubmit} onHint={onHint} onPreview={onPreview} />
        </td>
      ))}
    </tr>
  )
})

function RadicalDetails({ entry }: { entry: VocabularyEntry }) {
  const { t } = useLanguage()
  if (!entry.strokes) return null
  return <small className="radical-details">{t('strokeCount', { count: entry.strokes })}{Boolean(entry.variants?.length) && <span>{t('variants')}: {entry.variants?.join(' · ')}</span>}</small>
}

function GrammarExamples({ entry }: { entry: VocabularyEntry }) {
  const { t, language } = useLanguage()
  if (!entry.examples) return null
  return <details className="grammar-examples"><summary>{t('examples')}</summary>
    <small>{t('sourcePage', { page: entry.sourcePage ?? '' })}</small>
    {entry.notes && <p className="grammar-example-note" lang={language}>{entry.notes[language]}</p>}
    {entry.examples.map((example, index) => <div key={index} className="grammar-example">
      <p lang="ja">{example.japanese}</p>
      {example.furigana.length > 0 && <small lang="ja">{example.furigana.map(({ text, reading }) => `${text}（${reading}）`).join(' · ')}</small>}
      <p lang={language}>{example[language]}</p>
      {example.sourceJapanese && <details className="source-wording"><summary>{t('sourceWording')}</summary><p lang="ja">{example.sourceJapanese}</p></details>}
    </div>)}
  </details>
}

type OverviewProps = {
  entries: VocabularyEntry[]
  level: Level
  progress: Progress
  onClose: () => void
  onJump: (order: number) => void
}

function Overview({ entries, level, progress, onClose, onJump }: OverviewProps) {
  const { t, locale } = useLanguage()
  const levelLabel = level === 'RADICALS' ? t('radicals') : level === 'N3-GRAMMAR' ? t('grammar') : level
  const fields = collectionFields(level)
  const [height, setHeight] = useState(window.innerHeight)
  useEffect(() => {
    const update = () => setHeight(window.innerHeight)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  const rows = Math.max(20, Math.floor((height - 120) / 11))
  const columns = Math.ceil(entries.length / rows)
  return (
    <div className="overview-overlay" role="dialog" aria-modal="true" aria-label={t('overviewLabel', { level: levelLabel })}>
      <div className="overview-head">
        <div><span className="eyebrow">{t(level === 'N3-GRAMMAR' ? 'grammarMap' : 'vocabularyMap')}</span><h2>{levelLabel} <small>· {entries.length.toLocaleString(locale)} {t(level === 'RADICALS' ? 'radicalUnit' : level === 'N3-GRAMMAR' ? 'grammarUnit' : 'words')}</small></h2></div>
        <div className="overview-head-right"><span>{t(level === 'N3-GRAMMAR' ? 'selectPattern' : 'selectWord')}</span><button type="button" className="close-overview" onClick={onClose} aria-label={t('closeOverview')}>✕</button></div>
      </div>
      <div className="overview-grid" style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {entries.map((entry) => {
          const statuses = fields.filter((field) => getAnswer(entry, field)).map((field) => progress[`${entry.id}:${field}`])
          const hasMistake = statuses.some((status) => status?.unresolved)
          const complete = statuses.length > 0 && statuses.every((status) => status?.solved)
          return <button key={entry.id} type="button" className={`overview-tile ${hasMistake ? 'tile-mistake' : complete ? 'tile-done' : ''}`} title={`${entry.order}. ${entry.headword}`} onClick={() => onJump(entry.order)} aria-label={t(level === 'N3-GRAMMAR' ? 'goToPattern' : 'goToWord', { order: entry.order, word: entry.headword })}><span>{entry.headword}</span></button>
        })}
      </div>
      <div className="overview-legend"><span><i className="legend-dot" /> {t('notStudied')}</span><span><i className="legend-dot done" /> {t('correct')}</span><span><i className="legend-dot mistake" /> {t('needsReview')}</span></div>
    </div>
  )
}

function StudyApp() {
  const { t, labels, locale, language } = useLanguage()
  const [readingNovel, setReadingNovel] = useState(() => window.location.hash === '#novel')
  const openNovel = () => { window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#novel`); setReadingNovel(true) }
  const closeNovel = () => { window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`); setReadingNovel(false) }
  const [level, setLevel] = useState<Level>('N3')
  const grammar = level === 'N3-GRAMMAR'
  const fields = collectionFields(level)
  const levelLabel = level === 'RADICALS' ? t('radicals') : grammar ? t('grammar') : level
  const [mode, setMode] = useState<Mode>('study')
  const [focused, setFocused] = useState(false)
  const [displayModes, setDisplayModes] = useState<Record<Field, DisplayMode>>(() => {
    const defaults: Record<Field, DisplayMode> = { reading: '1', hanViet: '1', meaning: '1', formation: '1' }
    try {
      const saved = JSON.parse(window.localStorage.getItem('mimikara-display-modes-v1') ?? '{}')
      for (const field of [...vocabularyFields, 'formation'] as Field[]) if (['1', '2', '3'].includes(saved?.[field])) defaults[field] = saved[field]
    } catch { /* invalid or unavailable storage */ }
    return defaults
  })
  useEffect(() => {
    try { window.localStorage.setItem('mimikara-display-modes-v1', JSON.stringify(displayModes)) } catch { /* private browsing */ }
  }, [displayModes])
  const [zoom, setZoom] = useState(100)
  const [overview, setOverview] = useState(false)
  const [jumpTarget, setJumpTarget] = useState<number | null>(null)
  const [previewKey, setPreviewKey] = useState<string | null>(null)
  const advanceFromRef = useRef<{ key: string; top: number } | null>(null)
  const selectedKeyRef = useRef<string | null>(null)
  const navigationFrameRef = useRef<number | null>(null)
  const hintTimersRef = useRef(new Map<string, number>())
  const previewTimerRef = useRef<number | null>(null)
  const [allProgress, setProgress] = useState<Progress>(() => {
    try {
      const saved = parseProgress(window.localStorage.getItem(storageKey))
      return Object.fromEntries(Object.entries(saved).map(([key, cell]) => [key, { ...cell, hints: 0 }]))
    } catch { return {} }
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

  const entries = useMemo(() => language === 'en' ? collections[level] : collections[level].map((entry) => ({ ...entry, meanings: level === 'RADICALS' || level === 'N3-GRAMMAR' ? entry.meaningsVi ?? entry.meanings : (vietnameseMeanings[level] as Record<string, string[]>)[entry.id] ?? entry.meanings })), [level, language])
  const unresolved = useMemo(() => Object.entries(progress).filter(([key, value]) => key.startsWith(level.toLowerCase() + ':') && value.unresolved).length, [progress, level])
  const visible = useMemo(() => mode === 'study' ? entries : entries.filter((entry) => fields.some((field) => progress[`${entry.id}:${field}`]?.unresolved)), [entries, mode, progress, fields])
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
  }, [entries, visible, focused, progress])
  const totalCells = useMemo(() => entries.reduce((sum, entry) => sum + fields.filter((field) => getAnswer(entry, field)).length, 0), [entries, fields])
  const solvedCells = useMemo(() => entries.reduce((sum, entry) => sum + fields.filter((field) => getAnswer(entry, field) && progress[`${entry.id}:${field}`]?.solved).length, 0), [entries, progress, fields])
  const completedPercent = Math.round((solvedCells / totalCells) * 100)
  const onSubmit = useCallback((key: string, input: string, correct: boolean) => {
    if (correct) {
      const sourceInput = document.getElementById(`practice-${key}`)?.querySelector('input')
      if (sourceInput) advanceFromRef.current = { key, top: sourceInput.getBoundingClientRect().top }
    }
    const storageCell = storedKey(key, language)
    const hintTimer = hintTimersRef.current.get(storageCell)
    if (hintTimer !== undefined) window.clearTimeout(hintTimer)
    hintTimersRef.current.delete(storageCell)
    setPreviewKey((current) => current === key ? null : current)
    setProgress((old) => submitAnswer(old, storageCell, correct, mode, input))
  }, [mode, language, setPreviewKey, setProgress])
  const onHint = useCallback((key: string, answer: string) => {
    const storageCell = storedKey(key, language)
    const previous = hintTimersRef.current.get(storageCell)
    if (previous !== undefined) window.clearTimeout(previous)
    setProgress((old) => nextHint(old, storageCell, answer))
    hintTimersRef.current.set(storageCell, window.setTimeout(() => {
      hintTimersRef.current.delete(storageCell)
      setProgress((old) => {
        const cell = old[storageCell]
        return cell ? { ...old, [storageCell]: { ...cell, hints: 0 } } : old
      })
    }, 5000))
  }, [language, setProgress])
  const onPreview = useCallback((key: string) => {
    if (previewTimerRef.current !== null) window.clearTimeout(previewTimerRef.current)
    setProgress((old) => revealAnswer(old, storedKey(key, language)))
    setPreviewKey(key)
    previewTimerRef.current = window.setTimeout(() => { setPreviewKey(null); previewTimerRef.current = null }, 1000)
  }, [language, setPreviewKey, setProgress])
  useEffect(() => () => {
    if (previewTimerRef.current !== null) window.clearTimeout(previewTimerRef.current)
    if (navigationFrameRef.current !== null) cancelAnimationFrame(navigationFrameRef.current)
    for (const timer of hintTimersRef.current.values()) window.clearTimeout(timer)
    hintTimersRef.current.clear()
  }, [])
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
      const direction = ({ z: [0, 1], x: [0, -1], c: [1, 0], v: [-1, 0] } as Record<string, [number, number]>)[shortcut] ??
        ({ KeyZ: [0, 1], KeyX: [0, -1], KeyC: [1, 0], KeyV: [-1, 0] } as Record<string, [number, number]>)[event.code]
      if (!hint && !answer && !(focused && direction)) return

      const active = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-practice-key]')
      const selected = active ?? (selectedKeyRef.current ? document.getElementById(`practice-${selectedKeyRef.current}`) : null)
      if (focused && direction) {
        const source = selected ?? document.querySelector<HTMLElement>('.focus-practice.practice-meaning')
        const sourceKey = source?.dataset.practiceKey
        if (!sourceKey) return
        event.preventDefault()
        event.stopPropagation()
        const separator = sourceKey.lastIndexOf(':')
        let row = entries.findIndex((entry) => entry.id === sourceKey.slice(0, separator))
        let column = fields.indexOf(sourceKey.slice(separator + 1) as Field)
        if (row < 0 || column < 0) return
        const top = (source.querySelector('input, button') ?? source).getBoundingClientRect().top
        while (true) {
          row += direction[0]
          column += direction[1]
          if (row < 0 || row >= entries.length || column < 0 || column >= fields.length) return
          const target = document.getElementById(`practice-${entries[row].id}:${fields[column]}`)
          const input = target?.querySelector<HTMLInputElement>('input')
          const button = target?.querySelector<HTMLButtonElement>('button.concealed-cell, button[data-cell-focus]')
          if (!input && !button) continue
          selectedKeyRef.current = target!.dataset.practiceKey!
          if (input) input.focus({ preventScroll: true })
          else if (button?.classList.contains('concealed-cell')) button.click()
          else button?.focus({ preventScroll: true })
          if (navigationFrameRef.current !== null) cancelAnimationFrame(navigationFrameRef.current)
          navigationFrameRef.current = requestAnimationFrame(() => {
            navigationFrameRef.current = null
            const control = target?.querySelector<HTMLElement>('input, button[data-cell-focus], button.concealed-cell')
            if (!control) return
            if (direction[0]) {
              const distance = control.getBoundingClientRect().top - top
              if (Math.abs(distance) >= 1) window.scrollBy({ top: distance, behavior: 'smooth' })
            }
            const bounds = target!.getBoundingClientRect()
            const list = target?.closest<HTMLElement>('.focus-list')
            if (list) {
              const container = list.getBoundingClientRect()
              const left = bounds.left < container.left ? bounds.left - container.left : bounds.right > container.right ? bounds.right - container.right : 0
              if (left) list.scrollBy({ left, behavior: 'smooth' })
            }
          })
          return
        }
      }
      const available = (cell: HTMLElement | null) => Boolean(cell?.querySelector('input, button.concealed-cell'))
      const cell = available(selected) ? selected : (focused ? Array.from(document.querySelectorAll<HTMLElement>('.focus-practice.practice-meaning')).find(available) : null) ?? Array.from(document.querySelectorAll<HTMLElement>('[data-practice-key]')).find(available)
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
  }, [entries, onHint, onPreview, overview, focused, fields])
  const jump = (order: number) => { setMode('study'); setOverview(false); setJumpTarget(order) }

  if (focused) {
    return (
      <main className="focus-shell" style={{ '--scale': 1 } as React.CSSProperties} aria-label={t('focusMode')}>
        <FocusHeader><LanguageSwitch />
          <button type="button" className="focus-exit" onClick={() => setFocused(false)}>← {t('fullList')}</button>
          <div className="focus-options" role="group" aria-label={t('selectSet')}>
            {levels.map((item) => <button key={item} type="button" aria-pressed={level === item} onClick={() => { setLevel(item); setPreviewKey(null); selectedKeyRef.current = null }}>{item === 'RADICALS' ? t('radicals') : item === 'N3-GRAMMAR' ? t('grammar') : item}</button>)}
          </div>
          <div className="display-controls">
            {fields.map((field) => <label key={field}>{labels[field]}
              <select aria-label={t('displayMode', { field: labels[field] })} value={displayModes[field]} onChange={(event) => setDisplayModes((old) => ({ ...old, [field]: event.target.value as DisplayMode }))}>
                <option value="1">1 · {t('showCorrect')}</option>
                <option value="2">2 · {t('hideCorrect')}</option>
                <option value="3">3 · {t('showAll')}</option>
              </select>
            </label>)}
          </div>
          <div className="focus-shortcuts">Alt+Z → · Alt+X ← · Alt+C ↓ · Alt+V ↑</div>
        </FocusHeader>
        <div className={`focus-list ${grammar ? 'grammar-focus' : ''}`} key={level}>
          <div className="focus-row focus-head"><span>{t(grammar ? 'grammarPattern' : 'vocabulary')}</span>{fields.map((field) => <span key={field}>{labels[field]}</span>)}</div>
          {entries.map((entry) => (
            <div className="focus-row" key={`${entry.id}-${language}`} role="group" aria-label={t(grammar ? 'patternLabel' : 'wordLabel', { word: entry.headword })}>
              <div className="focus-word"><span lang="ja">{entry.headword}</span><RadicalDetails entry={entry} /><GrammarExamples entry={entry} /></div>
              {fields.map((field) => <div key={field} className={`focus-practice practice-${field}`} id={`practice-${entry.id}:${field}`} data-practice-key={`${entry.id}:${field}`}>
                <PracticeCell entry={entry} field={field} status={progress[`${entry.id}:${field}`]} mode="study" focus displayMode={displayModes[field]} preview={previewKey === `${entry.id}:${field}`} onSubmit={onSubmit} onHint={onHint} onPreview={onPreview} />
              </div>)}
            </div>
          ))}
        </div>
      </main>
    )
  }

  if (readingNovel) return <Suspense fallback={<p role="status">{language === 'vi' ? 'Đang mở tiểu thuyết…' : 'Opening the novel…'}</p>}><NovelReader onClose={closeNovel} /></Suspense>
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand"><span className="brand-mark">み</span><span>MIMIKARA <strong>STUDY</strong></span></div>
        <div className="header-right"><button className="novel-launch" onClick={openNovel}>{language === 'vi' ? 'Đọc tiểu thuyết N3' : 'Read N3 novel'}</button><LanguageSwitch /><span className="header-note">{t(grammar ? 'grammarHeader' : 'headerNote')}</span><span className="local-badge"><i /> {t('savedDevice')}</span></div>
      </header>
      <main className="main-content">
        <section className="intro">
          <div>
            <span className="eyebrow">{t(grammar ? 'grammarDaily' : 'dailyPractice')}</span>
            <h1>{t(grammar ? 'grammarHeadline' : 'headline')}<br /><em>{t('headlineAccent')}</em></h1>
            <p>{t(grammar ? 'grammarInstructions' : 'instructions')}</p>
          </div>
          <div className="intro-decoration" aria-hidden="true"><span>語</span><small>一語ずつ</small></div>
        </section>

        <section className="workspace" aria-label={t(grammar ? 'grammarTable' : 'practiceTable')}>
          <div className="workspace-top">
            <div className="level-group" role="group" aria-label={t('selectLevel')}>
              {levels.map((item) => <button type="button" key={item} className={level === item ? 'selected' : ''} onClick={() => { setLevel(item); setMode('study'); setOverview(false); setPreviewKey(null); selectedKeyRef.current = null }}>{item === 'RADICALS' ? t('radicals') : item === 'N3-GRAMMAR' ? t('grammar') : item}<small>{collections[item].length.toLocaleString(locale)} {t(item === 'RADICALS' ? 'radicalUnit' : item === 'N3-GRAMMAR' ? 'grammarUnit' : 'words')}</small></button>)}
            </div>
            <div className="progress-summary"><div><strong>{solvedCells.toLocaleString(locale)}</strong><span> / {totalCells.toLocaleString(locale)} {t('cellsCorrect')}</span><b>{completedPercent}%</b></div><div className="progress-track"><span style={{ width: `${completedPercent}%` }} /></div></div>
          </div>
          <div className="toolbar">
            <div className="mode-group" role="group" aria-label={t('studyMode')}><button type="button" className={mode === 'study' ? 'active' : ''} onClick={() => setMode('study')}>{t(grammar ? 'grammarList' : 'wordList')}</button><button type="button" className={mode === 'review' ? 'active' : ''} onClick={() => setMode('review')}>{t('reviewMistakes')} <span>{unresolved}</span></button><button type="button" onClick={() => { setMode('study'); setOverview(false); setFocused(true); window.scrollTo({ top: 0 }) }}>{t('focus')}</button></div>
            <div className="zoom-controls"><span>{t('zoom')}</span><button type="button" aria-label={t('zoomOut')} onClick={() => setZoom((value) => Math.max(70, value - 10))}>−</button><input type="range" min="70" max="140" step="10" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label={t('listZoom')} /><button type="button" aria-label={t('zoomIn')} onClick={() => setZoom((value) => Math.min(140, value + 10))}>+</button><output>{zoom}%</output><button type="button" className="overview-button" onClick={() => setOverview(true)}>▦ {t('overview')}</button></div>
          </div>
          <div className="table-caption"><span>{mode === 'study' ? t(level === 'RADICALS' ? 'showingRadicals' : grammar ? 'showingGrammar' : 'showingAll', { count: entries.length.toLocaleString(locale), level: levelLabel }) : t(grammar ? 'showingGrammarReview' : 'showingReview', { count: visible.length.toLocaleString(locale) })}</span><span>{t('hintExplanation')}</span></div>
          {grammar && <p className="grammar-note">{t('grammarNotation')}</p>}
          {level === 'RADICALS' && <p className="radical-note">{t('radicalNote')}</p>}
          {mode === 'review' && visible.length === 0 ? (
            <div className="empty-state"><span>✓</span><h2>{t('noMistakes')}</h2><p>{t(grammar ? 'grammarReview' : 'reviewExplanation')}</p><button type="button" onClick={() => setMode('study')}>{t(grammar ? 'grammarBack' : 'backToList')}</button></div>
          ) : (
            <div key={`${level}-${mode}`} className="table-viewport" style={{ '--scale': zoom / 100 } as React.CSSProperties}>
              <table className={`vocab-table ${grammar ? 'grammar-table' : ''}`}><thead><tr><th scope="col" className="number-cell">{t('number')}</th><th scope="col" className="word-cell">{t(grammar ? 'grammarPattern' : 'vocabulary')}</th>{fields.map((field) => <th scope="col" key={field}>{labels[field]} {field === 'reading' && <small>ひらがな / カタカナ</small>}</th>)}</tr></thead><tbody>{visible.map((entry) => <VocabularyRow key={`${entry.id}-${language}`} entry={entry} mode={mode} reading={progress[`${entry.id}:reading`]} hanViet={progress[`${entry.id}:hanViet`]} meaning={progress[`${entry.id}:meaning`]} formation={progress[`${entry.id}:formation`]} previewKey={previewKey} onSubmit={onSubmit} onHint={onHint} onPreview={onPreview} />)}</tbody></table>
            </div>
          )}
        </section>
        <footer className="page-footer"><span>{grammar ? t('grammarSource') : level === 'RADICALS' ? <>Kanji radicals · <a href="https://kanjialive.com/214-traditional-kanji-radicals/">Kanji alive</a> (<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>)</> : <>Mimikara Study · N3 / N2 · {t('englishMeanings')} <a href="https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project">JMdict</a> (<a href="/JMdict-LICENSE.txt">CC BY-SA 4.0</a>)</>}</span><span>{t('savedProgress')}</span></footer>
      </main>
      {overview && <Overview entries={entries} level={level} progress={progress} onClose={() => setOverview(false)} onJump={jump} />}
    </div>
  )
}

export default function App() {
  return <LanguageProvider><StudyApp /></LanguageProvider>
}
