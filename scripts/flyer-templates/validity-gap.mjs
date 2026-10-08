#!/usr/bin/env node
/**
 * Plano (não grava) da validade no vão da arte — ver validity-gap-lib.mjs.
 *
 *   node --env-file=.env scripts/flyer-templates/validity-gap.mjs <snapshot> <saída> [--only=<id>,<id>]
 *
 * Saída no formato do lote de rodapé: <saída>/report.json, after/ e png/, para usar compare-sheet.mjs,
 * persist.mjs e revert.mjs.
 */
import fs from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { EXCLUDED_TEMPLATE_IDS } from '../standardize-flyer-template-dynamics.mjs'
import { moveValidityIntoGap } from './validity-gap-lib.mjs'
import { renderer, RUNTIME_OUT } from './renderer.mjs'

const [snapshotDir, outDir] = process.argv.slice(2)
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
if (!snapshotDir || !outDir) {
  console.error('Uso: validity-gap.mjs <snapshot> <saída> [--only=<id>,<id>]')
  process.exit(1)
}
if (process.env.FLYER_RUNTIME_READY !== '1') execFileSync('npx', ['esbuild', 'scripts/flyer-templates/runtime.ts', '--bundle', '--format=esm', '--platform=browser', `--outfile=${RUNTIME_OUT}`, '--log-level=warning'], { stdio: 'inherit' })

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
const onlyIds = arg('only') ? new Set(arg('only').split(',')) : null
const targets = projects.filter(p => !EXCLUDED_TEMPLATE_IDS.has(p.id) && (!onlyIds || onlyIds.has(p.id)))
await fs.mkdir(`${outDir}/after`, { recursive: true })
await fs.mkdir(`${outDir}/png`, { recursive: true })
const rr = await renderer(new Map(), fetchKey)
const report = []
try {
  for (const project of targets) {
    let touched = false
    for (const page of project.pages) {
      const source = JSON.parse(await fs.readFile(`${snapshotDir}/pages/${page.file}.json`, 'utf8'))
      const result = moveValidityIntoGap(source)
      const entry = { project: project.id, model: project.name, page: page.id, file: page.file, format: page.format, changes: result.changes, skipped: result.skipped || null }
      if (result.changes.length) {
        touched = true
        try {
          const width = page.width || source.width || 1080, height = page.height || source.height || 1350
          const rendered = await rr.render(result.canvas, width, height, page.format, {}, { persistValidity: true })
          await fs.writeFile(`${outDir}/after/${page.file}.json`, JSON.stringify(rendered.persisted))
          await fs.writeFile(`${outDir}/png/${page.file}.png`, rendered.png)
          entry.checks = rendered.checks
        } catch (error) { entry.error = String(error?.message || error).slice(0, 400) }
      }
      report.push(entry)
    }
    if (touched) console.log('ok', project.name)
  }
} finally { await rr.close(); s3.destroy() }
await fs.writeFile(`${outDir}/report.json`, JSON.stringify(report, null, 2))
const changed = report.filter(r => r.changes.length)
console.log({ modelos: new Set(changed.map(r => r.project)).size, paginas: changed.length, erros: report.filter(r => r.error).length })
