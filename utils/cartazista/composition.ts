import type { ArtComposition, ArtLayer } from '~/types/art-studio'
import {
  CARTAZISTA_FORMATS,
  CARTAZISTA_THEMES,
  type CartazistaDocument,
  type CartazistaFormat,
  type CartazistaModelKey,
  type CartazistaProduct,
  type CartazistaSettings,
  type CartazistaThemeId
} from '~/types/cartazista'
import { getCartazistaModel } from './catalog'

export const cloneCartazista = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const makeId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `cartaz-${Date.now()}-${Math.random().toString(16).slice(2)}`

export const createCartazistaProduct = (overrides: Partial<CartazistaProduct> = {}): CartazistaProduct => ({
  id: makeId(),
  name: 'PRODUTO MARCA',
  price: 9.99,
  unit: 'un',
  ...overrides
})

export const formatCartazistaPrice = (value: number | undefined | null) => {
  if (value == null || !Number.isFinite(value)) return 'R$ --,--'
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const parsePrice = (value: string) => {
  const raw = value.replace(/R\$\s*/gi, '').trim()
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(?:\.\d{3})+$/.test(raw)
      ? raw.replace(/\./g, '')
      : raw
  const result = Number(normalized)
  return Number.isFinite(result) ? result : undefined
}

export const parseCartazistaProductList = (input: string): CartazistaProduct[] => {
  const result: CartazistaProduct[] = []
  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, ' ').trim()
    if (!line || /^(produto|descrição|descricao|lista|nome)\b/i.test(line)) continue
    const matches = [...line.matchAll(/(?:R\$\s*)?\d{1,4}(?:[.,]\d{2})/g)]
    const prices = matches.map((match) => parsePrice(match[0])).filter((value): value is number => value != null)
    if (!prices.length) continue
    const firstIndex = matches[0]?.index ?? line.length
    const name = line.slice(0, firstIndex).replace(/[|;:\-–]+\s*$/, '').trim()
    if (!name) continue
    const suffix = line.slice((matches.at(-1)?.index ?? line.length) + (matches.at(-1)?.[0].length || 0))
    const unit = suffix.match(/\b(kg|g|l|ml|un|unid(?:ade)?|cx|pct|fardo)\b/i)?.[1]?.toLowerCase() || 'un'
    const product: CartazistaProduct = {
      ...createCartazistaProduct(),
      name: name.toLocaleUpperCase('pt-BR'),
      oldPrice: prices.length > 1 ? prices[0] : undefined,
      price: prices.at(-1)!,
      unit
    }
    result.push(product)
  }
  return result
}

const themeFor = (themeId: CartazistaThemeId) =>
  CARTAZISTA_THEMES.find((theme) => theme.id === themeId) || CARTAZISTA_THEMES[0]

const formatFor = (formatId: string): CartazistaFormat =>
  CARTAZISTA_FORMATS.find((format) => format.id === formatId) || CARTAZISTA_FORMATS[2]!

const layer = (
  id: string,
  kind: ArtLayer['kind'],
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  extra: Partial<ArtLayer> = {}
): ArtLayer => ({
  id,
  kind,
  name: id,
  x,
  y,
  width,
  height,
  rotation: 0,
  opacity: 1,
  visible: true,
  locked: false,
  fill,
  ...extra
})

const baseComposition = (
  modelId: CartazistaModelKey,
  format: CartazistaFormat,
  themeId: CartazistaThemeId,
  settings: CartazistaSettings,
  logoSrc: string,
  product: CartazistaProduct
): ArtComposition => {
  const theme = themeFor(themeId)
  const landscape = settings.orientation === 'landscape'
  const width = landscape ? format.height : format.width
  const height = landscape ? format.width : format.height
  const margin = Math.round(width * 0.075)
  const compact = modelId === 'gondola' || modelId === 'pocket' || modelId === 'leve-por-legacy'
  const wide = modelId === 'landscape' || landscape
  const nameY = wide ? Math.round(height * 0.27) : compact ? Math.round(height * 0.25) : Math.round(height * 0.31)
  const priceY = wide ? Math.round(height * 0.58) : compact ? Math.round(height * 0.58) : Math.round(height * 0.55)
  const titleSize = wide ? Math.round(height * 0.095) : compact ? Math.round(height * 0.075) : Math.round(height * 0.105)
  const priceSize = compact ? Math.round(height * 0.18) : Math.round(height * 0.22)
  const composition: ArtComposition = {
    version: 1,
    width,
    height,
    background: theme.background,
    layers: [
      layer('cartaz-top-strip', 'shape', 0, 0, width, Math.round(height * 0.105), theme.accent),
      layer('cartaz-accent-corner', 'shape', width - Math.round(width * 0.30), -Math.round(height * 0.08), Math.round(width * 0.42), Math.round(height * 0.28), theme.secondary, { shape: 'ellipse', opacity: 0.9 }),
      layer('cartaz-offer-label', 'text', margin, Math.round(height * 0.035), Math.round(width * 0.62), Math.round(height * 0.07), theme.background, { text: modelId === 'club' || modelId === 'club-discount' ? 'CLUBE DE VANTAGENS' : modelId === 'pack' ? 'PACK OFERTA' : 'OFERTA', fontFamily: 'Barlow Condensed', fontSize: Math.max(24, Math.round(height * 0.055)), fontWeight: 800, align: 'left' }),
      layer('cartaz-brand-line', 'text', margin, Math.round(height * 0.13), Math.round(width * 0.64), Math.round(height * 0.05), theme.accent, { text: 'MELHORES PREÇOS DA LOJA', fontFamily: 'Barlow', fontSize: Math.max(14, Math.round(height * 0.025)), fontWeight: 700, align: 'left' }),
      layer('cartaz-product-name', 'text', margin, nameY, width - margin * 2, Math.round(height * 0.19), theme.ink, { text: product.name, fontFamily: wide ? 'Barlow Condensed' : 'Barlow', fontSize: titleSize, fontWeight: 800, align: 'center', lineHeight: 0.96 }),
      layer('cartaz-unit', 'text', margin, nameY + Math.round(height * 0.2), width - margin * 2, Math.round(height * 0.05), theme.accent, { text: `${product.unit || 'un'} · preço por unidade`, fontFamily: 'Barlow', fontSize: Math.max(14, Math.round(height * 0.026)), fontWeight: 600, align: 'center' }),
      layer('cartaz-old-price', 'text', margin, priceY - Math.round(height * 0.07), Math.round(width * 0.42), Math.round(height * 0.07), theme.ink, { text: 'DE R$ 00,00', fontFamily: 'Barlow Condensed', fontSize: Math.max(18, Math.round(height * 0.045)), fontWeight: 700, align: 'right', visible: false }),
      layer('cartaz-price-card', 'shape', margin, priceY, width - margin * 2, Math.round(height * 0.25), theme.highlight, { shape: 'rect', cornerRadius: Math.round(height * 0.03) }),
      layer('cartaz-price', 'text', margin, priceY + Math.round(height * 0.02), width - margin * 2, Math.round(height * 0.20), theme.price, { text: formatCartazistaPrice(product.price), fontFamily: 'Anton', fontSize: priceSize, fontWeight: 800, align: 'center' }),
      layer('cartaz-secondary-label', 'text', margin, priceY + Math.round(height * 0.28), Math.round(width * 0.45), Math.round(height * 0.065), theme.accent, { text: '', fontFamily: 'Barlow Condensed', fontSize: Math.max(18, Math.round(height * 0.05)), fontWeight: 800, align: 'center', visible: false }),
      layer('cartaz-secondary-price', 'text', Math.round(width * 0.52), priceY + Math.round(height * 0.28), Math.round(width * 0.4), Math.round(height * 0.065), theme.price, { text: '', fontFamily: 'Anton', fontSize: Math.max(22, Math.round(height * 0.06)), fontWeight: 800, align: 'center', visible: false }),
      layer('cartaz-badge', 'text', Math.round(width * 0.63), Math.round(height * 0.14), Math.round(width * 0.3), Math.round(height * 0.10), theme.price, { text: '', fontFamily: 'Anton', fontSize: Math.max(22, Math.round(height * 0.075)), fontWeight: 800, align: 'center', visible: false, rotation: -6 }),
      layer('cartaz-validity', 'text', margin, height - Math.round(height * 0.18), width - margin * 2, Math.round(height * 0.055), theme.ink, { text: settings.validity ? `VÁLIDO ATÉ ${settings.validity}` : '', fontFamily: 'Barlow', fontSize: Math.max(13, Math.round(height * 0.024)), fontWeight: 600, align: 'center', visible: !!settings.validity }),
      layer('cartaz-limit', 'text', margin, height - Math.round(height * 0.125), width - margin * 2, Math.round(height * 0.055), theme.accent, { text: settings.limitPerCustomer ? `LIMITE: ${settings.limitPerCustomer}` : '', fontFamily: 'Barlow', fontSize: Math.max(13, Math.round(height * 0.024)), fontWeight: 800, align: 'center', visible: !!settings.limitPerCustomer }),
      layer('cartaz-near-expiry', 'text', margin, height - Math.round(height * 0.255), width - margin * 2, Math.round(height * 0.06), theme.background, { text: settings.nearExpiryLabel, fontFamily: 'Barlow Condensed', fontSize: Math.max(16, Math.round(height * 0.036)), fontWeight: 800, align: 'center', visible: !!settings.highlightNearExpiry && !!product.nearExpiry }),
      layer('cartaz-company', 'text', margin, height - Math.round(height * 0.07), Math.round(width * 0.58), Math.round(height * 0.04), theme.ink, { text: 'SUA LOJA', fontFamily: 'Barlow', fontSize: Math.max(12, Math.round(height * 0.022)), fontWeight: 700, align: 'left', binding: 'companyName' }),
      layer('cartaz-logo', 'image', width - margin - Math.round(width * 0.22), height - Math.round(height * 0.105), Math.round(width * 0.22), Math.round(height * 0.08), theme.accent, { src: settings.showLogo ? logoSrc : '', fit: 'contain', binding: 'logo', autoTrim: true, logoOutline: themeId === 'black-neon', logoOutlineColor: theme.background, logoOutlineWidth: 3 })
    ]
  }
  return applyCartazistaProduct(composition, modelId, product, settings, themeId)
}

export const applyCartazistaProduct = (
  source: ArtComposition,
  modelId: CartazistaModelKey,
  product: CartazistaProduct,
  settings: CartazistaSettings,
  themeId: CartazistaThemeId
): ArtComposition => {
  const next = cloneCartazista(source)
  const theme = themeFor(themeId)
  const find = (id: string) => next.layers.find((item) => item.id === id)
  const text = (id: string, value: string, visible = true) => {
    const item = find(id)
    if (item) { item.text = value; item.visible = visible }
  }
  const oldPrice = product.oldPrice != null ? product.oldPrice : undefined
  const discount = oldPrice && oldPrice > product.price ? Math.round((1 - product.price / oldPrice) * 100) : 0
  text('cartaz-product-name', product.name || 'PRODUTO MARCA')
  text('cartaz-price', formatCartazistaPrice(product.price))
  text('cartaz-unit', `${product.unit || 'un'} · preço por unidade`)
  text('cartaz-old-price', `DE ${formatCartazistaPrice(oldPrice)}`, !!oldPrice && ['de-por', 'de-por-discount', 'club-discount'].includes(modelId))
  text('cartaz-validity', settings.validity ? `VÁLIDO ATÉ ${settings.validity}` : '', !!settings.validity)
  text('cartaz-limit', settings.limitPerCustomer ? `LIMITE: ${settings.limitPerCustomer}` : '', !!settings.limitPerCustomer)
  text('cartaz-near-expiry', settings.nearExpiryLabel, !!settings.highlightNearExpiry && !!product.nearExpiry)
  text('cartaz-badge', discount ? `${discount}% OFF` : modelId === 'club' || modelId === 'club-discount' ? 'CLUBE' : '', discount > 0 || modelId === 'club' || modelId === 'club-discount')

  const secondaryLabel = find('cartaz-secondary-label')
  const secondaryPrice = find('cartaz-secondary-price')
  const setSecondary = (label: string, price: number | undefined) => {
    if (secondaryLabel) { secondaryLabel.text = label; secondaryLabel.visible = !!price }
    if (secondaryPrice) { secondaryPrice.text = price != null ? formatCartazistaPrice(price) : ''; secondaryPrice.visible = price != null }
  }
  if (modelId === 'second-unit') setSecondary('A PARTIR DA 2ª UN.', product.secondPrice || product.price)
  else if (modelId === 'wholesale-retail') setSecondary('ATACADO', product.wholesalePrice || product.price)
  else if (modelId === 'pack') setSecondary(`PACK ${product.packQuantity || 3} UN.`, product.packPrice || product.price)
  else if (modelId === 'leve-3-2') setSecondary('LEVE 2', product.secondPrice || product.price)
  else if (modelId === 'leve-x-y' || modelId === 'leve-por-legacy') setSecondary(`LEVE ${product.packQuantity || 2}`, product.packPrice || product.price)
  else setSecondary('', undefined)

  const priceCard = find('cartaz-price-card')
  if (priceCard) priceCard.fill = theme.highlight
  return next
}

export const createCartazistaDocument = (options: {
  modelId?: CartazistaModelKey
  formatId?: string
  themeId?: CartazistaThemeId
  logoSrc?: string
} = {}): CartazistaDocument => {
  const modelId = options.modelId || 'standard'
  const formatId = formatFor(options.formatId || 'a3').id
  const themeId = options.themeId || 'classic-yellow'
  const settings: CartazistaSettings = {
    validity: '',
    limitPerCustomer: '',
    highlightNearExpiry: true,
    nearExpiryLabel: 'PRODUTO PRÓXIMO DA VALIDADE',
    showLogo: true,
    orientation: modelId === 'landscape' ? 'landscape' : 'portrait'
  }
  const product = createCartazistaProduct()
  return {
    version: 1,
    name: `${getCartazistaModel(modelId).name} · novo cartaz`,
    modelId,
    formatId,
    themeId,
    settings,
    products: [product],
    activeProductId: product.id,
    composition: baseComposition(modelId, formatFor(formatId), themeId, settings, options.logoSrc || '', product)
  }
}

export const rebuildCartazistaComposition = (
  document: CartazistaDocument,
  logoSrc = ''
): CartazistaDocument => {
  const next = cloneCartazista(document)
  const product = next.products.find((item) => item.id === next.activeProductId) || next.products[0] || createCartazistaProduct()
  if (!next.products.length) next.products = [product]
  next.composition = baseComposition(next.modelId, formatFor(next.formatId), next.themeId, next.settings, logoSrc, product)
  return next
}

export const applySettingsToCartazistaComposition = (
  source: ArtComposition,
  document: CartazistaDocument
) => {
  const product = document.products.find((item) => item.id === document.activeProductId) || document.products[0] || createCartazistaProduct()
  return applyCartazistaProduct(source, document.modelId, product, document.settings, document.themeId)
}

export const cartazistaPrintableCompositions = (document: CartazistaDocument, logoSrc = '') =>
  document.products.map((product) => {
    const copy = cloneCartazista(document)
    copy.activeProductId = product.id
    copy.composition = baseComposition(document.modelId, formatFor(document.formatId), document.themeId, document.settings, logoSrc, product)
    return copy.composition
  })
