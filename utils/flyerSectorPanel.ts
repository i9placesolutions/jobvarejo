/**
 * Painel de setores: transforma a área de produtos de um modelo "Setores" em faixas com título
 * e zona própria por setor, a partir do plano do pedido (utils/flyerStructure.ts).
 *
 * O modelo salvo tem UMA zona marcada com `sectorPanel: true` (a área inteira) e objetos-molde
 * ocultos para o título (`sector-title-bar-template`, `sector-title-template`,
 * `sector-title-line-template`). Na geração, a zona é substituída por N zonas e N títulos.
 * Função pura sobre o JSON do Fabric: roda no servidor, no worker e em scripts.
 */
import { arrangeFlyerSectorBands, type FlyerSector, type FlyerStructureFormat } from './flyerStructure'

type FabricJson = { objects: any[]; [key: string]: unknown }

const num = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const box = (o: any) => {
  const width = num(o?.width) * Math.abs(num(o?.scaleX, 1)), height = num(o?.height) * Math.abs(num(o?.scaleY, 1))
  const left = num(o?.left) - (o?.originX === 'center' ? width / 2 : o?.originX === 'right' ? width : 0)
  const top = num(o?.top) - (o?.originY === 'center' ? height / 2 : o?.originY === 'bottom' ? height : 0)
  return { left, top, width, height }
}
const newId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`)

/**
 * Receita da grade para uma quantidade de produtos (persistida no snapshot da zona, que é a fonte
 * do editor). Com `showcase`, os primeiros produtos viram destaque maior no topo (Produto Herói).
 */
export const setZoneGridRecipe = (zone: any, previewFormat: string, count: number, columns: number,
  showcase?: { highlightCount: number; highlightHeight: number }) => {
  const regular = showcase ? count - showcase.highlightCount : count
  const rows = Math.max(1, Math.ceil(regular / Math.max(1, columns)))
  const recipe = { count, format: showcase ? 'showcase' : 'grid', role: showcase ? 'showcase' : 'grid', columns, rows, layoutDirection: 'horizontal', cardAspectRatio: 'fill',
    lastRowBehavior: 'fill', verticalAlign: 'stretch', padding: 8, gapHorizontal: 12, gapVertical: 12, highlightPadding: 8,
    highlightGapHorizontal: 14, highlightGapVertical: 12, highlightCount: showcase?.highlightCount || 0, highlightPos: 'top', highlightSelection: 'first',
    highlightIndexes: showcase ? Array.from({ length: showcase.highlightCount }, (_, i) => i + 1) : [1], highlightHeight: showcase?.highlightHeight || 1.5 }
  for (const target of [zone, zone?._zoneStateSnapshot?.zone?.layout].filter(Boolean)) {
    target.structureByProductCountEnabled = true
    target.structureByProductCount = { ...(target.structureByProductCount || {}), [count]: recipe }
    target.structureByProductCountByPreviewFormat = { ...(target.structureByProductCountByPreviewFormat || {}),
      [previewFormat]: { ...(target.structureByProductCountByPreviewFormat?.[previewFormat] || {}), [count]: recipe } }
    for (const key of ['structureVariantsByProductCount', 'structureVariantByProductCount']) if (target[key]) delete target[key][count]
    for (const key of ['structureVariantsByProductCountByPreviewFormat', 'structureVariantByProductCountByPreviewFormat']) if (target[key]?.[previewFormat]) delete target[key][previewFormat][count]
  }
}

export const PREVIEW_FORMAT: Record<FlyerStructureFormat, string> = { feed: 'feed', stories: 'story', square: 'post', print: 'a4', tv: 'banner' }

/**
 * Expande o painel de setores do canvas. Sem painel (modelo comum), devolve o canvas como está.
 * @returns canvas novo e o id da zona de cada setor, na ordem do plano.
 */
export function expandSectorPanel(source: FabricJson, sectors: ReadonlyArray<FlyerSector>, format: FlyerStructureFormat): { canvas: FabricJson; zoneBySector: Record<string, string> } {
  const canvas = structuredClone(source) as FabricJson
  const objects = canvas.objects
  const panelIndex = objects.findIndex(o => o?.sectorPanel === true && (o.isProductZone || o.isGridZone))
  if (panelIndex < 0 || !sectors.length) return { canvas, zoneBySector: {} }
  const panel = objects[panelIndex]
  const take = (name: string) => objects.find(o => o?.name === name)
  const barTemplate = take('sector-title-bar-template'), textTemplate = take('sector-title-template'), lineTemplate = take('sector-title-line-template')
  const area = box(panel)
  const u = Math.max(.3, num(panel.sectorPanelUnit, 1))
  const gap = 12 * u, pad = 12 * u, titleH = num(panel.sectorTitleHeight, 44 * u), titleGap = 6 * u
  const bands = arrangeFlyerSectorBands(sectors, format)
  const cardsH = Math.max(40, area.height - pad * 2 - gap * (bands.length - 1) - bands.length * (titleH + titleGap))
  const totalRows = bands.reduce((sum, band) => sum + band.rows, 0)
  const perRow = format === 'tv' ? 6 : 4
  const zones: any[] = [], titles: any[] = [], zoneBySector: Record<string, string> = {}
  let y = area.top + pad, index = 0
  for (const band of bands) {
    const zoneH = cardsH * band.rows / totalRows
    const innerW = area.width - pad * 2 - gap * (band.sectors.length - 1)
    const totalCols = band.sectors.reduce((sum, sector) => sum + sector.columns, 0)
    let x = area.left + pad
    for (const sector of band.sectors) {
      const i = index++, w = innerW * sector.columns / totalCols
      const titleW = Math.min(w * (band.sectors.length > 1 ? .9 : .62), (sector.title.length * 21 + 90) * u)
      const common = { parentFrameId: panel.parentFrameId, _frameClipOwner: panel._frameClipOwner || panel.parentFrameId, originX: 'left', originY: 'top', scaleX: 1, scaleY: 1, angle: 0, visible: true }
      if (lineTemplate) titles.push({ ...structuredClone(lineTemplate), ...common, _customId: newId(), name: `sector-title-line-${i + 1}`,
        left: x + titleW - 4 * u, top: y + titleH / 2 - 2 * u, width: Math.max(0, w - titleW + 4 * u), height: 4 * u })
      if (barTemplate) titles.push({ ...structuredClone(barTemplate), ...common, _customId: newId(), name: `sector-title-bar-${i + 1}`,
        left: x, top: y, width: titleW, height: titleH })
      if (textTemplate) titles.push({ ...structuredClone(textTemplate), ...common, _customId: newId(), name: `sector-title-${i + 1}`, sectorTitle: true,
        left: x + 16 * u, top: y + titleH * .14, width: titleW - 32 * u, text: sector.title, __rawText: sector.title, fontSize: titleH * .7 })
      // Setor sozinho com menos produtos que a linha: zona estreita e centralizada (cards do mesmo tamanho).
      const lone = band.sectors.length === 1 && sector.rows === 1 && sector.columns < perRow
      const zoneW = lone ? w * sector.columns / perRow : w
      const zone = structuredClone(panel)
      const id = i === 0 ? panel._customId : newId()
      const label = sector.title.charAt(0) + sector.title.slice(1).toLowerCase()
      Object.assign(zone, { _customId: id, sectorPanel: false, sectorTitle: sector.title, zoneName: label, originX: 'center', originY: 'center',
        left: x + (w - zoneW) / 2 + zoneW / 2, top: y + titleH + titleGap + zoneH / 2, width: zoneW, height: zoneH, scaleX: 1, scaleY: 1, _zoneWidth: zoneW, _zoneHeight: zoneH })
      if (Array.isArray(zone.objects) && zone.objects[0]) Object.assign(zone.objects[0], { width: zoneW, height: zoneH })
      if (zone._zoneStateSnapshot?.zone) {
        Object.assign(zone._zoneStateSnapshot.zone, { id, name: label })
        if (zone._zoneStateSnapshot.zone.geometry) Object.assign(zone._zoneStateSnapshot.zone.geometry, { x: zone.left, y: zone.top, width: zoneW, height: zoneH, scaleX: 1, scaleY: 1, angle: 0 })
      }
      setZoneGridRecipe(zone, PREVIEW_FORMAT[format], sector.productIds.length, sector.columns)
      zones.push(zone)
      zoneBySector[sector.title] = id
      x += w + gap
    }
    y += titleH + titleGap + zoneH + gap
  }
  // Zonas no lugar do painel; títulos logo acima delas. Moldes continuam ocultos no canvas.
  objects.splice(panelIndex, 1, ...zones, ...titles)
  return { canvas, zoneBySector }
}
