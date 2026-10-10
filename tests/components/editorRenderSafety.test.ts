import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { afterEach, expect, it, vi } from 'vitest'

const source = readFileSync(new URL('../../components/EditorCanvas.vue', import.meta.url), 'utf8').split('<script setup lang="ts">')[1]!.split('</script>')[0]!
const ast = ts.createSourceFile('editor.ts', source, ts.ScriptTarget.Latest, true)
let safetySource = ''
ast.forEachChild(node => {
  if (ts.isVariableStatement(node) && node.declarationList.declarations.some(item => item.name.getText(ast) === 'patchCanvasRenderSafety')) safetySource = node.getText(ast)
})
const patch = new Function('clearInvalidClipPath', `${ts.transpile(safetySource, { target: ts.ScriptTarget.ES2022 })}; return patchCanvasRenderSafety`)(vi.fn())
function harness() {
  const frames = new Map<number, FrameRequestCallback>()
  let id = 0
  vi.stubGlobal('window', {})
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++id, callback); return id })
  vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key))
  const canvas = { contextContainer: { clearRect() {} }, _objects: [] as any[], renderAll: vi.fn(), requestRenderAll: vi.fn(() => requestAnimationFrame(() => canvas.renderAll())) }
  const originalRender = canvas.renderAll
  const cancel = patch(canvas)
  const frame = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(16)) }
  return { canvas, originalRender, frames, cancel, frame }
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
it('renderiza alterações agrupadas no primeiro frame e permite cancelar na desmontagem', () => {
  const h = harness()
  for (let i = 0; i < 100; i++) h.canvas.requestRenderAll()
  h.frame()
  expect(h.originalRender).toHaveBeenCalledOnce()
  expect(h.frames.size).toBe(0)
  h.canvas.requestRenderAll(); h.cancel(); h.frame()
  expect(h.originalRender).toHaveBeenCalledOnce()
})
it('recupera erro removendo apenas objetos inválidos antes de tentar desenhar novamente', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const h = harness()
  const valid = { render() {}, setCoords() {} }
  h.canvas._objects = [null, valid]
  h.originalRender.mockImplementationOnce(() => { throw new Error('invalid object') })
  h.canvas.requestRenderAll(); h.frame()
  expect(h.originalRender).toHaveBeenCalledTimes(2)
  expect(h.canvas._objects).toEqual([valid])
  expect(h.frames.size).toBe(0)
})
