import {describe, expect, it, vi} from 'vitest'
import {createStickerLogoCache} from '../../shared/video-studio/sticker-cache'

describe('contorno da logo no Player', () => {
  it('compartilha trabalho simultâneo e reutiliza o resultado em outro loop', async () => {
    const render = vi.fn(async (src: string) => 'sticker:' + src)
    const get = createStickerLogoCache(render)
    const first = get('logo-a')
    expect(get('logo-a')).toBe(first)
    await expect(first).resolves.toBe('sticker:logo-a')
    await expect(get('logo-a')).resolves.toBe('sticker:logo-a')
    expect(render).toHaveBeenCalledTimes(1)
    await expect(get('logo-b')).resolves.toBe('sticker:logo-b')
    expect(render).toHaveBeenCalledTimes(2)
  })

  it('limita o cache por uso recente e permite tentar novamente após falha', async () => {
    const render = vi.fn(async (src: string) => src)
    const get = createStickerLogoCache(render, 2)
    await get('a'); await get('b'); await get('a'); await get('c'); await get('b')
    expect(render.mock.calls.map(([src]) => src)).toEqual(['a', 'b', 'c', 'b'])
    render.mockRejectedValueOnce(new Error('decode'))
    await expect(get('failed')).rejects.toThrow('decode')
    await expect(get('failed')).resolves.toBe('failed')
  })
})
