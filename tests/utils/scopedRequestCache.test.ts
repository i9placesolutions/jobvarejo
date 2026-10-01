import { describe, expect, it, vi } from 'vitest'
import { createScopedRequestCache } from '../../utils/scopedRequestCache'

describe('leituras de perfil por conta', () => {
  it('deduplica chamadas simultâneas e expira o cache curto', async () => {
    let time = 0
    const cache = createScopedRequestCache<number>(5000, () => time)
    const load = vi.fn(async () => 1)
    const first = cache.load('a', load)
    expect(cache.load('a', load)).toBe(first)
    await first
    await cache.load('a', load)
    expect(load).toHaveBeenCalledTimes(1)
    time = 5001
    await cache.load('a', load)
    expect(load).toHaveBeenCalledTimes(2)
    await cache.load('b', load)
    expect(load).toHaveBeenCalledTimes(3)
  })
  it('uma atualização ganha de uma leitura anterior ainda em voo', async () => {
    const cache = createScopedRequestCache<string>()
    let release!: (value: string) => void
    const pending = cache.load('a', () => new Promise(resolve => { release = resolve }))
    await Promise.resolve()
    cache.accept('a', 'novo')
    release('antigo')
    expect(await pending).toBe('novo')
    expect(await cache.load('a', async () => 'errado')).toBe('novo')
  })
  it('limpar ao trocar a conta impede reaproveitar a resposta anterior', async () => {
    const cache = createScopedRequestCache<string>()
    let release!: (value: string) => void
    const pending = cache.load('a', () => new Promise(resolve => { release = resolve }))
    await Promise.resolve()
    cache.clear()
    release('antigo')
    await expect(pending).rejects.toThrow('obsoleta')
    await expect(cache.load('b', async () => 'novo')).resolves.toBe('novo')
  })
  it('falha não fica em cache e force ainda compartilha a leitura em andamento', async () => {
    const cache = createScopedRequestCache<string>()
    await expect(cache.load('a', async () => { throw new Error('rede') })).rejects.toThrow('rede')
    const loader = vi.fn(async () => 'ok')
    const first = cache.load('a', loader, true)
    expect(cache.load('a', loader, true)).toBe(first)
    await expect(first).resolves.toBe('ok')
    await cache.load('a', loader, true)
    expect(loader).toHaveBeenCalledTimes(2)
  })
})
