#!/usr/bin/env node
/**
 * Troca a etiqueta de preço dos modelos que usam uma etiqueta reprovada, variando pela cor de cada modelo
 * (ver replace-label-lib.mjs).
 *
 *   node --env-file=.env scripts/flyer-templates/replace-label.mjs <snapshot> <saída> <etiquetas.json> [--from=tpl_economia_mes_economia]
 *
 * <etiquetas.json>: etiquetas do banco [{ key, name, kind, group }] (as que o usuário enxerga).
 * Não grava nada: gera report.json, after/ e png/ (persist.mjs/revert.mjs) e sample/ (prévia com produtos).
 */
import fs from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import sharp from 'sharp'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { applyLabel, colorFamily, LABEL_POOL } from './replace-label-lib.mjs'
import { renderer, RUNTIME_OUT } from './renderer.mjs'

const [snapshotDir, outDir, labelsFile] = process.argv.slice(2).filter(a => !a.startsWith('--'))
const from = process.argv.find(a => a.startsWith('--from='))?.split('=')[1] || 'tpl_economia_mes_economia'
if (!snapshotDir || !outDir || !labelsFile) { console.error('Uso: replace-label.mjs <snapshot> <saída> <etiquetas.json> [--from=<id>]'); process.exit(1) }
const library = JSON.parse(await fs.readFile(labelsFile, 'utf8'))
const recipes = JSON.parse(await fs.readFile('shared/video-studio/generated-flyer-recipes.json', 'utf8'))
const { projects } = JSON.parse(await fs.readFile(`${snapshotDir}/projects.json`, 'utf8'))
const familiesDir = process.argv.find(a => a.startsWith('--families='))?.split('=')[1]
// Família pela imagem: matiz mais frequente entre os pixels saturados dos 40% de cima (cabeçalho e selo).
async function imageFamily(file) {
  const { data, info } = await sharp(file).resize(160).raw().toBuffer({ resolveWithObject: true })
  const rows = Math.round(info.height * .4), votes = {}
  let dark = 0, total = 0
  for (let i = 0; i < info.width * rows; i++) {
    const [r, g, b] = [data[i * info.channels], data[i * info.channels + 1], data[i * info.channels + 2]]
    const max = Math.max(r, g, b), min = Math.min(r, g, b); total++
    if (max < 60) { dark++; continue }
    if ((max - min) / max < .45) continue
    const f = colorFamily('#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''))
    if (f !== 'dark' && f !== 'light') votes[f] = (votes[f] || 0) + 1
  }
  const [best, n = 0] = Object.entries(votes).sort((a, b) => b[1] - a[1])[0] || []
  if (dark / total > .45 && n / total < .2) return 'dark'
  return best || 'light'
}
const zoneLabel = c => { const z = (c.objects || []).find(o => o.isProductZone || o.isGridZone); return z ? String(z._zoneGlobalStyles?.splashTemplateId || z._zoneTemplateSnapshotId || '') : null }

// Modelos com a etiqueta reprovada e escolha da etiqueta nova (alternando dentro da mesma família de cor).
const targets = []
for (const p of [...projects].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))) {
  const feed = p.pages.find(x => x.format === 'feed') || p.pages[0]
  if (zoneLabel(JSON.parse(await fs.readFile(`${snapshotDir}/pages/${feed.file}.json`, 'utf8'))) !== from) continue
  const r = recipes.find(x => x.sourceProject === p.id)
  // --families=<plano anterior>: cor real do modelo (matiz dominante do cabeçalho do feed renderizado).
  const prev = familiesDir && `${familiesDir}/png/${feed.file}.png`
  const family = prev && await fs.access(prev).then(() => true, () => false) ? await imageFamily(prev) : colorFamily(r?.base, r?.accent)
  targets.push({ project: p, family })
}
const used = {}
for (const t of targets) {
  const pool = LABEL_POOL[t.family], i = used[t.family] = (used[t.family] ?? -1) + 1
  t.label = library.find(x => x.key === pool[i % pool.length])
  if (!t.label) throw Error(`etiqueta ${pool[i % pool.length]} fora do banco`)
}

if (process.env.FLYER_RUNTIME_READY !== '1') execFileSync('npx', ['esbuild', 'scripts/flyer-templates/runtime.ts', '--bundle', '--format=esm', '--platform=browser', `--outfile=${RUNTIME_OUT}`, '--log-level=warning'], { stdio: 'inherit' })
const s3 = new S3Client({ endpoint: `https://${process.env.WASABI_ENDPOINT.replace(/^https?:\/\//, '')}`, region: process.env.WASABI_REGION,
  credentials: { accessKeyId: process.env.WASABI_ACCESS_KEY, secretAccessKey: process.env.WASABI_SECRET_KEY } })
const cache = new Map()
const fetchKey = async key => {
  if (!cache.has(key)) { const r = await s3.send(new GetObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key: key })); cache.set(key, { body: Buffer.from(await r.Body.transformToByteArray()), type: r.ContentType || 'application/octet-stream' }) }
  return cache.get(key)
}
// Produtos de exemplo só para a prévia (o modelo gravado continua sem produtos).
const productsRoot = 'output/rodrigues-carrinho-cheio-2026-10-05'
const catalog = (c => Array.isArray(c) ? c : c.products)(JSON.parse(await fs.readFile(`${productsRoot}/products.json`, 'utf8')))
const pool = []
for (const p of catalog) for (const ext of ['webp', 'png', 'jpg']) {
  const b = await sharp(`${productsRoot}/assets/${p.id}.${ext}`).png().toBuffer().catch(() => null)
  if (b) { pool.push({ id: p.id, name: p.name, brand: '', variant: '', weight: '', price: p.price, imageDataUrl: `data:image/png;base64,${b.toString('base64')}` }); break }
}
const sample = { feed: 9, square: 6, stories: 12, print: 9, tv: 8 }
for (const d of ['after', 'png', 'sample']) await fs.mkdir(`${outDir}/${d}`, { recursive: true })
const rr = await renderer(new Map(), fetchKey)
const report = []
try {
  for (const t of targets) {
    for (const page of t.project.pages) {
      const source = JSON.parse(await fs.readFile(`${snapshotDir}/pages/${page.file}.json`, 'utf8'))
      const width = page.width || source.width || 1080, height = page.height || source.height || 1350
      const result = applyLabel(source, t.label, library)
      const entry = { project: t.project.id, model: t.project.name, page: page.id, file: page.file, format: page.format, family: t.family, label: t.label.key, labelName: t.label.name, changes: result.changes }
      if (result.changes.length) {
        try {
          const rendered = await rr.render(result.canvas, width, height, page.format, {})
          await fs.writeFile(`${outDir}/after/${page.file}.json`, JSON.stringify(rendered.persisted))
          await fs.writeFile(`${outDir}/png/${page.file}.png`, rendered.png)
          if (page.format === 'feed') {
            const zone = result.canvas.objects.find(o => o.isProductZone || o.isGridZone)
            const withProducts = await rr.render(result.canvas, width, height, page.format, { [zone._customId]: pool.slice(0, sample[page.format] || 9) })
            await fs.writeFile(`${outDir}/sample/${t.project.id}.png`, withProducts.png)
          }
        } catch (error) { entry.error = String(error?.message || error).slice(0, 400) }
      }
      report.push(entry)
    }
    console.log('ok', t.family.padEnd(6), t.label.name, '|', t.project.name)
  }
} finally { await rr.close(); s3.destroy() }
await fs.writeFile(`${outDir}/report.json`, JSON.stringify(report, null, 2))
const changed = report.filter(r => r.changes.length)
const perLabel = {}; for (const t of targets) perLabel[t.label.name] = (perLabel[t.label.name] || 0) + 1
console.log({ modelos: targets.length, paginas: changed.length, erros: report.filter(r => r.error).length, porEtiqueta: perLabel })
