/** Collect only paint properties, including groups and gradient stops. */
export const collectProjectColors = (roots: unknown[]): string[] => {
  const colors = new Set<string>()
  const visited = new WeakSet<object>()
  const paint = (value: any) => {
    if (typeof value === 'string' && value.trim() && !['transparent', 'none'].includes(value.toLowerCase())) colors.add(value.trim())
    else if (value && typeof value === 'object') for (const stop of Object.values(value.colorStops || {})) paint((stop as any)?.color)
  }
  const walk = (node: any) => {
    if (!node || typeof node !== 'object' || visited.has(node)) return
    visited.add(node)
    if (Array.isArray(node)) { node.forEach(walk); return }
    for (const key of ['fill', 'stroke', 'backgroundColor', 'background', 'color']) paint(node[key])
    walk(node.getObjects?.() || node.objects)
    walk(node.styles)
    // Fabric per-character text styles are keyed by line and character.
    if (!node.type) for (const value of Object.values(node)) if (value && typeof value === 'object') walk(value)
  }
  roots.forEach(walk)
  return [...colors]
}
