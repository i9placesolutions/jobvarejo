#!/usr/bin/env node
/**
 * Prancha antes/depois do plano de padronização: para cada página escolhida, a peça inteira
 * (antes e depois) e o rodapé ampliado. Renderiza o "antes" a partir do snapshot.
 * Uso: node --env-file=.env scripts/flyer-templates/compare-sheet.mjs <snapshot> <plano> <saída.jpg> [N=8] [formato=feed]
 */
import fs from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import sharp from 'sharp'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { renderer, RUNTIME_OUT } from './renderer.mjs'

const [snapshotDir, planDir, outFile, countArg = '8', format = 'feed'] = process.argv.slice(2)
execFileSync('npx', ['esbuild', 'scripts/flyer-templates/runtime.ts', '--bundle', '--format=esm', '--platform=browser', `--outfile=${RUNTIME_OUT}`, '--log-level=warning'], { stdio: 'inherit' })
const s3 = new S3Client({ endpoint: `https://${process.env.WASABI_ENDPOINT.replace(/^https?:\/\//, '')}`, region: process.env.WASABI_REGION,
  credentials: { accessKeyId: process.env.WASABI_ACCESS_KEY, secretAccessKey: process.env.WASABI_SECRET_KEY } })
const fetchKey = async key => { const r = await s3.send(new GetObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key: key })); return { body: Buffer.from(await r.Body.transformToByteArray()), type: r.ContentType || 'image/png' } }

const report = JSON.parse(await fs.readFile(`${planDir}/report.json`, 'utf8'))
const { projects } = JSON.parse(await fs.readFile(`${snapshotDir}/projects.json`, 'utf8'))
const pageMeta = new Map(projects.flatMap(p => p.pages.map(page => [page.file, page])))
// Uma página por modelo, priorizando variedade de mudanças.
const seen = new Set()
const picks = report.filter(r => r.format === format && r.changes.length && !r.error && !seen.has(r.project) && seen.add(r.project)).slice(0, Number(countArg))

const rr = await renderer(new Map(), fetchKey)
const W = 420, gap = 24, label = 56
const rows = []
try {
  for (const r of picks) {
    const meta = pageMeta.get(r.file), w = meta.width || 1080, h = meta.height || 1350
    const before = (await rr.render(JSON.parse(await fs.readFile(`${snapshotDir}/pages/${r.file}.json`, 'utf8')), w, h, r.format, {})).png
    const after = await fs.readFile(`${planDir}/png/${r.file}.png`)
    const pageH = Math.round(W * h / w)
    const footerTop = Math.round(h * .78)
    const crop = buf => sharp(buf).extract({ left: 0, top: footerTop, width: w, height: h - footerTop }).resize(W * 2 + gap).png().toBuffer()
    rows.push({ name: r.model, before: await sharp(before).resize(W, pageH).png().toBuffer(), after: await sharp(after).resize(W, pageH).png().toBuffer(),
      footBefore: await crop(before), footAfter: await crop(after), pageH, footH: Math.round((W * 2 + gap) * (h - footerTop) / w) })
  }
} finally { await rr.close(); s3.destroy() }

// Duas colunas de casos; cada caso: título, antes | depois, rodapé antes, rodapé depois.
const caseW = W * 2 + gap, cols = 2
const caseH = row => label + row.pageH + gap / 2 + 30 + row.footH + 30 + row.footH + gap
const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const text = (t, size, weight = 700, color = '#111') => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${caseW}" height="${size + 14}"><text x="0" y="${size}" font-family="Helvetica" font-weight="${weight}" font-size="${size}" fill="${color}">${esc(t)}</text></svg>`)
const comps = []
let y = [gap, gap]
for (const [i, row] of rows.entries()) {
  const col = i % cols, x = gap + col * (caseW + gap * 2)
  let top = y[col]
  comps.push({ input: text(row.name, 24), left: x, top })
  comps.push({ input: text('ANTES', 16, 700, '#a11'), left: x, top: top + 30 })
  comps.push({ input: text('DEPOIS', 16, 700, '#1a7f37'), left: x + W + gap, top: top + 30 })
  top += label
  comps.push({ input: row.before, left: x, top }, { input: row.after, left: x + W + gap, top })
  top += row.pageH + gap / 2
  comps.push({ input: text('Rodapé antes', 16, 600, '#a11'), left: x, top }); top += 30
  comps.push({ input: row.footBefore, left: x, top }); top += row.footH
  comps.push({ input: text('Rodapé depois', 16, 600, '#1a7f37'), left: x, top: top + 4 }); top += 30
  comps.push({ input: row.footAfter, left: x, top }); top += row.footH + gap
  y[col] = top
}
const width = gap + cols * (caseW + gap * 2), height = Math.max(...y) + gap
await sharp({ create: { width, height, channels: 3, background: '#eceef2' } }).composite(comps).jpeg({ quality: 86 }).toFile(outFile)
console.log(outFile, width, height, rows.length, 'casos')
