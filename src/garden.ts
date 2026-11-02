import type { GameProgress } from './game'
export const crops = [
  { id: 'strawberry', icon: '🍓', ja: 'いちご', vi: 'Dâu tây', en: 'Strawberry', cost: 3, sale: 8, seconds: 60, level: 1 },
  { id: 'orange', icon: '🍊', ja: 'みかん', vi: 'Quýt', en: 'Mandarin', cost: 8, sale: 20, seconds: 180, level: 2 },
  { id: 'peach', icon: '🍑', ja: 'もも', vi: 'Đào', en: 'Peach', cost: 15, sale: 36, seconds: 300, level: 3 },
] as const
export type CropId = typeof crops[number]['id']
export type Plot = { crop: CropId; readyAt: number } | null
export type Garden = { baseLevel: number; plots: Plot[] }
export const maxBaseLevel = 4
export const upgradeCost = (level: number) => [0, 40, 100, 220][level] ?? null
export const plotCount = (level: number) => level + 1
export function parseGarden(raw: unknown): Garden {
  const value = raw && typeof raw === 'object' ? raw as Partial<Garden> : {}
  const baseLevel = Number.isInteger(value.baseLevel) && Number(value.baseLevel) >= 1 && Number(value.baseLevel) <= maxBaseLevel ? Number(value.baseLevel) : 1
  const plots: Plot[] = Array.from({ length: 5 }, (_, i) => {
    const plot = Array.isArray(value.plots) ? value.plots[i] : null
    return i < plotCount(baseLevel) && plot && crops.some(c => c.id === plot.crop) && Number.isSafeInteger(plot.readyAt) && plot.readyAt >= 0 ? { crop: plot.crop, readyAt: plot.readyAt } : null
  })
  return { baseLevel, plots }
}
export function plantCrop(progress: GameProgress, slot: number, id: CropId, now: number): GameProgress {
  const crop = crops.find(c => c.id === id)
  const { garden } = progress
  if (!crop || !Number.isInteger(slot) || slot < 0 || slot >= plotCount(garden.baseLevel) || garden.plots[slot] || crop.level > garden.baseLevel || progress.coins < crop.cost || !Number.isSafeInteger(now) || now < 0) return progress
  return { ...progress, coins: progress.coins - crop.cost, garden: { ...garden, plots: garden.plots.map((plot, i) => i === slot ? { crop: id, readyAt: now + crop.seconds * 1000 } : plot) } }
}
export function harvestCrop(progress: GameProgress, slot: number, now: number): GameProgress {
  const plot = progress.garden.plots[slot]
  if (!Number.isInteger(slot) || slot < 0 || slot >= plotCount(progress.garden.baseLevel) || !plot || now < plot.readyAt || !Number.isSafeInteger(now)) return progress
  const crop = crops.find(c => c.id === plot.crop)!
  return { ...progress, coins: progress.coins + crop.sale + (progress.garden.baseLevel - 1) * 2, garden: { ...progress.garden, plots: progress.garden.plots.map((p, i) => i === slot ? null : p) } }
}
export function upgradeBase(progress: GameProgress): GameProgress {
  const cost = upgradeCost(progress.garden.baseLevel)
  if (cost === null || progress.coins < cost) return progress
  return { ...progress, coins: progress.coins - cost, garden: { ...progress.garden, baseLevel: progress.garden.baseLevel + 1 } }
}
