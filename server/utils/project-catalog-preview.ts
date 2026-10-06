import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import type { H3Event } from 'h3'
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand
} from '@aws-sdk/client-s3'
import { bindAccountLogoToFlyerCanvas, getAccountFlyerLogoPreference, getAccountFlyerLogoSource } from '../../utils/accountFlyerTemplatePreview'
import {
  buildFlyerTemplateConfigFromPages,
  inferFormatIdFromPage,
  orderFlyerTemplatePages
} from '../../utils/flyerTemplateApi'
import { getFlyerGalleryPreviewKey } from './flyer-gallery-previews'
import { pgOneOrNull, pgQuery } from './postgres'
import { getS3Client } from './s3'
import { normalizeCatalogImageSource, resolveCatalogStorageKey, renderCatalogPreview, runCatalogPreviewTask, getCatalogPreviewRendererPolicy, getCatalogPreviewSha256 } from './catalog-preview-renderer'
import { resolveStorageReadUrl } from './project-storage-refs'

type CatalogProjectRow = {
  id: string
  user_id: string
  name: string
  is_template: boolean
  updated_at: string | Date
  canvas_data: any
  template_config: any
  owner_role: string | null
}

type Requester = { id: string }

type DynamicPreview = { key: string; sha256: string; revisionHash: string; public: boolean }

const RENDERER_POLICY = getCatalogPreviewRendererPolicy()
const MAX_CANVAS_STORAGE_BYTES = 12 * 1024 * 1024
const MAX_PREVIEW_BYTES = 8 * 1024 * 1024
const PREVIEW_HEAD_CACHE_TTL_MS = 45_000
const PREVIEW_HEAD_MISS_TTL_MS = 3_000
const previewHeadCache = new Map<string, { valid: boolean; expiresAt: number }>()

const timestamp = (value: unknown): string => {
  const date = value instanceof Date ? value : new Date(String(value || ''))
  return Number.isFinite(date.getTime()) ? date.toISOString() : ''
}

const sha256Text = (value: string): string => createHash('sha256').update(value).digest('hex')

const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

// O canvas_data é o campo mais pesado da linha. Com o cache da prévia válido ele
// não é usado, então só é lido quando a prévia realmente precisa ser desenhada.
const loadAuthorizedProject = async (
  projectId: string,
  requesterId: string,
  options: { withCanvas?: boolean } = {}
): Promise<CatalogProjectRow> => {
  const canvasColumns = options.withCanvas
    ? 'project.canvas_data, project.template_config'
    : 'null::jsonb as canvas_data, null::jsonb as template_config'
  const row = await pgOneOrNull<CatalogProjectRow>(
    `select project.id, project.user_id, project.name, project.is_template,
            project.updated_at, ${canvasColumns},
            owner.role as owner_role
       from public.projects project
       left join public.profiles owner on owner.id = project.user_id
      where project.id = $1
        and (
          project.user_id = $2
          or (project.is_template = true and owner.role in ('admin', 'super_admin'))
        )
      limit 1`,
    [projectId, requesterId]
  )
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Modelo não encontrado.' })
  return row
}

const loadProjectPages = (value: any): any[] => {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object' && Array.isArray(value.pages)) return value.pages
  return []
}

const readCanvasFromStorage = async (source: string, sourceOwnerId: string): Promise<any> => {
  const key = resolveCatalogStorageKey(source, sourceOwnerId, 'flyer')
  const config = useRuntimeConfig()
  const bucket = String(config.wasabiBucket || '').trim()
  if (!bucket) throw createError({ statusCode: 500, statusMessage: 'Wasabi Storage não configurado.' })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    const result = await getS3Client().send(new GetObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: controller.signal })
    if (!result.Body || Number(result.ContentLength || 0) > MAX_CANVAS_STORAGE_BYTES) {
      throw createError({ statusCode: 413, statusMessage: 'Canvas armazenado excede o limite da prévia.' })
    }
    let bytes = Buffer.from(await result.Body.transformToByteArray())
    if (!bytes.length || bytes.length > MAX_CANVAS_STORAGE_BYTES) {
      throw createError({ statusCode: 413, statusMessage: 'Canvas armazenado excede o limite da prévia.' })
    }
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = gunzipSync(bytes, { maxOutputLength: MAX_CANVAS_STORAGE_BYTES })
    if (!bytes.length || bytes.length > MAX_CANVAS_STORAGE_BYTES) {
      throw createError({ statusCode: 413, statusMessage: 'Canvas descompactado excede o limite da prévia.' })
    }
    const canvas = JSON.parse(bytes.toString('utf8'))
    if (!canvas || typeof canvas !== 'object' || Array.isArray(canvas)) throw new Error('Canvas armazenado inválido.')
    return canvas
  } catch (error: any) {
    if (error?.statusCode) throw error
    throw createError({ statusCode: 422, statusMessage: error?.message || 'Não foi possível ler o canvas do modelo.' })
  } finally {
    clearTimeout(timeout)
  }
}

const getDefaultCanvas = async (project: CatalogProjectRow): Promise<{ canvasJson: any; width: number; height: number }> => {
  const pages = loadProjectPages(project.canvas_data)
  if (!pages.length) throw createError({ statusCode: 422, statusMessage: 'Modelo sem páginas para a prévia.' })
  const config = buildFlyerTemplateConfigFromPages(project.template_config, pages, project.id)
  const ordered = orderFlyerTemplatePages(pages, config)
  const page = ordered.find(candidate => (
    String(candidate?.templateModelId || '').trim() === String(config.defaultModelId || '').trim() &&
    inferFormatIdFromPage(candidate) === config.defaultFormatId
  )) || ordered[0]
  if (!page) throw createError({ statusCode: 422, statusMessage: 'O modelo não tem uma página padrão.' })

  let canvas = page.canvasData ?? page.canvas_data
  if (typeof canvas === 'string') {
    try { canvas = JSON.parse(canvas) } catch { canvas = null }
  }
  if (!canvas && (page.canvasDataPath || page.canvas_data_path)) {
    canvas = await readCanvasFromStorage(String(page.canvasDataPath || page.canvas_data_path), project.user_id)
  }
  if (!canvas || typeof canvas !== 'object' || Array.isArray(canvas)) {
    throw createError({ statusCode: 422, statusMessage: 'Canvas da página padrão indisponível.' })
  }
  return {
    canvasJson: canvas,
    width: Number(page.width || canvas.width || 1080),
    height: Number(page.height || canvas.height || 1350)
  }
}

const getAccountProfile = async (requesterId: string): Promise<any> => {
  try {
    return await pgOneOrNull<any>(
      `select id, updated_at, business_profile from public.profiles where id = $1 limit 1`,
      [requesterId]
    )
  } catch (error: any) {
    if (String(error?.code || '') === '42703' && String(error?.message || '').includes('business_profile')) {
      return { id: requesterId, updated_at: null, business_profile: null }
    }
    throw error
  }
}

const getPersonalizationIdentity = (profile: any, requesterId: string): string => {
  const logoSource = getAccountFlyerLogoSource(profile)
  const logoPreference = getAccountFlyerLogoPreference(profile)
  return sha256Text(stableSerialize({
    accountId: requesterId,
    profileRevision: timestamp(profile?.updated_at),
    logoSource,
    logoPreference
  }))
}

const getPersonalizedCanvas = async (
  canvasJson: any,
  requesterId: string,
  expectedIdentity: string
): Promise<any> => {
  const profile = await getAccountProfile(requesterId)
  if (getPersonalizationIdentity(profile, requesterId) !== expectedIdentity) {
    throw createError({ statusCode: 409, statusMessage: 'O perfil mudou antes da prévia personalizada. Tente novamente.' })
  }
  const logoSource = getAccountFlyerLogoSource(profile)
  const logoPreference = getAccountFlyerLogoPreference(profile)
  let logoDataUrl = ''
  let logoSize: { width: number; height: number } | null = null
  if (logoSource) {
    try {
      const loaded = await normalizeCatalogImageSource(logoSource, requesterId, 'flyer')
      logoDataUrl = loaded.dataUrl
      logoSize = { width: loaded.width, height: loaded.height }
    } catch (error: any) {
      if (error?.statusCode === 403) throw error
      // A missing/broken account logo preserves the template without a logo.
      logoDataUrl = ''
      logoSize = null
    }
  }
  return bindAccountLogoToFlyerCanvas(canvasJson, {
      logoSrc: logoDataUrl,
      logoSize,
      logoPreference
    })
}

const dynamicKeyFor = (
  project: CatalogProjectRow,
  requesterId: string,
  revisionHash: string,
  personalize: boolean,
  accountIdentity?: string
): DynamicPreview => {
  const sharedAdminTemplate = project.is_template === true && ['admin', 'super_admin'].includes(String(project.owner_role || ''))
  if (sharedAdminTemplate && !personalize) {
    return {
      key: `imagens/catalogo-encartes/runtime-v1/${project.id}/${revisionHash}.webp`,
      sha256: revisionHash,
      revisionHash,
      public: true
    }
  }
  const identity = accountIdentity || 'neutral'
  const artifactHash = sha256Text(`${project.id}\n${revisionHash}\n${RENDERER_POLICY}\n${requesterId}\n${identity}`)
  return {
    key: `projects/${requesterId}/catalog-previews/flyers/${project.id}/${artifactHash}.webp`,
    sha256: artifactHash,
    revisionHash,
    public: false
  }
}

const cachedHead = async (key: string, revisionHash: string): Promise<boolean> => {
  const now = Date.now()
  const cached = previewHeadCache.get(key)
  if (cached && cached.expiresAt > now) return cached.valid
  const config = useRuntimeConfig()
  const bucket = String(config.wasabiBucket || '').trim()
  if (!bucket) throw createError({ statusCode: 500, statusMessage: 'Wasabi Storage não configurado.' })
  try {
    const head = await getS3Client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    const valid = Number(head.ContentLength || 0) > 0 &&
      Number(head.ContentLength || 0) <= MAX_PREVIEW_BYTES &&
      head.Metadata?.['renderer-policy'] === RENDERER_POLICY &&
      head.Metadata?.['source-revision'] === revisionHash &&
      /^[a-f0-9]{64}$/.test(String(head.Metadata?.sha256 || '')) &&
      String(head.ContentType || '').toLowerCase() === 'image/webp'
    if (!valid) throw createError({ statusCode: 502, statusMessage: 'Cache da prévia inconsistente.' })
    previewHeadCache.set(key, { valid: true, expiresAt: now + PREVIEW_HEAD_CACHE_TTL_MS })
    return true
  } catch (error: any) {
    if (error?.statusCode) throw error
    const missing = error?.name === 'NotFound' || error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404
    if (!missing) throw error
    previewHeadCache.set(key, { valid: false, expiresAt: now + PREVIEW_HEAD_MISS_TTL_MS })
    return false
  } finally {
    while (previewHeadCache.size > 256) previewHeadCache.delete(previewHeadCache.keys().next().value!)
  }
}

const resolvePreviewUrl = async (key: string, requesterId: string, isPublic: boolean, revisionHash: string): Promise<string> => {
  if (isPublic) {
    const proxy = await resolveStorageReadUrl(key, requesterId, { direct: false })
    if (!proxy) throw createError({ statusCode: 502, statusMessage: 'A URL pública da prévia não pôde ser criada.' })
    return `${proxy}&v=${revisionHash}`
  }
  const signed = await resolveStorageReadUrl(key, requesterId, { direct: true })
  if (!signed) throw createError({ statusCode: 502, statusMessage: 'A URL privada da prévia não pôde ser criada.' })
  return signed
}

const persistPreview = async (key: string, bytes: Buffer, meta: { revisionHash: string; sha256: string; isPublic: boolean }): Promise<void> => {
  const config = useRuntimeConfig()
  const bucket = String(config.wasabiBucket || '').trim()
  if (!bucket) throw createError({ statusCode: 500, statusMessage: 'Wasabi Storage não configurado.' })
  // O ContentMD5 faz o S3 recusar um upload corrompido; a confirmação por HEAD
  // basta, sem baixar a imagem inteira de volta.
  await getS3Client().send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: bytes,
    ContentType: 'image/webp',
    ContentLength: bytes.length,
    ContentMD5: createHash('md5').update(bytes).digest('base64'),
    CacheControl: meta.isPublic ? 'public, max-age=31536000, immutable' : 'private, max-age=31536000, immutable',
    Metadata: {
      sha256: meta.sha256,
      'source-revision': meta.revisionHash,
      'renderer-policy': RENDERER_POLICY
    }
  }))
  const head = await getS3Client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
  if (Number(head.ContentLength || 0) !== bytes.length || head.Metadata?.sha256 !== meta.sha256 || head.Metadata?.['renderer-policy'] !== RENDERER_POLICY) {
    throw createError({ statusCode: 502, statusMessage: 'A gravação da prévia não foi confirmada.' })
  }
  previewHeadCache.set(key, { valid: true, expiresAt: Date.now() + PREVIEW_HEAD_CACHE_TTL_MS })
}

const renderAndPersistProjectPreview = async (
  projectId: string,
  requesterId: string,
  revision: string,
  personalize: boolean,
  initialProject: CatalogProjectRow,
  initialRevisionHash: string,
  initialAccountIdentity?: string
): Promise<{ url: string; revision: string }> => {
  const initialArtifact = dynamicKeyFor(initialProject, requesterId, initialRevisionHash, personalize, initialAccountIdentity)
  const taskKey = initialArtifact.key
  return await runCatalogPreviewTask(taskKey, async () => {
    const project = await loadAuthorizedProject(projectId, requesterId, { withCanvas: true })
    if (String(project.user_id) !== String(initialProject.user_id) || timestamp(project.updated_at) !== revision) {
      throw createError({ statusCode: 409, statusMessage: 'O modelo mudou antes de a prévia ser renderizada. Atualize e tente novamente.' })
    }
    let { canvasJson, width, height } = await getDefaultCanvas(project)
    let accountIdentity = initialAccountIdentity
    if (personalize) {
      const personalized = await getPersonalizedCanvas(canvasJson, requesterId, String(initialAccountIdentity || ''))
      canvasJson = personalized
    }
    const revisionHash = sha256Text(`${revision}\n${RENDERER_POLICY}`)
    const artifact = dynamicKeyFor(project, requesterId, revisionHash, personalize, accountIdentity)
    if (await cachedHead(artifact.key, artifact.revisionHash)) {
      return { url: await resolvePreviewUrl(artifact.key, requesterId, artifact.public, revision), revision }
    }
    const bytes = await renderCatalogPreview({
      canvasJson,
      width,
      height,
      sourceOwnerId: project.user_id,
      kind: 'flyer',
      personalize,
      trustedTemplateAssets: project.is_template === true && ['admin', 'super_admin'].includes(String(project.owner_role || ''))
    })
    const sha256 = getCatalogPreviewSha256(bytes)
    await persistPreview(artifact.key, bytes, {
      revisionHash: artifact.revisionHash,
      sha256,
      isPublic: artifact.public
    })
    return { url: await resolvePreviewUrl(artifact.key, requesterId, artifact.public, revision), revision }
  })
}

/** Auth must be established by the caller before this function can reach any catalog cache. */
export const getProjectCatalogPreview = async (
  projectId: string,
  requester: Requester,
  personalize = false
): Promise<{ url: string; revision: string }> => {
  const project = await loadAuthorizedProject(projectId, requester.id)
  const revision = timestamp(project.updated_at)
  if (!revision) throw createError({ statusCode: 422, statusMessage: 'Revisão do modelo inválida.' })

  if (!personalize && project.is_template === true && ['admin', 'super_admin'].includes(String(project.owner_role || ''))) {
    const staticKey = getFlyerGalleryPreviewKey(project.id, project.updated_at)
    if (staticKey) {
      const url = await resolvePreviewUrl(staticKey, requester.id, true, sha256Text(revision))
      return { url, revision }
    }
  }

  const revisionHash = sha256Text(`${revision}\n${RENDERER_POLICY}`)
  let accountIdentity: string | undefined
  if (personalize) accountIdentity = getPersonalizationIdentity(await getAccountProfile(requester.id), requester.id)
  const artifact = dynamicKeyFor(project, requester.id, revisionHash, personalize, accountIdentity)
  if (await cachedHead(artifact.key, artifact.revisionHash)) {
    return {
      url: await resolvePreviewUrl(artifact.key, requester.id, artifact.public, revision),
      revision
    }
  }
  return await renderAndPersistProjectPreview(projectId, requester.id, revision, personalize, project, revisionHash, accountIdentity)
}

/** Enqueue after a real save. Nitro keeps it alive without delaying the save response. */
export const scheduleProjectCatalogPreviewWarm = (
  event: H3Event,
  projectId: string,
  ownerId: string,
  revisionValue: unknown
): void => {
  const revision = timestamp(revisionValue)
  if (!projectId || !ownerId || !revision) return
  const warm = (async () => {
    const project = await pgOneOrNull<CatalogProjectRow>(
      `select project.id, project.user_id, project.name, project.is_template,
              project.updated_at, null::jsonb as canvas_data, null::jsonb as template_config,
              owner.role as owner_role
         from public.projects project
         left join public.profiles owner on owner.id = project.user_id
        where project.id = $1 and project.user_id = $2 and project.is_template = true
        limit 1`,
      [projectId, ownerId]
    )
    if (!project || timestamp(project.updated_at) !== revision) return
    await getProjectCatalogPreview(projectId, { id: ownerId }, false)
  })().catch((error: any) => {
    console.warn('[catalog-preview] Warm da galeria falhou:', String(error?.statusMessage || error?.message || error))
  })
  event.waitUntil(warm)
}

let warmAllInFlight: Promise<{ total: number; ready: number; failed: number }> | null = null

/**
 * Gera com antecedência a prévia neutra de todos os modelos da biblioteca (dono admin).
 * Modelos com prévia válida custam só um HEAD; os demais são desenhados um a um,
 * deixando as outras vagas da fila livres para quem está navegando na galeria.
 */
export const warmAllCatalogPreviews = (): Promise<{ total: number; ready: number; failed: number }> => {
  if (warmAllInFlight) return warmAllInFlight
  warmAllInFlight = (async () => {
    const result = await pgQuery<{ id: string; user_id: string }>(
      `select project.id, project.user_id
         from public.projects project
         join public.profiles owner on owner.id = project.user_id
        where project.is_template = true
          and owner.role in ('admin', 'super_admin')
        order by project.updated_at desc`
    )
    const rows = result.rows
    let ready = 0
    let failed = 0
    for (const row of rows) {
      try {
        await getProjectCatalogPreview(String(row.id), { id: String(row.user_id) }, false)
        ready += 1
      } catch (error: any) {
        failed += 1
        console.warn(`[catalog-preview] Warm do modelo ${row.id} falhou:`, String(error?.statusMessage || error?.message || error))
      }
    }
    console.info(`[catalog-preview] Warm da biblioteca concluído: ${ready} prontas, ${failed} com falha (de ${rows.length}).`)
    return { total: rows.length, ready, failed }
  })().finally(() => { warmAllInFlight = null })
  return warmAllInFlight
}
