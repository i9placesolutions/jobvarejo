// node --test scripts/flyer-templates/replace-seal-lib.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { replaceSeal } from './replace-seal-lib.mjs'

const page = () => ({ objects: [
  { type: 'Image', name: 'Selo 3D Super Ofertas — Moedas', src: '/old.png', left: 9, top: 105, width: 1651, height: 767, scaleX: 572 / 1651, scaleY: 572 / 1651 },
  { type: 'Image', name: 'header-logo-slot', left: 619, top: 62, width: 444, height: 238 },
  { type: 'Rect', name: 'standard-validity-background', left: 27, top: 472, width: 1026, height: 54 }
] })
const seal = { src: '/api/storage/p?key=new.png', width: 1600, height: 1566, pageWidth: 1080 }

test('ocupa a altura livre entre o topo e a validade, na mesma coluna', () => {
  const { canvas, changes } = replaceSeal(page(), seal)
  const s = canvas.objects[0]
  assert.equal(s.src, seal.src)
  const h = s.height * s.scaleY, w = s.width * s.scaleX
  assert.ok(Math.abs(h - (472 - 24)) < .01, `altura ${h}`)
  assert.ok(Math.abs(s.top - 12) < .01)
  assert.ok(Math.abs(s.left + w / 2 - (9 + 572 / 2)) < .01, 'centralizado na coluna')
  assert.ok(w <= 572)
  assert.equal(changes.length, 1)
})

test('é idempotente e não altera o original', () => {
  const source = page()
  const first = replaceSeal(source, seal)
  assert.equal(source.objects[0].src, '/old.png')
  assert.equal(replaceSeal(first.canvas, seal).skipped, 'selo já trocado')
})

test('limita pela largura quando a coluna é mais estreita que a altura', () => {
  const { canvas } = replaceSeal(page(), { ...seal, width: 1600, height: 800 })
  assert.ok(Math.abs(canvas.objects[0].width * canvas.objects[0].scaleX - 572) < .01)
})
