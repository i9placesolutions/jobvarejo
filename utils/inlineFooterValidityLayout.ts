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
    const fontSize = Number(date.dynamicFieldBaseFontSize || date.fontSize || 26)
    date.set({ text: String(date.text || '').replace(/\s+/g, ' ').trim(), width: 100000, fontSize, scaleX: 1, scaleY: 1, originX: 'left', originY: 'top', textAlign: 'left', styles: {} })
    date.initDimensions()
    const fit = Math.min(1, available / Math.max(1, date.calcTextWidth() + 2))
    date.set({ fontSize: fontSize * fit }); date.initDimensions()
    const width = Math.min(available, Math.ceil(date.calcTextWidth()) + 2)
    date.set({ width }); date.initDimensions()
    const left = b.left + (b.width - iw - gap - width) / 2
    date.set({ left: left + iw + gap, top: b.top + (b.height - date.height) / 2 })
    for (const icon of icons) icon.set({ left: icon.left + left - ix, top: icon.top + b.top + (b.height - ih) / 2 - iy })
    tracked.forEach(o => o.setCoords?.())
    changed = state() !== before || changed
  }
  return changed
}
