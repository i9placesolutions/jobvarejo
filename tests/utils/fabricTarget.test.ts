import { describe, expect, it, vi } from 'vitest'
import { resolveFabricTarget } from '../../utils/fabricTarget'

describe('resolveFabricTarget', () => {
  it('extrai o objeto Fabric 7 antes de restaurar o transform bloqueado', () => {
    const target = { set: vi.fn() }
    const resolved = resolveFabricTarget({ target, subTargets: [] })
    expect(resolved).toBe(target)
    resolved.set({ left: 10 })
    expect(target.set).toHaveBeenCalledWith({ left: 10 })
  })
  it('preserva objetos diretos das rotas legadas', () => {
    const target = { set: vi.fn() }
    expect(resolveFabricTarget(target)).toBe(target)
  })
  it.each([null, undefined, {}, { subTargets: [] }, { target: null }, { target: {} }])('não usa um envelope vazio como objeto: %j', result => {
    expect(resolveFabricTarget(result)).toBeNull()
  })
})
