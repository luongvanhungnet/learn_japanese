import { expect, test } from 'vitest'
import { speedQuestions } from './speedExamData'
import { speedGroups, questionType } from './speedExamSelection'

const normalize = (text: string) => text.normalize('NFKC').replace(/\s+/g, '')

test('publishes 600 uniquely identified questions in 12 batches of 50, covering 15 task families', () => {
  expect(speedQuestions).toHaveLength(600)
  expect(new Set(speedQuestions.map(q => q.id)).size).toBe(speedQuestions.length)
  expect(speedGroups.flatMap(group => group.types)).toHaveLength(15)
  for (const type of speedGroups.flatMap(group => group.types)) expect(type.count, type.id).toBe(40)
  for (let batch = 1; batch <= 12; batch++) expect(speedQuestions.filter(q => q.batch === batch)).toHaveLength(50)
})

test('every question has four distinct choices, an indexed key and a Vietnamese explanation', () => {
  const signatures = new Set<string>()
  for (const q of speedQuestions) {
    expect(q.choices, q.id).toHaveLength(4)
    expect(new Set(q.choices.map(normalize)).size, q.id).toBe(4)
    expect(Number.isInteger(q.answer), q.id).toBe(true)
    expect(q.answer, q.id).toBeGreaterThanOrEqual(0)
    expect(q.answer, q.id).toBeLessThan(4)
    expect(q.explanation.length, q.id).toBeGreaterThan(8)
    expect(q.explanation, q.id).toMatch(/[a-zA-ZÀ-ỹ]/)
    expect(q.prompt, q.id).toMatch(/[\u3040-\u30ff\u3400-\u9fff]/)
    const signature = normalize(`${q.passage ?? q.audioText ?? ''}${q.prompt}`)
    expect(signatures.has(signature), `duplicate ${q.id}`).toBe(false)
    signatures.add(signature)
  }
})

test('reading has 60 authored passages with two distinct questions each and listening has 160 scripts', () => {
  const reading = speedQuestions.filter(q => q.section === 'reading')
  const sources = new Set(reading.map(q => q.passage))
  expect(sources.size).toBe(60)
  for (const passage of sources) {
    expect(passage!.length).toBeGreaterThanOrEqual(90)
    expect(reading.filter(q => q.passage === passage)).toHaveLength(2)
  }
  for (const q of reading.filter(q => questionType(q) === 'reading:Đoạn vừa')) {
    expect(q.passage!.length, q.id).toBeGreaterThanOrEqual(230)
  }
  for (const q of speedQuestions.filter(q => q.kind === 'Ngữ pháp trong đoạn văn')) expect(q.passage, q.id).toContain('（　）')
  const listening = speedQuestions.filter(q => q.section === 'listening')
  expect(new Set(listening.map(q => q.audioText)).size).toBe(160)
  for (const q of listening) {
    expect(q.audioText!.length, q.id).toBeGreaterThan(10)
    if (q.kind === 'Hiểu nhiệm vụ' || q.kind === 'Hiểu điểm chính') expect(q.audioText, q.id).toContain(q.prompt)
  }
})

test('star-placement answer keys match the authored sentence reconstructions', () => {
  const ordering = speedQuestions.filter(q => q.kind === 'Sắp xếp câu ★')
  expect(ordering).toHaveLength(40)
  for (const q of ordering) {
    expect(q.orderedFragments, q.id).toHaveLength(4)
    expect(q.choices[q.answer], q.id).toBe(q.orderedFragments![q.starIndex!])
    expect([...q.choices].sort(), q.id).toEqual([...q.orderedFragments!].sort())
    expect(q.prompt.split('★')).toHaveLength(3) // one star in the sentence, one in the instruction
  }
})
