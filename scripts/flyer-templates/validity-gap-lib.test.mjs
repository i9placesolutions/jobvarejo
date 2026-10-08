// node --test scripts/flyer-templates/validity-gap-lib.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { compactInstagramPanel, fixCampaignHeader, liftInstagramAboveValidity, moveValidityIntoGap, validityTextColor } from './validity-gap-lib.mjs'

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

const instagram = (gapTop = 408) => ({ objects: [
  { type: 'Rect', name: 'header-instagram-panel', left: 619, top: 345, width: 444, height: 117, fill: '#171717' },
  { type: 'Textbox', name: 'header-instagram-title', left: 627, top: 353, width: 427, height: 21, text: 'SIGA NOSSO INSTAGRAM' },
  { type: 'Rect', name: 'header-instagram-background', left: 677, top: gapTop, width: 303, height: 54 },
  { type: 'Group', name: 'header-icon-instagram', left: 699, top: gapTop - 12, width: 44, height: 44 },
  { type: 'Textbox', name: 'header-instagram', left: 760, top: gapTop - 12, width: 198, height: 43, text: '@SUALOJA' }
] })

test('compacta o painel do Instagram mantendo o topo', () => {
  const { canvas, changes } = compactInstagramPanel(instagram())
  assert.equal(by(canvas, 'header-instagram-background').top, 378)
  assert.equal(by(canvas, 'header-instagram').top, 366)
  assert.equal(by(canvas, 'header-icon-instagram').top, 366)
  assert.deepEqual([by(canvas, 'header-instagram-panel').top, by(canvas, 'header-instagram-panel').height], [345, 87])
  assert.deepEqual(changes, ['painel do Instagram 30 px mais baixo'])
  assert.equal(compactInstagramPanel(canvas).changes.length, 0)
})

test('não mexe em painel já compacto e junta as duas correções', () => {
  assert.equal(compactInstagramPanel(instagram(380)).skipped, 'painel do Instagram já compacto')
  const both = fixCampaignHeader({ objects: [...page().objects, ...instagram().objects] })
  assert.ok(both.changes.includes('pílula de validade escondida'))
  assert.ok(both.changes.includes('painel do Instagram 30 px mais baixo'))
})

test('sobe o painel do Instagram que cobre a validade e reduz a logo só o necessário', () => {
  const source = { objects: [
    { type: 'Image', name: 'header-logo-slot', left: 619, top: 39, width: 444, height: 238, quickLogoMaxWidth: 444, quickLogoMaxHeight: 238 },
    { type: 'Rect', name: 'header-instagram-panel', left: 619, top: 305, width: 444, height: 73 },
    { type: 'Textbox', name: 'header-instagram-title', left: 627, top: 313, width: 427, height: 21 },
    { type: 'Rect', name: 'standard-validity-background', left: 27, top: 346, width: 1026, height: 54 },
    { type: 'Textbox', name: 'header-validity', left: 288, top: 349, width: 549, height: 48 }
  ] }
  const { canvas, changes } = liftInstagramAboveValidity(source, 1080)
  assert.equal(by(canvas, 'header-instagram-panel').top, 267)
  assert.equal(by(canvas, 'header-instagram-title').top, 275)
  const logo = by(canvas, 'header-logo-slot'), bottom = logo.top + logo.height * logo.scaleY
  assert.ok(Math.abs(bottom - 261) < .01, `logo termina em ${bottom}`)
  assert.ok(Math.abs(logo.left + logo.width * logo.scaleX / 2 - 841) < .01, 'logo centralizada')
  assert.equal(changes.length, 2)
  assert.equal(liftInstagramAboveValidity(canvas, 1080).changes.length, 0)
})
