type Anchor = { left: number; right: number; top: number; bottom: number }
type Size = { width: number; height: number }

export function lookupPosition(anchor: Anchor, card: Size, viewport: Size & { top: number }) {
  const margin = 12, gap = 10
  const width = Math.min(card.width, viewport.width - margin * 2)
  const ceiling = Math.min(viewport.height - margin, Math.max(margin, viewport.top + margin))
  const below = Math.min(viewport.height - margin, Math.max(ceiling, anchor.bottom + gap))
  const belowSpace = Math.max(0, viewport.height - margin - below)
  const aboveSpace = Math.max(0, Math.min(viewport.height - margin, anchor.top - gap) - ceiling)
  // Prefer flipping above when the full card cannot fit below. If even a short
  // card cannot fit above the sticky controls, use the larger space and scroll.
  const side = card.height <= belowSpace || (aboveSpace < Math.min(card.height, 120) && belowSpace >= aboveSpace) ? 'below' : 'above'
  const maxHeight = side === 'below' ? belowSpace : aboveSpace
  return {
    side,
    left: Math.max(margin, Math.min(viewport.width - width - margin, (anchor.left + anchor.right - width) / 2)),
    top: side === 'below' ? below : Math.max(ceiling, anchor.top - gap - Math.min(card.height, maxHeight)),
    maxHeight,
  }
}
