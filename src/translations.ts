import { createContext, useContext } from 'react'

export type Language = 'en' | 'vi'
const english = {
  reading: 'Reading', meaning: 'Meaning', hanViet: 'Hán Việt',
  wordNumber: 'word {order}', enterLabel: 'Enter {field} for {target}', inputLabel: '{field} for {target}',
  noReading: 'No Sino-Vietnamese reading', noReview: 'No mistakes to review', clickAnswer: 'Click to answer',
  kanaPlaceholder: 'Enter kana…', hanVietPlaceholder: 'Enter Sino-Vietnamese reading…', meaningPlaceholder: 'Enter an English meaning…',
  checkAnswer: 'Check answer', answer: 'Answer', close: 'Close', hint: 'Hint:',
  incorrect: 'Incorrect. Try again; this cell has been added to your review list.',
  overviewLabel: '{level} overview', vocabularyMap: 'VOCABULARY MAP', words: 'words',
  selectWord: 'Select a word to return to the list', closeOverview: 'Close overview', goToWord: 'Go to word {order}: {word}',
  notStudied: 'Not studied', correct: 'Correct', needsReview: 'Needs review', focusMode: 'Focus mode',
  fullList: 'Full list', selectSet: 'Select vocabulary set', selectColumn: 'Select focus column', wordLabel: 'Word {word}',
  headerNote: 'Japanese vocabulary · learn at your own pace', savedDevice: 'Saved on this device',
  dailyPractice: 'DAILY VOCABULARY PRACTICE', headline: 'See the word. Recall the meaning.', headlineAccent: 'Progress with every answer.',
  instructions: 'Select an empty cell, type your answer, and press Enter. Review the words you miss.',
  practiceTable: 'Vocabulary practice table', selectLevel: 'Select level', cellsCorrect: 'cells correct', studyMode: 'Study mode',
  wordList: 'Word list', reviewMistakes: 'Review mistakes', focus: 'Focus', zoom: 'Zoom', zoomOut: 'Zoom out', zoomIn: 'Zoom in',
  listZoom: 'List zoom level', overview: 'Overview', showingAll: 'Showing all {count} {level} words', showingReview: '{count} words with mistakes to review',
  hintExplanation: 'Hint+ reveals one letter at a time · Answer shows a preview',
  noMistakes: 'No mistakes left to review', reviewExplanation: 'Cells you answer incorrectly will appear here until you answer them correctly in review mode.',
  backToList: 'Back to word list', number: 'No.', vocabulary: 'Vocabulary', englishMeanings: 'English meanings:',
  savedProgress: 'Your progress is saved automatically in this browser.', language: 'Language',
  title: 'Mimikara Study · N3 & N2 Vocabulary Practice',
  description: 'Practice 880 Mimikara N3 and 1,160 Mimikara N2 words with English meanings, review mistakes, and save progress on your device.',
}
type Message = keyof typeof english
const vietnamese: Record<Message, string> = {
  reading: 'Cách đọc', meaning: 'Ngữ nghĩa', hanViet: 'Hán Việt',
  wordNumber: 'từ số {order}', enterLabel: 'Nhập {field} cho {target}', inputLabel: '{field} cho {target}',
  noReading: 'Không có âm Hán Việt', noReview: 'Không có lỗi cần ôn', clickAnswer: 'Nhấn để điền',
  kanaPlaceholder: 'Nhập kana…', hanVietPlaceholder: 'Nhập âm Hán Việt…', meaningPlaceholder: 'Nhập một nghĩa…',
  checkAnswer: 'Kiểm tra đáp án', answer: 'Đáp án', close: 'Đóng', hint: 'Gợi ý:',
  incorrect: 'Chưa đúng. Hãy thử lại; ô này đã vào danh sách cần ôn.',
  overviewLabel: 'Tổng quan {level}', vocabularyMap: 'BẢN ĐỒ TỪ VỰNG', words: 'từ',
  selectWord: 'Chọn một từ để quay lại danh sách', closeOverview: 'Đóng tổng quan', goToWord: 'Đến từ số {order}: {word}',
  notStudied: 'Chưa học', correct: 'Đã đúng', needsReview: 'Cần ôn', focusMode: 'Chế độ tập trung',
  fullList: 'Danh sách đầy đủ', selectSet: 'Chọn bộ từ', selectColumn: 'Chọn cột tập trung', wordLabel: 'Từ {word}',
  headerNote: 'Từ vựng tiếng Nhật · học theo nhịp của bạn', savedDevice: 'Lưu trên máy này',
  dailyPractice: 'LUYỆN TỪ VỰNG MỖI NGÀY', headline: 'Nhìn từ. Nhớ nghĩa.', headlineAccent: 'Tiến bộ từng ô.',
  instructions: 'Chọn một ô trống, nhập đáp án rồi nhấn Enter. Sai ở đâu, ôn lại đúng chỗ đó.',
  practiceTable: 'Bảng học từ vựng', selectLevel: 'Chọn cấp độ', cellsCorrect: 'ô đã đúng', studyMode: 'Chế độ học',
  wordList: 'Danh sách từ', reviewMistakes: 'Khắc phục lỗi', focus: 'Tập trung', zoom: 'Thu phóng', zoomOut: 'Thu nhỏ', zoomIn: 'Phóng to',
  listZoom: 'Mức phóng to danh sách', overview: 'Tổng quan', showingAll: 'Đang xem toàn bộ {count} từ {level}', showingReview: '{count} từ có lỗi cần khắc phục',
  hintExplanation: 'Hint+ gợi ý từng chữ · Đáp án chỉ để xem',
  noMistakes: 'Không còn lỗi cần ôn', reviewExplanation: 'Những ô bạn nhập sai sẽ xuất hiện ở đây cho đến khi làm đúng lại.',
  backToList: 'Quay lại danh sách', number: 'STT', vocabulary: 'Từ vựng', englishMeanings: 'Nghĩa tiếng Anh:',
  savedProgress: 'Tiến độ được lưu tự động trong trình duyệt này.', language: 'Ngôn ngữ',
  title: 'Mimikara Study · Học từ vựng N3 & N2',
  description: 'Luyện 880 từ Mimikara N3 và 1.160 từ Mimikara N2, ôn lỗi sai và lưu tiến độ ngay trên máy.',
}

export const messagesByLanguage = { en: english, vi: vietnamese }

export const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void } | null>(null)

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('LanguageProvider is required')
  const messages = context.language === 'vi' ? vietnamese : english
  const t = (key: Message, values: Record<string, string | number> = {}) =>
    messages[key].replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match))
  return {
    ...context, t, locale: context.language === 'vi' ? 'vi-VN' : 'en-US',
    labels: { reading: messages.reading, hanViet: messages.hanViet, meaning: messages.meaning },
  }
}

