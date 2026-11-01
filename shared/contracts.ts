import { z } from 'zod'

export const STUDY_KEYS = [
  'mimikara-progress-v1',
  'mimikara-last-practice-v1',
  'mimikara-display-modes-v1',
  'mimikara-flashcards-v1',
  'mimikara-word-flashcards-v1',
  'mimikara-word-flashcard-deck-v1',
  'mimikara-flashcard-deck-v1',
  'mimikara-language',
  'mimikara-novel-chapter-v1',
  'mimikara-exams-v1',
  'mimikara-game-v1',
] as const

export type StudyKey = typeof STUDY_KEYS[number]
export type StudyValues = Partial<Record<StudyKey, string | null>>

const EmailSchema = z.string().trim().toLowerCase().email().max(254)
const PasswordSchema = z.string().min(8).max(128)
const isDatabaseText = (value: string) => !value.includes('\u0000')
  && new TextDecoder().decode(new TextEncoder().encode(value)) === value
export const SignupInputSchema = z.object({
  name: z.string().trim().min(2).max(80).refine(isDatabaseText, 'Name contains invalid text'),
  email: EmailSchema,
  password: PasswordSchema,
}).strict()
export const LoginInputSchema = z.object({ email: EmailSchema, password: PasswordSchema }).strict()
export const UserSchema = z.object({ id: z.string().uuid(), email: EmailSchema, name: z.string() }).strict()
export type User = z.infer<typeof UserSchema>
export type SignupInput = z.infer<typeof SignupInputSchema>
export type LoginInput = z.infer<typeof LoginInputSchema>
export const MAX_STUDY_VALUE_BYTES = 4 * 1024 * 1024
export const MAX_USER_DATA_BYTES = 8 * 1024 * 1024
const utf8Bytes = (value: string) => new TextEncoder().encode(value).byteLength
const StoredValueSchema = z.string().max(MAX_STUDY_VALUE_BYTES)
  .refine(value => utf8Bytes(value) <= MAX_STUDY_VALUE_BYTES, 'Study value is too large')
  .refine(isDatabaseText, 'Study value contains invalid text').nullable().optional()
const PlainObjectSchema = z.custom<Record<string, unknown>>(value =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null),
  'Expected a plain object',
)
export const StudyValuesSchema = PlainObjectSchema.pipe(z.object({
  'mimikara-progress-v1': StoredValueSchema,
  'mimikara-last-practice-v1': StoredValueSchema,
  'mimikara-display-modes-v1': StoredValueSchema,
  'mimikara-flashcards-v1': StoredValueSchema,
  'mimikara-word-flashcards-v1': StoredValueSchema,
  'mimikara-word-flashcard-deck-v1': StoredValueSchema,
  'mimikara-flashcard-deck-v1': StoredValueSchema,
  'mimikara-language': StoredValueSchema,
  'mimikara-novel-chapter-v1': StoredValueSchema,
  'mimikara-exams-v1': StoredValueSchema,
  'mimikara-game-v1': StoredValueSchema,
}).strict()).refine(values => utf8Bytes(JSON.stringify(values)) <= MAX_USER_DATA_BYTES, 'Study data is too large')
export const UserDataInputSchema = z.object({ values: StudyValuesSchema }).strict()
export const UserDataResponseSchema = UserDataInputSchema
export const SessionResponseSchema = z.object({ user: UserSchema.nullable() }).strict()
export const AuthResponseSchema = z.object({ user: UserSchema }).strict()
export const ApiErrorCodeSchema = z.enum([
  'INVALID_INPUT', 'INVALID_ORIGIN', 'AUTH_REQUIRED', 'INVALID_CREDENTIALS',
  'EMAIL_TAKEN', 'RATE_LIMITED', 'DATABASE_UNAVAILABLE', 'REQUEST_TOO_LARGE', 'NOT_FOUND', 'INTERNAL_ERROR', 'ACCOUNT_CHANGED',
])
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>
export const ApiErrorResponseSchema = z.object({
  error: z.object({ code: ApiErrorCodeSchema, message: z.string() }).strict(),
}).strict()
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>
