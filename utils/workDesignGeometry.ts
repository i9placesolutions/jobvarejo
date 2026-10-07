import type { WorkDecoration, WorkLayout, WorkProductDesign } from '../shared/work-design'

export function workDecorationObject(decoration: WorkDecoration): Record<string, any> {
  const { box, kind } = decoration
  const fill = decoration.gradient ? {
    type: 'linear', gradientUnits: 'pixels',
    coords: { x1: 0, y1: 0, x2: decoration.gradient.direction === 'horizontal' ? box.width : 0,
      y2: decoration.gradient.direction === 'vertical' ? box.height : 0 },
    colorStops: decoration.gradient.colors.map((color, i, colors) => ({ offset: i / (colors.length - 1), color }))
  } : decoration.color
  return { left: box.x, top: box.y, width: box.width, height: box.height,
    originX: 'left', originY: 'top', strokeWidth: decoration.strokeWidth || 0,
    stroke: decoration.stroke, opacity: decoration.opacity ?? 1, fill,
    ...(kind === 'ellipse' ? { type: 'Ellipse', rx: box.width / 2, ry: box.height / 2 }
      : kind === 'polygon' ? { type: 'Polygon', points: decoration.points?.map(p => ({ x: p.x * box.width, y: p.y * box.height })) }
        : { type: 'Rect', rx: decoration.radius, ry: decoration.radius }) }
}

/** Compatibilidade para clientes antigos. Novos consumidores fornecem design por produto. */
export function defaultWorkProductDesign(page: WorkLayout['pages'][number], slotIndex: number): WorkProductDesign {
  const slot = page.slots[slotIndex]!, { width: w, height: h } = slot.box
  const shortSides = page.slots.map(s => Math.min(s.box.width, s.box.height)).sort((a, b) => a - b)
  const median = shortSides[Math.floor(shortSides.length / 2)]!
  const scale = page.format === 'print' ? 2480 / 1080 : 1
  const priceHeight = Math.min(110 * scale, median * .24,
    ...page.slots.map(s => s.box.height * (s.box.width / s.box.height > 1.8 ? .4 : .28)))
  const priceWidth = Math.min(priceHeight * 3.2,
    ...page.slots.map(s => s.box.width * (s.box.width / s.box.height > 1.8 ? .4 : .84)))
  const fontSize = Math.max(16, Math.min(52 * scale, median * .11))
  const style = { fontFamily: 'Barlow Condensed' as const, fontSize, bold: true, align: 'center' as const, color: page.cardStyle.nameColor }
  const wide = w / h > 1.8
  return {
    surface: { color: page.cardStyle.background, radius: Math.min(24, h * .04) },
    image: wide ? { x: w * .025, y: h * .04, width: w * .49, height: h * .92 }
      : { x: w * .035, y: h * .035, width: w * .93, height: h * .5 },
    name: { box: wide ? { x: w * .56, y: h * .1, width: w * .41, height: h * .24 }
      : { x: w * .035, y: h * .56, width: w * .93, height: h * .15 }, style },
    price: { box: { x: (wide ? w * .765 : w / 2) - priceWidth / 2,
      y: wide ? h * .55 : h - priceHeight - h * .035, width: priceWidth, height: priceHeight },
      style: { ...style, fontSize: Math.max(16, priceHeight * .9), color: page.cardStyle.priceColor },
      background: page.cardStyle.priceBackground, radius: Math.min(20 * scale, priceHeight * .17), decimalScale: .55, currencyScale: .25 },
    decorations: []
  }
}
