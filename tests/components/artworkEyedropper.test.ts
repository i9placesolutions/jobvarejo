import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import ts from 'typescript'
import * as Vue from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { sampleCanvasColor } from '../../utils/canvasColorSampler'

function load(path: string) {
  const { descriptor } = parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
  const source = ts.transpileModule(compileScript(descriptor, { id: path }).content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const exports: any = {}
  new Function('require', 'exports', source)((id: string) => {
    if (id === 'vue') return Vue
    if (id === '~/utils/canvasColorSampler') return { sampleCanvasColor }
    if (id.endsWith('.vue')) return { default: {} }
    if (id === 'lucide-vue-next') return {}
    throw new Error(`Unexpected import: ${id}`)
  }, exports)
  return exports.default
}
const Eyedropper = load('../../components/ui/ArtworkEyedropper.vue')
const Menu = load('../../components/QuickModeElementColorMenu.vue')
const host = () => ({})
const renderer = Vue.createRenderer({
  createElement: host, createText: host, createComment: host, insert: () => {}, remove: () => {},
  setText: () => {}, setElementText: () => {}, parentNode: () => null, nextSibling: () => null, patchProp: () => {}
})
const apps: ReturnType<typeof renderer.createApp>[] = []
afterEach(() => { apps.splice(0).forEach(app => app.unmount()); vi.unstubAllGlobals() })
function mount(component: any, props: any = {}) {
  const app = renderer.createApp({ ...component, render: () => null }, props)
  apps.push(app); app.mount({})
  return (app as any)._instance.setupState
}
function fixture() {
  const win = Object.assign(new EventTarget(), { innerWidth: 1200, innerHeight: 800 })
  class Canvas {
    width = 1200; height = 800
    getBoundingClientRect() { return { left: 100, top: 50, width: 600, height: 400 } }
    getImageData = vi.fn(() => ({ data: new Uint8ClampedArray([18, 52, 86, 255]) }))
    getContext() { return { getImageData: this.getImageData } }
    closest() { return null }
  }
  const canvas = new Canvas()
  const upper = new Canvas()
  upper.closest = (selector?: string): any => selector === '.canvas-container' ? { querySelector: () => canvas } : null
  vi.stubGlobal('HTMLCanvasElement', Canvas)
  vi.stubGlobal('window', win)
  vi.stubGlobal('document', { elementsFromPoint: () => [upper, canvas] })
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  return { win, canvas, upper }
}
const point = { clientX: 250, clientY: 150 } as MouseEvent

it('samples the lower artwork canvas on Safari and emits its exact hex once', async () => {
  const { canvas, upper } = fixture()
  const pick = vi.fn()
  const state = mount(Eyedropper, { onPick: pick })
  state.start(point); await Vue.nextTick()
  expect(state.canvasActive).toBe(true)
  state.pickCanvasColor(point)
  expect(pick).toHaveBeenCalledExactlyOnceWith('#123456')
  expect(canvas.getImageData).toHaveBeenCalledWith(300, 200, 1, 1)
  expect(upper.getImageData).not.toHaveBeenCalled()
  expect(state.canvasActive).toBe(false)
})
it('Escape cancels capture without emitting a color or propagating editor shortcuts', () => {
  const { win } = fixture()
  const pick = vi.fn(), shortcut = vi.fn()
  const state = mount(Eyedropper, { onPick: pick })
  win.addEventListener('keydown', shortcut)
  state.start(point)
  const event = Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape' })
  win.dispatchEvent(event)
  expect(state.canvasActive).toBe(false)
  expect(pick).not.toHaveBeenCalled()
  expect(shortcut).not.toHaveBeenCalled()
  expect(event.defaultPrevented).toBe(true)
})
it('keeps capture open and reports unreadable cross-origin canvas without changing color', () => {
  const { canvas } = fixture()
  canvas.getImageData.mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError') })
  const pick = vi.fn(), state = mount(Eyedropper, { onPick: pick })
  state.start(point); state.pickCanvasColor(point)
  expect(state.canvasActive).toBe(true)
  expect(state.eyedropperHint).toContain('Não foi possível ler esta arte')
  expect(pick).not.toHaveBeenCalled()
})
it('uses the native picker when available and aborts late results after cancellation', async () => {
  const { win } = fixture()
  let resolve!: (result: any) => void
  let signal!: AbortSignal
  const open = vi.fn((options: any) => { signal = options.signal; return new Promise(r => { resolve = r }) })
  Object.assign(win, { EyeDropper: class { open = open } })
  const pick = vi.fn(), state = mount(Eyedropper, { onPick: pick })
  state.start(point)
  expect(open).toHaveBeenCalledOnce()
  state.cancel()
  expect(signal.aborted).toBe(true)
  resolve({ sRGBHex: '#abcdef' }); await Promise.resolve()
  expect(pick).not.toHaveBeenCalled()
})
it('emits the exact native color without HSL rounding', async () => {
  const { win } = fixture()
  Object.assign(win, { EyeDropper: class { open() { return Promise.resolve({ sRGBHex: '#abcdef' }) } } })
  const pick = vi.fn(), state = mount(Eyedropper, { onPick: pick })
  state.start(point); await Promise.resolve()
  expect(pick).toHaveBeenCalledExactlyOnceWith('#abcdef')
  expect(state.nativeActive).toBe(false)
})
it('applies a captured color to the selected element only', () => {
  fixture()
  const apply = vi.fn(), state = mount(Menu, { targets: [{ id: 'card-a', label: 'Card A', color: '#ff0000' }], onApplyColor: apply })
  const start = vi.fn(); state.eyedropper = { start, cancel: vi.fn() }
  state.startEyedropper(point); state.applyPickedColor('#123456')
  expect(start).toHaveBeenCalledExactlyOnceWith(point)
  expect(apply).toHaveBeenCalledExactlyOnceWith({ targetId: 'card-a', value: '#123456' })
  expect(state.customColor).toBe('#123456')
})
it('discards capture if the target selection changes', async () => {
  fixture()
  const apply = vi.fn(), state = mount(Menu, { targets: [{ id: 'a' }, { id: 'b' }], onApplyColor: apply })
  const cancel = vi.fn(); state.eyedropper = { start: vi.fn(), cancel }
  state.startEyedropper(point); state.selectedId = 'b'; await Vue.nextTick()
  state.applyPickedColor('#123456')
  expect(cancel).toHaveBeenCalledOnce()
  expect(apply).not.toHaveBeenCalled()
})
it('does not start or apply color while the editor is busy', () => {
  fixture()
  const apply = vi.fn(), state = mount(Menu, { busy: true, targets: [{ id: 'a' }], onApplyColor: apply })
  const start = vi.fn(); state.eyedropper = { start, cancel: vi.fn() }
  state.startEyedropper(point); state.applyPickedColor('#123456')
  expect(start).not.toHaveBeenCalled()
  expect(apply).not.toHaveBeenCalled()
})
