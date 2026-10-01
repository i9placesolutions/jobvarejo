import { layoutReferenceValidity } from './referenceFlyerLayout'
import { fitQuickBusinessFooterText } from './quickBusinessFooterTypography'
/** Mantém a validade dentro da faixa reservada pelo modelo, usando medidas reais do Fabric. */
export const layoutOfferValidityBanner = (objects: any[]): boolean => {
  let changed = false
  for (const date of objects.filter(object => ['offer-banner', 'reference-ribbon'].includes(object.quickValidityLayout))) {
    const siblings = objects.filter(object => object.parentFrameId === date.parentFrameId)
    if (date.quickValidityLayout === 'reference-ribbon') { changed = layoutReferenceValidity(date, siblings) || changed; continue }
    const band = siblings.find(object => object.name === 'standard-validity-background')
    const heading = siblings.find(object => object.name === 'validity-heading')
    const stock = siblings.find(object => object.name === 'stock-validity')
    if (!band?.getBoundingRect || !heading || !stock || !date.initDimensions || !date.calcTextWidth) continue

    const referenceStyle = date.quickValidityReferenceStyle
    const pillStyle = ['stack-pill', 'inline-pill'].includes(referenceStyle)
    const pill = pillStyle ? siblings.find(object => object.name === 'reference-validity-stock-band') : null
    const tracked = [band, heading, date, stock, ...(pill ? [pill] : [])]
    const keys = ['left', 'top', 'width', 'height', 'originX', 'originY', 'scaleX', 'scaleY', 'fontSize', 'text',
      '__rawText', 'styles', 'visible', 'lineHeight', 'splitByGrapheme', 'dynamicFieldBaseFontSize',
      'dynamicFieldAutoFitFontSize', 'dynamicFieldAutoHeight', 'dynamicFieldHeight']
    const state = () => JSON.stringify(tracked.map(object => keys.map(key => object[key])))
    const before = state()
    const visible = date.visible !== false && !!String(date.text || '').trim()
    band.set({ visible })
    heading.set({ visible: visible && !!String(heading.text || '').trim() })
    stock.set({ visible: visible && !!String(stock.text || '').trim() })
    if (pillStyle) {
      // A faixa recebe chamada e período; o estoque fica centralizado na própria pílula do modelo.
      stock.set({ visible: stock.visible !== false && !!pill })
      pill?.set({ visible: stock.visible !== false })
      const fit = (field: any, left: number, top: number, w: number, h: number, size: number, align: string): number => {
        field.set({ originX: 'left', originY: 'top', scaleX: 1, scaleY: 1, textAlign: align, lineHeight: 1 })
        fitQuickBusinessFooterText(field, { width: w, height: h, maxFontSize: size, singleLine: true })
        field.set({ left, top: top + Math.max(0, (h - field.getBoundingRect().height) / 2) })
        const lineWidth = field.getLineWidth ? Number(field.getLineWidth(0)) : Number(field.calcTextWidth?.() || 0)
        return lineWidth * Number(field.scaleX || 1)
      }
      if (visible) {
        const bounds = band.getBoundingRect()
        const inset = bounds.height * .06
        const x = bounds.left + inset, y = bounds.top + inset
        const width = bounds.width - inset * 2, height = bounds.height - inset * 2
        if (referenceStyle === 'stack-pill') {
          const align = date.textAlign === 'center' ? 'center' : 'left'
          if (heading.visible !== false) fit(heading, x, y, width, height * .38, height * .36, align)
          fit(date, x, y + height * .38, width, height * .62, height * .6, align)
        } else {
          const fields = [heading, date].filter(field => field.visible !== false)
          const size = height * .86, gap = height * .24
          const natural = fields.map(field => fit(field, x, y, 100000, height, size, 'left'))
          const total = natural.reduce((sum, value) => sum + value, 0) + gap * (fields.length - 1)
          const factor = Math.min(1, width / Math.max(1, total))
          let left = x + (width - total * factor) / 2
          fields.forEach((field, index) => {
            fit(field, left, y, natural[index]! * factor + 2, height, size * factor, 'left')
            left += natural[index]! * factor + gap * factor
          })
        }
        if (pill && stock.visible !== false) {
          const area = pill.getBoundingRect()
          const padY = area.height * .16, padX = Math.max(area.height * .45, area.width * .03)
          fit(stock, area.left + padX, area.top + padY, area.width - padX * 2, area.height - padY * 2, (area.height - padY * 2) * .92, 'center')
        }
      }
      tracked.forEach(object => { object.setCoords?.(); object.dirty = true })
      changed = state() !== before || changed
      continue
    }
    if (['inline', 'stacked', 'card'].includes(referenceStyle)) {
      const bounds = band.getBoundingRect()
      const inset = bounds.height * (referenceStyle === 'stacked' ? .02 : .06)
      const x = bounds.left + inset, y = bounds.top + inset
      const width = bounds.width - inset * 2, height = bounds.height - inset * 2
      const fit = (field: any, left: number, top: number, w: number, h: number, size: number, align: string) => {
        if (!visible || field.visible === false) return
        field.set({ originX: 'left', originY: 'top', scaleX: 1, scaleY: 1, textAlign: align, lineHeight: 1 })
        fitQuickBusinessFooterText(field, { width: w, height: h, maxFontSize: size, singleLine: true })
        field.set({ left, top: top + Math.max(0, (h - field.getBoundingRect().height) / 2) })
      }
      if (referenceStyle === 'inline') {
        stock.set({ visible: false })
        const headingShare = Math.min(.8, Math.max(.2, Number(date.quickValidityHeadingShare) || .43))
        fit(heading, x, y, width * headingShare, height, height * .78, 'left')
        fit(date, x + width * headingShare, y, width * (1 - headingShare), height, height * .78, 'left')
      } else if (referenceStyle === 'stacked') {
        stock.set({ visible: false })
        fit(heading, x, y, width, height * .44, height * .44, 'left')
        fit(date, x, y + height * .44, width, height * .56, height * .56, 'left')
      } else {
        fit(heading, x, y, width, height * .25, height * .26, 'center')
        fit(date, x, y + height * .25, width, height * .48, height * .49, 'center')
        fit(stock, x, y + height * .73, width, height * .27, height * .27, 'center')
      }
      tracked.forEach(object => { object.setCoords?.(); object.dirty = true })
      changed = state() !== before || changed
      continue
    }
    if (visible) {
      const bounds = band.getBoundingRect()
      const inset = Math.max(1, bounds.height * .09)
      const horizontalInset = Math.max(inset, bounds.width * .018)
      const left = bounds.left + horizontalInset
      const top = bounds.top + inset
      const width = Math.max(1, bounds.width - horizontalInset * 2)
      const height = Math.max(1, bounds.height - inset * 2)
      const fields = [heading, date, ...(stock.visible ? [stock] : [])].filter(object => object.visible !== false)
      const gap = Math.min(3, height * .025)
      const availableHeight = Math.max(1, height - gap * (fields.length - 1))
      const weights = fields.map(object => object === date ? 1.65 : object === heading ? 1 : .72)
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
      let rowTop = top
      for (let index = 0; index < fields.length; index++) {
        const field = fields[index]
        if (!field.initDimensions || !field.calcTextWidth) continue
        const rowHeight = availableHeight * weights[index]! / totalWeight
        const baseSize = Number(field.dynamicFieldBaseFontSize || field.fontSize || rowHeight / 1.13)
        const currentSize = Number(field.fontSize || baseSize)
        // Preserva a paleta e estilos por caractere; ajusta somente tamanhos explícitos junto da fonte.
        const baseStyles = Object.fromEntries(Object.entries(field.styles || {}).map(([row, chars]: [string, any]) => [row,
          Object.fromEntries(Object.entries(chars || {}).map(([column, style]: [string, any]) => [column, {
            ...style, ...(Number(style.fontSize) > 0 ? { fontSize: Number(style.fontSize) * baseSize / currentSize } : {})
          }]))
        ]))
        const stylesAt = (factor: number) => Object.fromEntries(Object.entries(baseStyles).map(([row, chars]: [string, any]) => [row,
          Object.fromEntries(Object.entries(chars).map(([column, style]: [string, any]) => [column, {
            ...style, ...(Number(style.fontSize) > 0 ? { fontSize: Number(style.fontSize) * factor } : {})
          }]))
        ]))
        const text = String(field.text || '').replace(/\s+/g, ' ').trim()
        field.set({ text, __rawText: text, originX: 'left', originY: 'top', scaleX: 1, scaleY: 1,
          width: 100000, fontSize: baseSize, styles: baseStyles, lineHeight: 1, splitByGrapheme: false,
          dynamicFieldBaseFontSize: baseSize, dynamicFieldAutoHeight: true })
        field.initDimensions()
        const measuredWidth = Math.max(1, field.calcTextWidth() + 2)
        const measuredHeight = Math.max(1, field.getBoundingRect().height)
        const factor = Math.min(1, width / measuredWidth, rowHeight / measuredHeight)
        field.set({ width, fontSize: baseSize * factor, styles: stylesAt(factor), dynamicFieldAutoFitFontSize: baseSize * factor })
        field.initDimensions()
        // Arredondamentos de fonte não podem criar uma segunda linha nem ultrapassar a faixa.
        for (let attempt = 0; attempt < 4 && (field.textLines?.length > 1 || field.getBoundingRect().height > rowHeight + .01 || field.calcTextWidth() > width); attempt++) {
          const nextFactor = Number(field.fontSize) / baseSize * .96
          field.set({ width, fontSize: baseSize * nextFactor, styles: stylesAt(nextFactor), dynamicFieldAutoFitFontSize: baseSize * nextFactor })
          field.initDimensions()
        }
        const measured = field.getBoundingRect()
        field.set({ left, top: rowTop + Math.max(0, (rowHeight - measured.height) / 2), dynamicFieldHeight: field.height })
        rowTop += rowHeight + gap
      }
    }
    tracked.forEach(object => { object.setCoords?.(); object.dirty = true })
    changed = state() !== before || changed
  }
  return changed
}
