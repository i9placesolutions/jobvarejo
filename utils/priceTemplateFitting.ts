type PriceTemplateFittingDeps = {
  shouldPreserveManualTemplateVisual: (object: any) => boolean
  collectObjectsDeep: (object: any) => any[]
  findByName: (objects: any[], name: string) => any
  getSinglePriceBackgroundCandidate: (objects: any[]) => any
  getSinglePriceCurrencyTextCandidate: (objects: any[]) => any
  ensureSinglePriceCurrencyCircleAnchor: (group: any, objects?: any[]) => any
  readSingleManualPriceAnchors: (group: any, options?: { force?: boolean }) => any
  isObjectShownForBounds: (object: any) => boolean
  getObjectHorizontalBoundsLocal: (object: any) => any
  getObjectVerticalBoundsLocal: (object: any) => any
  measureHorizontalBoundsLocal: (objects: any[]) => any
  layoutPrice: (options: any) => any
  isRichPriceTextObject: (object: any) => boolean
  positionRichPriceUnit: (richPrice: any, unit: any, top: number) => boolean
  constrainSinglePriceTextInsideBackground: (group: any) => void
  clamp: (value: number, min: number, max: number) => number
  priceIntegerDecimalGapPx: number
}

export const createPriceTemplateFitting = (deps: PriceTemplateFittingDeps) => {
  const fitManualSinglePriceValuesIntoTemplate = (priceGroup: any) => {
    if (!priceGroup || typeof priceGroup.getObjects !== 'function') return
    if (!deps.shouldPreserveManualTemplateVisual(priceGroup)) return

    const all = deps.collectObjectsDeep(priceGroup)
    if (deps.findByName(all, 'atac_retail_bg')) return

    const priceBg = deps.getSinglePriceBackgroundCandidate(all)
    const currency = deps.getSinglePriceCurrencyTextCandidate(all)
    const currencyCircle = deps.ensureSinglePriceCurrencyCircleAnchor(priceGroup, all)
    const richPrice = deps.findByName(all, 'price_value_text') || deps.findByName(all, 'smart_price')
    const integer = deps.findByName(all, 'price_integer_text') || deps.findByName(all, 'priceInteger') || deps.findByName(all, 'price_integer')
    const decimal = deps.findByName(all, 'price_decimal_text') || deps.findByName(all, 'priceDecimal') || deps.findByName(all, 'price_decimal')
    const unit = deps.findByName(all, 'price_unit_text') || deps.findByName(all, 'priceUnit') || deps.findByName(all, 'price_unit')
    if (!priceBg || (!richPrice && (!integer || !decimal))) return

    const anchors =
      deps.readSingleManualPriceAnchors(priceGroup) ||
      deps.readSingleManualPriceAnchors(priceGroup, { force: true }) ||
      {}
    const getWidth = (object: any) => (object && typeof object.getScaledWidth === 'function') ? Number(object.getScaledWidth()) : 0

    const minScale = 0.34
    const normalizeTemplateScale = (raw: any, fallback: any, min = 0.12, max = 3.2) => {
      const fallbackNum = Number(fallback)
      const safeFallback = Number.isFinite(fallbackNum) && Math.abs(fallbackNum) > 0 ? fallbackNum : 1
      const parsed = Number(raw)
      if (!Number.isFinite(parsed) || parsed === 0) return safeFallback
      const sign = parsed < 0 ? -1 : 1
      const magnitude = Math.abs(parsed)
      return sign * deps.clamp(magnitude, min, max)
    }
    // A etiqueta manual pode ter recebido uma escala diretamente no texto
    // interno (por exemplo, o valor `49,99` foi aumentado no mini-editor).
    // Essa escala faz parte da arte criada pelo usuário e não pode ser
    // substituída pela escala-base capturada na criação do template durante
    // uma reorganização do card. O ajuste automático ainda pode reduzir a
    // cadeia se ela realmente não couber no fundo, mas começa pela geometria
    // autorada para não transformar o texto em uma versão minúscula.
    const preserveAuthoredChildTransforms = (priceGroup as any).__preserveManualLayout === true
    const restoreBaseScale = (object: any) => {
      if (!object || typeof object.set !== 'function') return
      if (preserveAuthoredChildTransforms) {
        object.initDimensions?.()
        return
      }
      const scaleX = Number((object as any).__originalScaleX)
      const scaleY = Number((object as any).__originalScaleY)
      object.set({
        scaleX: normalizeTemplateScale(scaleX, Number(object.scaleX || 1)),
        scaleY: normalizeTemplateScale(scaleY, Number(object.scaleY || 1))
      })
      object.initDimensions?.()
    }
    const centerObjectsX = (objects: any[], centerX = 0) => {
      const shown = (objects || []).filter((object: any) => deps.isObjectShownForBounds(object))
      const bounds = deps.measureHorizontalBoundsLocal(shown)
      if (!bounds) return
      const currentCenter = (bounds.left + bounds.right) / 2
      const dx = centerX - currentCenter
      if (Math.abs(dx) < 0.001) return
      shown.forEach((object: any) => object?.set?.({ left: Number(object.left || 0) + dx }))
    }
    const fitChainToWidth = (objects: any[], maxWidth: number, minimumScale: number) => {
      const shown = (objects || []).filter((object: any) => deps.isObjectShownForBounds(object))
      if (!shown.length || !Number.isFinite(maxWidth) || maxWidth <= 0) return
      const bounds = deps.measureHorizontalBoundsLocal(shown)
      if (!bounds || bounds.width <= maxWidth) return
      const scale = deps.clamp(maxWidth / bounds.width, minimumScale, 1)
      shown.forEach((object: any) => object?.set?.({
        scaleX: Number(object.scaleX || 1) * scale,
        scaleY: Number(object.scaleY || 1) * scale
      }))
    }

    // Rich price text is persisted as a single Fabric text object after the
    // integer/decimal migration.  Older layout passes could leave that node
    // with a stale top value (for example -1857) while all of its anchor
    // metadata and the pill remained valid.  Horizontal fitting alone does
    // not recover it, so only repair a position that is clearly outside the
    // background; valid manual vertical offsets remain untouched.
    const resolveSafeRichPriceTop = (object: any): number => {
      const currentTop = Number(object?.top)
      const backgroundBounds = deps.getObjectVerticalBoundsLocal(priceBg)
      const textHeight = (() => {
        const rawHeight = Number(object?.height || 0)
        const scaleY = Math.abs(Number(object?.scaleY ?? 1)) || 1
        const height = rawHeight * scaleY
        return Number.isFinite(height) && height > 0 ? height : 0
      })()
      const backgroundHeight = backgroundBounds
        ? Math.max(0, Number(backgroundBounds.bottom) - Number(backgroundBounds.top))
        : 0
      const sanityLimit = Math.max(160, backgroundHeight > 0 ? backgroundHeight * 2 : textHeight * 8)
      const margin = backgroundHeight > 0
        ? deps.clamp(backgroundHeight * 0.08, 4, 18)
        : 8
      const getCandidateBounds = (top: number) => {
        if (!Number.isFinite(top)) return null
        const originY = String(object?.originY || 'top')
        if (!textHeight) {
          return { top, bottom: top }
        }
        if (originY === 'center') {
          return { top: top - (textHeight / 2), bottom: top + (textHeight / 2) }
        }
        if (originY === 'bottom') {
          return { top: top - textHeight, bottom: top }
        }
        return { top, bottom: top + textHeight }
      }
      const isVisibleInBackground = (top: number) => {
        if (!Number.isFinite(top) || Math.abs(top) > sanityLimit) return false
        if (!backgroundBounds) return true
        const candidate = getCandidateBounds(top)
        if (!candidate) return false
        return candidate.bottom >= Number(backgroundBounds.top) - margin
          && candidate.top <= Number(backgroundBounds.bottom) + margin
      }

      if (isVisibleInBackground(currentTop)) return currentTop

      const anchorCandidates = [
        Number((anchors as any).intY),
        Number((anchors as any).decY)
      ]
      for (const candidate of anchorCandidates) {
        if (isVisibleInBackground(candidate)) return candidate
      }

      if (backgroundBounds) {
        const center = (Number(backgroundBounds.top) + Number(backgroundBounds.bottom)) / 2
        if (String(object?.originY || 'top') === 'center') return center
        if (String(object?.originY || 'top') === 'bottom') return center + (textHeight / 2)
        return center - (textHeight / 2)
      }
      return 0
    }

    if (richPrice && (!integer || !decimal)) {
      restoreBaseScale(richPrice)
      restoreBaseScale(unit)
      const safeRichTop = resolveSafeRichPriceTop(richPrice)
      if (Number(richPrice.top) !== safeRichTop) {
        richPrice.set?.({ top: safeRichTop })
        richPrice.setCoords?.()
      }
      const richBackgroundBounds = deps.getObjectHorizontalBoundsLocal(priceBg)
      const richBackgroundWidth = Math.max(1, Number(priceBg.width || 0) * Math.abs(Number(priceBg.scaleX ?? 1) || 1))
      const richPadLeft = deps.clamp(
        Number.isFinite(Number((anchors as any).padLeft)) ? Number((anchors as any).padLeft) : Math.max(8, richBackgroundWidth * 0.08),
        4,
        Math.max(10, richBackgroundWidth * 0.25)
      )
      const richPadRight = deps.clamp(
        Number.isFinite(Number((anchors as any).padRight)) ? Number((anchors as any).padRight) : Math.max(8, richBackgroundWidth * 0.08),
        4,
        Math.max(10, richBackgroundWidth * 0.25)
      )
      const richMaxWidth = richBackgroundBounds
        ? Math.max(20, (richBackgroundBounds.right - richBackgroundBounds.left) - richPadLeft - richPadRight)
        : Math.max(20, richBackgroundWidth - richPadLeft - richPadRight)
      fitChainToWidth([richPrice], richMaxWidth, minScale)
      const unitY = Number.isFinite(Number(unit?.top)) ? Number(unit.top) : 0
      deps.positionRichPriceUnit(richPrice, unit, unitY)
      deps.constrainSinglePriceTextInsideBackground(priceGroup)
      deps.positionRichPriceUnit(richPrice, unit, unitY)
      richPrice.setCoords?.()
      priceGroup.dirty = true
      priceGroup.setCoords?.()
      return
    }

    restoreBaseScale(integer)
    restoreBaseScale(decimal)
    restoreBaseScale(unit)
    restoreBaseScale(currency)

    const backgroundBounds = deps.getObjectHorizontalBoundsLocal(priceBg)
    const backgroundWidth = Math.max(1, Number(priceBg.width || 0) * Math.abs(Number(priceBg.scaleX ?? 1) || 1))
    const rawPadLeft = Number((anchors as any).padLeft)
    const rawPadRight = Number((anchors as any).padRight)
    const padLeft = deps.clamp(
      Number.isFinite(rawPadLeft) ? rawPadLeft : Math.max(8, backgroundWidth * 0.08),
      4,
      Math.max(10, backgroundWidth * 0.25)
    )
    const padRight = deps.clamp(
      Number.isFinite(rawPadRight) ? rawPadRight : Math.max(8, backgroundWidth * 0.08),
      4,
      Math.max(10, backgroundWidth * 0.25)
    )
    const maxTotalWidth = backgroundBounds
      ? Math.max(20, (backgroundBounds.right - backgroundBounds.left) - padLeft - padRight)
      : Math.max(20, backgroundWidth - padLeft - padRight)
    const rawIntDecGap = Number((anchors as any).intDecGap)
    const intDecGap = Number.isFinite(rawIntDecGap)
      ? deps.clamp(rawIntDecGap, deps.priceIntegerDecimalGapPx, 60)
      : deps.priceIntegerDecimalGapPx
    const intX = Number.isFinite(Number((anchors as any).intX)) ? Number((anchors as any).intX) : 0
    const intY = Number.isFinite(Number((anchors as any).intY)) ? Number((anchors as any).intY) : Number(integer.top || 0)
    const decY = Number.isFinite(Number((anchors as any).decY)) ? Number((anchors as any).decY) : Number(decimal.top || intY)
    const unitY = Number.isFinite(Number((anchors as any).unitY)) ? Number((anchors as any).unitY) : Number(unit?.top || decY)
    const unitVisible = deps.isObjectShownForBounds(unit) && String(unit?.text || '').trim().length > 0
    const unitCenterOffsetX = Number((anchors as any).unitCenterOffsetX)
    const rawCurrencyOffsetX = Number((anchors as any).currencyOffsetX)
    const rawCurrencyOffsetY = Number((anchors as any).currencyOffsetY)
    const currencyOffsetX = Number.isFinite(rawCurrencyOffsetX) ? deps.clamp(rawCurrencyOffsetX, -120, 120) : 0
    const currencyOffsetY = Number.isFinite(rawCurrencyOffsetY) ? deps.clamp(rawCurrencyOffsetY, -120, 120) : 0
    const currencyOriginX = typeof (anchors as any).currencyOriginX === 'string'
      ? String((anchors as any).currencyOriginX)
      : String(currency?.originX || 'center')
    const currencyOriginY = typeof (anchors as any).currencyOriginY === 'string'
      ? String((anchors as any).currencyOriginY)
      : String(currency?.originY || 'center')

    let currencyGap = Number((anchors as any).currencyGap)
    if (!Number.isFinite(currencyGap)) currencyGap = Math.max(2, backgroundWidth * 0.018)
    const applyUnitHorizontalAnchor = () => {
      if (!unit || !unitVisible || !Number.isFinite(unitCenterOffsetX)) return
      const decimalBounds = deps.getObjectHorizontalBoundsLocal(decimal)
      if (!decimalBounds) return
      const decimalCenterX = (decimalBounds.left + decimalBounds.right) / 2
      unit.set?.({
        originX: 'center',
        originY: 'center',
        left: decimalCenterX + unitCenterOffsetX,
        top: unitY
      })
      unit.initDimensions?.()
    }

    deps.layoutPrice({
      priceInteger: integer,
      priceDecimal: decimal,
      priceUnit: unitVisible ? unit : undefined,
      intX,
      intY,
      decY,
      unitY,
      gapPx: intDecGap,
      minGapPx: intDecGap,
      maxGapPx: intDecGap
    })
    applyUnitHorizontalAnchor()

    const chain = [integer, decimal, unitVisible ? unit : null].filter(Boolean) as any[]
    const chainBounds = deps.measureHorizontalBoundsLocal(chain)
    const hasCurrencyCircle = !!(currencyCircle && deps.isObjectShownForBounds(currencyCircle))
    if (currency && chainBounds) {
      if (hasCurrencyCircle) {
        currency.set?.({
          originX: currencyOriginX,
          originY: currencyOriginY,
          left: Number(currencyCircle?.left || 0) + currencyOffsetX,
          top: Number(currencyCircle?.top || 0) + currencyOffsetY
        })
        currency.initDimensions?.()
      } else {
        currency.set?.({
          originX: 'left',
          originY: 'center',
          left: chainBounds.left - currencyGap - getWidth(currency),
          top: Number.isFinite(Number((anchors as any).currencyY))
            ? Number((anchors as any).currencyY)
            : Number(integer.top || intY)
        })
      }
    }

    const full = [currency, ...chain].filter((object: any) => deps.isObjectShownForBounds(object))
    const targetCenterX = Number.isFinite(Number((anchors as any).targetCenterX))
      ? Number((anchors as any).targetCenterX)
      : 0
    const fitTargets = hasCurrencyCircle ? chain : full
    const recenterTargets = hasCurrencyCircle ? chain : full
    const maxFitW = hasCurrencyCircle && currency
      ? Math.max(12, maxTotalWidth - Math.max(0, getWidth(currency)) - Math.max(0, currencyGap))
      : maxTotalWidth
    centerObjectsX(recenterTargets, targetCenterX)
    fitChainToWidth(fitTargets, maxFitW, minScale)
    centerObjectsX(recenterTargets, targetCenterX)
    applyUnitHorizontalAnchor()

    if (backgroundBounds) {
      if (hasCurrencyCircle) {
        const rightLimit = backgroundBounds.right - padRight
        const circleBounds = deps.getObjectHorizontalBoundsLocal(currencyCircle)
        const circleRight = circleBounds ? circleBounds.right : (backgroundBounds.left + padLeft)
        const leftLimit = Math.max(backgroundBounds.left + padLeft, circleRight + Math.max(2, currencyGap))

        let chainFitBounds = deps.measureHorizontalBoundsLocal(chain)
        const availableChainWidth = Math.max(8, rightLimit - leftLimit)
        if (chainFitBounds && chainFitBounds.width > availableChainWidth) {
          fitChainToWidth(chain, availableChainWidth, minScale)
          chainFitBounds = deps.measureHorizontalBoundsLocal(chain)
        }
        if (chainFitBounds) {
          let dx = 0
          if (chainFitBounds.left < leftLimit) dx += (leftLimit - chainFitBounds.left)
          if ((chainFitBounds.right + dx) > rightLimit) dx += (rightLimit - (chainFitBounds.right + dx))
          if (Math.abs(dx) > 0.001) {
            chain.forEach((object: any) => object?.set?.({ left: Number(object.left || 0) + dx }))
          }
        }
      } else {
        const bounds = deps.measureHorizontalBoundsLocal(full)
        if (bounds) {
          const leftLimit = backgroundBounds.left + padLeft
          const rightLimit = backgroundBounds.right - padRight
          let dx = 0
          if (bounds.left < leftLimit) dx += (leftLimit - bounds.left)
          if ((bounds.right + dx) > rightLimit) dx += (rightLimit - (bounds.right + dx))
          if (Math.abs(dx) > 0.001) {
            full.forEach((object: any) => object?.set?.({ left: Number(object.left || 0) + dx }))
          }
        }
      }
    }
    applyUnitHorizontalAnchor()

    if (currency && hasCurrencyCircle) {
      currency.set?.({
        originX: currencyOriginX,
        originY: currencyOriginY,
        left: Number(currencyCircle?.left || 0) + currencyOffsetX,
        top: Number(currencyCircle?.top || 0) + currencyOffsetY
      })
      currency.initDimensions?.()
    }

    if (currency && hasCurrencyCircle) {
      const chainFitBounds = deps.measureHorizontalBoundsLocal(chain)
      const circleBounds = deps.getObjectHorizontalBoundsLocal(currencyCircle)
      if (chainFitBounds && circleBounds) {
        const minChainLeft = circleBounds.right + Math.max(2, currencyGap)
        if (chainFitBounds.left < minChainLeft) {
          const dx = minChainLeft - chainFitBounds.left
          chain.forEach((object: any) => object?.set?.({ left: Number(object.left || 0) + dx }))
        }
      }
    }

    deps.constrainSinglePriceTextInsideBackground(priceGroup)
    const parts = priceGroup.getObjects?.() || []
    parts.forEach((object: any) => object?.setCoords?.())
    priceGroup.dirty = true
    priceGroup.setCoords?.()
  }

  const fitManualAtacarejoValuesIntoTemplate = (priceGroup: any) => {
    if (!priceGroup || typeof priceGroup.getObjects !== 'function') return
    if (!deps.shouldPreserveManualTemplateVisual(priceGroup)) return

    const all = deps.collectObjectsDeep(priceGroup)
    const retailBg = deps.findByName(all, 'atac_retail_bg')
    const wholesaleBg = deps.findByName(all, 'atac_wholesale_bg')
    const bannerBg = deps.findByName(all, 'atac_banner_bg')
    if (!retailBg) return

    const normalizeTemplateScale = (raw: any, fallback: any, min = 0.12, max = 3.2) => {
      const fallbackNum = Number(fallback)
      const safeFallback = Number.isFinite(fallbackNum) && Math.abs(fallbackNum) > 0 ? fallbackNum : 1
      const parsed = Number(raw)
      if (!Number.isFinite(parsed) || parsed === 0) return safeFallback
      const sign = parsed < 0 ? -1 : 1
      return sign * deps.clamp(Math.abs(parsed), min, max)
    }
    const preserveAuthoredChildTransforms = (priceGroup as any).__preserveManualLayout === true
    const getWidth = (object: any) => (object && typeof object.getScaledWidth === 'function') ? Number(object.getScaledWidth()) : 0
    type AtacValueVariantKey = 'tiny' | 'normal' | 'large'
    type AtacValueVariantConfig = {
      chainWidthRatio: number
      minScale: number
      intDecimalGap: number
      currencyGapRatio: number
      packWidthRatio: number
    }
    const defaultVariants: Record<AtacValueVariantKey, AtacValueVariantConfig> = {
      tiny: {
        chainWidthRatio: 0.48,
        minScale: 0.62,
        intDecimalGap: deps.priceIntegerDecimalGapPx,
        currencyGapRatio: 0.02,
        packWidthRatio: 0.86
      },
      normal: {
        chainWidthRatio: 0.64,
        minScale: 0.56,
        intDecimalGap: deps.priceIntegerDecimalGapPx,
        currencyGapRatio: 0.024,
        packWidthRatio: 0.9
      },
      large: {
        chainWidthRatio: 0.82,
        minScale: 0.44,
        intDecimalGap: deps.priceIntegerDecimalGapPx,
        currencyGapRatio: 0.03,
        packWidthRatio: 0.95
      }
    }
    const asFinite = (value: any, fallback: number) => {
      const number = Number(value)
      return Number.isFinite(number) ? number : fallback
    }
    const getIntegerDigitsCount = (object: any) => {
      const raw = (String(object?.text ?? '').split(/[,.]/, 1)[0] || '').replace(/[^\d]/g, '')
      const normalized = raw.replace(/^0+(?=\d)/, '')
      return Math.max(1, normalized.length || raw.length || 1)
    }
    const resolveVariantKey = (digitsCount: number): AtacValueVariantKey => {
      if (digitsCount <= 1) return 'tiny'
      if (digitsCount === 2) return 'normal'
      return 'large'
    }
    const getMergedVariant = (key: AtacValueVariantKey): AtacValueVariantConfig => {
      const fromTemplate = ((priceGroup as any).__atacValueVariants || {})?.[key] || {}
      const base = defaultVariants[key]
      return {
        chainWidthRatio: deps.clamp(asFinite(fromTemplate.chainWidthRatio, base.chainWidthRatio), 0.35, 0.95),
        minScale: deps.clamp(asFinite(fromTemplate.minScale, base.minScale), 0.30, 1),
        intDecimalGap: deps.clamp(asFinite(fromTemplate.intDecimalGap, base.intDecimalGap), -8, 60),
        currencyGapRatio: deps.clamp(asFinite(fromTemplate.currencyGapRatio, base.currencyGapRatio), 0.005, 0.08),
        packWidthRatio: deps.clamp(asFinite(fromTemplate.packWidthRatio, base.packWidthRatio), 0.55, 0.99)
      }
    }
    const getInnerWidth = (background: any, padRatio: number, minPad: number, maxPad: number) => {
      if (!background) return 0
      const backgroundWidth = Math.max(1, Number(background.width || 0) * Math.abs(Number(background.scaleX ?? 1) || 1))
      const pad = deps.clamp(backgroundWidth * padRatio, minPad, maxPad)
      return Math.max(8, backgroundWidth - (pad * 2))
    }
    const restoreBaseScale = (object: any) => {
      if (!object || typeof object.set !== 'function') return
      if (preserveAuthoredChildTransforms) {
        object.initDimensions?.()
        return
      }
      const scaleX = Number((object as any).__originalScaleX)
      const scaleY = Number((object as any).__originalScaleY)
      object.set({
        scaleX: normalizeTemplateScale(scaleX, Number(object.scaleX || 1)),
        scaleY: normalizeTemplateScale(scaleY, Number(object.scaleY || 1))
      })
      object.initDimensions?.()
    }
    const fitText = (object: any, maxWidth: number, minimumScale: number) => {
      if (!object || !Number.isFinite(maxWidth) || maxWidth <= 0) return
      restoreBaseScale(object)
      const width = getWidth(object)
      if (!width || width <= maxWidth) return
      const scale = deps.clamp(maxWidth / width, minimumScale, 1)
      object.set?.({
        scaleX: Number(object.scaleX || 1) * scale,
        scaleY: Number(object.scaleY || 1) * scale
      })
    }
    const fitChain = (objects: any[], maxWidth: number, minimumScale: number) => {
      const shown = (objects || []).filter((object: any) => deps.isObjectShownForBounds(object))
      if (!shown.length || !Number.isFinite(maxWidth) || maxWidth <= 0) return
      shown.forEach((object: any) => restoreBaseScale(object))
      const bounds = deps.measureHorizontalBoundsLocal(shown)
      if (!bounds || bounds.width <= maxWidth) return
      const scale = deps.clamp(maxWidth / bounds.width, minimumScale, 1)
      shown.forEach((object: any) => object?.set?.({
        scaleX: Number(object.scaleX || 1) * scale,
        scaleY: Number(object.scaleY || 1) * scale
      }))
    }
    const centerObjectsX = (objects: any[], centerX = 0) => {
      if (!Array.isArray(objects) || !objects.length) return
      const bounds = deps.measureHorizontalBoundsLocal(objects)
      if (!bounds) return
      const currentCenter = (bounds.left + bounds.right) / 2
      const dx = centerX - currentCenter
      if (Math.abs(dx) < 0.001) return
      objects.forEach((object: any) => object?.set?.({ left: Number(object.left || 0) + dx }))
    }
    const applyTierVariant = (options: {
      bg: any
      currency: any
      integer: any
      decimal: any
      rich?: any
      unit: any
      pack: any
    }) => {
      const { bg, currency, integer, decimal, rich, unit, pack } = options
      if (!bg || (!rich && (!integer || !decimal))) return

      const valueText = rich || integer
      const variant = getMergedVariant(resolveVariantKey(getIntegerDigitsCount(valueText)))
      const maxWidth = getInnerWidth(bg, 0.075, 12, 34)
      restoreBaseScale(integer)
      restoreBaseScale(decimal)
      restoreBaseScale(rich)
      restoreBaseScale(unit)
      restoreBaseScale(currency)

      const intY = Number(valueText?.top || 0)
      const decY = Number(decimal?.top || intY)
      const unitY = Number(unit?.top || decY)
      const unitVisible = deps.isObjectShownForBounds(unit)

      if (rich && deps.isRichPriceTextObject(rich)) {
        rich.set?.({ originX: 'left', originY: 'center', left: 0, top: intY })
        if (unitVisible) {
          deps.positionRichPriceUnit(rich, unit, unitY)
        }
      } else {
        deps.layoutPrice({
          priceInteger: integer,
          priceDecimal: decimal,
          priceUnit: unitVisible ? unit : undefined,
          intX: 0,
          intY,
          decY,
          unitY,
          gapPx: variant.intDecimalGap,
          minGapPx: variant.intDecimalGap,
          maxGapPx: variant.intDecimalGap
        })
      }

      const chain = [valueText, rich ? null : decimal, unitVisible ? unit : null].filter(Boolean) as any[]
      const chainBounds = deps.measureHorizontalBoundsLocal(chain)
      if (currency && chainBounds) {
        const currencyGap = Math.max(2, maxWidth * variant.currencyGapRatio)
        currency.set?.({
          originX: 'left',
          originY: 'center',
          left: chainBounds.left - currencyGap - getWidth(currency)
        })
      }

      const full = [currency, ...chain].filter((object: any) => deps.isObjectShownForBounds(object))
      centerObjectsX(full, 0)
      fitChain(full, maxWidth, variant.minScale)
      centerObjectsX(full, 0)
      if (rich && unitVisible) deps.positionRichPriceUnit(rich, unit, unitY)

      if (pack && deps.isObjectShownForBounds(pack)) {
        fitText(pack, maxWidth * variant.packWidthRatio, 0.50)
      }
    }

    const retailCurrency = deps.findByName(all, 'retail_currency_text')
    const retailInteger = deps.findByName(all, 'retail_integer_text')
    const retailDecimal = deps.findByName(all, 'retail_decimal_text')
    const retailRichPrice = deps.findByName(all, 'retail_price_text')
    const retailUnit = deps.findByName(all, 'retail_unit_text')
    const retailPack = deps.findByName(all, 'retail_pack_line_text')
    const wholesaleCurrency = deps.findByName(all, 'wholesale_currency_text')
    const wholesaleInteger = deps.findByName(all, 'wholesale_integer_text')
    const wholesaleDecimal = deps.findByName(all, 'wholesale_decimal_text')
    const wholesaleRichPrice = deps.findByName(all, 'wholesale_price_text')
    const wholesaleUnit = deps.findByName(all, 'wholesale_unit_text')
    const wholesalePack = deps.findByName(all, 'wholesale_pack_line_text')
    const bannerText = deps.findByName(all, 'wholesale_banner_text')

    const retailInnerWidth = getInnerWidth(retailBg, 0.075, 12, 34)
    const wholesaleInnerWidth = getInnerWidth(wholesaleBg, 0.075, 12, 34)
    const bannerInnerWidth = getInnerWidth(bannerBg, 0.060, 8, 28)

    applyTierVariant({
      bg: retailBg,
      currency: retailCurrency,
      integer: retailInteger,
      decimal: retailDecimal,
      rich: retailRichPrice,
      unit: retailUnit,
      pack: retailPack
    })
    applyTierVariant({
      bg: wholesaleBg,
      currency: wholesaleCurrency,
      integer: wholesaleInteger,
      decimal: wholesaleDecimal,
      rich: wholesaleRichPrice,
      unit: wholesaleUnit,
      pack: wholesalePack
    })

    fitText(retailPack, retailInnerWidth, 0.50)
    fitText(wholesalePack, wholesaleInnerWidth, 0.50)
    fitText(bannerText, bannerInnerWidth, 0.50)
  }

  return {
    fitManualSinglePriceValuesIntoTemplate,
    fitManualAtacarejoValuesIntoTemplate
  }
}
