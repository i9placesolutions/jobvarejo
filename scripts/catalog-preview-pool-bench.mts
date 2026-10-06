// Mede o travamento do processo principal ao desenhar uma prévia: worker thread × no próprio processo.
import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
const { drawCatalogPreviewIsolated } = await import('../server/utils/catalog-preview-pool.ts')
const { drawCatalogPreview } = await import('../server/utils/catalog-preview-draw.ts')
const canvasJson = JSON.parse(await readFile('output/campanhas-magnific-2026-10-06/out/mega-promocao/feed.json', 'utf8'))
const work = 'output/campanhas-magnific-2026-10-06/work/mega-promocao'
const dataUrl = async (file: string, type: string) => `data:${type};base64,${(await readFile(file)).toString('base64')}`
const bg = await dataUrl(`${work}/bg-feed.jpg`, 'image/jpeg'), seal = await dataUrl(`${work}/seal.png`, 'image/png')
const pixel = 'data:image/png;base64,' + (await sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer()).toString('base64')
// Fundo e selo reais da campanha; demais imagens (logo, ícones, cartões) transparentes como na prévia sem acesso ao storage.
const walk = (o: any) => { if (!o || typeof o !== 'object') return; for (const k of ['src', 'source']) if (typeof o[k] === 'string' && !o[k].startsWith('data:')) o[k] = /background-feed/.test(o[k]) ? bg : /seal/.test(o[k]) ? seal : pixel; for (const v of Object.values(o)) walk(v) }
walk(canvasJson)
const lag = async (label: string, run: () => Promise<Buffer>) => {
  let max = 0, last = Date.now()
  const t = setInterval(() => { const now = Date.now(); max = Math.max(max, now - last - 10); last = now }, 10)
  const start = Date.now(), bytes = await run()
  clearInterval(t)
  console.log(label, 'tempo', Date.now() - start, 'ms | maior travamento do processo principal', max, 'ms | webp', bytes.length, 'bytes')
  return bytes
}
const input = { kind: 'flyer' as const, canvasJson, width: 1080, height: 1350 }
await lag('aquecimento (worker)', () => drawCatalogPreviewIsolated(structuredClone(input)))
const a = await lag('worker thread', () => drawCatalogPreviewIsolated(structuredClone(input)))
await lag('aquecimento (inline)', () => drawCatalogPreview(structuredClone(input)))
await lag('no próprio processo', () => drawCatalogPreview(structuredClone(input)))
await writeFile(process.env.OUT!, a)
process.exit(0)
