import { layoutReferenceValidity } from './referenceFlyerLayout'
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

    const tracked = [band, heading, date, stock]
    const keys = ['left', 'top', 'width', 'height', 'originX', 'originY', 'scaleX', 'scaleY', 'fontSize', 'text',
      '__rawText', 'styles', 'visible', 'lineHeight', 'splitByGrapheme', 'dynamicFieldBaseFontSize',
      'dynamicFieldAutoFitFontSize', 'dynamicFieldAutoHeight', 'dynamicFieldHeight']
    const state = () => JSON.stringify(tracked.map(object => keys.map(key => object[key])))
    const before = state()
    const visible = date.visible !== false && !!String(date.text || '').trim()
    band.set({ visible })
    heading.set({ visible: visible && !!String(heading.text || '').trim() })
    stock.set({ visible: visible && !!String(stock.text || '').trim() })
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
