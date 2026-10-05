/** Shared wholesale/pack tier population for the manual editor and render adapters. */
export type FardoSpecialPricingDeps = {
  applyWholesaleReferenceProductData: (...args: any[]) => any
  collectObjectsDeep: (...args: any[]) => any[]
  repairAtacarejoTextNames: (...args: any[]) => any
  findByName: (...args: any[]) => any
  inferUnitLabelFromProduct: (...args: any[]) => any
  normalizeUnitForLabel: (...args: any[]) => any
  resolveWholesalePackPriceState: (...args: any[]) => any
  resolveFardoSpecialPriceState: (...args: any[]) => any
  WHOLESALE_REFERENCE_MARKER: string
  setVisible: (...args: any[]) => any
  applyRichPriceTextValue: (...args: any[]) => any
  splitPriceParts: (...args: any[]) => any
  setText: (...args: any[]) => any
  formatPriceValue: (...args: any[]) => any
  reflowWholesaleReferencePriceLabel: (...args: any[]) => any
  shouldPreserveManualTemplateVisual: (...args: any[]) => any
  fitManualAtacarejoValuesIntoTemplate: (...args: any[]) => any
  safeAddWithUpdate: (...args: any[]) => any
}
export const createFardoSpecialPricing = (deps: FardoSpecialPricingDeps) => {
  const applyFardoSpecialPricingToPriceGroup = (pg: any, data: any) => {
    if (!pg || typeof pg.getObjects !== 'function') return
    if (pg.getObjects().some((node: any) => node.name === deps.WHOLESALE_REFERENCE_MARKER)) {
        deps.applyWholesaleReferenceProductData(pg, data)
        return
    }
    const all = deps.collectObjectsDeep(pg)
    deps.repairAtacarejoTextNames(all)
    const byName = (name: string) => all.filter((o: any) => o?.name === name)
    const find = (name: string) => deps.findByName(all, name)

    const retailBg = find('atac_retail_bg')
    if (!retailBg) return
    const bannerBg = find('atac_banner_bg')
    const wholesaleBg = find('atac_wholesale_bg')
    const configuredDisplayUnit = String((pg as any).__atacDisplayUnit || 'UND').trim()
    const inferredProductUnit = deps.inferUnitLabelFromProduct(data)
    const configuredUnitNorm = deps.normalizeUnitForLabel(configuredDisplayUnit)
    const displayUnit = inferredProductUnit && configuredUnitNorm === 'UN'
        ? inferredProductUnit
        : configuredDisplayUnit
    const state = data?.offerFormat === 'wholesale-pack-v1'
        ? deps.resolveWholesalePackPriceState(data)
        : deps.resolveFardoSpecialPriceState(data, {
        autoCollapseMissingPrices: (pg as any).__autoCollapseMissingPrices !== false,
        displayUnit,
        compactPackLine: (pg as any).__atacPackLineCompact !== false,
        derivePackPrice: true,
        keepBannerWhenNoCondition: (pg as any).__atacConditionFormat === 'always'
    })

    // A two-tier template can coexist with a previous single-price snapshot.
    // Hide those legacy nodes so a missing tier never leaves a stray value behind.
    ;[
        'price_unit_text', 'priceUnit', 'price_unit', 'price_integer_text', 'priceInteger',
        'price_integer', 'price_decimal_text', 'priceDecimal', 'price_decimal',
        'price_currency_text', 'price_currency', 'priceSymbol', 'price_value_text', 'smart_price'
    ].forEach((name) => byName(name).forEach((obj: any) => deps.setVisible(obj, false)))

    const retailCurrency = find('retail_currency_text')
    const retailInteger = find('retail_integer_text')
    const retailDecimal = find('retail_decimal_text')
    const retailRichPrice = find('retail_price_text')
    const retailUnit = find('retail_unit_text')
    const retailPack = find('retail_pack_line_text')
    const wholesaleCurrency = find('wholesale_currency_text')
    const wholesaleInteger = find('wholesale_integer_text')
    const wholesaleDecimal = find('wholesale_decimal_text')
    const wholesaleRichPrice = find('wholesale_price_text')
    const wholesaleUnit = find('wholesale_unit_text')
    const wholesalePack = find('wholesale_pack_line_text')
    const bannerText = find('wholesale_banner_text')

    const setTier = (tier: any, visible: boolean, nodes: any[]) => {
        deps.setVisible(nodes[0], visible)
        nodes.slice(1).forEach((obj: any) => deps.setVisible(obj, visible && tier.hasValue))
    }
    setTier(state.retail, state.showRetail, [retailBg, retailCurrency, retailRichPrice || retailInteger, ...(retailRichPrice ? [] : [retailDecimal]), retailUnit, retailPack])
    setTier(state.special, state.showSpecial, [wholesaleBg, wholesaleCurrency, wholesaleRichPrice || wholesaleInteger, ...(wholesaleRichPrice ? [] : [wholesaleDecimal]), wholesaleUnit, wholesalePack])

    if (retailCurrency) deps.setText(retailCurrency, 'R$')
    if (wholesaleCurrency) deps.setText(wholesaleCurrency, 'R$')
    if (state.retail.hasValue) {
        if (retailRichPrice) {
            deps.applyRichPriceTextValue(retailRichPrice, state.retail.price)
        } else {
            const parts = deps.splitPriceParts(state.retail.price)
            deps.setText(retailInteger, parts.integer)
            deps.setText(retailDecimal, `,${parts.dec}`)
        }
    }
    if (state.special.hasValue) {
        if (wholesaleRichPrice) {
            deps.applyRichPriceTextValue(wholesaleRichPrice, state.special.price)
        } else {
            const parts = deps.splitPriceParts(state.special.price)
            deps.setText(wholesaleInteger, parts.integer)
            deps.setText(wholesaleDecimal, `,${parts.dec}`)
        }
    }
    if (retailUnit) deps.setText(retailUnit, state.retail.unitText)
    if (wholesaleUnit) deps.setText(wholesaleUnit, state.special.unitText)
    if (retailPack) {
        deps.setText(retailPack, state.retail.packLine || '')
        deps.setVisible(retailPack, state.showRetail && !!state.retail.packLine)
    }
    if (wholesalePack) {
        deps.setText(wholesalePack, state.special.packLine || '')
        deps.setVisible(wholesalePack, state.showSpecial && !!state.special.packLine)
    }

    if (bannerBg) deps.setVisible(bannerBg, state.showBanner)
    if (bannerText) {
        deps.setText(bannerText, state.conditionText || 'OFERTA ESPECIAL')
        deps.setVisible(bannerText, state.showBanner)
    }

    // Ensure duplicated/unnamed tier children follow the same visibility rule.
    all.forEach((obj: any) => {
        const name = String(obj?.name || '')
        if (name.startsWith('retail_') && name !== 'retail_pack_line_text') {
            deps.setVisible(obj, state.showRetail && state.retail.hasValue)
        }
        if (name.startsWith('wholesale_') && name !== 'wholesale_banner_text' && name !== 'wholesale_pack_line_text') {
            deps.setVisible(obj, state.showSpecial && state.special.hasValue)
        }
    })
    if (retailPack) deps.setVisible(retailPack, state.showRetail && !!state.retail.packLine)
    if (wholesalePack) deps.setVisible(wholesalePack, state.showSpecial && !!state.special.packLine)

    const preserveTemplateVisual = deps.shouldPreserveManualTemplateVisual(pg)
    const referencePackaging = find(deps.WHOLESALE_REFERENCE_MARKER)
    if (referencePackaging) {
        const aliases: Record<string, string> = { CX: 'CAIXA', FD: 'FARDO', PCT: 'PACOTE', UN: 'UNIDADE' }
        const raw = String(data?.packageLabel || '').toUpperCase()
        const quantity = Number(data?.packQuantity)
        deps.setText(referencePackaging, [aliases[raw] || raw, quantity > 1 ? `C/ ${quantity} UNIDADES` : ''].filter(Boolean).join('\n'))
        deps.setText(retailPack, data?.pricePack && data?.priceUnit ? `UNID R$ ${deps.formatPriceValue(data.priceUnit)}` : '')
        deps.setText(wholesalePack, data?.priceSpecial && data?.priceSpecialUnit ? `UNID R$ ${deps.formatPriceValue(data.priceSpecialUnit)}` : '')
        deps.setVisible(retailPack, state.showRetail && !!data?.pricePack && !!data?.priceUnit)
        deps.setVisible(wholesalePack, state.showSpecial && !!data?.priceSpecial && !!data?.priceSpecialUnit)
        deps.setVisible(find('reference_retail_heading'), state.showRetail)
        deps.setVisible(find('reference_special_heading'), state.showSpecial)
        // Quando a referência lateral tiver apenas uma faixa, recolhe a área
        // da faixa ausente antes de medir o conteúdo. Assim a embalagem não
        // fica cortada e o preço especial não deixa um vão em branco.
        // Cada card decide individualmente se ainda precisa do selo
        // "CENSURADO". Ao preencher o preço promocional deste produto, a
        // faixa real aparece sem alterar os demais cards da página.
        deps.reflowWholesaleReferencePriceLabel(pg, { showCensored: data?.showCensored ?? !state.special.hasValue })
    }
    const forceCanonicalAtac = (pg as any).__forceAtacarejoCanonical === true
    if (preserveTemplateVisual && !forceCanonicalAtac && !referencePackaging) {
        deps.fitManualAtacarejoValuesIntoTemplate(pg)
    }
    all.forEach((obj: any) => obj?.setCoords?.())
    pg.dirty = true
    pg.setCoords?.()
    if (!referencePackaging) deps.safeAddWithUpdate(pg)

  }
  return { applyFardoSpecialPricingToPriceGroup }
}
