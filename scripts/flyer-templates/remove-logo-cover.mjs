#!/usr/bin/env node
/**
 * Remove a placa branca fixa atrás da logo (camada `reference-logo-cover`) dos modelos de encarte.
 * O fundo da logo deve vir só da preferência do cliente (sem fundo / contorno / fundo próprio), nunca do modelo.
 *
 *   node --env-file=.env scripts/flyer-templates/remove-logo-cover.mjs <snapshot> <saída>
 *
 * Não grava nada: gera report.json, after/ e png/ (persist.mjs/revert.mjs). A faixa do Instagram
 * (`reference-social-cover`) é mantida — é o fundo de leitura do @ da loja.
 */
import fs from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { renderer, RUNTIME_OUT } from './renderer.mjs'

export const removeLogoCover = canvas => {
  const out = structuredClone(canvas), before = out.objects.length
  out.objects = out.objects.filter(o => o?.name !== 'reference-logo-cover')
  return { canvas: out, changes: before === out.objects.length ? [] : ['placa branca da logo removida'] }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [snapshotDir, outDir] = process.argv.slice(2)
  if (!snapshotDir || !outDir) { console.error('Uso: remove-logo-cover.mjs <snapshot> <saída>'); process.exit(1) }
  if (process.env.FLYER_RUNTIME_READY !== '1') execFileSync('npx', ['esbuild', 'scripts/flyer-templates/runtime.ts', '--bundle', '--format=esm', '--platform=browser', `--outfile=${RUNTIME_OUT}`, '--log-level=warning'], { stdio: 'inherit' })
  const s3 = new S3Client({ endpoint: `https://${process.env.WASABI_ENDPOINT.replace(/^https?:\/\//, '')}`, region: process.env.WASABI_REGION,
    credentials: { accessKeyId: process.env.WASABI_ACCESS_KEY, secretAccessKey: process.env.WASABI_SECRET_KEY } })
  const cache = new Map()
  const fetchKey = async key => {
    if (!cache.has(key)) { const r = await s3.send(new GetObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key: key })); cache.set(key, { body: Buffer.from(await r.Body.transformToByteArray()), type: r.ContentType || 'application/octet-stream' }) }
    return cache.get(key)
  }
  const { projects } = JSON.parse(await fs.readFile(`${snapshotDir}/projects.json`, 'utf8'))
  for (const d of ['after', 'png']) await fs.mkdir(`${outDir}/${d}`, { recursive: true })
  const rr = await renderer(new Map(), fetchKey)
  const report = []
  try {
    for (const project of projects) {
      for (const page of project.pages) {
        const source = JSON.parse(await fs.readFile(`${snapshotDir}/pages/${page.file}.json`, 'utf8'))
        const result = removeLogoCover(source)
        if (!result.changes.length) continue
        const entry = { project: project.id, model: project.name, page: page.id, file: page.file, format: page.format, changes: result.changes }
        try {
          const rendered = await rr.render(result.canvas, page.width || 1080, page.height || 1920, page.format, {})
          await fs.writeFile(`${outDir}/after/${page.file}.json`, JSON.stringify(rendered.persisted))
          await fs.writeFile(`${outDir}/png/${page.file}.png`, rendered.png)
        } catch (error) { entry.error = String(error?.message || error).slice(0, 400) }
        report.push(entry)
      }
    }
  } finally { await rr.close(); s3.destroy() }
  await fs.writeFile(`${outDir}/report.json`, JSON.stringify(report, null, 2))
  console.log({ modelos: new Set(report.map(r => r.project)).size, paginas: report.length, erros: report.filter(r => r.error).length })
}
