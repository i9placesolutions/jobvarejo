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
