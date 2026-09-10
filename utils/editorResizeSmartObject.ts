import { resolveProductNameColor, syncProductNameColor } from './productNameColors'
import { resolveProductCardColor } from './productCardColors'
import type { GlobalStyles } from '~/types/product-zone'

import {
  isRichPriceTextObject,
  setRichPriceBaseFontSize,
  setRichPriceSegmentStyle
} from './priceRichText'

type ResizeSmartObjectDeps = {
  fabric: () => any
  getCardStyleOverrides: (card: any) => Record<string, any>
  buildCardRelayoutSignature: (card: any, width: number, height: number, styles?: Partial<GlobalStyles>) => string
  isTextLikeObject: (object: any) => boolean
  getPriceGroupFromAny: (object: any) => any
  shouldPreserveManualTemplateVisual: (object: any) => boolean
  collectObjectsDeep: (object: any) => any[]
  defaultGlobalStyles: GlobalStyles
  clamp: (value: number, min: number, max: number) => number
  getZoneStyleOverrides: (zone: any) => Record<string, true>
  findProductZoneById: (zoneId: any) => any | null
  layoutPriceGroup: (priceGroup: any, cardW: number, cardH: number) => any
  applyProductCardConfigurationLayout: (group: any, width: number, height: number, styles?: Partial<GlobalStyles>) => void
  normalizePriceGroupPlacementInCard: (...args: any[]) => any
}

export const createResizeSmartObject = (deps: ResizeSmartObjectDeps) => {
  const resizeSmartObject = (group: any, w: number, h: number, styles?: Partial<GlobalStyles>) => {
    const fabric = deps.fabric()

    // Override POR CARD ("editar so esta etiqueta"): mescla os valores do card por
    // cima dos estilos da zona logo no inicio, para que TODO o pipeline (tipografia,
    // cor, layout, signature) ja use os valores do card. Sem override de card o
    // objeto `styles` permanece intacto (zero mudanca de comportamento).
    const __cardStyleOv = deps.getCardStyleOverrides(group)
    if (Object.keys(__cardStyleOv).length && styles && typeof styles === 'object') {
      styles = { ...styles, ...__cardStyleOv } as Partial<GlobalStyles>
    }
    if (styles) {
      const cardColor = resolveProductCardColor(styles, group._cardHighlighted === true, __cardStyleOv)
      styles = { ...styles, cardColor, prodNameColor: resolveProductNameColor(cardColor, __cardStyleOv, styles, group._cardHighlighted === true) }
    }
    // FIX: Permanently disable Fabric v7 LayoutManager on product card groups.
    // Card layout is fully managed by resizeSmartObject — Fabric's auto-layout
    // only causes corruption by recalculating bounds from children at stale positions.
    // A permanent no-op is simpler and eliminates recursion/wrapper-chain bugs.
    const cardLm = (group as any).layoutManager
    if (cardLm && cardLm.performLayout) cardLm.performLayout = () => {}

    // CRITICAL FIX: Check signature BEFORE calling group.set({ width, height }).
    // In Fabric v7, group.set({ width, height }) shifts the group's internal coordinate
    // system (center origin), which displaces ALL children. If we can skip the relayout
    // (signature matches), we must NOT touch width/height to avoid this corruption.
    const relayoutSignature = deps.buildCardRelayoutSignature(group, w, h, styles)
    const forceRelayout = (group as any).__forceCardRelayout === true
    const CARD_RELAYOUT_SIG_TTL_MS = 60000 // 1 minuto — evita layout stale após mudanças externas
    const sigAge = Date.now() - Number((group as any).__lastCardRelayoutAt || 0)
    const sigValid = !forceRelayout &&
      (group as any).__lastCardRelayoutSignature === relayoutSignature &&
      Number.isFinite(sigAge) && sigAge >= 0 && sigAge < CARD_RELAYOUT_SIG_TTL_MS
    if (sigValid) {
      // Dimensions and styles match — skip relayout entirely.
      // Only update stored card dimensions (for serialization) without touching the group.
      (group as any)._cardWidth = w
      ;(group as any)._cardHeight = h
      group.dirty = true
      group.setCoords?.()
      return
    }
    ;(group as any).__lastCardRelayoutSignature = relayoutSignature
    ;(group as any).__lastCardRelayoutAt = Date.now()
    ;(group as any).__forceCardRelayout = false

    // Preservar _productData antes de operações que podem perdê-la
    const savedProductData = ((group as any)?._productData && typeof (group as any)._productData === 'object')
      ? JSON.parse(JSON.stringify((group as any)._productData))
      : null

    // Now that we know we're doing a full relayout, set dimensions.
    // Reset scale first to ensure clean internal layout.
    group.scale(1)
    group.set({ width: w, height: h })

    // Restaurar _productData caso Fabric a tenha perdido no set()
    if (savedProductData && (!(group as any)?._productData || typeof (group as any)._productData !== 'object')) {
      ;(group as any)._productData = savedProductData
    }

    const halfW = w / 2
    const halfH = h / 2
    const _refH = Number((styles as any)?.__refCellH) || h
    const baseSize = Math.min(w, h)
    const objects = group.getObjects()
    let bg: any = null
    let title: any = null
    let limit: any = null
    let img: any = null
    let namedSplash: any = null
    let fallbackSplashGroup: any = null
    let directPriceGroup: any = null
    let topMostText: any = null
    let topMostTextTop = Infinity
    let largestRect: any = null
    let largestRectArea = -1
    let rectCount = 0
    let imageCount = 0
    let loneImage: any = null

    // Single-pass lookup to keep relayout fast when many cards are updated.
    for (const obj of objects) {
      if (!obj) continue
      const name = String(obj.name || '')
      const type = String(obj.type || '').toLowerCase()

      if (!bg && name === 'offerBackground') bg = obj
      if (!title && name === 'smart_title') title = obj
      if (!img && name === 'smart_image') img = obj
      if (!namedSplash && (name === 'smart_price' || name === 'smart_splash')) namedSplash = obj
      if (!directPriceGroup && type === 'group' && name === 'priceGroup') directPriceGroup = obj
      if (!fallbackSplashGroup && type === 'group') fallbackSplashGroup = obj
      if (!limit && (name === 'smart_limit' || name === 'limitText' || name === 'product_limit' || obj?.data?.smartType === 'product-limit')) {
        limit = obj
      }

      if (type === 'rect') {
        rectCount += 1
        const area = (obj?.width || 0) * (obj?.height || 0) * (obj?.scaleX || 1) * (obj?.scaleY || 1)
        if (area >= largestRectArea) {
          largestRectArea = area
          largestRect = obj
        }
      }

      if (deps.isTextLikeObject(obj)) {
        const top = typeof obj?.top === 'number' ? obj.top : Infinity
        if (top <= topMostTextTop) {
          topMostTextTop = top
          topMostText = obj
        }
      }

      if (type === 'image') {
        imageCount += 1
        loneImage = obj
      }
    }

    // Fallback: The background is usually the largest rect that fills most of the card.
    if (!bg && largestRect && rectCount > 0) {
      bg = largestRect
      bg.name = 'offerBackground' // Repair name
    }

    // Fallback: title is usually the top-most text object.
    if (!title && topMostText) {
      title = topMostText
      title.name = 'smart_title'
    }

    // Fallback: image is often the only image in the card.
    if (!img && imageCount === 1 && loneImage) {
      img = loneImage
      img.name = 'smart_image'
    }

    // Splash can vary names; prefer the canonical price label group when present (even when nested).
    const isDescendantOfGroup = (candidate: any, root: any) => {
      let current = candidate
      while (current) {
        if (current === root) return true
        current = current.group
      }
      return false
    }

    let priceGroup = (group as any).__priceGroupRef
    if (!(priceGroup && priceGroup.type === 'group' && isDescendantOfGroup(priceGroup, group))) {
      priceGroup = directPriceGroup ?? deps.getPriceGroupFromAny(group)
      ;(group as any).__priceGroupRef = priceGroup ?? null
    }

    const splash = priceGroup ?? namedSplash ?? fallbackSplashGroup

    // When the user moves an inner element (deep select), we mark it with `__manualTransform`.
    // During zone relayout (and on reload), we must NOT override these user placements.
    const isManual = (o: any) => !!(o && (o as any).__manualTransform)
    // `__manualTransform` também identifica alterações em elementos internos
    // da etiqueta (fonte, fundo, valor). Isso não deve congelar a posição do
    // bloco de preço: a posição/tamanho externos continuam vindo da receita
    // percentual configurada em Cards. Apenas um arraste/redimensionamento
    // explícito do próprio priceGroup recebe este marcador separado.
    const isManualPricePosition = (o: any) => !!(o && (o as any).__manualPricePosition === true)

    // If the card size changes (ex: more items in the zone, zone resize, preset change),
    // reposition manual elements proportionally so they keep their relative placement.
    // Product images need their visual scale updated as well. They are marked as
    // manual after a duplicate/drag so the card recipe does not teleport them back
    // to its default slot; previously only left/top were scaled, which left a
    // duplicated image at the old size when a zone changed from several cards to a
    // single card.
    const isManualProductImage = (o: any): boolean => {
      if (!o || String(o.type || '').toLowerCase() !== 'image') return false
      const name = String(o.name || '').trim().toLowerCase()
      const smartType = String(o?.data?.smartType || '').trim().toLowerCase()
      return smartType === 'product-image'
        || name === 'smart_image'
        || name === 'product_image'
        || name === 'productimage'
        || name === 'extra_image'
        || name.startsWith('extra_image_')
    }

    const maybeRescaleManualTransforms = (o: any) => {
      if (!o || !isManual(o)) return
      const prevW = Number((o as any).__manualTransformCardW)
      const prevH = Number((o as any).__manualTransformCardH)

      // Initialize baseline on first layout pass.
      if (!Number.isFinite(prevW) || prevW <= 0 || !Number.isFinite(prevH) || prevH <= 0) {
        ;(o as any).__manualTransformCardW = w
        ;(o as any).__manualTransformCardH = h
        return
      }

      // Skip micro-deltas to avoid drift on repeated relayouts with same size.
      const dw = Math.abs(prevW - w)
      const dh = Math.abs(prevH - h)
      if (dw < 0.5 && dh < 0.5) return

      const rx = w / prevW
      const ry = h / prevH
      if (!Number.isFinite(rx) || !Number.isFinite(ry) || rx <= 0 || ry <= 0) return

      if (typeof o.left === 'number') o.left = o.left * rx
      if (typeof o.top === 'number') o.top = o.top * ry

      // Keep the image proportional to the new card. Use the smaller axis
      // ratio so a change in card aspect ratio never makes the image overflow
      // vertically or horizontally. Price groups are intentionally excluded:
      // layoutPriceGroup/layoutManualTemplateGroup recalculates their own
      // dimensions from the new card and applying this factor too would double
      // their scale.
      if (isManualProductImage(o)) {
        const visualRatio = Math.min(rx, ry)
        if (Number.isFinite(visualRatio) && visualRatio > 0) {
          const currentScaleX = Math.abs(Number(o.scaleX ?? 1)) || 1
          const currentScaleY = Math.abs(Number(o.scaleY ?? 1)) || 1
          o.set?.({
            scaleX: currentScaleX * visualRatio,
            scaleY: currentScaleY * visualRatio,
            dirty: true
          })
        }
      }
      o.setCoords?.()

      ;(o as any).__manualTransformCardW = w
      ;(o as any).__manualTransformCardH = h
    }
    objects.forEach((o: any) => maybeRescaleManualTransforms(o))

    // 1. Background Fill
    if (bg) {
      if (bg.type === 'rect') {
        // Keep the background centered on the group origin to avoid drifting bounds/selection boxes.
        bg.set({
          width: w,
          height: h,
          scaleX: 1,
          scaleY: 1,
          originX: 'center',
          originY: 'center',
          left: 0,
          top: 0
        })

        if (styles) {
          // Só aplicar cor se o card já tinha uma cor definida (não forçar cor em cards transparentes)
          const currentFill = typeof bg.fill === 'string' ? bg.fill : ''
          const hadExplicitBg = currentFill && currentFill !== 'transparent' && currentFill !== ''
          if (styles.isProdBgTransparent) bg.set('fill', 'transparent')
          else if (styles.cardColor && hadExplicitBg) bg.set('fill', styles.cardColor)
          if (typeof styles.cardBorderRadius === 'number') bg.set({ rx: styles.cardBorderRadius, ry: styles.cardBorderRadius })

          // Apply border color and width.
          // If width is 0, keep border fully disabled (default cards without outline).
          if (styles.cardBorderColor) {
            const borderWidth = Math.max(0, Number(styles.cardBorderWidth ?? 0))
            if (borderWidth > 0) {
              bg.set('stroke', styles.cardBorderColor)
              bg.set('strokeWidth', borderWidth)
            } else {
              bg.set('stroke', undefined)
              bg.set('strokeWidth', 0)
            }
          } else if (typeof styles.cardBorderWidth === 'number') {
            const borderWidth = Math.max(0, Number(styles.cardBorderWidth ?? 0))
            if (borderWidth > 0) {
              bg.set('strokeWidth', borderWidth)
            } else {
              bg.set('stroke', undefined)
              bg.set('strokeWidth', 0)
            }
          }
        }
      } else {
        bg.set({ scaleX: w / bg.width, scaleY: h / bg.height, left: 0, top: 0, originX: 'center', originY: 'center' })
      }
    }

    // 2. Title (Top)
    let titleH = 0
    if (title) {
      const persistedTitleWidth = Number((group as any)?._productData?.titleTextWidth)
      const persistedTitleWidthRatio = Number((group as any)?._productData?.titleTextWidthRatio)
      if (
        !(title as any).__manualTransform &&
        (
          (Number.isFinite(persistedTitleWidthRatio) && persistedTitleWidthRatio > 0) ||
          (Number.isFinite(persistedTitleWidth) && persistedTitleWidth > 0)
        )
      ) {
        ;(title as any).__manualTransform = true
        if (Number.isFinite(persistedTitleWidth) && persistedTitleWidth > 0) {
          ;(title as any).__manualTextWidth = persistedTitleWidth
        }
        if (Number.isFinite(persistedTitleWidthRatio) && persistedTitleWidthRatio > 0) {
          ;(title as any).__manualTextWidthRatio = Math.min(1, Math.max(0.1, persistedTitleWidthRatio))
        }
        if (w > 0) (title as any).__manualTransformCardW = w
        if (h > 0) (title as any).__manualTransformCardH = h
      }
      // Margin Top: 5% of height
      const marginTop = h * 0.05
      const _rawNameOffY = typeof styles?.prodNameOffsetY === 'number' ? styles.prodNameOffsetY : 0
      const titleOffsetY = _rawNameOffY * (h / _refH)
      if (!isManual(title)) {
        title.set({
          originX: 'center',
          originY: 'top',
          left: 0,
          top: -halfH + marginTop + titleOffsetY,
          scaleX: 1,
          scaleY: 1
        })
      }

      if (styles) {
        if (styles.prodNameFont) title.set('fontFamily', styles.prodNameFont)
        if (styles.prodNameColor) title.set('fill', styles.prodNameColor)
        if (styles.prodNameWeight !== undefined) title.set('fontWeight', styles.prodNameWeight as any)
        if (styles.prodNameAlign) title.set('textAlign', styles.prodNameAlign)
        if (typeof styles.prodNameLineHeight === 'number') title.set('lineHeight', styles.prodNameLineHeight)

        const rawKey = '__rawText'
        const curText = String((title as any).text ?? '')
        if (typeof (title as any)[rawKey] !== 'string') (title as any)[rawKey] = curText
        const mode = styles.prodNameTransform ?? 'none'
        if (mode === 'none') {
          ;(title as any)[rawKey] = curText
        } else {
          const baseText = String((title as any)[rawKey] ?? curText)
          const nextText = mode === 'upper' ? baseText.toUpperCase() : mode === 'lower' ? baseText.toLowerCase() : baseText
          if (nextText !== curText) title.set('text', nextText)
        }

        const scale = typeof styles.prodNameScale === 'number' ? styles.prodNameScale : 1
        const baseFont = baseSize * 0.09
        const nextFont = deps.clamp(baseFont * scale, 10, baseSize * 0.22)
        title.set('fontSize', nextFont)
      }

      // Responsive Text Width
      if (title.type === 'textbox') {
        const manualTitleWidth = Number((title as any).__manualTextWidth)
        const manualTitleWidthRatio = Number((title as any).__manualTextWidthRatio)
        let nextTitleWidth = w * 0.9 // default auto width
        if (isManual(title)) {
          if (Number.isFinite(manualTitleWidthRatio) && manualTitleWidthRatio > 0) {
            nextTitleWidth = w * manualTitleWidthRatio
          } else if (Number.isFinite(manualTitleWidth) && manualTitleWidth > 0) {
            nextTitleWidth = manualTitleWidth
          }
        }
        nextTitleWidth = deps.clamp(nextTitleWidth, 20, Math.max(20, w))
        title.set({ width: nextTitleWidth })
        if (isManual(title)) {
          ;(title as any).__manualTextWidth = nextTitleWidth
          const ratio = w > 0 ? (nextTitleWidth / w) : Number.NaN
          if (Number.isFinite(ratio) && ratio > 0) {
            ;(title as any).__manualTextWidthRatio = Math.min(1, Math.max(0.1, ratio))
          }
        }
        if (typeof title.initDimensions === 'function') title.initDimensions()
      } else {
        // Scale down if too wide
        if (title.width > w * 0.9) {
          title.scale((w * 0.9) / title.width)
        }
      }
      if (typeof title.initDimensions === 'function') title.initDimensions()
      titleH = title.getScaledHeight() + marginTop
    }

    // 2.1 Limit badge/text (Below Title)
    let limitH = 0
    if (limit && String(limit.type || '').includes('text')) {
      const marginTop = h * 0.05
      const gap = Math.max(4, h * 0.015)
      const _rawLimitNameOffY = typeof styles?.prodNameOffsetY === 'number' ? styles.prodNameOffsetY : 0
      const titleOffsetY = _rawLimitNameOffY * (h / _refH)

      const titleHeight = title ? (title.getScaledHeight?.() ?? title.height ?? 0) : 0
      if (!isManual(limit)) {
        limit.set({
          originX: 'center',
          originY: 'top',
          left: 0,
          top: -halfH + marginTop + titleOffsetY + titleHeight + gap,
          scaleX: 1,
          scaleY: 1
        })
      }

      if (styles) {
        if (styles.limitFont) limit.set('fontFamily', styles.limitFont)
        if (styles.limitColor) limit.set('fill', styles.limitColor)

        // Dynamic sizing: base on card size, and respect legacy `limitSize` as multiplier (default ~14).
        const mult = (typeof styles.limitSize === 'number' && styles.limitSize > 0) ? (styles.limitSize / 14) : 1
        const baseFont = baseSize * 0.045
        const nextFont = deps.clamp(baseFont * mult, 8, baseSize * 0.12)
        limit.set('fontSize', nextFont)
      } else {
        // Reasonable default if older cards have this text but no styles passed
        const baseFont = baseSize * 0.045
        limit.set('fontSize', deps.clamp(baseFont, 8, baseSize * 0.12))
      }

      // Hide if empty
      const txt = String((limit as any).text ?? '').trim()
      limit.visible = txt.length > 0

      if (limit.type === 'textbox') {
        limit.set({ width: w * 0.9 })
        if (typeof (limit as any).initDimensions === 'function') (limit as any).initDimensions()
      }

      if (typeof (limit as any).initDimensions === 'function') (limit as any).initDimensions()
      limitH = limit.visible ? ((limit.getScaledHeight?.() ?? 0) + gap) : 0
    }

    // 3. Bottom Element (Splash/Price)
    let bottomH = 0
    if (splash) {
      const marginBottom = h * 0.05
      const splashManual = isManualPricePosition(splash)
      let preserveTemplateVisual = false
      // "Ultima edicao vence": props sobrescritas explicitamente pelo painel da
      // zona reaplicam mesmo em resize/swap com layout manual preservado. Resolve
      // a zona pelo card (group); cards novos sem zona => sem override.
      // allowTypoApply le `preserveTemplateVisual` em tempo de chamada.
      const __ovZoneId = String((group as any)?.parentZoneId || '').trim()
      const zoneStyleOverrides = __ovZoneId ? deps.getZoneStyleOverrides(deps.findProductZoneById(__ovZoneId)) : {}
      const allowTypoApply = (prop: string) =>
        !preserveTemplateVisual
        || !!(zoneStyleOverrides as any)[prop]
        || Object.prototype.hasOwnProperty.call(__cardStyleOv, prop)
      let layoutScaleX = 1
      let layoutScaleY = 1
      const manualScaleX = Math.abs(Number((splash as any)?.__manualScaleX ?? 1)) || 1
      const manualScaleY = Math.abs(Number((splash as any)?.__manualScaleY ?? 1)) || 1
      const hasManualScaleOverride = Math.abs(manualScaleX - 1) > 0.0001 || Math.abs(manualScaleY - 1) > 0.0001

      // layoutManualTemplateGroup normalizes the template group to the local
      // origin before fitting it to the new card. Preserve the anchor authored
      // by the user so a resize/reflow (for example after deleting a product)
      // changes only the label's size, not its position inside the card.
      const manualSplashAnchor = splashManual
        ? {
            left: Number.isFinite(Number((splash as any)?.left)) ? Number((splash as any).left) : 0,
            top: Number.isFinite(Number((splash as any)?.top)) ? Number((splash as any).top) : 0,
            originX: (splash as any)?.originX ?? 'center',
            originY: (splash as any)?.originY ?? 'center',
            angle: Number.isFinite(Number((splash as any)?.angle)) ? Number((splash as any).angle) : 0
          }
        : null

      if ((splash as any).objectCaching) (splash as any).objectCaching = false
      if ((splash as any).statefullCache) (splash as any).statefullCache = false

      // Extract priceBg for later use (shadow update needs pillH from layout)
      let priceBg: any = null

      if (splash.type === 'group' && splash.name === 'priceGroup') {
        preserveTemplateVisual = deps.shouldPreserveManualTemplateVisual(splash)
        // Apply label styling overrides (local to the selected zone/design; never mutates templates).
        if (styles && typeof splash.getObjects === 'function') {
          const parts = deps.collectObjectsDeep(splash)
          const getName = (o: any) => String(o?.name || '')
          const priceBgNames = new Set(['price_bg', 'atac_retail_bg', 'atac_wholesale_bg'])
          const currencyTextNames = new Set(['price_currency_text', 'retail_currency_text', 'wholesale_currency_text'])
          const integerTextNames = new Set(['price_integer_text', 'retail_integer_text', 'wholesale_integer_text'])
          const decimalTextNames = new Set(['price_decimal_text', 'retail_decimal_text', 'wholesale_decimal_text'])
          const priceTextNames = new Set([
            'price_integer_text',
            'price_decimal_text',
            'price_unit_text',
            'price_value_text',
            'retail_price_text',
            'retail_integer_text',
            'retail_decimal_text',
            'retail_unit_text',
            'wholesale_price_text',
            'wholesale_integer_text',
            'wholesale_decimal_text',
            'wholesale_unit_text'
          ])
          const allPriceBgs = parts.filter((o: any) => priceBgNames.has(getName(o)))
          const currencyTexts = parts.filter((o: any) => currencyTextNames.has(getName(o)) && deps.isTextLikeObject(o))
          const integerTexts = parts.filter((o: any) => integerTextNames.has(getName(o)) && deps.isTextLikeObject(o))
          const decimalTexts = parts.filter((o: any) => decimalTextNames.has(getName(o)) && deps.isTextLikeObject(o))
          const priceTexts = parts.filter((o: any) => priceTextNames.has(getName(o)) && deps.isTextLikeObject(o))
          priceBg = allPriceBgs[0] || null
          const normalizeColorToken = (value: any) => {
            const raw = String(value ?? '').trim().toLowerCase()
            if (!raw) return ''
            return raw.startsWith('#') ? raw : `#${raw}`
          }
          const defaultSplashTextColor = normalizeColorToken(deps.defaultGlobalStyles.splashTextColor || '')

          const accent = styles.splashColor ?? styles.accentColor
          // A template's own artwork is authoritative until the user explicitly
          // changes that property in the zone/card controls. This is important
          // during unrelated relayouts (for example a card-layout update): the
          // persisted quick-editor theme may still contain its old red defaults,
          // but those values must not repaint every selected label.
          const hasZoneAccentOverride = !!(zoneStyleOverrides as any).splashColor || !!(zoneStyleOverrides as any).accentColor
          const hasZoneFillOverride = !!(zoneStyleOverrides as any).splashFill
          const hasZoneRoundnessOverride = !!(zoneStyleOverrides as any).splashRoundness
          const hasCardAccentOverride = Object.prototype.hasOwnProperty.call(__cardStyleOv, 'splashColor') || Object.prototype.hasOwnProperty.call(__cardStyleOv, 'accentColor')
          const hasCardFillOverride = Object.prototype.hasOwnProperty.call(__cardStyleOv, 'splashFill')
          const hasCardRoundnessOverride = Object.prototype.hasOwnProperty.call(__cardStyleOv, 'splashRoundness')
          const hasExplicitAccent = !!String(accent ?? '').trim() && (
            !preserveTemplateVisual || hasZoneAccentOverride || hasCardAccentOverride
          )
          const hasExplicitFill = typeof styles.splashFill === 'string' && styles.splashFill.trim().length > 0 && (
            !preserveTemplateVisual || hasZoneFillOverride || hasCardFillOverride
          )
          const hasExplicitRoundness = typeof styles.splashRoundness === 'number' && (
            !preserveTemplateVisual || hasZoneRoundnessOverride || hasCardRoundnessOverride
          )
          const hasExplicitStrokeWidth = typeof styles.splashStrokeWidth === 'number' && Number.isFinite(styles.splashStrokeWidth)
          const hasExplicitPriceTextColor = typeof styles.priceTextColor === 'string' && styles.priceTextColor.trim().length > 0
          const hasExplicitSplashTextColor = typeof styles.splashTextColor === 'string' && styles.splashTextColor.trim().length > 0 && (
            !preserveTemplateVisual || normalizeColorToken(styles.splashTextColor) !== defaultSplashTextColor
          )
          const hasExplicitCurrencyColor = typeof styles.priceCurrencyColor === 'string' && styles.priceCurrencyColor.trim().length > 0

          allPriceBgs.forEach((bg: any) => {
            // Apply styles to price background
            // Priority: explicit splashFill > template fill > default
            if (hasExplicitFill) {
              bg.set('fill', styles.splashFill)
            }
            if (hasExplicitRoundness && typeof styles.splashRoundness === 'number') {
              const roundness = deps.clamp(styles.splashRoundness, 0, 1)
              ;(bg as any).__roundness = roundness
              if (String(bg?.type || '').toLowerCase() === 'rect') {
                const hRaw = Number(bg.height || 0)
                if (Number.isFinite(hRaw) && hRaw > 0) {
                  const radius = (hRaw / 2) * roundness
                  bg.set({ rx: radius, ry: radius })
                }
              }
            }
            if (hasExplicitStrokeWidth) {
              const strokeVal = Math.max(0, Number(styles.splashStrokeWidth) || 0)
              ;(bg as any).__strokeWidth = strokeVal
              if (!preserveTemplateVisual) bg.set('strokeWidth', strokeVal)
            }

            // Apply accent/splash color - always apply if set, regardless of template
            // This allows users to override template colors with zone styles
            if (hasExplicitAccent && accent) {
              bg.set('stroke', accent)
            }
          })

          const applyTextShared = (t: any) => {
            if (!t || !String(t.type || '').includes('text')) return
            const applyRichStyle = (property: string, value: any) => {
              if (isRichPriceTextObject(t)) {
                setRichPriceSegmentStyle(t, 'integer', { [property]: value })
                setRichPriceSegmentStyle(t, 'decimal', { [property]: value })
              }
              t.set(property, value)
            }
            // Resize/troca automatica nao sobrescreve a tipografia autorada no
            // Mini Editor — EXCETO quando o usuario sobrescreveu a prop pelo
            // painel (override explicito: "ultima edicao vence").
            if (allowTypoApply('priceFont') && styles.priceFont) applyRichStyle('fontFamily', styles.priceFont)
            if (allowTypoApply('priceFontWeight') && styles.priceFontWeight !== undefined) {
              applyRichStyle('fontWeight', styles.priceFontWeight as any)
            }
            if (allowTypoApply('priceFontStyle')) {
              applyRichStyle('fontStyle', styles.priceFontStyle === 'italic' ? 'italic' : 'normal')
            }

            const mult = allowTypoApply('splashTextScale') && typeof styles.splashTextScale === 'number' ? styles.splashTextScale : 1
            if (allowTypoApply('splashTextScale') && typeof t.__fontScale === 'number') {
              if (typeof t.__fontScaleBase !== 'number') t.__fontScaleBase = t.__fontScale
              t.__fontScale = t.__fontScaleBase * mult
            }
            if (typeof t.initDimensions === 'function') t.initDimensions()
          }

          const applyPriceText = (t: any) => {
            applyTextShared(t)
            if (!t || !String(t.type || '').includes('text')) return
            // Apply text color if set (explicit override)
            if (hasExplicitPriceTextColor) {
              if (isRichPriceTextObject(t)) {
                setRichPriceSegmentStyle(t, 'integer', { fill: styles.priceTextColor })
                setRichPriceSegmentStyle(t, 'decimal', { fill: styles.priceTextColor })
              }
              t.set('fill', styles.priceTextColor)
            }
            else if ((!preserveTemplateVisual && typeof styles.splashTextColor === 'string' && styles.splashTextColor.trim())
              || (preserveTemplateVisual && hasExplicitSplashTextColor)) {
              if (isRichPriceTextObject(t)) {
                setRichPriceSegmentStyle(t, 'integer', { fill: styles.splashTextColor })
                setRichPriceSegmentStyle(t, 'decimal', { fill: styles.splashTextColor })
              }
              t.set('fill', styles.splashTextColor)
            }
          }

          const applyCurrencyText = (t: any) => {
            applyTextShared(t)
            if (!t || !String(t.type || '').includes('text')) return
            // Apply currency color if explicitly set
            if (hasExplicitCurrencyColor) t.set('fill', styles.priceCurrencyColor)
          }

          currencyTexts.forEach(applyCurrencyText)
          priceTexts.forEach(applyPriceText)
          if (styles.currencySymbol !== undefined) {
            currencyTexts.forEach((ct: any) => {
              ct.set('text', String(styles.currencySymbol))
              if (typeof ct.initDimensions === 'function') ct.initDimensions()
            })
          }
          if (allowTypoApply('priceFontSize') && typeof styles.priceFontSize === 'number' && Number.isFinite(styles.priceFontSize) && styles.priceFontSize > 0) {
            const baseFontSize = styles.priceFontSize
            ;(splash as any).__priceFontSizeOverride = baseFontSize
            priceTexts.filter((txt: any) => isRichPriceTextObject(txt)).forEach((txt: any) => {
              setRichPriceBaseFontSize(txt, baseFontSize)
              setRichPriceSegmentStyle(txt, 'integer', { fontSize: baseFontSize })
              setRichPriceSegmentStyle(txt, 'decimal', { fontSize: Math.round(baseFontSize * 0.6) })
            })
            integerTexts.forEach((txt: any) => {
              txt.set('fontSize', baseFontSize)
              if (typeof txt.initDimensions === 'function') txt.initDimensions()
            })
            decimalTexts.forEach((txt: any) => {
              txt.set('fontSize', Math.round(baseFontSize * 0.6))
              if (typeof txt.initDimensions === 'function') txt.initDimensions()
            })
          }
        }

        // Propagar splashTextScale como metadado para as funções de layout.
        // Com layout manual preservado mantemos escala 1, salvo override explicito
        // de splashTextScale pelo painel ("ultima edicao vence").
        ;(splash as any).__splashTextScale = allowTypoApply('splashTextScale')
          ? (typeof styles?.splashTextScale === 'number' ? styles!.splashTextScale! : 1)
          : 1

        // Use reference cell dimensions (from zone layout) so that pill size
        // is uniform across highlight and normal cards.
        const _refW = Number((styles as any)?.__refCellW) || w
        // _refH already declared in outer scope with same value — reuse it
        const layout = deps.layoutPriceGroup(splash, _refW, _refH)

        if (layout) {
          const { pillH } = layout
          // fitScale: escala que layoutPriceGroup aplicou para caber no card.
          // Este é o "base scale" — splashScale multiplica por cima dele.
          const fitScaleX = Math.abs(Number(splash.scaleX)) || 1
          const fitScaleY = Math.abs(Number(splash.scaleY)) || 1
          const rawScale = typeof styles?.splashScale === 'number' ? styles!.splashScale! : 1
          const rawOffsetY = typeof styles?.splashOffsetY === 'number' ? styles!.splashOffsetY! : 0
          const scale = rawScale
          // Scale offsetY proportionally so the displacement looks the same
          // on highlight (taller) and normal cards.
          const offsetY = rawOffsetY * (h / _refH)

          // Update shadow color to match accent (after we have pillH for proper blur calculation)
          const accent = styles?.splashColor ?? styles?.accentColor
          if (!preserveTemplateVisual && accent && priceBg && fabric?.Shadow) {
            priceBg.set('stroke', accent)
            const blur = Math.max(6, Math.min(26, pillH * 0.22))
            priceBg.set('shadow', new fabric.Shadow({ color: accent, blur, offsetX: 0, offsetY: 0 }))
          }

          // Force dirty flag to ensure Fabric.js updates the object
          splash.dirty = true

          if (!splashManual) {
            const newTop = halfH - ((pillH * scale) / 2) - marginBottom + offsetY
            // Para manual templates, fitScale é a escala base que o layout calculou.
            // Guardar como __originalScale ANTES de multiplicar por splashScale.
            if (preserveTemplateVisual) {
              ;(splash as any).__originalScaleX = fitScaleX
              ;(splash as any).__originalScaleY = fitScaleY
            }
            const finalScaleX = preserveTemplateVisual ? (fitScaleX * scale * manualScaleX) : (scale * manualScaleX)
            const finalScaleY = preserveTemplateVisual ? (fitScaleY * scale * manualScaleY) : (scale * manualScaleY)
            splash.set({
              scaleX: finalScaleX,
              scaleY: finalScaleY,
              originX: 'center',
              originY: 'center',
              left: 0,
              top: newTop
            })
          } else {
            // Manual positioning: keep left/top, but still apply the zone-level scale.
            if (preserveTemplateVisual) {
              ;(splash as any).__originalScaleX = fitScaleX
              ;(splash as any).__originalScaleY = fitScaleY
            }
            const finalScaleX = preserveTemplateVisual ? (fitScaleX * scale * manualScaleX) : (scale * manualScaleX)
            const finalScaleY = preserveTemplateVisual ? (fitScaleY * scale * manualScaleY) : (scale * manualScaleY)
            splash.set({
              scaleX: finalScaleX,
              scaleY: finalScaleY,
              ...(manualSplashAnchor || {})
            })
          }

          if (!splashManual && !hasManualScaleOverride) {
            deps.normalizePriceGroupPlacementInCard(splash, w, h, null)
          }

          // Force coordinate update
          splash.setCoords()

          bottomH = (pillH * scale * manualScaleY) + marginBottom
        } else {
          // Fallback to generic scaling for older cards without named parts
          // Apply global styles even in fallback mode
          const globalScale = typeof styles?.splashScale === 'number' ? styles!.splashScale! : 1
          const _rawOffY = typeof styles?.splashOffsetY === 'number' ? styles!.splashOffsetY! : 0
          const offsetY = _rawOffY * (h / _refH)

          // Calcular escala proporcional ao tamanho do card sem acumulação.
          // Usar tamanho de referência fixo (300px) para evitar capturar valores inflados.
          const SPLASH_REF_WIDTH = 300
          const sizeRatio = Math.max(0.3, Math.min(3, w / SPLASH_REF_WIDTH))
          let sScaleX = sizeRatio * globalScale * manualScaleX
          let sScaleY = sizeRatio * globalScale * manualScaleY

          // Force dirty flag to ensure Fabric.js updates the object
          splash.dirty = true

          if (!splashManual) {
            const newTop = halfH - marginBottom + offsetY
            splash.set({
              scaleX: sScaleX,
              scaleY: sScaleY,
              originX: 'center',
              originY: 'bottom',
              left: 0,
              top: newTop
            })
          } else {
            splash.set({
              scaleX: sScaleX,
              scaleY: sScaleY,
              ...(manualSplashAnchor || {})
            })
          }

          // Force coordinate update
          splash.setCoords()

          bottomH = (splash.height * sScaleY) + marginBottom
        }
      } else {
        const globalScale = typeof styles?.splashScale === 'number' ? styles!.splashScale! : 1
        const _rawOffY2 = typeof styles?.splashOffsetY === 'number' ? styles!.splashOffsetY! : 0
        const offsetY = _rawOffY2 * (h / _refH)

        if (typeof (splash as any).__originalScaleX !== 'number') {
          ;(splash as any).__originalScaleX = splash.scaleX || 1
          ;(splash as any).__originalScaleY = splash.scaleY || 1
        }

        const baseScaleX = (splash as any).__originalScaleX || 1
        const baseScaleY = (splash as any).__originalScaleY || 1
        const sScaleX = baseScaleX * globalScale
        const sScaleY = baseScaleY * globalScale

        if (!splashManual) {
          splash.set({
            scaleX: sScaleX,
            scaleY: sScaleY,
            originX: 'center',
            originY: 'bottom',
            left: 0,
            top: halfH - marginBottom + offsetY
          })
        } else {
          splash.set({
            scaleX: sScaleX,
            scaleY: sScaleY,
            ...(manualSplashAnchor || {})
          })
        }

        bottomH = (splash.height * sScaleY) + marginBottom
      }

      // If the user positioned the splash manually, reserve space based on its current size,
      // not the auto-layout computation above (prevents image layout from hiding it).
      if (splashManual) {
        const sh = typeof splash.getScaledHeight === 'function'
          ? splash.getScaledHeight()
          : (Number(splash.height || 0) * Number(splash.scaleY || 1))
        bottomH = Math.max(0, Number(sh) || 0) + marginBottom
      }
    }

    // 4. Image (Middle - Object Fit: Contain)
    if (img) {
      const imgManual = isManual(img)
      const availH = h - titleH - limitH - bottomH - 20 // 20px buffer
      const availW = w * 0.9

      // Product images inside cards should never flip during resize interactions.
      img.set({
        lockScalingFlip: true,
        lockSkewingX: true,
        lockSkewingY: true,
        flipX: false,
        flipY: false
      })
      if ((Number(img.scaleX ?? 1) || 1) < 0) img.set('scaleX', Math.abs(Number(img.scaleX ?? 1)) || 1)
      if ((Number(img.scaleY ?? 1) || 1) < 0) img.set('scaleY', Math.abs(Number(img.scaleY ?? 1)) || 1)

      if (availH > 20) {
        // Restore scale 1 to measure
        const currentScale = img.scaleX
        // We use raw img.width/height assuming scale=1 is base assets.

        const iW = img.width
        const iH = img.height
        const iRatio = iW / iH
        const availRatio = availW / availH

        let scale = 1
        if (iRatio > availRatio) {
          // Width constrained
          scale = availW / iW
        } else {
          // Height constrained
          scale = availH / iH
        }

        // Center in available space
        // Space starts at: -halfH + titleH
        // Space center: (-halfH + titleH) + (availH / 2)
        const centerY = (-halfH + titleH + limitH) + (availH / 2)

        img.visible = true
        if (!imgManual) {
          img.set({
            scaleX: scale,
            scaleY: scale,
            originX: 'center',
            originY: 'center',
            left: 0,
            top: centerY
          })
        }
      } else {
        // Hide only when auto-layout controls the image; a manual image should remain visible.
        if (!imgManual) img.visible = false
        else img.visible = true
      }
    }

    // A receita externa deve vencer o auto-layout legado depois que nome,
    // imagem, limite e etiqueta de preco ja foram recalculados para o novo
    // tamanho da celula.
    deps.applyProductCardConfigurationLayout(group, w, h, styles)

    // Keep user-positioned inner elements inside the card bounds after any resize/relayout.
    // This avoids "teleporting" on reload when the card size changes (zone preset/columns/etc.).
    const clampChildToCard = (obj: any) => {
      if (!obj || typeof obj.getScaledWidth !== 'function' || typeof obj.getScaledHeight !== 'function') return
      const objW = obj.getScaledWidth()
      const objH = obj.getScaledHeight()
      let minX = -halfW
      let maxX = halfW
      let minY = -halfH
      let maxY = halfH
      if (obj.originX === 'center') { minX = -halfW + objW / 2; maxX = halfW - objW / 2 }
      else if (obj.originX === 'left') { maxX = halfW - objW }
      if (obj.originY === 'center') { minY = -halfH + objH / 2; maxY = halfH - objH / 2 }
      else if (obj.originY === 'top') { maxY = halfH - objH }
      if (minX > maxX) { const t = minX; minX = maxX; maxX = t }
      if (minY > maxY) { const t = minY; minY = maxY; maxY = t }
      if (typeof obj.left === 'number') obj.left = Math.min(maxX, Math.max(minX, obj.left))
      if (typeof obj.top === 'number') obj.top = Math.min(maxY, Math.max(minY, obj.top))
      obj.setCoords?.()
    }
    objects.forEach((o: any) => {
      if (!o || o === bg) return
      const allowOverflowOutsideCard = o === splash || String(o?.name || '') === 'priceGroup'
      if (isManual(o) && !allowOverflowOutsideCard) clampChildToCard(o)
    })

    // Ensure stacking order stays predictable (image should not hide the title).
    // We reorder via the internal array to avoid coordinate transforms from remove/add.
    const stackList = (group as any)?._objects
    if (Array.isArray(stackList)) {
      const moveToIndex = (obj: any, index: number) => {
        if (!obj) return
        const from = stackList.indexOf(obj)
        if (from === -1) return
        stackList.splice(from, 1)
        const to = Math.max(0, Math.min(index, stackList.length))
        stackList.splice(to, 0, obj)
      }
      const moveToEnd = (obj: any) => moveToIndex(obj, stackList.length)
      moveToIndex(bg, 0)
      moveToIndex(img, 1)
      // Mantem a informacao textual acima da etiqueta quando as areas
      // configuradas se sobrepoem; a receita do card deve continuar legivel.
      moveToEnd(splash)
      moveToEnd(title)
      moveToEnd(limit)
      if (typeof (group as any)._onStackOrderChanged === 'function') {
        (group as any)._onStackOrderChanged()
      }
    }

    ;(group as any)._cardWidth = w
    ;(group as any)._cardHeight = h
    // CRITICAL: Do NOT call safeAddWithUpdate(group) — Fabric's LayoutManager recalculates
    // bounds from ALL children. If splash/shadows extend beyond the intended w×h, Fabric
    // expands the group and shifts its center, causing the background to be offset and the
    // splash/price label to visually ESCAPE the card. Instead, freeze the group dimensions.
    group.set({ width: w, height: h })
    // Update coords for all children (replaces _updateObjectsCoords that safeAddWithUpdate would do)
    objects.forEach((o: any) => {
      if (o && typeof o.setCoords === 'function') o.setCoords()
    })
    syncProductNameColor(group, styles)
    group.dirty = true
    if (typeof group.setCoords === 'function') group.setCoords()

    // LayoutManager is permanently disabled (no-op) at the top of this function.
    // No wrapper needed — dimensions are explicitly set by resizeSmartObject.
  }

  return resizeSmartObject
}
