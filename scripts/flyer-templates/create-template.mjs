#!/usr/bin/env node
/**
 * Cria o modelo de encarte novo gerado por banded-campaign.mjs (não altera o modelo-base).
 *
 *   node --env-file=.env scripts/flyer-templates/create-template.mjs <saída-do-banded> [--confirm]
 *
 * Sem --confirm só lê o modelo-base e mostra o que seria criado. Com --confirm: sobe arquivos e páginas
 * (leitura de volta), insere o projeto (is_template) copiando a configuração do modelo-base com nome,
 * páginas e selo novos e lê de volta. Variações de estrutura e vínculos de vídeo/cartaz do modelo-base
 * não são copiados (são da arte antiga). Grava <saída>/created.json com o id para conferir ou remover.
 */
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import pg from 'pg'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'

const dir = process.argv[2], confirm = process.argv.includes('--confirm')
if (!dir) { console.error('Uso: create-template.mjs <saída-do-banded> [--confirm]'); process.exit(1) }
const { spec, baseProject, pages: rendered } = JSON.parse(await fs.readFile(`${dir}/report.json`, 'utf8'))
const assets = JSON.parse(await fs.readFile(`${dir}/assets.json`, 'utf8'))
const sha = b => createHash('sha256').update(b).digest('hex')
const s3 = new S3Client({ endpoint: `https://${process.env.WASABI_ENDPOINT.replace(/^https?:\/\//, '')}`, region: process.env.WASABI_REGION,
  credentials: { accessKeyId: process.env.WASABI_ACCESS_KEY, secretAccessKey: process.env.WASABI_SECRET_KEY } })
const Bucket = process.env.WASABI_BUCKET
const read = async Key => Buffer.from(await (await s3.send(new GetObjectCommand({ Bucket, Key }))).Body.transformToByteArray())
const put = async (Key, Body, ContentType) => { await s3.send(new PutObjectCommand({ Bucket, Key, Body, ContentType })); assert.equal(sha(await read(Key)), sha(Body), `Leitura divergente em ${Key}`) }

const db = new pg.Client({ connectionString: process.env.POSTGRES_DATABASE_URL, connectionTimeoutMillis: 15000 })
await db.connect()
try {
  const base = (await db.query('select id, user_id, canvas_data, template_config from projects where id=$1 and is_template=true', [baseProject])).rows[0]
  assert.ok(base, 'Modelo-base não encontrado')
  const projectId = randomUUID(), owner = base.user_id, prefix = `projects/${owner}/${projectId}/pages`, savedAt = Date.now()
  // Id de modelo/tema próprio: com o do modelo-base o app agruparia os dois como o mesmo tema.
  const modelIds = new Map()
  const newModelId = old => { if (!old) return old; if (!modelIds.has(old)) modelIds.set(old, `${spec.slug}-${randomUUID().slice(0, 8)}`); return modelIds.get(old) }
  const sealKey = Object.keys(assets).find(k => k.endsWith('.png'))
  const pages = rendered.map(r => {
    const old = base.canvas_data.find(p => p.id === r.basePage)
    assert.ok(old, `Página-base ${r.basePage} ausente`)
    const id = randomUUID(), dataKey = `${prefix}/${id}.json.gz`, thumbKey = `${prefix}/${id}.webp`
    const page = { ...structuredClone(old), id, name: `${spec.name} · ${r.format}`, canvasDataPath: dataKey, thumbnailPath: thumbKey, thumbnailUrl: thumbKey, canvasSavedAt: savedAt }
    for (const key of ['templateModelName', 'templateThemeName']) if (key in page) page[key] = spec.name
    for (const key of ['templateModelId', 'templateThemeId']) if (page[key]) page[key] = newModelId(page[key])
    return { page, format: r.format, dataKey, thumbKey }
  })
  const config = structuredClone(base.template_config || {})
  delete config.structureBlueprints
  for (const key of Object.keys(config)) if (/video|poster|cartaz|linked/i.test(key)) delete config[key]
  if (Array.isArray(config.models)) config.models = config.models.map(m => ({ ...m, id: newModelId(m.id), name: spec.name }))
  if (config.defaultModelId) config.defaultModelId = newModelId(config.defaultModelId)
  if (Array.isArray(config.pageBlueprints)) config.pageBlueprints = pages.map(({ page }) => { const { id, ...rest } = page; return { ...rest, sourcePageId: id } })
  config.subcategory = spec.name.split(' — ')[0]
  config.assets = { ...(config.assets || {}), seal: sealKey }
  config.source = { ...(config.source || {}), bandedCampaign: { baseProject, slug: spec.slug, magnific: spec.magnific || null, createdAt: new Date().toISOString() } }

  console.log({ criar: projectId, nome: spec.name, modelos: Object.fromEntries(modelIds), dono: owner, paginas: pages.map(p => p.format), arquivos: Object.keys(assets).length, configuracao: Object.keys(config) })
  if (!confirm) { console.log('Simulação: nada gravado. Use --confirm.'); process.exit(0) }

  for (const [key, file] of Object.entries(assets)) await put(key, await fs.readFile(file), key.endsWith('.png') ? 'image/png' : 'image/jpeg')
  const sharp = (await import('sharp')).default
  for (const p of pages) {
    const canvas = JSON.parse(await fs.readFile(`${dir}/after/${p.format}.json`, 'utf8'))
    await put(p.dataKey, gzipSync(Buffer.from(JSON.stringify(canvas))), 'application/octet-stream')
    assert.deepEqual(JSON.parse(gunzipSync(await read(p.dataKey))), canvas)
    await put(p.thumbKey, await sharp(await fs.readFile(`${dir}/png/${p.format}.png`)).webp({ quality: 88 }).toBuffer(), 'image/webp')
  }
  const canvasData = pages.map(p => p.page), preview = (pages.find(p => p.format === 'feed') || pages[0]).thumbKey
  await db.query('insert into projects(id, user_id, name, canvas_data, preview_url, is_template, template_config, is_shared) values($1,$2,$3,$4::jsonb,$5,true,$6::jsonb,false)',
    [projectId, owner, spec.name, JSON.stringify(canvasData), preview, JSON.stringify(config)])
  const after = (await db.query('select canvas_data, template_config, is_template from projects where id=$1', [projectId])).rows[0]
  assert.deepEqual(after.canvas_data, canvasData)
  assert.deepEqual(after.template_config, config)
  assert.equal(after.is_template, true)
  await fs.writeFile(`${dir}/created.json`, JSON.stringify({ projectId, name: spec.name, owner, pages: canvasData.length, createdAt: new Date().toISOString() }, null, 2))
  console.log('CRIADO', projectId, spec.name, canvasData.length, 'páginas')
} finally { await db.end(); s3.destroy() }
