import { parseGarden } from './garden'
import type { Garden } from './garden'
export type Scene = 'ramen' | 'directions' | 'interview'
export type Skill = 'meaning' | 'listening' | 'kana' | 'context'
export type GameCard = { id: string; scene: Scene; word: string; kana: string; vi: string; en: string; context: string; response: string; explanation: string }
export const gameCards: GameCard[] = [
  { id: 'water', scene: 'ramen', word: '水', kana: 'みず', vi: 'nước', en: 'water', context: 'Bạn muốn xin nước ở quán ăn. Chọn cách nói lịch sự.', response: 'お水をください。', explanation: 'お水をください = Cho tôi xin nước. お làm lời nói lịch sự hơn.' },
  { id: 'order', scene: 'ramen', word: '注文', kana: 'ちゅうもん', vi: 'gọi món', en: 'order', context: 'Nhân viên hỏi bạn đã sẵn sàng gọi món chưa.', response: '注文をお願いします。', explanation: '注文をお願いします = Tôi muốn gọi món.' },
  { id: 'noodles', scene: 'ramen', word: '麺', kana: 'めん', vi: 'mì', en: 'noodles', context: 'Bạn muốn gọi một phần mì ramen.', response: 'ラーメンを一つください。', explanation: '一つ là cách đếm một phần; ください dùng khi yêu cầu.' },
  { id: 'bill', scene: 'ramen', word: '会計', kana: 'かいけい', vi: 'thanh toán', en: 'bill', context: 'Ăn xong, bạn muốn thanh toán.', response: 'お会計をお願いします。', explanation: 'お会計をお願いします = Cho tôi thanh toán.' },
  { id: 'delicious', scene: 'ramen', word: '美味しい', kana: 'おいしい', vi: 'ngon', en: 'delicious', context: 'Bạn khen món ăn với nhân viên một cách lịch sự.', response: 'とても美味しいです。', explanation: 'です biến lời nhận xét thành cách nói lịch sự.' },
  { id: 'recommend', scene: 'ramen', word: 'おすすめ', kana: 'おすすめ', vi: 'gợi ý', en: 'recommendation', context: 'Lần đầu đến quán, bạn muốn hỏi món được gợi ý.', response: 'おすすめは何ですか。', explanation: 'おすすめは何ですか = Quán có món gì nên thử?' },
  { id: 'station', scene: 'directions', word: '駅', kana: 'えき', vi: 'nhà ga', en: 'station', context: 'Bạn hỏi người lạ đường đến ga.', response: 'すみません、駅はどこですか。', explanation: 'すみません mở đầu lịch sự khi hỏi người lạ.' },
  { id: 'right', scene: 'directions', word: '右', kana: 'みぎ', vi: 'bên phải', en: 'right', context: 'Người chỉ đường nói: 右に曲がってください。', response: '右に曲がります。', explanation: '右に曲がる = Rẽ phải.' },
  { id: 'left', scene: 'directions', word: '左', kana: 'ひだり', vi: 'bên trái', en: 'left', context: 'Người chỉ đường nói: 左に曲がってください。', response: '左に曲がります。', explanation: '左に曲がる = Rẽ trái.' },
  { id: 'straight', scene: 'directions', word: '真っ直ぐ', kana: 'まっすぐ', vi: 'thẳng', en: 'straight', context: 'Bạn được hướng dẫn đi thẳng.', response: '真っ直ぐ行きます。', explanation: '真っ直ぐ行く = Đi thẳng.' },
  { id: 'near', scene: 'directions', word: '近い', kana: 'ちかい', vi: 'gần', en: 'near', context: 'Bạn muốn hỏi ga có gần đây không.', response: '駅は近いですか。', explanation: '近いですか = Có gần không?' },
  { id: 'exit', scene: 'directions', word: '出口', kana: 'でぐち', vi: 'lối ra', en: 'exit', context: 'Bạn tìm lối ra khỏi nhà ga.', response: '出口はどちらですか。', explanation: 'どちら lịch sự hơn どこ khi hỏi phương hướng.' },
  { id: 'company', scene: 'interview', word: '御社', kana: 'おんしゃ', vi: 'quý công ty (khi nói)', en: 'your company (spoken)', context: 'Trong buổi phỏng vấn, bạn nói về công ty của người nghe.', response: '御社で働きたいです。', explanation: '御社 dùng khi nói; 貴社 thường dùng trong văn viết.' },
  { id: 'self', scene: 'interview', word: '申す', kana: 'もうす', vi: 'nói / tên là (khiêm nhường)', en: 'say / be called (humble)', context: 'Bạn giới thiệu tên Tanaka với người phỏng vấn.', response: '田中と申します。', explanation: '申します là khiêm nhường ngữ của 言います.' },
  { id: 'see', scene: 'interview', word: '拝見', kana: 'はいけん', vi: 'xem (khiêm nhường)', en: 'look (humble)', context: 'Bạn nói mình đã xem trang web của công ty.', response: 'ホームページを拝見しました。', explanation: '拝見する dùng khi nói khiêm nhường về hành động xem của mình.' },
  { id: 'visit', scene: 'interview', word: '伺う', kana: 'うかがう', vi: 'đến / hỏi (khiêm nhường)', en: 'visit / ask (humble)', context: 'Bạn nói sẽ đến vào 10 giờ với nhà tuyển dụng.', response: '十時に伺います。', explanation: '伺います là cách khiêm nhường khi nói về việc mình đến.' },
  { id: 'experience', scene: 'interview', word: '経験', kana: 'けいけん', vi: 'kinh nghiệm', en: 'experience', context: 'Bạn trình bày kinh nghiệm làm việc.', response: '三年の経験があります。', explanation: '三年の経験があります = Tôi có ba năm kinh nghiệm.' },
  { id: 'regards', scene: 'interview', word: '宜しく', kana: 'よろしく', vi: 'mong được giúp đỡ', en: 'kind regards', context: 'Bạn kết thúc phần giới thiệu trong buổi phỏng vấn.', response: 'どうぞよろしくお願いいたします。', explanation: 'お願いいたします trang trọng hơn お願いします.' },
]
export const englishContexts: Record<string, [string, string]> = {
  water: ['Ask for water politely at a restaurant.', 'お水をください means “Water, please.” お adds politeness.'],
  order: ['The waiter asks whether you are ready to order.', '注文をお願いします means “I would like to order.”'],
  noodles: ['Order one serving of ramen.', '一つ counts one serving; ください makes a request.'],
  bill: ['You have finished your meal. Ask for the bill.', 'お会計をお願いします means “The bill, please.”'],
  delicious: ['Compliment the food politely to the waiter.', 'です makes this comment polite.'],
  recommend: ['It is your first visit. Ask what the restaurant recommends.', 'おすすめは何ですか means “What do you recommend?”'],
  station: ['Ask a stranger where the station is.', 'すみません is a polite way to get a stranger’s attention.'],
  right: ['You hear: 右に曲がってください。 What will you do?', '右に曲がる means “turn right.”'],
  left: ['You hear: 左に曲がってください。 What will you do?', '左に曲がる means “turn left.”'],
  straight: ['You are told to go straight ahead.', '真っ直ぐ行く means “go straight.”'],
  near: ['Ask whether the station is nearby.', '近いですか means “Is it near?”'],
  exit: ['Ask politely where the station exit is.', 'どちら is more polite than どこ for asking directions.'],
  company: ['Refer to the interviewer’s company during a spoken interview.', '御社 is used in speech; 貴社 is generally used in writing.'],
  self: ['Introduce yourself as Tanaka to an interviewer.', '申します is the humble form of 言います.'],
  see: ['Tell the interviewer you have looked at the company website.', '拝見する is the humble form for your own act of looking.'],
  visit: ['Tell a recruiter politely that you will visit at ten.', '伺います is a humble way to describe your own visit.'],
  experience: ['Describe your work experience to the interviewer.', '三年の経験があります means “I have three years of experience.”'],
  regards: ['Finish your self-introduction in a formal interview.', 'お願いいたします is more formal than お願いします.'],
}
export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]] }
  return result
}
export type Question = { card: GameCard; skill: Skill; answer: string; options: string[] }
export function makeQuestion(deck: GameCard[], index: number, advanced: boolean, language: 'vi' | 'en', audio: boolean, previous?: string): Question {
  const candidates = deck.filter(c => c.id !== previous)
  const card = shuffle(candidates.length ? candidates : deck)[0]
  const skills: Skill[] = advanced ? ['meaning', ...(audio ? ['listening' as const] : []), 'kana', 'context'] : ['meaning', ...(audio ? ['listening' as const] : [])]
  const skill = skills[index % skills.length]
  const answerOf = (c: GameCard) => skill === 'kana' ? c.kana : skill === 'context' ? c.response : c[language]
  const answer = answerOf(card)
  const distractors = shuffle([...new Set(gameCards.filter(c => c.scene === card.scene).map(answerOf))].filter(a => a !== answer)).slice(0, 3)
  return { card, skill, answer, options: shuffle([answer, ...distractors]) }
}
export function questionSeconds(difficulty: 'gentle' | 'challenge', combo: number): number {
  return difficulty === 'gentle' ? 10 : Math.max(2, 10 - Math.floor(combo / 2))
}
export const normalizeKana = (value: string) => value.normalize('NFKC').trim().replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
export type GameProgress = { xp: number; coins: number; unlocked: string[]; records: Record<string, number>; garden: Garden }
export function parseGameProgress(raw: string | null): GameProgress {
  const empty: GameProgress = { xp: 0, coins: 0, unlocked: [], records: {}, garden: parseGarden(null) }
  try {
    const value = JSON.parse(raw ?? 'null')
    if (!value || !Number.isSafeInteger(value.xp) || value.xp < 0 || !Number.isSafeInteger(value.coins) || value.coins < 0) return empty
    return { xp: value.xp, coins: value.coins, garden: parseGarden(value.garden), unlocked: Array.isArray(value.unlocked) ? value.unlocked.filter((id: unknown) => typeof id === 'string' && gameCards.some(c => c.id === id)) : [], records: Object.fromEntries(Object.entries(value.records ?? {}).filter(([, v]) => Number.isSafeInteger(v) && Number(v) >= 0)) as Record<string, number> }
  } catch { return empty }
}
export function availableCards(scene: Scene, progress: GameProgress) { return gameCards.filter(c => c.scene === scene).filter((c, i) => i < 4 || progress.unlocked.includes(c.id)) }
export function earnRewards(progress: GameProgress, scene: Scene, correct: number, score: number, recordKey: string) {
  const unlocked = correct > 0 ? gameCards.filter(c => c.scene === scene && !availableCards(scene, progress).some(a => a.id === c.id)).slice(0, 2) : []
  const xp = correct * 12, coins = correct * (3 + progress.garden.baseLevel - 1)
  return { xp, coins, unlocked, progress: { ...progress, xp: progress.xp + xp, coins: progress.coins + coins, unlocked: [...new Set([...progress.unlocked, ...unlocked.map(c => c.id)])], records: { ...progress.records, [recordKey]: Math.max(progress.records[recordKey] ?? 0, score) } } }
}
