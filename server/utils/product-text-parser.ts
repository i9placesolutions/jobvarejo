// Parser deterministico de listas de produtos.
// Substitui a chamada OpenAI no /api/parse-products para os formatos suportados:
// - Texto livre (uma linha por produto, ex: "coca cola 2lt 12,99 limite 12 por cliente")
// - Tabela CSV/TSV (com cabecalho, padrao atacarejo brasileiro)
// - XLSX/PDF (entram aqui ja como texto extraido)

export type ParsedProduct = {
  name: string
  productCode: string | null
  brand: string | null
  weight: string | null
  price: string | null
  pricePack: string | null
  priceUnit: string | null
  priceSpecial: string | null
  priceSpecialUnit: string | null
  specialCondition: string | null
  priceWholesale: string | null
  wholesaleTrigger: number | null
  wholesaleTriggerUnit: string | null
  packQuantity: number | null
  packUnit: string | null
  packageLabel: string | null
  limit: string | null
  flavor: string | null
}

const emptyProduct = (): ParsedProduct => ({
  name: '',
  productCode: null,
  brand: null,
  weight: null,
  price: null,
  pricePack: null,
  priceUnit: null,
  priceSpecial: null,
  priceSpecialUnit: null,
  specialCondition: null,
  priceWholesale: null,
  wholesaleTrigger: null,
  wholesaleTriggerUnit: null,
  packQuantity: null,
  packUnit: null,
  packageLabel: null,
  limit: null,
  flavor: null
})

// ============================================================================
// Helpers de normalizacao (movidos do parse-products.post.ts)
// ============================================================================

export const parseNumber = (v: any): number | null => {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const s0 = String(v).trim()
  if (!s0) return null
  const s = s0.replace(/[^\d.,-]/g, '')
  if (!s) return null
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  let normalized = s
  if (hasComma && hasDot) {
    normalized = s.replace(/\./g, '').replace(',', '.')
  } else if (hasComma) {
    normalized = s.replace(/\./g, '').replace(',', '.')
  } else {
    normalized = s.replace(/,/g, '')
  }
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

export const normalizePrice = (v: any): string | null => {
  const n = parseNumber(v)
  if (n === null) return null
  return n.toFixed(2).replace('.', ',')
}

export const normalizeProductCode = (v: any): string | null => {
  if (v === null || v === undefined) return null
  const code = String(v).trim().replace(/[^a-zA-Z0-9]/g, '')
  if (!code || code.length < 6) return null
  return code.toUpperCase()
}

export const extractProductCodeFromName = (name: string): string | null => {
  const tokens = String(name || '').match(/\b\d{8,14}\b/g) || []
  if (!tokens.length) return null
  const candidate = tokens.sort((a, b) => b.length - a.length)[0]
  return normalizeProductCode(candidate)
}

const normalizeToken = (v: any): string => {
  const s = String(v ?? '').trim()
  if (!s) return ''
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '')
}

export const normalizePackageUnit = (v: any): string | null => {
  const tok = normalizeToken(v)
  if (!tok) return null
  const compact = tok.replace(/[.]/g, '')
  if (compact === 'CX' || compact === 'CAIXA' || compact === 'CAIXAS') return 'CX'
  if (compact === 'FD' || compact === 'FARDO' || compact === 'FARDOS') return 'FD'
  if (
    compact === 'UN' ||
    compact === 'UND' ||
    compact === 'UNID' ||
    compact === 'UNIDADE' ||
    compact === 'UNIDADES' ||
    compact === 'UNIT'
  ) return 'UN'
  if (compact === 'PCT' || compact === 'PACOTE' || compact === 'PACOTES') return 'PCT'
  if (compact === 'EMB' || compact === 'EMBAL' || compact === 'EMBALAGEM' || compact === 'EMBALAGENS') return 'EMB'
  return compact
}

export const extractDefaultSpecialRuleFromSource = (
  sourceText?: string | null
): { minQty: number; unitHint: string | null } | null => {
  if (!sourceText) return null

  const rawLines = String(sourceText).split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (!rawLines.length) return null

  const normalizeLine = (line: string) =>
    line.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()

  const parseLine = (line: string): { minQty: number; unitHint: string | null } | null => {
    const normalized = normalizeLine(line)
    const matches = Array.from(
      normalized.matchAll(
        /\bACIMA(?:\s+DE)?\s*(\d{1,3})(?:\s*(EMB(?:ALAGEM)?|CX|CAIXA|FD|FARDO|UN|UND|UNID(?:ADE)?|PCT|PACOTE))?/g
      )
    )
    if (!matches.length) return null
    for (const m of matches) {
      const minQty = Number.parseInt(m[1] || '', 10)
      if (!Number.isFinite(minQty) || minQty <= 0) continue
      const unitHint = normalizePackageUnit(m[2] || null)
      return { minQty, unitHint }
    }
    return null
  }

  const headerCandidates = rawLines.slice(0, 5)
  for (const line of headerCandidates) {
    const probe = normalizeLine(line)
    if (!probe.includes('PRECO') || !probe.includes('ACIMA')) continue
    const parsed = parseLine(line)
    if (parsed) return parsed
  }

  const first = rawLines[0] || ''
  const firstProbe = normalizeLine(first)
  const looksTabularHeader = /[;,|\t]/.test(first) || firstProbe.includes('PRODUTO') || firstProbe.includes('EMBAL')
  if (looksTabularHeader && firstProbe.includes('ACIMA')) {
    return parseLine(first)
  }

  return null
}

// ============================================================================
// Extracao de "limite por cliente" (LIMITE 3 UND POR CLIENTE, etc.)
// ============================================================================

const LIMIT_PATTERNS: RegExp[] = [
  // LIMITE 3 UND POR CLIENTE / LIM. 5 UN POR PESSOA
  /(lim(?:ite|\.)?)\s+(\d{1,3})\s*(un[d.]?|unid(?:ades?)?|pct|cx|fd|fardo|caixa|pacote)?\s*(?:por\s+(cliente|pessoa))?/i,
  // MÁXIMO 2 POR CLIENTE / MAX 5 UN
  /(m[aá]x(?:imo|\.)?)\s+(\d{1,3})\s*(un[d.]?|unid(?:ades?)?)?\s*(?:por\s+(cliente|pessoa))?/i,
  // ATÉ 4 UN POR CLIENTE
  /(at[eé])\s+(\d{1,3})\s*(un[d.]?|unid(?:ades?)?)\s+por\s+(cliente|pessoa)/i,
  // LIMITADO A 3
  /(limitado\s+a)\s+(\d{1,3})\s*(un[d.]?|unid(?:ades?)?)?(?:\s+por\s+(cliente|pessoa))?/i
]

export const extractLimitFromText = (raw: string): { limit: string | null; rest: string } => {
  if (!raw) return { limit: null, rest: '' }
  let text = raw

  for (const pattern of LIMIT_PATTERNS) {
    const m = text.match(pattern)
    if (!m) continue
    const qty = Number.parseInt(m[2] || '', 10)
    if (!Number.isFinite(qty) || qty <= 0) continue

    const unitRaw = (m[3] || '').toLowerCase()
    const unit = unitRaw.startsWith('un') ? 'UN'
      : unitRaw === 'pct' || unitRaw.startsWith('pacote') ? 'PCT'
      : unitRaw === 'cx' || unitRaw.startsWith('caixa') ? 'CX'
      : unitRaw === 'fd' || unitRaw.startsWith('fardo') ? 'FD'
      : 'UN'
    const target = (m[4] || '').toLowerCase() === 'pessoa' ? 'POR PESSOA' : 'POR CLIENTE'

    const limit = `LIMITE ${qty} ${unit} ${target}`
    const rest = (text.slice(0, m.index) + text.slice((m.index || 0) + m[0].length)).replace(/\s{2,}/g, ' ').trim()
    return { limit, rest }
  }

  return { limit: null, rest: text }
}

// ============================================================================
// Parser de TEXTO LIVRE
// Formato esperado por linha:
//   "<NOME COM GRAMATURA> [LIMITE ...] <PRECO>"
//   "<NOME> <PRECO> [LIMITE ...]"
// ============================================================================

const PRICE_TOKEN_REGEX = /(?:r\$\s*)?(\d{1,4}(?:[.,]\d{3})*[,.]\d{2})\b/gi

const isProbablyHeaderOrComment = (line: string): boolean => {
  const probe = line.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()
  if (!probe) return true
  if (probe.startsWith('#')) return true
  if (probe.startsWith('//')) return true
  // Cabecalho tabular: tem palavras de coluna sem nenhum preco
  if (/^(PRODUTO|ITEM|DESCRICAO|NOME)\b/.test(probe) && !PRICE_TOKEN_REGEX.test(line)) return true
  PRICE_TOKEN_REGEX.lastIndex = 0
  return false
}

export const parseProductsFromFreeText = (raw: string): ParsedProduct[] => {
  const text = String(raw || '').trim()
  if (!text) return []

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const products: ParsedProduct[] = []

  for (const line of lines) {
    if (isProbablyHeaderOrComment(line)) continue

    // 1) Extrai limite (e remove do texto)
    const { limit, rest: afterLimit } = extractLimitFromText(line)

    // 2) Extrai TODOS os tokens de preco
    PRICE_TOKEN_REGEX.lastIndex = 0
    const matches: { value: string; index: number; length: number }[] = []
    let m: RegExpExecArray | null
    while ((m = PRICE_TOKEN_REGEX.exec(afterLimit)) !== null) {
      matches.push({ value: m[1] || '', index: m.index, length: m[0].length })
    }

    if (!matches.length) {
      // Sem preco identificavel: ignora linha (provavelmente cabecalho ou ruido)
      continue
    }

    // Remove os precos do texto para isolar o nome
    let cleaned = afterLimit
    for (let i = matches.length - 1; i >= 0; i--) {
      const mt = matches[i]!
      cleaned = cleaned.slice(0, mt.index) + cleaned.slice(mt.index + mt.length)
    }
    const name = cleaned
      .replace(/[\s\-:|;,]+$/g, '')
      .replace(/^[\s\-:|;,]+/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()

    if (!name) continue

    const prices = matches
      .map(mt => normalizePrice(mt.value))
      .filter((p): p is string => !!p)

    if (!prices.length) continue

    const product = emptyProduct()
    product.name = name
    product.limit = limit

    // Heuristica de mapeamento de precos:
    //   1 preco  -> price + priceUnit
    //   2 precos -> menor=priceSpecial, maior=priceUnit (promo + normal)
    //   3+ precos -> primeiro=pricePack, segundo=priceUnit, ultimos=especial
    if (prices.length === 1) {
      product.price = prices[0]!
      product.priceUnit = prices[0]!
      product.pricePack = prices[0]!
    } else if (prices.length === 2) {
      const sortedAsc = [...prices].sort((a, b) => (parseNumber(a) || 0) - (parseNumber(b) || 0))
      product.priceSpecial = sortedAsc[0]!
      product.priceSpecialUnit = sortedAsc[0]!
      product.priceUnit = sortedAsc[1]!
      product.price = sortedAsc[1]!
    } else {
      product.pricePack = prices[0]!
      product.priceUnit = prices[1]!
      product.priceSpecial = prices[prices.length - 2]!
      product.priceSpecialUnit = prices[prices.length - 1]!
      product.price = product.priceUnit
    }

    // Codigo opcional dentro do nome (EAN com 8-14 digitos)
    const code = extractProductCodeFromName(name)
    if (code) product.productCode = code

    products.push(product)
  }

  return products
}

// ============================================================================
// Parser de TABELA (CSV / TSV / texto extraido de XLSX/PDF com separadores)
// ============================================================================

type FieldMapping =
  | 'name' | 'brand' | 'productCode' | 'weight' | 'flavor'
  | 'packageLabel' | 'packQuantity' | 'limit'
  | 'pricePack' | 'priceUnit' | 'priceSpecial' | 'priceSpecialUnit'
  | 'specialCondition'

const HEADER_ALIASES: { match: RegExp; field: FieldMapping }[] = [
  // Nome
  { match: /^(produto|descric[aã]o|descri[cç][aã]o\s*do\s*produto|nome|item|mercadoria)$/i, field: 'name' },
  // Marca
  { match: /^(marca|fabricante|brand)$/i, field: 'brand' },
  // Codigo
  { match: /^(ean|gtin|c[oó]digo|cod\.?|sku|codigo\s+barras?|barra|c[oó]d\.?\s*ean)$/i, field: 'productCode' },
  // Peso/volume
  { match: /^(peso|gramatura|volume|conte[uú]do|tamanho)$/i, field: 'weight' },
  // Sabor
  { match: /^(sabor(es)?|fragr[aã]ncia[s]?|aroma|tipo|variante|ess[eê]ncia)$/i, field: 'flavor' },
  // Embalagem
  { match: /^(embalagem|tipo\s*emb(alagem)?|emb\.?)$/i, field: 'packageLabel' },
  // Quantidade na embalagem
  { match: /^(quant\.?\s*emb\.?|qtd\.?\s*emb\.?|qtde\.?\s*emb\.?|qt\.?\s*emb\.?|quantidade)$/i, field: 'packQuantity' },
  // Preco caixa avulsa
  { match: /^(pre[cç]o\s*cx\.?\s*avulsa|pre[cç]o\s*caixa\s*avulsa|pre[cç]o\s*cx\.?|pre[cç]o\s*caixa|pre[cç]o\s*pacote|pre[cç]o\s*fardo|prc?\s*cx)$/i, field: 'pricePack' },
  // Preco unidade avulsa
  { match: /^(pre[cç]o\s*und?\.?\s*avulsa|pre[cç]o\s*unidade|pre[cç]o\s*unit[aá]rio|pre[cç]o\s*un\.?|prc?\s*un|pre[cç]o|pre[cç]o\s*venda|valor)$/i, field: 'priceUnit' },
  // Preco especial caixa
  { match: /^(pre[cç]o\s*especial\s*cx\.?|pre[cç]o\s*esp\.?\s*cx|pre[cç]o\s*promo(c|ç)[aã]o\s*cx|promo\s*cx|prc?\s*esp\s*cx)$/i, field: 'priceSpecial' },
  // Preco especial unidade
  { match: /^(pre[cç]o\s*especial\s*und?\.?|pre[cç]o\s*esp\.?\s*un|pre[cç]o\s*promo(c|ç)[aã]o\s*un|promo\s*un|prc?\s*esp\s*un|pre[cç]o\s*promocional|oferta)$/i, field: 'priceSpecialUnit' },
  // Observacao / condicao
  { match: /^(observa[cç][aã]o|observa[cç][oõ]es|obs\.?|condi[cç][aã]o|nota|notas|condition|observation)$/i, field: 'specialCondition' },
  // Limite
  { match: /^(limite|lim\.?|max\.?|m[aá]ximo|restri[cç][aã]o)$/i, field: 'limit' }
]

const detectSeparator = (text: string): string | null => {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0).slice(0, 6)
  if (lines.length < 1) return null

  const candidates = ['\t', ';', '|', ',']
  let best: { sep: string; consistency: number } | null = null
  for (const sep of candidates) {
    const counts = lines.map(l => l.split(sep).length)
    const min = Math.min(...counts)
    const max = Math.max(...counts)
    if (min < 2) continue
    const consistency = min / max
    if (consistency < 0.5) continue
    if (!best || consistency > best.consistency || (consistency === best.consistency && min > 2)) {
      best = { sep, consistency }
    }
  }
  return best?.sep || null
}

const stripQuotes = (s: string): string => {
  const trimmed = s.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

const splitRow = (line: string, sep: string): string[] => {
  // Split simples; respeita aspas duplas para campos com separador interno.
  const out: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (ch === sep && !inQuotes) {
      out.push(current)
      current = ''
      continue
    }
    current += ch
  }
  out.push(current)
  return out.map(stripQuotes)
}

const matchHeaderToField = (header: string): FieldMapping | null => {
  const cleaned = header.trim().replace(/^["']|["']$/g, '').trim()
  if (!cleaned) return null
  for (const { match, field } of HEADER_ALIASES) {
    if (match.test(cleaned)) return field
  }
  return null
}

export const parseProductsFromTable = (raw: string): ParsedProduct[] => {
  const text = String(raw || '').trim()
  if (!text) return []

  const sep = detectSeparator(text)
  if (!sep) return []

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  const headerCells = splitRow(lines[0]!, sep)
  const fieldMap: (FieldMapping | null)[] = headerCells.map(matchHeaderToField)
  const hasName = fieldMap.includes('name')
  if (!hasName) return []

  const products: ParsedProduct[] = []
  const defaultRule = extractDefaultSpecialRuleFromSource(text)

  for (let i = 1; i < lines.length; i++) {
    const cells = splitRow(lines[i]!, sep)
    if (cells.length === 1 && !cells[0]?.trim()) continue

    const product = emptyProduct()
    let nameRaw = ''

    for (let c = 0; c < headerCells.length; c++) {
      const field = fieldMap[c]
      if (!field) continue
      const value = (cells[c] || '').trim()
      if (!value) continue

      switch (field) {
        case 'name':
          nameRaw = value
          break
        case 'brand':
          product.brand = value
          break
        case 'productCode':
          product.productCode = normalizeProductCode(value)
          break
        case 'weight':
          product.weight = value
          break
        case 'flavor':
          product.flavor = value
          break
        case 'packageLabel':
          product.packageLabel = normalizePackageUnit(value)
          break
        case 'packQuantity': {
          const n = parseNumber(value)
          if (n !== null) product.packQuantity = Math.max(1, Math.round(n))
          break
        }
        case 'pricePack':
          product.pricePack = normalizePrice(value)
          break
        case 'priceUnit':
          product.priceUnit = normalizePrice(value)
          break
        case 'priceSpecial':
          product.priceSpecial = normalizePrice(value)
          break
        case 'priceSpecialUnit':
          product.priceSpecialUnit = normalizePrice(value)
          break
        case 'specialCondition':
          product.specialCondition = value
          break
        case 'limit': {
          const { limit } = extractLimitFromText(value)
          product.limit = limit || value
          break
        }
      }
    }

    if (!nameRaw) continue

    // Limite tambem pode estar embutido no nome.
    const fromName = extractLimitFromText(nameRaw)
    if (fromName.limit && !product.limit) product.limit = fromName.limit
    product.name = (fromName.rest || nameRaw).trim()
    if (!product.name) continue

    // Codigo opcional embutido no nome (EAN 8-14 digitos)
    if (!product.productCode) {
      const codeFromName = extractProductCodeFromName(product.name)
      if (codeFromName) product.productCode = codeFromName
    }

    // Preco principal (legacy)
    if (!product.price) {
      product.price = product.priceUnit || product.pricePack || null
    }

    // Aplicar regra default de specialCondition se nao informada na linha
    const hasSpecialPrice = !!(product.priceSpecial || product.priceSpecialUnit)
    if (hasSpecialPrice && !product.specialCondition && defaultRule) {
      const productUnit =
        normalizePackageUnit(product.packageLabel) ||
        normalizePackageUnit(product.packUnit)
      const effectiveUnit = (defaultRule.unitHint && defaultRule.unitHint !== 'EMB')
        ? defaultRule.unitHint
        : (productUnit || 'UN')
      product.specialCondition = `ACIMA DE ${defaultRule.minQty} ${effectiveUnit}`
      if (!product.wholesaleTrigger) product.wholesaleTrigger = defaultRule.minQty
      if (!product.wholesaleTriggerUnit) product.wholesaleTriggerUnit = effectiveUnit
    }

    products.push(product)
  }

  return products
}

// ============================================================================
// Pos-processamento global (mesmo que estava no parse-products.post.ts)
// ============================================================================

export const postProcessProducts = (products: ParsedProduct[]): ParsedProduct[] => {
  for (const prod of products) {
    const isUnitPackaging = normalizePackageUnit(prod.packageLabel) === 'UN'
    const isSingleUnit = (prod.packQuantity === 1 || prod.packQuantity === null) && isUnitPackaging

    if (isSingleUnit) {
      if (prod.priceUnit && !prod.pricePack) prod.pricePack = prod.priceUnit
      if (prod.pricePack && !prod.priceUnit) prod.priceUnit = prod.pricePack
      if (prod.priceSpecial && !prod.priceSpecialUnit) prod.priceSpecialUnit = prod.priceSpecial
      if (prod.priceSpecialUnit && !prod.priceSpecial) prod.priceSpecial = prod.priceSpecialUnit
      if (prod.packQuantity === null) prod.packQuantity = 1
    }

    if (prod.priceSpecial && !prod.priceSpecialUnit && prod.packQuantity === 1) {
      prod.priceSpecialUnit = prod.priceSpecial
    }
    if (prod.priceSpecialUnit && !prod.priceSpecial && prod.packQuantity === 1) {
      prod.priceSpecial = prod.priceSpecialUnit
    }

    // FIX: peso interpretado como preco ("CHAMBARI 12,99 kg")
    if (!prod.price && !prod.priceUnit && !prod.pricePack && prod.weight) {
      const weightStr = String(prod.weight).trim()
      const weightPriceMatch = weightStr.match(/^(\d{1,4}[.,]\d{2})\s*(?:KG|UN[D.]?|LT|ML|PCT|G|GR)$/i)
      if (weightPriceMatch) {
        const extractedPrice = normalizePrice(weightPriceMatch[1])
        if (extractedPrice) {
          prod.price = extractedPrice
          prod.priceUnit = extractedPrice
          prod.weight = null
        }
      }
    }

    if (!prod.price) {
      prod.price = prod.priceUnit || prod.pricePack || null
    }
  }

  return products
}

// ============================================================================
// Detector + dispatcher
// ============================================================================

export const parseProductsAuto = (raw: string): ParsedProduct[] => {
  const text = String(raw || '').trim()
  if (!text) return []

  // Tabela detectavel?
  if (detectSeparator(text)) {
    const tableProducts = parseProductsFromTable(text)
    if (tableProducts.length > 0) return postProcessProducts(tableProducts)
  }

  // Cai pra texto livre
  return postProcessProducts(parseProductsFromFreeText(text))
}
