/** Evita reflow de textos autorados que ja cabem no fundo da etiqueta. */
export const manualPriceTierFits = (background: any, objects: any[]): boolean => {
  const bounds = (object: any) => {
    const width = Number(object?.width) * Math.abs(Number(object?.scaleX ?? 1))
    const height = Number(object?.height) * Math.abs(Number(object?.scaleY ?? 1))
    const x = Number(object?.left ?? 0)
    const y = Number(object?.top ?? 0)
    if (![width, height, x, y].every(Number.isFinite) || width <= 0 || height <= 0) return null
    const left = x - (object.originX === 'center' ? width / 2 : object.originX === 'right' ? width : 0)
    const top = y - (object.originY === 'center' ? height / 2 : object.originY === 'bottom' ? height : 0)
    return { left, top, right: left + width, bottom: top + height }
  }
  const frame = bounds(background)
  if (!frame) return false
  const visible = objects.filter(object => object && object.visible !== false && Number(object.opacity ?? 1) > 0 && String(object.text ?? '').trim())
  if (!visible.length) return true
  return visible.every(object => {
    object.initDimensions?.()
    const box = bounds(object)
    return box && box.left >= frame.left - 1 && box.right <= frame.right + 1 && box.top >= frame.top - 1 && box.bottom <= frame.bottom + 1
  })
}

/** Ajuste uniforme do conjunto de textos, sem redistribuir seus componentes. */
export const fitAuthoredPriceTier = (background: any, objects: any[]): boolean => {
  if (!background) return false
  if (manualPriceTierFits(background, objects)) return true
  const bounds = (o: any) => {
    const w = Number(o.width) * Math.abs(Number(o.scaleX ?? 1))
    const h = Number(o.height) * Math.abs(Number(o.scaleY ?? 1))
    const x = Number(o.left ?? 0) - (o.originX === 'center' ? w / 2 : o.originX === 'right' ? w : 0)
    const y = Number(o.top ?? 0) - (o.originY === 'center' ? h / 2 : o.originY === 'bottom' ? h : 0)
    return { x, y, w, h }
  }
  const shown = objects.filter(o => o && o.visible !== false && Number(o.opacity ?? 1) > 0 && String(o.text ?? '').trim())
  const frame = bounds(background)
  const boxes = shown.map(bounds)
  if (!boxes.length || [frame, ...boxes].some(b => ![b.x,b.y,b.w,b.h].every(Number.isFinite) || b.w <= 0 || b.h <= 0)) return false
  const left = Math.min(...boxes.map(b=>b.x)), top = Math.min(...boxes.map(b=>b.y))
  const width = Math.max(...boxes.map(b=>b.x+b.w)) - left
  const height = Math.max(...boxes.map(b=>b.y+b.h)) - top
  const scale = Math.min(1, frame.w / width, frame.h / height)
  const targetLeft = Math.max(frame.x, Math.min(left, frame.x + frame.w - width * scale))
  const targetTop = Math.max(frame.y, Math.min(top, frame.y + frame.h - height * scale))
  shown.forEach(o => {
    o.set?.({
      left: targetLeft + (Number(o.left ?? 0) - left) * scale,
      top: targetTop + (Number(o.top ?? 0) - top) * scale,
      scaleX: Number(o.scaleX ?? 1) * scale,
      scaleY: Number(o.scaleY ?? 1) * scale
    })
    o.setCoords?.()
    o.dirty = true
  })
  return true
}
