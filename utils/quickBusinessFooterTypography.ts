import { getDynamicBusinessField } from './dynamicBusinessFields'

const positive = (value: unknown, fallback: number): number => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}
const set = (object: any, values: Record<string, any>) => {
  if (typeof object.set === 'function') object.set(values)
  else Object.assign(object, values)
}

const estimatedLineWidth = (text: string, size: number, spacing: number): number =>
  Array.from(text).reduce((width, character) => width + size * (
    /\s/.test(character) ? .28 : /[ilI.,:;!'|]/.test(character) ? .3 : /[MW@%]/.test(character) ? .9 : .59
  ) + spacing, 0)

/** JSON de páginas inativas não tem medidor Fabric; reserva conservadora até o load. */
const estimateText = (object: any, width: number) => {
  const size = positive(object.fontSize, 24)
  const spacing = Number(object.charSpacing || 0) * size / 1000
  const lines: string[] = []
  for (const paragraph of String(object.text || '').split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word
      if (line && estimatedLineWidth(next, size, spacing) > width) {
        lines.push(line)
        line = word
      } else line = next
    }
    lines.push(line)
  }
  return {
    lineCount: lines.length,
    width: Math.max(0, ...lines.map(line => estimatedLineWidth(line, size, spacing))),
    height: size * 1.18 * (1 + Math.max(0, lines.length - 1) * positive(object.lineHeight, 1.04))
  }
}

export type QuickBusinessFooterTextFitOptions = {
  width?: number
  height?: number
  maxFontSize?: number
  singleLine?: boolean
}

/**
 * Encaixa o texto inteiro no bloco sem cortar caracteres nem deformar glifos.
 * A escala é uniforme e a largura local acompanha o reflow. Assim fonte,
 * estilos por caractere e tamanho-base continuam editáveis e não encolhem
 * cumulativamente ao salvar/reabrir ou trocar os dados da loja.
 */
export const fitQuickBusinessFooterText = (object: any, options: QuickBusinessFooterTextFitOptions = {}): boolean => {
  if (!object || object.__manualTransform) return false
  const before = JSON.stringify([object.text, object.fontSize, object.width, object.height,
    object.scaleX, object.scaleY, object.dynamicFieldBaseFontSize, object.dynamicFieldAutoFitFontSize, object.splitByGrapheme])
  const width = positive(options.width, positive(object.width, 200) * positive(object.scaleX, 1))
  const height = positive(options.height, Number.POSITIVE_INFINITY)
  const size = object.__manualTypography
    ? positive(object.dynamicFieldBaseFontSize, positive(object.fontSize, 24))
    : positive(options.maxFontSize, positive(object.dynamicFieldBaseFontSize, positive(object.fontSize, 24)))
  const text = options.singleLine
    ? String(object.text || '').replace(/\s+/g, getDynamicBusinessField(object) === 'instagram' ? '' : ' ').trim()
    : String(object.text || '')
  set(object, { text, fontSize: size, dynamicFieldBaseFontSize: size,
    dynamicFieldAutoFitFontSize: size, splitByGrapheme: false })

  const measure = (scale: number) => {
    const localWidth = width / scale
    set(object, { width: localWidth, scaleX: scale, scaleY: scale })
    object.initDimensions?.()
    const fallback = estimateText(object, localWidth)
    const lines = object._textLines || object.textLines
    const lineCount = Array.isArray(lines) ? lines.length : fallback.lineCount
    const measuredWidth = typeof object.getLineWidth === 'function' && Array.isArray(lines)
      ? Math.max(0, ...lines.map((_: unknown, index: number) => Number(object.getLineWidth(index)) || 0))
      : fallback.width
    const measuredHeight = typeof object.calcTextHeight === 'function'
      ? positive(object.calcTextHeight(), fallback.height)
      : typeof object.initDimensions === 'function' ? positive(object.height, fallback.height) : fallback.height
    // Textbox pode expandir width para uma palavra longa. A busca reduz a
    // escala até essa palavra caber na largura local, sem quebrar o @usuário.
    const fits = measuredWidth * scale <= width + .01 && measuredHeight * scale <= height + .01 &&
      (!options.singleLine || lineCount <= 1)
    return { fits, height: measuredHeight, localWidth }
  }
  let scale = 1
  let measurement = measure(scale)
  if (!measurement.fits) {
    let low = .001
    let high = 1
    for (let step = 0; step < 18; step++) {
      const candidate = (low + high) / 2
      if (measure(candidate).fits) low = candidate
      else high = candidate
    }
    scale = low
    measurement = measure(scale)
  }
  set(object, { width: measurement.localWidth, height: measurement.height,
    scaleX: scale, scaleY: scale, dynamicFieldAutoHeight: true })
  object.setCoords?.()
  const changed = before !== JSON.stringify([object.text, object.fontSize, object.width, object.height,
    object.scaleX, object.scaleY, object.dynamicFieldBaseFontSize, object.dynamicFieldAutoFitFontSize, object.splitByGrapheme])
  if (changed) object.dirty = true
  return changed
}

/** Reflow contacts without replacing the template's family, weight, color or rich styles. */
export const normalizeQuickBusinessFooter = (object: any): boolean => {
  const field = getDynamicBusinessField(object)
  if (!['address', 'instagram', 'whatsapp'].includes(field) || typeof object?.set !== 'function' || object.__manualTransform) return false
  const anchor = object.getPointByOrigin?.('left', 'top')
  const changed = fitQuickBusinessFooterText(object, {
    singleLine: field === 'instagram' || (field === 'whatsapp' && !String(object.text || '').includes('\n')),
    ...(field === 'address' && Number(object.dynamicFieldHeight) > 0
      ? { height: Number(object.dynamicFieldHeight) * positive(object.scaleY, 1) } : {})
  })
  if (anchor) object.setPositionByOrigin?.(anchor, 'left', 'top')
  object.setCoords?.()
  return changed
}
