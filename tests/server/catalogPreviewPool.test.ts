// @vitest-environment node
import { describe, expect, it, beforeAll } from 'vitest'
import { build } from 'esbuild'
import sharp from 'sharp'
import { readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { drawCatalogPreviewIsolated, catalogPreviewWorkerEnabled } from '../../server/utils/catalog-preview-pool'
import { drawCatalogPreview } from '../../server/utils/catalog-preview-draw'

// O desenho das prévias roda em processo filho: o processo principal (login, páginas, healthcheck)
// não pode ficar travado enquanto a biblioteca é redesenhada.
describe('pool de desenho das prévias do catálogo', () => {
  beforeAll(async () => {
    // Mesmo empacotamento do Dockerfile.
    await build({
      entryPoints: ['workers/catalog-preview/render-worker.ts'], bundle: true, platform: 'node', format: 'esm',
      alias: { '~': '.' }, external: ['fabric', 'canvas', 'jsdom', 'sharp'],
      outfile: 'workers/catalog-preview/render-worker.mjs', logLevel: 'silent'
    })
  }, 60_000)

  it('desenha no worker sem travar o processo principal', async () => {
    expect(catalogPreviewWorkerEnabled()).toBe(true)
    const background = 'data:image/png;base64,' + (await sharp({ create: { width: 540, height: 675, channels: 4, background: '#d40808' } }).png().toBuffer()).toString('base64')
    const objects = [{ type: 'Image', version: '7.1.0', left: 0, top: 0, width: 540, height: 675, scaleX: 2, scaleY: 2, src: background, originX: 'left', originY: 'top' }]
    for (let i = 0; i < 120; i++) objects.push({ type: 'Textbox', version: '7.1.0', left: (i % 10) * 100, top: Math.floor(i / 10) * 100, width: 180, fontSize: 40, text: `OFERTA ${i}`, fill: '#ffffff', fontFamily: 'Barlow', originX: 'left', originY: 'top' } as any)
    const input = { kind: 'flyer' as const, canvasJson: { version: '7.1.0', objects }, width: 1080, height: 1350 }
    let maxLag = 0, last = Date.now()
    const ticker = setInterval(() => { const now = Date.now(); maxLag = Math.max(maxLag, now - last - 5); last = now }, 5)
    try {
      const results = await Promise.all([drawCatalogPreviewIsolated(structuredClone(input)), drawCatalogPreviewIsolated(structuredClone(input))])
      for (const bytes of results) {
        const meta = await sharp(bytes).metadata()
        expect(meta.format).toBe('webp')
        expect(meta.width).toBeGreaterThan(0)
      }
    } finally { clearInterval(ticker) }
    expect(maxLag).toBeLessThan(150)
  }, 60_000)

  it('repassa o erro do desenho sem derrubar o pool', async () => {
    await expect(drawCatalogPreviewIsolated({ kind: 'label', canvasJson: {}, width: 10, height: 10 })).rejects.toThrow(/fabric|etiqueta/)
    const ok = await drawCatalogPreviewIsolated({ kind: 'flyer', canvasJson: { version: '7.1.0', objects: [] }, width: 200, height: 200 })
    expect(ok.length).toBeGreaterThan(0)
  }, 60_000)

  it('imagem grande embutida desenha rápido (via arquivo temporário) e não deixa sobra', async () => {
    // Data URL de vários MB passava segundos no parser de URL do jsdom; o arquivo temporário evita isso.
    const noise = Buffer.alloc(1600 * 1600 * 3).map((_, i) => (i * 2654435761) >>> 24)
    const big = 'data:image/png;base64,' + (await sharp(noise, { raw: { width: 1600, height: 1600, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer()).toString('base64')
    expect(big.length).toBeGreaterThan(5_000_000)
    const before = (await readdir(tmpdir())).filter(name => name.startsWith('catalog-preview-')).length
    const started = Date.now()
    const bytes = await drawCatalogPreview({ kind: 'flyer', width: 1080, height: 1350, canvasJson: { version: '7.1.0', objects: [
      { type: 'Image', version: '7.1.0', left: 0, top: 0, width: 1600, height: 1600, scaleX: 0.675, scaleY: 0.84375, src: big, originX: 'left', originY: 'top' }
    ] } })
    expect(Date.now() - started).toBeLessThan(4_000)
    expect((await sharp(bytes).metadata()).format).toBe('webp')
    expect((await readdir(tmpdir())).filter(name => name.startsWith('catalog-preview-')).length).toBe(before)
  }, 60_000)
})
