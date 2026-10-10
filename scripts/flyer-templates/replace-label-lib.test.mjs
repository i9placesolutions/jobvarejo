import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyLabel, colorFamily, LABEL_POOL } from './replace-label-lib.mjs'

const group = bg => ({ type: 'Group', name: 'priceGroup', objects: [
  { type: 'Rect', name: 'price-rim', fill: '#ffdc16' }, { type: 'Rect', name: 'price_bg', fill: bg },
  { type: 'Text', name: 'price_currency_text', fill: '#161616' }, { type: 'IText', name: 'price_value_text', fill: '#ffffff' }
] })
const label = { key: 'tpl_nova', name: 'Nova', kind: 'priceGroup-v1', group: group('#dd0715') }

test('família de cor pela base, usando o destaque quando a base é clara', () => {
  assert.equal(colorFamily('#d40808'), 'red')
  assert.equal(colorFamily('#0b44b8'), 'blue')
  assert.equal(colorFamily('#161616'), 'dark')
  assert.equal(colorFamily('#2e9b3a'), 'green')
  assert.equal(colorFamily('#f9fafa', '#0b44b8'), 'blue')
  assert.equal(colorFamily('#fbfbfb', '#f4f4f4'), 'light')
  assert.equal(colorFamily('#0d0d0d', '#39ff14'), 'green')
  assert.equal(colorFamily('#0d0d0d', '#e8b923'), 'dark')
  for (const pool of Object.values(LABEL_POOL)) assert.ok(!pool.includes('tpl_economia_mes_economia'))
})

test('troca a etiqueta da zona, usa as cores dela e atualiza a biblioteca embutida', () => {
  const canvas = {
    __labelTemplates: [{ id: 'tpl_nova', name: 'antiga', group: group('#323232') }, { id: 'outra', name: 'Outra', group: group('#000') }],
    objects: [{ name: 'Fundo' }, { isProductZone: true, _zoneTemplateSnapshotId: 'tpl_old', _zoneTemplateSnapshot: group('#ffdf12'),
      _zoneGlobalStyles: { splashTemplateId: 'tpl_old', splashFill: '#323232', priceTextColor: '#000', cardColor: '#fff' },
      _zoneStateSnapshot: { labelTemplate: { id: 'tpl_old' }, globalStyles: { splashFill: '#323232' } } }]
  }
  const { canvas: out, changes } = applyLabel(canvas, label, [label])
  const zone = out.objects[1]
  assert.deepEqual(changes, ['etiqueta tpl_old → tpl_nova'])
  assert.equal(zone._zoneTemplateSnapshotId, 'tpl_nova')
  assert.equal(zone._zoneGlobalStyles.splashTemplateId, 'tpl_nova')
  assert.equal(zone._zoneGlobalStyles.splashFill, '#dd0715')
  assert.equal(zone._zoneGlobalStyles.priceTextColor, '#ffffff')
  assert.equal(zone._zoneGlobalStyles.cardColor, '#fff')
  assert.equal(zone._zoneStateSnapshot.labelTemplate.id, 'tpl_nova')
  assert.equal(out.__labelTemplates[0].group.objects[1].fill, '#dd0715')
  assert.equal(out.__labelTemplates[1].group.objects[1].fill, '#000')
  // Original intacto.
  assert.equal(canvas.objects[1]._zoneTemplateSnapshotId, 'tpl_old')
})

test('modelo sem zona de produtos não muda', () => {
  const { changes, canvas } = applyLabel({ objects: [{ name: 'Fundo' }] }, label, [label])
  assert.equal(changes.length, 0)
  assert.equal(canvas.__labelTemplates, undefined)
})
