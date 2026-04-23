// Analisador inteligente de designs do Canva usando OpenAI
// Classifica automaticamente elementos de texto e imagem usando IA
// Com fallback para logica de regex quando a IA falha

// ==================== INTERFACES ====================

export interface AnalyzedElement {
  element_id: string
  page_index: number
  type: 'richtext' | 'image'
  raw_text?: string

  category:
    | 'product_name'
    | 'product_price'
    | 'currency_symbol'
    | 'product_unit'
    | 'company_name'
    | 'company_slogan'
    | 'company_logo'
    | 'contact_phone'
    | 'contact_whatsapp'
    | 'contact_address'
    | 'contact_instagram'
    | 'contact_website'
    | 'promo_title'
    | 'promo_subtitle'
    | 'promo_date'
    | 'promo_disclaimer'
    | 'custom_text'
    | 'decorative_text'
    | 'product_image'
    | 'background_image'
    | 'decorative_image'
    | 'logo_image'
    | 'unknown'

  group_id?: number
  editable: boolean
  position: { top: number; left: number }
  dimension?: { width: number; height: number }
}

interface ProductGroup {
  group_id: number
  name_element?: AnalyzedElement
  price_element?: AnalyzedElement
  currency_element?: AnalyzedElement
  unit_element?: AnalyzedElement
  image_elements: AnalyzedElement[]
}

interface PageAnalysis {
  page_index: number
  elements: AnalyzedElement[]
  product_groups: ProductGroup[]
  editable_texts: AnalyzedElement[]
  company_elements: AnalyzedElement[]
}

export interface DesignIntelligentAnalysis {
  design_id: string
  design_type: 'offer' | 'institutional' | 'mixed' | 'unknown'
  total_pages: number
  pages: PageAnalysis[]
  summary: string
}

// Resposta esperada da OpenAI
interface AIClassificationResponse {
  design_type: 'offer' | 'institutional' | 'mixed'
  elements: Array<{
    element_id: string
    category: AnalyzedElement['category']
    editable: boolean
    group_id?: number
  }>
  summary: string
}

// ==================== CACHE ====================

// Cache em memoria com TTL de 30 minutos
const analysisCache = new Map<string, { result: DesignIntelligentAnalysis; timestamp: number }>()
const CACHE_TTL_MS = 30 * 60 * 1000

const getCached = (designId: string): DesignIntelligentAnalysis | null => {
  const entry = analysisCache.get(designId)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    analysisCache.delete(designId)
    return null
  }
  return entry.result
}

const setCache = (designId: string, result: DesignIntelligentAnalysis): void => {
  // Limitar cache a 100 entradas para nao estourar memoria
  if (analysisCache.size > 100) {
    const oldest = [...analysisCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)
    for (let i = 0; i < Math.min(20, oldest.length); i++) {
      const entry = oldest[i]
      if (entry) analysisCache.delete(entry[0])
    }
  }
  analysisCache.set(designId, { result, timestamp: Date.now() })
}

// ==================== PADROES REGEX (FALLBACK) ====================

const PRICE_PATTERN = /^\d{1,3}[.,]\d{2}$/
const UNIT_PATTERN = /\b(KG|UN|G|100G|500G|L|ML|PCT|CX|DZ|BD|FD|SC|PEA|BANDEJA|CARTELA)\b/i

const FIXED_TEXT_PATTERNS = [
  /endere[çc]o/i,
  /oferta\s+v[áa]lida/i,
  /enquanto\s+durarem/i,
  /limitado\s+a/i,
  /whatsapp|whastapp/i,
  /delivery/i,
  /instagram/i,
  /siga\s+nosso/i,
  /\(\d{2}\)\s*\d/i,
  /R\.\s+da|Rua|QD\.|qd\./i,
  /@\w+/i,
  /todas\s+as\s+carnes/i,
  /#\w+/i,
  /QUARTA|QUINTA|SEGUNDA|TERCA|SEXTA|SABADO|DOMINGO/i,
  /frutas\s+e\s+verduras/i,
]

const PHONE_PATTERN = /\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/
const INSTAGRAM_PATTERN = /@[\w.]+/
const DATE_PATTERN = /\d{1,2}\/\d{1,2}(\/\d{2,4})?/
const PROMO_TITLE_PATTERNS = [
  /QUARTA|QUINTA|SEGUNDA|TERCA|SEXTA|SABADO|DOMINGO/i,
  /FEIRA|OFERTAS?|PROMO[ÇC][ÃÕAO]|SUPER|MEGA|HIPER/i,
  /ENCARTE|SALDÃO|LIQUIDA/i,
]
const DISCLAIMER_PATTERNS = [
  /enquanto\s+durarem/i,
  /oferta\s+v[áa]lida/i,
  /limitado\s+a/i,
  /sujeito\s+a/i,
  /imagens?\s+meramente/i,
]

// ==================== EXTRACAO DE DADOS BRUTOS ====================

interface RawTextElement {
  element_id: string
  text: string
  page_index: number
  position: { top: number; left: number }
  dimension: { width: number; height: number }
}

interface RawImageElement {
  element_id: string
  asset_id: string
  page_index: number
  position: { top: number; left: number }
  dimension: { width: number; height: number }
  area: number
  editable: boolean
}

/**
 * Extrai textos dos richtexts com posicao e dimensao
 */
const extractTextElements = (richtexts: any[]): RawTextElement[] => {
  const elements: RawTextElement[] = []

  for (const rt of richtexts) {
    const text = (rt.regions || [])
      .map((r: any) => r.text || '')
      .join('')
      .trim()

    if (!text) continue

    elements.push({
      element_id: rt.element_id,
      text,
      page_index: rt.page_index,
      position: rt.containerElement?.position || { top: 0, left: 0 },
      dimension: rt.containerElement?.dimension || { width: 0, height: 0 },
    })
  }

  return elements
}

/**
 * Extrai imagens dos fills com posicao e dimensao
 */
const extractImageElements = (fills: any[]): RawImageElement[] => {
  const elements: RawImageElement[] = []

  for (const f of fills) {
    if (f.type !== 'image' || !f.asset_id) continue

    const dim = f.containerElement?.dimension || { width: 0, height: 0 }
    const area = dim.width * dim.height

    elements.push({
      element_id: f.element_id,
      asset_id: f.asset_id,
      page_index: f.page_index,
      position: f.containerElement?.position || { top: 0, left: 0 },
      dimension: dim,
      area,
      editable: f.editable || false,
    })
  }

  return elements
}

// ==================== CHAMADA OPENAI ====================

const SYSTEM_PROMPT = `Você é um analisador especializado em designs gráficos para varejo brasileiro (supermercados, açougues, hortifrútis).

Analise os elementos de um design e classifique CADA UM nas categorias abaixo.

TIPOS DE DESIGN:
- "offer": encarte de ofertas com produtos e preços (contém "R$", preços numéricos)
- "institutional": banner/post institucional (logo, slogan, contato, sem preços de produtos)
- "mixed": mistura dos dois tipos

CATEGORIAS DE TEXTO:
- product_name: nome de produto (ex: "FÍGADO BOVINO KG", "BANANA PRATA")
- product_price: preço numérico (ex: "12,99", "3,49")
- currency_symbol: símbolo "R$"
- product_unit: unidade separada do nome (KG, UN, PCT, etc)
- company_name: nome da empresa/loja
- company_slogan: slogan da empresa
- contact_phone: telefone
- contact_whatsapp: whatsapp
- contact_address: endereço físico
- contact_instagram: perfil instagram (@xxx)
- contact_website: site/url
- promo_title: título promocional ("QUINTA DA CARNE", "SUPER OFERTAS")
- promo_subtitle: subtítulo promocional
- promo_date: datas de validade da promoção
- promo_disclaimer: aviso legal ("enquanto durarem os estoques")
- custom_text: texto editável genérico/institucional
- decorative_text: texto puramente decorativo (não editável, geralmente repetido ou sem significado útil)

CATEGORIAS DE IMAGEM:
- product_image: foto de produto (área média, editável)
- background_image: imagem de fundo (área muito grande)
- decorative_image: elemento decorativo (ícone, moldura, splash, selo)
- logo_image: logotipo da empresa

AGRUPAMENTO:
- Elementos que pertencem ao MESMO produto devem ter o MESMO group_id (inteiro sequencial começando em 1)
- Um grupo de produto típico: product_name + currency_symbol + product_price + product_image
- Elementos que não são de produto (contato, promo, empresa) NÃO recebem group_id

EDITÁVEL:
- editable=true: textos que o cliente pode querer mudar (nomes de produto, preços, dados da empresa, datas)
- editable=false: textos decorativos, disclaimers padrão, elementos de layout

Retorne APENAS JSON válido, sem markdown.`

/**
 * Chama a OpenAI para classificar os elementos
 * Pagina em lotes de 50 elementos para nao estourar o prompt
 */
const callOpenAI = async (
  textElements: RawTextElement[],
  imageElements: RawImageElement[]
): Promise<AIClassificationResponse | null> => {
  const apiKey = process.env.NUXT_OPENAI_API_KEY || process.env.OPENAI_API_KEY

  if (!apiKey) {
    console.warn('[canva-ai-analyzer] Chave da OpenAI não encontrada. Usando fallback de regex.')
    return null
  }

  // Preparar dados dos textos (compactados para economizar tokens)
  const textData = textElements.map(el => ({
    id: el.element_id,
    text: el.text.substring(0, 200),
    page: el.page_index,
    pos: { t: Math.round(el.position.top), l: Math.round(el.position.left) },
    dim: { w: Math.round(el.dimension.width), h: Math.round(el.dimension.height) },
  }))

  // Preparar dados das imagens (compactados)
  const imageData = imageElements.map(el => ({
    id: el.element_id,
    page: el.page_index,
    area: Math.round(el.area),
    pos: { t: Math.round(el.position.top), l: Math.round(el.position.left) },
    dim: { w: Math.round(el.dimension.width), h: Math.round(el.dimension.height) },
    editable: el.editable,
  }))

  // Paginar se houver muitos elementos (max 50 por chamada)
  const MAX_ELEMENTS_PER_CALL = 50
  const totalElements = textData.length + imageData.length

  if (totalElements <= MAX_ELEMENTS_PER_CALL) {
    return await singleOpenAICall(textData, imageData, apiKey)
  }

  // Paginar: dividir elementos em chunks
  const allResults: AIClassificationResponse = {
    design_type: 'unknown' as any,
    elements: [],
    summary: '',
  }

  const chunks = paginateElements(textData, imageData, MAX_ELEMENTS_PER_CALL)
  const summaries: string[] = []

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    if (!chunk) continue
    const result = await singleOpenAICall(chunk.texts, chunk.images, apiKey)

    if (!result) return null // falha na API, usar fallback

    allResults.elements.push(...result.elements)
    summaries.push(result.summary)

    // Pegar design_type do primeiro chunk (tem mais contexto geral)
    if (i === 0) {
      allResults.design_type = result.design_type
    }
  }

  allResults.summary = summaries.join(' ')
  return allResults
}

/**
 * Divide elementos em chunks para paginacao
 */
const paginateElements = (
  texts: any[],
  images: any[],
  maxPerChunk: number
): Array<{ texts: any[]; images: any[] }> => {
  const all = [
    ...texts.map(t => ({ ...t, _type: 'text' as const })),
    ...images.map(i => ({ ...i, _type: 'image' as const })),
  ]

  const chunks: Array<{ texts: any[]; images: any[] }> = []
  for (let i = 0; i < all.length; i += maxPerChunk) {
    const chunk = all.slice(i, i + maxPerChunk)
    chunks.push({
      texts: chunk.filter(c => c._type === 'text').map(({ _type, ...rest }) => rest),
      images: chunk.filter(c => c._type === 'image').map(({ _type, ...rest }) => rest),
    })
  }

  return chunks
}

/**
 * Uma unica chamada a OpenAI
 */
const singleOpenAICall = async (
  textData: any[],
  imageData: any[],
  apiKey: string
): Promise<AIClassificationResponse | null> => {
  const userPrompt = `Analise e classifique cada elemento deste design:

ELEMENTOS DE TEXTO (${textData.length}):
${JSON.stringify(textData, null, 0)}

ELEMENTOS DE IMAGEM (${imageData.length}):
${JSON.stringify(imageData, null, 0)}

Retorne JSON com: { "design_type": "offer"|"institutional"|"mixed", "elements": [{ "element_id": "xxx", "category": "...", "editable": true/false, "group_id": N_ou_null }], "summary": "resumo em português" }`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(60_000),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'sem detalhes')
      console.error(`[canva-ai-analyzer] Erro na OpenAI (${response.status}):`, errorText)
      return null
    }

    const data = await response.json() as any
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      console.error('[canva-ai-analyzer] Resposta vazia da OpenAI')
      return null
    }

    const parsed = JSON.parse(content) as AIClassificationResponse
    return parsed
  } catch (error) {
    console.error('[canva-ai-analyzer] Erro ao chamar OpenAI:', error)
    return null
  }
}

// ==================== FALLBACK COM REGEX ====================

/**
 * Classificacao por regex quando a IA nao esta disponivel ou falha
 */
const classifyWithRegex = (
  textElements: RawTextElement[],
  imageElements: RawImageElement[]
): { elements: AnalyzedElement[]; designType: 'offer' | 'institutional' | 'mixed' | 'unknown' } => {
  const analyzed: AnalyzedElement[] = []
  let hasProducts = false
  let hasInstitutional = false

  // Classificar textos
  for (const el of textElements) {
    const text = el.text.trim()
    let category: AnalyzedElement['category'] = 'unknown'
    let editable = true

    if (text === 'R$') {
      category = 'currency_symbol'
      editable = false
    } else if (PRICE_PATTERN.test(text)) {
      category = 'product_price'
      hasProducts = true
    } else if (UNIT_PATTERN.test(text) && text.length <= 10) {
      category = 'product_unit'
      editable = false
    } else if (PHONE_PATTERN.test(text)) {
      category = /whatsapp|whastapp/i.test(text) ? 'contact_whatsapp' : 'contact_phone'
      hasInstitutional = true
    } else if (INSTAGRAM_PATTERN.test(text) && text.startsWith('@')) {
      category = 'contact_instagram'
      hasInstitutional = true
    } else if (/https?:\/\/|www\./i.test(text)) {
      category = 'contact_website'
      hasInstitutional = true
    } else if (/Rua|R\.\s+da|QD\.|Quadra|Setor|CEP|Av\.|Avenida/i.test(text)) {
      category = 'contact_address'
      hasInstitutional = true
    } else if (DISCLAIMER_PATTERNS.some(p => p.test(text))) {
      category = 'promo_disclaimer'
      editable = false
    } else if (DATE_PATTERN.test(text) && /v[áa]lid|at[ée]/i.test(text)) {
      category = 'promo_date'
    } else if (PROMO_TITLE_PATTERNS.some(p => p.test(text)) && text.length < 50) {
      category = 'promo_title'
    } else if (/oferta|promo|super|desconto/i.test(text) && text.length < 80) {
      category = 'promo_subtitle'
    } else if (text.length > 1 && text.length < 100 && !FIXED_TEXT_PATTERNS.some(p => p.test(text))) {
      // Texto curto nao fixo = provavelmente nome de produto
      category = 'product_name'
      hasProducts = true
    } else if (text.length >= 100) {
      category = 'custom_text'
      hasInstitutional = true
    } else {
      category = 'decorative_text'
      editable = false
    }

    analyzed.push({
      element_id: el.element_id,
      page_index: el.page_index,
      type: 'richtext',
      raw_text: text,
      category,
      editable,
      position: el.position,
      dimension: el.dimension,
    })
  }

  // Classificar imagens
  for (const el of imageElements) {
    let category: AnalyzedElement['category'] = 'unknown'
    let editable = el.editable

    if (el.area >= 200000) {
      category = 'background_image'
      editable = false
    } else if (el.area <= 1500) {
      category = 'decorative_image'
      editable = false
    } else if (el.editable && el.area > 1500 && el.area < 200000) {
      category = 'product_image'
    } else {
      category = 'decorative_image'
      editable = false
    }

    analyzed.push({
      element_id: el.element_id,
      page_index: el.page_index,
      type: 'image',
      category,
      editable,
      position: el.position,
      dimension: el.dimension,
    })
  }

  // Determinar tipo de design
  let designType: 'offer' | 'institutional' | 'mixed' | 'unknown' = 'unknown'
  if (hasProducts && hasInstitutional) designType = 'mixed'
  else if (hasProducts) designType = 'offer'
  else if (hasInstitutional) designType = 'institutional'

  return { elements: analyzed, designType }
}

// ==================== AGRUPAMENTO ESPACIAL ====================

/**
 * Calcula distancia entre dois pontos
 */
const distance = (
  a: { top: number; left: number },
  b: { top: number; left: number }
): number => {
  return Math.sqrt(Math.pow(a.top - b.top, 2) + Math.pow(a.left - b.left, 2))
}

/**
 * Agrupa elementos de produto por proximidade espacial
 * Usado no fallback por regex ou quando a IA nao retorna group_ids
 */
const groupProductElements = (elements: AnalyzedElement[]): ProductGroup[] => {
  const groups: ProductGroup[] = []

  const currencies = elements.filter(e => e.category === 'currency_symbol')
  const prices = elements.filter(e => e.category === 'product_price')
  const names = elements.filter(e => e.category === 'product_name')
  const units = elements.filter(e => e.category === 'product_unit')
  const productImages = elements.filter(e => e.category === 'product_image')

  const usedIds = new Set<string>()

  for (const currency of currencies) {
    if (usedIds.has(currency.element_id)) continue

    // Encontrar preco mais proximo na mesma pagina (raio 300px)
    let closestPrice: AnalyzedElement | null = null
    let closestPriceDist = Infinity

    for (const price of prices) {
      if (price.page_index !== currency.page_index) continue
      if (usedIds.has(price.element_id)) continue
      const dist = distance(currency.position, price.position)
      if (dist < closestPriceDist && dist < 300) {
        closestPriceDist = dist
        closestPrice = price
      }
    }

    if (!closestPrice) continue

    // Ponto medio entre R$ e preco
    const midPoint = {
      top: (currency.position.top + closestPrice.position.top) / 2,
      left: (currency.position.left + closestPrice.position.left) / 2,
    }

    // Encontrar nome mais proximo (raio 400px)
    let closestName: AnalyzedElement | null = null
    let closestNameDist = Infinity

    for (const name of names) {
      if (name.page_index !== currency.page_index) continue
      if (usedIds.has(name.element_id)) continue
      const dist = distance(midPoint, name.position)
      if (dist < closestNameDist && dist < 400) {
        closestNameDist = dist
        closestName = name
      }
    }

    if (!closestName) continue

    // Encontrar unidade mais proxima (opcional, raio 300px)
    let closestUnit: AnalyzedElement | null = null
    let closestUnitDist = Infinity

    for (const unit of units) {
      if (unit.page_index !== currency.page_index) continue
      if (usedIds.has(unit.element_id)) continue
      const dist = distance(midPoint, unit.position)
      if (dist < closestUnitDist && dist < 300) {
        closestUnitDist = dist
        closestUnit = unit
      }
    }

    // Encontrar imagens proximas (raio 400px)
    const nearbyImages = productImages
      .filter(img => {
        if (img.page_index !== currency.page_index) return false
        if (usedIds.has(img.element_id)) return false
        return distance(midPoint, img.position) < 400
      })
      .sort((a, b) => distance(midPoint, a.position) - distance(midPoint, b.position))

    const groupId = groups.length + 1

    // Marcar como usados e atribuir group_id
    usedIds.add(currency.element_id)
    usedIds.add(closestPrice.element_id)
    usedIds.add(closestName.element_id)
    currency.group_id = groupId
    closestPrice.group_id = groupId
    closestName.group_id = groupId

    if (closestUnit) {
      usedIds.add(closestUnit.element_id)
      closestUnit.group_id = groupId
    }

    const groupImages: AnalyzedElement[] = []
    for (const img of nearbyImages) {
      if (!usedIds.has(img.element_id)) {
        usedIds.add(img.element_id)
        img.group_id = groupId
        groupImages.push(img)
      }
    }

    groups.push({
      group_id: groupId,
      name_element: closestName,
      price_element: closestPrice,
      currency_element: currency,
      unit_element: closestUnit || undefined,
      image_elements: groupImages,
    })
  }

  return groups
}

// ==================== FUNCAO PRINCIPAL ====================

/**
 * Analisa um design do Canva usando IA (OpenAI) com fallback para regex.
 * Resultados sao cacheados por 30 minutos por design_id.
 *
 * @param designId - ID do design no Canva
 * @param richtexts - Dados brutos de texto da transacao de edicao
 * @param fills - Dados brutos de preenchimento (imagens) da transacao
 * @param pages - Informacoes das paginas do design
 * @returns Analise inteligente completa do design
 */
export const analyzeDesignWithAI = async (
  designId: string,
  richtexts: any[],
  fills: any[],
  pages: any[]
): Promise<DesignIntelligentAnalysis> => {
  // Verificar cache
  const cached = getCached(designId)
  if (cached) {
    console.log(`[canva-ai-analyzer] Cache hit para design ${designId}`)
    return cached
  }

  // Extrair elementos brutos
  const textElements = extractTextElements(richtexts)
  const imageElements = extractImageElements(fills)

  let allAnalyzedElements: AnalyzedElement[] = []
  let designType: 'offer' | 'institutional' | 'mixed' | 'unknown' = 'unknown'
  let summary = ''

  // Tentar classificacao com IA
  const aiResult = await callOpenAI(textElements, imageElements)

  if (aiResult) {
    console.log(`[canva-ai-analyzer] Classificação por IA concluída para design ${designId}`)
    designType = aiResult.design_type
    summary = aiResult.summary

    // Mapear resultados da IA para AnalyzedElement
    const elementMap = new Map<string, AIClassificationResponse['elements'][0]>()
    for (const el of aiResult.elements) {
      elementMap.set(el.element_id, el)
    }

    // Montar elementos de texto com classificacao da IA
    for (const textEl of textElements) {
      const aiClass = elementMap.get(textEl.element_id)
      allAnalyzedElements.push({
        element_id: textEl.element_id,
        page_index: textEl.page_index,
        type: 'richtext',
        raw_text: textEl.text,
        category: aiClass?.category || 'unknown',
        group_id: aiClass?.group_id || undefined,
        editable: aiClass?.editable ?? true,
        position: textEl.position,
        dimension: textEl.dimension,
      })
    }

    // Montar elementos de imagem com classificacao da IA
    for (const imgEl of imageElements) {
      const aiClass = elementMap.get(imgEl.element_id)
      allAnalyzedElements.push({
        element_id: imgEl.element_id,
        page_index: imgEl.page_index,
        type: 'image',
        category: aiClass?.category || 'unknown',
        group_id: aiClass?.group_id || undefined,
        editable: aiClass?.editable ?? imgEl.editable,
        position: imgEl.position,
        dimension: imgEl.dimension,
      })
    }
  } else {
    // Fallback: classificacao por regex
    console.log(`[canva-ai-analyzer] Usando fallback de regex para design ${designId}`)
    const regexResult = classifyWithRegex(textElements, imageElements)
    allAnalyzedElements = regexResult.elements
    designType = regexResult.designType

    const totalTexts = allAnalyzedElements.filter(e => e.type === 'richtext').length
    const totalImages = allAnalyzedElements.filter(e => e.type === 'image').length
    summary = `Design analisado por regex: ${totalTexts} textos e ${totalImages} imagens em ${pages.length} página(s). Tipo detectado: ${designType}.`
  }

  // Agrupar produtos por proximidade se a IA nao retornou group_ids
  const hasAIGroups = allAnalyzedElements.some(e => e.group_id !== undefined && e.group_id > 0)
  if (!hasAIGroups) {
    groupProductElements(allAnalyzedElements)
    // Os group_ids sao atribuidos por referencia nos elementos
  }

  // Montar resultado organizado por pagina
  const pageMap = new Map<number, AnalyzedElement[]>()
  for (const el of allAnalyzedElements) {
    if (!pageMap.has(el.page_index)) {
      pageMap.set(el.page_index, [])
    }
    pageMap.get(el.page_index)!.push(el)
  }

  const analysisPages: PageAnalysis[] = []

  for (const page of pages) {
    const pageIndex = page.page_number ?? page.page_index ?? analysisPages.length
    const pageElements = pageMap.get(pageIndex) || []

    // Extrair grupos de produto desta pagina
    const groupIds = [...new Set(
      pageElements
        .filter(e => e.group_id !== undefined)
        .map(e => e.group_id!)
    )]

    const productGroups: ProductGroup[] = groupIds.map(gid => {
      const groupEls = pageElements.filter(e => e.group_id === gid)
      return {
        group_id: gid,
        name_element: groupEls.find(e => e.category === 'product_name'),
        price_element: groupEls.find(e => e.category === 'product_price'),
        currency_element: groupEls.find(e => e.category === 'currency_symbol'),
        unit_element: groupEls.find(e => e.category === 'product_unit'),
        image_elements: groupEls.filter(e => e.type === 'image'),
      }
    })

    // Textos editaveis que NAO sao parte de grupos de produto
    const productCategories = ['product_name', 'product_price', 'currency_symbol', 'product_unit']
    const editableTexts = pageElements.filter(
      e => e.type === 'richtext' && e.editable && !productCategories.includes(e.category)
    )

    // Elementos da empresa (logo, nome, contatos)
    const companyCategories = [
      'company_name', 'company_slogan', 'company_logo',
      'contact_phone', 'contact_whatsapp', 'contact_address',
      'contact_instagram', 'contact_website', 'logo_image',
    ]
    const companyElements = pageElements.filter(e => companyCategories.includes(e.category))

    analysisPages.push({
      page_index: pageIndex,
      elements: pageElements,
      product_groups: productGroups,
      editable_texts: editableTexts,
      company_elements: companyElements,
    })
  }

  const result: DesignIntelligentAnalysis = {
    design_id: designId,
    design_type: designType,
    total_pages: pages.length,
    pages: analysisPages,
    summary,
  }

  // Salvar no cache
  setCache(designId, result)

  return result
}

/**
 * Limpa o cache de analises (util para forcar re-analise)
 */
export const clearAnalysisCache = (designId?: string): void => {
  if (designId) {
    analysisCache.delete(designId)
  } else {
    analysisCache.clear()
  }
}

/**
 * Retorna estatisticas do cache
 */
export const getAnalysisCacheStats = (): { size: number; keys: string[] } => {
  return {
    size: analysisCache.size,
    keys: [...analysisCache.keys()],
  }
}
