#!/usr/bin/env node
/**
 * Baixa (somente leitura) todos os modelos de encarte da biblioteca administrativa: metadados do
 * PostgreSQL e o JSON de cada página no Wasabi. Serve de cópia de segurança antes de qualquer lote
 * de padronização e de entrada para o inventário/ajuste.
 *
 * Uso: node --env-file=.env scripts/flyer-templates/snapshot.mjs <pasta-de-saída>
 * Saída: <pasta>/projects.json (metadados + revisão) e <pasta>/pages/<projeto>__<página>.json
 */
import fs from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import pg from 'pg'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

export const OWNER_ID = 'eb847e8e-7c19-4bee-8042-376528ce6192'
const out = process.argv[2]
if (!out) { console.error('Informe a pasta de saída.'); process.exit(1) }

const db = new pg.Client({ connectionString: process.env.POSTGRES_DATABASE_URL, connectionTimeoutMillis: 15000 })
const s3 = new S3Client({ endpoint: `https://${process.env.WASABI_ENDPOINT.replace(/^https?:\/\//, '')}`, region: process.env.WASABI_REGION,
  credentials: { accessKeyId: process.env.WASABI_ACCESS_KEY, secretAccessKey: process.env.WASABI_SECRET_KEY } })
const read = async Key => Buffer.from(await (await s3.send(new GetObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key }))).Body.transformToByteArray())
const decode = buffer => JSON.parse((buffer[0] === 0x1f && buffer[1] === 0x8b ? gunzipSync(buffer) : buffer).toString('utf8'))

await fs.mkdir(`${out}/pages`, { recursive: true })
await db.connect()
const projects = []
const errors = []
try {
  const rows = (await db.query(`select id, name, canvas_data, template_config, updated_at from projects
    where user_id=$1 and is_template=true order by name`, [OWNER_ID])).rows
  let index = 0
  for (const row of rows) {
    const pages = Array.isArray(row.canvas_data) ? row.canvas_data : []
    const entry = { id: row.id, name: row.name, updatedAt: row.updated_at, revision: createHash('sha256').update(JSON.stringify(row.canvas_data)).digest('hex'), pages: [] }
    for (const page of pages) {
      const file = `${row.id}__${page.id}`
      try {
        const canvas = page.canvasDataPath ? decode(await read(page.canvasDataPath)) : page.canvasData
        if (!canvas?.objects) throw Error('página sem canvas')
        await fs.writeFile(`${out}/pages/${file}.json`, JSON.stringify(canvas))
        entry.pages.push({ id: page.id, file, name: page.name, format: page.templateFormatId || null, width: page.width, height: page.height, canvasDataPath: page.canvasDataPath || null })
      } catch (error) { errors.push({ project: row.id, page: page.id, error: String(error?.message || error) }) }
    }
    projects.push(entry)
    if (++index % 25 === 0) console.log(`${index}/${rows.length} modelos`)
  }
} finally { await db.end(); s3.destroy() }
await fs.writeFile(`${out}/projects.json`, JSON.stringify({ capturedAt: new Date().toISOString(), owner: OWNER_ID, projects, errors }, null, 2))
console.log({ modelos: projects.length, paginas: projects.reduce((n, p) => n + p.pages.length, 0), erros: errors.length })
