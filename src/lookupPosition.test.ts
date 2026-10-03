import { expect, it } from 'vitest'
import { lookupPosition } from './lookupPosition'

it('places the lookup below its word, flips above when needed, and stays inside the available viewport', () => {
  const viewport = { width: 1000, height: 800, top: 180 }
  expect(lookupPosition({ left: 400, right: 460, top: 250, bottom: 280 }, { width: 320, height: 300 }, viewport)).toMatchObject({ side: 'below', top: 290, left: 270, maxHeight: 498 })
  expect(lookupPosition({ left: 940, right: 990, top: 700, bottom: 730 }, { width: 320, height: 300 }, viewport)).toMatchObject({ side: 'above', top: 390, left: 668 })
  const small = lookupPosition({ left: 0, right: 30, top: 230, bottom: 260 }, { width: 320, height: 500 }, { width: 390, height: 480, top: 200 })
  expect(small.left).toBe(12)
  expect(small.top).toBe(270)
  expect(small.maxHeight).toBe(198)
  expect(lookupPosition({ left: 400, right: 460, top: 400, bottom: 430 }, { width: 320, height: 550 }, viewport).side).toBe('above')
})
