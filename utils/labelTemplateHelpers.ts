/**
 * Helpers puros para conciliacao/merge de label templates.
 *
 * Funcoes que decidem qual versao de um template usar quando ha
 * conflitos entre store local, banco de dados e snapshot do projeto.
 *
 * Cobertura: tests/utils/labelTemplateHelpers.test.ts
 */

/**
 * Extrai timestamp do template (preferindo updatedAt > createdAt) como
 * numero. Retorna NaN se ambos estiverem ausentes/invalidos — caller
 * deve tratar com `Number.isFinite()`.
 */
export const getLabelTemplateTimestamp = (tpl: any): number => {
    const ts = Date.parse(String(tpl?.updatedAt || tpl?.createdAt || ''))
    return Number.isFinite(ts) ? ts : Number.NaN
}

/**
 * Decide se devemos usar o snapshot "incoming" sobre o "prev" durante
 * hidratacao/merge de templates.
 *
 * Politica:
 *  1. `__localOverride` sempre vence sobre nao-local (proteje edicoes
 *     manuais do usuario que ainda nao subiram para o DB)
 *  2. Mesmo nivel de override: snapshot mais novo (timestamp maior) vence
 *  3. Se um lado tem timestamp e o outro nao: o que tem timestamp vence
 *  4. Nenhum dos dois com timestamp (legacy): manter o incoming
 */
export const shouldUseIncomingTemplateSnapshot = (prev: any, incoming: any): boolean => {
    const prevTs = getLabelTemplateTimestamp(prev)
    const incomingTs = getLabelTemplateTimestamp(incoming)
    const incomingIsLocalOverride = !!(incoming as any)?.__localOverride
    const prevIsLocalOverride = !!(prev as any)?.__localOverride

    if (incomingIsLocalOverride !== prevIsLocalOverride) {
        return incomingIsLocalOverride
    }

    if (Number.isFinite(incomingTs) && Number.isFinite(prevTs)) {
        return incomingTs >= prevTs
    }
    if (Number.isFinite(incomingTs) && !Number.isFinite(prevTs)) return true
    if (!Number.isFinite(incomingTs) && Number.isFinite(prevTs)) return false

    return true
}
