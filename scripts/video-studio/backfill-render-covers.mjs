import pg from 'pg'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createVideoCover } from '../../workers/video-studio/cover.mjs'

const cfg = name => process.env[name] || process.env[`NUXT_${name}`] || ''
const option = name => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? String(process.argv[index + 1] || '') : ''
}
const positiveInteger = (value, fallback) => {
  const number = Number.parseInt(value, 10)
  return Number.isInteger(number) && number > 0 ? number : fallback
}

const userId = option('--user')
const apply = process.argv.includes('--apply')
const limit = positiveInteger(option('--limit'), 500)
const concurrency = Math.min(4, positiveInteger(option('--concurrency'), 2))

if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
  throw Error('Informe a conta alvo: --user <uuid>. O modo padrão é somente leitura; use --apply para gravar.')
}

const connectionString = cfg('POSTGRES_DATABASE_URL') || cfg('DATABASE_URL')
if (!connectionString) throw Error('Banco de dados não configurado.')
const endpoint = cfg('WASABI_ENDPOINT').replace(/^https?:\/\//, '')
if (!endpoint || !cfg('WASABI_ACCESS_KEY') || !cfg('WASABI_SECRET_KEY')) throw Error('Storage de vídeos não configurado.')

const pool = new pg.Pool({ connectionString, max: concurrency + 2 })
const storage = new S3Client({
  endpoint: `https://${endpoint}`,
  region: cfg('WASABI_REGION') || 'us-east-1',
  credentials: { accessKeyId: cfg('WASABI_ACCESS_KEY'), secretAccessKey: cfg('WASABI_SECRET_KEY') },
  forcePathStyle: true,
})
const bucket = cfg('WASABI_BUCKET') || 'jobvarejo'

const attachCover = async (row, coverAssetId) => {
  const result = await pool.query(`
    UPDATE public.video_studio_jobs job
    SET result = jsonb_set(
      job.result,
      '{outputs}',
      (
        SELECT jsonb_agg(
          CASE WHEN output->>'assetId'=$3
            THEN jsonb_set(output, '{coverAssetId}', to_jsonb($4::text), true)
            ELSE output
          END
          ORDER BY ordinal
        )
        FROM jsonb_array_elements(coalesce(job.result->'outputs','[]'::jsonb)) WITH ORDINALITY AS parts(output, ordinal)
      ),
      true
    ), updated_at=now()
    WHERE job.id=$1
      AND job.user_id=$2
      AND job.revision=$5
      AND job.kind='render'
      AND job.status='ready'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(coalesce(job.result->'outputs','[]'::jsonb)) output
        WHERE output->>'assetId'=$3
      )
  `, [row.job_id, row.user_id, row.render_asset_id, coverAssetId, row.revision])
  if (result.rowCount !== 1) throw Error('O render foi alterado enquanto a capa era preparada.')
}

const storedCover = async row => {
  const { rows } = await pool.query(`
    SELECT id
    FROM public.video_studio_assets
    WHERE user_id=$1
      AND kind='image'
      AND metadata->>'role'='render-cover'
      AND metadata->>'renderAssetId'=$2
    ORDER BY created_at DESC
    LIMIT 1
  `, [row.user_id, row.render_asset_id])
  return rows[0]?.id || ''
}

const createAndStoreCover = async row => {
  const directory = await mkdtemp(join(tmpdir(), 'jobvarejo-video-cover-'))
  try {
    const response = await storage.send(new GetObjectCommand({ Bucket: bucket, Key: row.storage_key }))
    if (!response.Body) throw Error('O render não foi encontrado no storage.')
    if (Number(response.ContentLength || 0) > 150 * 1024 * 1024) throw Error('O render excede o limite seguro de leitura.')
    const source = join(directory, 'render.mp4')
    const cover = join(directory, 'cover.jpg')
    await writeFile(source, Buffer.from(await response.Body.transformToByteArray()))
    const bytes = await createVideoCover(source, cover)
    const id = randomUUID()
    const key = `video-studio/${row.user_id}/assets/${id}.jpg`
    await storage.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: 'image/jpeg' }))
    await pool.query(`
      INSERT INTO public.video_studio_assets(id,user_id,kind,name,storage_key,content_type,bytes,duration,metadata)
      VALUES($1,$2,'image',$3,$4,'image/jpeg',$5,NULL,$6::jsonb)
    `, [
      id,
      row.user_id,
      `Capa do vídeo — ${row.format}`,
      key,
      bytes.length,
      JSON.stringify({ role: 'render-cover', jobId: row.job_id, revision: row.revision, format: row.format, renderAssetId: row.render_asset_id }),
    ])
    return id
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

try {
  const { rows } = await pool.query(`
    WITH current_outputs AS (
      SELECT DISTINCT ON (project.id)
        project.id AS project_id,
        project.user_id,
        project.revision,
        job.id AS job_id,
        output->>'assetId' AS render_asset_id,
        output->>'format' AS format,
        asset.storage_key
      FROM public.video_studio_projects project
      JOIN public.video_studio_jobs job
        ON job.project_id=project.id
       AND job.user_id=project.user_id
       AND job.revision=project.revision
       AND job.kind='render'
       AND job.status='ready'
      CROSS JOIN LATERAL jsonb_array_elements(coalesce(job.result->'outputs','[]'::jsonb)) output
      JOIN public.video_studio_assets asset ON asset.id::text=output->>'assetId' AND asset.user_id=project.user_id
      WHERE project.user_id=$1
        AND coalesce(output->>'assetId','')<>''
        AND coalesce(output->>'coverAssetId','')=''
      ORDER BY project.id, CASE WHEN output->>'format'='horizontal' THEN 0 ELSE 1 END, job.updated_at DESC
    )
    SELECT * FROM current_outputs
    ORDER BY project_id
    LIMIT $2
  `, [userId, limit])

  if (!apply) {
    console.log(JSON.stringify({ dryRun: true, projectsWithoutCover: rows.length, limit, concurrency }))
    process.exitCode = 0
  } else {
    const summary = { requested: rows.length, generated: 0, reused: 0, failed: 0 }
    let next = 0
    const startedAt = Date.now()
    const processRow = async row => {
      let coverAssetId = await storedCover(row)
      if (coverAssetId) summary.reused += 1
      else {
        coverAssetId = await createAndStoreCover(row)
        summary.generated += 1
      }
      await attachCover(row, coverAssetId)
    }
    const worker = async () => {
      while (next < rows.length) {
        const row = rows[next++]
        try {
          await processRow(row)
        } catch (error) {
          summary.failed += 1
          console.error('[video-cover-backfill] falha ao criar capa', String(error?.message || error))
        }
        const completed = summary.generated + summary.reused + summary.failed
        console.log(JSON.stringify({ completed, total: rows.length, generated: summary.generated, reused: summary.reused, failed: summary.failed }))
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, worker))
    console.log(JSON.stringify({ ...summary, elapsedMs: Date.now() - startedAt }))
    if (summary.failed) process.exitCode = 1
  }
} finally {
  await pool.end()
}
