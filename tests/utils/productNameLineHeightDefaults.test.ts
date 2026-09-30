import { expect, it } from 'vitest'
import { upgradeProductNameLineHeightDefaults as upgrade } from '../../utils/productNameLineHeightDefaults'
import { DEFAULT_GLOBAL_STYLES } from '../../types/product-zone'

const fixture = (lineHeight = 1.05) => {
  const zone: any = { isProductZone: true, _customId: 'zone', _zoneGlobalStyles: { prodNameLineHeight: lineHeight },
    _zoneStateSnapshot: { globalStyles: { prodNameLineHeight: lineHeight } } }
  const title: any = { type: 'Textbox', name: 'smart_title', lineHeight: 1.05, text: 'Produto', top: 12, width: 300, fontSize: 24 }
  const price = { type: 'Text', name: 'price', lineHeight: 1.05 }
  const card: any = { isProductCard: true, parentZoneId: 'zone', objects: [title, price] }
  return { zone, title, price, card, objects: [zone, card] }
}
it('novas zonas já usam o padrão de 95%', () => expect(DEFAULT_GLOBAL_STYLES.prodNameLineHeight).toBe(0.95))
it('migra o padrão antigo de 105% no texto, zona e snapshot, preservando preço e geometria', () => {
  const f = fixture()
  expect(upgrade(f.objects)).toBe(1)
  expect(f.title).toMatchObject({ lineHeight: 0.95, top: 12, width: 300, fontSize: 24 })
  expect(f.zone._zoneGlobalStyles.prodNameLineHeight).toBe(0.95)
  expect(f.zone._zoneStateSnapshot.globalStyles.prodNameLineHeight).toBe(0.95)
  expect(f.price.lineHeight).toBe(1.05)
})
it('preserva tipografia manual, override do card e entrelinha diferente da zona', () => {
  const manual = fixture(); manual.title.__manualTypography = true
  const override = fixture(); override.card._cardStyleOverrides = { prodNameLineHeight: 1.05 }
  const custom = fixture(1.2)
  for (const f of [manual, override, custom]) {
    expect(upgrade(f.objects)).toBe(0)
    expect(f.title.lineHeight).toBe(1.05)
  }
  expect(custom.zone._zoneGlobalStyles.prodNameLineHeight).toBe(1.2)
})
it('salvar/reabrir e undo não repetem a migração nem removem uma nova escolha de 105%', () => {
  const f = fixture(); upgrade(f.objects)
  const reopened = JSON.parse(JSON.stringify(f.objects))
  expect(upgrade(reopened)).toBe(0)
  expect(reopened[1].objects[0].lineHeight).toBe(0.95)
  reopened[0]._zoneGlobalStyles.prodNameLineHeight = 1.05
  reopened[1].objects[0].lineHeight = 1.05
  expect(upgrade(reopened)).toBe(0)
  expect(reopened[1].objects[0].lineHeight).toBe(1.05)
})
