import { detectImageTrimBounds } from './fabricImageHelpers'

/**
 * Ajusta a etiqueta de preco de um card de produto a largura visual da
 * imagem. O ajuste e intencionalmente feito no grupo inteiro para preservar
 * a geometria autorada da etiqueta (fontes, icones e cantos).
 *
 * A funcao e segura para Fabric e tambem pode ser usada em testes com objetos
 * duck-typed; ela nao depende de canvas, Vue ou estado global.
 */

export type ProductLabelSizingOptions = {
  /** Percentual da largura da imagem ocupado pela etiqueta. */
  imageWidthRatio?: number
  /** Piso relativo ao card para manter o preco legivel em imagens estreitas. */
  minCardWidthRatio?: number
  /** Teto relativo ao card para impedir que uma imagem grande estoure o card. */
  maxCardWidthRatio?: number
  /** Piso absoluto para cards muito pequenos. */
  minWidth?: number
  /** Respeita uma escala alterada explicitamente pelo usuario. */
  respectManualScale?: boolean
}

const finitePositive = (value: unknown, fallback = 0): number => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

const visualSize = (object: any, axis: 'width' | 'height'): number => {
  if (!object) return 0
  const getter = axis === 'width' ? object.getScaledWidth : object.getScaledHeight
  const measured = typeof getter === 'function' ? finitePositive(getter.call(object)) : 0
  if (measured > 0) return measured
  const raw = finitePositive(object[axis])
  const scale = Math.abs(Number(object[axis === 'width' ? 'scaleX' : 'scaleY'] ?? 1)) || 1
  return raw * scale
}

const visualImageWidth = (image: any): number => {
  const measured = visualSize(image, 'width')
  if (measured <= 0) return 0

  // Imagens antigas podem ter recebido o marker de auto-trim mesmo quando o
  // decode/CORS impediu a leitura dos pixels. Nessa situacao width continua a
  // ser a textura inteira e todas as etiquetas acabam com a mesma largura.
  // Mede a area opaca uma vez e guarda apenas a proporcao em runtime.
  const element = image?.getElement?.() || image?._element || image?._originalElement
  const naturalWidth = finitePositive(element?.naturalWidth || element?.width)
  const currentWidth = finitePositive(image?.width)
  const alreadyCropped = naturalWidth > 0 && currentWidth > 0 && currentWidth < naturalWidth - 0.5
  if (!alreadyCropped && naturalWidth > 1 && typeof element !== 'undefined') {
    const cachedRatio = Number(image.__productLabelVisibleWidthRatio)
    let ratio = Number.isFinite(cachedRatio) && cachedRatio > 0 ? cachedRatio : 0
    if (ratio <= 0) {
      const bounds = detectImageTrimBounds(image, { alphaThreshold: 12, padding: 0 })
      const detectedWidth = finitePositive(bounds?.width)
      if (detectedWidth > 0) ratio = Math.min(1, Math.max(0.2, detectedWidth / naturalWidth))
      if (ratio > 0) image.__productLabelVisibleWidthRatio = ratio
    }
    if (ratio > 0 && ratio < 0.995) {
      const scale = Math.abs(Number(image.scaleX ?? 1)) || 1
      return currentWidth * scale * ratio
    }
  }
  return measured
}

/**
 * Faz o tamanho da etiqueta acompanhar a imagem principal do produto.
 * Retorna true somente quando uma escala efetivamente foi aplicada.
 */
export const fitProductPriceLabelToImage = (
  priceGroup: any,
  image: any,
  cardWidth: number,
  _cardHeight: number,
  options: ProductLabelSizingOptions = {}
): boolean => {
  if (!priceGroup || !image || image.visible === false || typeof priceGroup.set !== 'function') return false

  const cardW = finitePositive(cardWidth)
  const imageW = visualImageWidth(image)
  const labelW = visualSize(priceGroup, 'width')
  if (cardW <= 0 || imageW <= 0 || labelW <= 0) return false

  // Se o usuario redimensionou a etiqueta pelo inspector, a escolha manual
  // deve vencer o ajuste automatico da imagem.
  if (options.respectManualScale !== false) {
    const manualX = Number(priceGroup.__manualScaleX)
    const manualY = Number(priceGroup.__manualScaleY)
    if ((Number.isFinite(manualX) && Math.abs(manualX - 1) > 0.0001)
      || (Number.isFinite(manualY) && Math.abs(manualY - 1) > 0.0001)) {
      return false
    }
  }

  const imageRatio = Math.min(1.2, Math.max(0.45, Number(options.imageWidthRatio ?? 0.82) || 0.82))
  const minCardRatio = Math.min(0.6, Math.max(0.16, Number(options.minCardWidthRatio ?? 0.28) || 0.28))
  const maxCardRatio = Math.min(0.98, Math.max(minCardRatio, Number(options.maxCardWidthRatio ?? 0.94) || 0.94))
  const minWidth = Math.max(48, finitePositive(options.minWidth, 72))
  const minTargetW = Math.max(minWidth, cardW * minCardRatio)
  const maxTargetW = Math.max(minTargetW, cardW * maxCardRatio)
  const targetW = Math.min(maxTargetW, Math.max(minTargetW, imageW * imageRatio))
  if (!Number.isFinite(targetW) || targetW <= 0) return false

  const scaleFactor = targetW / labelW
  if (!Number.isFinite(scaleFactor) || Math.abs(scaleFactor - 1) < 0.001) return false

  // Evita valores absurdos em JSONs antigos/corrompidos, sem impedir que
  // uma etiqueta antiga muito grande seja reduzida no primeiro relayout.
  const boundedFactor = Math.min(3, Math.max(0.2, scaleFactor))
  const currentX = Math.abs(Number(priceGroup.scaleX ?? 1)) || 1
  const currentY = Math.abs(Number(priceGroup.scaleY ?? 1)) || 1
  const signX = Number(priceGroup.scaleX ?? 1) < 0 ? -1 : 1
  const signY = Number(priceGroup.scaleY ?? 1) < 0 ? -1 : 1
  priceGroup.set({
    scaleX: signX * currentX * boundedFactor,
    scaleY: signY * currentY * boundedFactor,
    dirty: true
  })
  priceGroup.setCoords?.()
  return true
}
