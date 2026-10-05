/** Centraliza calendário e validade como um único conjunto, sem quebrar a linha. */
export const layoutInlineFooterValidity = (objects: any[]): boolean => {
  let changed = false
  for (const date of objects.filter(o => o.quickValidityLayout === 'inline-footer' && o.visible !== false && o.getBoundingRect)) {
    const siblings = objects.filter(o => o.parentFrameId === date.parentFrameId)
    const band = siblings.find(o => o.name === 'standard-validity-background')
    if (!band?.getBoundingRect || !date.initDimensions || !date.calcTextWidth) continue
    const icons = siblings.filter(o => /^header-validity-calendar/.test(o.name || '') && o.visible !== false && o.getBoundingRect)
    const tracked = [date, ...icons]
    const state = () => JSON.stringify(tracked.map(o => [o.left, o.top, o.width, o.height, o.fontSize, o.text, o.scaleX, o.scaleY]))
    const before = state(), b = band.getBoundingRect()
    const boxes = icons.map(o => o.getBoundingRect())
    const ix = boxes.length ? Math.min(...boxes.map(o => o.left)) : 0
    const iy = boxes.length ? Math.min(...boxes.map(o => o.top)) : 0
    const iw = boxes.length ? Math.max(...boxes.map(o => o.left + o.width)) - ix : 0
    const ih = boxes.length ? Math.max(...boxes.map(o => o.top + o.height)) - iy : 0
    const gap = icons.length ? 16 * b.width / 1920 : 0
    const available = Math.max(1, b.width - 48 * b.width / 1920 - iw - gap)
    const scale = b.width / 1920
    const availableHeight = Math.max(1, b.height - 12 * scale)
    const fontSize = Number(date.dynamicFieldBaseFontSize || date.fontSize || 26)
    date.set({ text: String(date.text || '').replace(/\s+/g, ' ').trim(), width: 100000, fontSize, scaleX: 1, scaleY: 1, originX: 'left', originY: 'top', textAlign: 'left', styles: {} })
    date.initDimensions()
    const textLines = () => {
      const publicLines = Array.isArray(date.textLines) ? date.textLines : null
      const fabricLines = Array.isArray(date._textLines) ? date._textLines : null
      return publicLines?.length ? publicLines : (fabricLines || publicLines)
    }
    const measurement = (): { width: number; height: number; lineCount: number } => {
      const lineWidth = Number(date.calcTextWidth())
      const firstLineWidth = typeof date.getLineWidth === 'function' ? Number(date.getLineWidth(0)) : 0
      return {
        width: Math.max(Number.isFinite(lineWidth) ? lineWidth : 0, Number.isFinite(firstLineWidth) ? firstLineWidth : 0),
        height: Number(date.height || date.getBoundingRect?.().height || 0),
        lineCount: textLines()?.length ?? 1
      }
    }
    const tryFontSize = (size: number) => {
      date.set({ width: available, fontSize: size })
      date.initDimensions()
      const measured = measurement()
      return { ...measured, fits: measured.lineCount === 1 && measured.width <= available + 0.5 && measured.height <= availableHeight + 0.5 }
    }

    let fit = tryFontSize(fontSize)
    let fittedFontSize = fontSize
    if (!fit.fits) {
      let low = 1
      let high = fontSize
      for (let attempt = 0; attempt < 24; attempt += 1) {
        const candidate = (low + high) / 2
        const measured = tryFontSize(candidate)
        if (measured.fits) {
          low = candidate
          fit = measured
          fittedFontSize = candidate
        } else {
          high = candidate
        }
      }
      if (fittedFontSize === fontSize) {
        fittedFontSize = low
        fit = tryFontSize(fittedFontSize)
      }
    }

    fit = tryFontSize(fittedFontSize)
    const compactWidth = Math.min(available, Math.ceil(fit.width) + 2)
    date.set({ width: compactWidth })
    date.initDimensions()
    let finalMeasurement = measurement()
    if (finalMeasurement.lineCount !== 1 || finalMeasurement.width > compactWidth + 0.5 || finalMeasurement.height > availableHeight + 0.5) {
      date.set({ width: available })
      date.initDimensions()
      finalMeasurement = measurement()
    }
    const renderedWidth = finalMeasurement.width
    const left = b.left + (b.width - iw - gap - renderedWidth) / 2
    date.set({ left: left + iw + gap, top: b.top + (b.height - finalMeasurement.height) / 2 })
    for (const icon of icons) icon.set({ left: icon.left + left - ix, top: icon.top + b.top + (b.height - ih) / 2 - iy })
    tracked.forEach(o => o.setCoords?.())
    changed = state() !== before || changed
  }
  return changed
}
