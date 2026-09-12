import { detectImageTrimBounds } from './fabricImageHelpers'
import { DEFAULT_EDITOR_FONT_FAMILY } from './font-catalog'

type PriceGroupLayoutDeps = {
    getFabric: () => any
    migratePriceGroupToRichText?: (object: any) => void
    collectObjectsDeep: (object: any) => any[]
    findByName: (objects: any[], name: string) => any
    repairAtacarejoTextNames: (objects: any[]) => void
    resolveFardoSpecialPricePalette: (palette: any) => any
    clamp: (value: number, min: number, max: number) => number
    priceIntegerDecimalGapPx: number
    setVisible: (object: any, visible: boolean) => void
    setText: (object: any, text: string) => void
    isRichPriceTextObject: (object: any) => boolean
    setRichPriceBaseFontSize: (object: any, size: number) => void
    setRichPriceSegmentStyle: (object: any, segment: any, style: Record<string, any>) => void
    positionRichPriceUnit: (richPrice: any, unit: any, top: number) => boolean
    layoutPrice: (options: any) => any
    measureHorizontalBoundsLocal: (objects: any[]) => any
    shouldPreserveManualTemplateVisual: (object: any) => boolean
    fitManualAtacarejoValuesIntoTemplate: (object: any) => void
    layoutManualTemplateGroup: (object: any, cardW: number, cardH: number) => any
    rememberPriceLayoutSnapshot: (object: any) => boolean
    fitManualSinglePriceValuesIntoTemplate: (object: any) => void
    layoutCustomPriceGroup: (object: any, cardW: number, cardH: number) => any
    getSinglePriceCurrencyTextCandidate: (objects: any[]) => any
    ensureSinglePriceCurrencyCircleAnchor: (group: any, objects?: any[]) => any
    normalizeUnitForLabel: (value: any) => string
}

export const createPriceGroupLayout = (deps: PriceGroupLayoutDeps) => {
    const priceGroupAtacarejoProbeCache = new WeakMap<any, { childCount: number; hasAtacarejo: boolean }>()

    const layoutAtacarejoPriceGroup = (priceGroup: any, cardW: number, cardH: number) => {
        if (!priceGroup || typeof priceGroup.getObjects !== 'function') return null
        deps.migratePriceGroupToRichText?.(priceGroup)
        const all = deps.collectObjectsDeep(priceGroup)

        deps.repairAtacarejoTextNames(all)

        const retailBg = deps.findByName(all, 'atac_retail_bg')
        if (!retailBg) return null

        const bannerBg = deps.findByName(all, 'atac_banner_bg')
        const wholesaleBg = deps.findByName(all, 'atac_wholesale_bg')
        const palette = (priceGroup as any).__atacarejoPalette
            ? deps.resolveFardoSpecialPricePalette((priceGroup as any).__atacarejoPalette)
            : {
                retailBg: '#EF4444',
                bannerBg: '#FFFFFF',
                wholesaleBg: '#FDE047',
                retailText: '#FFFFFF',
                bannerText: '#000000',
                wholesaleText: '#000000'
            }

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

        const isShown = (object: any) => !!(object && object.visible !== false && (object.scaleX ?? 1) !== 0 && (object.scaleY ?? 1) !== 0)
        let showRetail = isShown(retailBg)
        let showWholesale = isShown(wholesaleBg)
        const bannerHasText = String((bannerText as any)?.text || '').trim().length > 0
        const showBanner = bannerHasText || isShown(bannerBg) || isShown(bannerText)
        if (showBanner) {
            deps.setVisible(bannerBg, true)
            deps.setVisible(bannerText, true)
        }

        if (!showRetail && !showWholesale) {
            showRetail = true
            deps.setVisible(retailBg, true)
            deps.setVisible(retailCurrency, true)
            deps.setVisible(retailInteger, true)
            deps.setVisible(retailDecimal, true)
            deps.setVisible(retailRichPrice, true)
            deps.setVisible(retailUnit, true)
        }

        if (!showWholesale) {
            all.forEach((object: any) => {
                const name = String(object?.name || '')
                if (name.startsWith('wholesale_') && name !== 'wholesale_banner_text') {
                    deps.setVisible(object, false)
                }
            })
        }
        if (!showRetail) {
            all.forEach((object: any) => {
                const name = String(object?.name || '')
                if (name.startsWith('retail_')) {
                    deps.setVisible(object, false)
                }
            })
        }

        const totalW = deps.clamp(cardW * 0.88, 170, cardW * 0.94)
        const totalH = deps.clamp(cardH * 0.52, 160, cardH * 0.74)
        const padX = deps.clamp(totalW * 0.045, 10, 22)
        const sectionGap = deps.clamp(totalH * 0.016, 4, 8)

        const sections: Array<'retail' | 'banner' | 'wholesale'> = []
        if (showRetail) sections.push('retail')
        if (showBanner) sections.push('banner')
        if (showWholesale) sections.push('wholesale')
        const gapCount = Math.max(0, sections.length - 1)
        const usableH = Math.max(24, totalH - (sectionGap * gapCount))

        let retailH = 0
        let bannerH = 0
        let wholesaleH = 0
        if (showRetail && showWholesale) {
            if (showBanner) {
                retailH = deps.clamp(usableH * 0.32, 44, 86)
                bannerH = deps.clamp(usableH * 0.16, 22, 40)
                wholesaleH = usableH - retailH - bannerH
                if (wholesaleH < 68) {
                    const need = 68 - wholesaleH
                    const giveFromBanner = Math.min(need, Math.max(0, bannerH - 20))
                    bannerH -= giveFromBanner
                    const rest = need - giveFromBanner
                    const giveFromRetail = Math.min(rest, Math.max(0, retailH - 40))
                    retailH -= giveFromRetail
                    wholesaleH = usableH - retailH - bannerH
                }
            } else {
                retailH = usableH * 0.36
                wholesaleH = usableH - retailH
            }
        } else if (showRetail || showWholesale) {
            if (showBanner) {
                bannerH = deps.clamp(usableH * 0.22, 22, 40)
                if (showRetail) retailH = usableH - bannerH
                if (showWholesale) wholesaleH = usableH - bannerH
            } else {
                if (showRetail) retailH = usableH
                if (showWholesale) wholesaleH = usableH
            }
        }

        const centers: { retail: number; banner: number; wholesale: number } = {
            retail: 0,
            banner: 0,
            wholesale: 0
        }
        let y = -totalH / 2
        sections.forEach((section, index) => {
            const height = section === 'retail' ? retailH : section === 'banner' ? bannerH : wholesaleH
            centers[section] = y + (height / 2)
            y += height
            if (index < sections.length - 1) y += sectionGap
        })

        const setBackground = (background: any, height: number, centerY: number, radius: number, color?: string) => {
            if (!background || typeof background.set !== 'function') return
            background.set({
                width: totalW,
                height,
                rx: radius,
                ry: radius,
                originX: 'center',
                originY: 'center',
                left: 0,
                top: centerY,
                ...(color ? { fill: color } : {})
            })
        }
        const setTextSizing = (text: any, defaultScale: number, baseH: number, color?: string) => {
            if (!text || !String(text.type || '').includes('text')) return
            text.set({
                fontFamily: DEFAULT_EDITOR_FONT_FAMILY,
                fontWeight: '900',
                fill: color ?? text.fill,
                fontSize: Math.max(8, baseH * defaultScale),
                scaleX: 1,
                scaleY: 1
            })
            if (typeof text.initDimensions === 'function') text.initDimensions()
        }
        const getWidth = (text: any) => (text && typeof text.getScaledWidth === 'function' ? text.getScaledWidth() : 0)
        const getHeight = (text: any) => (text && typeof text.getScaledHeight === 'function' ? text.getScaledHeight() : 0)
        const getVerticalBounds = (object: any) => {
            if (!object) return null
            const height = getHeight(object)
            if (!height || !Number.isFinite(height)) return null
            const top = Number(object.top || 0)
            const originY = String(object.originY || 'top')
            if (originY === 'center') return { min: top - (height / 2), max: top + (height / 2) }
            if (originY === 'bottom') return { min: top - height, max: top }
            return { min: top, max: top + height }
        }
        const fitTextWidth = (text: any, maxW: number, minScale = 0.6) => {
            if (!text || !Number.isFinite(maxW) || maxW <= 0) return
            const width = getWidth(text)
            if (!width || width <= maxW) return
            const scale = deps.clamp(maxW / width, minScale, 1)
            text.set?.({ scaleX: scale, scaleY: scale })
        }

        if (showRetail) setBackground(retailBg, retailH, centers.retail, deps.clamp(retailH * 0.22, 10, 28), palette.retailBg)
        if (showBanner && bannerBg) setBackground(bannerBg, bannerH, centers.banner, deps.clamp(bannerH * 0.48, 8, 20), palette.bannerBg)
        if (showWholesale) setBackground(wholesaleBg, wholesaleH, centers.wholesale, deps.clamp(wholesaleH * 0.22, 10, 28), palette.wholesaleBg)

        const layoutTier = (tier: {
            blockH: number
            blockCY: number
            currency: any
            integer: any
            decimal: any
            rich?: any
            unit: any
            pack: any
            color: string
            emphasis?: 'normal' | 'high'
        }) => {
            const { blockH, blockCY, currency, integer, decimal, rich, unit, pack, color, emphasis } = tier
            if (!blockH || !Number.isFinite(blockH)) return
            const valueText = rich || integer
            const decimalText = rich ? null : decimal

            const maxPriceW = totalW - (padX * 2)
            const currencyGap = deps.clamp(blockH * 0.045, 2, 9)
            const integerDecimalGap = deps.priceIntegerDecimalGapPx

            const isHigh = emphasis === 'high'
            const integerScale = isHigh ? 0.72 : 0.60
            const decimalScale = isHigh ? 0.38 : 0.31
            const currencyScale = isHigh ? 0.26 : 0.21
            const unitScale = isHigh ? 0.27 : 0.22
            const packScale = isHigh ? 0.17 : 0.155

            if (rich && deps.isRichPriceTextObject(rich)) {
                deps.setRichPriceBaseFontSize(rich, Math.max(8, blockH * (isHigh ? 0.72 : 0.60)))
                deps.setRichPriceSegmentStyle(rich, 'integer', { fill: color })
                deps.setRichPriceSegmentStyle(rich, 'decimal', { fill: color })
                rich.set?.({ fill: color, scaleX: 1, scaleY: 1 })
            } else {
                setTextSizing(integer, integerScale, blockH, color)
                setTextSizing(decimal, decimalScale, blockH, color)
            }
            setTextSizing(currency, currencyScale, blockH, color)
            setTextSizing(unit, unitScale, blockH, color)
            setTextSizing(pack, packScale, blockH, color)

            const packVisible = isShown(pack) && String(pack?.text || '').trim().length > 0
            const unitVisible = isShown(unit) && String(unit?.text || '').trim().length > 0
            let centsBlockW = unitVisible ? Math.max(getWidth(decimalText), getWidth(unit)) : getWidth(decimalText)
            let priceW = getWidth(currency) + currencyGap + getWidth(valueText) + (rich ? 0 : integerDecimalGap) + centsBlockW
            if (priceW > maxPriceW && priceW > 0) {
                const scale = Math.max(isHigh ? 0.65 : 0.58, maxPriceW / priceW)
                ;[currency, valueText, decimalText, unit].forEach((text: any) => text?.set?.({ scaleX: scale, scaleY: scale }))
                centsBlockW = unitVisible ? Math.max(getWidth(decimalText), getWidth(unit)) : getWidth(decimalText)
                priceW = getWidth(currency) + currencyGap + getWidth(valueText) + (rich ? 0 : integerDecimalGap) + centsBlockW
            }

            const blockTop = blockCY - (blockH / 2)
            const blockBottom = blockCY + (blockH / 2)
            const innerTop = blockTop + (blockH * 0.10)
            const innerBottom = blockBottom - (blockH * 0.10)

            const maxPackW = totalW - (padX * 2)
            let chainBottomLimit = innerBottom
            if (pack && packVisible) {
                const packWidth = getWidth(pack)
                if (packWidth > maxPackW && packWidth > 0) {
                    const scale = maxPackW / packWidth
                    pack.set({ scaleX: scale, scaleY: scale })
                } else {
                    pack.set({ scaleX: 1, scaleY: 1 })
                }
                fitTextWidth(pack, maxPackW, isHigh ? 0.6 : 0.55)
                const packH = Math.max(8, getHeight(pack))
                const packCenterY = Math.min(innerBottom - (packH / 2), blockBottom - (packH / 2) - 2)
                pack.set({ originX: 'center', originY: 'center', left: 0, top: packCenterY })
                chainBottomLimit = Math.max(innerTop + 6, packCenterY - (packH / 2) - (blockH * 0.08))
            }

            const chainCenterY = (innerTop + chainBottomLimit) / 2
            const startX = -priceW / 2
            const intY = chainCenterY + (isHigh ? (blockH * 0.02) : (blockH * 0.01))
            const decY = intY - (blockH * (isHigh ? 0.18 : 0.16))
            const curY = intY + (blockH * (isHigh ? 0.02 : 0.01))

            const curW = getWidth(currency)
            currency?.set?.({ originX: 'left', originY: 'center', left: startX, top: curY })

            const intX = startX + curW + currencyGap
            const unitY = intY + (blockH * (isHigh ? 0.26 : 0.22))
            if (rich && deps.isRichPriceTextObject(rich)) {
                rich.set({ originX: 'left', originY: 'center', left: intX, top: intY })
                if (unitVisible) {
                    deps.positionRichPriceUnit(rich, unit, unitY)
                }
            } else {
                deps.layoutPrice({
                    priceInteger: integer,
                    priceDecimal: decimal,
                    priceUnit: unitVisible ? unit : undefined,
                    intX,
                    intY,
                    decY,
                    unitY,
                    maxWidth: Math.max(20, maxPriceW - (curW + currencyGap)),
                    gapPx: integerDecimalGap,
                    minGapPx: integerDecimalGap,
                    maxGapPx: integerDecimalGap
                })
            }

            const chainBounds = deps.measureHorizontalBoundsLocal(
                [currency, valueText, decimalText, unitVisible ? unit : null].filter(Boolean) as any[]
            )
            if (chainBounds) {
                const chainCenterX = (chainBounds.left + chainBounds.right) / 2
                const dx = -chainCenterX
                if (Math.abs(dx) > 0.001) {
                    [currency, valueText, decimalText, unitVisible ? unit : null].forEach((object: any) => {
                        if (!object || typeof object.set !== 'function') return
                        object.set({ left: Number(object.left || 0) + dx })
                    })
                }
            }

            const chainObjects = [currency, valueText, decimalText, unitVisible ? unit : null].filter(Boolean)
            const yBounds = chainObjects
                .map((object: any) => getVerticalBounds(object))
                .filter(Boolean) as Array<{ min: number; max: number }>
            if (yBounds.length > 0) {
                const minY = Math.min(...yBounds.map((bounds) => bounds.min))
                const maxY = Math.max(...yBounds.map((bounds) => bounds.max))
                const topLimit = innerTop
                const bottomLimit = chainBottomLimit
                let dy = 0
                if (minY < topLimit) dy += (topLimit - minY)
                if ((maxY + dy) > bottomLimit) dy += (bottomLimit - (maxY + dy))
                if (Math.abs(dy) > 0.001) {
                    chainObjects.forEach((object: any) => {
                        object?.set?.({ top: Number(object.top || 0) + dy })
                    })
                }
            }
        }

        if (showRetail) layoutTier({ blockH: retailH, blockCY: centers.retail, currency: retailCurrency, integer: retailInteger, decimal: retailDecimal, rich: retailRichPrice, unit: retailUnit, pack: retailPack, color: palette.retailText, emphasis: 'normal' })
        if (showWholesale) layoutTier({ blockH: wholesaleH, blockCY: centers.wholesale, currency: wholesaleCurrency, integer: wholesaleInteger, decimal: wholesaleDecimal, rich: wholesaleRichPrice, unit: wholesaleUnit, pack: wholesalePack, color: palette.wholesaleText, emphasis: 'high' })

        if (showBanner && bannerText) {
            setTextSizing(bannerText, 0.58, bannerH, palette.bannerText)
            fitTextWidth(bannerText, totalW - (padX * 0.9), 0.56)
            const bannerTop = centers.banner - (bannerH / 2)
            const bannerBottom = centers.banner + (bannerH / 2)
            bannerText.set({ originX: 'center', originY: 'center', left: 0, top: centers.banner })
            const bannerBounds = getVerticalBounds(bannerText)
            if (bannerBounds) {
                let dy = 0
                if (bannerBounds.min < (bannerTop + 2)) dy += ((bannerTop + 2) - bannerBounds.min)
                if ((bannerBounds.max + dy) > (bannerBottom - 2)) dy += ((bannerBottom - 2) - (bannerBounds.max + dy))
                if (Math.abs(dy) > 0.001) {
                    bannerText.set({ top: Number(bannerText.top || 0) + dy })
                }
            }
        }

        priceGroup.set({ width: totalW, height: totalH })
        const parts = priceGroup.getObjects?.() || []
        parts.forEach((object: any) => { if (object && typeof object.setCoords === 'function') object.setCoords() })
        priceGroup.dirty = true
        if (typeof priceGroup.setCoords === 'function') priceGroup.setCoords()
        return { pillW: totalW, pillH: totalH }
    }

    const layoutPriceGroup = (priceGroup: any, cardW: number, cardH: number) => {
        if (!priceGroup || !priceGroup.getObjects) return null
        deps.migratePriceGroupToRichText?.(priceGroup)
        const fabric = deps.getFabric()
        const preferManualTemplateLayout = deps.shouldPreserveManualTemplateVisual(priceGroup)
        const forceCanonicalAtacarejoLayout = (priceGroup as any).__forceAtacarejoCanonical === true

        try {
            let deep: any[] | null = null
            let hasAtacarejo = false
            const childCount = Array.isArray((priceGroup as any)._objects)
                ? (priceGroup as any)._objects.length
                : (priceGroup.getObjects?.() || []).length
            const cachedProbe = priceGroupAtacarejoProbeCache.get(priceGroup)
            if (cachedProbe && cachedProbe.childCount === childCount) {
                hasAtacarejo = cachedProbe.hasAtacarejo
            } else {
                deep = deps.collectObjectsDeep(priceGroup)
                hasAtacarejo = !!deps.findByName(deep, 'atac_retail_bg')
                priceGroupAtacarejoProbeCache.set(priceGroup, { childCount, hasAtacarejo })
            }

            if (hasAtacarejo) {
                if (!deep) deep = deps.collectObjectsDeep(priceGroup)
                // A variante comercial nao autoriza redesenhar um modelo manual.
                if (!forceCanonicalAtacarejoLayout && preferManualTemplateLayout) {
                    deps.fitManualAtacarejoValuesIntoTemplate(priceGroup)
                    const manual = deps.layoutManualTemplateGroup(priceGroup, cardW, cardH)
                    if (manual) {
                        deps.rememberPriceLayoutSnapshot(priceGroup)
                        return manual
                    }
                }
                const atac = layoutAtacarejoPriceGroup(priceGroup, cardW, cardH)
                if (atac) deps.rememberPriceLayoutSnapshot(priceGroup)
                return atac
            }
        } catch {
            // fall through to legacy layout
        }

        const all = priceGroup.getObjects()
        const priceBg = all.find((object: any) => object.name === 'price_bg')
        const priceBgImage = all.find((object: any) => object.name === 'price_bg_image' || object.name === 'splash_image')
        const currencyText = deps.getSinglePriceCurrencyTextCandidate(all)
        const currencyCircle = deps.ensureSinglePriceCurrencyCircleAnchor(priceGroup, all)
        const priceText = all.find((object: any) => object.name === 'price_value_text' || object.name === 'smart_price')
        const priceInteger = all.find((object: any) => object.name === 'price_integer_text' || object.name === 'priceInteger' || object.name === 'price_integer')
        const priceDecimal = all.find((object: any) => object.name === 'price_decimal_text' || object.name === 'priceDecimal' || object.name === 'price_decimal')
        const priceUnit = all.find((object: any) => object.name === 'price_unit_text' || object.name === 'priceUnit' || object.name === 'price_unit')
        const hasStandardStructure = !!(priceBg && currencyCircle && currencyText && (priceText || (priceInteger && priceDecimal)))
        const isCustomTemplate = (priceGroup as any).__isCustomTemplate === true || (!hasStandardStructure && priceBg && typeof (priceBg as any).__originalWidth === 'number')

        if (isCustomTemplate && priceBg) {
            if (preferManualTemplateLayout) {
                deps.fitManualSinglePriceValuesIntoTemplate(priceGroup)
                const manual = deps.layoutManualTemplateGroup(priceGroup, cardW, cardH)
                if (manual) {
                    deps.rememberPriceLayoutSnapshot(priceGroup)
                    return manual
                }
            }
            const custom = deps.layoutCustomPriceGroup(priceGroup, cardW, cardH)
            if (custom) deps.rememberPriceLayoutSnapshot(priceGroup)
            return custom
        }

        if (!priceBg || !currencyCircle || !currencyText) return null

        const base = Math.min(cardW, cardH)
        const pillH = deps.clamp(base * 0.18, 46, Math.max(46, cardH * 0.24))
        const circleSize = pillH * 0.72
        const textGap = pillH * 0.18
        const rightPad = pillH * 0.35
        const hasSplit = !!(priceInteger && priceDecimal)
        const anyText = hasSplit ? priceInteger : priceText
        if (!anyText) return null

        const recognized = new Set<any>([priceBg, priceBgImage, currencyCircle, currencyText, priceText, priceInteger, priceDecimal, priceUnit])
        const cleanupNames = new Set(['priceSymbol', 'price_currency', 'price_currency_text', 'priceInteger', 'priceDecimal', 'priceUnit', 'smart_price', 'price_value_text'])
        all.forEach((object: any) => {
            if (!object || recognized.has(object)) return
            if (!cleanupNames.has(String(object.name || ''))) return
            if (typeof priceGroup.remove === 'function') priceGroup.remove(object)
        })

        const textScaleMult = typeof (priceGroup as any).__splashTextScale === 'number' ? (priceGroup as any).__splashTextScale : 1
        const setTextSizing = (text: any, defaultScale: number) => {
            if (!text || !text.type || !String(text.type).includes('text')) return
            const priceFontSizeOverride = Number((priceGroup as any).__priceFontSizeOverride)
            if (Number.isFinite(priceFontSizeOverride) && priceFontSizeOverride > 0) {
                const ratio = defaultScale / 0.72
                text.set({ fontSize: priceFontSizeOverride * ratio * textScaleMult, scaleX: 1, scaleY: 1 })
                if (typeof text.initDimensions === 'function') text.initDimensions()
                return
            }
            const scale = typeof text.__fontScale === 'number' ? text.__fontScale : defaultScale
            text.set({ fontSize: pillH * scale * textScaleMult, scaleX: 1, scaleY: 1 })
            if (typeof text.initDimensions === 'function') text.initDimensions()
        }
        const setRichTextSizing = (text: any, defaultScale: number) => {
            if (!text || !deps.isRichPriceTextObject(text)) return
            const priceFontSizeOverride = Number((priceGroup as any).__priceFontSizeOverride)
            const baseFontSize = Number.isFinite(priceFontSizeOverride) && priceFontSizeOverride > 0
                ? priceFontSizeOverride * (defaultScale / 0.72) * textScaleMult
                : pillH * defaultScale * textScaleMult
            deps.setRichPriceBaseFontSize(text, Math.max(8, baseFontSize))
            text.set?.({ scaleX: 1, scaleY: 1 })
        }

        if (hasSplit) {
            setTextSizing(priceInteger, 0.72)
            setTextSizing(priceDecimal, 0.42)
            setTextSizing(priceUnit, 0.26)
        } else {
            if (priceText && deps.isRichPriceTextObject(priceText)) setRichTextSizing(priceText, 0.7)
            else setTextSizing(priceText, 0.7)
        }

        if (priceUnit && priceUnit.visible !== false) {
            const current = String(priceUnit.text || '').trim()
            if (current) {
                const normalized = deps.normalizeUnitForLabel(current)
                if (normalized !== current.toUpperCase().replace(/\s+/g, '')) {
                    priceUnit.set?.('text', normalized)
                    if (typeof priceUnit.initDimensions === 'function') priceUnit.initDimensions()
                }
            }
        }

        const getWidth = (text: any) => (text && typeof text.getScaledWidth === 'function' ? text.getScaledWidth() : 0)
        const calcTextWidth = () => hasSplit ? (getWidth(priceInteger) + getWidth(priceDecimal)) : getWidth(priceText)
        let textWidth = calcTextWidth()
        const maxPillW = cardW * 0.96
        const minPillW = textWidth + (circleSize * 0.85) + textGap + rightPad
        const minVisualW = Math.max(120, pillH * 2.6)
        let pillW = deps.clamp(minPillW, minVisualW, maxPillW)

        if (minPillW > maxPillW && textWidth > 0) {
            const availableTextWidth = maxPillW - (circleSize * 0.85) - textGap - rightPad
            if (availableTextWidth > 0) {
                const scale = availableTextWidth / textWidth
                if (hasSplit) {
                    if (priceInteger) priceInteger.set({ scaleX: scale, scaleY: scale })
                    if (priceDecimal) priceDecimal.set({ scaleX: scale, scaleY: scale })
                    if (priceUnit) priceUnit.set({ scaleX: scale, scaleY: scale })
                } else if (priceText) {
                    priceText.set({ scaleX: scale, scaleY: scale })
                }
                textWidth = calcTextWidth()
            }
            pillW = maxPillW
        }

        const roundness = deps.clamp(typeof (priceBg as any).__roundness === 'number' ? (priceBg as any).__roundness : 1, 0, 1)
        const radius = (pillH / 2) * roundness
        priceBg.set({ width: pillW, height: pillH, rx: radius, ry: radius, originX: 'center', originY: 'center', left: 0, top: 0 })

        const cornerKeys = ['__cornerTL', '__cornerTR', '__cornerBL', '__cornerBR'] as const
        const hasAnyCorner = cornerKeys.some((key) => typeof (priceBg as any)[key] === 'number' && (priceBg as any)[key] >= 0)
        if (hasAnyCorner) {
            cornerKeys.forEach((key) => {
                const originalKey = `__original${key.slice(2)}`
                const originalValue = typeof (priceBg as any)[originalKey] === 'number' ? (priceBg as any)[originalKey] : -1
                const currentValue = typeof (priceBg as any)[key] === 'number' ? (priceBg as any)[key] : -1
                if (currentValue >= 0 && originalValue < 0) (priceBg as any)[originalKey] = currentValue
                const baseValue = originalValue >= 0 ? originalValue : currentValue
                if (baseValue >= 0) {
                    const originalHeight = typeof (priceBg as any).__originalHeight === 'number' ? (priceBg as any).__originalHeight : pillH
                    const scaleFactor = originalHeight > 0 ? pillH / originalHeight : 1
                    ;(priceBg as any)[key] = baseValue * scaleFactor
                }
            })
        }

        const customStrokeW = Number((priceBg as any).__strokeWidth)
        const strokeW = Number.isFinite(customStrokeW) ? deps.clamp(customStrokeW, 0, Math.max(0, pillH * 0.2)) : Math.max(1, Math.min(4, pillH * 0.04))
        const accentColor = typeof priceBg.stroke === 'string' ? priceBg.stroke : '#ff0000'
        priceBg.set({ strokeWidth: strokeW })
        if (fabric?.Shadow) {
            const blur = Math.max(6, Math.min(26, pillH * 0.22))
            priceBg.set('shadow', new fabric.Shadow({ color: accentColor, blur, offsetX: 0, offsetY: 0 }))
        }

        if (priceBgImage && priceBgImage.type === 'image') {
            const image: any = priceBgImage
            image.set({ originX: 'center', originY: 'center', left: 0, top: 0 })
            const element: any = image._originalElement || image._element
            const imageW = element?.naturalWidth || element?.width || image.width || 0
            const imageH = element?.naturalHeight || element?.height || image.height || 0
            if (imageW > 0 && imageH > 0) {
                const visibleBounds = detectImageTrimBounds(image, { alphaThreshold: 12, padding: 0 })
                const sourceLeft = Math.max(0, Number(visibleBounds?.left || 0))
                const sourceTop = Math.max(0, Number(visibleBounds?.top || 0))
                const sourceW = Math.max(1, Number(visibleBounds?.width || imageW))
                const sourceH = Math.max(1, Number(visibleBounds?.height || imageH))
                let scale = Math.max(pillW / sourceW, pillH / sourceH)
                if (!Number.isFinite(scale) || scale <= 0) scale = 1
                scale = Math.min(scale, 20)
                const cropW = Math.min(sourceW, pillW / scale)
                const cropH = Math.min(sourceH, pillH / scale)
                const cropX = sourceLeft + Math.max(0, (sourceW - cropW) / 2)
                const cropY = sourceTop + Math.max(0, (sourceH - cropH) / 2)
                image.set({ cropX, cropY, width: cropW, height: cropH, scaleX: scale, scaleY: scale })
            } else {
                image.set({ cropX: 0, cropY: 0, width: pillW, height: pillH, scaleX: 1, scaleY: 1 })
            }
            if (fabric?.Rect) {
                const clip = new fabric.Rect({ width: pillW, height: pillH, rx: radius, ry: radius, originX: 'center', originY: 'center', left: 0, top: 0 })
                ;(['__cornerTL', '__cornerTR', '__cornerBL', '__cornerBR'] as const).forEach((key) => {
                    if (typeof (priceBg as any)[key] === 'number' && (priceBg as any)[key] >= 0) (clip as any)[key] = (priceBg as any)[key]
                })
                image.set({ clipPath: clip })
            }
            if (typeof priceBg.fill === 'string' && priceBg.fill !== 'transparent') {
                if (typeof (priceBg as any).__originalFill === 'undefined') (priceBg as any).__originalFill = priceBg.fill
                priceBg.set('fill', 'transparent')
            }
            if (typeof image.sendToBack === 'function') image.sendToBack()
        } else if (priceBg) {
            const currentFill = priceBg.fill
            if (!currentFill || currentFill === 'transparent' || currentFill === '') {
                const saved = (priceBg as any).__originalFill
                priceBg.set('fill', typeof saved === 'string' && saved !== 'transparent' ? saved : '#000000')
            }
        }

        const circleCenterX = -(pillW / 2) + (circleSize * 0.35)
        currencyCircle.set({ radius: circleSize / 2, originX: 'center', originY: 'center', left: circleCenterX, top: 0 })
        currencyText.set({ fontSize: circleSize * 0.32 * textScaleMult, originX: 'center', originY: 'center', left: circleCenterX, top: 0, scaleX: 1, scaleY: 1 })

        const textStartX = circleCenterX + (circleSize / 2) + textGap
        if (hasSplit) {
            const intY = (typeof priceInteger.__yOffsetRatio === 'number' ? priceInteger.__yOffsetRatio : 0) * pillH
            const decY = (typeof priceDecimal.__yOffsetRatio === 'number' ? priceDecimal.__yOffsetRatio : -0.18) * pillH
            const unitY = (typeof priceUnit?.__yOffsetRatio === 'number' ? priceUnit.__yOffsetRatio : 0.22) * pillH
            const maxTextW = Math.max(20, (pillW / 2) - rightPad - textStartX)
            deps.layoutPrice({
                priceInteger,
                priceDecimal,
                priceUnit,
                intX: textStartX,
                intY,
                decY,
                unitY,
                maxWidth: maxTextW,
                gapPx: deps.priceIntegerDecimalGapPx,
                minGapPx: deps.priceIntegerDecimalGapPx,
                maxGapPx: deps.priceIntegerDecimalGapPx
            })
        } else if (priceText && deps.isRichPriceTextObject(priceText)) {
            priceText.set({ originX: 'left', originY: 'center', left: textStartX, top: 0 })
            const unitY = (typeof priceUnit?.__yOffsetRatio === 'number' ? priceUnit.__yOffsetRatio : 0.22) * pillH
            deps.positionRichPriceUnit(priceText, priceUnit, unitY)
        } else if (priceText) {
            const scaledTextWidth = priceText.getScaledWidth()
            const textCenterX = textStartX + (scaledTextWidth / 2)
            priceText.set({ originX: 'center', originY: 'center', left: textCenterX, top: 0 })
        }

        priceGroup.set({ width: pillW, height: pillH })
        const parts = priceGroup.getObjects?.() || []
        parts.forEach((object: any) => { if (object && typeof object.setCoords === 'function') object.setCoords() })
        priceGroup.dirty = true
        if (typeof priceGroup.setCoords === 'function') priceGroup.setCoords()
        deps.rememberPriceLayoutSnapshot(priceGroup)
        return { pillW, pillH }
    }

    return { layoutAtacarejoPriceGroup, layoutPriceGroup }
}
