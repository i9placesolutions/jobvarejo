/**
 * Helpers de fragmentacao de texto em chunks — usado para enviar
 * blocos de texto grandes (parsing por AI) sem ultrapassar limites
 * de payload.
 *
 * Cobertura: tests/utils/textChunking.test.ts
 */

/**
 * Limite de caracteres por chunk antes de quebrar para outra request.
 * Empirico: ~15k chars cabe confortavelmente em payload AI 8k tokens
 * sem stress de margem.
 */
export const CHUNK_CHAR_LIMIT = 15_000

/**
 * Quebra `text` em chunks de no maximo `limit` caracteres, preservando
 * limites de linha (nao quebra no meio de uma linha). Cada chunk e'
 * trimmed e nunca vazio.
 *
 *  - text com length <= limit: retorna [trimmedText] em chunk unico
 *  - text vazio (apos trim): retorna []
 *  - text muito grande: quebra em chunks por linha, agrupando ate o
 *    limite, e devolve cada chunk concatenado por '\n'
 */
export const splitTextIntoChunks = (text: string, limit = CHUNK_CHAR_LIMIT): string[] => {
    const trimmed = String(text || '').trim()
    if (!trimmed) return []
    if (trimmed.length <= limit) return [trimmed]
    const lines = trimmed.split(/\r?\n/)
    const chunks: string[] = []
    let current = ''
    for (const line of lines) {
        if (current.length + line.length + 1 > limit && current.length > 0) {
            chunks.push(current)
            current = line
        } else {
            current = current ? current + '\n' + line : line
        }
    }
    if (current) chunks.push(current)
    return chunks
}
