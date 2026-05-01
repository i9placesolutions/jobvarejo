/**
 * Formatadores puros de data/tempo em pt-BR para exibicao em UI
 * (historico, autosave, atividade do projeto).
 *
 * Cobertura: tests/utils/dateTimeFormat.test.ts
 */

/**
 * Formata uma data ISO (ou qualquer string aceita por `new Date()`)
 * em pt-BR completo: "DD/MM/YYYY HH:MM:SS".
 * Retorna o valor original se nao for parseavel.
 */
export const formatHistoryDateTime = (value: string): string => {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })
}

/**
 * Formata uma data como tempo relativo em pt-BR:
 *  - < 60s    → "agora mesmo"
 *  - < 60min  → "N min atras"
 *  - < 24h    → "Nh atras"
 *  - 1 dia    → "ontem"
 *  - < 30 dias → "N dias atras"
 *  - 1 mes    → "1 mes atras"
 *  - 30+ dias → "N meses atras"
 *
 * Retorna '' se data invalida.
 */
export const formatHistoryRelative = (value: string): string => {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    const now = Date.now()
    const diffMs = now - d.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 60) return 'agora mesmo'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin} min atras`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h atras`
    const diffD = Math.floor(diffH / 24)
    if (diffD === 1) return 'ontem'
    if (diffD < 30) return `${diffD} dias atras`
    const diffM = Math.floor(diffD / 30)
    if (diffM === 1) return '1 mes atras'
    return `${diffM} meses atras`
}
