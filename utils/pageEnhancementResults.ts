export interface SavedEnhancementResult {
  id: string
  pageId: string
  status: string
  resultUrl?: string
  createdAt: string
}

/** Um resultado salvo por página, na ordem do projeto, independente do filtro de geração. */
export function latestReadyEnhancements<T extends SavedEnhancementResult>(pages: Array<{ id: string }>, receipts: T[]): T[] {
  return pages.flatMap(page => {
    const latest = receipts.filter(receipt => receipt.pageId === page.id && receipt.status === 'completed' && receipt.resultUrl)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    return latest ? [latest] : []
  })
}
