/**
 * Helpers para agendar trabalho em momentos ociosos (requestIdleCallback)
 * com fallback gracioso para setTimeout em browsers/ambientes sem suporte.
 *
 * Sem dependencia de canvas/refs/state. SSR-safe: em ambiente sem
 * window (e.g. Node test), executa o work imediatamente.
 *
 * Cobertura: tests/utils/idleSchedule.test.ts
 */

/**
 * Agenda `work` para rodar quando o browser estiver ocioso. Estrategia
 * em 3 niveis:
 *
 *  1. SSR (typeof window === 'undefined'): executa imediatamente
 *  2. requestIdleCallback disponivel: agenda com timeout maximo
 *  3. fallback: setTimeout com delay = min(1200ms, timeoutMs)
 *
 * O fallback de 1200ms e' um compromisso — nao queremos esperar 2200ms
 * num browser sem rIC porque o work geralmente e' "salvar progresso"
 * e o usuario pode fechar a aba antes.
 *
 * Pure: nao acessa canvas/refs/closures externos.
 */
export const scheduleIdleWork = (
    work: () => void,
    timeoutMs: number = 2200
): void => {
    if (typeof window === 'undefined') {
        work()
        return
    }

    const ric = (window as any).requestIdleCallback
    if (typeof ric === 'function') {
        ric(() => work(), { timeout: timeoutMs })
        return
    }

    window.setTimeout(work, Math.min(1200, timeoutMs))
}
