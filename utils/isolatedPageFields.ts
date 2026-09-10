/** Atualiza somente campos identificados, sem compartilhar objetos entre páginas. */
export const updateIsolatedPageFields = (
  source: any,
  update: (object: any) => Record<string, any> | null
): any | null => {
  if (!source || !Array.isArray(source.objects)) return null
  const copy = JSON.parse(JSON.stringify(source))
  let changed = false
  const walk = (object: any) => {
    const patch = update(object)
    if (patch) for (const [key, value] of Object.entries(patch)) {
      if (JSON.stringify(object[key]) === JSON.stringify(value)) continue
      object[key] = value
      changed = true
    }
    for (const child of object.objects || []) walk(child)
  }
  copy.objects.forEach(walk)
  return changed ? copy : null
}
