import { splitPriceParts, normalizeUnitForLabel } from './priceTagText'
import { applyRichPriceTextValue, migratePriceGroupToRichText } from './priceRichText'
import {
  FARDO_SPECIAL_PRICE_PALETTE,
  resolveFardoSpecialPricePalette
} from './fardoSpecialPriceHelpers'

type PriceGroupBuilderDeps = {
  fabric: () => any
  layoutPriceGroup: (priceGroup: any, cardW: number, cardH: number) => any
  applyAtacarejoPricingToPriceGroup: (priceGroup: any, data: any) => void
  safeAddWithUpdate: (parent: any, child?: any) => any
}

const getFabricOrThrow = (deps: PriceGroupBuilderDeps) => {
  const fabric = deps.fabric()
  if (!fabric) throw new Error('Fabric is not initialized')
  return fabric
}

export const createPriceGroupBuilders = (deps: PriceGroupBuilderDeps) => {
  function buildDefaultPriceGroupForCard(
    priceStr: string,
    cardW: number,
    cardH: number,
    top: number,
    unitText?: string
  ) {
    const fabric = getFabricOrThrow(deps)
    const pillH = cardH * 0.18
    const pillW = Math.min(cardW * 0.6, cardW - 10)
    const priceBg = new fabric.Rect({
      width: pillW,
      height: pillH,
      rx: pillH / 2,
      ry: pillH / 2,
      fill: '#000000',
      stroke: '#ff0000',
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      name: 'price_bg',
      shadow: new fabric.Shadow({ color: '#ff0000', blur: 12, offsetX: 0, offsetY: 0 })
    })
    const circleSize = pillH * 0.72
    const circleCenterX = -(pillW / 2) + (circleSize * 0.35)
    const currencyCircle = new fabric.Circle({
      radius: circleSize / 2,
      fill: '#FFFF00',
      originX: 'center',
      originY: 'center',
      left: circleCenterX,
      top: 0,
      name: 'price_currency_bg'
    })
    const currencyText = new fabric.Text('R$', {
      fontSize: circleSize * 0.32,
      fontFamily: 'Inter',
      fontWeight: 'bold',
      fill: '#000000',
      originX: 'center',
      originY: 'center',
      left: circleCenterX,
      top: 0,
      name: 'price_currency_text'
    })
    const parts = splitPriceParts(priceStr)
    const priceInteger = new fabric.IText(parts.integer, {
      fontSize: pillH * 0.72,
      fontFamily: 'Inter',
      fontWeight: '900',
      fill: '#ffffff',
      originX: 'left',
      originY: 'center',
      left: 0,
      top: 0,
      name: 'price_integer_text',
      __fontScale: 0.72,
      __yOffsetRatio: 0
    })
    const priceDecimal = new fabric.IText(`,${parts.dec}`, {
      fontSize: pillH * 0.42,
      fontFamily: 'Inter',
      fontWeight: '900',
      fill: '#ffffff',
      originX: 'left',
      originY: 'center',
      left: 0,
      top: 0,
      name: 'price_decimal_text',
      __fontScale: 0.42,
      __yOffsetRatio: -0.18
    })
    const unit = normalizeUnitForLabel(unitText)
    const priceUnit = new fabric.IText(unit, {
      fontSize: pillH * 0.26,
      fontFamily: 'Inter',
      fontWeight: '800',
      fill: '#ffffff',
      originX: 'right',
      originY: 'center',
      left: 0,
      top: 0,
      name: 'price_unit_text',
      __fontScale: 0.26,
      __yOffsetRatio: 0.22,
      visible: !!unit
    })
    const group = new fabric.Group([priceBg, currencyCircle, currencyText, priceInteger, priceDecimal, priceUnit], {
      originX: 'center',
      originY: 'center',
      left: 0,
      top,
      name: 'priceGroup'
    })
    migratePriceGroupToRichText(group, fabric)
    deps.layoutPriceGroup(group, cardW, cardH)
    return group
  }

  function buildBlackYellowPriceGroupForCard(
    priceStr: string,
    cardW: number,
    cardH: number,
    top: number,
    _unitText?: string
  ) {
    const fabric = getFabricOrThrow(deps)
    const pillH = cardH * 0.18
    const pillW = Math.min(cardW * 0.6, cardW - 10)
    const yellow = '#FDE047'
    const priceBg = new fabric.Rect({
      width: pillW,
      height: pillH,
      rx: pillH / 2,
      ry: pillH / 2,
      fill: '#000000',
      stroke: 'rgba(0,0,0,0)',
      strokeWidth: 0,
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      name: 'price_bg',
      __roundness: 1,
      __strokeWidth: 0
    })
    const circleSize = pillH * 0.72
    const circleCenterX = -(pillW / 2) + (circleSize * 0.35)
    const currencyCircle = new fabric.Circle({
      radius: circleSize / 2,
      fill: '#000000',
      originX: 'center',
      originY: 'center',
      left: circleCenterX,
      top: 0,
      name: 'price_currency_bg'
    })
    const currencyText = new fabric.Text('R$', {
      fontSize: circleSize * 0.30,
      fontFamily: 'Inter',
      fontWeight: '900',
      fill: yellow,
      originX: 'center',
      originY: 'center',
      left: circleCenterX,
      top: 0,
      name: 'price_currency_text'
    })
    const parts = splitPriceParts(priceStr)
    const priceInteger = new fabric.IText(parts.integer, {
      fontSize: pillH * 0.86,
      fontFamily: 'Inter',
      fontWeight: '900',
      fill: yellow,
      originX: 'left',
      originY: 'center',
      left: 0,
      top: 0,
      name: 'price_integer_text',
      __fontScale: 0.86,
      __yOffsetRatio: 0
    })
    const priceDecimal = new fabric.IText(`,${parts.dec}`, {
      fontSize: pillH * 0.55,
      fontFamily: 'Inter',
      fontWeight: '900',
      fill: yellow,
      originX: 'left',
      originY: 'center',
      left: 0,
      top: 0,
      name: 'price_decimal_text',
      __fontScale: 0.55,
      __yOffsetRatio: -0.30
    })
    const priceUnit = new fabric.IText('', {
      fontSize: pillH * 0.26,
      fontFamily: 'Inter',
      fontWeight: '800',
      fill: yellow,
      originX: 'right',
      originY: 'center',
      left: 0,
      top: 0,
      name: 'price_unit_text',
      __fontScale: 0.26,
      __yOffsetRatio: 0.22,
      visible: false
    })
    const group = new fabric.Group([priceBg, currencyCircle, currencyText, priceInteger, priceDecimal, priceUnit], {
      originX: 'center',
      originY: 'center',
      left: 0,
      top,
      name: 'priceGroup'
    })
    migratePriceGroupToRichText(group, fabric)
    deps.layoutPriceGroup(group, cardW, cardH)
    return group
  }

  function buildOfertaAmarelaPriceGroupForCard(
    priceStr: string,
    _cardW: number,
    _cardH: number,
    top: number,
    unitText?: string
  ) {
    const fabric = getFabricOrThrow(deps)
    const labelW = 300
    const labelH = 140
    const corner = 18
    const priceBg = new fabric.Rect({
      width: labelW,
      height: labelH,
      rx: corner,
      ry: corner,
      fill: '#FDE047',
      stroke: '#B91C1C',
      strokeWidth: 10,
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      name: 'price_bg',
      shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.22)', blur: 10, offsetX: 0, offsetY: 6 }),
      __roundness: (corner * 2) / labelH,
      __strokeWidth: 10
    })
    const headerW = labelW * 0.86
    const headerH = labelH * 0.26
    const headerY = -(labelH / 2) + (headerH / 2) + 12
    const offerHeaderBg = new fabric.Rect({
      width: headerW,
      height: headerH,
      rx: headerH * 0.28,
      ry: headerH * 0.28,
      fill: '#DC2626',
      stroke: '#7F1D1D',
      strokeWidth: Math.max(2, headerH * 0.10),
      originX: 'center',
      originY: 'center',
      left: 0,
      top: headerY,
      selectable: false,
      evented: false,
      name: 'offer_header_bg'
    })
    const offerHeaderText = new fabric.Text('OFERTA!', {
      fontSize: Math.max(18, headerH * 0.62),
      fontFamily: 'Inter',
      fontWeight: '900',
      fill: '#FDE047',
      originX: 'center',
      originY: 'center',
      left: 0,
      top: headerY + 1,
      selectable: true,
      evented: true,
      name: 'price_header_text',
      charSpacing: 120
    })
    const parts = splitPriceParts(priceStr)
    const priceAreaCenterY = 18
    const currencyText = new fabric.Text('R$', {
      fontSize: 32,
      fontFamily: 'Inter',
      fontWeight: '900',
      fill: '#B91C1C',
      originX: 'left',
      originY: 'center',
      left: -110,
      top: priceAreaCenterY + 4,
      name: 'price_currency_text'
    })
    const priceInteger = new fabric.IText(parts.integer, {
      fontSize: 86,
      fontFamily: 'Inter',
      fontWeight: '900',
      fill: '#B91C1C',
      originX: 'left',
      originY: 'center',
      left: -70,
      top: priceAreaCenterY + 8,
      name: 'price_integer_text',
      __fontScale: 0.66,
      __yOffsetRatio: 0.06
    })
    const priceDecimal = new fabric.IText(`,${parts.dec}`, {
      fontSize: 46,
      fontFamily: 'Inter',
      fontWeight: '900',
      fill: '#B91C1C',
      originX: 'left',
      originY: 'center',
      left: 40,
      top: priceAreaCenterY - 10,
      name: 'price_decimal_text',
      __fontScale: 0.35,
      __yOffsetRatio: -0.08
    })
    const unit = normalizeUnitForLabel(unitText)
    const priceUnit = new fabric.IText(unit || '', {
      fontSize: 20,
      fontFamily: 'Inter',
      fontWeight: '800',
      fill: '#B91C1C',
      originX: 'left',
      originY: 'center',
      left: 40,
      top: priceAreaCenterY + 34,
      name: 'price_unit_text',
      visible: false,
      __fontScale: 0.15,
      __yOffsetRatio: 0.26
    })
    const group = new fabric.Group([
      priceBg,
      offerHeaderBg,
      offerHeaderText,
      currencyText,
      priceInteger,
      priceDecimal,
      priceUnit
    ], {
      originX: 'center',
      originY: 'center',
      left: 0,
      top,
      name: 'priceGroup'
    })
    group.__preserveManualLayout = true
    group.__isCustomTemplate = true
    migratePriceGroupToRichText(group, fabric)
    deps.safeAddWithUpdate(group)
    return group
  }

  function buildBarlowBlackPriceGroupForCard(
    priceStr: string,
    _cardW: number,
    _cardH: number,
    top: number,
    unitText?: string
  ) {
    const fabric = getFabricOrThrow(deps)
    const labelW = 340
    const labelH = 130
    const corner = 32
    const priceBg = new fabric.Rect({
      width: labelW,
      height: labelH,
      rx: corner,
      ry: corner,
      fill: '#000000',
      stroke: 'rgba(0,0,0,0)',
      strokeWidth: 0,
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      name: 'price_bg',
      __roundness: (corner * 2) / labelH,
      __strokeWidth: 0
    })
    const circleSize = labelH * 0.5
    const circleCenterX = -(labelW / 2) + 38
    const currencyCircle = new fabric.Circle({
      radius: circleSize / 2,
      fill: '#000000',
      originX: 'center',
      originY: 'center',
      left: circleCenterX,
      top: 0,
      name: 'price_currency_bg',
      visible: false
    })
    const currencyText = new fabric.Text('R$', {
      fontSize: 38,
      fontFamily: 'Barlow',
      fontWeight: '900',
      fill: '#FFD600',
      originX: 'center',
      originY: 'center',
      left: -108,
      top: -6,
      name: 'price_currency_text'
    })
    const parts = splitPriceParts(priceStr)
    const priceInteger = new fabric.IText(parts.integer, {
      fontSize: 100,
      fontFamily: 'Barlow',
      fontWeight: '900',
      fill: '#ffffff',
      originX: 'left',
      originY: 'center',
      left: -60,
      top: 4,
      name: 'price_integer_text',
      __fontScale: 0.77,
      __yOffsetRatio: 0.03
    })
    const priceDecimal = new fabric.IText(`,${parts.dec}`, {
      fontSize: 60,
      fontFamily: 'Barlow',
      fontWeight: '900',
      fill: '#ffffff',
      originX: 'left',
      originY: 'center',
      left: 68,
      top: -12,
      name: 'price_decimal_text',
      __fontScale: 0.46,
      __yOffsetRatio: -0.09
    })
    const unit = normalizeUnitForLabel(unitText)
    const priceUnit = new fabric.IText(unit || '', {
      fontSize: 22,
      fontFamily: 'Barlow',
      fontWeight: '800',
      fill: '#ffffff',
      originX: 'left',
      originY: 'center',
      left: 68,
      top: 34,
      name: 'price_unit_text',
      visible: false,
      __fontScale: 0.17,
      __yOffsetRatio: 0.26
    })
    const group = new fabric.Group([priceBg, currencyCircle, currencyText, priceInteger, priceDecimal, priceUnit], {
      originX: 'center',
      originY: 'center',
      left: 0,
      top,
      name: 'priceGroup'
    })
    group.__preserveManualLayout = true
    group.__isCustomTemplate = true
    migratePriceGroupToRichText(group, fabric)
    deps.safeAddWithUpdate(group)
    return group
  }

  function buildRedBurstPriceGroupForCard(
    priceStr: string,
    cardW: number,
    cardH: number,
    top: number,
    unitText?: string
  ) {
    const fabric = getFabricOrThrow(deps)
    const labelW = Math.min(cardW * 0.97, 352)
    const labelH = Math.min(cardH * 0.47, 206)
    const corner = Math.max(14, labelH * 0.12)
    const fillRed = fabric?.Gradient
      ? new fabric.Gradient({
          type: 'linear',
          coords: { x1: 0, y1: 0, x2: labelW, y2: labelH },
          colorStops: [
            { offset: 0, color: '#7c0301' },
            { offset: 0.26, color: '#c80a06' },
            { offset: 0.58, color: '#f24612' },
            { offset: 0.82, color: '#c40a07' },
            { offset: 1, color: '#7e0201' }
          ]
        })
      : '#c40c08'
    const outerGlow = new fabric.Rect({
      width: labelW + 10,
      height: labelH + 10,
      rx: corner + 5,
      ry: corner + 5,
      fill: 'rgba(255,150,30,0.2)',
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      selectable: false,
      evented: false,
      name: 'price_burst_outer_glow'
    })
    const priceBg = new fabric.Rect({
      width: labelW,
      height: labelH,
      rx: corner,
      ry: corner,
      fill: fillRed,
      stroke: '#ffd24d',
      strokeWidth: Math.max(2, labelH * 0.015),
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      name: 'price_bg',
      shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.3)', blur: 13, offsetX: 0, offsetY: 8 }),
      __roundness: (corner * 2) / labelH
    })
    const innerBorder = new fabric.Rect({
      width: labelW * 0.97,
      height: labelH * 0.95,
      rx: Math.max(10, corner * 0.84),
      ry: Math.max(10, corner * 0.84),
      fill: 'transparent',
      stroke: 'rgba(255,255,255,0.26)',
      strokeWidth: Math.max(1, labelH * 0.008),
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      selectable: false,
      evented: false,
      name: 'price_inner_border'
    })
    const burstA = new fabric.Line([-labelW * 0.49, labelH * 0.28, labelW * 0.14, -labelH * 0.12], {
      stroke: 'rgba(255,230,130,0.24)',
      strokeWidth: Math.max(2, labelH * 0.018),
      selectable: false,
      evented: false,
      name: 'price_burst_line_a'
    })
    const burstB = new fabric.Line([-labelW * 0.18, labelH * 0.35, labelW * 0.48, labelH * 0.02], {
      stroke: 'rgba(255,118,38,0.4)',
      strokeWidth: Math.max(2, labelH * 0.022),
      selectable: false,
      evented: false,
      name: 'price_burst_line_b'
    })
    const burstC = new fabric.Circle({
      radius: Math.max(10, labelH * 0.1),
      fill: 'rgba(255,245,200,0.24)',
      originX: 'center',
      originY: 'center',
      left: labelW * 0.32,
      top: -labelH * 0.24,
      selectable: false,
      evented: false,
      name: 'price_burst_glow'
    })
    const centerGlow = new fabric.Ellipse({
      rx: labelW * 0.32,
      ry: labelH * 0.19,
      fill: 'rgba(255,170,70,0.12)',
      originX: 'center',
      originY: 'center',
      left: -labelW * 0.03,
      top: labelH * 0.08,
      selectable: false,
      evented: false,
      name: 'price_center_glow'
    })
    const headerW = labelW * 0.92
    const headerH = labelH * 0.27
    const headerY = -(labelH / 2) + headerH * 0.72
    const headerBg = new fabric.Rect({
      width: headerW,
      height: headerH,
      rx: headerH * 0.22,
      ry: headerH * 0.22,
      fill: fabric?.Gradient
        ? new fabric.Gradient({
            type: 'linear',
            coords: { x1: 0, y1: 0, x2: headerW, y2: 0 },
            colorStops: [
              { offset: 0, color: '#8d0200' },
              { offset: 0.52, color: '#d61009' },
              { offset: 1, color: '#870100' }
            ]
          })
        : '#a10703',
      stroke: '#f5cb45',
      strokeWidth: Math.max(1, headerH * 0.052),
      originX: 'center',
      originY: 'center',
      left: 0,
      top: headerY,
      name: 'price_header_bg',
      shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.28)', blur: 8, offsetX: 0, offsetY: 4 })
    })
    const headerHighlight = new fabric.Rect({
      width: headerW * 0.93,
      height: Math.max(4, headerH * 0.2),
      rx: headerH * 0.09,
      ry: headerH * 0.09,
      fill: 'rgba(255,240,208,0.46)',
      originX: 'center',
      originY: 'center',
      left: 0,
      top: headerY - (headerH * 0.3),
      selectable: false,
      evented: false,
      name: 'price_header_highlight'
    })
    const headerUnit = normalizeUnitForLabel(unitText)
    const hasHeaderUnit = !!headerUnit
    const headerText = new fabric.Textbox('FRALDINHA', {
      width: headerW * (hasHeaderUnit ? 0.76 : 0.86),
      fontSize: Math.max(18, headerH * 0.58),
      fontFamily: 'Inter',
      fontWeight: '900',
      textAlign: 'center',
      fill: '#ffd94c',
      originX: 'center',
      originY: 'center',
      left: hasHeaderUnit ? -headerW * 0.055 : 0,
      top: headerY + (headerH * 0.01),
      name: 'price_header_text',
      charSpacing: 20
    })
    const headerUnitText = new fabric.Text(headerUnit || 'KG', {
      fontSize: Math.max(16, headerH * 0.5),
      fontFamily: 'Inter',
      fontWeight: '900',
      fill: '#ffffff',
      originX: 'center',
      originY: 'center',
      left: headerW * 0.33,
      top: headerY + (headerH * 0.02),
      name: 'price_header_unit_text',
      visible: hasHeaderUnit
    })
    const parts = splitPriceParts(priceStr)
    const priceBaselineY = labelH * 0.2
    const currencyText = new fabric.Text('R$', {
      fontSize: Math.max(22, labelH * 0.21),
      fontFamily: 'Inter',
      fontWeight: '900',
      fill: '#ffffff',
      originX: 'center',
      originY: 'center',
      left: -(labelW / 2) + (labelW * 0.11),
      top: priceBaselineY + (labelH * 0.015),
      name: 'price_currency_text'
    })
    const integerX = -labelW * 0.02
    const priceInteger = new fabric.IText(parts.integer, {
      fontSize: Math.max(64, labelH * 0.82),
      fontFamily: 'Inter',
      fontWeight: '900',
      fill: '#ffffff',
      originX: 'center',
      originY: 'center',
      left: integerX,
      top: priceBaselineY + (labelH * 0.01),
      name: 'price_integer_text',
      __fontScale: 0.82,
      __yOffsetRatio: 0.01
    })
    const priceDecimal = new fabric.IText(`,${parts.dec}`, {
      fontSize: Math.max(30, labelH * 0.46),
      fontFamily: 'Inter',
      fontWeight: '900',
      fill: '#ffffff',
      originX: 'left',
      originY: 'center',
      left: integerX + (labelW * 0.145),
      top: priceBaselineY - (labelH * 0.145),
      name: 'price_decimal_text',
      __fontScale: 0.46,
      __yOffsetRatio: -0.145
    })
    const priceUnit = new fabric.IText(headerUnit || '', {
      fontSize: Math.max(12, labelH * 0.16),
      fontFamily: 'Inter',
      fontWeight: '800',
      fill: '#ffe07a',
      originX: 'left',
      originY: 'center',
      left: integerX + (labelW * 0.15),
      top: priceBaselineY + (labelH * 0.18),
      name: 'price_unit_text',
      visible: false,
      __fontScale: 0.16,
      __yOffsetRatio: 0.18
    })
    const group = new fabric.Group([
      outerGlow,
      priceBg,
      innerBorder,
      burstA,
      burstB,
      burstC,
      centerGlow,
      headerBg,
      headerHighlight,
      headerText,
      headerUnitText,
      currencyText,
      priceInteger,
      priceDecimal,
      priceUnit
    ], {
      originX: 'center',
      originY: 'center',
      left: 0,
      top,
      name: 'priceGroup'
    })
    group.__preserveManualLayout = true
    group.__isCustomTemplate = true
    migratePriceGroupToRichText(group, fabric)
    deps.safeAddWithUpdate(group)
    return group
  }

  function buildAtacarejoPriceGroupForCard(
    sample: any,
    cardW: number,
    cardH: number,
    top: number,
    options: {
      labelVariant?: string
      autoCollapseMissingPrices?: boolean
      displayUnit?: string
      packLineCompact?: boolean
      conditionFormat?: string
      palette?: Record<string, string>
    } = {}
  ) {
    const fabric = getFabricOrThrow(deps)
    const retailBg = new fabric.Rect({ width: 300, height: 60, rx: 10, ry: 10, fill: '#EF4444', originX: 'center', originY: 'center', left: 0, top: 0, name: 'atac_retail_bg' })
    const bannerBg = new fabric.Rect({ width: 300, height: 18, rx: 8, ry: 8, fill: '#FFFFFF', originX: 'center', originY: 'center', left: 0, top: 0, name: 'atac_banner_bg' })
    const wholesaleBg = new fabric.Rect({ width: 300, height: 60, rx: 10, ry: 10, fill: '#FDE047', originX: 'center', originY: 'center', left: 0, top: 0, name: 'atac_wholesale_bg' })
    const makeText = (text: string, fill: string, name: string, scale: number, options: Record<string, any> = {}) => new fabric.IText(text, {
      fontSize: options.fontSize ?? (name.includes('decimal') ? 24 : name.includes('pack') ? 12 : 14),
      fontFamily: 'Inter',
      fontWeight: '900',
      fill,
      originX: options.originX || 'left',
      originY: 'center',
      left: 0,
      top: 0,
      name,
      __fontScale: scale,
      ...(options.visible === undefined ? {} : { visible: options.visible })
    })
    const retailCurrency = makeText('R$', '#FFFFFF', 'retail_currency_text', 0.22)
    const retailInteger = makeText('0', '#FFFFFF', 'retail_integer_text', 0.60, { fontSize: 40 })
    const retailDecimal = makeText(',00', '#FFFFFF', 'retail_decimal_text', 0.36, { fontSize: 24 })
    const retailUnit = makeText('UN', '#FFFFFF', 'retail_unit_text', 0.22)
    const retailPack = makeText('', '#FFFFFF', 'retail_pack_line_text', 0.18, { originX: 'center', visible: false })
    const bannerText = makeText('ACIMA 10 FD', '#000000', 'wholesale_banner_text', 0.32, { fontSize: 12, originX: 'center' })
    const wholesaleCurrency = makeText('R$', '#000000', 'wholesale_currency_text', 0.22)
    const wholesaleInteger = makeText('0', '#000000', 'wholesale_integer_text', 0.60, { fontSize: 40 })
    const wholesaleDecimal = makeText(',00', '#000000', 'wholesale_decimal_text', 0.36, { fontSize: 24 })
    const wholesaleUnit = makeText('UN', '#000000', 'wholesale_unit_text', 0.22)
    const wholesalePack = makeText('', '#000000', 'wholesale_pack_line_text', 0.18, { originX: 'center', visible: false })
    const group = new fabric.Group([
      retailBg,
      bannerBg,
      wholesaleBg,
      retailCurrency,
      retailInteger,
      retailDecimal,
      retailUnit,
      retailPack,
      bannerText,
      wholesaleCurrency,
      wholesaleInteger,
      wholesaleDecimal,
      wholesaleUnit,
      wholesalePack
    ], {
      originX: 'center',
      originY: 'center',
      left: 0,
      top,
      name: 'priceGroup',
      __forceAtacarejoCanonical: true
    })

    if (options.labelVariant) {
      const makeRichPriceText = (text: string, fill: string, name: string) => {
        const rich = new fabric.IText(text || '0,00', {
          fontSize: 40,
          fontFamily: 'Inter',
          fontWeight: '900',
          fill,
          originX: 'left',
          originY: 'center',
          left: 0,
          top: 0,
          name,
          __fontScale: 0.60,
          __priceRichText: true,
          __priceRichIntegerStyle: { fontSize: 40, fontFamily: 'Inter', fontWeight: '900', fill },
          __priceRichDecimalStyle: { fontSize: 24, fontFamily: 'Inter', fontWeight: '900', fill },
          __priceRichIntegerScale: 1,
          __priceRichDecimalScale: 0.60
        })
        applyRichPriceTextValue(rich, text || '0,00')
        return rich
      }
      const retailRichPrice = makeRichPriceText(String(sample?.priceUnit || sample?.price || '0,00'), '#FFFFFF', 'retail_price_text')
      const wholesaleRichPrice = makeRichPriceText(String(sample?.priceSpecialUnit || sample?.priceSpecial || sample?.priceWholesale || '0,00'), '#FFFFFF', 'wholesale_price_text')
      group.remove(retailInteger, retailDecimal, wholesaleInteger, wholesaleDecimal)
      group.add(retailRichPrice, wholesaleRichPrice)
      group.set({
        __atacarejoLabelVariant: options.labelVariant,
        __autoCollapseMissingPrices: options.autoCollapseMissingPrices !== false,
        __atacDisplayUnit: options.displayUnit || 'UND',
        __atacPackLineCompact: options.packLineCompact !== false,
        __atacConditionFormat: options.conditionFormat || 'acima-de',
        __atacarejoPalette: resolveFardoSpecialPricePalette(options.palette || FARDO_SPECIAL_PRICE_PALETTE)
      })
    }

    migratePriceGroupToRichText(group, fabric)

    deps.applyAtacarejoPricingToPriceGroup(group, sample)
    deps.layoutPriceGroup(group, cardW, cardH)
    return group
  }

  return {
    buildDefaultPriceGroupForCard,
    buildBlackYellowPriceGroupForCard,
    buildOfertaAmarelaPriceGroupForCard,
    buildBarlowBlackPriceGroupForCard,
    buildRedBurstPriceGroupForCard,
    buildAtacarejoPriceGroupForCard
  }
}
