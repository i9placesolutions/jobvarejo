/** O limite acompanha a altura final do nome, inclusive após quebra de linha. */
export const positionProductLimitBelowName = (card: any, width: number, height: number) => {
  const children = card?.getObjects?.() || []
  const title = children.find((node: any) => node.name === 'smart_title')
  const limit = children.find((node: any) => ['smart_limit', 'limitText', 'product_limit'].includes(node.name) || node.data?.smartType === 'product-limit')
  if (!limit || !title || title.visible === false) return
  if (!String(limit.text || '').trim()) {
    limit.set?.({ visible: false })
    return
  }
  if (limit.visible === false) return
  // Faixa opaca acompanha o próprio Textbox em clones, exportação e edição.
  // Amarelo + marrom escuro mantém contraste em cards vermelhos ou claros.
  limit.set?.({ backgroundColor: '#facc15', fill: '#451a03', textBackgroundColor: '', stroke: null, strokeWidth: 0 })
  for (const line of Object.values(limit.styles || {})) {
    for (const style of Object.values(line as any)) {
      if (style && typeof style === 'object') {
        delete (style as any).fill
        delete (style as any).textBackgroundColor
      }
    }
  }
  title.initDimensions?.()
  limit.initDimensions?.()
  const titleHeight = Math.abs(Number(title.height || 0) * Number(title.scaleY ?? 1))
  const titleTop = Number(title.top || 0) - titleHeight * (title.originY === 'center' ? 0.5 : title.originY === 'bottom' ? 1 : 0)
  const titleWidth = Math.abs(Number(title.width || width * 0.9) * Number(title.scaleX ?? 1))
  const titleCenter = Number(title.left || 0) + titleWidth * (title.originX === 'left' ? 0.5 : title.originX === 'right' ? -0.5 : 0)
  limit.set?.({ originX: 'center', originY: 'top', left: titleCenter, top: titleTop + titleHeight + Math.max(1, height * 0.012) })
  limit.dirty = true
  limit.setCoords?.()
  card.dirty = true
}
