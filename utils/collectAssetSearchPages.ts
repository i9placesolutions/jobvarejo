/** Busca todas as páginas antes de aplicar os filtros de identidade do produto. */
export async function collectAssetSearchPages<T>(
  fetchPage: (cursor: string | undefined) => Promise<{ items: T[]; nextCursor: string | null }>
): Promise<T[]> {
  const items: T[] = []
  const seen = new Set<string>()
  let cursor: string | undefined
  do {
    const page = await fetchPage(cursor)
    items.push(...page.items)
    if (!page.nextCursor) return items
    if (seen.has(page.nextCursor)) throw new Error('A busca repetiu uma página. Tente novamente.')
    seen.add(page.nextCursor)
    cursor = page.nextCursor
  } while (cursor)
  return items
}
