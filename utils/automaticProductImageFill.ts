export const planAutomaticProductImageFill = (width: number, height: number, imageWidth: number, imageHeight: number, requestedCount?: number, direction: 'auto' | 'horizontal' | 'vertical' = 'auto') => {
  const iw = Math.max(1, imageWidth), ih = Math.max(1, imageHeight)
  const aw = Math.max(1, width), ah = Math.max(1, height)
  const single = Math.min(aw / iw, ah / ih)
  if (requestedCount === 2) {
    // Duas cópias preservam o contain individual sempre que já houver espaço
    // livre em um eixo. Esse espaço vira deslocamento entre centros, expondo
    // a segunda imagem sem diminuir a primeira. Em áreas sem sobra, exigimos
    // 18% do tamanho renderizado como deslocamento mínimo: essa faixa visível
    // torna as cópias distinguíveis e define a menor redução necessária.
    const minimumVisibleOffsetRatio = 0.18
    const orientations = direction === 'auto'
      ? [false, true]
      : [direction === 'vertical']
    const candidates = orientations.map(vertical => {
      const imageLength = vertical ? ih : iw
      const availableLength = vertical ? ah : aw
      const singleLength = imageLength * single
      const freeLength = Math.max(0, availableLength - singleLength)
      const minimumOffset = singleLength * minimumVisibleOffsetRatio
      const scale = freeLength >= minimumOffset
        ? single
        : Math.min(single, availableLength / (imageLength * (1 + minimumVisibleOffsetRatio)))
      const offset = freeLength >= minimumOffset
        ? freeLength
        : imageLength * scale * minimumVisibleOffsetRatio
      return { vertical, scale, offset }
    })
    // maximize the image first; on a tie, use the axis that exposes more of
    // the second copy. The candidate order keeps horizontal as stable tie-break.
    const best = candidates.reduce((current, candidate) =>
      candidate.scale > current.scale + 1e-9 ||
      (Math.abs(candidate.scale - current.scale) <= 1e-9 && candidate.offset > current.offset)
        ? candidate
        : current
    )
    const dx = best.vertical ? 0 : best.offset
    const dy = best.vertical ? best.offset : 0
    return [-1, 1].map(side => ({
      left: side * dx / 2,
      top: side * dy / 2,
      scale: best.scale
    }))
  }
  const steps = (count: number, vertical: boolean) => {
    const crossScale = vertical ? aw / iw : ah / ih
    const length = vertical ? ih : iw
    const available = vertical ? ah : aw
    // A pilha de duas imagens pode se sobrepor mais: assim produtos quase
    // quadrados usam a largura grande configurada em Cards sem sair da área.
    const minimumStep = vertical && requestedCount === 2 ? 0.4 : vertical ? 0.58 : 0.66
    const step = count > 1 ? Math.min(length, Math.max(length * minimumStep, (available / crossScale - length) / (count - 1))) : 0
    return { dx: vertical ? 0 : step, dy: vertical ? step : 0 }
  }
  let best = { count: 1, vertical: false, scale: single, score: 0 }
  for (let count = 1; count <= 4; count++) {
    if (requestedCount != null && count !== Math.max(1, Math.min(4, Math.round(requestedCount)))) continue
    for (const vertical of [false, true]) {
      if (direction !== 'auto' && vertical !== (direction === 'vertical')) continue
      const { dx, dy } = steps(count, vertical)
      const bw = iw + dx * (count - 1), bh = ih + dy * (count - 1)
      const scale = Math.min(aw / bw, ah / bh)
      if (requestedCount == null && count > 1 && (scale < single * 0.72 || Math.min(iw, ih) * scale < 30)) continue
      const coverage = bw * bh * scale * scale / (aw * ah)
      const score = coverage - (count - 1) * 0.035
      if (score > best.score) best = { count, vertical, scale, score }
    }
  }
  const step = steps(best.count, best.vertical)
  const dx = step.dx * best.scale
  const dy = step.dy * best.scale
  return Array.from({ length: best.count }, (_, index) => ({
    left: (index - (best.count - 1) / 2) * dx,
    // As cópias posteriores ficam à frente no Fabric: desenhar de cima para baixo.
    top: (index - (best.count - 1) / 2) * dy,
    scale: best.scale
  }))
}
