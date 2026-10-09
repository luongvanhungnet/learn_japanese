export interface JapaneseToken {
  surface_form: string
  reading?: string
  pos: string
  pos_detail_1: string
}
export interface JapaneseTokenizer {
  tokenize(text: string): JapaneseToken[]
}
export function createTokenizer(): Promise<JapaneseTokenizer>
export function romanizeKana(text: string): string
export function romanizeSentence(japanese: string, reading: string, tokenizer: JapaneseTokenizer): string
export function buildFlashcards(): Promise<void>
