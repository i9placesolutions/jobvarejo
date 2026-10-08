import { describe, expect, it } from 'vitest'
import { expandSectorPanel } from '../../utils/flyerSectorPanel'
import { chooseFlyerStructure } from '../../utils/flyerStructure'

const panelCanvas = () => ({ objects: [
  { type: 'Rect', isFrame: true, _customId: 'frame', left: 0, top: 0, width: 1080, height: 1350 },
  { type: 'Group', isProductZone: true, sectorPanel: true, _customId: 'zone-1', parentFrameId: 'frame', originX: 'center', originY: 'center',
    left: 540, top: 840, width: 1046, height: 740, sectorPanelUnit: 1, sectorTitleHeight: 42,
    objects: [{ type: 'Rect', width: 1046, height: 740 }], _zoneStateSnapshot: { zone: { id: 'zone-1', geometry: {}, layout: {} } } },
  { type: 'Rect', name: 'sector-title-bar-template', visible: false, fill: '#d40808', rx: 18, ry: 18 },
  { type: 'Textbox', name: 'sector-title-template', visible: false, fill: '#ffffff', fontFamily: 'Barlow Condensed', text: 'SETOR' },
  { type: 'Rect', name: 'sector-title-line-template', visible: false, fill: '#d40808' }
] })
const p = (id: string, name: string) => ({ id, name })
const mixed = [p('1', 'ARROZ'), p('2', 'FEIJÃO'), p('3', 'CAFÉ'), p('4', 'AÇÚCAR'), p('5', 'DETERGENTE'), p('6', 'AMACIANTE'), p('7', 'DESINFETANTE'),
  p('8', 'CERVEJA SKOL'), p('9', 'CERVEJA AMSTEL'), p('10', 'PIZZA SADIA'), p('11', 'LASANHA')]

describe('painel de setores dinâmico', () => {
  it('cria uma zona e um título por setor do pedido, dentro da área do painel', () => {
    const plan = chooseFlyerStructure(mixed)
    const { canvas, zoneBySector } = expandSectorPanel(panelCanvas(), plan.sectors, 'feed')
    const zones = canvas.objects.filter((o: any) => o.isProductZone)
    expect(zones.map((z: any) => z.sectorTitle)).toEqual(['CONGELADOS', 'BEBIDAS', 'MERCEARIA', 'LIMPEZA'])
    expect(Object.keys(zoneBySector)).toHaveLength(4)
    expect(canvas.objects.filter((o: any) => o.sectorTitle === true).map((o: any) => o.text)).toEqual(['CONGELADOS', 'BEBIDAS', 'MERCEARIA', 'LIMPEZA'])
    for (const z of zones) {
      expect(z.left - z.width / 2).toBeGreaterThanOrEqual(17 - .5)
      expect(z.left + z.width / 2).toBeLessThanOrEqual(1063 + .5)
      expect(z.top - z.height / 2).toBeGreaterThanOrEqual(470 - .5)
      expect(z.top + z.height / 2).toBeLessThanOrEqual(1210 + .5)
      expect(z.sectorPanel).toBe(false)
      expect(z._zoneStateSnapshot.zone.layout.structureByProductCountByPreviewFormat.feed).toBeTruthy()
    }
    // Congelados e Bebidas (2 cada) dividem a mesma faixa.
    const frozen = zones.find((z: any) => z.sectorTitle === 'CONGELADOS'), drinks = zones.find((z: any) => z.sectorTitle === 'BEBIDAS')
    expect(frozen.top).toBeCloseTo(drinks.top)
    // Moldes continuam ocultos e únicos.
    expect(canvas.objects.filter((o: any) => o.name === 'sector-title-template' && o.visible === false)).toHaveLength(1)
  })

  it('não altera modelos sem painel de setores', () => {
    const source = { objects: [{ type: 'Group', isProductZone: true, _customId: 'z' }] }
    expect(expandSectorPanel(source, chooseFlyerStructure(mixed).sectors, 'feed').canvas).toEqual(source)
  })
})
