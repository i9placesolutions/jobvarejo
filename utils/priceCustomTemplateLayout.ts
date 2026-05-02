import { clamp } from './mathHelpers'
import { layoutPrice } from './priceTagLayout'
import { PRICE_INTEGER_DECIMAL_GAP_PX } from './priceTagText'

type LayoutCustomPriceGroupDeps = {
    fabric: any
    getSinglePriceCurrencyTextCandidate: (objects: any[]) => any
    ensureSinglePriceCurrencyCircleAnchor: (priceGroup: any, objects?: any[]) => any
    isTextLikeObject: (obj: any) => boolean
    constrainSinglePriceTextInsideBackground: (priceGroup: any) => void
}

export const layoutCustomPriceGroup = (
    priceGroup: any,
    cardW: number,
    cardH: number,
    deps: LayoutCustomPriceGroupDeps
) => {
    if (!priceGroup || typeof priceGroup.getObjects !== 'function') return null

    const {
        fabric,
        getSinglePriceCurrencyTextCandidate,
        ensureSinglePriceCurrencyCircleAnchor,
        isTextLikeObject,
        constrainSinglePriceTextInsideBackground
    } = deps

    const all = priceGroup.getObjects()
    const priceBg = all.find((o: any) => o.name === 'price_bg')
    const priceBgImage = all.find((o: any) => o.name === 'price_bg_image' || o.name === 'splash_image')

    const originalW = typeof (priceBg as any)?.__originalWidth === 'number'
        ? (priceBg as any).__originalWidth
        : (priceBg?.width || 200)
    const originalH = typeof (priceBg as any)?.__originalHeight === 'number'
        ? (priceBg as any).__originalHeight
        : (priceBg?.height || 46)

    const maxPillW = cardW * 0.96
    const maxPillH = cardH * 0.28
    const minPillH = Math.max(36, cardH * 0.12)

    const scaleByWidth = maxPillW / originalW
    const scaleByHeight = maxPillH / originalH
    let scale = Math.min(scaleByWidth, scaleByHeight)

    const scaledH = originalH * scale
    if (scaledH < minPillH) {
        scale = minPillH / originalH
    }

    scale = clamp(scale, 0.3, 3)

    const newW = originalW * scale
    const newH = originalH * scale
    const roundness = clamp(
        typeof (priceBg as any)?.__roundness === 'number' ? (priceBg as any).__roundness : 1,
        0,
        1
    )
    const radius = (newH / 2) * roundness

    priceBg.set({
        width: newW,
        height: newH,
        rx: radius,
        ry: radius,
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0
    })

    ;(['__cornerTL', '__cornerTR', '__cornerBL', '__cornerBR'] as const).forEach(key => {
        const origKey = `__original${key.slice(2)}` as string
        const origVal = typeof (priceBg as any)[origKey] === 'number' ? (priceBg as any)[origKey] : -1
        const curVal = typeof (priceBg as any)[key] === 'number' ? (priceBg as any)[key] : -1
        if (curVal >= 0 && origVal < 0) {
            ;(priceBg as any)[origKey] = curVal
        }
        const base = origVal >= 0 ? origVal : curVal
        if (base >= 0) {
            ;(priceBg as any)[key] = base * scale
        }
    })

    const originalStrokeW = typeof (priceBg as any)?.__strokeWidth === 'number'
        ? (priceBg as any).__strokeWidth
        : null
    if (originalStrokeW !== null) {
        priceBg.set({ strokeWidth: originalStrokeW * scale })
    }

    if (fabric?.Shadow && priceBg.shadow) {
        const originalBlur = typeof (priceBg as any)?.__shadowBlur === 'number'
            ? (priceBg as any).__shadowBlur
            : 15
        priceBg.shadow.blur = Math.max(2, originalBlur * scale)
    }

    if (priceBgImage && priceBgImage.type === 'image') {
        const img: any = priceBgImage
        img.set({
            originX: 'center',
            originY: 'center',
            left: 0,
            top: 0
        })

        const el: any = img._originalElement || img._element
        const iw = el?.naturalWidth || el?.width || img.width || 0
        const ih = el?.naturalHeight || el?.height || img.height || 0

        if (iw > 0 && ih > 0) {
            img.set({ cropX: 0, cropY: 0, width: iw, height: ih })
            const imgScale = Math.max(newW / iw, newH / ih)
            if (Number.isFinite(imgScale) && imgScale > 0) {
                const cropW = Math.min(iw, newW / imgScale)
                const cropH = Math.min(ih, newH / imgScale)
                const cropX = Math.max(0, (iw - cropW) / 2)
                const cropY = Math.max(0, (ih - cropH) / 2)
                img.set({ cropX, cropY, width: cropW, height: cropH, scaleX: imgScale, scaleY: imgScale })
            }
        }

        if (fabric?.Rect) {
            const clip = new fabric.Rect({
                width: newW,
                height: newH,
                rx: radius,
                ry: radius,
                originX: 'center',
                originY: 'center',
                left: 0,
                top: 0
            })
            ;(['__cornerTL', '__cornerTR', '__cornerBL', '__cornerBR'] as const).forEach(k => {
                if (typeof (priceBg as any)[k] === 'number' && (priceBg as any)[k] >= 0) {
                    ;(clip as any)[k] = (priceBg as any)[k]
                }
            })
            img.set({ clipPath: clip })
        }

        if (typeof priceBg.fill === 'string' && priceBg.fill !== 'transparent') {
            if (typeof (priceBg as any).__originalFill === 'undefined') (priceBg as any).__originalFill = priceBg.fill
            priceBg.set('fill', 'transparent')
        }
        if (typeof img.sendToBack === 'function') img.sendToBack()
    } else if (priceBg) {
        const curFill = priceBg.fill
        if (!curFill || curFill === 'transparent' || curFill === '') {
            const saved = (priceBg as any).__originalFill
            priceBg.set('fill', typeof saved === 'string' && saved !== 'transparent' ? saved : '#000000')
        }
    }

    const priceInteger = all.find((o: any) => o.name === 'price_integer_text' || o.name === 'priceInteger' || o.name === 'price_integer')
    const priceDecimal = all.find((o: any) => o.name === 'price_decimal_text' || o.name === 'priceDecimal' || o.name === 'price_decimal')
    const priceUnit = all.find((o: any) => o.name === 'price_unit_text' || o.name === 'priceUnit' || o.name === 'price_unit')
    const currencyText = getSinglePriceCurrencyTextCandidate(all)
    const currencyCircle = ensureSinglePriceCurrencyCircleAnchor(priceGroup, all)
    const priceText = all.find((o: any) => o.name === 'price_value_text' || o.name === 'smart_price')

    const hasSplitPrice = !!(priceInteger && priceDecimal)
    const hasPriceStructure = hasSplitPrice || priceText
    const textScaleMult = typeof (priceGroup as any).__splashTextScale === 'number'
        ? (priceGroup as any).__splashTextScale
        : 1

    all.forEach((obj: any) => {
        if (!isTextLikeObject(obj)) return

        const originalFontSize = typeof obj.__originalFontSize === 'number'
            ? obj.__originalFontSize
            : (obj.fontSize || 14)
        const originalFontFamily = typeof obj.__originalFontFamily === 'string'
            ? obj.__originalFontFamily
            : obj.fontFamily

        obj.set({
            fontFamily: originalFontFamily || 'Inter',
            fontSize: originalFontSize * scale * textScaleMult,
            scaleX: 1,
            scaleY: 1,
            strokeWidth: (obj.strokeWidth || 0) * scale
        })

        if (typeof obj.initDimensions === 'function') obj.initDimensions()
    })

    all.forEach((obj: any) => {
        if (!isTextLikeObject(obj)) return
        if (hasPriceStructure && (
            obj === priceInteger || obj === priceDecimal || obj === priceUnit ||
            obj === priceText || obj === currencyText
        )) {
            return
        }

        const originalLeft = typeof obj.__originalLeft === 'number' ? obj.__originalLeft : obj.left
        const originalTop = typeof obj.__originalTop === 'number' ? obj.__originalTop : obj.top
        const originalOriginX = obj.__originalOriginX || obj.originX || 'center'
        const originalOriginY = obj.__originalOriginY || obj.originY || 'center'

        obj.set({
            left: (typeof originalLeft === 'number' ? originalLeft * scale : originalLeft),
            top: (typeof originalTop === 'number' ? originalTop * scale : originalTop),
            originX: originalOriginX,
            originY: originalOriginY
        })
    })

    if (hasPriceStructure) {
        const getW = (t: any) => (t && typeof t.getScaledWidth === 'function' ? t.getScaledWidth() : 0)
        let textStartX = -(newW / 2) + (newH * 0.35 * 0.85)

        if (currencyCircle) {
            const circleSize = newH * 0.72
            const circleCenterX = -(newW / 2) + (circleSize * 0.35)
            textStartX = circleCenterX + (circleSize / 2) + (newH * 0.18)
        } else if (currencyText) {
            const currencyW = getW(currencyText)
            textStartX = -(newW / 2) + currencyW + (newH * 0.1)
        }

        if (hasSplitPrice) {
            const intY = (typeof priceInteger.__yOffsetRatio === 'number' ? priceInteger.__yOffsetRatio : 0) * newH
            const decY = (typeof priceDecimal.__yOffsetRatio === 'number' ? priceDecimal.__yOffsetRatio : -0.18) * newH
            const unitY = (typeof priceUnit?.__yOffsetRatio === 'number' ? priceUnit.__yOffsetRatio : 0.22) * newH
            const rightPad = newH * 0.35
            const maxTextW = Math.max(20, (newW / 2) - rightPad - textStartX)
            layoutPrice({
                priceInteger,
                priceDecimal,
                priceUnit,
                intX: textStartX,
                intY,
                decY,
                unitY,
                maxWidth: maxTextW,
                gapPx: PRICE_INTEGER_DECIMAL_GAP_PX,
                minGapPx: PRICE_INTEGER_DECIMAL_GAP_PX,
                maxGapPx: PRICE_INTEGER_DECIMAL_GAP_PX
            })
        } else if (priceText) {
            const priceY = (typeof priceText.__yOffsetRatio === 'number' ? priceText.__yOffsetRatio : 0) * newH
            priceText.set({ originX: 'left', originY: 'center', left: textStartX, top: priceY })
        }
    }

    all.forEach((obj: any) => {
        if (!obj || isTextLikeObject(obj)) return
        if (obj.name === 'price_bg' || obj.name === 'price_bg_image' || obj.name === 'splash_image') return

        const originalLeft = typeof obj.__originalLeft === 'number' ? obj.__originalLeft : obj.left
        const originalTop = typeof obj.__originalTop === 'number' ? obj.__originalTop : obj.top
        const originalScaleX = typeof obj.__originalScaleX === 'number' ? obj.__originalScaleX : 1
        const originalScaleY = typeof obj.__originalScaleY === 'number' ? obj.__originalScaleY : 1

        obj.set({
            left: (typeof originalLeft === 'number' ? originalLeft * scale : originalLeft),
            top: (typeof originalTop === 'number' ? originalTop * scale : originalTop),
            scaleX: originalScaleX * scale,
            scaleY: originalScaleY * scale
        })

        if (obj.type === 'circle' && typeof obj.__originalRadius === 'number') {
            obj.set({ radius: obj.__originalRadius * scale })
        }
        if (obj.type === 'rect') {
            if (typeof obj.__originalWidth === 'number') {
                obj.set({ width: obj.__originalWidth * scale })
            }
            if (typeof obj.__originalHeight === 'number') {
                obj.set({ height: obj.__originalHeight * scale })
            }
            if (typeof obj.__originalRx === 'number') {
                obj.set({ rx: obj.__originalRx * scale })
            }
            if (typeof obj.__originalRy === 'number') {
                obj.set({ ry: obj.__originalRy * scale })
            }
        }
    })

    constrainSinglePriceTextInsideBackground(priceGroup)

    priceGroup.set({ width: newW, height: newH })
    const parts = priceGroup.getObjects?.() || []
    parts.forEach((o: any) => { if (o && typeof o.setCoords === 'function') o.setCoords() })
    priceGroup.dirty = true
    if (typeof priceGroup.setCoords === 'function') priceGroup.setCoords()
    return { pillW: newW, pillH: newH }
}
