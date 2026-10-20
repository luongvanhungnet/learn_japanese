import type { StudyValues, User } from '../shared/contracts.ts'

export type StorageFailure = { ok: false; error: 'DATABASE_UNAVAILABLE' | 'EMAIL_TAKEN' | 'DATA_TOO_LARGE' }
export type StorageResult<T> = { ok: true; value: T } | StorageFailure
export type AccountInput = { name: string; email: string; passwordHash: string }
export type AccountRecord = User & { passwordHash: string }
export type SessionInput = { tokenHash: string; expiresAt: Date }
export type SessionRecord = { user: User; expiresAt: Date }

// Every adapter catches internal failures and returns a typed result. Controllers
// can map these errors without revealing driver messages or credentials.
export interface AuthStorage {
  createAccount(input: AccountInput, session: SessionInput): Promise<StorageResult<User>>
  findAccount(email: string): Promise<StorageResult<AccountRecord | null>>
  createSession(userId: string, session: SessionInput): Promise<StorageResult<null>>
  findSession(tokenHash: string): Promise<StorageResult<SessionRecord | null>>
  deleteSession(tokenHash: string): Promise<StorageResult<null>>
  loadValues(userId: string): Promise<StorageResult<StudyValues>>
  mergeValues(userId: string, values: StudyValues): Promise<StorageResult<StudyValues>>
  health(): Promise<StorageResult<null>>
}

export const success = <T>(value: T): StorageResult<T> => ({ ok: true, value })
export const unavailable = (): StorageFailure => ({ ok: false, error: 'DATABASE_UNAVAILABLE' })
