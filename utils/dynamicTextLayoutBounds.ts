import { layoutHeaderOfferValidity } from './headerOfferValidity'
import { isSplitFooterValidity } from './splitFooterValidity'
import { getDynamicBusinessField } from './dynamicBusinessFields'

const bounds = (o: any) => o.getBoundingRect()
const move = (o: any, x: number, y: number) => { o.set({ left: o.left + x, top: o.top + y }); o.setCoords?.(); o.dirty = true }
const bottom = (b: any) => b.top + b.height
const right = (b: any) => b.left + b.width

/** Repair confirmed page clipping without changing fonts, scales or product geometry. */
export const repairDynamicTextLayoutBounds = (objects: any[], createValidityBackdrop?: (props: Record<string, any>, index: number) => any): { changed: boolean; unresolved: string[] } => {
  let changed = false
  const unresolved: string[] = []
  for (const frame of objects.filter(o => o.isFrame && o.visible !== false && typeof o.getBoundingRect === 'function')) {
    const fb = bounds(frame), children = objects.filter(o => o.parentFrameId === frame._customId && o.visible !== false && !o.isFrame)
    const fields = children.filter(o => ['address', 'instagram', 'whatsapp', 'validity'].includes(getDynamicBusinessField(o)) && typeof o.getBoundingRect === 'function')
    // Reuse the whole validity band after replacing its sample with a real date.
    for (const o of fields.filter(o => getDynamicBusinessField(o) === 'validity' && String(o.type).toLowerCase() === 'textbox' && !o.angle && !isSplitFooterValidity(o))) {
      const headerLayout = layoutHeaderOfferValidity(o, children)
      if (headerLayout !== null) { changed = headerLayout || changed; continue }
      let band = children.find(b => b.name === 'validity-backdrop')
      const icon = children.find(b => b.quickDynamicIconFor === 'validity')
      if (!band && createValidityBackdrop) {
        const tb = bounds(o), ib = icon ? bounds(icon) : tb
        const left = Math.max(fb.left + 4, Math.min(tb.left, ib.left) - 12)
        const top = Math.min(tb.top, ib.top) - 10
        band = createValidityBackdrop({
          name: 'validity-backdrop', parentFrameId: frame._customId,
          left, top, width: Math.min(right(fb) - 4, Math.max(right(tb), right(ib)) + 12) - left,
          height: Math.max(bottom(tb), bottom(ib)) - top + 10,
          originX: 'left', originY: 'top', fill: '#ffffff', rx: 12, ry: 12,
          strokeWidth: 0, selectable: false, evented: false
        }, Math.min(objects.indexOf(o), icon ? objects.indexOf(icon) : objects.indexOf(o)))
        if (band) { children.push(band); changed = true }
      }
      if (!band) continue
      if (!icon) {
        o.set({ backgroundColor: '', fill: '#14223d' })
        continue
      }
      if (typeof band.set === 'function') {
        const height = (bounds(o).height + 16) / Math.abs(band.scaleY || 1)
        if (band.fill !== '#ffffff' || band.opacity !== 1 || Math.abs(Number(band.height) - height) > .5) changed = true
        band.set({ fill: '#ffffff', opacity: 1, height, rx: 10, ry: 10, dirty: true })
        band.setCoords?.()
        move(band, 0, bounds(o).top - 8 - bounds(band).top)
      }
      const bb = bounds(band), ib = bounds(icon)
      const inset = 8, gap = 10, available = bb.width - inset * 2 - ib.width - gap
      if (available < 40) continue
      const before = JSON.stringify([o.left,o.top,o.width,icon.left,icon.top])
      const oldTop = bounds(o).top
      o.set({width:available / Math.abs(o.scaleX || 1)})
      o.initDimensions?.(); o.setCoords?.()
      // Measure the new line, then center the icon and text as one block.
      const lineWidth = typeof o.getLineWidth === 'function' && o.textLines?.length === 1
        ? Math.min(available, o.getLineWidth(0) * Math.abs(o.scaleX || 1) + 2) : available
      o.set({width:lineWidth / Math.abs(o.scaleX || 1),textAlign:'center'})
      o.initDimensions?.(); o.setCoords?.()
      const blockLeft = bb.left + (bb.width - lineWidth - ib.width - gap) / 2
      move(o,blockLeft + ib.width + gap - bounds(o).left,oldTop - bounds(o).top)
      move(icon,blockLeft - ib.left,oldTop + (bounds(o).height - ib.height)/2 - ib.top)
      if (before !== JSON.stringify([o.left,o.top,o.width,icon.left,icon.top])) changed = true
    }
    // Keep the left edge beside its icon; trim only excess textbox width at the right edge.
    for (const o of fields) {
      const b = bounds(o)
      const excess = right(b) - (right(fb) - 4)
      if (String(o.type).toLowerCase() === 'textbox' && excess > .5 && b.left >= fb.left + 4 && !o.angle && b.width - excess > 40) {
        const left = b.left, top = b.top
        o.set({ width: Math.max(1, o.width - excess / Math.abs(o.scaleX || 1)) })
        o.initDimensions?.(); o.setCoords?.()
        move(o, left - bounds(o).left, top - bounds(o).top)
        changed = true
      }
    }
    const contacts = fields.filter(o => getDynamicBusinessField(o) !== 'validity' && bounds(o).top > fb.top + fb.height * .7)
    const clipped = contacts.some(o => bottom(bounds(o)) > bottom(fb) - 4)
    if (clipped) {
      // Work only on the visible footer layer: old files can contain duplicate labels hidden behind its background.
      const background = children.filter(o => String(o.type).toLowerCase() === 'rect' && !o.isProductZone && bounds(o).width >= fb.width * .8 && bounds(o).height < fb.height * .25 && bottom(bounds(o)) >= bottom(fb) - 8).at(-1)
      const foreground = background ? children.filter(o => objects.indexOf(o) > objects.indexOf(background)) : []
      const titles = foreground.filter(o => /^(SIGA|WHATSAPP|ENDERE[ÇC]O)/i.test(String(o.text || '')) && !getDynamicBusinessField(o) && bounds(o).top > fb.top + fb.height * .7)
      const height = Math.max(...contacts.map(o => bounds(o).height)), titleHeight = Math.max(0, ...titles.map(o => bounds(o).height))
      const rowTop = bottom(fb) - 4 - height, titleTop = rowTop - 3 - titleHeight, footerTop = titleTop - 1
      const zones = children.filter(o => o.isProductZone)
      const zoneBottom = Math.max(fb.top, ...zones.map(o => bottom(bounds(o))))
      if (background && titles.length && footerTop >= zoneBottom + 2) {
        for (const o of contacts) move(o, 0, rowTop - bounds(o).top)
        for (const o of titles) move(o, 0, titleTop - bounds(o).top)
        for (const o of foreground.filter(o => ['image','path','group'].includes(String(o.type).toLowerCase()) && !o.isProductZone && !o.businessProfileField && bounds(o).top > fb.top + fb.height * .8 && bounds(o).width < fb.width * .12 && bounds(o).height < fb.height * .08)) move(o, 0, rowTop - bounds(o).top)
        background.set({height:(bottom(fb)-footerTop)/Math.abs(background.scaleY || 1)})
        background.setCoords?.()
        move(background, 0, footerTop - bounds(background).top)
        for (const o of foreground.filter(o => String(o.type).toLowerCase() === 'line' && bounds(o).top > fb.top + fb.height * .7)) {
          o.set({height:(bottom(fb)-4-titleTop)/Math.abs(o.scaleY || 1)})
          o.setCoords?.(); move(o, 0, titleTop-bounds(o).top)
        }
        changed = true
      } else if ((!background || !titles.length) && rowTop >= zoneBottom + 2) {
        // Older themes have a baked-in footer rather than a native background.
        for (const o of contacts) if (bottom(bounds(o)) > bottom(fb)-4) move(o,0,rowTop-bounds(o).top)
        changed = true
      } else unresolved.push(`${frame._customId}: rodapé sem altura livre para preservar a tipografia`)
    }
    for (const o of fields) {
      const b = bounds(o)
      // Horizontal overflow can be corrected by translation without changing line breaks.
      if (b.width <= fb.width - 8) {
        const dx = Math.max(fb.left+4-b.left, Math.min(0,right(fb)-4-right(b)))
        if (Math.abs(dx) > .5) { move(o,dx,0); changed=true }
      } else unresolved.push(`${o._customId}: texto mais largo que a página`)
      if (bottom(bounds(o)) > bottom(fb)+.5 || bounds(o).top < fb.top-.5) unresolved.push(`${o._customId}: texto fora da altura da página`)
    }
  }
  return { changed, unresolved }
}
