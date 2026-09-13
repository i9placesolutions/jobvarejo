#!/usr/bin/env node
/**
 * Converte as miniaturas já salvas dos projetos em WebP leve.
 *
 * Uso:
 *   node scripts/optimize-project-thumbnails.mjs           # relatório, sem escrita
 *   node scripts/optimize-project-thumbnails.mjs --apply   # grava WebP e atualiza referências
 *   node scripts/optimize-project-thumbnails.mjs --templates-only --apply
 *
 * Os PNGs originais não são removidos. A atualização só troca a referência
 * depois que o novo objeto WebP foi salvo com sucesso no Wasabi.
 */
import 'dotenv/config'
import pg from 'pg'
import sharp from 'sharp'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const APPLY = process.argv.includes('--apply')
const TEMPLATES_ONLY = process.argv.includes('--templates-only')
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='))
const PROJECT_LIMIT = limitArg ? Number.parseInt(limitArg.slice('--limit='.length), 10) : null
const MAX_CONCURRENT_IMAGES = 5
const THUMBNAIL_MAX_DIMENSION = 480
const WEBP_QUALITY = 76

const required = (name) => {
  const value = String(process.env[name] || '').trim()
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`)
  return value
}

const databaseUrl = required('POSTGRES_DATABASE_URL')
const bucket = required('WASABI_BUCKET')
const endpointRaw = required('WASABI_ENDPOINT')
const endpoint = /^https?:\/\//i.test(endpointRaw) ? endpointRaw : `https://${endpointRaw}`
const accessKeyId = required('WASABI_ACCESS_KEY')
const secretAccessKey = required('WASABI_SECRET_KEY')
const region = String(process.env.WASABI_REGION || 'us-east-1').trim() || 'us-east-1'

const pool = new pg.Pool({ connectionString: databaseUrl })
const s3 = new S3Client({
  region,
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
  maxAttempts: 2
})

const streamToBuffer = async (body) => {
  if (!body) return Buffer.alloc(0)
  if (Buffer.isBuffer(body)) return body
  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray())
  }
  const chunks = []
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

const normalizeKey = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null

  if (raw.startsWith('projects/')) return raw

  try {
    const url = new URL(raw, 'http://local')
    const proxyKey = url.searchParams.get('key')
    if (proxyKey) return decodeURIComponent(proxyKey).replace(/^\/+/, '')

    const pathname = decodeURIComponent(String(url.pathname || '')).replace(/^\/+/, '')
    if (pathname.startsWith('projects/')) return pathname
    if (pathname.startsWith(`${bucket}/projects/`)) return pathname.slice(bucket.length + 1)
  } catch {
    // Uma referência inválida é ignorada e continua apontando para o arquivo atual.
  }

  return null
}

const isProjectImageKey = (key) => (
  /^projects\/[0-9a-f-]{36}\//i.test(String(key || '')) &&
  /\.(?:avif|gif|jpe?g|png|webp)$/i.test(String(key || ''))
)

const optimizedKeyFor = (sourceKey) => sourceKey.replace(/\.[^./]+$/, '.preview.webp')

const getPages = (canvasData) => {
  if (Array.isArray(canvasData)) return canvasData
  if (canvasData && typeof canvasData === 'object' && Array.isArray(canvasData.pages)) return canvasData.pages
  return []
}

const cloneJson = (value) => JSON.parse(JSON.stringify(value))

const createLimiter = (maxConcurrent) => {
  let active = 0
  const queue = []
  const next = () => {
    if (active >= maxConcurrent) return
    const task = queue.shift()
    if (!task) return
    active += 1
    void task()
  }
  return (run) => new Promise((resolve, reject) => {
    queue.push(async () => {
      try {
        resolve(await run())
      } catch (error) {
        reject(error)
      } finally {
        active -= 1
        next()
      }
    })
    next()
  })
}

const limitImageWork = createLimiter(MAX_CONCURRENT_IMAGES)
const optimizedSourcePromises = new Map()

const optimizeSourceKey = (sourceKey) => {
  const existing = optimizedSourcePromises.get(sourceKey)
  if (existing) return existing

  const task = limitImageWork(async () => {
    const source = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: sourceKey }))
    const input = await streamToBuffer(source.Body)
    if (!input.byteLength) throw new Error('Objeto de miniatura vazio')

    const output = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({
        width: THUMBNAIL_MAX_DIMENSION,
        height: THUMBNAIL_MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: WEBP_QUALITY, alphaQuality: 85, effort: 4 })
      .toBuffer()

    if (!output.byteLength || output.byteLength >= input.byteLength) {
      return { sourceKey, optimizedKey: null, sourceBytes: input.byteLength, optimizedBytes: input.byteLength }
    }

    const optimizedKey = optimizedKeyFor(sourceKey)
    if (APPLY) {
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: optimizedKey,
        Body: output,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable'
      }))
    }
    return { sourceKey, optimizedKey, sourceBytes: input.byteLength, optimizedBytes: output.byteLength }
  })

  optimizedSourcePromises.set(sourceKey, task)
  return task
}

const updateReference = (value, replacements) => {
  const key = normalizeKey(value)
  return key && replacements.get(key) ? replacements.get(key) : value
}

const processProject = async (project) => {
  const canvasData = cloneJson(project.canvas_data || [])
  const pages = getPages(canvasData)
  const sourceKeys = new Set()
  const collect = (value) => {
    const key = normalizeKey(value)
    if (key && isProjectImageKey(key) && !key.endsWith('.preview.webp')) sourceKeys.add(key)
  }

  collect(project.preview_url)
  for (const page of pages) {
    collect(page?.thumbnailUrl)
    collect(page?.thumbnail_url)
  }

  if (!sourceKeys.size) return { changed: false, optimized: [], skipped: 0 }

  const results = await Promise.all([...sourceKeys].map(async (sourceKey) => {
    try {
      return await optimizeSourceKey(sourceKey)
    } catch (error) {
      return { sourceKey, error }
    }
  }))
  const replacements = new Map(results
    .filter((result) => result?.optimizedKey)
    .map((result) => [result.sourceKey, result.optimizedKey]))

  if (!replacements.size) {
    return {
      changed: false,
      optimized: results.filter((result) => result?.optimizedKey),
      skipped: results.filter((result) => !result?.optimizedKey).length,
      errors: results.filter((result) => result?.error)
    }
  }

  let changed = false
  for (const page of pages) {
    for (const field of ['thumbnailUrl', 'thumbnail_url']) {
      if (!page || !Object.prototype.hasOwnProperty.call(page, field)) continue
      const next = updateReference(page[field], replacements)
      if (next !== page[field]) {
        page[field] = next
        changed = true
      }
    }
  }
  const nextPreviewUrl = updateReference(project.preview_url, replacements)
  changed ||= nextPreviewUrl !== project.preview_url

  if (changed && APPLY) {
    await pool.query(
      `update public.projects
          set canvas_data = $1::jsonb,
              preview_url = $2,
              updated_at = updated_at
        where id = $3 and user_id = $4`,
      [JSON.stringify(canvasData), nextPreviewUrl || null, project.id, project.user_id]
    )
  }

  return {
    changed,
    optimized: results.filter((result) => result?.optimizedKey),
    skipped: results.filter((result) => !result?.optimizedKey && !result?.error).length,
    errors: results.filter((result) => result?.error)
  }
}

const main = async () => {
  const params = []
  const filters = [`canvas_data is not null`]
  if (TEMPLATES_ONLY) filters.push(`coalesce(is_template, false) = true`)
  let limitSql = ''
  if (Number.isFinite(PROJECT_LIMIT) && PROJECT_LIMIT > 0) {
    params.push(Math.floor(PROJECT_LIMIT))
    limitSql = ` limit $${params.length}`
  }

  const { rows } = await pool.query(
    `select id, user_id, canvas_data, preview_url
       from public.projects
      where ${filters.join(' and ')}
      order by updated_at desc${limitSql}`,
    params
  )

  console.log(`[thumbnails] ${APPLY ? 'Aplicando' : 'Simulando'} otimização em ${rows.length} projetos${TEMPLATES_ONLY ? ' modelo' : ''}.`)

  let changedProjects = 0
  let optimizedImages = 0
  let sourceBytes = 0
  let optimizedBytes = 0
  let skipped = 0
  let errors = 0
  let completed = 0

  const projectLimiter = createLimiter(3)
  await Promise.all(rows.map((project) => projectLimiter(async () => {
    const result = await processProject(project)
    completed += 1
    if (result.changed) changedProjects += 1
    optimizedImages += result.optimized.length
    skipped += result.skipped
    errors += result.errors?.length || 0
    for (const image of result.optimized) {
      sourceBytes += image.sourceBytes || 0
      optimizedBytes += image.optimizedBytes || 0
    }
    if (completed % 25 === 0 || completed === rows.length) {
      console.log(`[thumbnails] ${completed}/${rows.length} projetos processados`)
    }
  })))

  const reduction = sourceBytes > 0 ? Math.round((1 - optimizedBytes / sourceBytes) * 100) : 0
  console.log(JSON.stringify({
    mode: APPLY ? 'apply' : 'dry-run',
    projects: rows.length,
    changedProjects,
    optimizedImages,
    skipped,
    errors,
    sourceBytes,
    optimizedBytes,
    reductionPercent: reduction
  }, null, 2))
}

try {
  await main()
} finally {
  await pool.end()
  s3.destroy()
}
