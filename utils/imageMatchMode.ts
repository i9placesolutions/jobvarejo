/**
 * Helpers puros para o modo de match de imagens em
 * paste-list/file-import. "precise" usa LLM (lento, preciso),
 * "fast" usa heuristica simples (rapido, menos preciso).
 *
 * Cobertura: tests/utils/imageMatchMode.test.ts
 */

export type ImageMatchMode = 'precise' | 'fast'

/**
 * Modo default quando o usuario nao seleciona explicitamente. Precise
 * e' a escolha conservadora — vale o tempo extra para garantir match
 * de qualidade comercial.
 */
export const DEFAULT_PASTE_IMAGE_MATCH_MODE: ImageMatchMode = 'precise'

/**
 * Normaliza um valor para um ImageMatchMode valido. Apenas 'fast'
 * (case-insensitive) e' aceito como override; qualquer outro valor
 * cai em 'precise' (default conservador).
 *
 * Pure: sem efeito colateral.
 */
export const resolveImageMatchMode = (value?: string): ImageMatchMode => {
    return String(value || 'precise').toLowerCase() === 'fast' ? 'fast' : 'precise'
}
