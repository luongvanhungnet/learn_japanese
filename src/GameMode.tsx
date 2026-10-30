import { GameGarden } from './GameGarden'
import { VocabularySearch } from './VocabularySearch'
import { useEffect, useRef, useState } from 'react'
import { LanguageSwitch } from './i18n'
import { useLanguage } from './translations'
import { readStudyValue } from './accountData'
import { useStudyPersistence } from './useStudyPersistence'
import { availableCards, earnRewards, englishContexts, gameCards, makeQuestion, normalizeKana, parseGameProgress, questionSeconds } from './game'
import type { GameCard, Question, Scene } from './game'
import './GameMode.css'

const currentTime = () => Date.now()

type Run = { question: Question; index: number; score: number; correct: number; attempts: number; combo: number; bestCombo: number; end: number; deadline: number; feedback: boolean | null; mistakes: Question[] }
const scenes: { id: Scene; icon: string; vi: string; en: string; level: string }[] = [
  { id: 'ramen', icon: '🍜', vi: 'Quán ramen', en: 'Ramen shop', level: 'N5 · N4' },
  { id: 'directions', icon: '🚉', vi: 'Hỏi đường', en: 'Find your way', level: 'N5 · N4' },
  { id: 'interview', icon: '💼', vi: 'Phỏng vấn', en: 'Job interview', level: 'N3 · Keigo' },
]
export function GameMode({ onClose }: { onClose: () => void }) {
  const { language } = useLanguage()
  const text = (vi: string, en: string) => language === 'vi' ? vi : en
  const [progress, setProgress] = useState(() => parseGameProgress(readStudyValue('mimikara-game-v1')))
  const [saveError, setSaveError] = useState(false)
  useStudyPersistence('mimikara-game-v1', JSON.stringify(progress), () => setSaveError(true))
  const [scene, setScene] = useState<Scene>('ramen')
  const [difficulty, setDifficulty] = useState<'gentle' | 'challenge'>('gentle')
  const [duel, setDuel] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [phase, setPhase] = useState<'prepare' | 'play' | 'reward'>('prepare')
  const [run, setRun] = useState<Run | null>(null)
  const runRef = useRef<Run | null>(null)
  const finished = useRef(false)
  const [now, setNow] = useState(currentTime)
  const [draft, setDraft] = useState('')
  const [audioError, setAudioError] = useState(false)
  const [audio, setAudio] = useState(false)
  const [reward, setReward] = useState<ReturnType<typeof earnRewards> | null>(null)
  const cards = availableCards(scene, progress)
  const deck = selected.length ? cards.filter(c => selected.includes(c.id)) : cards.slice(0, 4)
  const recordKey = `${language}:${scene}:${difficulty}:${audio ? 'audio' : 'visual'}:${deck.map(c => c.id).sort().join(',')}`
  const [target, setTarget] = useState(0)
  const audioSupported = typeof window.speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'
  const commit = (value: Run) => { runRef.current = value; setRun(value) }
  const stopAudio = () => { if (audioSupported) window.speechSynthesis.cancel() }
  const speak = (value: string) => {
    if (!audioSupported) { setAudioError(true); return }
    stopAudio()
    const utterance = new SpeechSynthesisUtterance(value)
    utterance.lang = 'ja-JP'; utterance.rate = .85
    const voice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('ja'))
    if (voice) utterance.voice = voice
    utterance.onerror = event => { if (event.error !== 'canceled' && event.error !== 'interrupted') setAudioError(true) }
    setAudioError(false)
    window.speechSynthesis.speak(utterance)
  }
  const finish = () => {
    if (finished.current || !runRef.current) return
    finished.current = true
    stopAudio()
    const current = runRef.current
    const earned = earnRewards(progress, scene, current.correct, current.score, recordKey)
    setReward(earned); setProgress(earned.progress); setPhase('reward')
  }
  const answer = (input: string, timedOut = false) => {
    const current = runRef.current
    if (!current || current.feedback !== null || finished.current) return
    const time = currentTime()
    if (time >= current.end) { finish(); return }
    const correct = !timedOut && time < current.deadline && (current.question.skill === 'kana' ? normalizeKana(input) === normalizeKana(current.question.answer) : input === current.question.answer)
    const combo = correct ? current.combo + 1 : 0
    commit({ ...current, attempts: current.attempts + 1, correct: current.correct + Number(correct), score: current.score + (correct ? 100 + Math.min(combo - 1, 10) * 20 : 0), combo, bestCombo: Math.max(current.bestCombo, combo), feedback: correct, mistakes: correct ? current.mistakes : [...current.mistakes, current.question] })
    stopAudio()
  }
  useEffect(() => {
    if (phase !== 'play') return
    const timer = window.setInterval(() => {
      const time = currentTime(); setNow(time)
      const current = runRef.current
      if (!current) return
      if (time >= current.end) finish()
      else if (time >= current.deadline && current.feedback === null) answer('', true)
    }, 100)
    return () => window.clearInterval(timer)
  })
  useEffect(() => () => { window.speechSynthesis?.cancel() }, [])
  const start = () => {
    if (deck.length < 3) return
    const time = currentTime()
    finished.current = false; setDraft(''); setReward(null); setNow(time); setTarget(progress.records[recordKey] ?? 0)
    commit({ question: makeQuestion(deck, 0, difficulty === 'challenge', language, audio), index: 0, score: 0, correct: 0, attempts: 0, combo: 0, bestCombo: 0, end: time + 60000, deadline: time + 10000, feedback: null, mistakes: [] })
    setPhase('play')
  }
  const next = () => {
    const current = runRef.current
    if (!current || current.feedback === null || finished.current) return
    if (currentTime() >= current.end) { finish(); return }
    const index = current.index + 1
    const question = makeQuestion(deck, index, difficulty === 'challenge', language, audio, current.question.card.id)
    commit({ ...current, index, question, deadline: currentTime() + questionSeconds(difficulty, current.combo) * 1000, feedback: null })
    setDraft(''); setAudioError(false)
    if (question.skill === 'listening') speak(question.card.kana)
  }
  const toggleCard = (card: GameCard) => {
    const ids = deck.map(c => c.id)
    setSelected(ids.includes(card.id) ? ids.filter(id => id !== card.id) : ids.length < 5 ? [...ids, card.id] : ids)
  }
  const goBack = () => { stopAudio(); onClose() }
  return <main className="game-shell">
    <header className="game-header"><button onClick={goBack}>← {text('Về trang học', 'Back to study')}</button><b>遊ぶ <span>PLAY LAB</span></b>{phase !== 'play' && <LanguageSwitch />}<VocabularySearch /></header>
    <div className="game-content">
      <div className="game-wallet"><span>✦ {progress.xp} EXP</span><span>◉ {progress.coins} {text('vàng', 'gold')}</span><span>Lv. {1 + Math.floor(progress.xp / 200)}</span></div>
      {saveError && <p role="alert">{text('Chưa lưu được tiến độ. Hãy kiểm tra dung lượng trình duyệt.', 'Progress could not be saved. Check browser storage.')}</p>}
      {phase !== 'play' && <GameGarden progress={progress} onChange={setProgress} />}
      {phase === 'prepare' && <>
        <span className="game-eyebrow">{text('HỌC MỘT CHÚT. TIẾN MỘT BƯỚC.', 'SMALL SESSIONS. REAL PROGRESS.')}</span>
        <h1>{text('Một phút ở Nhật.', 'One minute in Japan.')}<br /><em>{text('Bạn đã sẵn sàng?', 'Ready to play?')}</em></h1>
        <p className="game-lead">{text('Chọn thẻ → phản xạ 60 giây → nhận thưởng. Mỗi đáp án đúng là một bước tiến.', 'Build a deck → play for 60 seconds → earn rewards. Every correct answer moves you forward.')}</p>
        <section aria-label={text('Chọn tình huống', 'Choose a scene')} className="game-scenes">{scenes.map(s => <button key={s.id} aria-pressed={scene === s.id} onClick={() => { setScene(s.id); setSelected([]) }}><span>{s.icon}</span><strong>{s[language]}</strong><small>{s.level}</small></button>)}</section>
        <div className="game-setup">
          <section className="game-panel"><h2>01 · {text('Chuẩn bị bộ thẻ', 'Build your deck')}</h2><p>{text('Chọn 3–5 thẻ. Thẻ mới mở khóa sau lượt chơi có câu đúng.', 'Choose 3–5 cards. Unlock new cards after a run with a correct answer.')}</p><div className="game-deck">{gameCards.filter(c => c.scene === scene).map(card => {
            const unlocked = cards.some(c => c.id === card.id)
            return <button key={card.id} disabled={!unlocked} aria-pressed={deck.some(c => c.id === card.id)} onClick={() => toggleCard(card)}><b lang="ja">{card.word}</b><span>{unlocked ? card.kana : '🔒'}</span><small>{unlocked ? card[language] : text('Chưa mở khóa', 'Locked')}</small></button>
          })}</div><small>{deck.length}/5 {text('thẻ được chọn', 'cards selected')}</small></section>
          <section className="game-panel"><h2>02 · {text('Chọn thử thách', 'Choose your challenge')}</h2><div className="game-difficulty"><button aria-pressed={difficulty === 'gentle'} onClick={() => setDifficulty('gentle')}><strong>🌱 {text('Khởi động', 'Warm up')}</strong><small>{text('10 giây/câu · chọn nghĩa & nghe', '10 seconds · meaning & listening')}</small></button><button aria-pressed={difficulty === 'challenge'} onClick={() => setDifficulty('challenge')}><strong>🔥 {text('Bậc thầy', 'Mastery')}</strong><small>{text('10 → 2 giây · thêm gõ kana & ngữ cảnh', '10 → 2 seconds · kana & context')}</small></button></div><label className="game-toggle"><input type="checkbox" checked={audio} disabled={!audioSupported} onChange={e => setAudio(e.target.checked)} />{text('Thêm câu nghe (giọng Nhật của trình duyệt)', 'Include listening (browser Japanese voice)')}</label>{!audioSupported && <small>{text('Trình duyệt chưa hỗ trợ đọc tiếng Nhật.', 'Speech synthesis is unavailable in this browser.')}</small>}{audio && <button onClick={() => speak('こんにちは')}>{text('▶ Thử âm thanh', '▶ Test audio')}</button>}<label className="game-toggle"><input type="checkbox" checked={duel} onChange={e => setDuel(e.target.checked)} />{text('Word Duel · vượt kỷ lục của bạn', 'Word Duel · beat your personal best')}</label><small>{text('Đấu kỷ lục cá nhân, không phải PvP trực tuyến. So sánh cùng bộ thẻ và độ khó.', 'Personal best challenge, not online PvP. Compared with the same deck and settings.')}</small></section>
        </div>
        <div className="game-start"><p>{text('Đúng liên tiếp để tăng combo. Sai hoặc hết giờ sẽ ngắt chuỗi. Bật bàn phím Nhật cho câu gõ kana.', 'Keep answering correctly to build a combo. Errors and timeouts reset it. Use a Japanese keyboard for kana.')}</p><button className="game-primary" disabled={deck.length < 3 || deck.length > 5} onClick={start}>{text('Vào trận', 'Start playing')} → <small>60s</small></button></div>
      </>}
      {phase === 'play' && run && <>
        <div className="game-scoreboard"><span>⏱ <b>{Math.max(0, Math.ceil((run.end - now) / 1000))}s</b></span><span>{text('Điểm', 'Score')} <b>{run.score}</b></span><span>🔥 <b>Combo {run.combo}</b></span>{duel && <span>{text('Kỷ lục', 'Personal best')}: {target}</span>}</div>
        <progress className="game-session-progress" aria-label={text('Thời gian lượt chơi', 'Session time')} max={60} value={Math.max(0, (run.end - now) / 1000)} />
        <section className="game-question" key={run.index}>
          <span className="game-eyebrow">{scenes.find(s => s.id === scene)?.[language]} · {text('CÂU', 'QUESTION')} {run.index + 1}</span>
          <p>{run.question.skill === 'kana' ? text('Gõ cách đọc bằng Hiragana', 'Type the Hiragana reading') : run.question.skill === 'context' ? text('Chọn phản hồi phù hợp', 'Choose the appropriate response') : run.question.skill === 'listening' ? text('Nghe và chọn nghĩa', 'Listen and choose the meaning') : text('Chọn nghĩa đúng', 'Choose the meaning')}</p>
          <h2 lang={run.question.skill === 'context' ? language : 'ja'}>{run.question.skill === 'listening' ? '🎧' : run.question.skill === 'context' ? text(run.question.card.context, englishContexts[run.question.card.id][0]) : run.question.card.word}</h2>
          {run.question.skill === 'listening' && <button onClick={() => speak(run.question.card.kana)}>{text('▶ Nghe lại', '▶ Listen again')}</button>}
          {audioError && <p role="alert">{text('Không phát được giọng Nhật. Bạn có thể đọc:', 'Japanese voice unavailable. Read instead:')} <b lang="ja">{run.question.card.word} · {run.question.card.kana}</b></p>}
          <div className="game-clock"><span>{run.feedback === null ? Math.max(0, Math.ceil((run.deadline - now) / 1000)) : '—'}s</span><progress aria-label={text('Thời gian trả lời', 'Answer time')} max={questionSeconds(difficulty, run.combo)} value={run.feedback === null ? Math.max(0, (run.deadline - now) / 1000) : 0} /></div>
          {run.question.skill === 'kana' ? <form onSubmit={e => { e.preventDefault(); answer(draft) }}><input autoFocus aria-label={text('Câu trả lời Hiragana', 'Hiragana answer')} placeholder="ひらがな" value={draft} disabled={run.feedback !== null} onChange={e => setDraft(e.target.value)} autoComplete="off" /><button className="game-primary" disabled={run.feedback !== null || !draft.trim()}>{text('Trả lời', 'Answer')} ↵</button></form> : <div className="game-options">{run.question.options.map(option => <button key={option} disabled={run.feedback !== null} className={run.feedback !== null && option === run.question.answer ? 'game-correct-option' : ''} onClick={() => answer(option)}>{option}</button>)}</div>}
          {run.feedback !== null && <div role="status" className={`game-feedback ${run.feedback ? 'is-correct' : ''}`}><strong>{run.feedback ? text('✓ Chính xác!', '✓ Correct!') : text('Học thêm một chút nhé!', 'Keep learning!')}</strong><p><b>{run.question.answer}</b> · {run.question.card.word}（{run.question.card.kana}）</p>{run.question.skill === 'context' && <p>{text(run.question.card.explanation, englishContexts[run.question.card.id][1])}</p>}<button className="game-primary" autoFocus onClick={next}>{text('Câu tiếp theo', 'Next question')} →</button></div>}
        </section><button className="game-end" onClick={finish}>{text('Kết thúc lượt & nhận thưởng', 'Finish & collect rewards')}</button>
      </>}
      {phase === 'reward' && run && reward && <section className="game-results"><span className="game-reward-icon">🏮</span><span className="game-eyebrow">{text('MỖI LƯỢT CHƠI, MỘT BƯỚC TIẾN', 'A LITTLE BETTER EVERY RUN')}</span><h1>{text('Làm tốt lắm!', 'Well played!')}</h1><p>{duel ? (run.score > target ? text('Bạn đã lập kỷ lục mới!', 'A new personal best!') : text('Thử lại để vượt kỷ lục nhé.', 'Try again to beat your best.')) : text('Ôn lại rồi bắt đầu hành trình tiếp theo.', 'Review your words, then start your next adventure.')}</p><div className="game-scoreboard"><span>{run.score} {text('điểm', 'points')}</span><span>✓ {run.correct}/{run.attempts}</span><span>🔥 {run.bestCombo}</span><span>+{reward.xp} EXP</span><span>+{reward.coins} {text('vàng', 'gold')}</span></div>{reward.unlocked.length > 0 && <><h2>{text('Thẻ mới đã mở khóa', 'New cards unlocked')}</h2><div className="game-deck">{reward.unlocked.map(c => <article key={c.id}><b lang="ja">{c.word}</b><span>{c.kana}</span><small>{c[language]}</small></article>)}</div></>}{run.mistakes.length > 0 && <div className="game-review"><h2>{text('Từ cần ôn lại', 'Review these words')}</h2>{[...new Map(run.mistakes.map(q => [q.card.id, q])).values()].map(q => <p key={q.card.id}><b lang="ja">{q.card.word} · {q.card.kana}</b> — {q.card[language]}{q.skill === 'context' && <span> · {text(q.card.explanation, englishContexts[q.card.id][1])}</span>}</p>)}</div>}<div className="game-result-actions"><button className="game-primary" onClick={start}>{text('Chơi lại', 'Play again')} ↗</button><button onClick={() => { setSelected([]); setPhase('prepare') }}>{text('Đổi bộ thẻ', 'Change deck')}</button><button onClick={goBack}>{text('Về trang học', 'Back to study')}</button></div></section>}
      {audioError && phase === 'prepare' && <p role="alert">{text('Chưa phát được giọng Nhật. Hãy tắt câu nghe nếu thiết bị không hỗ trợ.', 'Japanese audio could not play. Disable listening if your device has no Japanese voice.')}</p>}
    </div>
  </main>
}
