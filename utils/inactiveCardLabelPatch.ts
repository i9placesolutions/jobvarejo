/** Atualiza apenas etiquetas; preserva integralmente a geometria da página salva. */
export function patchInactiveCardLabels(data: any, changes: Map<string, any>): any {
  const result = JSON.parse(JSON.stringify(data))
  const visit = (objects: any[]) => {
    for (const object of objects || []) {
      const replacement = changes.get(String(object?._customId || ''))
      const index = object?.objects?.findIndex((child: any) => child?.name === 'priceGroup') ?? -1
      if (replacement && index >= 0) {
        const previous = object.objects[index]
        const label = JSON.parse(JSON.stringify(replacement.label))
        const width = Number(previous.width) * Math.abs(Number(previous.scaleX ?? 1))
        const height = Number(previous.height) * Math.abs(Number(previous.scaleY ?? 1))
        const fit = Math.min(width / Math.max(1, Number(label.width)), height / Math.max(1, Number(label.height)))
        if (Number.isFinite(fit) && fit > 0) label.scaleX = label.scaleY = fit
        for (const key of ['left', 'top', 'originX', 'originY', 'angle']) label[key] = previous[key]
        object.objects[index] = label
        object.__cardLabelTemplateId = replacement.templateId
        object.__cardLabelTemplateOverride = true
      }
      if (Array.isArray(object?.objects)) visit(object.objects)
    }
  }
  visit(result.objects)
  return result
}
