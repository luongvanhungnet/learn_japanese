import { VocabularySearch } from './VocabularySearch'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { speedQuestions } from './speedExamData'
import { allSpeedTypes, selectSpeedQuestions, speedGroups, speedSections } from './speedExamSelection'
import type { SpeedSort } from './speedExamSelection'
import { LanguageSwitch } from './i18n'
import { useLanguage } from './translations'
import './SpeedExamMode.css'

const keys = ['ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight']
const arrows = ['←', '↑', '↓', '→']


export function SpeedExamMode({ onClose }: { onClose: () => void }) {
  const { language } = useLanguage()
  const [types, setTypes] = useState(allSpeedTypes)
  const [sort, setSort] = useState<SpeedSort>('original')
  const [seed, setSeed] = useState(1)
  const questions = useMemo(() => selectSpeedQuestions(types, sort, seed), [types, sort, seed])
  const [index, setIndex] = useState(0)
  const [jumpOpen, setJumpOpen] = useState(false)
  const [jumpValue, setJumpValue] = useState('')
  const [jumpError, setJumpError] = useState('')
  const jumpButton = useRef<HTMLButtonElement>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [mistakes, setMistakes] = useState(0)
  const [audioError, setAudioError] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const lock = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const question = questions[index]
  const finished = !question
  const stopAudio = useCallback(() => {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [])

  const reset = () => {
    clearTimeout(timer.current)
    lock.current = false
    stopAudio()
    setIndex(0)
    setJumpOpen(false)
    setJumpError('')
    setSelected(null)
    setMistakes(0)
    setAudioError('')
  }
  const jumpToQuestion = () => {
    const value = jumpValue.trim()
    const number = Number(value)
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < 1 || number > questions.length) {
      setJumpError(`Nhập số nguyên từ 1 đến ${questions.length}.`)
      return
    }
    clearTimeout(timer.current)
    lock.current = false
    stopAudio()
    setAudioError('')
    setSelected(null)
    setIndex(number - 1)
    setJumpOpen(false)
    setJumpError('')
    jumpButton.current?.focus()
  }
  const changeTypes = (next: string[]) => { reset(); setTypes(next) }

  useEffect(() => () => {
    clearTimeout(timer.current)
    window.speechSynthesis?.cancel()
  }, [])

  const choose = useCallback((choice: number) => {
    if (lock.current || !question) return
    lock.current = true
    setSelected(choice)
    const correct = choice === question.answer
    if (!correct) setMistakes(value => value + 1)
    timer.current = setTimeout(() => {
      if (correct) {
        setJumpOpen(false)
        stopAudio()
        setAudioError('')
        setIndex(value => value + 1)
      }
      setSelected(null)
      lock.current = false
    }, 2000)
  }, [question, stopAudio])

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat || target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|SUMMARY)$/.test(target.tagName))) return
      const choice = keys.indexOf(event.key)
      if (choice < 0 || finished || jumpOpen) return
      event.preventDefault()
      choose(choice)
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [choose, finished, jumpOpen])

  const play = () => {
    if (!question?.audioText) return
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      setAudioError('Trình duyệt không hỗ trợ đọc tiếng Nhật. Hãy dùng trình duyệt có giọng đọc tiếng Nhật để luyện nghe.')
      return
    }
    stopAudio()
    setAudioError('')
    const utterance = new SpeechSynthesisUtterance(question.audioText)
    utterance.lang = 'ja-JP'
    utterance.rate = 0.9
    const voice = window.speechSynthesis.getVoices().find(item => item.lang.startsWith('ja'))
    if (voice) utterance.voice = voice
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = event => {
      if (event.error === 'canceled' || event.error === 'interrupted') return
      setSpeaking(false)
      setAudioError('Không phát được tiếng Nhật. Hãy kiểm tra giọng đọc và thử lại.')
    }
    setSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  return <main className="speed-exam">
    <header><button type="button" onClick={onClose}>{language === 'vi' ? '← Về học tập' : '← Back to study'}</button><LanguageSwitch /><VocabularySearch /></header>
    <div className="speed-intro"><span className="eyebrow">JLPT N3 · {speedQuestions.length} CÂU</span><h1>Ôn thi thần tốc</h1>
      <p>Bộ câu hỏi luyện tập do Codex biên soạn: {speedGroups.map(group => `${group.types.reduce((sum, type) => sum + type.count, 0)} ${group.label.toLocaleLowerCase('vi')}`).join(' · ')}.</p>
      <p>Chạm hoặc bấm đáp án. Phím tắt: ← A · ↑ B · ↓ C · → D. Đúng: xanh lá, chuyển câu sau 2 giây. Sai: đỏ trong 2 giây, sau đó chọn lại.</p>
      <small>Phần nghe dùng giọng tiếng Nhật của trình duyệt. Các dạng được chuyển về 4 lựa chọn cho chế độ luyện tập này.</small>
    </div>
    <div className="speed-toolbar">
      <details className="speed-filter">
        <summary>Filter · Lọc câu hỏi ({questions.length}/{speedQuestions.length})</summary>
        <div className="speed-filter-actions"><button type="button" onClick={() => changeTypes(allSpeedTypes)}>Chọn tất cả</button><button type="button" onClick={() => changeTypes([])}>Bỏ chọn tất cả</button></div>
        <div className="speed-filter-groups">
          {speedGroups.map(group => {
            const ids = group.types.map(type => type.id)
            const count = ids.filter(id => types.includes(id)).length
            return <fieldset key={group.section}><legend>{group.label}</legend>
              <label className="speed-section-check"><input type="checkbox" checked={count === ids.length} ref={input => { if (input) input.indeterminate = count > 0 && count < ids.length }} onChange={event => changeTypes(event.target.checked ? [...new Set([...types, ...ids])] : types.filter(id => !ids.includes(id)))} />Toàn bộ {group.label.toLocaleLowerCase('vi')} ({group.types.reduce((sum, type) => sum + type.count, 0)})</label>
              {group.types.map(type => <label key={type.id}><input type="checkbox" checked={types.includes(type.id)} onChange={event => changeTypes(event.target.checked ? [...types, type.id] : types.filter(id => id !== type.id))} />{type.label} ({type.count})</label>)}
            </fieldset>
          })}
        </div>
      </details>
      <label className="speed-sort">Sort · Sắp xếp<select value={sort} onChange={event => { reset(); setSort(event.target.value as SpeedSort); setSeed(Math.floor(Math.random() * 0x100000000)) }}>
        <option value="original">Thứ tự gốc</option><option value="reverse">Thứ tự đảo ngược</option><option value="type">Theo phần và dạng câu hỏi</option><option value="random">Ngẫu nhiên</option>
      </select></label>
    </div>
    <p className="speed-selection-note">Đang chọn {questions.length} câu. Đổi bộ lọc hoặc thứ tự sẽ bắt đầu lượt mới. Luyện lại sẽ xáo trộn lại nếu chọn ngẫu nhiên.</p>
    <progress aria-label="Tiến độ" value={index} max={questions.length || 1} />
    {question ? <section className="speed-card" aria-labelledby="speed-question" key={question.id}>
      <div className="speed-meta"><button ref={jumpButton} className="speed-question-number" type="button" aria-expanded={jumpOpen} aria-controls="speed-jump-form" title="Chuyển tới câu hỏi" onClick={() => { setJumpValue(String(index + 1)); setJumpError(''); setJumpOpen(value => !value) }}>Câu {index + 1} / {questions.length}</button><span>{speedSections[question.section]} · {question.kind}</span></div>
      {jumpOpen && <form id="speed-jump-form" className="speed-jump" noValidate onSubmit={event => { event.preventDefault(); jumpToQuestion() }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setJumpOpen(false); jumpButton.current?.focus() } }}>
        <label>Chuyển tới câu<input autoFocus type="number" inputMode="numeric" min={1} max={questions.length} step={1} value={jumpValue} aria-invalid={Boolean(jumpError)} aria-describedby={jumpError ? 'speed-jump-error' : 'speed-jump-hint'} onChange={event => { setJumpValue(event.target.value); setJumpError('') }} /></label>
        <button type="submit">Chuyển</button><button type="button" onClick={() => { setJumpOpen(false); jumpButton.current?.focus() }}>Hủy</button>
        <small id="speed-jump-hint">Từ 1 đến {questions.length}, theo bộ lọc và thứ tự hiện tại.</small>
        {jumpError && <p id="speed-jump-error" role="alert">{jumpError}</p>}
      </form>}
      {question.passage && <div className="speed-passage" lang="ja">{question.passage}</div>}
      {question.audioText && <div className="speed-audio"><button type="button" onClick={play}>▶ {speaking ? 'Nghe lại' : 'Nghe câu hỏi'}</button><button type="button" disabled={!speaking} onClick={stopAudio}>Dừng</button><span role="status">{speaking ? 'Đang phát tiếng Nhật…' : ''}</span>{audioError && <p role="alert">{audioError}</p>}</div>}
      <h2 id="speed-question" lang="ja">{question.prompt}</h2>
      <div className="speed-choices" role="group" aria-label="Chọn đáp án">
        {question.choices.map((choice, option) => <button type="button" key={`${question.id}-${option}`} disabled={selected !== null} className={selected === option ? option === question.answer ? 'correct' : 'incorrect' : ''} onClick={() => choose(option)}>
          <b>{'ABCD'[option]} <small>{arrows[option]}</small></b><span lang="ja">{choice}</span>
        </button>)}
      </div>
      <div className="speed-feedback" role="status" aria-live="polite">
        {selected === null ? 'Chọn một đáp án để tiếp tục.' : selected === question.answer ? `✓ Chính xác! ${question.explanation} Chuyển câu sau 2 giây…` : '✗ Chưa đúng. Hãy chọn lại sau 2 giây.'}
      </div>
    </section> : !questions.length ? <section className="speed-card"><h2>Chưa chọn dạng câu hỏi</h2><p>Hãy chọn ít nhất một phần hoặc dạng câu hỏi trong menu Filter để bắt đầu.</p><button type="button" onClick={() => changeTypes(allSpeedTypes)}>Chọn tất cả {speedQuestions.length} câu</button></section> : <section className="speed-card"><h2>Hoàn thành {questions.length} câu!</h2><p>Bạn đã đến cuối bộ câu hỏi. Có thể luyện lại để ôn các câu đã bỏ qua. Số lần chọn sai: {mistakes}.</p><button type="button" onClick={() => { reset(); setSeed(Math.floor(Math.random() * 0x100000000)) }}>Luyện lại</button></section>}
  </main>
}
