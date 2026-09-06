export const fitResponsiveProductName = (title: any, width: number, height: number, nameScale = 1) => {
  if (title && title.visible !== false) {
    const top = title.getPointByOrigin?.('center', 'top')
    const maxFont = Math.max(1, Math.min(width, height) * 0.085 * nameScale)
    // Fontes por caractere vindas da importação não podem bloquear o tamanho automático.
    for (const line of Object.values(title.styles || {})) {
      for (const style of Object.values(line as any)) {
        if (style && typeof style === 'object') delete (style as any).fontSize
      }
    }
    title.set({ fontSize: maxFont, scaleX: 1, scaleY: 1 })
    title.initDimensions?.()
    // Textos compridos cabem na faixa do nome sem invadir a foto.
    const maxHeight = height * 0.23
    const minFont = Math.max(1, maxFont * 0.55)
    for (let i = 0; i < 100 && title.height > maxHeight && title.fontSize > minFont; i++) {
      title.set({ fontSize: Math.max(minFont, title.fontSize * 0.92) })
      title.initDimensions?.()
    }
    if (top) title.setPositionByOrigin?.(top, 'center', 'top')
    title.dirty = true
    title.setCoords?.()
  }
}

// Limites finais por card, independentes da célula de referência da zona.
export const fitResponsiveProductTypography = (group: any, width: number, height: number, nameScale = 1) => {
  if (!(width > 0 && height > 0)) return
  const children = group.getObjects?.() || []
  const title = children.find((o: any) => o.name === 'smart_title')
  const price = children.find((o: any) => o.name === 'priceGroup' || o.isPriceGroup)
  fitResponsiveProductName(title, width, height, nameScale)
  if (price && price.visible !== false) {
    const labelWidth = Math.abs(Number(price.width) * Number(price.scaleX || 1))
    const labelHeight = Math.abs(Number(price.height) * Number(price.scaleY || 1))
    const compact = Math.min(1, Math.sqrt(height / width))
    const factor = Math.min(1, width * 0.76 * compact / labelWidth, height * 0.30 / labelHeight)
    if (Number.isFinite(factor) && factor > 0 && factor < 1) {
      const bottom = price.getPointByOrigin?.('center', 'bottom')
      price.set({ scaleX: price.scaleX * factor, scaleY: price.scaleY * factor })
      if (bottom) price.setPositionByOrigin?.(bottom, 'center', 'bottom')
      price.dirty = true
      price.setCoords?.()
    }
  }
  group.dirty = true
}

// Cards equivalentes compartilham a menor tipografia necessária para seus textos.
export const harmonizeProductCardTypography = (cards: any[]) => {
  const groups = new Map<string, any[]>()
  for (const card of cards) {
    const key = `${Math.round(card.width)}:${Math.round(card.height)}`
    const group = groups.get(key) || []
    group.push(card)
    groups.set(key, group)
  }
  for (const cards of groups.values()) {
    const titles = cards.flatMap(card => (card.getObjects?.() || []).filter((o: any) => o.name === 'smart_title' && o.visible !== false))
    const font = Math.min(...titles.map((o: any) => Number(o.fontSize)).filter((n: number) => n > 0))
    for (const title of titles) {
      if (!Number.isFinite(font)) continue
      const top = title.getPointByOrigin?.('center', 'top')
      for (const line of Object.values(title.styles || {})) {
        for (const style of Object.values(line as any)) {
          if (style && typeof style === 'object') delete (style as any).fontSize
        }
      }
      title.set({ fontSize: font, scaleX: 1, scaleY: 1 })
      title.initDimensions?.()
      if (top) title.setPositionByOrigin?.(top, 'center', 'top')
      title.setCoords?.()
      title.dirty = true
    }
    const prices = cards.flatMap(card => (card.getObjects?.() || []).filter((o: any) => (o.name === 'priceGroup' || o.isPriceGroup) && o.visible !== false))
    const height = Math.min(...prices.map((o: any) => Math.abs(o.height * o.scaleY)).filter((n: number) => n > 0))
    for (const price of prices) {
      const current = Math.abs(price.height * price.scaleY)
      if (!(current > 0 && Number.isFinite(height))) continue
      const bottom = price.getPointByOrigin?.('center', 'bottom')
      price.set({ scaleX: price.scaleX * height / current, scaleY: price.scaleY * height / current })
      if (bottom) price.setPositionByOrigin?.(bottom, 'center', 'bottom')
      price.setCoords?.()
      price.dirty = true
    }
    cards.forEach(card => { card.dirty = true })
  }
}
