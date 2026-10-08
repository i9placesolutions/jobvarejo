#!/usr/bin/env node
/**
 * Troca o selo 3D de modelos de encarte por artes novas (ver replace-seal-lib.mjs).
 *
 *   plan:   node --env-file=.env scripts/flyer-templates/replace-seal.mjs plan <snapshot> <saída> --map=<modelo>:<selo.png>,...
 *   upload: node --env-file=.env scripts/flyer-templates/replace-seal.mjs upload <saída> --map=...
 *
 * O plano não grava nada: as artes novas são servidas localmente ao renderizador com a chave definitiva
 * (templates/selos/<sha256>.png). Antes do persist.mjs, rode "upload" (caminhos novos, leitura de volta).
 * Saída no formato do lote de rodapé: report.json, after/ e png/ (compare/persist/revert).
 */
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import sharp from 'sharp'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { replaceSeal } from './replace-seal-lib.mjs'
import { renderer, RUNTIME_OUT } from './renderer.mjs'

const [mode, ...rest] = process.argv.slice(2).filter(a => !a.startsWith('--'))
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
const map = (arg('map') || '').split(',').filter(Boolean).map(pair => { const [project, file] = pair.split(':'); return { project, file } })
if (!['plan', 'upload'].includes(mode) || !map.length) {
  console.error('Uso: replace-seal.mjs plan <snapshot> <saída> --map=<modelo>:<selo.png>,... | upload <saída> --map=...')
  process.exit(1)
}
const s3 = new S3Client({ endpoint: `https://${process.env.WASABI_ENDPOINT.replace(/^https?:\/\//, '')}`, region: process.env.WASABI_REGION,
  credentials: { accessKeyId: process.env.WASABI_ACCESS_KEY, secretAccessKey: process.env.WASABI_SECRET_KEY } })
const Bucket = process.env.WASABI_BUCKET
const sha = buffer => createHash('sha256').update(buffer).digest('hex')
const seals = await Promise.all(map.map(async ({ project, file }) => {
  const body = await fs.readFile(file), meta = await sharp(body).metadata()
  return { project, file, body, key: `templates/selos/${sha(body)}.png`, width: meta.width, height: meta.height }
}))

if (mode === 'upload') {
  for (const seal of seals) {
    await s3.send(new PutObjectCommand({ Bucket, Key: seal.key, Body: seal.body, ContentType: 'image/png' }))
    const back = Buffer.from(await (await s3.send(new GetObjectCommand({ Bucket, Key: seal.key }))).Body.transformToByteArray())
    assert.equal(sha(back), sha(seal.body), `Leitura divergente em ${seal.key}`)
    console.log('enviado', seal.key, seal.file)
  }
  s3.destroy()
  process.exit(0)
}

const [snapshotDir, outDir] = rest
if (process.env.FLYER_RUNTIME_READY !== '1') execFileSync('npx', ['esbuild', 'scripts/flyer-templates/runtime.ts', '--bundle', '--format=esm', '--platform=browser', `--outfile=${RUNTIME_OUT}`, '--log-level=warning'], { stdio: 'inherit' })
const cache = new Map()
const fetchKey = async key => {
  if (!cache.has(key)) {
    const r = await s3.send(new GetObjectCommand({ Bucket, Key: key }))
    cache.set(key, { body: Buffer.from(await r.Body.transformToByteArray()), type: r.ContentType || 'application/octet-stream' })
  }
  return cache.get(key)
}
const { projects } = JSON.parse(await fs.readFile(`${snapshotDir}/projects.json`, 'utf8'))
await fs.mkdir(`${outDir}/after`, { recursive: true })
await fs.mkdir(`${outDir}/png`, { recursive: true })
const rr = await renderer(new Map(seals.map(seal => [seal.key, seal.file])), fetchKey)
const report = []
try {
  for (const seal of seals) {
    const project = projects.find(p => p.id === seal.project)
    assert.ok(project, `Modelo ${seal.project} não está no snapshot`)
    for (const page of project.pages) {
      const source = JSON.parse(await fs.readFile(`${snapshotDir}/pages/${page.file}.json`, 'utf8'))
      const width = page.width || source.width || 1080, height = page.height || source.height || 1350
      const result = replaceSeal(source, { src: `/api/storage/p?key=${encodeURIComponent(seal.key)}`, width: seal.width, height: seal.height, pageWidth: width })
      const entry = { project: project.id, model: project.name, page: page.id, file: page.file, format: page.format, changes: result.changes, skipped: result.skipped || null }
      if (result.changes.length) {
        try {
          const rendered = await rr.render(result.canvas, width, height, page.format, {})
          await fs.writeFile(`${outDir}/after/${page.file}.json`, JSON.stringify(rendered.persisted))
          await fs.writeFile(`${outDir}/png/${page.file}.png`, rendered.png)
        } catch (error) { entry.error = String(error?.message || error).slice(0, 400) }
      }
      report.push(entry)
    }
    console.log('ok', project.name)
  }
} finally { await rr.close(); s3.destroy() }
await fs.writeFile(`${outDir}/report.json`, JSON.stringify(report, null, 2))
const changed = report.filter(r => r.changes.length)
console.log({ modelos: new Set(changed.map(r => r.project)).size, paginas: changed.length, erros: report.filter(r => r.error).length, puladas: report.filter(r => !r.changes.length).map(r => `${r.model} ${r.format}: ${r.skipped}`) })
