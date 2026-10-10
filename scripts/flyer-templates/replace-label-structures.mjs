#!/usr/bin/env node
/**
 * Aplica nas variações de estrutura (template_config.structureBlueprints: Herói/Setores/Lateral) a mesma
 * etiqueta que replace-label.mjs escolheu para as páginas do modelo. Rodar DEPOIS do persist.mjs.
 *
 *   node --env-file=.env scripts/flyer-templates/replace-label-structures.mjs <plano> <etiquetas.json> [--confirm]
 *
 * Sem --confirm só mostra o que faria. Com --confirm: sobe cada variação em caminho NOVO no Wasabi (lê de volta)
 * e atualiza structureBlueprints numa transação conferindo updated_at. Grava <plano>/saved-structures.json
 * com os caminhos anteriores (para reverter).
 */
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import sharp from 'sharp'
import pg from 'pg'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { applyLabel } from './replace-label-lib.mjs'
import { renderer } from './renderer.mjs'

const [planDir, labelsFile] = process.argv.slice(2).filter(a => !a.startsWith('--'))
const confirm = process.argv.includes('--confirm')
if (!planDir || !labelsFile) { console.error('Uso: replace-label-structures.mjs <plano> <etiquetas.json> [--confirm]'); process.exit(1) }
const library = JSON.parse(await fs.readFile(labelsFile, 'utf8'))
const report = JSON.parse(await fs.readFile(`${planDir}/report.json`, 'utf8'))
const chosen = new Map(report.filter(r => r.changes.length).map(r => [r.project, r.label]))
const s3 = new S3Client({ endpoint: `https://${process.env.WASABI_ENDPOINT.replace(/^https?:\/\//, '')}`, region: process.env.WASABI_REGION,
  credentials: { accessKeyId: process.env.WASABI_ACCESS_KEY, secretAccessKey: process.env.WASABI_SECRET_KEY } })
const Bucket = process.env.WASABI_BUCKET
const sha = b => createHash('sha256').update(b).digest('hex')
const get = async Key => Buffer.from(await (await s3.send(new GetObjectCommand({ Bucket, Key }))).Body.transformToByteArray())
const put = async (Key, Body, ContentType) => { await s3.send(new PutObjectCommand({ Bucket, Key, Body, ContentType })); assert.equal(sha(await get(Key)), sha(Body), `Leitura divergente em ${Key}`) }
const cache = new Map()
const fetchKey = async key => { if (!cache.has(key)) { const r = await s3.send(new GetObjectCommand({ Bucket, Key: key })); cache.set(key, { body: Buffer.from(await r.Body.transformToByteArray()), type: r.ContentType || 'application/octet-stream' }) } return cache.get(key) }

const db = new pg.Client({ connectionString: process.env.POSTGRES_DATABASE_URL, connectionTimeoutMillis: 15000 })
await db.connect()
const rows = (await db.query(`select id, user_id, name, template_config, updated_at::text as updated_at from projects
  where is_template = true and id = any($1::uuid[]) and template_config ? 'structureBlueprints'`, [[...chosen.keys()]])).rows
console.log('modelos com variações de estrutura:', rows.length)
const rr = confirm ? await renderer(new Map(), fetchKey) : null
const saved = []
try {
  for (const row of rows) {
    const label = library.find(x => x.key === chosen.get(row.id))
    const config = structuredClone(row.template_config), revision = `labels-${new Date().toISOString().slice(0, 10)}`
    const previous = []
    for (const bp of config.structureBlueprints || []) {
      if (!bp?.canvasDataPath) continue
      let raw = await get(bp.canvasDataPath); if (raw[0] === 31 && raw[1] === 139) raw = gunzipSync(raw)
      const result = applyLabel(JSON.parse(raw), label, library)
      if (!result.changes.length) continue
      console.log(confirm ? 'gravando' : 'faria', row.name, bp.structureId, bp.formatId, '→', label.name)
      if (!confirm) continue
      const rendered = await rr.render(result.canvas, bp.width || 1080, bp.height || 1350, bp.formatId, {})
      const base = `projects/${row.user_id}/${row.id}/${revision}/${bp.structureId}-${bp.formatId}`
      const body = Buffer.from(JSON.stringify(rendered.persisted))
      await put(`${base}.json.gz`, gzipSync(body), 'application/octet-stream')
      assert.deepEqual(JSON.parse(gunzipSync(await get(`${base}.json.gz`))), rendered.persisted)
      await put(`${base}.webp`, await sharp(rendered.png).webp({ quality: 88 }).toBuffer(), 'image/webp')
      previous.push({ structureId: bp.structureId, formatId: bp.formatId, canvasDataPath: bp.canvasDataPath, thumbnailPath: bp.thumbnailPath })
      Object.assign(bp, { canvasDataPath: `${base}.json.gz`, thumbnailPath: `${base}.webp`, canvasSavedAt: Date.now() })
    }
    if (!confirm || !previous.length) continue
    await db.query('begin')
    try {
      const r = await db.query(`update projects set template_config = jsonb_set(template_config, '{structureBlueprints}', $1::jsonb), updated_at = now()
        where id = $2 and is_template = true and updated_at = $3::timestamptz returning template_config`, [JSON.stringify(config.structureBlueprints), row.id, row.updated_at])
      assert.equal(r.rowCount, 1, `${row.name} mudou durante o lote`)
      assert.deepEqual(r.rows[0].template_config.structureBlueprints, config.structureBlueprints)
      await db.query('commit')
    } catch (e) { await db.query('rollback'); throw e }
    saved.push({ project: row.id, name: row.name, label: label.key, previous })
    await fs.writeFile(`${planDir}/saved-structures.json`, JSON.stringify({ savedAt: new Date().toISOString(), saved }, null, 2))
  }
} finally { await rr?.close(); await db.end(); s3.destroy() }
console.log({ modelos: saved.length, variacoes: saved.reduce((n, s) => n + s.previous.length, 0) })
