/** Compacta somente faixas/espaços vazios dos modelos. Mantém assets originais em slices Fabric. */
import { randomUUID } from 'node:crypto';
import { bounds } from './validity-gap-lib.mjs';
export { bounds };
const visible = o => o.visible !== false && Number(o.opacity ?? 1) > 0;
const image = o => String(o.type).toLowerCase() === 'image';
const background = o => image(o) && !o.businessProfileField && !o.quickLogoSlot && !/seal|selo|logo|icon|produto|product-image/i.test(o.name || '');
const factor = o => o === 'center' ? .5 : o === 'bottom' ? 1 : 0;
export function setVertical(o, top, bottom) { const h = bottom - top; o.top = top + h * factor(o.originY); if (String(o.type).toLowerCase() === 'rect' || o.isProductZone) {
    o.height = h / (o.scaleY || 1);
}
else {
    o.scaleY = h / o.height;
} }
export function resizeZone(o, top, bottom) { setVertical(o, top, bottom); o._zoneWidth = bounds(o).width; o._zoneHeight = bottom - top; const inner = o.objects[0]; Object.assign(inner, { originX: 'center', originY: 'center', left: 0, top: 0, width: o.width, height: o.height, scaleX: 1, scaleY: 1 }); const z = o._zoneStateSnapshot?.zone; if (z) {
    z.geometry = { ...z.geometry, x: o.left, y: o.top, left: o.left, top: o.top, width: o.width, height: o.height, scaleX: o.scaleX || 1, scaleY: o.scaleY || 1, angle: o.angle || 0 };
    if ('_zoneWidth' in z)
        z._zoneWidth = o._zoneWidth;
    if ('_zoneHeight' in z)
        z._zoneHeight = o._zoneHeight;
} }
export function piecewise(points) { return y => { if (y <= points[0][0])
    return y + points[0][1] - points[0][0]; for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1], [x2, y2] = points[i];
    if (y <= x2)
        return y1 + (y - x1) * (y2 - y1) / (x2 - x1);
} return y + points.at(-1)[1] - points.at(-1)[0]; }; }
function sliceImage(o, points, map) { const b = bounds(o); const cuts = [b.top, ...points.map(p => p[0]).filter(y => y > b.top + .01 && y < b.bottom - .01), b.bottom]; const result = []; for (let i = 0; i < cuts.length - 1; i++) {
    const y = cuts[i], end = cuts[i + 1], n = structuredClone(o);
    Object.assign(n, { _customId: i === 0 ? o._customId : randomUUID(), name: i === 0 ? o.name : `${o.name || 'background'}-compact-slice-${i}`, originX: 'left', originY: 'top', left: b.left, top: Math.round(map(y)), width: o.width, height: (end - y) / (o.scaleY || 1), cropY: (o.cropY || 0) + (y - b.top) / (o.scaleY || 1), scaleY: (Math.round(map(end)) - Math.round(map(y))) / ((end - y) / (o.scaleY || 1)) });
    result.push(n);
} return result; }
export function compactProductSpace(source, page) {
    const c = structuredClone(source), os = c.objects || [], zones = os.filter(o => o.isProductZone);
    const skip = reason => ({ canvas: source, changes: [], reason });
    if (zones.length !== 1)
        return skip('múltiplas zonas: avaliar envelope completo');
    if (os.some(o => /-compact-slice-/.test(o.name || '')))
        return skip('composição já compactada');
    const z = zones[0], zb = bounds(z), frame = os.find(o => o.isFrame);
    if (!frame)
        return skip('sem frame');
    const W = page.width, H = page.height, u = W / 1080, tv = W / H > 1.5;
    if (z._zoneStateSnapshot?.cards?.length || os.some(o => o.isProductCard || o.parentZoneId))
        return skip('zona preenchida');
    if (z.objects?.length !== 1 || String(z.objects[0].type).toLowerCase() !== 'rect')
        return skip('zona complexa');
    const footer = os.find(o => o.name === 'footer-premium-background'), area = os.find(o => o.name === 'standard-validity-background');
    if (!area)
        return skip('sem faixa conhecida');
    const ab = bounds(area);
    const campaign = os.some(o => o.name === 'campaign-background');
    if (tv)
        return skip('horizontal: validade inferior ocupa o intervalo');
    if (!footer)
        return skip('sem rodapé identificado');
    const fb = bounds(footer);
    if (fb.top <= zb.bottom)
        return skip('rodapé não fica abaixo da zona');
    const valid = os.filter(o => /validity/.test(o.name || '') && visible(o) && (!('text' in o) || o.text?.trim()) && bounds(o).top > H * .1 && bounds(o).bottom < zb.top + 2);
    let top = Math.min(ab.top, ...valid.map(o => bounds(o).top)), end = Math.max(ab.bottom, ...valid.map(o => bounds(o).bottom));
    if (campaign) {
        const h = ab.height / .49;
        top = ab.top - h * .04;
        end = top + h;
    }
    const oldHeight = end - top, targetHeight = campaign ? Math.min(oldHeight, 76 * u) : oldHeight > 100 * u && ab.width > W * .6 ? 80 * u : oldHeight;
    const reduction = oldHeight - targetHeight;
    const bodyBottom = page.productInterior ? Math.min(zb.bottom, page.productInterior.bottom - 8 * u) : zb.bottom;
    const gapBottom = fb.top - bodyBottom, targetBottom = gapBottom > 32 * u ? fb.top - 24 * u : bodyBottom;
    if (reduction < 3 * u && targetBottom - bodyBottom < 3 * u)
        return skip('espaços dentro do limite');
    const zoneTop = campaign ? Math.max(zb.top, end + 22 * u, (page.productInterior?.top || 0) + 8 * u) : zb.top;
    if (!(top > 0 && end < zoneTop && zb.bottom < fb.top))
        return skip('faixa fora da sequência vertical');
    const blockers = os.filter(o => visible(o) && o !== frame && o !== z && o !== footer && !background(o) && !/validity|product-area|product-section|footer/.test(o.name || '') && !o.businessProfileField && bounds(o).top >= top && bounds(o).bottom < fb.top);
    if (blockers.length)
        return skip('elementos no espaço: ' + blockers.map(x => x.name).join(','));
    const points = [[0, 0], [top, top], [end, end - reduction], [zoneTop, zoneTop - reduction], [bodyBottom, targetBottom], [fb.top, fb.top], [H, H]], map = piecewise(points);
    const affected = [];
    c.objects = os.flatMap(o => { if (o === frame)
        return [o]; const b = bounds(o); if (background(o) && b.bottom > top && b.top < fb.top) {
        if (o.angle || o.skewX || o.skewY || o.clipPath)
            return [o];
        affected.push(o.name);
        return sliceImage(o, points, map);
    } if (o === z) {
        resizeZone(o, map(zoneTop), map(bodyBottom));
        return [o];
    } if (/validity|product-area|product-section/.test(o.name || '') && b.top >= top - 1 && b.bottom <= fb.top + 1) {
        if (/calendar/.test(o.name || '')) {
            const k = Math.min(1, targetHeight / oldHeight), cx = b.left + b.width / 2, cy = (map(b.top) + map(b.bottom)) / 2;
            Object.assign(o, { originX: 'center', originY: 'center', left: cx, top: cy, scaleX: (o.scaleX || 1) * k, scaleY: (o.scaleY || 1) * k });
        }
        else
            setVertical(o, map(b.top), map(b.bottom));
    } return [o]; });
    if (campaign) {
        const guide = c.objects.find(o => o.name === 'standard-validity-background');
        setVertical(guide, top + 3 * u, top + 3 * u + targetHeight * .62);
        const stock = c.objects.find(o => o.name === 'reference-validity-stock-band');
        if (stock)
            setVertical(stock, top + targetHeight * .69, top + targetHeight * .97);
        const icon = c.objects.find(o => o.name === 'header-validity-calendar');
        if (icon) {
            const ib = bounds(icon);
            icon.top += top + 3 * u + targetHeight * .31 - (ib.top + ib.height / 2);
        }
    }
    return { canvas: c, changes: [`validade ${oldHeight.toFixed(1)}→${targetHeight.toFixed(1)}px`, `zona ${zb.height.toFixed(1)}→${bounds(z).height.toFixed(1)}px`, `vão inferior ${gapBottom.toFixed(1)}→${(fb.top - bounds(z).bottom).toFixed(1)}px`], metrics: { validityBefore: oldHeight, validityAfter: targetHeight, zoneBefore: zb, zoneAfter: bounds(z), footer: fb, points, affected } };
}
