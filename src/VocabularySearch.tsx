import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLanguage } from './translations'
import type { SearchEntry } from './vocabularySearch'
import './VocabularySearch.css'

type SearchModule = typeof import('./vocabularySearch')
export function VocabularySearch({ onSelect }: { onSelect?: (entry: SearchEntry) => void }) {
  const { language } = useLanguage()
  const vi = language === 'vi'
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query)
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<SearchModule | null>(null)
  const [error, setError] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open || data) return
    let canceled = false
    import('./vocabularySearch').then(module => { if (!canceled) { setData(module); setError(false) } }).catch(() => { if (!canceled) setError(true) })
    return () => { canceled = true }
  }, [open, data])
  useEffect(() => {
    const dismiss = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [])
  const results = useMemo(() => data?.searchVocabulary(data.vocabularySearchIndex, deferred) ?? [], [data, deferred])
  const label = vi ? 'Tìm tất cả từ vựng' : 'Search all vocabulary'
  const sourceLabel = (source: string) => ({ RADICALS: vi ? 'Bộ thủ' : 'Radicals', 'N3-GRAMMAR': vi ? 'Ngữ pháp N3' : 'N3 grammar', STORY: vi ? 'Tiểu thuyết' : 'Story', GAME: vi ? 'Trò chơi' : 'Game' })[source] ?? source
  return <div className="vocabulary-search" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }} onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); input.current?.focus(); setOpen(false) }
    if (event.key === 'ArrowDown' && event.target === input.current) { event.preventDefault(); root.current?.querySelector<HTMLButtonElement>('.vocabulary-search-result')?.focus() }
  }}>
    <div className="vocabulary-search-field"><span aria-hidden="true">⌕</span><input ref={input} type="search" aria-label={label} aria-expanded={open} aria-controls={id} placeholder={vi ? 'Tìm từ vựng…' : 'Search vocabulary…'} value={query} maxLength={160} onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setOpen(true) }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); setOpen(true); root.current?.querySelector<HTMLButtonElement>('.vocabulary-search-result')?.focus() } }} />{query && <button type="button" className="vocabulary-search-clear" aria-label={vi ? 'Xóa tìm kiếm' : 'Clear search'} onClick={() => { setQuery(''); setOpen(true); input.current?.focus() }}>×</button>}</div>
    {open && <section id={id} className="vocabulary-search-popover" aria-label={vi ? 'Kết quả tìm kiếm từ vựng' : 'Vocabulary search results'} aria-busy={query !== deferred}>
      <div className="vocabulary-search-caption" role="status">{error ? (vi ? 'Chưa tải được dữ liệu. Đóng và mở lại để thử lại.' : 'Unable to load vocabulary. Close and reopen to retry.') : !data ? (vi ? 'Đang tải từ vựng…' : 'Loading vocabulary…') : !deferred.trim() ? (vi ? 'Nhập Kanji, kana, Hán Việt hoặc nghĩa Việt / Anh (có thể không dấu).' : 'Type Kanji, kana, Sino-Vietnamese, Vietnamese or English meanings.') : `${results.length} ${vi ? 'kết quả trong tất cả bộ từ' : 'results across all collections'}${results.length > 30 ? (vi ? ' · Hiển thị 30 từ đầu, nhập thêm để thu hẹp.' : ' · Showing the first 30. Keep typing to narrow results.') : ''}`}</div>
      {data && deferred.trim() && results.length === 0 && <p className="vocabulary-search-empty">{vi ? 'Không tìm thấy từ phù hợp.' : 'No matching vocabulary.'}</p>}
      <div className="vocabulary-search-results">{results.slice(0, 30).map(entry => {
        const canJump = onSelect && ['N3', 'N2', 'RADICALS', 'N3-GRAMMAR'].includes(entry.source)
        const content = <><span className="vocabulary-search-word"><b lang="ja">{entry.headword}</b><small>{sourceLabel(entry.source)}</small></span><span lang="ja">{entry.reading}</span>{entry.hanViet && <span className="vocabulary-search-hanviet">{entry.hanViet}</span>}<span className="vocabulary-search-meaning">{(vi && entry.vi.length ? entry.vi : entry.en).join('; ')}</span>{canJump && <small className="vocabulary-search-jump">{vi ? 'Mở trong danh sách' : 'Open in word list'} ↗</small>}</>
        return canJump ? <button type="button" className="vocabulary-search-result" key={entry.id} onClick={() => { onSelect(entry); setOpen(false) }}>{content}</button> : <article className="vocabulary-search-result" key={entry.id}>{content}</article>
      })}</div>
    </section>}
  </div>
}
