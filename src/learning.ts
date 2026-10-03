export type Field = 'reading' | 'hanViet' | 'meaning' | 'formation'
export type Mode = 'study' | 'review'
export type CellProgress = { solved: boolean; unresolved: boolean; revealed: boolean; hints: number; assisted?: boolean; answer?: string }
export type Progress = Record<string, CellProgress>

export const emptyCell = (): CellProgress => ({ solved: false, unresolved: false, revealed: false, hints: 0 })

export function submitAnswer(progress: Progress, key: string, correct: boolean, mode: Mode, answer?: string): Progress {
  const cell = progress[key] ?? emptyCell()
  return {
    ...progress,
    [key]: {
      ...cell,
      solved: correct,
      unresolved: correct && mode === 'review' ? Boolean(cell.assisted) : cell.unresolved || !correct,
      revealed: false,
      hints: 0,
      assisted: false,
      answer: correct ? answer ?? cell.answer : cell.answer,
    },
  }
}

export function revealAnswer(progress: Progress, key: string): Progress {
  return { ...progress, [key]: { ...(progress[key] ?? emptyCell()), revealed: true, unresolved: true, assisted: true } }
}

const graphemes = (value: string) => Array.from(
  new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(value.normalize('NFC')),
  (segment) => segment.segment,
)

export function hintPrefix(answer: string, count: number): string {
  if (count <= 0) return ''
  let shown = 0
  let prefix = ''
  for (const part of graphemes(answer)) {
    if (/[\p{L}\p{N}]/u.test(part)) {
      if (shown >= count) break
      shown += 1
    }
    prefix += part
  }
  return prefix
}

export function nextHint(progress: Progress, key: string, answer: string): Progress {
  const cell = progress[key] ?? emptyCell()
  const limit = graphemes(answer).filter((part) => /[\p{L}\p{N}]/u.test(part)).length
  return { ...progress, [key]: { ...cell, hints: Math.min(cell.hints + 1, limit), unresolved: true, assisted: true } }
}

export function clearReveal(progress: Progress, key: string): Progress {
  const cell = progress[key] ?? emptyCell()
  return { ...progress, [key]: { ...cell, revealed: false } }
}

export function parseProgress(raw: string | null): Progress {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: Progress = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (!/^(?:(?:n[23]|radicals):\d+:(?:reading|hanViet|meaning(?::vi)?)|n3-grammar:\d+:(?:formation|meaning(?::vi)?))$/.test(key) || !value || typeof value !== 'object') continue
      const cell = value as Record<string, unknown>
      if (typeof cell.solved !== 'boolean' || typeof cell.unresolved !== 'boolean' || typeof cell.revealed !== 'boolean' || typeof cell.hints !== 'number') continue
      result[key] = { solved: cell.solved, unresolved: cell.unresolved, revealed: cell.revealed, hints: Math.max(0, Math.floor(cell.hints)), assisted: cell.assisted === true, answer: typeof cell.answer === 'string' ? cell.answer : undefined }
    }
    return result
  } catch {
    return {}
  }
}

const kanaFold = (value: string) => Array.from(value, (char) => {
  const code = char.codePointAt(0) ?? 0
  return code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : char
}).join('')

export function normalizeAnswer(value: string, field: string): string {
  const base = value.normalize('NFKC').normalize('NFC').toLocaleLowerCase('vi')
  const folded = field === 'reading' || field === 'formation'
    ? kanaFold(base)
    : base.normalize('NFD').replace(/đ/g, 'd').replace(/\p{M}/gu, '')
  const compact = folded.replace(/[^\p{L}\p{N}ー]/gu, '')
  if (field === 'formation') {
    const notation: Record<string, string> = { vru: 'vる', vte: 'vて', vta: 'vた', vnai: 'vない', nno: 'nの' }
    return compact.replace(/vru|vte|vta|vnai|nno/g, (token) => notation[token])
  }
  return compact
}

export function isCorrect(field: string, attempt: string, accepted: string[]): boolean {
  const normalized = normalizeAnswer(attempt, field)
  return normalized.length > 0 && accepted.some((answer) => normalizeAnswer(answer, field) === normalized)
}
