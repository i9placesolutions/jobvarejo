/**
 * Helpers puros para historico de versoes de pagina.
 *
 * Cobertura: tests/utils/pageHistoryHelpers.test.ts
 */

/**
 * Item do historico de versoes de pagina. Combina entradas vindas
 * de tres fontes:
 *  - 'version': bucket de versoes do storage (pre-save)
 *  - 'history': snapshots periodicos do save flow
 *  - 'current': estado em memoria (versao atual nao salva)
 */
export type PageHistoryItem = {
    source: 'version' | 'history' | 'current'
    key: string
    versionId?: string | null
    lastModified: string
    size?: number | null
    objectCount?: number | null
}

/**
 * Constroi chave estavel para identificar um item de historico.
 * Combina source + key + versionId (vazio quando ausente). Usado
 * como key no v-for da UI e como id de comparacao para ver se
 * dois items sao "o mesmo".
 */
export const getHistoryRestoreKey = (item: PageHistoryItem): string =>
    `${item.source}:${item.key}:${item.versionId || ''}`

/**
 * Decide se o item de historico no indice `idx` deve receber a badge
 * "Mais recente". Regras:
 *  - apenas o primeiro item da lista (idx === 0) e candidato
 *  - exclui itens com source='current' (que ja' mostram badge "Versao atual")
 *
 * Recebe a lista como parametro (vez de ler de ref reativo) para que
 * a funcao continue pura e testavel.
 */
export const historyItemIsLatest = (idx: number, items: PageHistoryItem[]): boolean => {
    if (idx !== 0) return false
    const item = items[0]
    return !!item && item.source !== 'current'
}
