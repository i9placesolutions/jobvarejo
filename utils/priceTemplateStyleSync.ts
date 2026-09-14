import { applyRichPriceTextValue } from './priceRichText'

/** Reaplica a aparência do modelo sem substituir dados comerciais ou seleção. */
export const syncPriceTemplateStyle = (group: any, template: any, revivePaint: (paint: any) => any = value => value) => {
  if (!group || !template) return
  const sources = new Map<string, any>()
  const index = (node: any) => {
    if (node.name) sources.set(node.name, node)
    for (const child of node.objects || []) index(child)
  }
  index(template)
  const keys = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textAlign', 'charSpacing', 'lineHeight', 'underline', 'strokeWidth', 'rx', 'ry', '__priceRichIntegerStyle', '__priceRichDecimalStyle', '__priceRichIntegerScale', '__priceRichDecimalScale']
  const visit = (node: any) => {
    const source = sources.get(node.name)
    if (source && node !== group) {
      const patch: Record<string, any> = {}
      for (const key of keys) if (source[key] !== undefined) patch[key] = JSON.parse(JSON.stringify(source[key]))
      for (const key of ['fill', 'stroke']) if (source[key] !== undefined) {
        const paint = revivePaint(source[key])
        if (paint !== undefined) patch[key] = paint
      }
      // Sempre parte da escala autorada; o encaixe posterior não se acumula.
      patch.__visibleScaleX = source.scaleX ?? 1
      patch.__visibleScaleY = source.scaleY ?? 1
      if (node.visible !== false) {
        patch.scaleX = source.scaleX ?? 1
        patch.scaleY = source.scaleY ?? 1
      }
      if (source.width !== undefined) patch.width = source.width
      // A referência lateral tem colunas fixas; mantém apenas a posição externa
      // do grupo e deixa o reflow calcular as linhas verticais de cada produto.
      if (template.__referenceStyleVersion === 2 && source.left !== undefined) patch.left = source.left
      node.set?.(patch)
      Object.assign(node, patch)
      if (node.__priceRichText) applyRichPriceTextValue(node, node.text)
      else node.initDimensions?.()
      node.dirty = true
      node.setCoords?.()
    }
    for (const child of node.getObjects?.() || []) visit(child)
  }
  visit(group)
  group.dirty = true
}
