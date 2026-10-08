#!/usr/bin/env node
/**
 * Padroniza o rodapé de todos os modelos de encarte (docs/encartes-padrao-design.md).
 *
 * Etapa 1 — plano (não grava nada):
 *   node --env-file=.env scripts/flyer-templates/standardize.mjs plan <snapshot> <saída> [--only=<modelo>] [--sample=N]
 *   Lê o snapshot (snapshot.mjs), ajusta cada página, renderiza com o layout do app, grava
 *   <saída>/after/*.json, <saída>/png/*.png, <saída>/report.json e a prancha antes/depois.
 *
 * Etapa 2 — gravar (após aprovação): ver persist.mjs.
 *
 * Modelos que o cliente pediu para não mexer ficam fora (EXCLUDED_TEMPLATE_IDS).
 */
import fs from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import sharp from 'sharp'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { EXCLUDED_TEMPLATE_IDS } from '../standardize-flyer-template-dynamics.mjs'
import { standardizeFooter } from './standardize-lib.mjs'
import { renderer, RUNTIME_OUT } from './renderer.mjs'

const [mode, snapshotDir, outDir] = process.argv.slice(2)
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
if (mode !== 'plan' || !snapshotDir || !outDir) {
  console.error('Uso: standardize.mjs plan <snapshot> <saída> [--only=<id>] [--sample=N]')
  process.exit(1)
}

// Runtime do navegador compilado com o código atual do app (layout do rodapé, cartões, validade).
// Com lotes paralelos, compile antes e passe FLYER_RUNTIME_READY=1 para não sobrescrever o arquivo em uso.
if (process.env.FLYER_RUNTIME_READY !== '1') execFileSync('npx', ['esbuild', 'scripts/flyer-templates/runtime.ts', '--bundle', '--format=esm', '--platform=browser', `--outfile=${RUNTIME_OUT}`, '--log-level=warning'], { stdio: 'inherit' })

const donor = JSON.parse(await fs.readFile('output/operacao-fecha-mes-reference-2026-10-01/feed.json', 'utf8'))
const donorPaymentSlot = donor.objects.find(o => o.name === 'footer-payment-images')
if (!donorPaymentSlot) throw Error('Doador sem bloco de cartões.')

const s3 = new S3Client({ endpoint: `https://${process.env.WASABI_ENDPOINT.replace(/^https?:\/\//, '')}`, region: process.env.WASABI_REGION,
  credentials: { accessKeyId: process.env.WASABI_ACCESS_KEY, secretAccessKey: process.env.WASABI_SECRET_KEY } })
const cache = new Map()
const fetchKey = async key => {
  if (!cache.has(key)) {
    const r = await s3.send(new GetObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key: key }))
    cache.set(key, { body: Buffer.from(await r.Body.transformToByteArray()), type: r.ContentType || 'application/octet-stream' })
  }
  return cache.get(key)
}

const { projects } = JSON.parse(await fs.readFile(`${snapshotDir}/projects.json`, 'utf8'))
const only = arg('only'), sample = Number(arg('sample') || 0)
// --only aceita vários modelos separados por vírgula.
const onlyIds = only ? new Set(only.split(',')) : null
let targets = projects.filter(p => !EXCLUDED_TEMPLATE_IDS.has(p.id) && (!onlyIds || onlyIds.has(p.id)))
if (sample) targets = targets.filter((_, i) => i % Math.max(1, Math.floor(targets.length / sample)) === 0).slice(0, sample)
// --shard=i/n: divide os modelos entre processos paralelos (cada um com o próprio navegador).
const [shardIndex, shardCount] = (arg('shard') || '0/1').split('/').map(Number)
targets = targets.filter((_, i) => i % shardCount === shardIndex)
const reportFile = shardCount > 1 ? `${outDir}/report-${shardIndex}.json` : `${outDir}/report.json`

await fs.mkdir(`${outDir}/after`, { recursive: true })
await fs.mkdir(`${outDir}/png`, { recursive: true })
const rr = await renderer(new Map(), fetchKey)
const report = []
try {
  for (const project of targets) {
    for (const page of project.pages) {
      const source = JSON.parse(await fs.readFile(`${snapshotDir}/pages/${page.file}.json`, 'utf8'))
      const result = standardizeFooter(source, { format: page.format, donorPaymentSlot })
      const entry = { project: project.id, model: project.name, page: page.id, file: page.file, format: page.format, changes: result.changes, skipped: result.skipped || null }
      if (result.changes.length) {
        try {
          const width = page.width || source.width || 1080, height = page.height || source.height || 1350
          const rendered = await rr.render(result.canvas, width, height, page.format, {})
          await fs.writeFile(`${outDir}/after/${page.file}.json`, JSON.stringify(rendered.persisted))
          await fs.writeFile(`${outDir}/png/${page.file}.png`, rendered.png)
          entry.checks = rendered.checks
        } catch (error) { entry.error = String(error?.message || error).slice(0, 400) }
      }
      report.push(entry)
    }
    console.log('ok', project.name)
  }
} finally { await rr.close(); s3.destroy() }
await fs.writeFile(reportFile, JSON.stringify(report, null, 2))
const summary = report.reduce((acc, r) => {
  acc.paginas++
  if (r.error) acc.erros++
  else if (r.changes.length) acc.ajustadas++
  else acc[`sem mudança (${r.skipped || 'já no padrão'})`] = (acc[`sem mudança (${r.skipped || 'já no padrão'})`] || 0) + 1
  return acc
}, { paginas: 0, ajustadas: 0, erros: 0 })
console.log(summary)
