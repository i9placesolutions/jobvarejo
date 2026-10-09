import {describe, expect, it, vi} from 'vitest'
import sharp from 'sharp'
import {createCatalogPreviewCache} from '../../server/utils/video-studio/catalog-preview'

const fixture = () => sharp({create: {width: 1920, height: 1080, channels: 4, background: '#ff000080'}}).png().toBuffer()

describe('imagens leves do catálogo de vídeos', () => {
  it('reduz dimensões, preserva transparência e compartilha download/conversão', async () => {
    const original = await fixture(), load = vi.fn(async () => original)
    const get = createCatalogPreviewCache()
    const first = get('hash-a', load)
    expect(get('hash-a', load)).toBe(first)
    const bytes = await first
    const info = await sharp(bytes).metadata()
    expect(info).toMatchObject({format: 'webp', width: 1280, height: 720, hasAlpha: true})
    expect((await sharp(bytes).raw().toBuffer())[3]).toBeGreaterThan(100)
    expect((await sharp(bytes).raw().toBuffer())[3]).toBeLessThan(160)
    expect(await get('hash-a', load)).toBe(bytes)
    expect(load).toHaveBeenCalledTimes(1)
    expect(await sharp(original).metadata()).toMatchObject({format: 'png', width: 1920, height: 1080})
  })

  it('retenta falhas e não armazena itens acima do orçamento de memória', async () => {
    const source = await fixture(), get = createCatalogPreviewCache(1)
    const load = vi.fn().mockRejectedValueOnce(new Error('storage')).mockResolvedValue(source)
    await expect(get('a', load)).rejects.toThrow('storage')
    await get('a', load); await get('a', load)
    expect(load).toHaveBeenCalledTimes(3)
  })

  it('limita downloads/conversões simultâneos a dois e esvazia a fila', async () => {
    const source = await fixture(), get = createCatalogPreviewCache()
    let active = 0, maxActive = 0
    const load = async () => {
      active++; maxActive = Math.max(maxActive, active)
      await new Promise(resolve => setTimeout(resolve, 5))
      active--; return source
    }
    await Promise.all(Array.from({length: 6}, (_, i) => get(String(i), load)))
    expect(maxActive).toBe(2)
    expect(active).toBe(0)
  })
})
