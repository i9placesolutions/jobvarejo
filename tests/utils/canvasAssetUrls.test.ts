import { describe, expect, it, vi } from 'vitest'

vi.mock('#imports', () => ({
  useRuntimeConfig: () => ({
    public: {
      contabo: { bucket: 'jobvarejo' },
      wasabi: { bucket: 'jobvarejo' }
    }
  })
}))

import {
  CANVAS_ASSET_URLS_NORMALIZED_KEY,
  normalizeCanvasAssetUrls
} from '~/utils/canvasAssetUrls'

describe('normalizeCanvasAssetUrls', () => {
  it('migra URLs absolutas de um preview local em src e __originalSrc', () => {
    const canvas = {
      version: '7.1.0',
      objects: [
        {
          type: 'image',
          src: 'http://127.0.0.1:3010/api/storage/p?key=imagens%2Fproduto.webp',
          __originalSrc: 'http://127.0.0.1:3010/api/storage/p?key=imagens%2Fproduto.webp'
        },
        {
          type: 'image',
          src: 'http://localhost:3010/assets/alcohol-under-18-badge.png'
        }
      ]
    }

    const result = normalizeCanvasAssetUrls(canvas)
    const [product, badge] = result.data.objects

    expect(result.loopbackCount).toBe(3)
    expect(product.src).toBe('/api/storage/p?key=imagens%2Fproduto.webp')
    expect(product.__originalSrc).toBe('/api/storage/p?key=imagens%2Fproduto.webp')
    expect(badge.src).toBe('/assets/alcohol-under-18-badge.png')
    expect(result.data[CANVAS_ASSET_URLS_NORMALIZED_KEY]).toBe(3)
    expect(canvas.objects[0]!.src).toContain('127.0.0.1:3010')
  })

  it('continua normalizando imagens adicionadas depois que a página foi marcada como migrada', () => {
    const canvas = {
      [CANVAS_ASSET_URLS_NORMALIZED_KEY]: 3,
      objects: [
        {
          type: 'image',
          src: 'https://s3.wasabisys.com/jobvarejo/imagens/imagem-nova.webp'
        }
      ]
    }

    const result = normalizeCanvasAssetUrls(canvas)
    const image = result.data.objects[0]

    expect(result.wasabiCount).toBe(1)
    expect(image.src).toBe('/api/storage/p?key=imagens%2Fimagem-nova.webp')
    expect(image.__originalSrc).toBe('https://s3.wasabisys.com/jobvarejo/imagens/imagem-nova.webp')
  })
})
