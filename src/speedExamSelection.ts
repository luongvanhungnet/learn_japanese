import { speedQuestions } from './speedExamData'
import type { SpeedQuestion } from './speedExamData'

export const speedSections = { vocabulary: 'Từ vựng', grammar: 'Ngữ pháp', reading: 'Đọc hiểu', listening: 'Nghe hiểu' }
export const questionType = (question: SpeedQuestion) => `${question.section}:${question.kind.split(' · ')[0]}`
export const speedGroups = Object.entries(speedSections).map(([section, label]) => ({
  section, label,
  types: [...new Set(speedQuestions.filter(q => q.section === section).map(questionType))].map(id => ({
    id, label: id.slice(id.indexOf(':') + 1), count: speedQuestions.filter(q => questionType(q) === id).length,
  })),
}))
export const allSpeedTypes = speedGroups.flatMap(group => group.types.map(type => type.id))
export type SpeedSort = 'original' | 'reverse' | 'type' | 'random'

export function selectSpeedQuestions(types: string[], sort: SpeedSort, seed: number): SpeedQuestion[] {
  const questions = speedQuestions.filter(question => types.includes(questionType(question)))
  if (sort === 'reverse') questions.reverse()
  if (sort === 'type') questions.sort((a, b) => allSpeedTypes.indexOf(questionType(a)) - allSpeedTypes.indexOf(questionType(b)))
  if (sort === 'random') {
    // A seeded Fisher–Yates shuffle stays stable while answering questions.
    let state = seed >>> 0
    for (let i = questions.length - 1; i > 0; i--) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      const j = Math.floor(state / 4294967296 * (i + 1))
      ;[questions[i], questions[j]] = [questions[j], questions[i]]
    }
  }
  return questions
}
