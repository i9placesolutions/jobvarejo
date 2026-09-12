import { extractPurchaseLimit } from '../../utils/productPurchaseLimit'

// Parser deterministico de listas de produtos.
// Substitui a chamada OpenAI no /api/parse-products para os formatos suportados:
// - Texto livre (uma linha por produto, ex: "coca cola 2lt 12,99 limite 12 por cliente")
// - Tabela CSV/TSV (com cabecalho, padrao atacarejo brasileiro)
// - XLSX/PDF (entram aqui ja como texto extraido)

export type ParsedProduct = {
  name: string
  offerFormat?: 'wholesale-pack-v1'
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
  if (v === null || v === undefined) return null
  const raw = String(v).trim()
  if (!raw) return null
  // Se o valor contem palavras que claramente nao sao preco, rejeitar
  // Exemplos: "ACIMA DE 10 CX", "PREÇO IMBATIVEL", "LIMITE 5 UN"
  const cleaned = raw.replace(/^r\$\s*/i, '').trim()
  // Um preco valido e basicamente numerico (opcionalmente com R$, pontos de milhar, virgula decimal)
  // Rejeitar se tem letras que nao sao parte de formatacao monetaria
  const withoutFormatting = cleaned.replace(/[\d.,\s]/g, '')
  if (withoutFormatting.length > 0) return null
  const n = parseNumber(cleaned)
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

/**
 * Limpa apenas separadores que sobraram nas extremidades depois que o preco
 * foi removido. Hifens internos continuam fazendo parte do nome (ex.:
 * "COCA-COLA"), mas "BATATA – 4,99" vira somente "BATATA".
 */
export const cleanProductName = (value: string): string => String(value || '')
  .replace(/^[\s\-‐‑‒–—―:|;,]+/u, '')
  .replace(/[\s\-‐‑‒–—―:|;,]+$/u, '')
  .replace(/\s{2,}/g, ' ')
  .trim()

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

export const extractLimitFromText = extractPurchaseLimit

// ============================================================================
// Parser de TEXTO LIVRE
// Formato esperado por linha:
//   "<NOME COM GRAMATURA> [LIMITE ...] <PRECO>"
//   "<NOME> <PRECO> [LIMITE ...]"
// ============================================================================

// Captura o preco (grupo 1) e opcionalmente consome uma unidade colada
// ("3,29kg", "1,99/kg") para nao poluir o nome depois da remocao.
// (?!\d|[.,]\d) impede casar digitos extras apos a unidade; sem isso,
// "3,299" ou "3,29kg5" viraria "3,29".
const PRICE_TOKEN_REGEX = /(?:r\$\s*)?(\d{1,4}(?:[.,]\d{3})*[,.]\d{2})(?!\d|[.,]\d)(?:\s*\/?\s*(?:kg|g|mg|ml|lt?|un[d.]?|unid(?:ade)?|pct|cx|fd))?/gi

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

  const lines: string[] = []
  for (const line of text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)) {
    const restriction = extractLimitFromText(line)
    if (restriction.limit && !restriction.rest && lines.length) {
      // PDFs/listas podem colocar a restrição em uma segunda linha da descrição.
      lines[lines.length - 1] += ` ${line}`
    } else {
      lines.push(line)
    }
  }
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
      // Peso/volume decimal pertence à descrição: 1,01KG não é R$ 1,01.
      // R$ 11,99 KG e 11,99/KG continuam sendo preços explicitamente indicados.
      const suffix = afterLimit.slice(m.index + m[0].indexOf(m[1]!) + m[1]!.length)
      if (!/^r\$/i.test(m[0]) && /^\s*(?:kg|mg|gr?|ml|lt?|litros?)\b/i.test(suffix)) continue
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
    const name = cleanProductName(cleaned)

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
  // ── ORDEM IMPORTA: padroes mais especificos ANTES dos genericos ──

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
  // Embalagem (aceita "embalagem caixa", "embalagem/caixa", "embalage caixa", etc.)
  { match: /^(embalag(em|e)?(\s*[/]?\s*(caixa|cx))?|tipo\s*emb(alagem)?|emb\.?)$/i, field: 'packageLabel' },
  // Quantidade na embalagem (aceita "quant.", "qtd.", "qtde." sozinhos ou com "emb")
  { match: /^(quant\.?(\s*emb\.?)?|qtd\.?(\s*emb\.?)?|qtde\.?(\s*emb\.?)?|qt\.?\s*emb\.?|quantidade)$/i, field: 'packQuantity' },

  // ── PRECOS ESPECIAIS (devem vir ANTES dos genericos pricePack/priceUnit) ──

  // Preco especial caixa: "preço cx especial", "preço cx acima", "preço esp cx", etc.
  { match: /^pre[cç]o\s*cx\.?\s*(especial|esp\.?|acima|promo)(\s+\S+)*$/i, field: 'priceSpecial' },
  { match: /^pre[cç]o\s*caixa\s*(especial|esp\.?|acima|promo)(\s+\S+)*$/i, field: 'priceSpecial' },
  { match: /^(pre[cç]o\s*esp\.?\s*cx|pre[cç]o\s*promo(c|ç)[aã]o\s*cx|promo\s*cx|prc?\s*esp\s*cx)$/i, field: 'priceSpecial' },
  // Preco especial unidade: "preço un especial", "preço und acima", "preço esp un", etc.
  { match: /^pre[cç]o\s*und?\.?\s*(especial|esp\.?|acima|promo)(\s+\S+)*$/i, field: 'priceSpecialUnit' },
  { match: /^pre[cç]o\s*unidade\s*(especial|esp\.?|acima|promo)(\s+\S+)*$/i, field: 'priceSpecialUnit' },
  { match: /^(pre[cç]o\s*esp\.?\s*un|pre[cç]o\s*promo(c|ç)[aã]o\s*un|promo\s*un|prc?\s*esp\s*un|pre[cç]o\s*promocional|oferta)$/i, field: 'priceSpecialUnit' },
  // Preco especial generico (sem cx/un)
  { match: /^(pre[cç]o\s*especial(\s+\S+)*|condi[cç][aã]o\s*especial)$/i, field: 'priceSpecial' },

  // ── PRECOS REGULARES (genericos, apos os especiais) ──

  // Preco caixa avulsa (aceita palavras extras apos cx/caixa, ex: "preço cx. avé. avls")
  { match: /^(pre[cç]o\s*cx\.?(\s+\S+)*|pre[cç]o\s*caixa(\s+\S+)*|pre[cç]o\s*pacote|pre[cç]o\s*fardo|prc?\s*cx)$/i, field: 'pricePack' },
  // Preco unidade avulsa (aceita palavras extras apos un/und, ex: "preço und. avé. avls")
  { match: /^(pre[cç]o\s*und?\.?(\s+\S+)*|pre[cç]o\s*unidade(\s+\S+)*|pre[cç]o\s*unit[aá]rio(\s+\S+)*|prc?\s*un)$/i, field: 'priceUnit' },
  // Preco generico (fallback - "preço", "preço venda", "valor")
  { match: /^(pre[cç]o|pre[cç]o\s*venda|valor)$/i, field: 'priceUnit' },

  // ── CONDICAO / OBS ──

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
  // Fallback: busca parcial por palavras-chave (ordem: especificos antes de genericos)
  const norm = cleaned.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
  const hasPreco = /\bPRE[CÇ]?O\b/.test(norm)
  const hasCx = /\b(CX|CAIXA|FARDO|FD|PACOTE|PCT|PACK|SIXPACK|POTE)\b/.test(norm)
  const hasUn = /\b(UN[D.]?|UNIDADE|UNITARIO)\b/.test(norm)
  const hasEspecial = /\b(ESPECIAL|ESP\.?|ACIMA|PROMO|ATACADO)\b/.test(norm)
  // Cabecalhos descritivos podem conter EMBALAGEM/PRECO sem serem esses campos.
  if (/\b(CONDICAO|OBSERVACAO|OBS)\b/.test(norm)) return 'specialCondition'
  if (/\bQU?A?NT|\bQTD(?:E)?\b/.test(norm)) return 'packQuantity'
  // Preco + CX/UN + ESPECIAL → campo especial (DEVE vir antes do generico)
  if (hasPreco && hasCx && hasEspecial) return 'priceSpecial'
  if (hasPreco && hasUn && hasEspecial) return 'priceSpecialUnit'
  if (hasPreco && hasEspecial) return 'priceSpecial'
  // Preco + CX/UN sem especial → campo regular
  if (hasPreco && hasCx) return 'pricePack'
  if (hasPreco && hasUn) return 'priceUnit'
  if (/\bEMBAL/i.test(norm)) return 'packageLabel'
  if (/\bQU?A?NT/i.test(norm)) return 'packQuantity'
  // Condicao / observacao
  if (/\b(CONDICAO|OBSERVACAO|OBS)\b/.test(norm)) return 'specialCondition'
  return null
}

// Verifica se uma linha parece ser sub-header (continuacao de cabecalho, sem valores numericos de preco)
const looksLikeSubHeader = (cells: string[]): boolean => {
  const nonEmpty = cells.filter(c => c.trim().length > 0)
  if (nonEmpty.length === 0) return false
  // Se a maioria das celulas tem texto curto e nenhuma parece preco, provavelmente e sub-header
  const hasPrice = nonEmpty.some(c => {
    const n = parseNumber(c)
    return n !== null && n > 0.5
  })
  return !hasPrice
}

// Encontra a linha de cabecalho real (pode nao ser a primeira se tiver titulo ou linhas em branco)
// Tambem faz merge de sub-headers (cabecalhos em 2 linhas, comum em planilhas atacarejo)
const findHeaderRow = (lines: string[], sep: string): { headerIdx: number; dataStartIdx: number; headerCells: string[]; fieldMap: (FieldMapping | null)[] } | null => {
  const maxProbe = Math.min(8, lines.length - 1)

  for (let idx = 0; idx < maxProbe; idx++) {
    const cells = splitRow(lines[idx]!, sep)
    let fm = cells.map(matchHeaderToField)
    if (!fm.includes('name')) continue

    const mergedCells = [...cells]
    let dataStart = idx + 1

    // Tenta mergear com a proxima linha se parecer sub-header
    if (dataStart < lines.length) {
      const nextCells = splitRow(lines[dataStart]!, sep)
      if (looksLikeSubHeader(nextCells)) {
        for (let c = 0; c < mergedCells.length; c++) {
          const sub = (nextCells[c] || '').trim()
          if (sub) {
            mergedCells[c] = (mergedCells[c]!.trim() + ' ' + sub).trim()
          }
        }
        dataStart++
        fm = mergedCells.map(matchHeaderToField)
      }
    }

    const hasPriceField = fm.some(f => f === 'pricePack' || f === 'priceUnit' || f === 'priceSpecial' || f === 'priceSpecialUnit')
    const mappedCount = fm.filter(f => f !== null).length
    if (hasPriceField || mappedCount >= 2) {
      return { headerIdx: idx, dataStartIdx: dataStart, headerCells: mergedCells, fieldMap: fm }
    }
  }

  // Fallback: aceita qualquer linha com 'name' mesmo sem campo de preco
  for (let idx = 0; idx < maxProbe; idx++) {
    const cells = splitRow(lines[idx]!, sep)
    const fm = cells.map(matchHeaderToField)
    if (fm.includes('name')) {
      return { headerIdx: idx, dataStartIdx: idx + 1, headerCells: cells, fieldMap: fm }
    }
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

  const headerResult = findHeaderRow(lines, sep)
  if (!headerResult) return []

  const { headerIdx, dataStartIdx, headerCells, fieldMap } = headerResult

  // Deduplicacao: se 2 colunas mapeiam pro mesmo campo, a segunda vira versao especial
  for (let c = 0; c < fieldMap.length; c++) {
    const f = fieldMap[c]
    if (!f) continue
    const firstIdx = fieldMap.indexOf(f)
    if (firstIdx < c) {
      if (f === 'pricePack') fieldMap[c] = 'priceSpecial'
      else if (f === 'priceUnit') fieldMap[c] = 'priceSpecialUnit'
    }
  }

  // Uma coluna sem mapeamento pode ser posição na lâmina, código ou categoria.
  // Só inferimos condição a partir do conteúdo comercial, nunca pelo simples fato
  // de ser a última coluna desconhecida (posição "1" não é condição de atacado).
  if (!fieldMap.includes('specialCondition')) {
    for (let c = fieldMap.length - 1; c >= 0; c--) {
      if (fieldMap[c] !== null && fieldMap[c] !== 'priceSpecial') continue
      const samples = lines.slice(dataStartIdx, dataStartIdx + 20)
        .map(line => (splitRow(line, sep)[c] || '').trim()).filter(Boolean)
      if (samples.length && samples.every(value => /^(?:ACIMA\b|A PARTIR\b|QUALQUER QUANTIDADE\b|M[IÍ]NIMO\b)/i.test(value))) {
        fieldMap[c] = 'specialCondition'
        break
      }
    }
  }

  if (process.dev) {
    console.log('[parse-table] separator:', JSON.stringify(sep))
    console.log('[parse-table] header row idx:', headerIdx, '| data start:', dataStartIdx)
    console.log('[parse-table] headers:', headerCells)
    console.log('[parse-table] field map:', fieldMap)
  }

  const products: ParsedProduct[] = []
  const isWholesalePackTable = fieldMap.includes('packageLabel') && fieldMap.includes('packQuantity')
    && fieldMap.includes('pricePack') && fieldMap.includes('priceUnit')
    && fieldMap.includes('priceSpecial') && fieldMap.includes('priceSpecialUnit')
  const defaultRule = extractDefaultSpecialRuleFromSource(text)

  for (let i = dataStartIdx; i < lines.length; i++) {
    const cells = splitRow(lines[i]!, sep)
    if (cells.length === 1 && !cells[0]?.trim()) continue

    if (cells.map(matchHeaderToField).includes('name')) continue
    const product = emptyProduct()
    if (isWholesalePackTable) product.offerFormat = 'wholesale-pack-v1'
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
        case 'priceSpecial': {
          // Coluna "preço especial" pode conter um valor numerico OU texto de condicao
          const priceAttempt = normalizePrice(value)
          if (priceAttempt) {
            product.priceSpecial = priceAttempt
          } else if (!product.specialCondition) {
            // Valor nao numerico = condicao especial (ex: "PREÇO IMBATIVEL", "ACIMA DE 20 FD")
            product.specialCondition = value
          }
          break
        }
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
    product.name = cleanProductName(fromName.rest || nameRaw)
    if (!product.name) continue

    // Codigo opcional embutido no nome (EAN 8-14 digitos)
    if (!product.productCode) {
      const codeFromName = extractProductCodeFromName(product.name)
      if (codeFromName) product.productCode = codeFromName
    }

    // A quantidade da embalagem e o gatilho da oferta são campos distintos.
    if (product.packQuantity !== null) product.packUnit = 'UN'
    const trigger = product.specialCondition?.match(/^(?:ACIMA\s+DE|A\s+PARTIR\s+DE|M[IÍ]NIMO(?:\s+DE)?)\s+(\d+)\s+(.+)$/i)
    if (trigger) {
      product.wholesaleTrigger = Number(trigger[1])
      product.wholesaleTriggerUnit = normalizePackageUnit(trigger[2])
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
    prod.name = cleanProductName(prod.name)
    if (!prod.name) continue

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
