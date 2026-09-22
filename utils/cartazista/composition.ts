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
import { posterLettering, updatePosterLettering } from './lettering'
import { applyCartazistaHeader } from './headers'

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

export const parseCartazistaProductList = (input: string, modelId: CartazistaModelKey = 'standard'): CartazistaProduct[] => {
  const result: CartazistaProduct[] = []
  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, ' ').trim()
    if (modelId === 'leve-pague') {
      const parts = line.split('|').map(part => part.trim())
      const take = Number(parts[1]), pay = Number(parts[2])
      if (parts.length === 3 && parts[0] && Number.isInteger(take) && Number.isInteger(pay) && pay > 0 && take > pay && take <= 999) {
        result.push(createCartazistaProduct({ name: parts[0].toLocaleUpperCase('pt-BR'), price: 0, packQuantity: take, payQuantity: pay }))
      }
      continue
    }
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
    if(prices.length>1 && ['second-unit','wholesale-retail','pack','leve-3-2','leve-x-y','leve-por-legacy'].includes(modelId)){
      delete product.oldPrice
      product.price=prices[0]!
      if(modelId==='second-unit')product.secondPrice=prices[1]
      if(modelId==='wholesale-retail')product.wholesalePrice=prices[1]
      if(modelId==='pack'||modelId==='leve-x-y'||modelId==='leve-por-legacy')product.packPrice=prices[1]
      if(modelId==='leve-3-2'){product.packPrice=prices[0];product.secondPrice=prices[1]}
    }
    result.push(product)
  }
  return result
}

const themeFor = (themeId: CartazistaThemeId) =>
  CARTAZISTA_THEMES.find((theme) => theme.id === themeId) || CARTAZISTA_THEMES[0]

const formatFor = (formatId: string): CartazistaFormat =>
  CARTAZISTA_FORMATS.find((format) => format.id === formatId) || CARTAZISTA_FORMATS[2]!

const baseComposition = (
  modelId: CartazistaModelKey,
  format: CartazistaFormat,
  themeId: CartazistaThemeId,
  settings: CartazistaSettings,
  logoSrc: string,
  product: CartazistaProduct
): ArtComposition => {
  const wide = settings.orientation === 'landscape' && format.id !== 'banner-2m'
  if(settings.freeDesign)return {version:1,width:wide?format.height:format.width,height:wide?format.width:format.height,background:themeFor(themeId).background,layers:[]}
  const composition = posterLettering(wide ? format.height : format.width, wide ? format.width : format.height, modelId, themeFor(themeId))
  const logo = composition.layers.find(l => l.id === 'cartaz-logo')!
  logo.src = settings.showLogo ? logoSrc : ''
  logo.visible = !!logo.src
  return updatePosterLettering(applyCartazistaHeader(composition, settings.header), modelId, product, settings)
}

export const applyCartazistaProduct = (
  source: ArtComposition,
  modelId: CartazistaModelKey,
  product: CartazistaProduct,
  settings: CartazistaSettings,
  themeId: CartazistaThemeId
): ArtComposition => {
  if (source.layers.some(l => l.id === 'cartaz-price-cents')) return updatePosterLettering(source, modelId, product, settings)
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
  const formatId = formatFor(modelId === 'banner-2m' ? 'banner-2m' : options.formatId || 'a4').id
  const themeId = options.themeId || 'classic-yellow'
  const settings: CartazistaSettings = {
    validity: '',
    limitPerCustomer: '',
    highlightNearExpiry: true,
    nearExpiryLabel: 'PRODUTO PRÓXIMO DA VALIDADE',
    showLogo: true,
    orientation: ['landscape', 'gondola', 'banner-2m'].includes(modelId) ? 'landscape' : 'portrait'
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
  if(next.modelId === 'banner-2m'){next.formatId='banner-2m';next.settings.orientation='landscape'}
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
    return applyCartazistaProduct(document.composition, document.modelId, product, document.settings, document.themeId)
  })
