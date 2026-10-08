/**
 * Troca o selo 3D do cabeçalho por uma arte nova, ocupando toda a altura livre.
 *
 * Os selos "largos" (ex.: 572×211 no feed) deixavam espaço vazio em cima e embaixo. O selo novo fica na
 * mesma coluna do antigo e vai do topo da página até logo acima do primeiro elemento abaixo dele
 * (validade ou logo), centralizado e sem distorcer.
 */
const num = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d
export const bounds = o => {
  const w = num(o?.width) * Math.abs(num(o?.scaleX, 1)), h = num(o?.height) * Math.abs(num(o?.scaleY, 1))
  const left = num(o?.left) - (o?.originX === 'center' ? w / 2 : o?.originX === 'right' ? w : 0)
  const top = num(o?.top) - (o?.originY === 'center' ? h / 2 : o?.originY === 'bottom' ? h : 0)
  return { left, top, width: w, height: h, right: left + w, bottom: top + h }
}
const visible = o => o && o.visible !== false && num(o.opacity, 1) > 0
const isSeal = o => /^image$/i.test(String(o?.type)) && /^Selo 3D /.test(String(o?.name || ''))
// Elementos que limitam o selo por baixo: validade e logo (o painel do Instagram fica ao lado, na outra coluna).
const OBSTACLES = /^(standard-validity-background|retail-validity-visual-band|header-validity|header-logo-slot)$/
const SIDE = /^(header-logo-slot|header-instagram-panel)$/

/**
 * @param {any} source canvas do Fabric
 * @param {{ src: string, width: number, height: number, pageWidth: number }} seal arte nova (pixels) e largura da página
 */
export function replaceSeal(source, seal) {
  const old = (source?.objects || []).find(isSeal)
  if (!visible(old)) return { canvas: source, changes: [], skipped: 'sem selo 3D visível' }
  if (old.__originalSrc === seal.src || old.src === seal.src) return { canvas: source, changes: [], skipped: 'selo já trocado' }
  const box = bounds(old), u = num(seal.pageWidth, 1080) / 1080, margin = 8 * u, gap = 12 * u
  const center = box.top + box.height / 2, middle = box.left + box.width / 2
  const limits = source.objects.filter(o => visible(o) && OBSTACLES.test(String(o.name || ''))).map(bounds)
    .filter(b => b.top > center && b.left < box.right && b.right > box.left).map(b => b.top)
  if (!limits.length) return { canvas: source, changes: [], skipped: 'sem limite abaixo do selo' }
  const bottom = Math.min(...limits) - margin
  // Selo grande: a coluna vai até perto da logo/painel do Instagram à direita (nunca menor que a do selo antigo).
  const right = Math.min(...source.objects.filter(o => visible(o) && SIDE.test(String(o.name || ''))).map(bounds)
    .filter(b => b.left > middle && b.top < bottom && b.bottom > margin).map(b => b.left - gap), Infinity)
  const area = { left: box.left, width: Math.max(box.width, Number.isFinite(right) ? right - box.left : box.width), top: margin, height: bottom - margin }
  const scale = Math.min(area.width / seal.width, area.height / seal.height)

  const canvas = structuredClone(source)
  const target = canvas.objects.find(isSeal)
  Object.assign(target, {
    src: seal.src, __originalSrc: seal.src, width: seal.width, height: seal.height, cropX: 0, cropY: 0,
    originX: 'left', originY: 'top', scaleX: scale, scaleY: scale, angle: 0,
    left: area.left + (area.width - seal.width * scale) / 2, top: area.top + (area.height - seal.height * scale) / 2
  })
  delete target.clipPath
  return { canvas, changes: [`selo trocado: ${Math.round(box.width)}×${Math.round(box.height)} → ${Math.round(seal.width * scale)}×${Math.round(seal.height * scale)}`] }
}
