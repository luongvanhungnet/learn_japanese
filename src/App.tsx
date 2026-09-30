import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import n2Data from './data/n2.json'
import n3Data from './data/n3.json'
import {
  clearReveal, hintPrefix, isCorrect, nextHint,
  parseProgress, revealAnswer, submitAnswer,
} from './learning'
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
const labels: Record<Field, string> = {
  reading: 'Cách đọc',
  hanViet: 'Hán Việt',
  meaning: 'Ngữ nghĩa',
}
const storageKey = 'mimikara-progress-v1'

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
  onSubmit: (key: string, input: string, correct: boolean) => void
  onHint: (key: string, answer: string) => void
  onReveal: (key: string) => void
  onRetry: (key: string) => void
}

const PracticeCell = memo(function PracticeCell({
  entry, field, status, mode, focus = false, onSubmit, onHint, onReveal, onRetry,
}: CellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState(false)
  const key = `${entry.id}:${field}`
  const answer = getAnswer(entry, field)
  const unavailable = !answer
  const hiddenInReview = mode === 'review' && !status?.unresolved
  const solved = Boolean(status?.solved && !(mode === 'review' && status.unresolved))
  const revealed = Boolean(status?.revealed && mode === 'study')
  const hint = hintPrefix(answer, status?.hints ?? 0)
  const targetLabel = focus ? entry.headword : `từ số ${entry.order}`

  if (unavailable || hiddenInReview) {
    return <span className="cell-unavailable" aria-label={unavailable ? 'Không có âm Hán Việt' : 'Không có lỗi cần ôn'}>—</span>
  }
  if (solved) {
    return <div className="answer-value answer-correct" title={getAccepted(entry, field).join(' · ')}>{status?.answer || answer}<span aria-hidden="true">✓</span></div>
  }
  if (revealed && !editing) {
    return (
      <div className="answer-value answer-revealed">
        <span>{field === 'meaning' ? entry.meanings.join(', ') : answer}</span>
        <button type="button" className="mini-link" onClick={() => { onRetry(key); setEditing(true) }}>Thử lại</button>
      </div>
    )
  }
  if (!editing) {
    return (
      <button type="button" className={`concealed-cell ${status?.unresolved ? 'has-mistake' : ''}`} onClick={() => setEditing(true)} aria-label={`Nhập ${labels[field]} cho ${targetLabel}`}>
        {hint ? <span className="hint-text">{hint}<span className="hint-cursor">···</span></span> : <span className="concealed-label">Nhấn để điền <span aria-hidden="true">↗</span></span>}
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
    }
  }
  return (
    <form className={`practice-form ${error ? 'input-error' : ''}`} onSubmit={handleSubmit}>
      <div className="input-line">
        <input
          autoFocus
          aria-label={`${labels[field]} cho ${targetLabel}`}
          value={draft}
          onChange={(event) => { setDraft(event.target.value); setError(false) }}
          placeholder={field === 'reading' ? 'Nhập kana…' : field === 'hanViet' ? 'Nhập âm Hán Việt…' : 'Nhập một nghĩa…'}
        />
        <button type="submit" className="check-button" aria-label="Kiểm tra đáp án">↵</button>
      </div>
      <div className="cell-tools">
        <button type="button" onClick={() => onHint(key, answer)}>Hint+</button>
        <button type="button" onClick={() => { onReveal(key); setEditing(false) }}>Đáp án</button>
        <button type="button" onClick={() => { setEditing(false); setError(false) }}>Đóng</button>
      </div>
      {hint && <span className="hint-line">Gợi ý: {hint}</span>}
      {error && <span className="error-line" role="alert">Chưa đúng. Ô này đã vào danh sách cần ôn.</span>}
    </form>
  )
})

type RowProps = {
  entry: VocabularyEntry
  mode: Mode
  reading?: CellProgress
  hanViet?: CellProgress
  meaning?: CellProgress
  onSubmit: CellProps['onSubmit']
  onHint: CellProps['onHint']
  onReveal: CellProps['onReveal']
  onRetry: CellProps['onRetry']
}

const VocabularyRow = memo(function VocabularyRow({
  entry, mode, reading, hanViet, meaning, onSubmit, onHint, onReveal, onRetry,
}: RowProps) {
  const statuses = { reading, hanViet, meaning }
  return (
    <tr id={`row-${entry.id}`}>
      <th scope="row" className="number-cell">{String(entry.order).padStart(3, '0')}</th>
      <td className="word-cell"><span lang="ja">{entry.headword}</span></td>
      {fields.map((field) => (
        <td key={field} className={`practice-cell practice-${field}`}>
          <PracticeCell entry={entry} field={field} status={statuses[field]} mode={mode} onSubmit={onSubmit} onHint={onHint} onReveal={onReveal} onRetry={onRetry} />
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
  const [height, setHeight] = useState(window.innerHeight)
  useEffect(() => {
    const update = () => setHeight(window.innerHeight)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  const rows = Math.max(20, Math.floor((height - 120) / 11))
  const columns = Math.ceil(entries.length / rows)
  return (
    <div className="overview-overlay" role="dialog" aria-modal="true" aria-label={`Tổng quan ${level}`}>
      <div className="overview-head">
        <div><span className="eyebrow">BẢN ĐỒ TỪ VỰNG</span><h2>{level} <small>· {entries.length.toLocaleString('vi-VN')} từ</small></h2></div>
        <div className="overview-head-right"><span>Chọn một từ để quay lại danh sách</span><button type="button" className="close-overview" onClick={onClose} aria-label="Đóng tổng quan">✕</button></div>
      </div>
      <div className="overview-grid" style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {entries.map((entry) => {
          const statuses = fields.filter((field) => getAnswer(entry, field)).map((field) => progress[`${entry.id}:${field}`])
          const hasMistake = statuses.some((status) => status?.unresolved)
          const complete = statuses.length > 0 && statuses.every((status) => status?.solved)
          return <button key={entry.id} type="button" className={`overview-tile ${hasMistake ? 'tile-mistake' : complete ? 'tile-done' : ''}`} title={`${entry.order}. ${entry.headword}`} onClick={() => onJump(entry.order)} aria-label={`Đến từ số ${entry.order}: ${entry.headword}`}><span>{entry.headword}</span></button>
        })}
      </div>
      <div className="overview-legend"><span><i className="legend-dot" /> Chưa học</span><span><i className="legend-dot done" /> Đã đúng</span><span><i className="legend-dot mistake" /> Cần ôn</span></div>
    </div>
  )
}

function App() {
  const [level, setLevel] = useState<Level>('N3')
  const [mode, setMode] = useState<Mode>('study')
  const [focused, setFocused] = useState(false)
  const [focusField, setFocusField] = useState<Field>('meaning')
  const [zoom, setZoom] = useState(100)
  const [overview, setOverview] = useState(false)
  const [jumpTarget, setJumpTarget] = useState<number | null>(null)
  const [progress, setProgress] = useState<Progress>(() => {
    try { return parseProgress(window.localStorage.getItem(storageKey)) } catch { return {} }
  })

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(progress)) } catch { /* private browsing */ }
  }, [progress])
  useEffect(() => {
    if (overview || jumpTarget === null) return
    const frame = requestAnimationFrame(() => {
      document.getElementById(`row-${level.toLowerCase()}:${jumpTarget}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      setJumpTarget(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [overview, jumpTarget, level, mode])

  const entries = collections[level]
  const unresolved = useMemo(() => Object.entries(progress).filter(([key, value]) => key.startsWith(level.toLowerCase() + ':') && value.unresolved).length, [progress, level])
  const visible = useMemo(() => mode === 'study' ? entries : entries.filter((entry) => fields.some((field) => progress[`${entry.id}:${field}`]?.unresolved)), [entries, mode, progress])
  const totalCells = useMemo(() => entries.reduce((sum, entry) => sum + fields.filter((field) => getAnswer(entry, field)).length, 0), [entries])
  const solvedCells = useMemo(() => entries.reduce((sum, entry) => sum + fields.filter((field) => getAnswer(entry, field) && progress[`${entry.id}:${field}`]?.solved).length, 0), [entries, progress])
  const completedPercent = Math.round((solvedCells / totalCells) * 100)
  const onSubmit = useCallback((key: string, input: string, correct: boolean) => setProgress((old) => submitAnswer(old, key, correct, mode, input)), [mode])
  const onHint = useCallback((key: string, answer: string) => setProgress((old) => nextHint(old, key, answer)), [])
  const onReveal = useCallback((key: string) => setProgress((old) => revealAnswer(old, key)), [])
  const onRetry = useCallback((key: string) => setProgress((old) => clearReveal(old, key)), [])
  const jump = (order: number) => { setMode('study'); setOverview(false); setJumpTarget(order) }

  if (focused) {
    return (
      <main className="focus-shell" style={{ '--scale': 1 } as React.CSSProperties} aria-label="Chế độ tập trung">
        <div className="focus-controls">
          <button type="button" className="focus-exit" onClick={() => setFocused(false)}>← Danh sách đầy đủ</button>
          <div className="focus-options" role="group" aria-label="Chọn bộ từ">
            {(['N3', 'N2'] as Level[]).map((item) => <button key={item} type="button" aria-pressed={level === item} onClick={() => setLevel(item)}>{item}</button>)}
          </div>
          <div className="focus-options" role="group" aria-label="Chọn cột tập trung">
            {fields.map((field) => <button key={field} type="button" aria-pressed={focusField === field} onClick={() => setFocusField(field)}>{labels[field]}</button>)}
          </div>
        </div>
        <div className="focus-list" key={`${level}-${focusField}`}>
          {entries.map((entry) => (
            <div className="focus-row" key={entry.id} role="group" aria-label={`Từ ${entry.headword}`}>
              <span className="focus-word" lang="ja">{entry.headword}</span>
              <div className="focus-practice">
                <PracticeCell entry={entry} field={focusField} status={progress[`${entry.id}:${focusField}`]} mode="study" focus onSubmit={onSubmit} onHint={onHint} onReveal={onReveal} onRetry={onRetry} />
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
        <div className="header-right"><span className="header-note">Từ vựng tiếng Nhật · học theo nhịp của bạn</span><span className="local-badge"><i /> Lưu trên máy này</span></div>
      </header>
      <main className="main-content">
        <section className="intro">
          <div>
            <span className="eyebrow">LUYỆN TỪ VỰNG MỖI NGÀY</span>
            <h1>Nhìn từ. Nhớ nghĩa.<br /><em>Tiến bộ từng ô.</em></h1>
            <p>Chọn một ô trống, nhập đáp án rồi nhấn Enter. Sai ở đâu, ôn lại đúng chỗ đó.</p>
          </div>
          <div className="intro-decoration" aria-hidden="true"><span>語</span><small>一語ずつ</small></div>
        </section>

        <section className="workspace" aria-label="Bảng học từ vựng">
          <div className="workspace-top">
            <div className="level-group" role="group" aria-label="Chọn cấp độ">
              {(['N3', 'N2'] as Level[]).map((item) => <button type="button" key={item} className={level === item ? 'selected' : ''} onClick={() => { setLevel(item); setMode('study'); setOverview(false) }}>{item}<small>{collections[item].length.toLocaleString('vi-VN')} từ</small></button>)}
            </div>
            <div className="progress-summary"><div><strong>{solvedCells.toLocaleString('vi-VN')}</strong><span> / {totalCells.toLocaleString('vi-VN')} ô đã đúng</span><b>{completedPercent}%</b></div><div className="progress-track"><span style={{ width: `${completedPercent}%` }} /></div></div>
          </div>
          <div className="toolbar">
            <div className="mode-group" role="group" aria-label="Chế độ học"><button type="button" className={mode === 'study' ? 'active' : ''} onClick={() => setMode('study')}>Danh sách từ</button><button type="button" className={mode === 'review' ? 'active' : ''} onClick={() => setMode('review')}>Khắc phục lỗi <span>{unresolved}</span></button><button type="button" onClick={() => { setMode('study'); setOverview(false); setFocused(true); window.scrollTo({ top: 0 }) }}>Tập trung</button></div>
            <div className="zoom-controls"><span>Thu phóng</span><button type="button" aria-label="Thu nhỏ" onClick={() => setZoom((value) => Math.max(70, value - 10))}>−</button><input type="range" min="70" max="140" step="10" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="Mức phóng to danh sách" /><button type="button" aria-label="Phóng to" onClick={() => setZoom((value) => Math.min(140, value + 10))}>+</button><output>{zoom}%</output><button type="button" className="overview-button" onClick={() => setOverview(true)}>▦ Tổng quan</button></div>
          </div>
          <div className="table-caption"><span>{mode === 'study' ? `Đang xem toàn bộ ${entries.length.toLocaleString('vi-VN')} từ ${level}` : `${visible.length.toLocaleString('vi-VN')} từ có lỗi cần khắc phục`}</span><span>Hint+ gợi ý từng chữ · Đáp án chỉ để xem</span></div>
          {mode === 'review' && visible.length === 0 ? (
            <div className="empty-state"><span>✓</span><h2>Không còn lỗi cần ôn</h2><p>Những ô bạn nhập sai sẽ xuất hiện ở đây cho đến khi làm đúng lại.</p><button type="button" onClick={() => setMode('study')}>Quay lại danh sách</button></div>
          ) : (
            <div key={`${level}-${mode}`} className="table-viewport" style={{ '--scale': zoom / 100 } as React.CSSProperties}>
              <table className="vocab-table"><thead><tr><th scope="col" className="number-cell">STT</th><th scope="col" className="word-cell">Từ vựng</th><th scope="col">Cách đọc <small>ひらがな / カタカナ</small></th><th scope="col">Hán Việt</th><th scope="col">Ngữ nghĩa</th></tr></thead><tbody>{visible.map((entry) => <VocabularyRow key={entry.id} entry={entry} mode={mode} reading={progress[`${entry.id}:reading`]} hanViet={progress[`${entry.id}:hanViet`]} meaning={progress[`${entry.id}:meaning`]} onSubmit={onSubmit} onHint={onHint} onReveal={onReveal} onRetry={onRetry} />)}</tbody></table>
            </div>
          )}
        </section>
        <footer className="page-footer"><span>Mimikara Study · N3 / N2</span><span>Tiến độ được lưu tự động trong trình duyệt này.</span></footer>
      </main>
      {overview && <Overview entries={entries} level={level} progress={progress} onClose={() => setOverview(false)} onJump={jump} />}
    </div>
  )
}

export default App
