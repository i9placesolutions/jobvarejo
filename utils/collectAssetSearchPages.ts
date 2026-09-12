/** Percorre todas as páginas, permitindo exibir cada lote assim que chegar. */
export async function collectAssetSearchPages<T>(
  fetchPage: (cursor: string | undefined) => Promise<{ items: T[]; nextCursor: string | null }>,
  onPage?: (items: T[]) => void
): Promise<T[]> {
  const items: T[] = []
  const seen = new Set<string>()
  let cursor: string | undefined
  do {
    const page = await fetchPage(cursor)
    items.push(...page.items)
    onPage?.(page.items)
    if (!page.nextCursor) return items
    if (seen.has(page.nextCursor)) throw new Error('A busca repetiu uma página. Tente novamente.')
    seen.add(page.nextCursor)
    cursor = page.nextCursor
  } while (cursor)
  return items
}
