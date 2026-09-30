import { PAGE_ENHANCEMENT_CONCURRENCY } from '../shared/pageEnhancementPolicy'

/** Para novos envios ao pausar/falhar, mas aguarda todos os pedidos já enviados. */
export const runPageEnhancementBatch = async <T>(
  items: readonly T[], run: (item: T) => Promise<unknown>, shouldStop: () => boolean = () => false
): Promise<void> => {
  let next = 0, failed = false
  let firstError: unknown
  const worker = async () => {
    while (!failed && !shouldStop() && next < items.length) {
      const item = items[next++]!
      try { await run(item) }
      catch (error) {
        if (!failed) firstError = error
        failed = true
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(PAGE_ENHANCEMENT_CONCURRENCY, items.length) }, worker))
  if (failed) throw firstError
}
