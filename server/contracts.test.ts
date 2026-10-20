import { describe, expect, it } from 'vitest'
import { MAX_STUDY_VALUE_BYTES, MAX_USER_DATA_BYTES, LoginInputSchema, SignupInputSchema, UserDataInputSchema } from '../shared/contracts.ts'

describe('API contracts', () => {
  it('accepts account-scoped exam attempts and results without opening arbitrary storage keys', () => {
    const input = { values: { 'mimikara-exams-v1': JSON.stringify({ version: 1, attempts: {} }) } }
    expect(UserDataInputSchema.parse(input)).toEqual(input)
    expect(UserDataInputSchema.safeParse({ values: { 'mimikara-exams-secret': 'key' } }).success).toBe(false)
  })
  it('normalizes signup email and trims the display name', () => {
    expect(SignupInputSchema.parse({ name: '  Reader  ', email: '  TEST@Example.com ', password: 'a good password' }))
      .toEqual({ name: 'Reader', email: 'test@example.com', password: 'a good password' })
  })
  it('strictly limits study data to bounded string or null values on known keys', () => {
    const valid = { values: { 'mimikara-language': 'en', 'mimikara-progress-v1': null } }
    expect(UserDataInputSchema.parse(valid)).toEqual(valid)
    for (const input of [
      null, { values: null }, { values: { unexpected: 'secret' } },
      { values: { 'mimikara-language': 123 } },
      { values: { 'mimikara-language': 'x'.repeat(MAX_STUDY_VALUE_BYTES + 1) } },
      JSON.parse('{"values":{"__proto__":"polluted"}}'),
      { values: Object.assign(Object.create({ 'mimikara-language': 'en' }), {}) },
    ]) expect(UserDataInputSchema.safeParse(input).success).toBe(false)
  })
  it('rejects text PostgreSQL JSONB cannot store before invoking the database', () => {
    for (const value of ['bad\u0000value', '\ud800']) {
      expect(UserDataInputSchema.safeParse({ values: { 'mimikara-language': value } }).success).toBe(false)
      expect(SignupInputSchema.safeParse({ name: 'Reader' + value, email: 'reader@example.com', password: 'good password' }).success).toBe(false)
    }
  })
  it('allows substantial real progress while enforcing password, name, email, and overall payload bounds', () => {
    expect(UserDataInputSchema.safeParse({ values: { 'mimikara-progress-v1': 'x'.repeat(512 * 1024) } }).success).toBe(true)
    const valid = { name: 'Reader', email: 'reader@example.com', password: 'good password' }
    for (const input of [
      { ...valid, password: 'x'.repeat(7) }, { ...valid, password: 'x'.repeat(129) },
      { ...valid, name: 'A' }, { ...valid, name: 'x'.repeat(81) },
      { ...valid, email: 'invalid' }, { ...valid, admin: true }, null,
    ]) expect(SignupInputSchema.safeParse(input).success).toBe(false)
    expect(LoginInputSchema.safeParse({ email: valid.email, password: 'x'.repeat(129) }).success).toBe(false)
    expect(UserDataInputSchema.safeParse({ values: {
      'mimikara-progress-v1': 'a'.repeat(MAX_USER_DATA_BYTES / 2),
      'mimikara-flashcards-v1': 'b'.repeat(MAX_USER_DATA_BYTES / 2),
    } }).success).toBe(false)
  })
  it('counts Unicode display-name characters consistently with PostgreSQL constraints', () => {
    const credentials = { email: 'reader@example.com', password: 'good password' }
    expect(SignupInputSchema.safeParse({ ...credentials, name: '😀' }).success).toBe(false)
    expect(SignupInputSchema.safeParse({ ...credentials, name: '😀'.repeat(80) }).success).toBe(true)
    expect(SignupInputSchema.safeParse({ ...credentials, name: '😀'.repeat(81) }).success).toBe(false)
  })
})
