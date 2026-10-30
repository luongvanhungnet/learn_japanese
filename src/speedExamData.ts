import vocabularyReading from './data/speed-exam/vocabulary/reading.json'
import vocabularyWriting from './data/speed-exam/vocabulary/writing.json'
import vocabularyContext from './data/speed-exam/vocabulary/context.json'
import vocabularyParaphrase from './data/speed-exam/vocabulary/paraphrase.json'
import vocabularyUsage from './data/speed-exam/vocabulary/usage.json'
import grammarForm from './data/speed-exam/grammar/form.json'
import grammarOrdering from './data/speed-exam/grammar/ordering.json'
import grammarText from './data/speed-exam/grammar/text.json'
import readingShort from './data/speed-exam/reading/short.json'
import readingMedium from './data/speed-exam/reading/medium.json'
import readingInformation from './data/speed-exam/reading/information.json'
import listeningTask from './data/speed-exam/listening/task.json'
import listeningPoint from './data/speed-exam/listening/point.json'
import listeningExpression from './data/speed-exam/listening/expression.json'
import listeningResponse from './data/speed-exam/listening/response.json'
import type { SpeedQuestion } from './speedExamTypes'

export type { SpeedQuestion } from './speedExamTypes'

// Original Codex-authored N3 practice, edited in 12 batches of 50.
// Files are grouped by task family; data integrity is checked by speedExamData.test.ts.
export const speedQuestions = [
  ...vocabularyReading, ...vocabularyWriting, ...vocabularyContext, ...vocabularyParaphrase, ...vocabularyUsage,
  ...grammarForm, ...grammarOrdering, ...grammarText,
  ...readingShort, ...readingMedium, ...readingInformation,
  ...listeningTask, ...listeningPoint, ...listeningExpression, ...listeningResponse,
] as SpeedQuestion[]
