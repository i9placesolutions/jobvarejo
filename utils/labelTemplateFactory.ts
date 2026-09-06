/**
 * Cria uma etiqueta inicial editável sem depender do EditorCanvas.
 *
 * O resultado é JSON compatível com Fabric.js e usa os mesmos nomes que o
 * motor de preços procura ao trocar o valor do produto no editor.
 */

import { createRichPriceTextDefinition } from './priceRichText'

export type LabelTemplateFactoryOptions = {
  imageSrc?: string | null
  imageWidth?: number | null
  imageHeight?: number | null
}

const LABEL_MAX_WIDTH = 320
const LABEL_MAX_HEIGHT = 260

const finitePositive = (value: unknown, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const makeText = (options: Record<string, unknown>) => ({
  type: 'text',
  version: '7.1.0',
  originX: 'center',
  originY: 'center',
  left: 0,
  top: 0,
  scaleX: 1,
  scaleY: 1,
  angle: 0,
  opacity: 1,
  visible: true,
  selectable: true,
  evented: true,
  ...options
})

/**
 * Cria uma etiqueta com preço dinâmico e, opcionalmente, uma imagem que ocupa
 * toda a área da etiqueta. A imagem é mantida proporcionalmente sem crop na
 * criação; o usuário pode ajustar tudo no mini-editor antes de salvar.
 */
export const createEditableLabelTemplateGroup = (
  options: LabelTemplateFactoryOptions = {}
): Record<string, any> => {
  const imageSrc = String(options.imageSrc || '').trim() || null
  const imageWidth = finitePositive(options.imageWidth, 1200)
  const imageHeight = finitePositive(options.imageHeight, 675)

  const imageScale = imageSrc
    ? Math.min(LABEL_MAX_WIDTH / imageWidth, LABEL_MAX_HEIGHT / imageHeight)
    : 1
  const width = imageSrc
    ? Math.min(LABEL_MAX_WIDTH, Math.max(96, imageWidth * imageScale))
    : LABEL_MAX_WIDTH
  const height = imageSrc
    ? Math.min(LABEL_MAX_HEIGHT, Math.max(72, imageHeight * imageScale))
    : 180
  const textScale = Math.max(0.55, Math.min(1.2, width / LABEL_MAX_WIDTH))
  const textY = imageSrc ? height * 0.08 : 0
  const textColor = imageSrc ? '#ffffff' : '#ffffff'
  const textShadow = {
    color: 'rgba(0, 0, 0, 0.42)',
    blur: 5,
    offsetX: 0,
    offsetY: 2
  }

  const objects: Record<string, any>[] = [
    {
      type: 'rect',
      version: '7.1.0',
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      width,
      height,
      rx: Math.min(24, height * 0.18),
      ry: Math.min(24, height * 0.18),
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      fill: imageSrc ? 'transparent' : '#e11d48',
      stroke: imageSrc ? 'rgba(255, 255, 255, 0.62)' : '#be123c',
      strokeWidth: imageSrc ? 2 : 3,
      visible: true,
      selectable: true,
      evented: true,
      name: 'price_bg',
      __originalFill: imageSrc ? 'transparent' : '#e11d48'
    }
  ]

  if (imageSrc) {
    objects.push({
      type: 'image',
      version: '7.1.0',
      src: imageSrc,
      crossOrigin: 'anonymous',
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      width: imageWidth,
      height: imageHeight,
      cropX: 0,
      cropY: 0,
      scaleX: imageScale,
      scaleY: imageScale,
      angle: 0,
      opacity: 1,
      visible: true,
      selectable: false,
      evented: false,
      name: 'price_bg_image',
      data: { smartType: 'label-background-image' }
    })
  }

  const richPriceText = createRichPriceTextDefinition({
    text: '22,99',
    fontSize: Math.max(38, 76 * textScale),
    integerStyle: {
      fontFamily: 'Inter',
      fontSize: Math.max(38, 76 * textScale),
      fontWeight: '900',
      fill: textColor,
      shadow: textShadow
    },
    decimalStyle: {
      fontFamily: 'Inter',
      fontSize: Math.max(22, 42 * textScale),
      fontWeight: '800',
      fill: textColor,
      shadow: textShadow
    }
  })

  objects.push(
    makeText({
      text: 'R$',
      fontFamily: 'Inter',
      fontSize: Math.max(16, 27 * textScale),
      fontWeight: '800',
      fill: textColor,
      shadow: textShadow,
      left: -width * 0.27,
      top: textY,
      name: 'price_currency_text'
    }),
    {
      ...richPriceText,
      left: width * 0.22,
      top: textY - (height * 0.02)
    },
    makeText({
      text: 'UN',
      fontFamily: 'Inter',
      fontSize: Math.max(12, 17 * textScale),
      fontWeight: '700',
      fill: textColor,
      shadow: textShadow,
      left: width * 0.32,
      top: textY + (height * 0.26),
      name: 'price_unit_text'
    })
  )

  return {
    type: 'group',
    version: '7.1.0',
    originX: 'center',
    originY: 'center',
    left: 0,
    top: 0,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    opacity: 1,
    visible: true,
    subTargetCheck: true,
    interactive: true,
    name: 'priceGroup',
    __preserveManualLayout: true,
    __isCustomTemplate: true,
    __forceAtacarejoCanonical: false,
    __manualTemplateBaseW: width,
    __manualTemplateBaseH: height,
    objects
  }
}
