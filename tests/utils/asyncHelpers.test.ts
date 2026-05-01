import { describe, it, expect, vi } from 'vitest'
import { mapLimit } from '~/utils/asyncHelpers'

describe('mapLimit', () => {
  it('processa todos os items', async () => {
    const items = [1, 2, 3, 4, 5]
    const seen: number[] = []
    await mapLimit(items, 2, async (n) => { seen.push(n) })
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('chama worker com (item, index)', async () => {
    const calls: Array<[any, number]> = []
    await mapLimit(['a', 'b', 'c'], 1, async (item, index) => {
      calls.push([item, index])
    })
    expect(calls.sort((x, y) => x[1] - y[1])).toEqual([['a', 0], ['b', 1], ['c', 2]])
  })

  it('lista vazia: resolve imediato sem chamadas', async () => {
    const worker = vi.fn(async () => {})
    await mapLimit([], 4, worker)
    expect(worker).not.toHaveBeenCalled()
  })

  it('respeita concorrencia maxima', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    await mapLimit(items, 3, async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise(resolve => setTimeout(resolve, 5))
      inFlight--
    })
    expect(maxInFlight).toBeLessThanOrEqual(3)
  })

  it('concorrencia maior que itens: limita ao numero de itens', async () => {
    const items = [1, 2]
    let started = 0
    await mapLimit(items, 100, async () => {
      started++
    })
    expect(started).toBe(2)
  })

  it('concorrencia 0/negativa cai para 1', async () => {
    const items = [1, 2, 3]
    let inFlight = 0
    let maxInFlight = 0
    await mapLimit(items, 0, async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise(resolve => setTimeout(resolve, 1))
      inFlight--
    })
    expect(maxInFlight).toBe(1)
  })

  it('propaga erro do worker', async () => {
    await expect(mapLimit([1, 2, 3], 1, async (n) => {
      if (n === 2) throw new Error('boom')
    })).rejects.toThrow('boom')
  })

  it('processa items na ordem mas conclui em paralelo (cursor compartilhado)', async () => {
    const order: number[] = []
    await mapLimit([100, 1, 1], 3, async (n) => {
      await new Promise(resolve => setTimeout(resolve, n))
      order.push(n)
    })
    // O com delay 100 termina por ultimo, os outros 2 cedo
    expect(order[order.length - 1]).toBe(100)
  })
})
