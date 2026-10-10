import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { Group, Textbox, util } from 'fabric/node'
import { expect, it } from 'vitest'
import { normalizeFabricTextStylesForSerialization } from '../../utils/fabricTextStyleSerialization'

const source = readFileSync(new URL('../../components/LabelTemplateMiniEditor.vue', import.meta.url), 'utf8').split('<script setup lang="ts">')[1]!.split('</script>')[0]!
const ast = ts.createSourceFile('mini-editor.ts', source, ts.ScriptTarget.Latest, true)
let historySource = ''
ast.forEachChild(node => {
  if (ts.isVariableStatement(node) && node.declarationList.declarations.some(item => item.name.getText(ast) === 'serializeGroupForHistory')) historySource = node.getText(ast)
})
const compiled = ts.transpile(historySource, { target: ts.ScriptTarget.ES2022 })
const serialize = new Function('normalizeFabricTextStylesForSerialization', 'TEMPLATE_EXTRA_PROPS', 'cloneJsonSafe', 'shouldUseAtacVariantSnapshots',
  `${compiled}; return serializeGroupForHistory`)(normalizeFabricTextStylesForSerialization, ['name'], structuredClone, () => false)

it('serializa histórico de etiqueta com estilos extras sem apagar texto, cor ou geometria', async () => {
  const text = new Textbox('54,00', { fill: '#ffee00', fontSize: 42, left: 12, top: 9 })
  text.styles = { 0: { 0: { charSpacing: 0 }, 1: { fill: '#ffffff' } } } as any
  const group = new Group([text])
  const geometry = { left: text.left, top: text.top, width: text.width, height: text.height }
  expect(() => group.toObject()).toThrow(TypeError)
  const snapshot = serialize(group)
  expect(snapshot.objects[0]).toMatchObject({ text: '54,00', fill: '#ffee00' })
  for (const [key, value] of Object.entries(geometry)) expect(snapshot.objects[0][key]).toBeCloseTo(value, 4)
  expect(snapshot.objects[0].styles).toEqual([
    { start: 0, end: 1, style: { charSpacing: 0, deltaY: 0 } },
    { start: 1, end: 2, style: { fill: '#ffffff' } }
  ])
  const [restored] = await util.enlivenObjects([snapshot]) as Group[]
  expect(serialize(restored).objects[0]).toMatchObject({ text: '54,00', fill: '#ffee00', styles: snapshot.objects[0].styles })
  restored?.dispose(); group.dispose()
})
it('suporta snapshots repetidos após edição e restauração para undo/redo', async () => {
  const text = new Textbox('9,99')
  text.styles = { 0: { 0: { fill: undefined } } }
  const group = new Group([text])
  const first = serialize(group)
  text.set('text', '8,99')
  const second = serialize(group)
  for (const snapshot of [first, second, first]) {
    const [restored] = await util.enlivenObjects([snapshot]) as Group[]
    expect(serialize(restored).objects[0].text).toBe(snapshot.objects[0].text)
    restored?.dispose()
  }
  group.dispose()
})
