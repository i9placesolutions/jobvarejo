/**
 * Helpers puros de persistencia de texto de titulo de card produto.
 * Lidam com Fabric.Textbox que faz wrap automatico — o `text` raw nao
 * tem `\n`, mas a renderizacao quebra em linhas. Para preservar essa
 * quebra ao serializar, lemos `textLines` ja calculado pelo Fabric.
 *
 * Sem dependencia de canvas/refs/state. Operam sobre o textObj
 * duck-typed.
 *
 * Cobertura: tests/utils/cardTitlePersistence.test.ts
 */

/**
 * Le as linhas renderizadas de um Textbox Fabric. Diferente de
 * `text.split('\n')`: o Textbox aplica word-wrap automatico que nao
 * altera o `text` raw, mas popula `textLines` (publica) ou
 * `_textLines` (interna) com as linhas finais.
 *
 *  - Force initDimensions se disponivel (recalcula `textLines` se
 *    fontSize/width mudou).
 *  - textLines pode ser `string[]` ou `string[][]` (uma linha por
 *    char) — flatten ambos.
 *  - Remove `\r` (legacy CRLF).
 *  - Filtra linhas vazias EXCETO a ultima (preserva trailing newline
 *    intencional do usuario).
 *
 * Retorna [] para non-textbox.
 */
export const getRenderedTextboxLinesForPersistence = (textObj: any): string[] => {
    if (!textObj || String(textObj?.type || '').toLowerCase() !== 'textbox') return []
    if (typeof textObj.initDimensions === 'function') textObj.initDimensions()

    const rawLines = Array.isArray((textObj as any).textLines)
        ? (textObj as any).textLines
        : (Array.isArray((textObj as any)._textLines) ? (textObj as any)._textLines : [])

    return rawLines
        .map((line: any) => Array.isArray(line) ? line.join('') : String(line ?? ''))
        .map((line: string) => line.replace(/\r/g, ''))
        .filter((line: string, idx: number, arr: string[]) =>
            line.length > 0 || arr.length === 1 || idx < arr.length - 1
        )
}

/**
 * Constroi o texto a ser persistido em `_productData.title`. Se o
 * texto raw ja contem `\n` (usuario digitou enter), preserva como
 * esta. Senao, le as linhas renderizadas: se for >1 (textbox quebrou
 * por word-wrap), junta com `\n` para preservar a quebra na
 * proxima carga.
 *
 * Pure: nao muta o textObj (apenas le).
 */
export const buildPersistedCardTitleText = (titleObj: any): string => {
    const rawText = String((titleObj as any)?.text ?? '').replace(/\r\n?/g, '\n')
    if (rawText.includes('\n')) return rawText

    const renderedLines = getRenderedTextboxLinesForPersistence(titleObj)
        .filter((line: string) => line.trim().length > 0)
    if (renderedLines.length > 1) {
        return renderedLines.join('\n')
    }
    return rawText
}
