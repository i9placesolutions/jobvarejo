#!/usr/bin/env node
/**
 * Modelo de encarte novo no formato "cabeçalho com faixa" (o dos 41 modelos de 03/10, já corrigido):
 * arte do cabeçalho, faixa da validade no vão, campo de produtos claro, rodapé completo, 5 formatos.
 *
 *   node --env-file=.env scripts/flyer-templates/banded-campaign.mjs <snapshot> <spec.json> <saída>
 *
 * Parte de um modelo-base do snapshot (estrutura e campos dinâmicos) e troca só a identidade:
 * - fatias do fundo (campaign-bg-header/retail-field/footer) recortadas de uma arte do acervo;
 * - selo (replace-seal-lib: ocupa a altura do cabeçalho), recolorido antes se destoar da paleta;
 * - cores (mapa de/para em textos, ícones, painéis; imagens, cartões e zona de produtos ficam como estão).
 * Depois aplica as correções do formato (validity-gap-lib) e renderiza. Não grava nada: gera after/, png/,
 * assets.json (arquivos para subir) e report.json. A gravação (modelo novo) é o create-template.mjs.
 *
 * spec.json: { slug, name, baseProject, seal: "selo.png", background: "arte.jpg",
 *   header: { y: 0.52, h: 0.22 }, footer: { y: 0.93, h: 0.05 },  // frações da altura da arte (centro e altura)
 *   field: { from: "#fbf6ff", to: "#efe1ff", line: "#c58cff" }, colors: { "#171819": "#1c0b33", ... } }
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import sharp from 'sharp'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { replaceSeal, bounds } from './replace-seal-lib.mjs'
import { fixCampaignHeader } from './validity-gap-lib.mjs'
import { renderer, RUNTIME_OUT } from './renderer.mjs'

const [snapshotDir, specFile, outDir] = process.argv.slice(2)
if (!snapshotDir || !specFile || !outDir) {
  console.error('Uso: banded-campaign.mjs <snapshot> <spec.json> <saída>')
  process.exit(1)
}
const spec = JSON.parse(await fs.readFile(specFile, 'utf8'))
const base = path.dirname(specFile)
const local = file => path.resolve(base, file)
const sha = buffer => createHash('sha256').update(buffer).digest('hex')
const { projects } = JSON.parse(await fs.readFile(`${snapshotDir}/projects.json`, 'utf8'))
const project = projects.find(p => p.id === spec.baseProject)
if (!project) throw Error(`Modelo-base ${spec.baseProject} não está no snapshot`)
await fs.mkdir(`${outDir}/after`, { recursive: true })
await fs.mkdir(`${outDir}/png`, { recursive: true })
await fs.mkdir(`${outDir}/assets`, { recursive: true })

const art = sharp(local(spec.background))
const artMeta = await art.metadata()
const assets = new Map() // chave → arquivo local
const addAsset = async (buffer, ext) => {
  const key = `templates/campanhas/${spec.slug}/${sha(buffer)}.${ext}`, file = `${outDir}/assets/${path.basename(key)}`
  await fs.writeFile(file, buffer)
  assets.set(key, path.resolve(file))
  return key
}
// Recorte da arte com a proporção da fatia, centrado na altura pedida (fração da arte), 2× para nitidez.
const slice = async (box, band) => {
  const w = Math.round(Math.min(box.width * 2, artMeta.width)), h = Math.max(1, Math.round(w * box.height / box.width))
  const cropH = Math.min(artMeta.height, Math.round(artMeta.width * box.height / box.width))
  const top = Math.max(0, Math.min(artMeta.height - cropH, Math.round(artMeta.height * band.y - cropH / 2)))
  const buffer = await sharp(local(spec.background)).extract({ left: 0, top, width: artMeta.width, height: cropH }).resize(w, h).jpeg({ quality: 88 }).toBuffer()
  return { key: await addAsset(buffer, 'jpg'), width: w, height: h }
}
// Campo de produtos claro: degradê suave e linhas finas só nas bordas (leitura dos produtos).
const field = async box => {
  const w = Math.round(box.width), h = Math.round(box.height), f = spec.field
  const lines = Array.from({ length: 14 }, (_, i) => `<line x1="${-h + i * 40}" y1="${h}" x2="${i * 40}" y2="0" stroke="${f.line}" stroke-width="2" opacity=".12"/>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${f.from}"/><stop offset="1" stop-color="${f.to}"/></linearGradient>
    <radialGradient id="m" cx=".5" cy=".5" r=".62"><stop offset=".72" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><mask id="k"><rect width="100%" height="100%" fill="#fff"/><rect width="100%" height="100%" fill="url(#m)"/></mask></defs>
    <rect width="100%" height="100%" fill="url(#g)"/><g mask="url(#k)">${lines}<g transform="translate(${w},0) scale(-1,1)">${lines}</g></g></svg>`
  const buffer = await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer()
  return { key: await addAsset(buffer, 'jpg'), width: w, height: h }
}
const recolor = (node, colors) => {
  if (!node || /^image$/i.test(node.type) || node.businessProfileField === 'footerPaymentImages' || node.isProductZone || node.isGridZone || node.name === 'gridZone') return
  for (const key of ['fill', 'stroke', 'dynamicFieldTextColor']) {
    const to = typeof node[key] === 'string' ? colors[node[key].toLowerCase()] : null
    if (to) node[key] = to
  }
  for (const child of node.objects || []) recolor(child, colors)
}
const colors = Object.fromEntries(Object.entries(spec.colors).map(([k, v]) => [k.toLowerCase(), v]))

const sealBuffer = await fs.readFile(local(spec.seal)), sealMeta = await sharp(sealBuffer).metadata()
const sealKey = `templates/campanhas/${spec.slug}/${sha(sealBuffer)}.png`
assets.set(sealKey, local(spec.seal))

if (process.env.FLYER_RUNTIME_READY !== '1') execFileSync('npx', ['esbuild', 'scripts/flyer-templates/runtime.ts', '--bundle', '--format=esm', '--platform=browser', `--outfile=${RUNTIME_OUT}`, '--log-level=warning'], { stdio: 'inherit' })
const s3 = new S3Client({ endpoint: `https://${process.env.WASABI_ENDPOINT.replace(/^https?:\/\//, '')}`, region: process.env.WASABI_REGION,
  credentials: { accessKeyId: process.env.WASABI_ACCESS_KEY, secretAccessKey: process.env.WASABI_SECRET_KEY } })
const fetchKey = async key => { const r = await s3.send(new GetObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key: key })); return { body: Buffer.from(await r.Body.transformToByteArray()), type: r.ContentType || 'application/octet-stream' } }

const pages = []
for (const page of project.pages) {
  const source = JSON.parse(await fs.readFile(`${snapshotDir}/pages/${page.file}.json`, 'utf8'))
  const width = page.width || source.width || 1080, height = page.height || source.height || 1350
  let canvas = structuredClone(source)
  // Arte própria do modelo-base que já estava oculta (fundos antigos, sobreposições, dobras) não vai para o novo.
  canvas.objects = canvas.objects.filter(o => !(o.visible === false && (/^image$/i.test(o.type) || /^economia-v2-fold/.test(o.name || '')) && !/^campaign-bg-/.test(o.name || '')))
  for (const o of canvas.objects) recolor(o, colors)
  // Fatias do fundo (feed/quadrado/stories/impressão) e as da TV (coluna da campanha, campo e rodapé).
  // O cabeçalho oculto no modelo-base (stories) volta a aparecer: a arte nova é recortada no tamanho dele.
  for (const o of canvas.objects.filter(o => /^campaign-bg-(tv-)?(header|campaign-column|retail-field|footer)$/.test(o.name || ''))) {
    if (o.name === 'campaign-bg-header') o.visible = true
    if (o.visible === false) continue
    const box = bounds(o)
    const made = /retail-field$/.test(o.name) ? await field(box) : await slice(box, /footer$/.test(o.name) ? spec.footer : spec.header)
    const src = `/api/storage/p?key=${encodeURIComponent(made.key)}`
    Object.assign(o, { src, __originalSrc: src, width: made.width, height: made.height, cropX: 0, cropY: 0, scaleX: box.width / made.width, scaleY: box.height / made.height, originX: 'left', originY: 'top', left: box.left, top: box.top })
  }
  const swapped = replaceSeal(canvas, { src: `/api/storage/p?key=${encodeURIComponent(sealKey)}`, width: sealMeta.width, height: sealMeta.height, pageWidth: width })
  if (!swapped.changes.length) throw Error(`Selo não trocado em ${page.format}: ${swapped.skipped}`)
  canvas = swapped.canvas
  const seal = canvas.objects.find(o => /^Selo 3D /.test(o.name || ''))
  Object.assign(seal, { name: `Selo 3D ${spec.name}`, layerName: `Selo 3D ${spec.name}` })
  canvas = fixCampaignHeader(canvas, width).canvas
  pages.push({ page, canvas, width, height })
}

const rr = await renderer(assets, fetchKey)
const report = []
try {
  for (const { page, canvas, width, height } of pages) {
    const rendered = await rr.render(canvas, width, height, page.format, {}, { persistValidity: true })
    await fs.writeFile(`${outDir}/after/${page.format}.json`, JSON.stringify(rendered.persisted))
    await fs.writeFile(`${outDir}/png/${page.format}.png`, rendered.png)
    report.push({ format: page.format, basePage: page.id, width, height, checks: rendered.checks })
    console.log('ok', page.format)
  }
} finally { await rr.close(); s3.destroy() }
await fs.writeFile(`${outDir}/assets.json`, JSON.stringify(Object.fromEntries(assets), null, 2))
await fs.writeFile(`${outDir}/report.json`, JSON.stringify({ spec, baseProject: project.id, baseName: project.name, pages: report }, null, 2))
console.log({ formatos: report.length, arquivos: assets.size })
