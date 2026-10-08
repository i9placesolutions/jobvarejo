#!/usr/bin/env node
/**
 * Grava as variações de estrutura geradas por structures/build.mjs nos modelos da fábrica.
 * As variações ficam em template_config.structureBlueprints (o canvas_data do modelo não muda,
 * então abrir o modelo no editor continua igual). O gerador do WhatsApp lê essas variações.
 *
 *   node --env-file=.env scripts/flyer-templates/structures/persist.mjs <saída-do-build> --confirm [tema...]
 */
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import sharp from 'sharp'
import pg from 'pg'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'

const [outDir, ...rest] = process.argv.slice(2)
const only = rest.filter(a => !a.startsWith('--'))
if (!outDir || !process.argv.includes('--confirm')) { console.error('Uso: persist.mjs <saída-do-build> --confirm [tema...]'); process.exit(1) }
const sha = b => createHash('sha256').update(b).digest('hex')
const s3 = new S3Client({ endpoint: `https://${process.env.WASABI_ENDPOINT.replace(/^https?:\/\//, '')}`, region: process.env.WASABI_REGION,
  credentials: { accessKeyId: process.env.WASABI_ACCESS_KEY, secretAccessKey: process.env.WASABI_SECRET_KEY } })
const Bucket = process.env.WASABI_BUCKET
const get = async Key => Buffer.from(await (await s3.send(new GetObjectCommand({ Bucket, Key }))).Body.transformToByteArray())
const put = async (Key, Body, ContentType) => { await s3.send(new PutObjectCommand({ Bucket, Key, Body, ContentType })); assert.equal(sha(await get(Key)), sha(Body), `Leitura divergente em ${Key}`) }

const themes = (await fs.readdir(outDir, { withFileTypes: true })).filter(d => d.isDirectory() && (!only.length || only.includes(d.name))).map(d => d.name)
const db = new pg.Client({ connectionString: process.env.POSTGRES_DATABASE_URL, connectionTimeoutMillis: 15000 })
await db.connect()
const saved = [], skipped = []
try {
  for (const theme of themes) {
    const manifest = JSON.parse(await fs.readFile(`${outDir}/${theme}/manifest.json`, 'utf8').catch(() => 'null'))
    if (!manifest) continue
    // updated_at como texto: o Date do JavaScript perde os microssegundos e a comparação nunca bateria.
    const row = (await db.query('select id, user_id, template_config, updated_at::text as updated_at from projects where id=$1 and user_id=$2 and is_template=true', [manifest.projectId, manifest.owner])).rows[0]
    if (!row) { skipped.push({ theme, reason: 'modelo não encontrado' }); continue }
    for (const asset of manifest.assets) await put(asset.key, await fs.readFile(asset.file), asset.contentType)
    const blueprints = []
    for (const b of manifest.blueprints) {
      const raw = await fs.readFile(b.file)
      await put(b.canvasDataPath, gzipSync(raw), 'application/octet-stream')
      assert.deepEqual(JSON.parse(gunzipSync(await get(b.canvasDataPath))), JSON.parse(raw))
      await put(b.thumbnailPath, await sharp(await fs.readFile(b.preview)).webp({ quality: 86 }).toBuffer(), 'image/webp')
      blueprints.push({ structureId: b.structureId, structureName: b.structureName, formatId: b.formatId, width: b.width, height: b.height,
        canvasDataPath: b.canvasDataPath, thumbnailPath: b.thumbnailPath, canvasSavedAt: Date.now() })
    }
    const config = { ...(row.template_config || {}), structureBlueprints: blueprints, structuresRevision: manifest.revision }
    await db.query('begin')
    try {
      const r = await db.query(`update projects set template_config=$1::jsonb, updated_at=now()
        where id=$2 and user_id=$3 and is_template=true and updated_at=$4::timestamptz and template_config is not distinct from $5::jsonb`,
      [JSON.stringify(config), row.id, row.user_id, row.updated_at, JSON.stringify(row.template_config)])
      assert.equal(r.rowCount, 1, 'Alteração concorrente; nada gravado neste modelo.')
      await db.query('commit')
    } catch (error) { await db.query('rollback'); skipped.push({ theme, reason: String(error.message) }); continue }
    const back = (await db.query('select template_config from projects where id=$1', [row.id])).rows[0]
    assert.deepEqual(back.template_config.structureBlueprints, blueprints)
    saved.push({ theme, projectId: row.id, blueprints: blueprints.length })
    console.log('gravado', theme, blueprints.length, 'variações')
  }
} finally { await db.end(); s3.destroy() }
await fs.writeFile(`${outDir}/saved.json`, JSON.stringify({ savedAt: new Date().toISOString(), saved, skipped }, null, 2))
console.log({ temas: saved.length, pulados: skipped })
