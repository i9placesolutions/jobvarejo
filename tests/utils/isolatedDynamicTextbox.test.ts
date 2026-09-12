import { afterEach, expect, it, vi } from 'vitest'
import * as fabric from 'fabric/node'
import { createIsolatedDynamicTextbox } from '../../utils/isolatedDynamicTextbox'
import { configureDynamicBusinessTextObject } from '../../utils/dynamicBusinessFields'
afterEach(() => vi.restoreAllMocks())

it('recria campo serializado em Fabric 7 sem escrever em type somente leitura', () => {
  // O teste usa o construtor real; somente medição de fonte requer canvas nativo.
  vi.spyOn(fabric.Textbox.prototype, 'initDimensions').mockImplementation(() => {})
  const source = { type: 'Textbox', text: 'Endereço antigo', width: 400, fontSize: 20, businessProfileField: 'address', fill: '#ffffff' }
  expect(() => new fabric.Textbox(source.text, source as any)).toThrow()
  const runtime = createIsolatedDynamicTextbox(fabric, source)
  configureDynamicBusinessTextObject(runtime, fabric)
  runtime.set({ text: 'Endereço atualizado' })
  expect(runtime.text).toBe('Endereço atualizado')
  expect(runtime.fill).toBe('#ffffff')
  expect(source.text).toBe('Endereço antigo')
  runtime.dispose()
})
