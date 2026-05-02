import { isTransientParseError } from './pasteListErrorHelpers'
import { parseProductList } from './productListBasicParser'
import { splitTextIntoChunks } from './textChunking'

export { parseProductList as parseBasicProductList }

type ApiHeadersProvider = () => Promise<Record<string, string> | HeadersInit>

export const isProductImportParseTimeout = (err: any): boolean => {
  const msg = String(err?.data?.statusMessage || err?.statusMessage || err?.message || '').toLowerCase()
  const status = String(err?.status || err?.statusCode || '')
  return msg.includes('timeout') || msg.includes('504') || msg.includes('gateway') || status === '504'
}

const mapParsedProduct = (p: any, i: number) => ({
  id: `prod_${Date.now()}_${i}`,
  name: p.name || 'Produto sem nome',
  brand: p.brand || '',
  productCode: p.productCode || null,
  weight: p.weight || '',
  price: p.price || '',
  pricePack: p.pricePack ?? '',
  priceUnit: p.priceUnit ?? '',
  priceSpecial: p.priceSpecial ?? '',
  priceSpecialUnit: p.priceSpecialUnit ?? '',
  specialCondition: p.specialCondition ?? '',
  priceWholesale: p.priceWholesale ?? '',
  wholesaleTrigger: p.wholesaleTrigger ?? null,
  wholesaleTriggerUnit: p.wholesaleTriggerUnit ?? '',
  packQuantity: p.packQuantity ?? null,
  packUnit: p.packUnit ?? '',
  packageLabel: p.packageLabel ?? '',
  price_mode: p.price_mode || 'retail',
  limit: p.limit || '',
  flavor: p.flavor || '',
  imageUrl: null,
  image: null,
  status: 'pending',
  unit: 'UN',
  color: '#ffffff'
})

const fetchParseWithRetry = async <T = any>(
  body: any,
  getApiAuthHeaders: ApiHeadersProvider,
  maxAttempts = 2
): Promise<T> => {
  const headers = await getApiAuthHeaders()
  let lastErr: any = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await $fetch<T>('/api/parse-products', {
        method: 'POST',
        headers,
        body,
        timeout: 70_000
      })
    } catch (err: any) {
      lastErr = err
      if (!isTransientParseError(err) || attempt === maxAttempts - 1) throw err
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
    }
  }

  throw lastErr || new Error('Falha ao processar produtos')
}

export const parseTextProductsWithAI = async (
  text: string,
  getApiAuthHeaders: ApiHeadersProvider
): Promise<any[]> => {
  const chunks = splitTextIntoChunks(text)

  if (chunks.length <= 1) {
    const result = await fetchParseWithRetry<{ products?: any[] }>({ text }, getApiAuthHeaders)
    if (!result?.products || !Array.isArray(result.products)) return []
    return result.products.map(mapParsedProduct)
  }

  const allProducts: any[] = []
  for (const chunk of chunks) {
    try {
      const result = await fetchParseWithRetry<{ products?: any[] }>({ text: chunk }, getApiAuthHeaders)
      if (result?.products && Array.isArray(result.products)) {
        allProducts.push(...result.products)
      }
    } catch (err: any) {
      console.warn('[parseTextProductsWithAI] Chunk parse failed, continuing with remaining chunks:', err?.message)
    }
  }

  return allProducts.map(mapParsedProduct)
}

export const parseTextProductsWithFallback = async (
  text: string,
  getApiAuthHeaders: ApiHeadersProvider
): Promise<any[]> => {
  const aiProducts = await parseTextProductsWithAI(text, getApiAuthHeaders)
  return aiProducts.length > 0 ? aiProducts : parseProductList(text)
}

export const parseProductFileWithAI = async (
  file: File,
  getApiAuthHeaders: ApiHeadersProvider
): Promise<any[]> => {
  const form = new FormData()
  form.append('file', file)
  const result = await fetchParseWithRetry<{ products?: any[] }>(form, getApiAuthHeaders)
  if (!result?.products || !Array.isArray(result.products)) return []
  return result.products.map(mapParsedProduct)
}
