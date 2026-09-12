import { describe, expect, it, vi } from 'vitest'
import { collectAssetSearchPages } from '../../utils/collectAssetSearchPages'

describe('collectAssetSearchPages', () => {
  it('exibe o primeiro lote enquanto a segunda página ainda está pendente', async () => {
    let finish!: (value: { items: number[]; nextCursor: null }) => void
    const pending = new Promise<{ items: number[]; nextCursor: null }>(resolve => { finish = resolve })
    const onPage = vi.fn()
    const search = collectAssetSearchPages(async cursor => cursor ? pending : { items: [1], nextCursor: 'next' }, onPage)
    await Promise.resolve()
    expect(onPage).toHaveBeenCalledWith([1])
    finish({ items: [2], nextCursor: null })
    expect(await search).toEqual([1, 2])
    expect(onPage).toHaveBeenLastCalledWith([2])
  })
  it('preserva os lotes entregues quando uma página seguinte falha', async () => {
    const visible: number[] = []
    await expect(collectAssetSearchPages<number>(async cursor => {
      if (cursor) throw new Error('timeout')
      return { items: [1], nextCursor: 'next' }
    }, items => visible.push(...items))).rejects.toThrow('timeout')
    expect(visible).toEqual([1])
  })
  it('interrompe paginação repetida sem continuar indefinidamente', async () => {
    await expect(collectAssetSearchPages(async () => ({ items: [], nextCursor: 'repeat' }))).rejects.toThrow('repetiu')
  })
})
