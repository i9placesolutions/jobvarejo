/**
 * Helpers puros para concorrencia de operacoes assincronas.
 *
 * Sem dependencia de canvas/Fabric/Vue. Cobertura:
 * tests/utils/asyncHelpers.test.ts
 */

/**
 * Executa um worker async para cada item de uma lista, com concorrencia
 * limitada (no maximo N tasks em paralelo).
 *
 * Padrao classico de "p-limit":
 *  - Cria `min(concurrency, items.length)` workers
 *  - Cada worker pega o proximo item via cursor compartilhado e processa
 *  - Retorna quando todos os items foram processados
 *
 * Util para fetches de imagem em paralelo (concorrencia 4-6) sem
 * estourar conexoes do browser.
 *
 * Erros do worker sao propagados — caller deve usar try/catch interno
 * se quiser tolerancia a falha. Concorrencia <= 0 vira 1.
 */
export const mapLimit = async <T>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<void>
): Promise<void> => {
    const limit = Math.max(1, Math.floor(concurrency || 1))
    let cursor = 0
    const runWorker = async () => {
        while (true) {
            const index = cursor++
            if (index >= items.length) return
            await worker(items[index] as T, index)
        }
    }
    const tasks = Array.from({ length: Math.min(limit, items.length) }, () => runWorker())
    await Promise.all(tasks)
}
