// @vitest-environment node
import { describe, expect, it, beforeAll } from 'vitest'
import { build } from 'esbuild'
import sharp from 'sharp'
import { readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { drawCatalogPreviewIsolated, catalogPreviewWorkerEnabled } from '../../server/utils/catalog-preview-pool'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drawCatalogPreview, externalizeDataImages } from '../../server/utils/catalog-preview-draw'

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
    // Desenhar no próprio processo trava > 1 s; a folga cobre a suíte inteira rodando em paralelo.
    expect(maxLag).toBeLessThan(500)
  }, 60_000)

  it('repassa o erro do desenho sem derrubar o pool', async () => {
    await expect(drawCatalogPreviewIsolated({ kind: 'label', canvasJson: {}, width: 10, height: 10 })).rejects.toThrow(/fabric|etiqueta/)
    const ok = await drawCatalogPreviewIsolated({ kind: 'flyer', canvasJson: { version: '7.1.0', objects: [] }, width: 200, height: 200 })
    expect(ok.length).toBeGreaterThan(0)
  }, 60_000)

  it('imagens embutidas viram arquivo temporário antes do jsdom (data URL grande era lenta demais)', async () => {
    const png = await sharp({ create: { width: 8, height: 8, channels: 4, background: '#ff0000' } }).png().toBuffer()
    const dataUrl = `data:image/png;base64,${png.toString('base64')}`
    const canvasJson = { objects: [{ type: 'Image', src: dataUrl }, { type: 'Group', objects: [{ type: 'Image', src: dataUrl }] }, { type: 'Rect', fill: { type: 'pattern', source: dataUrl } }, { type: 'Image', src: 'https://exemplo/x.png' }] }
    const directory = await mkdtemp(join(tmpdir(), 'catalog-preview-test-'))
    try {
      await externalizeDataImages(canvasJson, directory)
      const first = canvasJson.objects[0] as any
      expect(first.src).toMatch(/^file:\/\//)
      // Mesma imagem vira um arquivo só, reaproveitado em todos os objetos.
      expect((canvasJson.objects[1] as any).objects[0].src).toBe(first.src)
      expect((canvasJson.objects[2] as any).fill.source).toBe(first.src)
      expect((canvasJson.objects[3] as any).src).toBe('https://exemplo/x.png')
      expect((await stat(fileURLToPath(first.src))).size).toBe(png.length)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('desenha com imagem embutida e não deixa diretório temporário', async () => {
    const image = 'data:image/png;base64,' + (await sharp({ create: { width: 400, height: 400, channels: 3, background: '#d40808' } }).png().toBuffer()).toString('base64')
    const before = new Set((await readdir(tmpdir())).filter(name => name.startsWith('catalog-preview-')))
    const bytes = await drawCatalogPreview({ kind: 'flyer', width: 1080, height: 1350, canvasJson: { version: '7.1.0', objects: [
      { type: 'Image', version: '7.1.0', left: 0, top: 0, width: 400, height: 400, scaleX: 2.7, scaleY: 3.375, src: image, originX: 'left', originY: 'top' }
    ] } })
    expect((await sharp(bytes).metadata()).format).toBe('webp')
    // Só os diretórios criados durante este desenho (outros testes podem desenhar em paralelo).
    expect((await readdir(tmpdir())).filter(name => name.startsWith('catalog-preview-') && !name.startsWith('catalog-preview-test-') && !before.has(name))).toEqual([])
  }, 60_000)
})
