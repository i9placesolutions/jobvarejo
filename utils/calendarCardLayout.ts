/** Mede a data já composta pelo Fabric; nenhuma altura depende de datas de exemplo. */
export const layoutCalendarCards = (objects: any[]): boolean => {
  let changed = false
  for (const date of objects.filter(o => o.quickValidityLayout === 'calendar-card')) {
    const siblings = objects.filter(o => o.parentFrameId === date.parentFrameId)
    const get = (name: string) => siblings.find(o => o.name === name)
    const card = get('standard-validity-background'), heading = get('validity-heading'), stock = get('stock-validity')
    if (!card || !heading || !stock || !date.getBoundingRect) continue
    const set = (o: any, values: any) => {
      if (!o) return
      if (Object.entries(values).some(([k,v]) => Math.abs(Number(o[k]) - Number(v)) > .1 || typeof v !== 'number' && o[k] !== v)) {
        o.set(values); o.setCoords?.(); o.dirty = true; changed = true
      }
    }
    date.initDimensions?.(); heading.initDimensions?.(); stock.initDimensions?.()
    const bounds = card.getBoundingRect(), scale = Math.abs(card.scaleY || 1)
    const gap = Math.max(3, Number(date.fontSize) * .18) * Math.abs(date.scaleY || 1)
    const bottom = bounds.top + bounds.height
    const headingHeight = heading.getBoundingRect().height
    const dateHeight = date.getBoundingRect().height
    const stockHeight = stock.visible !== false && String(stock.text || '').trim() ? stock.getBoundingRect().height : 0
    const height = headingHeight + dateHeight + stockHeight + gap * (stockHeight ? 4 : 3)
    const top = bottom - height
    const moveTop = (o: any, y: number) => { if (o?.getBoundingRect) set(o, {top: o.top + y - o.getBoundingRect().top}) }
    set(card, { height: Math.max(1, height / scale - Number(card.strokeWidth || 0)) }); moveTop(card, top)
    moveTop(heading, top + gap)
    moveTop(date, top + gap * 2 + headingHeight)
    if (stockHeight) moveTop(stock, top + gap * 3 + headingHeight + dateHeight)
    for (const [name, field, visible] of [['reference-validity-heading-band', heading, true], ['reference-validity-stock-band', stock, !!stockHeight]] as const) {
      const band = get(name)
      if (!band) continue
      set(band, {visible: date.visible !== false && visible, height: (field.getBoundingRect().height + gap * .35) / Math.abs(band.scaleY || 1)})
      moveTop(band, field.getBoundingRect().top - gap * .175)
    }
    // O calendário acompanha o centro do conteúdo, sem mudar seu desenho.
    const calendar = siblings.filter(o => /^header-validity-calendar/.test(o.name || '') && o.visible !== false)
    if (calendar.length) {
      const boxes = calendar.map(o => o.getBoundingRect())
      const min = Math.min(...boxes.map(b => b.top)), max = Math.max(...boxes.map(b => b.top + b.height))
      const shift = top + (height - (max - min)) / 2 - min
      for (const icon of calendar) set(icon, {top: icon.top + shift})
    }
  }
  return changed
}
