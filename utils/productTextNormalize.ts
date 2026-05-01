/**
 * Normalizadores puros de texto de produto (limite, observacao,
 * acentuacao). Usados em pipelines de importacao e renderizacao da
 * etiqueta para garantir formato consistente.
 *
 * Cobertura: tests/utils/productTextNormalize.test.ts
 */

/**
 * Remove diacriticos/acentos de uma string preservando o restante.
 * "Café com Açúcar" → "Cafe com Acucar".
 */
export const stripAccents = (s: string): string =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/**
 * Normaliza texto para busca: lowercase + remove acentos + trim.
 * Util para filtros "search-as-you-type" (query e valores normalizados
 * antes de `.includes()`).
 */
export const normalizeImageSearch = (value: string): string =>
    stripAccents(String(value || '').toLowerCase()).trim()

/**
 * Normaliza um texto livre de "limite por cliente" para a forma
 * canonica usada na etiqueta:
 *  - vazio/null → null
 *  - "LIMITE" sozinho (sem quantidade) → null
 *  - "limite 3UN" → "LIMITE 3 UN"
 *  - "3UN" → "LIMITE 3 UN"
 *  - "3" → "LIMITE 3"
 *
 * Insere espaco entre digito e UN/KG (regra: "3UN" → "3 UN") para
 * leitura consistente.
 */
export const normalizeLimitText = (raw: any): string | null => {
    const s0 = String(raw ?? '').trim()
    if (!s0) return null
    let s = s0.toUpperCase().replace(/\s+/g, ' ').trim()
    if (s === 'LIMITE') return null
    if (!s.startsWith('LIMITE')) s = `LIMITE ${s}`.trim()
    s = s.replace(/(\d)(UN|KG)\b/g, '$1 $2')
    return s
}

/**
 * Normaliza condicao especial / observacao do produto:
 *  - vazio/null → null
 *  - colapsa whitespace
 *  - remove pontuacao/whitespace das pontas (- : ; , .)
 *  - retorna null se restar string vazia
 */
export const normalizeSpecialCondition = (raw: any): string | null => {
    const txt = String(raw ?? '').replace(/\s+/g, ' ').trim()
    if (!txt) return null
    const cleaned = txt.replace(/^[\-:;,.\s]+/, '').replace(/[\-:;,.\s]+$/, '').trim()
    return cleaned || null
}

/**
 * Normaliza texto livre para uso como hint de busca de imagem:
 *  - String() coerce
 *  - colapsa whitespace
 *  - trim
 *
 * Diferente de normalizeImageSearch: preserva case e acentos. Usado
 * como "forma exibivel" do hint (vai para a UI).
 */
export const normalizeImageSearchText = (value: any): string =>
    String(value || '')
        .replace(/\s+/g, ' ')
        .trim()

/**
 * Normaliza texto para chave de comparacao de hints (deduplicacao):
 *  - chama normalizeImageSearchText
 *  - lowercase + strip accents
 *  - remove caracteres nao-alfanumericos
 *  - colapsa whitespace
 *
 * Apenas para comparacao (Set keys), nunca para exibicao.
 */
export const normalizeImageSearchKey = (value: any): string =>
    normalizeImageSearchText(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

/**
 * Remove tokens duplicados (case/accent-insensitive) de uma string,
 * preservando a ordem original e a forma exibivel do primeiro
 * encontro de cada chave.
 *
 * Ex: "Banana banana BANANA Maca" → "Banana Maca"
 */
export const dedupeImageSearchTokens = (value: any): string => {
    const tokens = normalizeImageSearchText(value).split(' ').filter(Boolean)
    const seen = new Set<string>()
    const out: string[] = []
    for (const token of tokens) {
        const key = normalizeImageSearchKey(token)
        if (!key) continue
        if (seen.has(key)) continue
        seen.add(key)
        out.push(token)
    }
    return out.join(' ').trim()
}

/**
 * Extrai o sufixo "LIMITE ..." do nome do produto, retornando o nome
 * limpo separadamente. Util quando a fonte (planilha/lista colada)
 * concatena nome + limite em um campo unico:
 *
 *   "Coca Lata 350ml LIMITE 6UN" → { cleanedName: "Coca Lata 350ml",
 *                                     extractedLimit: "LIMITE 6UN" }
 *
 *  - Busca case-insensitive por `\bLIMITE\b` (limite com word boundary)
 *  - Remove pontuacao terminal (- – — | :) do nome limpo
 *  - Se nome ficar vazio apos limpeza, retorna o nome original
 *  - Sem LIMITE no nome: retorna {cleanedName: nome, extractedLimit: null}
 */
export const extractLimitFromName = (rawName: any): {
    cleanedName: string
    extractedLimit: string | null
} => {
    const name = String(rawName ?? '').trim()
    if (!name) return { cleanedName: '', extractedLimit: null }

    const idx = name.toUpperCase().search(/\bLIMITE\b/)
    if (idx === -1) return { cleanedName: name, extractedLimit: null }

    const extractedLimit = name.slice(idx).trim()
    const cleanedName = name
        .slice(0, idx)
        .replace(/[-–—|:]+$/g, '')
        .trim()
    return { cleanedName: cleanedName || name, extractedLimit: extractedLimit || null }
}

/**
 * Recebe varias variantes de string (ex: nome, sinonimos) e devolve
 * apenas as unicas (em forma exibivel) apos dedupeImageSearchTokens
 * + dedup global por chave normalizada.
 */
export const uniqueImageSearchHints = (variants: ReadonlyArray<string>): string[] => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const entry of variants) {
        const compact = dedupeImageSearchTokens(entry)
        if (!compact) continue
        const key = normalizeImageSearchKey(compact)
        if (!key || seen.has(key)) continue
        seen.add(key)
        out.push(compact)
    }
    return out
}
