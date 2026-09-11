import { fitResponsiveProductTypography } from './productCardResponsiveTypography'
import { autoTrimFabricImage } from './fabricImageHelpers'
import { planAutomaticProductImageFill } from './automaticProductImageFill'
import type { GlobalStyles } from '~/types/product-zone'
import {
  isAlcoholicProduct,
  normalizeProductCardConfiguration,
  PRODUCT_CARD_CONFIGURATION_PROFILE_KEYS,
  resolveProductCardConfigurationProfile,
  PRODUCT_ALCOHOL_BADGE_ASSET_URL
} from './product-card-configuration'
import { collectObjectsDeep } from './fabricObjectClassifiers'
import { collectDirectProductCardImages } from './productImageComposition'
import { clamp } from './mathHelpers'
import { DEFAULT_EDITOR_FONT_FAMILY } from './font-catalog'

const trimmedProductElements = new WeakMap<object, object>()

/**
 * Mantém um elemento automático dentro do retângulo do card.
 *
 * As receitas são percentuais e podem vir de versões antigas que foram
 * configuradas com x + largura/2 > 100 (ou x - largura/2 < 0). Sem esta
 * guarda, a imagem/etiqueta de um card invade o card vizinho e parece estar
 * vinculada ao produto errado. Transformações manuais continuam intocadas.
 */
const clampAutomaticElementToCard = (object: any, cardWidth: number, cardHeight: number) => {
  if (!object) return

  const width = Math.abs(Number(object.width || 0)) * (Math.abs(Number(object.scaleX ?? 1)) || 1)
  const height = Math.abs(Number(object.height || 0)) * (Math.abs(Number(object.scaleY ?? 1)) || 1)
  if (!(width > 0) || !(height > 0)) return

  const angle = (Number(object.angle || 0) * Math.PI) / 180
  const sin = Math.abs(Math.sin(angle))
  const cos = Math.abs(Math.cos(angle))
  let extentX = (width * cos + height * sin) / 2
  let extentY = (width * sin + height * cos) / 2
  const halfCardWidth = Math.max(1, Math.abs(Number(cardWidth || 0)) / 2)
  const halfCardHeight = Math.max(1, Math.abs(Number(cardHeight || 0)) / 2)

  // A rotação pode fazer um elemento 100%-wide exceder o card. Reduzimos
  // somente a escala automática nesse caso; filhos manuais são ignorados.
  const fitScale = Math.min(
    extentX > halfCardWidth ? halfCardWidth / extentX : 1,
    extentY > halfCardHeight ? halfCardHeight / extentY : 1
  )
  if (Number.isFinite(fitScale) && fitScale > 0 && fitScale < 1) {
    object.set?.({
      scaleX: (Number(object.scaleX ?? 1) || 1) * fitScale,
      scaleY: (Number(object.scaleY ?? 1) || 1) * fitScale
    })
    extentX *= fitScale
    extentY *= fitScale
  }

  const left = Number(object.left)
  const top = Number(object.top)
  if (Number.isFinite(left)) {
    object.set?.('left', clamp(left, -halfCardWidth + extentX, halfCardWidth - extentX))
  }
  if (Number.isFinite(top)) {
    object.set?.('top', clamp(top, -halfCardHeight + extentY, halfCardHeight - extentY))
  }
  object.setCoords?.()
}

type ProductCardConfigurationDeps = {
  fabric: () => any
  enableCardElementRotationControl: (object: any, enabled?: boolean) => void
  safeRequestRenderAll: () => void
  getPriceGroupFromAny: (object: any) => any
}

export const createProductCardConfigurationLayout = (deps: ProductCardConfigurationDeps) => {
  let productAlcoholBadgeElementPromise: Promise<HTMLImageElement | null> | null = null

  const createProductAlcoholBadgeFallbackObject = (label: unknown, baseSize: number): any | null => {
    const fabric = deps.fabric()
    if (!fabric?.Rect || !fabric?.Text || !fabric?.Group) return null

    const text = String(label ?? '+18').trim().slice(0, 12) || '+18'
    const safeBaseSize = Math.max(40, Number(baseSize) || 120)
    const badgeWidth = clamp(safeBaseSize * 0.26, 34, 92)
    const badgeHeight = clamp(safeBaseSize * 0.16, 22, 52)
    const badgeRadius = Math.min(10, badgeHeight / 2)

    const background = new fabric.Rect({
      width: badgeWidth,
      height: badgeHeight,
      fill: '#111827',
      rx: badgeRadius,
      ry: badgeRadius,
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      name: 'smart_alcohol_badge_background',
      selectable: false,
      evented: false
    })
    const badgeText = new fabric.Text(text, {
      fontSize: Math.max(9, badgeHeight * 0.48),
      fontFamily: DEFAULT_EDITOR_FONT_FAMILY,
      fontWeight: '900',
      fill: '#ffffff',
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      name: 'smart_alcohol_badge_text',
      selectable: false,
      evented: false
    })

    return new fabric.Group([background, badgeText], {
      name: 'smart_alcohol_badge',
      data: { smartType: 'product-alcohol-badge' },
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      visible: false,
      selectable: false,
      evented: false,
      subTargetCheck: false,
      interactive: false,
      objectCaching: false,
      statefullCache: false
    })
  }

  const applyAlcoholBadgeTransparentEdges = (image: any) => {
    const fabric = deps.fabric()
    if (!image || String(image?.type || '').toLowerCase() !== 'image' || !fabric?.Circle) return

    const width = Math.abs(Number(image.width || 0))
    const height = Math.abs(Number(image.height || 0))
    const radius = Math.max(1, Math.min(width, height) / 2)
    if (!Number.isFinite(radius) || radius <= 0) return

    const currentClip = image.clipPath
    if (currentClip && String(currentClip.type || '').toLowerCase() === 'circle' && typeof currentClip.set === 'function') {
      currentClip.set({
        radius,
        left: 0,
        top: 0,
        originX: 'center',
        originY: 'center'
      })
    } else {
      image.set('clipPath', new fabric.Circle({
        radius,
        left: 0,
        top: 0,
        originX: 'center',
        originY: 'center'
      }))
    }

    image.set({ objectCaching: false })
    image.dirty = true
  }

  const loadProductAlcoholBadgeElement = (): Promise<HTMLImageElement | null> => {
    if (!import.meta.client || typeof window === 'undefined') return Promise.resolve(null)
    if (productAlcoholBadgeElementPromise) return productAlcoholBadgeElementPromise

    productAlcoholBadgeElementPromise = new Promise((resolve) => {
      const element = new window.Image()
      element.crossOrigin = 'anonymous'
      element.onload = () => resolve(element)
      element.onerror = () => resolve(null)
      element.src = PRODUCT_ALCOHOL_BADGE_ASSET_URL
    })
    return productAlcoholBadgeElementPromise
  }

  const createProductAlcoholBadgeObject = async (label: unknown, baseSize: number): Promise<any | null> => {
    const fabric = deps.fabric()
    const imageElement = await loadProductAlcoholBadgeElement()
    if (imageElement && fabric?.Image && fabric?.Group) {
      const image = new fabric.Image(imageElement, {
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'smart_alcohol_badge_image',
        data: {
          smartType: 'product-alcohol-badge-image',
          assetUrl: PRODUCT_ALCOHOL_BADGE_ASSET_URL
        },
        selectable: false,
        evented: false
      })
      applyAlcoholBadgeTransparentEdges(image)
      return new fabric.Group([image], {
        name: 'smart_alcohol_badge',
        data: { smartType: 'product-alcohol-badge' },
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0,
        visible: false,
        selectable: false,
        evented: false,
        subTargetCheck: false,
        interactive: false,
        objectCaching: false,
        statefullCache: false
      })
    }

    return createProductAlcoholBadgeFallbackObject(label, baseSize)
  }

  const hasProductAlcoholBadgeAsset = (badge: any): boolean =>
    collectObjectsDeep(badge || {}).some((object: any) => (
      String(object?.name || '') === 'smart_alcohol_badge_image' ||
      String(object?.data?.assetUrl || '') === PRODUCT_ALCOHOL_BADGE_ASSET_URL
    ))

  const scheduleProductAlcoholBadgeAssetUpgrade = (
    group: any,
    width: number,
    height: number,
    styles: Partial<GlobalStyles>
  ) => {
    if (!group || (group as any).__alcoholBadgeAssetPending) return
    ;(group as any).__alcoholBadgeAssetPending = true

    void createProductAlcoholBadgeObject(
      (styles as any)?.cardLayout?.alcoholBadgeText,
      Math.min(width, height)
    ).then((badge) => {
      if (!badge || !hasProductAlcoholBadgeAsset(badge) || typeof group.getObjects !== 'function') return
      const existing = (group.getObjects() || []).find((object: any) => (
        String(object?.name || '') === 'smart_alcohol_badge'
      ))
      if (existing && hasProductAlcoholBadgeAsset(existing)) return
      if (existing && typeof group.remove === 'function') group.remove(existing)
      if (typeof group.add !== 'function') return
      group.add(badge)
      applyProductCardConfigurationLayout(group, width, height, styles)
      group.setCoords?.()
      deps.safeRequestRenderAll()
    }).catch((error) => {
      console.warn('[card-layout] Nao foi possivel carregar o selo oficial -18:', error)
    }).finally(() => {
      delete (group as any).__alcoholBadgeAssetPending
    })
  }

  const applyProductCardConfigurationLayout = (
    group: any,
    w: number,
    h: number,
    styles?: Partial<GlobalStyles>
  ) => {
    const rawConfiguration = styles && typeof styles.cardLayout === 'object'
      ? styles.cardLayout
      : null
    if (!group) return
    if (!rawConfiguration) {
      fitResponsiveProductTypography(group, w, h, styles?.prodNameScale ?? 1)
      return
    }

    const configuration = normalizeProductCardConfiguration(rawConfiguration)
    const selectedProfile = PRODUCT_CARD_CONFIGURATION_PROFILE_KEYS.find((key) => (
      key === String((group as any).__cardConfigurationProfile || '').trim()
    ))
    const cardProfile = selectedProfile && configuration.profiles?.[selectedProfile]
      ? configuration.profiles[selectedProfile]
      : resolveProductCardConfigurationProfile(
          configuration,
          w,
          h,
          {
            role: String((styles as any)?.role || ''),
            isHighlighted: !!(group as any).__isHighlighted
          }
        )
    const cardElements = cardProfile.elements
    let objects = typeof group.getObjects === 'function' ? (group.getObjects() || []) : []
    const productData = (group as any)._productData && typeof (group as any)._productData === 'object'
      ? (group as any)._productData
      : {}

    let alcoholBadge = objects.find((obj: any) => String(obj?.name || '') === 'smart_alcohol_badge') || null
    if (configuration.enabled && configuration.alcoholBadgeEnabled && (!alcoholBadge || !hasProductAlcoholBadgeAsset(alcoholBadge))) {
      scheduleProductAlcoholBadgeAssetUpgrade(group, w, h, styles || {})
      if (!alcoholBadge) {
        objects = typeof group.getObjects === 'function' ? (group.getObjects() || []) : objects
        alcoholBadge = objects.find((obj: any) => String(obj?.name || '') === 'smart_alcohol_badge') || null
      }
    }

    const alcoholBadgeImage = collectObjectsDeep(alcoholBadge || {}).find((object: any) => (
      String(object?.name || '') === 'smart_alcohol_badge_image' ||
      String(object?.data?.assetUrl || '') === PRODUCT_ALCOHOL_BADGE_ASSET_URL
    ))
    applyAlcoholBadgeTransparentEdges(alcoholBadgeImage)

    // Desligar a receita deixa o card no comportamento automatico legado, mas
    // nunca permite que um selo criado anteriormente fique visivel por engano.
    if (!configuration.enabled) {
      alcoholBadge?.set?.({ visible: false })
      fitResponsiveProductTypography(group, w, h, styles?.prodNameScale ?? 1)
      return
    }

    const title = objects.find((obj: any) => String(obj?.name || '') === 'smart_title') || null
    const limit = objects.find((obj: any) => (
      String(obj?.name || '') === 'smart_limit' ||
      String(obj?.name || '') === 'limitText' ||
      String(obj?.name || '') === 'product_limit' ||
      obj?.data?.smartType === 'product-limit'
    )) || null
    const legacyImage = objects.find((obj: any) => (
      String(obj?.name || '') === 'smart_image' ||
      obj?.data?.smartType === 'product-image'
    )) || null
    // Um card pode ter imagens duplicadas (a ação de duplicar mantém a cópia
    // dentro do mesmo grupo). Todas elas ocupam a mesma área configurada do
    // card: se apenas a primeira for reposicionada, a cópia conserva a
    // geometria antiga e fica deslocada após o redimensionamento da zona.
    // A coleção também reconhece nomes legados (`extra_image`, `smart_image`)
    // e filtra imagens que pertencem à própria etiqueta de preço.
    const productImages = collectDirectProductCardImages(group)
    const images = productImages.length > 0
      ? productImages
      : (legacyImage ? [legacyImage] : [])
    const price = deps.getPriceGroupFromAny(group) || objects.find((obj: any) => String(obj?.name || '') === 'priceGroup') || null

    const alcoholic = isAlcoholicProduct(productData)
    const badgeText = collectObjectsDeep(alcoholBadge || {}).find((obj: any) => (
      String(obj?.name || '') === 'smart_alcohol_badge_text'
    ))
    if (badgeText) {
      badgeText.set?.('text', configuration.alcoholBadgeText)
      badgeText.initDimensions?.()
    }

    const applyElement = (
      object: any,
      key: 'name' | 'image' | 'price' | 'alcoholBadge' | 'limit',
      options: { forceVisible?: boolean; textLike?: boolean } = {}
    ) => {
      if (!object) return
      const layout = cardElements[key]
      const shouldShow = options.forceVisible ?? (
        layout.visible && (key !== 'alcoholBadge' || configuration.alcoholBadgeEnabled) &&
        (key !== 'limit' || !!String(object.text || '').trim())
      )
      // O marcador genérico também é usado nos filhos internos da etiqueta
      // para preservar edições de tipografia/arte. Só o marcador específico
      // da posição externa deve impedir que a receita configurada em Cards
      // reposicione a etiqueta no card. O tamanho continua sendo controlado
      // pela receita, inclusive depois de um movimento manual.
      const preservesManualPosition = key === 'price' && !!(object as any).__manualPricePosition
      const preservesManualChildTransform = key !== 'price' && !!(object as any).__manualTransform
      object.set?.('visible', shouldShow)
      // A drag/resize made directly on a child of the card is an explicit user
      // choice. The legacy resize pipeline runs before this recipe during a
      // zone relayout and already rescales that manual transform against the
      // new card dimensions. Reapplying the configured x/y/scale here would
      // immediately teleport the child back to the recipe's default slot.
      // Keep visibility in sync with the recipe. Manual children remain intact;
      // the outer price group keeps only its authored anchor/rotation below.
      if (!shouldShow || preservesManualChildTransform) {
        object.setCoords?.()
        return
      }

      // A receita de Cards é porcentual e é a fonte de verdade do tamanho.
      // Não aplicar uma escala extra baseada na área do card: em cards grandes
      // isso fazia a etiqueta ultrapassar a composição definida em Estrutura
      // de zona e cards.
      const targetWidth = Math.max(1, w * (Math.min(layout.width, 2 * Math.min(layout.x, 100 - layout.x)) / 100))
      const targetHeight = Math.max(1, h * (Math.min(layout.height, 2 * Math.min(layout.y, 100 - layout.y)) / 100))
      if (!preservesManualPosition) {
        const targetLeft = ((layout.x / 100) - 0.5) * w
        const targetTop = ((layout.y / 100) - 0.5) * h
        object.set?.({
          originX: 'center',
          originY: 'center',
          left: targetLeft,
          top: targetTop,
          angle: Number.isFinite(Number(layout.rotation))
            ? Number(layout.rotation)
            : Number(object.angle || 0)
        })
      }
      deps.enableCardElementRotationControl(object, true)

      if (options.textLike) {
        object.set?.({ width: targetWidth, scaleX: 1, scaleY: 1 })
        object.initDimensions?.()
        const contentHeight = Math.abs(Number(object.getScaledHeight?.() || object.height || 0))
        if (contentHeight > targetHeight && contentHeight > 0) {
          // O nome deve continuar legivel mesmo quando uma etiqueta configurada
          // tem uma altura percentual pequena. Antes o calculo podia reduzir um
          // titulo longo para 35% apenas porque ele quebrou em duas linhas, o
          // que fazia cards identicos parecerem ter tipografias diferentes.
          // A configuracao continua definindo a area e a posicao; este piso
          // apenas evita o colapso visual do texto no render final.
          const minimumReadableScale = key === 'name' ? 0.9 : 0.35
          const scale = Math.max(minimumReadableScale, Math.min(1, targetHeight / contentHeight))
          object.set?.({ scaleX: scale, scaleY: scale })
        }
      } else {
        // Fabric Group can report bounds based on its nested children/layout
        // manager instead of the serialized width/height of the visual label.
        // Price groups are intentionally nested (background + rich price text),
        // so using getScaledHeight() here left an old, much taller label intact.
        // Prefer the group's own serialized dimensions for price and fall back
        // to Fabric's measured bounds for regular image/badge objects.
        const isNestedPriceGroup = key === 'price' && String(object?.type || '').toLowerCase() === 'group'
        const rawWidth = Math.abs(Number(object.width) || 0)
        const rawHeight = Math.abs(Number(object.height) || 0)
        const objectScaleX = Math.abs(Number(object.scaleX || 1)) || 1
        const objectScaleY = Math.abs(Number(object.scaleY || 1)) || 1
        const measuredWidth = Math.abs(Number(object.getScaledWidth?.() || 0))
        const measuredHeight = Math.abs(Number(object.getScaledHeight?.() || 0))
        const baseWidth = isNestedPriceGroup && rawWidth > 0
          ? rawWidth
          : measuredWidth > 0
            ? measuredWidth / objectScaleX
            : rawWidth
        const baseHeight = isNestedPriceGroup && rawHeight > 0
          ? rawHeight
          : measuredHeight > 0
            ? measuredHeight / objectScaleY
            : rawHeight
        if (baseWidth > 0 && baseHeight > 0) {
          const scale = Math.min(targetWidth / baseWidth, targetHeight / baseHeight)
          if (Number.isFinite(scale) && scale > 0) {
            object.set?.({
              // Recalcular a escala a partir da geometria base evita acumular
              // o scale anterior a cada reorganização da zona.
              scaleX: (Number(object.scaleX || 1) < 0 ? -1 : 1) * scale,
              scaleY: (Number(object.scaleY || 1) < 0 ? -1 : 1) * scale
            })
          }
        }
      }
      // Uma receita antiga/customizada pode colocar um elemento automático
      // parcialmente fora do card. O clamp só ocorre depois da escala final,
      // evitando que o cálculo use o tamanho anterior ao ajuste.
      clampAutomaticElementToCard(object, w, h)
      object.setCoords?.()
    }

    applyElement(title, 'name', { textLike: true })
    // Normalize imported copies once; later manual duplication remains untouched.
    if (group._productData?.autoFillImages === false && !group._productData.imageFillInitialized) {
      while (images.length > 1) group.remove(images.pop())
      group._productData.imageFillInitialized = true
    }
    images.forEach((productImage: any) => {
      const element = productImage.getElement?.()
      if (!productImage.__manualTransform && element && trimmedProductElements.get(productImage) !== element) {
        const result = autoTrimFabricImage(productImage, { preserveVisualPosition: false })
        if (!result.undecodable) trimmedProductElements.set(productImage, element)
      }
      applyElement(productImage, 'image')
    })
    if (group._productData?.autoFillImages && images.length && !images.some((image: any) => image.__manualTransform)) {
      const source = images[0]
      const layout = cardElements.image
      const plan = planAutomaticProductImageFill(w * Math.min(layout.width, 2 * Math.min(layout.x, 100 - layout.x)) / 100, h * Math.min(layout.height, 2 * Math.min(layout.y, 100 - layout.y)) / 100,
        Number(source.width), Number(source.height), group._productData.imageFillCount, group._productData.imageFillDirection)
      const fabric = deps.fabric()
      while (images.length < plan.length && fabric?.Image) {
        const copy = new fabric.Image(source.getElement(), {
          ...(() => { const props = source.toObject(); delete props.type; delete props.version; return props })(), name: `extra_image_${images.length}`,
          _customId: globalThis.crypto.randomUUID(),
          __originalSrc: source.__originalSrc,
          data: { ...source.data, smartType: 'product-image' }
        })
        group.add(copy)
        images.push(copy)
      }
      while (images.length > plan.length) group.remove(images.pop())
      const cx = (layout.x / 100 - 0.5) * w, cy = (layout.y / 100 - 0.5) * h
      images.forEach((image: any, index: number) => {
        const item = plan[index]!
        image.set({ left: cx + item.left, top: cy + item.top, originX: 'center', originY: 'center',
          scaleX: item.scale, scaleY: item.scale, angle: 0, visible: layout.visible })
        image.setCoords?.()
      })
    }

    applyElement(price, 'price')
    applyElement(limit, 'limit', { textLike: true })
    applyElement(alcoholBadge, 'alcoholBadge', {
      forceVisible: configuration.alcoholBadgeEnabled && cardElements.alcoholBadge.visible && alcoholic
    })

    // O selo fica acima da imagem. Nome e limite ficam no topo da pilha para
    // continuarem legiveis quando a area configurada encostar na etiqueta.
    const stackList = (group as any)?._objects
    if (Array.isArray(stackList)) {
      const moveToIndex = (object: any, index: number) => {
        if (!object) return
        const from = stackList.indexOf(object)
        if (from < 0) return
        stackList.splice(from, 1)
        stackList.splice(Math.max(0, Math.min(index, stackList.length)), 0, object)
      }
      moveToIndex(alcoholBadge, 2)
      const moveToEnd = (object: any) => {
        if (!object) return
        const from = stackList.indexOf(object)
        if (from < 0) return
        stackList.splice(from, 1)
        stackList.push(object)
      }
      moveToEnd(price)
      moveToEnd(title)
      moveToEnd(limit)
      if (typeof (group as any)._onStackOrderChanged === 'function') {
        (group as any)._onStackOrderChanged()
      }
    }

    fitResponsiveProductTypography(group, w, h, styles?.prodNameScale ?? 1)
    group.dirty = true
    group.setCoords?.()
  }

  return {
    createProductAlcoholBadgeObject,
    applyProductCardConfigurationLayout
  }
}
