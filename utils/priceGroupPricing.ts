type PriceGroupPricingDeps = {
  applyFardoSpecialPricingToPriceGroup: (group: any, data: any) => void
  migratePriceGroupToRichText?: (group: any) => void
  applyRichPriceTextValue: (object: any, rawPrice: unknown) => string | null
  collectObjectsDeep: (object: any) => any[]
  repairAtacarejoTextNames: (objects: any[]) => void
  findByName: (objects: any[], name: string) => any
  setVisible: (object: any, visible: boolean) => void
  getAvailablePrices: (data: any) => any
  formatPriceValue: (value: any) => any
  getSpecialConditionFromProduct: (data: any) => any
  splitPriceParts: (value: any) => { integer: string; dec: string }
  setText: (object: any, text: string) => void
  inferUnitLabelFromProduct: (data: any) => string
  parsePriceToCents: (value: any) => number | null
  formatCentsToPrice: (value: number) => string | null
  computePackLine: (options: any) => string | null
  shouldPreserveManualTemplateVisual: (object: any) => boolean
  fitManualAtacarejoValuesIntoTemplate: (object: any) => void
  safeAddWithUpdate: (parent: any, child?: any) => any
}

export const createPriceGroupPricing = (deps: PriceGroupPricingDeps) => {
  const applyAtacarejoPricingToPriceGroup = (priceGroup: any, data: any) => {
    if (!priceGroup || typeof priceGroup.getObjects !== 'function') return
    deps.migratePriceGroupToRichText?.(priceGroup)
    if (data?.offerFormat === 'wholesale-pack-v1' || (priceGroup as any).__atacarejoLabelVariant === 'fardo-special-v1') {
      deps.applyFardoSpecialPricingToPriceGroup(priceGroup, data)
      return
    }

    const all = deps.collectObjectsDeep(priceGroup)
    const byName = (name: string) => all.filter((object: any) => object?.name === name)
    deps.repairAtacarejoTextNames(all)

    const retailBg = deps.findByName(all, 'atac_retail_bg')
    const bannerBg = deps.findByName(all, 'atac_banner_bg')
    const wholesaleBg = deps.findByName(all, 'atac_wholesale_bg')
    if (!retailBg) return

    const retailCurrency = deps.findByName(all, 'retail_currency_text')
    const retailInteger = deps.findByName(all, 'retail_integer_text')
    const retailDecimal = deps.findByName(all, 'retail_decimal_text')
    const retailRichPrice = deps.findByName(all, 'retail_price_text')
    const retailUnit = deps.findByName(all, 'retail_unit_text')
    const retailPack = deps.findByName(all, 'retail_pack_line_text')
    const bannerText = deps.findByName(all, 'wholesale_banner_text')
    const wholesaleCurrency = deps.findByName(all, 'wholesale_currency_text')
    const wholesaleInteger = deps.findByName(all, 'wholesale_integer_text')
    const wholesaleDecimal = deps.findByName(all, 'wholesale_decimal_text')
    const wholesaleRichPrice = deps.findByName(all, 'wholesale_price_text')
    const wholesaleUnit = deps.findByName(all, 'wholesale_unit_text')
    const wholesalePack = deps.findByName(all, 'wholesale_pack_line_text')

    const legacySinglePriceNames = [
      'price_unit_text',
      'priceUnit',
      'price_unit',
      'price_integer_text',
      'priceInteger',
      'price_integer',
      'price_decimal_text',
      'priceDecimal',
      'price_decimal',
      'price_currency_text',
      'price_currency',
      'priceSymbol',
      'price_value_text',
      'smart_price'
    ]
    legacySinglePriceNames.forEach((name) => {
      byName(name).forEach((object: any) => deps.setVisible(object, false))
    })

    const availablePrices = deps.getAvailablePrices(data)
    const prices = availablePrices.prices
    const formatOrNull = (value: any): string | null => {
      const formatted = deps.formatPriceValue(value)
      return formatted ? formatted : null
    }
    const retailUnitPrice = formatOrNull(data?.priceUnit)
    const retailPackPriceExplicit = formatOrNull(data?.pricePack)
    const specialUnitPrice = formatOrNull(data?.priceSpecialUnit)
    const specialPackPriceExplicit = formatOrNull(data?.priceSpecial)
    const legacyRetailPrice = formatOrNull(data?.price)
    const legacyWholesalePrice = formatOrNull(data?.priceWholesale)
    const firstRetailPrice = prices.find((price: any) => price.type === 'main' || price.type === 'pack')?.value
    const firstWholesalePrice = prices.find((price: any) => price.type === 'special')?.value

    const retailPrice = retailUnitPrice
      || retailPackPriceExplicit
      || firstRetailPrice
      || legacyRetailPrice
      || null
    let wholesalePrice = specialUnitPrice
      || specialPackPriceExplicit
      || firstWholesalePrice
      || legacyWholesalePrice
      || null
    const condition = availablePrices.condition ?? deps.getSpecialConditionFromProduct(data)

    if (retailPrice && wholesalePrice && retailPrice === wholesalePrice && !condition) {
      wholesalePrice = null
    }

    const hasRetail = !!retailPrice
    const hasWholesale = !!wholesalePrice
    const hasCondition = !!condition
    const showBanner = (hasRetail && hasWholesale) || (hasCondition && (hasRetail || hasWholesale))
    deps.setVisible(bannerBg, showBanner)
    deps.setVisible(bannerText, showBanner)
    deps.setVisible(wholesaleBg, hasWholesale)
    deps.setVisible(wholesaleCurrency, hasWholesale)
    deps.setVisible(wholesaleInteger, hasWholesale)
    deps.setVisible(wholesaleDecimal, hasWholesale)
    deps.setVisible(wholesaleRichPrice, hasWholesale)
    deps.setVisible(wholesaleUnit, hasWholesale)
    deps.setVisible(wholesalePack, hasWholesale)
    deps.setVisible(retailBg, hasRetail || !hasWholesale)
    deps.setVisible(retailCurrency, hasRetail || !hasWholesale)
    deps.setVisible(retailInteger, hasRetail || !hasWholesale)
    deps.setVisible(retailDecimal, hasRetail || !hasWholesale)
    deps.setVisible(retailRichPrice, hasRetail || !hasWholesale)
    deps.setVisible(retailUnit, hasRetail || !hasWholesale)
    deps.setVisible(retailPack, hasRetail || !hasWholesale)

    const hideWholesaleTier = !hasWholesale
    const hideRetailTier = !(hasRetail || !hasWholesale)
    if (hideWholesaleTier) {
      all.forEach((object: any) => {
        const name = String(object?.name || '')
        if (name.startsWith('wholesale_') && name !== 'wholesale_banner_text') {
          deps.setVisible(object, false)
        }
      })
    }
    if (hideRetailTier) {
      all.forEach((object: any) => {
        const name = String(object?.name || '')
        if (name.startsWith('retail_')) {
          deps.setVisible(object, false)
        }
      })
    }

    if (retailCurrency && (!retailCurrency.text || String(retailCurrency.text).trim().length === 0)) deps.setText(retailCurrency, 'R$')
    if (wholesaleCurrency && (!wholesaleCurrency.text || String(wholesaleCurrency.text).trim().length === 0)) deps.setText(wholesaleCurrency, 'R$')
    if (hasRetail || !hasWholesale) {
      const parts = deps.splitPriceParts(retailPrice)
      if (retailRichPrice) deps.applyRichPriceTextValue(retailRichPrice, retailPrice)
      else {
        deps.setText(retailInteger, parts.integer)
        deps.setText(retailDecimal, `,${parts.dec}`)
      }
    }
    if (hasWholesale) {
      const parts = deps.splitPriceParts(wholesalePrice)
      if (wholesaleRichPrice) deps.applyRichPriceTextValue(wholesaleRichPrice, wholesalePrice)
      else {
        deps.setText(wholesaleInteger, parts.integer)
        deps.setText(wholesaleDecimal, `,${parts.dec}`)
      }
    }

    const unitLabel = deps.inferUnitLabelFromProduct(data)
    if (retailUnit) deps.setText(retailUnit, unitLabel)
    if (wholesaleUnit) deps.setText(wholesaleUnit, unitLabel)

    const explicitPackExists = !!(retailPackPriceExplicit || specialPackPriceExplicit)
    const packageLabel = String(data?.packageLabel ?? data?.wholesaleTriggerUnit ?? '').trim().toUpperCase().replace(/\s+/g, '')
      || (explicitPackExists ? 'CX' : '')
    const packQuantity = Number.parseInt(String(data?.packQuantity ?? '').replace(/[^\d]/g, ''), 10)
    const packUnit = String(data?.packUnit ?? '').trim().toUpperCase().replace(/\s+/g, '')
    const derivePackPrice = (price: string | null): string | null => {
      const cents = deps.parsePriceToCents(price)
      return cents !== null && Number.isFinite(packQuantity) && packQuantity > 0
        ? deps.formatCentsToPrice(cents * packQuantity)
        : null
    }
    const resolvePackLinePrice = (options: {
      unitPrice: string | null
      explicitPackPrice: string | null
      displayedPrice: string | null
      canDerive: boolean
    }): string | null => {
      if (options.explicitPackPrice && options.unitPrice && options.explicitPackPrice !== options.unitPrice) {
        return options.explicitPackPrice
      }
      if (options.explicitPackPrice || !options.canDerive) return null
      return derivePackPrice(options.displayedPrice)
    }
    const retailPackPrice = resolvePackLinePrice({
      unitPrice: retailUnitPrice,
      explicitPackPrice: retailPackPriceExplicit,
      displayedPrice: retailPrice,
      canDerive: !retailPackPriceExplicit && !!retailPrice
    })
    const wholesalePackPrice = resolvePackLinePrice({
      unitPrice: specialUnitPrice,
      explicitPackPrice: specialPackPriceExplicit,
      displayedPrice: wholesalePrice,
      canDerive: !specialPackPriceExplicit && !!wholesalePrice
    })
    const retailPackLine = deps.computePackLine({ packageLabel, packQuantity, packUnit, packPrice: retailPackPrice, itemUnit: unitLabel })
    const wholesalePackLine = deps.computePackLine({ packageLabel, packQuantity, packUnit, packPrice: wholesalePackPrice, itemUnit: unitLabel })

    if (retailPack) {
      const text = retailPackLine || ''
      deps.setText(retailPack, text)
      deps.setVisible(retailPack, !!text)
    }
    if (wholesalePack) {
      const text = wholesalePackLine || ''
      deps.setText(wholesalePack, text)
      deps.setVisible(wholesalePack, !!text)
    }

    if (bannerText) {
      let bannerLabel = 'ATACADO'
      if (condition) {
        let cleanCondition = condition.toUpperCase().trim()
        cleanCondition = cleanCondition.replace(/[.;,]+$/, '').trim()
        const conditionMatch = cleanCondition.match(/(?:ACIMA\s+DE\s+|A\s+PARTIR\s+DE\s+|MIN\.?\s*)(\d+)\s*(.+)/i)
        if (conditionMatch) {
          const quantity = conditionMatch[1]
          let unit = (conditionMatch[2] ?? '').trim().replace(/\.+$/, '')
          const unitNormalization: Record<string, string> = {
            UNIDADES: 'UN', UNIDADE: 'UN', UND: 'UN', UN: 'UN',
            FARDOS: 'FD', FARDO: 'FD', FD: 'FD',
            CAIXAS: 'CX', CAIXA: 'CX', CX: 'CX',
            PACOTES: 'PCT', PACOTE: 'PCT', PCT: 'PCT'
          }
          unit = unitNormalization[unit.toUpperCase()] || unit
          bannerLabel = `ACIMA ${quantity} ${unit}`
        } else {
          bannerLabel = cleanCondition
        }
      } else {
        const trigger = data?.wholesaleTrigger
        const triggerNumber = typeof trigger === 'number' ? trigger : Number.parseInt(String(trigger ?? '').replace(/[^\d]/g, ''), 10)
        const unitToken = String(data?.wholesaleTriggerUnit ?? packageLabel ?? '').trim().toUpperCase().replace(/\s+/g, '')
        if (Number.isFinite(triggerNumber) && triggerNumber > 0 && unitToken) {
          bannerLabel = `ACIMA ${triggerNumber} ${unitToken}`
        }
      }
      deps.setText(bannerText, `\u2605 ${bannerLabel} \u2605`)
    }

    const preserveTemplateVisual = deps.shouldPreserveManualTemplateVisual(priceGroup)
    const forceCanonicalAtac = (priceGroup as any)?.__forceAtacarejoCanonical === true
    if (preserveTemplateVisual && !forceCanonicalAtac) {
      deps.fitManualAtacarejoValuesIntoTemplate(priceGroup)
      const parts = typeof priceGroup.getObjects === 'function' ? (priceGroup.getObjects() || []) : []
      parts.forEach((object: any) => object?.setCoords?.())
      priceGroup.dirty = true
      priceGroup.setCoords?.()
    } else {
      deps.safeAddWithUpdate(priceGroup)
    }
  }

  return { applyAtacarejoPricingToPriceGroup }
}
