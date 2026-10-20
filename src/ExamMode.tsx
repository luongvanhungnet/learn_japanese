import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LanguageSwitch } from './i18n'
import { useLanguage } from './translations'
import { AccountMenu } from './AccountMenu'
import { readStudyValue } from './accountData'
import { useStudyPersistence } from './useStudyPersistence'
import { answerExam, examStorageKey, expireExam, parseExamHistory, remainingExamSeconds, saveExamAttempt, scoreExam, startExam, submitExam } from './exam'
import type { ExamChoice, ExamHistory, ExamPaper, ExamSectionId } from './exam'
import { examPapers, examSource } from './examData'
import './ExamMode.css'

const messages = {
  en: {
    title: 'Exam', eyebrow: 'PAST PAPERS · N3', back: 'Back to study',
    introduction: 'N3 written practice in 100 minutes. Suggested allocation: vocabulary 30 minutes, grammar and reading 70 minutes.',
    limitations: 'Listening is excluded because the document has no audio. Your practice percentage uses a reviewed practice key; it is not an official JLPT scaled score or pass result.',
    community: 'The supplied document contains reconstructed community papers. Original pages are shown below; practice keys were prepared separately.',
    vocabulary: 'Vocabulary', 'grammar-reading': 'Grammar and reading', grammar: 'Grammar', reading: 'Reading',
    start: 'Start exam', papers: 'Choose a paper', questions: 'questions', minutes: 'min', july: 'July', december: 'December',
    timer: 'Time remaining', timerHint: 'The timer continues if you leave this screen or close the tab. Answers are saved as you go.',
    answered: 'answered', sheet: 'Answer sheet', sourcePage: 'Source page', previous: 'Previous page', next: 'Next page', zoom: 'Enlarge page', unzoom: 'Fit page',
    viewQuestion: 'View question', question: 'question', choice: 'choice', clear: 'Clear answer',
    submit: 'Submit exam', confirmTitle: 'Ready to submit?', confirm: 'Submit and see score', cancel: 'Keep working',
    confirmHint: 'You cannot change answers after submitting.', unanswered: 'Unanswered',
    result: 'Your result', practiceScore: 'Written practice score', correct: 'Correct', wrong: 'Incorrect', unscored: 'Not scored',
    timeout: 'Time is up. Your saved answers were submitted automatically.', manual: 'Exam submitted. Review your answers below.',
    scoreHint: 'Each scored question counts equally. Unanswered questions count as incorrect. Listening and unscored items are excluded.',
    review: 'Answer review', yourAnswer: 'Your answer', correctAnswer: 'Correct answer', ambiguous: 'Not scored — source ambiguity',
    retake: 'Retake this paper', allPapers: 'All papers', history: 'Recent attempts', completed: 'Completed',
    storageError: 'Your exam could not be saved on this device. Keep this page open to retain this attempt.',
    source: 'Source', keyLabel: 'Reviewed practice key', empty: 'No exam papers are available yet.', imageError: 'This source page could not be loaded.', retryPage: 'Retry page',
  },
  vi: {
    title: 'Thi thử', eyebrow: 'ĐỀ CÁC NĂM · N3', back: 'Về học tập',
    introduction: 'Làm bài viết N3 trong 100 phút. Thời gian gợi ý: từ vựng 30 phút, ngữ pháp và đọc hiểu 70 phút.',
    limitations: 'Không có phần nghe vì tài liệu không kèm âm thanh. Điểm phần trăm luyện tập dùng đáp án được biên soạn và rà soát; đây không phải điểm quy đổi hoặc kết quả đỗ JLPT chính thức.',
    community: 'Tài liệu được cung cấp gồm các đề do cộng đồng phục dựng. Trang gốc được hiển thị bên dưới; đáp án luyện tập được biên soạn riêng.',
    vocabulary: 'Từ vựng', 'grammar-reading': 'Ngữ pháp và đọc hiểu', grammar: 'Ngữ pháp', reading: 'Đọc hiểu',
    start: 'Bắt đầu thi', papers: 'Chọn đề thi', questions: 'câu hỏi', minutes: 'phút', july: 'Tháng 7', december: 'Tháng 12',
    timer: 'Thời gian còn lại', timerHint: 'Đồng hồ vẫn chạy khi bạn rời màn hình hoặc đóng tab. Câu trả lời được lưu tự động.',
    answered: 'đã trả lời', sheet: 'Phiếu trả lời', sourcePage: 'Trang tài liệu', previous: 'Trang trước', next: 'Trang sau', zoom: 'Phóng to trang', unzoom: 'Vừa trang',
    viewQuestion: 'Xem câu', question: 'câu', choice: 'đáp án', clear: 'Xóa câu trả lời',
    submit: 'Nộp bài', confirmTitle: 'Bạn đã sẵn sàng nộp bài?', confirm: 'Nộp bài và xem điểm', cancel: 'Tiếp tục làm bài',
    confirmHint: 'Bạn không thể thay đổi câu trả lời sau khi nộp.', unanswered: 'Chưa trả lời',
    result: 'Kết quả của bạn', practiceScore: 'Điểm luyện tập phần viết', correct: 'Đúng', wrong: 'Sai', unscored: 'Không tính điểm',
    timeout: 'Đã hết giờ. Các câu trả lời đã lưu được nộp tự động.', manual: 'Đã nộp bài. Xem lại các câu trả lời bên dưới.',
    scoreHint: 'Mỗi câu được chấm có trọng số bằng nhau. Câu bỏ trống tính là sai. Phần nghe và câu không được chấm không nằm trong điểm này.',
    review: 'Xem lại đáp án', yourAnswer: 'Câu trả lời của bạn', correctAnswer: 'Đáp án đúng', ambiguous: 'Không tính điểm — tài liệu có điểm chưa rõ',
    retake: 'Làm lại đề này', allPapers: 'Tất cả đề thi', history: 'Các lần thi gần đây', completed: 'Đã hoàn thành',
    storageError: 'Không thể lưu bài thi trên thiết bị này. Hãy giữ trang mở để giữ lại bài đang làm.',
    source: 'Tài liệu', keyLabel: 'Đáp án luyện tập đã rà soát', empty: 'Chưa có đề thi.', imageError: 'Không thể tải trang tài liệu này.', retryPage: 'Tải lại trang',
  },
} as const

const pageUrl = (page: number) => `/exams/pages/${String(page).padStart(3, '0')}.webp`
const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

function readHistory(): ExamHistory {
  // Preserve the stored running state until the clock effect expires it. That
  // transition must be persisted even when account initial writes are skipped.
  try { return parseExamHistory(readStudyValue(examStorageKey), examPapers, 0) } catch { return { version: 1, attempts: {} } }
}

export function ExamMode({ onClose }: { onClose: () => void }) {
  const { language, locale } = useLanguage()
  const text = messages[language]
  const [session, setSession] = useState<{ history: ExamHistory; attemptId: string | null }>(() => {
    const history = readHistory()
    const latest = Object.values(history.attempts).sort((a, b) => b.startedAt - a.startedAt)[0]
    return { history, attemptId: latest?.id ?? null }
  })
  const [now, setNow] = useState(Date.now)
  const [pageIndex, setPageIndex] = useState(0)
  const [enlarged, setEnlarged] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null)
  const [imageError, setImageError] = useState<number | null>(null)
  const [imageRetry, setImageRetry] = useState(0)
  const pageViewerRef = useRef<HTMLElement>(null)
  const imageScrollRef = useRef<HTMLDivElement>(null)
  const reportStorageError = useCallback(() => setStorageError(true), [])
  useStudyPersistence(examStorageKey, useMemo(() => JSON.stringify(session.history), [session.history]), reportStorageError)

  const attempt = session.attemptId ? session.history.attempts[session.attemptId] : undefined
  const paper = examPapers.find((item) => item.id === attempt?.paperId)
  const submitted = attempt?.submittedAt !== null && attempt?.submittedAt !== undefined
  const questions = paper?.sections.flatMap((section) => section.questions) ?? []
  const pages = paper ? [...new Set(paper.sections.flatMap((section) => section.pages))].filter((page) => !paper.answerKeyPages.includes(page)) : []
  const page = pages[Math.min(pageIndex, pages.length - 1)]
  const answered = questions.filter((question) => attempt?.answers[question.id]).length
  const seconds = attempt ? remainingExamSeconds(attempt, now) : 0
  const score = paper && attempt && submitted ? scoreExam(paper, attempt) : null
  const completed = Object.values(session.history.attempts).filter((item) => item.submittedAt !== null).sort((a, b) => b.startedAt - a.startedAt)
  const paperTitle = (item: ExamPaper) => `N3 · ${item.month === 7 ? text.july : text.december} ${item.year}`
  const sectionTitle = (id: ExamSectionId) => text[id]
  const activeAttemptId = attempt && !submitted ? attempt.id : null
  const deadline = attempt?.deadline

  useEffect(() => {
    if (!imageScrollRef.current) return
    imageScrollRef.current.scrollTop = 0
    imageScrollRef.current.scrollLeft = 0
  }, [page, selectedQuestion])

  useEffect(() => {
    if (!activeAttemptId || deadline === undefined) return
    const refresh = () => {
      const timestamp = Date.now()
      setNow(timestamp)
      setSession((current) => {
        const running = current.history.attempts[activeAttemptId]
        if (!running) return current
        const expired = expireExam(running, timestamp)
        if (expired === running) return current
        return { ...current, history: saveExamAttempt(current.history, expired) }
      })
    }
    refresh()
    const interval = window.setInterval(refresh, 1_000)
    const expiry = window.setTimeout(refresh, Math.min(2_147_483_647, Math.max(0, deadline - Date.now())))
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(interval)
      window.clearTimeout(expiry)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [activeAttemptId, deadline])

  const begin = (selected: ExamPaper) => {
    const started = startExam(selected)
    setSession((current) => ({ history: saveExamAttempt(current.history, started), attemptId: started.id }))
    setNow(started.startedAt)
    setPageIndex(0)
    setConfirming(false)
    setEnlarged(false)
    setSelectedQuestion(null)
  }
  const selectAnswer = (questionId: string, choice: ExamChoice | null) => {
    if (!paper || !attempt || submitted) return
    const updated = answerExam(paper, attempt, questionId, choice)
    setSession((current) => ({ ...current, history: saveExamAttempt(current.history, updated) }))
  }
  const finish = () => {
    if (!attempt || submitted) return
    const updated = submitExam(attempt)
    setSession((current) => ({ ...current, history: saveExamAttempt(current.history, updated) }))
    setNow(updated.submittedAt ?? updated.startedAt)
    setConfirming(false)
  }
  const goToQuestion = (questionId: string, sourcePage: number) => {
    const index = pages.indexOf(sourcePage)
    if (index !== -1) setPageIndex(index)
    setSelectedQuestion(questionId)
    if (window.innerWidth <= 760) pageViewerRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
  }

  return <main className="exam-shell">
    <header className="exam-header">
      <div className="brand"><span className="brand-mark">み</span><span>MIMIKARA <strong>STUDY</strong></span></div>
      <button className="exam-button exam-back" type="button" onClick={onClose}>{text.back}</button>
      <LanguageSwitch />
      <AccountMenu />
    </header>
    <section className={`exam-workspace${attempt ? ' exam-workspace-wide' : ''}`}>
      <div className="exam-heading">
        <span className="eyebrow">{text.eyebrow}</span>
        <h1>{submitted ? text.result : text.title}</h1>
        {!attempt && <p>{text.introduction}</p>}
        {paper && <p>{paperTitle(paper)} · {questions.length} {text.questions} · {text.keyLabel}</p>}
      </div>

      {!attempt && <>
        <div className="exam-note"><p>{text.limitations}</p><p>{text.community}</p></div>
        <div className="exam-paper-grid" role="group" aria-label={text.papers}>
          {examPapers.map((item) => <article className="exam-paper" key={item.id}>
            <span className="exam-paper-year">{item.year}</span>
            <h2>{paperTitle(item)}</h2>
            <p>{item.sections.reduce((sum, section) => sum + section.questions.length, 0)} {text.questions} · {item.durationMinutes} {text.minutes}</p>
            <ul>{item.sections.map((section) => <li key={section.id}><span>{sectionTitle(section.id)}</span><strong>{section.durationMinutes} {text.minutes}</strong></li>)}</ul>
            <button className="exam-button exam-primary" type="button" onClick={() => begin(item)}>{text.start}</button>
          </article>)}
        </div>
        {!examPapers.length && <p role="status">{text.empty}</p>}
        {!!completed.length && <section className="exam-history" aria-label={text.history}>
          <h2>{text.history}</h2>
          {completed.slice(0, 10).map((item) => {
            const oldPaper = examPapers.find((entry) => entry.id === item.paperId)
            if (!oldPaper) return null
            const oldScore = scoreExam(oldPaper, item)
            return <button className="exam-history-row" type="button" key={item.id} onClick={() => { setSession((current) => ({ ...current, attemptId: item.id })); setPageIndex(0) }}>
              <span>{paperTitle(oldPaper)}<small>{new Date(item.submittedAt!).toLocaleString(locale)}</small></span>
              <strong>{oldScore.correct} / {oldScore.total} · {oldScore.percentage}%</strong>
            </button>
          })}
        </section>}
      </>}

      {attempt && paper && <>
        {!submitted && <div className="exam-session-bar">
          <div className="exam-progress"><strong>{answered} / {questions.length} {text.answered}</strong><progress value={answered} max={questions.length} aria-label={text.answered} /></div>
          <div className={`exam-clock${seconds <= 300 ? ' exam-clock-warning' : ''}`}><span>{text.timer}</span><strong role="timer" aria-label={text.timer}>{formatTime(seconds)}</strong></div>
          <button className="exam-button exam-primary" type="button" onClick={() => setConfirming(true)}>{text.submit}</button>
          <p>{text.timerHint}</p>
        </div>}
        {score && <section className="exam-results" aria-label={text.practiceScore}>
          <div className="exam-score"><span>{text.practiceScore}</span><strong>{score.correct} / {score.total}</strong><b>{score.percentage}%</b></div>
          <div className="exam-result-details">
            <p role="status">{attempt.reason === 'timeout' ? text.timeout : text.manual}</p>
            <div className="exam-result-counts"><span>{text.correct}: <b>{score.correct}</b></span><span>{text.wrong}: <b>{score.total - score.correct - score.unanswered}</b></span><span>{text.unanswered}: <b>{score.unanswered}</b></span>{score.unscored > 0 && <span>{text.unscored}: <b>{score.unscored}</b></span>}</div>
            <div className="exam-section-scores">{score.sections.map((section) => <span key={section.id}>{sectionTitle(section.id)} <strong>{section.correct} / {section.total}</strong></span>)}</div>
            <p className="exam-score-hint">{text.scoreHint}</p>
            <div className="exam-result-actions"><button className="exam-button exam-primary" type="button" onClick={() => begin(paper)}>{text.retake}</button><button className="exam-button" type="button" onClick={() => setSession((current) => ({ ...current, attemptId: null }))}>{text.allPapers}</button></div>
          </div>
        </section>}
        {confirming && !submitted && <section className="exam-confirm" role="alertdialog" aria-labelledby="exam-confirm-title" aria-describedby="exam-confirm-hint">
          <h2 id="exam-confirm-title">{text.confirmTitle}</h2>
          <p id="exam-confirm-hint">{text.unanswered}: <strong>{questions.length - answered}</strong>. {text.confirmHint}</p>
          <button className="exam-button exam-primary" type="button" onClick={finish}>{text.confirm}</button>
          <button className="exam-button" type="button" onClick={() => setConfirming(false)}>{text.cancel}</button>
        </section>}
        <div className="exam-taking-grid">
          <section className="exam-page-viewer" ref={pageViewerRef} aria-label={text.sourcePage}>
            <div className="exam-page-toolbar">
              <button className="exam-button" type="button" disabled={pageIndex === 0} aria-label={text.previous} onClick={() => setPageIndex((index) => Math.max(0, index - 1))}>←</button>
              <select aria-label={text.sourcePage} value={pageIndex} onChange={(event) => setPageIndex(Number(event.target.value))}>{pages.map((sourcePage, index) => <option value={index} key={sourcePage}>{text.sourcePage} {sourcePage}</option>)}</select>
              <button className="exam-button" type="button" disabled={pageIndex >= pages.length - 1} aria-label={text.next} onClick={() => setPageIndex((index) => Math.min(pages.length - 1, index + 1))}>→</button>
              <button className="exam-button exam-zoom" type="button" aria-pressed={enlarged} onClick={() => setEnlarged((value) => !value)}>{enlarged ? text.unzoom : text.zoom}</button>
            </div>
            <div className={`exam-page-image${enlarged ? ' is-enlarged' : ''}`} ref={imageScrollRef}>{page !== undefined && (imageError === page ? <div className="exam-page-error" role="alert"><p>{text.imageError}</p><button className="exam-button" type="button" onClick={() => { setImageError(null); setImageRetry((value) => value + 1) }}>{text.retryPage}</button></div> : <img key={`${page}-${imageRetry}`} src={`${pageUrl(page)}${imageRetry ? `?retry=${imageRetry}` : ''}`} alt={`${text.sourcePage} ${page} · ${paperTitle(paper)}`} onError={() => setImageError(page)} />)}</div>
          </section>
          <section className="exam-answer-sheet" aria-label={submitted ? text.review : text.sheet}>
            <div className="exam-sheet-title"><h2>{submitted ? text.review : text.sheet}</h2><span>{answered} / {questions.length}</span></div>
            {paper.sections.map((section) => <div className="exam-answer-section" key={section.id}>
              <h3>{sectionTitle(section.id)} <small>{section.questions.length} {text.questions}</small></h3>
              {section.questions.map((question) => {
                const selected = attempt.answers[question.id]
                const status = !submitted ? (selected ? 'answered' : 'unanswered') : question.answer === null ? 'unscored' : selected === question.answer ? 'correct' : selected ? 'wrong' : 'unanswered'
                const questionLabel = `${sectionTitle(section.id)} ${text.question} ${question.number}`
                return <fieldset className={`exam-answer-row is-${status}${selectedQuestion === question.id ? ' is-selected' : ''}`} key={question.id}>
                  <legend><button type="button" aria-label={`${text.viewQuestion} ${questionLabel}`} onClick={() => goToQuestion(question.id, question.page)}><span>{question.number}</span>{question.group && <small>{text[question.group]}</small>}</button></legend>
                  {!submitted && <><div className="exam-choices">{([1, 2, 3, 4] as const).map((choice) => <label key={choice} className={selected === choice ? 'is-checked' : ''}><input type="radio" name={`exam-${attempt.id}-${question.id}`} aria-label={`${questionLabel}, ${text.choice} ${choice}`} checked={selected === choice} onChange={() => selectAnswer(question.id, choice)} /><span>{choice}</span></label>)}</div><button className="exam-clear" type="button" disabled={!selected} aria-label={`${text.clear}: ${questionLabel}`} onClick={() => selectAnswer(question.id, null)}>×</button></>}
                  {submitted && <div className="exam-answer-review"><span>{text.yourAnswer}: <strong>{selected ?? '—'}</strong></span><span>{question.answer === null ? text.ambiguous : <>{text.correctAnswer}: <strong>{question.answer}</strong></>}</span>{question.note && <p>{question.note}</p>}</div>}
                </fieldset>
              })}
            </div>)}
          </section>
        </div>
      </>}
      {storageError && <p className="exam-storage-error" role="alert">{text.storageError}</p>}
      <footer className="exam-footer"><span>{text.source}: {examSource.filename}</span><span>{attempt ? text.limitations : text.keyLabel}</span></footer>
    </section>
  </main>
}
