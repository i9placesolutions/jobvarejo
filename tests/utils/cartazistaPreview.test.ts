import { expect, it } from 'vitest'
import { getCartazistaPreviewSvg } from '../../utils/cartazista/preview'
import type { ArtComposition } from '../../types/art-studio'

const composition = (name: string) => ({
  width: 100,
  height: 100,
  background: '#fff',
  layers: [{ id: name, kind: 'text', text: name, x: 0, y: 0, width: 50, height: 20 }]
}) as unknown as ArtComposition

it('deduplica a mesma prévia, limita o Fabric a duas renderizações e reutiliza o cache', async () => {
  let active = 0
  let maximumActive = 0
  const render = async (item: ArtComposition) => {
    active += 1
    maximumActive = Math.max(maximumActive, active)
    await new Promise(resolve => setTimeout(resolve, 5))
    active -= 1
    return `svg:${item.layers[0]?.id}`
  }
  const first = composition('parallel-a')
  const second = composition('parallel-b')
  const third = composition('parallel-c')
  const calls = [
    getCartazistaPreviewSvg(first, render),
    getCartazistaPreviewSvg(first, render),
    getCartazistaPreviewSvg(second, render),
    getCartazistaPreviewSvg(third, render)
  ]

  expect(await Promise.all(calls)).toEqual([
    'svg:parallel-a', 'svg:parallel-a', 'svg:parallel-b', 'svg:parallel-c'
  ])
  expect(maximumActive).toBe(2)

  let cacheRenderCount = 0
  await expect(getCartazistaPreviewSvg(first, async () => {
    cacheRenderCount += 1
    return 'unexpected'
  })).resolves.toBe('svg:parallel-a')
  expect(cacheRenderCount).toBe(0)
})
