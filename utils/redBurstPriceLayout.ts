/** Shared Red Burst price layout used by the manual editor and render adapters. */
export type RedBurstPriceLayoutDeps = {
  isRedBurstPriceGroup: (group: any) => boolean
  ensureRedBurstPriceGroupVisibility: (group: any) => boolean
  shouldPreserveManualTemplateVisual: (group: any) => boolean
  collectObjectsDeep: (group: any) => any[]
  findByName: (objects: any[], name: string) => any
  isTextLikeObject: (object: any) => boolean
  clamp: (value: number, min: number, max: number) => number
  readSingleManualPriceAnchors: (group: any, options?: any) => any
  fitManualSinglePriceValuesIntoTemplate: (group: any) => void
  getRichPriceSegmentFontSize: (object: any, segment: 'integer' | 'decimal', fallback: number) => number
  setRichPriceSegmentStyle: (object: any, segment: 'integer' | 'decimal', style: any) => any
}

export const createRedBurstPriceLayout = (deps: RedBurstPriceLayoutDeps) => {
  const tuneRedBurstPriceGroupLayout = (priceGroup: any) => {
    if (!deps.isRedBurstPriceGroup(priceGroup)) return false
    deps.ensureRedBurstPriceGroupVisibility(priceGroup)
    const preserveManualHeaderGeometry =
      deps.shouldPreserveManualTemplateVisual(priceGroup) &&
      priceGroup?.__allowRedBurstHeaderAutofit !== true
    const preserveManualPriceGeometry =
      deps.shouldPreserveManualTemplateVisual(priceGroup) &&
      priceGroup?.__allowRedBurstPriceAutofit !== true
    const all = deps.collectObjectsDeep(priceGroup)
    const priceBg = deps.findByName(all, 'price_bg')
    const headerBg = deps.findByName(all, 'price_header_bg')
    const headerText = deps.findByName(all, 'price_header_text')
    const headerUnitText = deps.findByName(all, 'price_header_unit_text')
    const currencyText = deps.findByName(all, 'price_currency_text')
    const richPrice = deps.findByName(all, 'price_value_text')
    const priceInteger = deps.findByName(all, 'price_integer_text')
    const priceDecimal = deps.findByName(all, 'price_decimal_text')
    const valueText = richPrice || priceInteger
    if (!priceBg || !headerBg || !headerText || !currencyText || !valueText || (!richPrice && !priceDecimal)) return false

    const bgW = Math.max(1, Number(priceBg.width || 0))
    const bgH = Math.max(1, Number(priceBg.height || 0))
    const headerW = Math.max(1, Number(headerBg.width || bgW * 0.92))
    const headerH = Math.max(1, Number(headerBg.height || bgH * 0.27))
    const headerY = Number(headerBg.top || (-bgH / 2 + headerH * 0.72))
    const ensureTextDims = (object: any) => {
      if (deps.isTextLikeObject(object)) object.initDimensions?.()
    }

    if (headerUnitText && deps.isTextLikeObject(headerUnitText)) {
      headerUnitText.set({ text: '', visible: false })
      ensureTextDims(headerUnitText)
    }
    if (deps.isTextLikeObject(headerText)) {
      const originalHeaderFont = Number(headerText.__originalFontSize || headerText.fontSize || Math.max(16, headerH * 0.56))
      if (!preserveManualHeaderGeometry) {
        headerText.set({ originX: 'center', originY: 'center', left: 0, top: headerY + headerH * 0.01,
          width: headerW * 0.9, fontSize: originalHeaderFont, scaleX: 1, scaleY: 1 })
        ensureTextDims(headerText)
        const headerMaxW = headerW * 0.9
        const measuredHeaderW = Number(headerText.getScaledWidth?.() || 0)
        if (measuredHeaderW > headerMaxW && measuredHeaderW > 0) {
          const ratio = deps.clamp(headerMaxW / measuredHeaderW, 0.55, 1)
          headerText.set({ fontSize: Math.max(12, originalHeaderFont * ratio) })
          ensureTextDims(headerText)
        }
      } else ensureTextDims(headerText)
    }
    if (!deps.isTextLikeObject(currencyText) || !deps.isTextLikeObject(valueText) || (!richPrice && !deps.isTextLikeObject(priceDecimal))) return false

    if (preserveManualPriceGeometry) {
      deps.readSingleManualPriceAnchors(priceGroup) || deps.readSingleManualPriceAnchors(priceGroup, { force: true })
      deps.fitManualSinglePriceValuesIntoTemplate(priceGroup)
      priceGroup.getObjects?.().forEach((object: any) => object?.setCoords?.())
      priceGroup.dirty = true
      priceGroup.setCoords?.()
      return true
    }

    const originalCurrencyFont = Number(currencyText.__originalFontSize || currencyText.fontSize || Math.max(20, bgH * 0.2))
    const originalIntegerFont = richPrice
      ? deps.getRichPriceSegmentFontSize(richPrice, 'integer', Math.max(56, bgH * 0.78))
      : Number(priceInteger.__originalFontSize || priceInteger.fontSize || Math.max(56, bgH * 0.78))
    const originalDecimalFont = richPrice
      ? deps.getRichPriceSegmentFontSize(richPrice, 'decimal', Math.max(28, bgH * 0.44))
      : Number(priceDecimal.__originalFontSize || priceDecimal.fontSize || Math.max(28, bgH * 0.44))
    const priceBaselineY = bgH * 0.2
    const innerLeftPad = bgW * 0.08
    const innerRightPad = bgW * 0.06
    const textGap = Math.max(2, bgW * 0.008)
    const currencyGap = Math.max(4, bgW * 0.02)
    currencyText.set({ originX: 'center', originY: 'center', fontSize: originalCurrencyFont, scaleX: 1, scaleY: 1, top: priceBaselineY + bgH * 0.01 })
    if (richPrice) {
      deps.setRichPriceSegmentStyle(richPrice, 'integer', { fontSize: originalIntegerFont })
      deps.setRichPriceSegmentStyle(richPrice, 'decimal', { fontSize: originalDecimalFont })
      richPrice.set({ originX: 'left', originY: 'center', scaleX: 1, scaleY: 1, top: priceBaselineY + bgH * 0.01 })
    } else {
      priceInteger.set({ originX: 'left', originY: 'center', fontSize: originalIntegerFont, scaleX: 1, scaleY: 1, top: priceBaselineY + bgH * 0.01 })
      priceDecimal.set({ originX: 'left', originY: 'center', fontSize: originalDecimalFont, scaleX: 1, scaleY: 1, top: priceBaselineY - bgH * 0.145 })
    }
    ensureTextDims(currencyText); ensureTextDims(valueText); if (priceDecimal) ensureTextDims(priceDecimal)
    const currencyX = -bgW / 2 + innerLeftPad + Number(currencyText.getScaledWidth?.() || 0) / 2
    currencyText.set({ left: currencyX }); ensureTextDims(currencyText)
    const layoutPriceTexts = () => {
      const currencyW = Number(currencyText.getScaledWidth?.() || 0)
      const intW = Number(valueText.getScaledWidth?.() || 0)
      const decW = richPrice ? 0 : Number(priceDecimal?.getScaledWidth?.() || 0)
      const textStartX = currencyX + currencyW / 2 + currencyGap
      const availableW = Math.max(1, bgW / 2 - innerRightPad - textStartX)
      return { textStartX, totalW: intW + textGap + decW, availableW }
    }
    let integerFont = originalIntegerFont
    let decimalFont = originalDecimalFont
    for (let i = 0; i < 4; i++) {
      const layout = layoutPriceTexts()
      if (layout.totalW <= layout.availableW) break
      const ratio = deps.clamp(layout.availableW / layout.totalW, 0.7, 1)
      integerFont = Math.max(36, integerFont * ratio)
      decimalFont = Math.max(20, decimalFont * ratio)
      if (richPrice) {
        deps.setRichPriceSegmentStyle(richPrice, 'integer', { fontSize: integerFont })
        deps.setRichPriceSegmentStyle(richPrice, 'decimal', { fontSize: decimalFont })
        richPrice.set({ scaleX: 1, scaleY: 1 }); ensureTextDims(richPrice)
      } else {
        priceInteger.set({ fontSize: integerFont, scaleX: 1, scaleY: 1 })
        priceDecimal.set({ fontSize: decimalFont, scaleX: 1, scaleY: 1 })
        ensureTextDims(priceInteger); ensureTextDims(priceDecimal)
      }
    }
    const finalLayout = layoutPriceTexts()
    valueText.set({ left: finalLayout.textStartX }); ensureTextDims(valueText)
    if (!richPrice) {
      priceDecimal.set({ left: finalLayout.textStartX + Number(priceInteger.getScaledWidth?.() || 0) + textGap })
      ensureTextDims(priceDecimal)
    }
    return true
  }
  return { tuneRedBurstPriceGroupLayout }
}
