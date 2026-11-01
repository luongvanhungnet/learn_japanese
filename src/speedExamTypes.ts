export type SpeedQuestion = {
  id: string
  section: 'vocabulary' | 'grammar' | 'reading' | 'listening'
  kind: string
  prompt: string
  passage?: string
  audioText?: string
  choices: [string, string, string, string]
  answer: number
  explanation: string
  /** Editorial batch of 50 questions, independent of the display sort. */
  batch: number
  /** Authored reconstruction for reviewing star-placement questions. */
  orderedFragments?: [string, string, string, string]
  starIndex?: number
}
