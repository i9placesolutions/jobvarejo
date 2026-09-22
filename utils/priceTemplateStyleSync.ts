import { applyRichPriceTextValue, PRICE_RICH_TEXT_OFFSET_PROPS, PRICE_RICH_TEXT_PROPS, createRichPriceTextFromSplit } from './priceRichText'
import { fitAuthoredPriceTier } from './manualPriceFitPolicy'
import { getSinglePriceBackgroundCandidate } from './priceLayoutClassifiers'

const migratedTemplatePrices = new WeakMap<object, Map<string, { signature: string; source: any }>>()
const PRICE_TIERS = [
  { value: 'price_value_text', integer: ['price_integer_text', 'priceInteger', 'price_integer'], decimal: ['price_decimal_text', 'priceDecimal', 'price_decimal'], parts: ['price_currency_text', 'price_value_text', 'smart_price', 'price_unit_text', 'price_currency_bg', 'price_currency_circle', 'currency_circle'], background: 'price_bg' },
  { value: 'retail_price_text', integer: ['retail_integer_text'], decimal: ['retail_decimal_text'], parts: ['retail_currency_text', 'retail_price_text', 'retail_unit_text'], background: 'atac_retail_bg' },
  { value: 'wholesale_price_text', integer: ['wholesale_integer_text'], decimal: ['wholesale_decimal_text'], parts: ['wholesale_currency_text', 'wholesale_price_text', 'wholesale_unit_text'], background: 'atac_wholesale_bg' }
]

/** Reaplica a aparência do modelo sem substituir dados comerciais ou seleção. */
export const syncPriceTemplateStyle = (group: any, template: any, revivePaint: (paint: any) => any = value => value, fabric?: any) => {
  if (!group || !template) return
  const sources = new Map<string, any>()
  const index = (node: any) => {
    if (node.name) sources.set(node.name, node)
    for (const child of node.objects || []) index(child)
  }
  index(template)
  // Modelos antigos guardam inteiro e centavos separados; a instância atual
  // já usa um único texto. Normalizar também a referência permite restaurar
  // estilo e alinhamento de todas as etiquetas, inclusive as anteriores à migração.
  if (fabric?.IText || fabric?.Text) {
    let cache = migratedTemplatePrices.get(template)
    if (!cache) { cache = new Map(); migratedTemplatePrices.set(template, cache) }
    for (const tier of PRICE_TIERS) {
      if (sources.has(tier.value)) continue
      const integer = tier.integer.map(name => sources.get(name)).find(Boolean)
      const decimal = tier.decimal.map(name => sources.get(name)).find(Boolean)
      if (!integer || !decimal) continue
      const signature = JSON.stringify([integer, decimal])
      let entry = cache.get(tier.value)
      if (!entry || entry.signature !== signature) {
        const TextClass = fabric.IText || fabric.Text
        const makeText = (source: any) => {
          const { type, version, styles, ...options } = source
          return new TextClass(source.text, options)
        }
        const integerText = makeText(integer), decimalText = makeText(decimal)
        const rich = createRichPriceTextFromSplit(fabric, integerText, decimalText, tier.value)
        if (rich) entry = { signature, source: rich.toObject(['name', ...PRICE_RICH_TEXT_PROPS]) }
        integerText.dispose?.(); decimalText.dispose?.(); rich?.dispose?.()
        if (entry) cache.set(tier.value, entry)
      }
      if (entry) sources.set(tier.value, entry.source)
    }
  }
  // Posições e escalas pertencem ao mesmo sistema de coordenadas autorado.
  // Restaurar só a escala sobre posições já normalizadas desloca o R$ a cada
  // carregamento/duplicação. Etiquetas atacarejo têm reflow próprio por variante.
  const restoreManualGeometry = group.__preserveManualLayout === true || template.__preserveManualLayout === true
  const restoreSingleGeometry = restoreManualGeometry && !sources.has('atac_retail_bg')
  const keys = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textAlign', 'charSpacing', 'lineHeight', 'underline', 'strokeWidth', 'rx', 'ry', '__priceRichIntegerStyle', '__priceRichDecimalStyle', '__priceRichIntegerScale', '__priceRichDecimalScale', ...PRICE_RICH_TEXT_OFFSET_PROPS]
  const visit = (node: any) => {
    const source = sources.get(node.name)
    if (source && node !== group) {
      const patch: Record<string, any> = {}
      for (const key of keys) if (source[key] !== undefined) patch[key] = JSON.parse(JSON.stringify(source[key]))
      if (node.__priceRichText) {
        for (const key of PRICE_RICH_TEXT_OFFSET_PROPS) {
          const segment = key.includes('Integer') ? source.__priceRichIntegerStyle : source.__priceRichDecimalStyle
          patch[key] = source[key] ?? segment?.[`__priceRichOffset${key.endsWith('X') ? 'X' : 'Y'}`] ?? 0
        }
      }
      for (const key of ['fill', 'stroke']) if (source[key] !== undefined) {
        const paint = revivePaint(source[key])
        if (paint !== undefined) patch[key] = paint
      }
      // Sempre parte da escala autorada; o encaixe posterior não se acumula.
      patch.__visibleScaleX = source.scaleX ?? 1
      patch.__visibleScaleY = source.scaleY ?? 1
      if (node.visible !== false) {
        patch.scaleX = source.scaleX ?? 1
        patch.scaleY = source.scaleY ?? 1
      }
      if (source.width !== undefined) patch.width = source.width
      // A referência lateral tem colunas fixas; mantém apenas a posição externa
      // do grupo e deixa o reflow calcular as linhas verticais de cada produto.
      if ((restoreManualGeometry || template.__referenceStyleVersion === 2) && source.left !== undefined) {
        patch.left = source.left
        if (source.originX !== undefined) patch.originX = source.originX
      }
      if (restoreManualGeometry) {
        for (const key of ['left', 'top', 'originX', 'originY', 'angle', 'skewX', 'skewY', 'flipX', 'flipY']) {
          if (source[key] !== undefined) patch[key] = source[key]
        }
        if (source.height !== undefined && !('text' in source)) patch.height = source.height
        for (const key of ['Left', 'Top', 'ScaleX', 'ScaleY', 'OriginX', 'OriginY']) {
          const property = key[0]!.toLowerCase() + key.slice(1)
          if (source[property] !== undefined) patch[`__original${key}`] = source[property]
        }
      }
      node.set?.(patch)
      Object.assign(node, patch)
      if (node.__priceRichText) applyRichPriceTextValue(node, node.text)
      else node.initDimensions?.()
      node.dirty = true
      node.setCoords?.()
    }
    for (const child of node.getObjects?.() || []) visit(child)
  }
  visit(group)
  // Um preço curto tem outra largura, mas deve manter o centro da composição
  // autorada (R$ + valor + unidade), em vez de ficar preso à margem esquerda
  // do valor de exemplo. A restauração acima torna o ajuste idempotente.
  const alignPrices = (parent: any) => {
    const children = parent.getObjects?.() || []
    for (const tier of PRICE_TIERS) {
      const parts = children.filter((node: any) =>
        (tier.parts.includes(node.name) || (tier.value === 'price_value_text' && String(node.text || '').trim() === 'R$'))
        && node.visible !== false && sources.has(node.name))
      const bounds = (nodes: any[]) => {
        const boxes = nodes.filter(node => node.visible !== false && (!('text' in node) || String(node.text).trim()))
          .map(node => {
            const width = Number(node.width) * Math.abs(Number(node.scaleX ?? 1))
            const left = Number(node.left) - width * (node.originX === 'center' ? 0.5 : node.originX === 'right' ? 1 : 0)
            return { left, right: left + width }
          }).filter(box => Number.isFinite(box.left) && Number.isFinite(box.right))
        return boxes.length ? (Math.min(...boxes.map(box => box.left)) + Math.max(...boxes.map(box => box.right))) / 2 : null
      }
      const value = parts.find((node: any) => node.name === tier.value || (tier.value === 'price_value_text' && node.name === 'smart_price'))
      if (value && parts.every((node: any) => !node.angle && !node.skewX && !node.skewY)) {
        // Em modelos com origem central/direita, aumentar a quantidade de
        // dígitos expandia o valor sobre o R$. Conserva primeiro a margem
        // esquerda autorada; em seguida centraliza o conjunto inteiro.
        const source = sources.get(value.name)
        const originFactor = value.originX === 'center' ? 0.5 : value.originX === 'right' ? 1 : 0
        const widthDelta = Number(value.width) * Math.abs(Number(value.scaleX ?? 1))
          - Number(source.width) * Math.abs(Number(source.scaleX ?? 1))
        if (Number.isFinite(widthDelta)) value.set?.({ left: Number(value.left) + widthDelta * originFactor })
        const authoredCenter = bounds(parts.map((node: any) => sources.get(node.name)))
        const currentCenter = bounds(parts)
        if (authoredCenter !== null && currentCenter !== null) {
          for (const node of parts) {
            node.set?.({ left: Number(node.left) + authoredCenter - currentCenter })
            node.setCoords?.()
          }
        }
        const background = tier.value === 'price_value_text'
          ? getSinglePriceBackgroundCandidate(children)
          : children.find((node: any) => node.name === tier.background)
        if (background) {
          const currency = parts.find((node: any) => String(node.text || '').trim() === 'R$')
          const anchor = currency && { left: currency.left, top: currency.top, scaleX: currency.scaleX ?? 1, scaleY: currency.scaleY ?? 1 }
          fitAuthoredPriceTier(background, parts)
          // O círculo/faixa do R$ acompanha o símbolo durante o encaixe de
          // valores longos; não pode ficar solto na borda da etiqueta vizinha.
          if (anchor) {
            const sx = Number(currency.scaleX ?? 1) / Number(anchor.scaleX)
            const sy = Number(currency.scaleY ?? 1) / Number(anchor.scaleY)
            if (Number.isFinite(sx) && Number.isFinite(sy)) {
              for (const node of parts.filter((part: any) => !('text' in part))) {
                node.set?.({
                  left: Number(currency.left) + (Number(node.left) - Number(anchor.left)) * sx,
                  top: Number(currency.top) + (Number(node.top) - Number(anchor.top)) * sy,
                  scaleX: Number(node.scaleX ?? 1) * sx,
                  scaleY: Number(node.scaleY ?? 1) * sy
                })
                node.dirty = true
                node.setCoords?.()
              }
            }
          }
        }
      }
    }
    children.filter((node: any) => node.getObjects).forEach(alignPrices)
  }
  if (restoreManualGeometry) alignPrices(group)
  // Os filhos restaurados voltam às coordenadas do modelo. A caixa do grupo
  // precisa voltar ao mesmo referencial, ou o fit usa dimensões de um card
  // anterior e deixa controles vazios e a etiqueta visualmente pequena.
  if (restoreSingleGeometry) {
    const bounds: Record<string, number> = {}
    for (const key of ['width', 'height']) {
      const value = Number(template[key])
      if (Number.isFinite(value) && value > 0) bounds[key] = value
    }
    group.set?.(bounds)
    Object.assign(group, bounds)
    if (bounds.width) group.__manualTemplateBaseW = bounds.width
    if (bounds.height) group.__manualTemplateBaseH = bounds.height
    group.setCoords?.()
  }
  group.dirty = true
}
