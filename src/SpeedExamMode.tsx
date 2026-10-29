import { useCallback, useEffect, useRef, useState } from 'react'
import { speedQuestions } from './speedExamData'
import { LanguageSwitch } from './i18n'
import { useLanguage } from './translations'
import './SpeedExamMode.css'

const keys = ['ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight']
const arrows = ['←', '↑', '↓', '→']
const sections = { vocabulary: 'Từ vựng', grammar: 'Ngữ pháp', reading: 'Đọc hiểu', listening: 'Nghe' }

export function SpeedExamMode({ onClose }: { onClose: () => void }) {
  const { language } = useLanguage()
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [mistakes, setMistakes] = useState(0)
  const [audioError, setAudioError] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const lock = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const question = speedQuestions[index]
  const finished = !question
  const stopAudio = useCallback(() => {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [])

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
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat || target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      const choice = keys.indexOf(event.key)
      if (choice < 0 || finished) return
      event.preventDefault()
      choose(choice)
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [choose, finished])

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
    <header><button type="button" onClick={onClose}>{language === 'vi' ? '← Về học tập' : '← Back to study'}</button><LanguageSwitch /></header>
    <div className="speed-intro"><span className="eyebrow">JLPT N3 · 30 CÂU</span><h1>Ôn thi thần tốc</h1>
      <p>Bộ câu hỏi luyện tập do Codex biên soạn: 5 từ vựng · 5 ngữ pháp · 10 đọc hiểu · 10 nghe.</p>
      <p>Chạm hoặc bấm đáp án. Phím tắt: ← A · ↑ B · ↓ C · → D. Đúng: xanh lá, chuyển câu sau 2 giây. Sai: đỏ trong 2 giây, sau đó chọn lại.</p>
      <small>Phần nghe dùng giọng tiếng Nhật của trình duyệt. Các dạng được chuyển về 4 lựa chọn cho chế độ luyện tập này.</small>
    </div>
    <progress aria-label="Tiến độ" value={index} max={speedQuestions.length} />
    {question ? <section className="speed-card" aria-labelledby="speed-question" key={question.id}>
      <div className="speed-meta"><span>Câu {index + 1} / {speedQuestions.length}</span><span>{sections[question.section]} · {question.kind}</span></div>
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
    </section> : <section className="speed-card"><h2>Hoàn thành 30 câu!</h2><p>Bạn đã trả lời đúng tất cả các câu sau khi luyện tập. Số lần chọn sai: {mistakes}.</p><button type="button" onClick={() => { setIndex(0); setMistakes(0); setSelected(null); lock.current = false }}>Luyện lại</button></section>}
  </main>
}
