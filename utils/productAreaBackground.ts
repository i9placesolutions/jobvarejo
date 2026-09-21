/** Migra somente o painel branco legado; nunca altera fundos dos cards ou da arte. */
export const normalizeProductAreaBackgrounds = (canvas: any): number => {
  let changed = 0
  const visit = (objects: any[]) => {
    for (const object of objects) {
      if (!object || typeof object !== 'object') continue
      if (object.name === 'product-area-background' && !object.isFrame &&
          !object.isProductZone && !object.isGridZone &&
          ['rect', 'path', 'polygon'].includes(String(object.type).toLowerCase()) &&
          object.productAreaBackgroundMode == null) {
        const fill = String(object.fill || '').toLowerCase().replace(/\s/g, '')
        if (['#fff', '#ffffff', 'white', 'rgb(255,255,255)', 'rgba(255,255,255,1)'].includes(fill)) {
          Object.assign(object, { fill: 'transparent', stroke: 'transparent', shadow: null,
            productAreaBackgroundMode: 'transparent' })
          changed++
        }
      }
      if (Array.isArray(object.objects)) visit(object.objects)
    }
  }
  if (Array.isArray(canvas?.objects)) visit(canvas.objects)
  return changed
}
