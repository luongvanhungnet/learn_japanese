import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import novel from './data/novel.json'
import vocabulary from './data/n3.json'
import grammar from './data/n3-grammar.json'
import supportingLexicon from './data/novel-lexicon.json'
import audioManifest from './data/novel-audio.json'
import { editorialCorrections, grammarReference, lookupMeanings } from './novel'
import { chapterSentences } from './novelAudio'
import { lookupPosition } from './lookupPosition'
import { NovelAudioPlayer } from './NovelAudioPlayer'
import type { NovelAudioHandle } from './NovelAudioPlayer'
import type { Annotation } from './novel'
import { LanguageSwitch } from './i18n'
import { useLanguage } from './translations'
import './NovelReader.css'

type LookupEntry = { id: string; headword: string; reading: string; hanViet: string | null; meanings: string[]; meaningsVi?: string[]; order?: number; source?: string }
const entries = new Map<string, LookupEntry>([...vocabulary, ...supportingLexicon].map((entry) => [entry.id, entry]))
const patterns = new Map(grammar.map((entry) => [entry.id, entry]))
const bookmarkKey = 'mimikara-novel-chapter-v1'
const readingChapters = novel.chapters.map(chapter => ({ ...chapter, sentences: chapterSentences(chapter.id, chapter.paragraphs) }))
const sentenceNumbers = new Map(readingChapters.flatMap(chapter => chapter.sentences).map((sentence, index) => [sentence.id, index + 1]))

const ignoreListeningChange = () => {}

const NovelChapter = memo(function NovelChapter({ item, language, activeSentence, engagedSentence, engageSentence, pinnedToken, open, playSentence }: {
  item: typeof readingChapters[number]; language: 'vi' | 'en'; activeSentence: string | null; engagedSentence: string | null; pinnedToken: string | null; engageSentence: (id: string) => void;
  open: (part: Annotation, pin: boolean, anchor: HTMLElement) => void; playSentence: (id: string) => void;
}) {
  const vi = language === 'vi'
  return <section className="novel-chapter" id={`novel-chapter-${item.id}`} aria-labelledby={`chapter-title-${item.id}`}>
    <div className="chapter-meta">{item.id} / {novel.chapters.length} · {item.characterCount.toLocaleString()} 字 · {vi ? '44 từ mục tiêu' : '44 study targets'}</div><h2 id={`chapter-title-${item.id}`}>{item.title}</h2>
    {item.paragraphs.map((_, p) => <p key={p}>{item.sentences.filter(sentence => sentence.paragraphIndex === p).map(sentence => <span key={sentence.id} data-sentence-id={sentence.id} aria-current={activeSentence === sentence.id ? 'true' : undefined} className={`story-sentence ${activeSentence === sentence.id ? 'speaking-sentence' : ''} ${engagedSentence === sentence.id ? 'engaged-sentence' : ''} ${pinnedToken?.startsWith(`${sentence.id}:`) ? 'pinned-sentence' : ''}`} onMouseEnter={() => engageSentence(sentence.id)} onFocus={() => engageSentence(sentence.id)} onClick={() => engageSentence(sentence.id)}>
      <span className="sentence-action"><button className="sentence-play" lang={language} aria-label={`${vi ? 'Nghe câu' : 'Play sentence'} ${sentenceNumbers.get(sentence.id)}`} onClick={event => { event.stopPropagation(); playSentence(sentence.id) }}>▶</button></span>
      {sentence.parts.map((part, i) => part.vocabularyIds.length || part.grammarId ? <button key={i} data-token-id={`${sentence.id}:${i}`} className={`story-token ${pinnedToken === `${sentence.id}:${i}` ? 'pinned-token' : ''} ${part.vocabularyIds.some((id) => id.startsWith('n3:')) ? 'target-word' : ''} ${part.grammarId ? 'grammar-token' : ''} ${item.targetIds.some(id => part.vocabularyIds.includes(id)) ? 'new-word' : ''}`} aria-label={`${part.text} · ${part.vocabularyIds.length ? (vi ? 'Từ vựng' : 'Vocabulary') : (vi ? 'Ngữ pháp' : 'Grammar')}`} aria-haspopup="dialog" onMouseEnter={event => open(part, false, event.currentTarget)} onFocus={event => open(part, false, event.currentTarget)} onClick={event => open(part, true, event.currentTarget)}>{part.text}</button> : <span key={i}>{part.text}</span>)}
    </span>)}</p>)}
  </section>
})

export function NovelReader({ onClose }: { onClose: () => void }) {
  const { language } = useLanguage()
  const vi = language === 'vi'
  const [chapterId, setChapterId] = useState(() => {
    try { const stored = Number(localStorage.getItem(bookmarkKey)); return novel.chapters.some((chapter) => chapter.id === stored) ? stored : 1 } catch { return 1 }
  })
  const [fontSize, setFontSize] = useState(20)
  const [highlight, setHighlight] = useState(true)
  const [controlsCollapsed, setControlsCollapsed] = useState(false)
  const [lookup, setLookup] = useState<Annotation | null>(null)
  const [pinned, setPinned] = useState(false)
  const [pinnedToken, setPinnedToken] = useState<string | null>(null)
  const lookupRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLElement | null>(null)
  const [popupPosition, setPopupPosition] = useState<(ReturnType<typeof lookupPosition> & { visible: boolean; edge: 'top' | 'bottom' | null; dockTop: number }) | null>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const playbackPanelRef = useRef<HTMLDivElement>(null)
  const proseRef = useRef<HTMLElement>(null)
  const playerRef = useRef<NovelAudioHandle>(null)
  const playSentence = useCallback((id: string) => playerRef.current?.startSentence(id), [])
  const restoredChapter = useRef(chapterId)
  const [activeSentence, setActiveSentence] = useState<string | null>(null)
  const [engagedSentence, setEngagedSentence] = useState<string | null>(null)
  const [followAudio, setFollowAudio] = useState(true)
  const chapter = novel.chapters.find((item) => item.id === chapterId) ?? novel.chapters[0]
  useLayoutEffect(() => {
    const panel = playbackPanelRef.current
    if (!panel) return
    const measure = () => shellRef.current?.style.setProperty('--reader-controls-height', `${Math.ceil(panel.getBoundingClientRect().height)}px`)
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(panel)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [])
  useLayoutEffect(() => {
    const card = lookupRef.current, anchor = anchorRef.current
    if (!lookup || !card || !anchor) return
    const position = () => {
      const rect = anchor.getBoundingClientRect()
      const cardRect = card.getBoundingClientRect()
      const controlsBottom = playbackPanelRef.current?.getBoundingClientRect().bottom ?? 0
      const edge = rect.width === 0 ? null : rect.bottom <= controlsBottom ? 'top' as const : rect.top >= window.innerHeight ? 'bottom' as const : null
      const next = { ...lookupPosition(rect, { width: cardRect.width || 320, height: Math.max(card.scrollHeight + 2, cardRect.height) }, { width: document.documentElement.clientWidth || window.innerWidth, height: window.innerHeight, top: controlsBottom }), visible: edge === null, edge, dockTop: Math.min(window.innerHeight - 60, Math.max(12, controlsBottom + 12)) }
      setPopupPosition(previous => previous && previous.left === next.left && previous.top === next.top && previous.maxHeight === next.maxHeight && previous.side === next.side && previous.visible === next.visible && previous.edge === next.edge && previous.dockTop === next.dockTop ? previous : next)
    }
    position()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(position)
    observer?.observe(card)
    if (playbackPanelRef.current) observer?.observe(playbackPanelRef.current)
    window.addEventListener('scroll', position, true)
    window.addEventListener('resize', position)
    return () => { observer?.disconnect(); window.removeEventListener('scroll', position, true); window.removeEventListener('resize', position) }
  }, [lookup, language, controlsCollapsed, pinned])
  useEffect(() => {
    if (activeSentence && followAudio) {
      const element = proseRef.current?.querySelector<HTMLElement>(`[data-sentence-id="${activeSentence}"]`)
      const bounds = element?.getBoundingClientRect()
      const controlsBottom = playbackPanelRef.current?.getBoundingClientRect().bottom ?? 0
      if (bounds && (bounds.top < controlsBottom + 20 || bounds.bottom > window.innerHeight - 80)) element?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    }
  }, [activeSentence, followAudio])
  useEffect(() => { try { localStorage.setItem(bookmarkKey, String(chapterId)) } catch { /* private browsing */ } }, [chapterId])
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setLookup(null); setPinned(false) } }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [])
  const jumpToChapter = (id: number) => proseRef.current?.querySelector(`#novel-chapter-${id}`)?.scrollIntoView?.({ block: 'start', behavior: 'instant' })
  useEffect(() => { jumpToChapter(restoredChapter.current) }, [])
  const selectChapter = (id: number) => { setChapterId(id); if (!pinned) setLookup(null) }
  const move = (id: number) => { selectChapter(id); jumpToChapter(id) }
  const moveAudio = (id: number) => { selectChapter(id); if (followAudio) jumpToChapter(id) }
  const open = useCallback((part: Annotation, pin: boolean, anchor: HTMLElement) => { if (pinned && !pin) return; anchorRef.current = anchor; setLookup(part); setPinned(pin); if (pin) setPinnedToken(anchor.dataset.tokenId ?? null); if (pin) requestAnimationFrame(() => lookupRef.current?.focus({ preventScroll: true })) }, [pinned])
  const unpin = () => { setLookup(null); setPinned(false) }
  const returnToPin = () => {
    setFollowAudio(false)
    const anchor = anchorRef.current
    anchor?.scrollIntoView?.({ block: 'center', behavior: 'instant' })
    const bounds = anchor?.getBoundingClientRect()
    const controlsBottom = playbackPanelRef.current?.getBoundingClientRect().bottom ?? 0
    if (bounds && bounds.top < controlsBottom + 20) window.scrollBy?.({ top: bounds.top - controlsBottom - 20, behavior: 'instant' })
    window.dispatchEvent(new Event('scroll'))
    requestAnimationFrame(() => lookupRef.current?.focus({ preventScroll: true }))
  }
  const selectedGrammar = lookup?.grammarId ? patterns.get(lookup.grammarId) : undefined
  return <div className="novel-shell" ref={shellRef}>
    <header className="novel-header"><button className="reader-back" onClick={onClose}>← {vi ? 'Luyện tập' : 'Practice'}</button><span>MIMIKARA · STORY</span><LanguageSwitch /></header>
    <main className="novel-main">
      <div className="novel-title"><span className="eyebrow">N3 READING · 20 CHAPTERS · 880 WORDS</span><h1 lang="ja">{novel.title}</h1><p>{novel.subtitle}</p>
        <p className="reader-instructions">{vi ? 'Di chuột hoặc nhấp vào từ để tra từ vựng và ngữ pháp. Nhấn nút ▶ ở đầu câu để nghe từ câu đó; Escape để đóng thẻ.' : 'Hover or click words to look up vocabulary and grammar. Use ▶ at the start of a sentence to listen from there; Escape closes the card.'}</p></div>
      <div className="novel-playback-panel" ref={playbackPanelRef}>
        <div className="reader-panel-heading"><strong>{vi ? 'Điều khiển đọc & nghe' : 'Reading & listening controls'}</strong><button type="button" className="reader-collapse" aria-label={vi ? controlsCollapsed ? 'Hiển thị điều khiển' : 'Ẩn điều khiển' : controlsCollapsed ? 'Show controls' : 'Hide controls'} aria-expanded={!controlsCollapsed} aria-controls="reader-control-content" onClick={() => setControlsCollapsed(value => !value)}><span aria-hidden="true">{controlsCollapsed ? '↓' : '↑'}</span></button></div>
        <div id="reader-control-content" hidden={controlsCollapsed}>
      <nav className="reader-controls" aria-label={vi ? 'Điều khiển đọc' : 'Reading controls'}>
        <label>{vi ? 'Chương' : 'Chapter'}<select aria-label={vi ? 'Chương' : 'Chapter'} value={chapterId} onChange={(event) => move(Number(event.target.value))}>{novel.chapters.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label>{vi ? 'Cỡ chữ' : 'Text size'}<input type="range" min="16" max="30" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /></label>
        <label className="reader-checkbox"><input type="checkbox" checked={highlight} onChange={(event) => setHighlight(event.target.checked)} />{vi ? 'Đánh dấu từ' : 'Highlight words'}</label>
      </nav>
        <NovelAudioPlayer ref={playerRef} manifest={audioManifest} chapterId={chapterId} onChapterChange={moveAudio} onSentenceChange={setActiveSentence} onListeningChange={ignoreListeningChange} />
        <div className="audio-reading-options"><div className="view-mode-switch"><span className={!followAudio ? 'selected-mode' : ''}>{vi ? 'Xem tự do' : 'Free view'}</span><button type="button" role="switch" aria-label={vi ? 'Xem tự động' : 'Automatic view'} aria-checked={followAudio} onClick={() => setFollowAudio(value => !value)}><span /></button><span className={followAudio ? 'selected-mode' : ''}>{vi ? 'Xem tự động' : 'Automatic view'}</span></div></div>
        </div>
      </div>
      <div className="novel-layout">
        <article ref={proseRef} className={`novel-prose ${highlight ? 'highlight-words' : ''}`} lang="ja" style={{ fontSize }}>
          {readingChapters.map(item => <NovelChapter key={item.id} item={item} language={language} pinnedToken={pinned && pinnedToken?.startsWith(`${item.id}:`) ? pinnedToken : null} engagedSentence={engagedSentence?.startsWith(`${item.id}:`) ? engagedSentence : null} engageSentence={setEngagedSentence} activeSentence={activeSentence?.startsWith(`${item.id}:`) ? activeSentence : null} open={open} playSentence={playSentence} />)}
        </article>

      </div>
      <div className="reader-popup">
          {lookup && pinned && popupPosition?.edge && <div className="pinned-lookup-dock" role="group" aria-label={vi ? 'Từ đã ghim ngoài màn hình' : 'Pinned word outside view'} data-edge={popupPosition.edge} style={popupPosition.edge === 'top' ? { top: popupPosition.dockTop } : { bottom: 12 }}>
            <button type="button" className="return-to-pin" aria-label={vi ? 'Quay lại từ đã ghim' : 'Return to pinned word'} onClick={returnToPin}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 17v5M5 17h14l-3-5V5l1-2H7l1 2v7Z" /></svg><span lang="ja">{lookup.text}</span></button>
            <button type="button" className="unpin-word" aria-label={vi ? 'Bỏ ghim từ' : 'Unpin word'} onClick={unpin}>×</button>
          </div>}
          {lookup && <div className="lookup-card" role="dialog" aria-modal="false" aria-label={vi ? 'Tra từ & ngữ pháp' : 'Word & grammar lookup'} tabIndex={-1} ref={lookupRef} data-side={popupPosition?.side} style={{ left: popupPosition?.left, top: popupPosition?.top, maxHeight: popupPosition?.maxHeight, visibility: popupPosition?.visible ? 'visible' : 'hidden' }}>
            <div className="lookup-top"><span>{pinned ? (vi ? 'Đã ghim' : 'Pinned') : (vi ? 'Tra nhanh' : 'Quick lookup')}</span><button aria-label={vi ? 'Đóng thẻ' : 'Close lookup'} onClick={unpin}>×</button></div>
            <p className="lookup-surface" lang="ja">{lookup.text}</p>
            {lookup.vocabularyIds.map((id) => { const entry = entries.get(id)!; const corrected = editorialCorrections[id]; return <section key={id} className="lookup-entry"><small>{entry.order ? `N3 · #${entry.order}` : `${vi ? 'Từ điển' : 'Dictionary'} · ${entry.source === 'JMdict' ? 'JMdict' : entry.source === 'N2' ? 'N2' : vi ? 'Bổ sung' : 'Editorial'}`}</small>{((corrected?.headword ?? entry.headword) !== lookup.text || lookup.vocabularyIds.length > 1) && <h3 lang="ja">{corrected?.headword ?? entry.headword}</h3>}<dl><dt>{vi ? 'Cách đọc' : 'Reading'}</dt><dd lang="ja">{corrected?.reading ?? entry.reading}</dd><dt>Hán Việt</dt><dd>{corrected ? corrected.hanViet ?? '—' : entry.hanViet ?? '—'}</dd><dt>{vi ? 'Nghĩa' : 'Meaning'}</dt><dd lang={language}>{lookupMeanings(entry, language).join(' · ')}</dd></dl>{corrected && <details><summary>{vi ? 'Hiệu chỉnh bản gốc' : 'Source correction'}</summary><p>{corrected.note}</p></details>}</section> })}
            {selectedGrammar && <section className="lookup-entry grammar-lookup"><small>{vi ? 'Ngữ pháp' : 'Grammar'} · #{selectedGrammar.order}</small><h3 lang="ja">{selectedGrammar.pattern}</h3><p>{vi ? 'Cách đọc:' : 'Reading:'} <span lang="ja">{grammarReference(selectedGrammar.pattern).reading}</span><br />Hán Việt (kanji): {grammarReference(selectedGrammar.pattern).hanViet}</p><p>{selectedGrammar.meanings[language].join(' · ')}</p><strong>{vi ? 'Cấu trúc' : 'Formation'}</strong><p>{selectedGrammar.formations.join(' / ') || '—'}</p>{selectedGrammar.notes && <p>{selectedGrammar.notes[language]}</p>}<p lang="ja">{selectedGrammar.examples[0].japanese}</p><p>{selectedGrammar.examples[0][language]}</p></section>}
          </div>}
      </div>
      <footer className="novel-resources">
          <details className="chapter-targets"><summary>{vi ? 'Từ mục tiêu trong chương' : 'Chapter study targets'}</summary><div>{chapter.targetIds.map((id) => { const entry = entries.get(id); return entry && <button key={id} onClick={event => open({ text: editorialCorrections[id]?.headword ?? entry.headword, vocabularyIds: [id] }, true, event.currentTarget)} lang="ja">{editorialCorrections[id]?.headword ?? entry.headword}</button> })}</div></details>
          <a className="novel-download" href="/novel.txt" download>{vi ? 'Tải tiểu thuyết (.txt)' : 'Download novel (.txt)'}</a>
          <br /><a className="novel-download" href="/novel-coverage.json" download>{vi ? 'Báo cáo 880 từ (.json)' : '880-word coverage report (.json)'}</a>
          <p className="reader-attribution">{vi ? 'Nghĩa bổ sung:' : 'Supporting glosses:'} <a href="https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project">JMdict</a> · <a href="/JMdict-LICENSE.txt">CC BY-SA 4.0</a></p>
      </footer>
    </main>
  </div>
}
