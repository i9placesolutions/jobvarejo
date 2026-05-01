import { describe, it, expect } from 'vitest'
import {
  stripAccents,
  normalizeLimitText,
  normalizeSpecialCondition,
  normalizeImageSearch,
  normalizeImageSearchText,
  normalizeImageSearchKey,
  dedupeImageSearchTokens,
  uniqueImageSearchHints
} from '~/utils/productTextNormalize'

describe('stripAccents', () => {
  it('remove acentos preservando o restante', () => {
    expect(stripAccents('Café')).toBe('Cafe')
    expect(stripAccents('Açúcar')).toBe('Acucar')
    expect(stripAccents('Atenção: pão')).toBe('Atencao: pao')
  })

  it('preserva strings ja sem acentos', () => {
    expect(stripAccents('hello world')).toBe('hello world')
    expect(stripAccents('123 abc')).toBe('123 abc')
  })

  it('vazio retorna vazio', () => {
    expect(stripAccents('')).toBe('')
  })
})

describe('normalizeLimitText', () => {
  it('vazio/null retorna null', () => {
    expect(normalizeLimitText('')).toBeNull()
    expect(normalizeLimitText(null)).toBeNull()
    expect(normalizeLimitText(undefined)).toBeNull()
    expect(normalizeLimitText('   ')).toBeNull()
  })

  it('"LIMITE" sozinho (sem quantidade) retorna null', () => {
    expect(normalizeLimitText('LIMITE')).toBeNull()
    expect(normalizeLimitText('limite')).toBeNull()
  })

  it('numero sem prefixo: adiciona LIMITE', () => {
    expect(normalizeLimitText('3')).toBe('LIMITE 3')
    expect(normalizeLimitText('5UN')).toBe('LIMITE 5 UN')
  })

  it('com prefixo "limite": preserva e formata', () => {
    expect(normalizeLimitText('limite 3UN')).toBe('LIMITE 3 UN')
    expect(normalizeLimitText('limite 2 KG')).toBe('LIMITE 2 KG')
  })

  it('separa digito de UN/KG', () => {
    expect(normalizeLimitText('3UN')).toBe('LIMITE 3 UN')
    expect(normalizeLimitText('LIMITE 10KG')).toBe('LIMITE 10 KG')
  })

  it('colapsa whitespace multiplo', () => {
    expect(normalizeLimitText('LIMITE    3   UN')).toBe('LIMITE 3 UN')
  })
})

describe('normalizeSpecialCondition', () => {
  it('vazio/null retorna null', () => {
    expect(normalizeSpecialCondition(null)).toBeNull()
    expect(normalizeSpecialCondition('')).toBeNull()
    expect(normalizeSpecialCondition('   ')).toBeNull()
  })

  it('colapsa whitespace', () => {
    expect(normalizeSpecialCondition('texto    com   espacos')).toBe('texto com espacos')
  })

  it('remove pontuacao/whitespace das pontas', () => {
    expect(normalizeSpecialCondition('- texto -')).toBe('texto')
    expect(normalizeSpecialCondition(': texto :')).toBe('texto')
    expect(normalizeSpecialCondition(',,,texto,,,')).toBe('texto')
    expect(normalizeSpecialCondition('  ;-;texto;-;  ')).toBe('texto')
  })

  it('strip de pontuacao tornando vazio retorna null', () => {
    expect(normalizeSpecialCondition('---')).toBeNull()
    expect(normalizeSpecialCondition(',.;:- ')).toBeNull()
  })

  it('preserva pontuacao no meio', () => {
    expect(normalizeSpecialCondition('na compra de 3, leve 4'))
      .toBe('na compra de 3, leve 4')
  })
})

describe('normalizeImageSearch', () => {
  it('lowercase + remove acentos + trim', () => {
    expect(normalizeImageSearch('  CAFÉ Açúcar  ')).toBe('cafe acucar')
  })

  it('null/undefined/vazio → ""', () => {
    expect(normalizeImageSearch(null as any)).toBe('')
    expect(normalizeImageSearch(undefined as any)).toBe('')
    expect(normalizeImageSearch('')).toBe('')
  })

  it('preserva pontuacao no meio', () => {
    expect(normalizeImageSearch('Coca-Cola 2L')).toBe('coca-cola 2l')
  })

  it('roundtrip: query e valor normalizados batem para .includes()', () => {
    const value = normalizeImageSearch('Pão de Açúcar 500G')
    const query = normalizeImageSearch('  ACUCAR  ')
    expect(value.includes(query)).toBe(true)
  })
})


describe("normalizeImageSearchText", () => {
  it("colapsa whitespace e trim, preserva case/acentos", () => {
    expect(normalizeImageSearchText("  Pão   de   Açúcar  ")).toBe("Pão de Açúcar")
  })

  it("null/undefined → string vazia", () => {
    expect(normalizeImageSearchText(null)).toBe("")
    expect(normalizeImageSearchText(undefined)).toBe("")
  })

  it("numbers/objetos sao stringified", () => {
    expect(normalizeImageSearchText(123)).toBe("123")
  })
})

describe("normalizeImageSearchKey", () => {
  it("lowercase + strip accents + remove non-alfanum", () => {
    expect(normalizeImageSearchKey("Pão de Açúcar 500G")).toBe("pao de acucar 500g")
  })

  it("colapsa whitespace e remove pontuacao", () => {
    expect(normalizeImageSearchKey("Banana, Maçã!")).toBe("banana maca")
  })

  it("null/empty → string vazia", () => {
    expect(normalizeImageSearchKey(null)).toBe("")
    expect(normalizeImageSearchKey("")).toBe("")
  })

  it("apenas pontuacao → string vazia", () => {
    expect(normalizeImageSearchKey("!@#$%")).toBe("")
  })
})

describe("dedupeImageSearchTokens", () => {
  it("remove duplicatas case/accent-insensitive preservando primeiro encontro", () => {
    expect(dedupeImageSearchTokens("Banana banana BANANA Maca")).toBe("Banana Maca")
  })

  it("preserva ordem original", () => {
    expect(dedupeImageSearchTokens("Maca Banana maca")).toBe("Maca Banana")
  })

  it("string vazia/null → string vazia", () => {
    expect(dedupeImageSearchTokens("")).toBe("")
    expect(dedupeImageSearchTokens(null)).toBe("")
  })

  it("variantes acentuadas dedupam", () => {
    expect(dedupeImageSearchTokens("Maçã maca MACÃ")).toBe("Maçã")
  })
})

describe("uniqueImageSearchHints", () => {
  it("remove variantes duplicadas (case/accent)", () => {
    expect(uniqueImageSearchHints(["Banana", "BANANA", "Maca"])).toEqual(["Banana", "Maca"])
  })

  it("aplica dedupe interno em cada variante", () => {
    expect(uniqueImageSearchHints(["Banana banana", "Maca"])).toEqual(["Banana", "Maca"])
  })

  it("ignora vazias/null", () => {
    expect(uniqueImageSearchHints(["", "Banana", "  ", "banana"])).toEqual(["Banana"])
  })

  it("array vazio → array vazio", () => {
    expect(uniqueImageSearchHints([])).toEqual([])
  })
})
