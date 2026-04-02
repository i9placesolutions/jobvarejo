// Analisador inteligente de padroes de design do Canva
// Identifica grupos de produtos (nome + preco + unidade + imagem) por proximidade espacial

interface RichtextElement {
  element_id: string
  text: string
  page_index: number
  page_id: string
  position: { top: number; left: number }
  dimension: { width: number; height: number }
  type: string // SHAPE ou TEXT
}

interface FillElement {
  element_id: string
  asset_id: string
  page_index: number
  position: { top: number; left: number }
  dimension: { width: number; height: number }
  editable: boolean
}

interface DetectedProduct {
  index: number
  page_index: number
  page_id: string
  name: {
    element_id: string
    text: string
    position: { top: number; left: number }
  } | null
  price: {
    element_id: string
    text: string
    position: { top: number; left: number }
  } | null
  currency: {
    element_id: string
    position: { top: number; left: number }
  } | null
  images: Array<{
    element_id: string
    asset_id: string
    position: { top: number; left: number }
  }>
  unit: string | null // KG, UN, PCT, etc extraido do nome
}

interface DesignAnalysis {
  design_id: string
  total_pages: number
  products_per_page: Record<number, number>
  products: DetectedProduct[]
  pattern: 'name_with_unit' | 'name_unit_separate' | 'price_split' | 'unknown'
  has_unit_in_name: boolean
  has_images: boolean
  fixed_elements: string[] // IDs de elementos fixos (endereco, instagram, etc)
}

// Textos que indicam elementos fixos (nao sao produtos)
const FIXED_TEXT_PATTERNS = [
  /endere[çc]o/i,
  /oferta\s+v[áa]lida/i,
  /enquanto\s+durarem/i,
  /limitado\s+a/i,
  /whatsapp|whastapp/i,
  /delivery/i,
  /instagram/i,
  /siga\s+nosso/i,
  /\(\d{2}\)\s*\d/i, // telefone
  /R\.\s+da|Rua|QD\.|qd\./i, // endereco
  /@\w+/i, // @ instagram
  /todas\s+as\s+carnes/i,
  /#\w+/i, // hashtags
  /QUARTA|QUINTA|SEGUNDA|TERCA|SEXTA|SABADO|DOMINGO/i, // dias
  /frutas\s+e\s+verduras/i,
]

// Padroes de preco
const PRICE_PATTERN = /^\d{1,3}[.,]\d{2}$/

// Padroes de unidade
const UNIT_PATTERN = /\b(KG|UN|G|100G|500G|L|ML|PCT|CX|DZ|BD|FD|SC|PEA|BANDEJA|CARTELA)\b/i

// Extrair unidade do texto
const extractUnit = (text: string): string | null => {
  const match = text.match(UNIT_PATTERN)
  return match ? match[1].toUpperCase() : null
}

// Verificar se texto e um elemento fixo
const isFixedElement = (text: string): boolean => {
  const cleaned = text.replace(/\n/g, ' ').trim()
  return FIXED_TEXT_PATTERNS.some(p => p.test(cleaned))
}

// Verificar se texto e "R$"
const isCurrencySymbol = (text: string): boolean => {
  return text.trim() === 'R$'
}

// Verificar se texto e um preco
const isPrice = (text: string): boolean => {
  return PRICE_PATTERN.test(text.trim())
}

// Calcular distancia entre dois pontos
const distance = (
  a: { top: number; left: number },
  b: { top: number; left: number }
): number => {
  return Math.sqrt(Math.pow(a.top - b.top, 2) + Math.pow(a.left - b.left, 2))
}

// Limpar nome do produto (remover unidade, quebras de linha)
const cleanProductName = (text: string): string => {
  return text
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*(KG|UN|G|100G|500G|L|ML|PCT|CX|DZ|BD|FD|SC)\s*$/i, '')
    .trim()
}

/**
 * Analisa um design do Canva e identifica os grupos de produtos
 */
export const analyzeCanvaDesign = (
  designId: string,
  richtexts: any[],
  fills: any[],
  pages: any[]
): DesignAnalysis => {
  // Classificar elementos de texto
  const nameElements: RichtextElement[] = []
  const priceElements: RichtextElement[] = []
  const currencyElements: RichtextElement[] = []
  const fixedElementIds: string[] = []

  for (const rt of richtexts) {
    const text = (rt.regions || [])
      .map((r: any) => r.text || '')
      .join('')
      .trim()

    if (!text) continue

    const element: RichtextElement = {
      element_id: rt.element_id,
      text,
      page_index: rt.page_index,
      page_id: pages.find((p: any) => p.page_number === rt.page_index)?.page_id || '',
      position: rt.containerElement?.position || { top: 0, left: 0 },
      dimension: rt.containerElement?.dimension || { width: 0, height: 0 },
      type: rt.containerElement?.type || 'TEXT',
    }

    if (isFixedElement(text)) {
      fixedElementIds.push(element.element_id)
    } else if (isCurrencySymbol(text)) {
      currencyElements.push(element)
    } else if (isPrice(text)) {
      priceElements.push(element)
    } else if (text.length > 1 && text.length < 100) {
      // Provavelmente nome de produto
      nameElements.push(element)
    }
  }

  // Contar ocorrencias de cada asset_id para detectar decorativos/patterns
  const assetIdCount: Record<string, number> = {}
  for (const f of fills) {
    if (f.asset_id) {
      assetIdCount[f.asset_id] = (assetIdCount[f.asset_id] || 0) + 1
    }
  }

  // Classificar imagens editaveis (excluir backgrounds, icones e decorativos)
  const productImages: FillElement[] = fills
    .filter((f: any) => {
      if (!f.editable || f.type !== 'image') return false
      const dim = f.containerElement?.dimension
      if (!dim) return false
      // Excluir imagens muito grandes (backgrounds) ou muito pequenas (icones)
      const area = dim.width * dim.height
      if (area <= 1500 || area >= 200000) return false
      // Excluir asset_ids que aparecem em muitos elements (decorativos/patterns)
      if (f.asset_id && assetIdCount[f.asset_id] > 10) return false
      return true
    })
    .map((f: any) => ({
      element_id: f.element_id,
      asset_id: f.asset_id,
      page_index: f.page_index,
      position: f.containerElement?.position || { top: 0, left: 0 },
      dimension: f.containerElement?.dimension || { width: 0, height: 0 },
      editable: true,
    }))

  // Agrupar por proximidade: para cada preco, encontrar o nome e R$ mais proximo
  const products: DetectedProduct[] = []
  const usedNames = new Set<string>()
  const usedPrices = new Set<string>()
  const usedCurrencies = new Set<string>()
  // Estrategia: para cada R$ + preco, encontrar o nome mais proximo na mesma pagina
  for (const currency of currencyElements) {
    // Encontrar preco mais proximo ao R$ na mesma pagina
    let closestPrice: RichtextElement | null = null
    let closestPriceDist = Infinity

    for (const price of priceElements) {
      if (price.page_index !== currency.page_index) continue
      if (usedPrices.has(price.element_id)) continue

      const dist = distance(currency.position, price.position)
      if (dist < closestPriceDist && dist < 300) {
        closestPriceDist = dist
        closestPrice = price
      }
    }

    if (!closestPrice) continue

    // Encontrar nome mais proximo ao par R$+preco
    const midPoint = {
      top: (currency.position.top + closestPrice.position.top) / 2,
      left: (currency.position.left + closestPrice.position.left) / 2,
    }

    let closestName: RichtextElement | null = null
    let closestNameDist = Infinity

    for (const name of nameElements) {
      if (name.page_index !== currency.page_index) continue
      if (usedNames.has(name.element_id)) continue

      const dist = distance(midPoint, name.position)
      if (dist < closestNameDist && dist < 400) {
        closestNameDist = dist
        closestName = name
      }
    }

    if (!closestName) continue

    // Encontrar TODAS as imagens proximas ao grupo (raio de 400px)
    const nearbyImages: Array<{ element: FillElement; dist: number }> = []

    for (const img of productImages) {
      if (img.page_index !== currency.page_index) continue

      const dist = distance(midPoint, img.position)
      if (dist < 400) {
        nearbyImages.push({ element: img, dist })
      }
    }

    // Ordenar por distancia (mais proxima primeiro)
    nearbyImages.sort((a, b) => a.dist - b.dist)

    // Marcar como usados
    usedNames.add(closestName.element_id)
    usedPrices.add(closestPrice.element_id)
    usedCurrencies.add(currency.element_id)

    const unit = extractUnit(closestName.text)

    products.push({
      index: products.length,
      page_index: currency.page_index,
      page_id: closestName.page_id,
      name: {
        element_id: closestName.element_id,
        text: cleanProductName(closestName.text),
        position: closestName.position,
      },
      price: {
        element_id: closestPrice.element_id,
        text: closestPrice.text,
        position: closestPrice.position,
      },
      currency: {
        element_id: currency.element_id,
        position: currency.position,
      },
      images: nearbyImages.map(({ element }) => ({
        element_id: element.element_id,
        asset_id: element.asset_id,
        position: element.position,
      })),
      unit: unit || 'UN',
    })
  }

  // Ordenar produtos por posicao (top-left, esquerda para direita, cima para baixo)
  products.sort((a, b) => {
    if (a.page_index !== b.page_index) return a.page_index - b.page_index
    const aTop = a.name?.position.top || 0
    const bTop = b.name?.position.top || 0
    const rowDiff = Math.abs(aTop - bTop)
    if (rowDiff < 50) {
      // Mesma "linha" - ordenar por left
      return (a.name?.position.left || 0) - (b.name?.position.left || 0)
    }
    return aTop - bTop
  })

  // Reindexar
  products.forEach((p, i) => { p.index = i })

  // Contar produtos por pagina
  const productsPerPage: Record<number, number> = {}
  for (const p of products) {
    productsPerPage[p.page_index] = (productsPerPage[p.page_index] || 0) + 1
  }

  // Detectar padrao
  const hasUnitInName = products.some(p =>
    p.name && UNIT_PATTERN.test(p.name.text + ' ' + (p.unit || ''))
  )

  return {
    design_id: designId,
    total_pages: pages.length,
    products_per_page: productsPerPage,
    products,
    pattern: hasUnitInName ? 'name_with_unit' : 'unknown',
    has_unit_in_name: hasUnitInName,
    has_images: products.some(p => p.images.length > 0),
    fixed_elements: fixedElementIds,
  }
}
