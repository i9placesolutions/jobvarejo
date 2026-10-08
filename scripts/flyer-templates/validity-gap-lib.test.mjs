// node --test scripts/flyer-templates/validity-gap-lib.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { moveValidityIntoGap, validityTextColor } from './validity-gap-lib.mjs'

const page = (extra = {}) => ({ objects: [
  { type: 'Rect', isFrame: true, name: 'frame', left: 0, top: 0, width: 1080, height: 1350, fill: '#171819' },
  { type: 'Rect', name: 'Base de cor da campanha', left: 0, top: 0, width: 1080, height: 1350, fill: '#171819' },
  { type: 'Image', name: 'campaign-bg-header', left: 0, top: 0, width: 1080, height: 472 },
  { type: 'Image', name: 'campaign-bg-retail-field', left: 0, top: 526, width: 1080, height: 716 },
  { type: 'Rect', name: 'retail-validity-visual-band', left: 27, top: 479, width: 1026, height: 54, fill: '#ffdc22', ...extra.band },
  { type: 'Textbox', name: 'header-validity', left: 288, top: 482, width: 549, height: 48, fill: '#171717', dynamicFieldTextColor: '#172033', text: 'OFERTAS VÁLIDAS DE 01/04 A 07/04' },
  { type: 'Path', name: 'header-validity-calendar', left: 246, top: 489, width: 30, height: 30, fill: '', stroke: '#171717' },
  { type: 'Rect', name: 'standard-validity-background', left: 27, top: 479, width: 1026, height: 54, fill: 'rgba(0,0,0,0)' }
] })
const by = (canvas, name) => canvas.objects.find(o => o.name === name)

test('leva a validade para o vão, esconde a pílula e pinta data e calendário', () => {
  const { canvas, changes } = moveValidityIntoGap(page())
  assert.equal(by(canvas, 'retail-validity-visual-band').visible, false)
  const area = by(canvas, 'standard-validity-background')
  assert.deepEqual([area.left, area.top, area.width, area.height], [27, 472, 1026, 54])
  assert.equal(by(canvas, 'header-validity').top, 475)
  assert.equal(by(canvas, 'header-validity').fill, '#ffdc22')
  assert.equal(by(canvas, 'header-validity').dynamicFieldTextColor, '#ffdc22')
  assert.equal(by(canvas, 'header-validity-calendar').stroke, '#ffdc22')
  assert.equal(by(canvas, 'header-validity-calendar').fill, '')
  assert.ok(changes.length >= 3)
})

test('é idempotente e não altera o original', () => {
  const source = page()
  const first = moveValidityIntoGap(source)
  assert.equal(by(source, 'retail-validity-visual-band').visible, undefined)
  assert.equal(moveValidityIntoGap(first.canvas).changes.length, 0)
})

test('pula páginas sem vão entre cabeçalho e campo', () => {
  const source = page()
  by(source, 'campaign-bg-retail-field').top = 472
  assert.equal(moveValidityIntoGap(source).skipped, 'fundo sem vão')
})

test('usa branco ou preto quando a cor da pílula não contrasta com a faixa', () => {
  assert.equal(validityTextColor('#ffdc22', '#171819'), '#ffdc22')
  assert.equal(validityTextColor('#1b5e20', '#14501a'), '#ffffff')
  assert.equal(validityTextColor('#fff8e1', '#ffeb3b'), '#171717')
})
