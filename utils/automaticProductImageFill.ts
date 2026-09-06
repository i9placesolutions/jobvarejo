export const planAutomaticProductImageFill = (width: number, height: number, imageWidth: number, imageHeight: number, requestedCount?: number, direction: 'auto' | 'horizontal' | 'vertical' = 'auto') => {
  const iw = Math.max(1, imageWidth), ih = Math.max(1, imageHeight)
  const aw = Math.max(1, width), ah = Math.max(1, height)
  const single = Math.min(aw / iw, ah / ih)
  let best = { count: 1, vertical: false, scale: single, score: 0 }
  for (let count = 1; count <= 4; count++) {
    if (requestedCount != null && count !== Math.max(1, Math.min(4, Math.round(requestedCount)))) continue
    for (const vertical of [false, true]) {
      if (direction !== 'auto' && vertical !== (direction === 'vertical')) continue
      const dx = iw * (vertical ? 0.08 : 0.66), dy = ih * (vertical ? 0.58 : 0)
      const bw = iw + dx * (count - 1), bh = ih + dy * (count - 1)
      const scale = Math.min(aw / bw, ah / bh)
      if (requestedCount == null && count > 1 && (scale < single * 0.72 || Math.min(iw, ih) * scale < 30)) continue
      const coverage = bw * bh * scale * scale / (aw * ah)
      const score = coverage - (count - 1) * 0.035
      if (score > best.score) best = { count, vertical, scale, score }
    }
  }
  const dx = iw * (best.vertical ? 0.08 : 0.66) * best.scale
  const dy = ih * (best.vertical ? 0.58 : 0) * best.scale
  return Array.from({ length: best.count }, (_, index) => ({
    left: (index - (best.count - 1) / 2) * dx,
    top: -(index - (best.count - 1) / 2) * dy,
    scale: best.scale
  }))
}
