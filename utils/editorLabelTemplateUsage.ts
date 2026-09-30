/** Read references from the visual tree, not the embedded library snapshot. */
export const collectUsedLabelTemplateIds = (json: any): string[] => {
  const ids = new Set<string>()
  const seen = new WeakSet<object>()
  const visit = (node: any) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return
    seen.add(node)
    for (const value of [node.__cardLabelTemplateId, node._zoneTemplateSnapshotId, node._zoneGlobalStyles?.splashTemplateId]) {
      if (typeof value === 'string' && value.trim()) ids.add(value.trim())
    }
    const children = typeof node.getObjects === 'function' ? node.getObjects() : node.objects
    if (Array.isArray(children)) children.forEach(visit)
    if (node.clipPath) visit(node.clipPath)
  }
  visit(json)
  return [...ids]
}

/** A scoped response may invalidate requested IDs, never the other pages' labels. */
export const mergeScopedLabelTemplates = <T extends { id: string }>(existing: T[], requestedIds: string[], incoming: T[]): T[] => {
  const requested = new Set(requestedIds)
  const byId = new Map(existing.filter(t => !requested.has(String(t.id))).map(t => [String(t.id), t]))
  incoming.forEach(t => byId.set(String(t.id), t))
  return [...byId.values()]
}

/** Keep scoped queries below the endpoint cap and ordinary URL length limits. */
export const loadLabelTemplateCatalogChunks = async (
  ids: string[] | null,
  fetchChunk: (ids: string[] | null) => Promise<any>
): Promise<any> => {
  if (!ids) return fetchChunk(null)
  const chunks: string[][] = []
  let chunk: string[] = []
  let length = 0
  for (const id of ids) {
    const bytes = encodeURIComponent(id).length + 3
    if (chunk.length && (chunk.length >= 120 || length + bytes > 4000)) {
      chunks.push(chunk); chunk = []; length = 0
    }
    chunk.push(id); length += bytes
  }
  if (chunk.length) chunks.push(chunk)
  const templates: any[] = []
  for (const batch of chunks) {
    const response = await fetchChunk(batch)
    if (response?.success === false || response?.missingTable) return response
    if (response?.complete === false) throw new Error('Resposta de etiquetas incompleta; snapshots preservados.')
    templates.push(...(Array.isArray(response?.templates) ? response.templates : []))
  }
  return { success: true, complete: true, templates }
}
