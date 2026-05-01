/**
 * Helpers puros de classificacao de erros HTTP em fluxos de
 * paste-list / import de produtos. Usados para decidir retry,
 * rate-limit e transient-error vs hard-error.
 *
 * Sem dependencia de canvas/refs/state. Operam sobre o objeto error
 * vindo de fetch / $fetch / SDK.
 *
 * Cobertura: tests/utils/pasteListErrorHelpers.test.ts
 */

/**
 * Extrai o status code HTTP de um error object, aceitando varias
 * formas (Nuxt $fetch, fetch nativo, SDK custom). Retorna 0 quando
 * nao ha status valido (ex: erro de rede sem resposta).
 */
export const getPasteHttpStatus = (err: any): number => {
    const status = Number(
        err?.statusCode ??
        err?.status ??
        err?.response?.status ??
        err?.data?.statusCode
    )
    return Number.isFinite(status) ? status : 0
}

/**
 * Le o header "Retry-After" do response do erro e retorna o tempo
 * de espera em milissegundos. Aceita Headers DOM ou objeto plain.
 *
 * Comportamento:
 *  - sem header / valor invalido / <= 0 → 0 (nao agendar retry)
 *  - clamp em [500ms, ...] (mesmo "Retry-After: 0.1" vira 500ms)
 *
 * Importante: o header e em SEGUNDOS (RFC 7231), funcao retorna ms.
 */
export const getPasteRetryAfterMs = (err: any): number => {
    const headers = err?.response?.headers
    let raw: any = undefined
    try {
        if (headers && typeof headers.get === 'function') {
            raw = headers.get('Retry-After') ?? headers.get('retry-after')
        } else if (headers && typeof headers === 'object') {
            raw = (headers as any)['retry-after'] ?? (headers as any)['Retry-After']
        }
    } catch {
        raw = undefined
    }
    const seconds = Number(String(raw ?? '').trim())
    if (!Number.isFinite(seconds) || seconds <= 0) return 0
    return Math.max(500, Math.round(seconds * 1000))
}

/**
 * Detecta um erro 429 (rate limit) — caller deve agendar retry com
 * getPasteRetryAfterMs.
 */
export const isPasteRateLimitError = (err: any): boolean =>
    getPasteHttpStatus(err) === 429

/**
 * Detecta um erro transiente que merece retry automatico:
 *  - 502/503/504 (gateway/upstream issues)
 *  - status 0 mas mensagem contem padroes de erro de rede
 *    ("failed to fetch", "networkerror", "load failed", etc)
 *
 * 4xx (exceto 429) e 5xx que nao sao 502/503/504 sao tratados como
 * hard-errors (nao retryar).
 */
export const isTransientPasteError = (err: any): boolean => {
    const status = getPasteHttpStatus(err)
    if (status === 0) {
        const msg = String(
            err?.message ||
            err?.statusMessage ||
            err?.data?.message ||
            err?.cause?.message ||
            ''
        ).toLowerCase()
        return (
            msg.includes('failed to fetch') ||
            msg.includes('network changed') ||
            msg.includes('networkerror') ||
            msg.includes('<no response>') ||
            msg.includes('load failed')
        )
    }
    return status === 502 || status === 503 || status === 504
}

/**
 * Detecta um erro transiente em chamadas para o endpoint de parse-products
 * (similar a isTransientPasteError mas com regras mais permissivas):
 *  - 408 Request Timeout, 502, 503, 504
 *  - mensagem com "timeout", "network", "failed to fetch", "load failed"
 *    em qualquer status
 *
 * Mais permissivo que isTransientPasteError porque o parse-products tem
 * latencia variavel maior (LLM calls) e merece mais retry attempts.
 */
export const isTransientParseError = (err: any): boolean => {
    const status = getPasteHttpStatus(err)
    if (status === 408 || status === 502 || status === 503 || status === 504) return true
    const msg = String(err?.message || err?.statusMessage || '').toLowerCase()
    return msg.includes('timeout')
        || msg.includes('network')
        || msg.includes('failed to fetch')
        || msg.includes('load failed')
}
