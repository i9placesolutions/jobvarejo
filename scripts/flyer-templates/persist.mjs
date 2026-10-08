#!/usr/bin/env node
/**
 * Grava o resultado de standardize.mjs (plan) nos modelos da biblioteca.
 *
 *   node --env-file=.env scripts/flyer-templates/persist.mjs <snapshot> <plano> --confirm [--only=<modelo>]
 *
 * Segurança:
 * - Sobe páginas e miniaturas em caminhos NOVOS no Wasabi (a versão anterior continua lá) e lê de volta.
 * - Antes de gravar, confere que o modelo não mudou desde o snapshot (hash do canvas_data); se mudou, pula.
 * - Atualiza páginas e template_config.pageBlueprints em UMA transação, com a mesma conferência no WHERE.
 * - Escreve <plano>/saved.json com o caminho anterior de cada página (para reverter, se preciso).
 */
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import sharp from 'sharp'
import pg from 'pg'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'

const [snapshotDir, planDir] = process.argv.slice(2)
const only = process.argv.find(a => a.startsWith('--only='))?.split('=')[1]
if (!snapshotDir || !planDir || !process.argv.includes('--confirm')) {
  console.error('Uso: persist.mjs <snapshot> <plano> --confirm [--only=<modelo>]')
  process.exit(1)
}
const sha = value => createHash('sha256').update(value).digest('hex')
const s3 = new S3Client({ endpoint: `https://${process.env.WASABI_ENDPOINT.replace(/^https?:\/\//, '')}`, region: process.env.WASABI_REGION,
  credentials: { accessKeyId: process.env.WASABI_ACCESS_KEY, secretAccessKey: process.env.WASABI_SECRET_KEY } })
const Bucket = process.env.WASABI_BUCKET
const get = async Key => Buffer.from(await (await s3.send(new GetObjectCommand({ Bucket, Key }))).Body.transformToByteArray())
const put = async (Key, Body, ContentType) => {
  await s3.send(new PutObjectCommand({ Bucket, Key, Body, ContentType }))
  assert.equal(sha(await get(Key)), sha(Body), `Leitura divergente em ${Key}`)
}

const snapshot = JSON.parse(await fs.readFile(`${snapshotDir}/projects.json`, 'utf8'))
const report = JSON.parse(await fs.readFile(`${planDir}/report.json`, 'utf8'))
assert.equal(report.filter(r => r.error).length, 0, 'O plano tem páginas com erro; corrija antes de gravar.')
const changed = report.filter(r => r.changes.length && (!only || r.project === only))
const byProject = Map.groupBy(changed, r => r.project)
const revision = `std-footer-${new Date().toISOString().slice(0, 10)}-${Date.now()}`

// Vários modelos em paralelo, cada um com a própria conexão (transação isolada por modelo).
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_DATABASE_URL, connectionTimeoutMillis: 15000, max: 6 })
const saved = [], skipped = []
// Registro incremental: se o processo parar, os caminhos anteriores já gravados continuam disponíveis para reverter.
const savedFile = `${planDir}/saved-${revision}.json`
const record = () => fs.writeFile(savedFile, JSON.stringify({ revision, savedAt: new Date().toISOString(), saved, skipped }, null, 2))

async function persistProject(projectId, pages) {
  const snap = snapshot.projects.find(p => p.id === projectId)
  const db = await pool.connect()
  try {
    // updated_at como texto: o Date do JavaScript perde os microssegundos e a comparação nunca bateria.
    const row = (await db.query('select id, user_id, canvas_data, template_config, updated_at::text as updated_at from projects where id=$1 and is_template=true', [projectId])).rows[0]
    if (!row || sha(JSON.stringify(row.canvas_data)) !== snap.revision) { skipped.push({ projectId, name: snap?.name, reason: 'modelo mudou desde o snapshot' }); console.log('pulado', snap?.name, '(mudou desde o snapshot)'); return }
    const canvasData = structuredClone(row.canvas_data), config = structuredClone(row.template_config)
    const previous = []
    for (const page of pages) {
      const target = canvasData.find(p => p.id === page.page)
      assert.ok(target, `Página ${page.page} não encontrada em ${projectId}`)
      const raw = await fs.readFile(`${planDir}/after/${page.file}.json`)
      const prefix = `projects/${row.user_id}/${projectId}/${revision}`
      const key = `${prefix}/${page.page}.json.gz`, thumb = `${prefix}/${page.page}.webp`
      await put(key, gzipSync(raw), 'application/octet-stream')
      assert.deepEqual(JSON.parse(gunzipSync(await get(key))), JSON.parse(raw))
      await put(thumb, await sharp(await fs.readFile(`${planDir}/png/${page.file}.png`)).webp({ quality: 88 }).toBuffer(), 'image/webp')
      previous.push({ page: page.page, canvasDataPath: target.canvasDataPath, thumbnailPath: target.thumbnailPath, thumbnailUrl: target.thumbnailUrl })
      Object.assign(target, { canvasDataPath: key, thumbnailPath: thumb, thumbnailUrl: thumb, canvasSavedAt: Date.now() })
      for (const blueprint of config?.pageBlueprints || []) if (blueprint.sourcePageId === target.id) {
        Object.assign(blueprint, { canvasDataPath: key, thumbnailPath: thumb, thumbnailUrl: thumb, canvasSavedAt: target.canvasSavedAt })
      }
    }
    const preview = (canvasData.find(p => p.templateFormatId === 'feed') || canvasData[0])?.thumbnailUrl
    await db.query('begin')
    try {
      const r = await db.query(`update projects set canvas_data=$1::jsonb, template_config=$2::jsonb, preview_url=$3, updated_at=now()
        where id=$4 and user_id=$5 and is_template=true and updated_at=$6::timestamptz and canvas_data=$7::jsonb returning updated_at`,
      [JSON.stringify(canvasData), JSON.stringify(config), preview, projectId, row.user_id, row.updated_at, JSON.stringify(row.canvas_data)])
      assert.equal(r.rowCount, 1, 'Alteração concorrente; nada gravado neste modelo.')
      await db.query("select pg_notify('project_changes',$1)", [JSON.stringify({ projectId, userId: row.user_id, action: 'updated', updatedAt: r.rows[0].updated_at.toISOString(), actorClientId: revision })])
      await db.query('commit')
    } catch (error) { await db.query('rollback'); skipped.push({ projectId, name: snap.name, reason: String(error.message) }); console.log('pulado', snap.name, String(error.message)); return }
    const back = (await db.query('select canvas_data from projects where id=$1', [projectId])).rows[0]
    assert.deepEqual(back.canvas_data, canvasData)
    saved.push({ projectId, name: snap.name, pages: pages.length, previous })
    await record()
    console.log('gravado', snap.name, pages.length, 'páginas')
  } finally { db.release() }
}

try {
  const queue = [...byProject]
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) { const [projectId, pages] = queue.shift(); await persistProject(projectId, pages) }
  }))
} finally { await pool.end(); s3.destroy(); await record() }
await fs.writeFile(`${planDir}/saved.json`, JSON.stringify({ revision, savedAt: new Date().toISOString(), saved, skipped }, null, 2))
console.log({ modelos: saved.length, paginas: saved.reduce((n, s) => n + s.pages, 0), pulados: skipped.length })
