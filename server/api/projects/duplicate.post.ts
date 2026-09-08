import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand
} from '@aws-sdk/client-s3'
import { randomUUID } from 'node:crypto'
import { gunzipSync, gzipSync } from 'node:zlib'
import { requireAuthenticatedUser } from '../../utils/auth'
import { parseAndStringifyJsonbParam } from '../../utils/jsonb'
import { pgOneOrNull, pgTx } from '../../utils/postgres'
import { publishProjectChange } from '../../utils/project-realtime'
import { normalizeStoredStorageRef } from '../../utils/project-storage-refs'
import { enforceRateLimit } from '../../utils/rate-limit'
import { getS3Client } from '../../utils/s3'
import { ensureProjectTemplateColumn } from '../../utils/project-templates'
import { isUserProjectKey } from '../../utils/storage-scope'
import { clonePageCanvasDataWithFreshIds } from '~/utils/projectCanvasDuplication'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_PROJECT_NAME_LENGTH = 120
const MAX_CANVAS_BYTES = 60 * 1024 * 1024

const isUuid = (value: unknown): boolean => UUID_RE.test(String(value || '').trim())

const asProjectPages = (canvasData: any): any[] => {
  if (Array.isArray(canvasData)) return canvasData
  if (canvasData && typeof canvasData === 'object' && Array.isArray(canvasData.pages)) {
    return canvasData.pages
  }
  return []
}

const withProjectPages = (sourceCanvasData: any, pages: any[]): any => {
  if (Array.isArray(sourceCanvasData)) return pages
  if (sourceCanvasData && typeof sourceCanvasData === 'object' && Array.isArray(sourceCanvasData.pages)) {
    return { ...sourceCanvasData, pages }
  }
  return pages
}

const clonePlain = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const buildDuplicateName = (value: unknown): string => {
  const suffix = ' (cópia)'
  const raw = String(value || '').trim() || 'Projeto'
  const base = raw.slice(0, Math.max(1, MAX_PROJECT_NAME_LENGTH - suffix.length)).trimEnd() || 'Projeto'
  return `${base}${suffix}`
}

const streamToBuffer = async (body: any): Promise<Buffer> => {
  if (!body) throw new Error('Arquivo do canvas não encontrado no armazenamento.')
  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray())
  }
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of body) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    chunks.push(buffer)
    total += buffer.length
    if (total > MAX_CANVAS_BYTES) {
      throw createError({ statusCode: 413, statusMessage: 'Canvas do modelo é grande demais para duplicar.' })
    }
  }
  return Buffer.concat(chunks)
}

const parseStoredCanvas = (body: Buffer): any => {
  if (body.length > MAX_CANVAS_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Canvas do modelo é grande demais para duplicar.' })
  }
  const isGzip = body.length >= 2 && body[0] === 0x1f && body[1] === 0x8b
  const plain = isGzip
    ? gunzipSync(body, { maxOutputLength: MAX_CANVAS_BYTES })
    : body
  if (plain.length > MAX_CANVAS_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Canvas do modelo é grande demais para duplicar.' })
  }
  try {
    const parsed = JSON.parse(plain.toString('utf8'))
    if (!parsed || typeof parsed !== 'object') throw new Error('JSON inválido')
    return parsed
  } catch {
    throw createError({ statusCode: 422, statusMessage: 'Não foi possível ler o canvas do modelo original.' })
  }
}

const copySourceForS3 = (bucket: string, key: string): string => (
  `${bucket}/${key.split('/').map(segment => encodeURIComponent(segment)).join('/')}`
)

const getThumbnailExtension = (value: string): string => {
  const match = /\.([a-z0-9]{2,5})$/i.exec(value)
  const extension = match?.[1]
  return extension ? `.${extension.toLowerCase()}` : '.png'
}

const copyTemplateConfigForDuplicate = (
  rawConfig: any,
  duplicatedPages: any[],
  pageIdBySourceId: Map<string, string>,
  isTemplate: boolean
): any => {
  if ((!rawConfig || typeof rawConfig !== 'object') && !isTemplate) return rawConfig ?? null
  const config = rawConfig && typeof rawConfig === 'object'
    ? clonePlain(rawConfig)
    : { version: 1 }
  if (!isTemplate) return config

  // Uma cópia de modelo é independente: o vínculo de proveniência não pode
  // voltar ao modelo original depois de editar/salvar a cópia.
  delete config.sourceTemplateId

  const pagesById = new Map(duplicatedPages.map((page: any) => [String(page?.id || '').trim(), page]))
  if (Array.isArray(config.pageBlueprints)) {
    config.pageBlueprints = config.pageBlueprints.map((blueprint: any) => {
      const previousId = String(blueprint?.sourcePageId || blueprint?.id || '').trim()
      const nextId = pageIdBySourceId.get(previousId) || previousId
      const page = pagesById.get(nextId)
      const {
        canvasDataPath: _sourceCanvasDataPath,
        thumbnailUrl: _sourceThumbnailUrl,
        ...safeBlueprint
      } = blueprint || {}
      if (!page) return { ...safeBlueprint, sourcePageId: nextId }
      return {
        ...safeBlueprint,
        sourcePageId: page.id,
        name: page.name,
        width: page.width,
        height: page.height,
        type: page.type,
        ...(page.canvasDataPath ? { canvasDataPath: page.canvasDataPath } : {}),
        ...(page.thumbnailUrl ? { thumbnailUrl: page.thumbnailUrl } : {}),
        ...(page.templateModelId ? { templateModelId: page.templateModelId } : {}),
        ...(page.templateModelName ? { templateModelName: page.templateModelName } : {}),
        ...(page.templateFormatId ? { templateFormatId: page.templateFormatId } : {}),
        ...(page.templateFormatLabel ? { templateFormatLabel: page.templateFormatLabel } : {}),
        ...(page.templateThemeId ? { templateThemeId: page.templateThemeId } : {}),
        ...(page.templateThemeName ? { templateThemeName: page.templateThemeName } : {})
      }
    })
  } else {
    // Modelos legados ainda sem blueprints passam a ter referências próprias
    // já na cópia, em vez de depender dos caminhos do projeto original.
    config.pageBlueprints = copiedPagesToBlueprints(duplicatedPages)
  }
  return config
}

const copiedPagesToBlueprints = (pages: any[]) => pages.map((page: any, index: number) => ({
  sourcePageId: String(page?.id || '').trim() || `page-${index + 1}`,
  name: String(page?.name || `Página ${index + 1}`).trim() || `Página ${index + 1}`,
  width: Math.max(320, Math.round(Number(page?.width || 1080))),
  height: Math.max(320, Math.round(Number(page?.height || 1350))),
  type: page?.type === 'FREE_DESIGN' ? 'FREE_DESIGN' : 'RETAIL_OFFER',
  ...(String(page?.canvasDataPath || '').trim() ? { canvasDataPath: String(page.canvasDataPath).trim() } : {}),
  ...(String(page?.thumbnailUrl || '').trim() ? { thumbnailUrl: String(page.thumbnailUrl).trim() } : {}),
  ...(String(page?.templateModelId || '').trim() ? { templateModelId: String(page.templateModelId).trim() } : {}),
  ...(String(page?.templateModelName || '').trim() ? { templateModelName: String(page.templateModelName).trim() } : {}),
  ...(String(page?.templateFormatId || '').trim() ? { templateFormatId: String(page.templateFormatId).trim() } : {}),
  ...(String(page?.templateFormatLabel || '').trim() ? { templateFormatLabel: String(page.templateFormatLabel).trim() } : {}),
  ...(String(page?.templateThemeId || '').trim() ? { templateThemeId: String(page.templateThemeId).trim() } : {}),
  ...(String(page?.templateThemeName || '').trim() ? { templateThemeName: String(page.templateThemeName).trim() } : {})
}))

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `projects-duplicate:${user.id}`, 30, 60_000)
  const body = await readBody<Record<string, any>>(event)
  const sourceProjectId = String(body?.sourceProjectId || '').trim()
  if (!isUuid(sourceProjectId)) {
    throw createError({ statusCode: 400, statusMessage: 'Modelo de encarte inválido.' })
  }

  await ensureProjectTemplateColumn()
  const sourceProject = await pgOneOrNull<any>(
    `select id, name, canvas_data, template_config, folder_id, is_template
       from public.projects
      where id = $1
        and user_id = $2
      limit 1`,
    [sourceProjectId, user.id]
  )
  if (!sourceProject) {
    throw createError({ statusCode: 404, statusMessage: 'Modelo de encarte não encontrado.' })
  }

  const sourcePages = asProjectPages(sourceProject.canvas_data)
  if (!sourcePages.length) {
    throw createError({ statusCode: 422, statusMessage: 'Este modelo ainda não possui páginas para duplicar.' })
  }

  const config = useRuntimeConfig()
  const bucket = String(config.wasabiBucket || process.env.WASABI_BUCKET || process.env.NUXT_WASABI_BUCKET || '').trim()
  if (!bucket) {
    throw createError({ statusCode: 503, statusMessage: 'Armazenamento indisponível para duplicar o modelo.' })
  }

  const targetProjectId = randomUUID()
  const s3 = getS3Client()
  const writtenKeys: string[] = []
  const pageIdBySourceId = new Map<string, string>()
  const copiedPages: any[] = []

  try {
    for (let index = 0; index < sourcePages.length; index += 1) {
      const sourcePage = sourcePages[index] || {}
      const sourcePageId = String(sourcePage?.id || `page-${index + 1}`).trim() || `page-${index + 1}`
      const targetPageId = randomUUID()
      pageIdBySourceId.set(sourcePageId, targetPageId)

      const copiedPage: any = {
        id: targetPageId,
        name: String(sourcePage?.name || `Página ${index + 1}`).trim() || `Página ${index + 1}`,
        width: Math.max(320, Math.round(Number(sourcePage?.width || 1080))),
        height: Math.max(320, Math.round(Number(sourcePage?.height || 1350))),
        type: sourcePage?.type === 'FREE_DESIGN' ? 'FREE_DESIGN' : 'RETAIL_OFFER'
      }
      ;[
        'templateModelId',
        'templateModelName',
        'templateFormatId',
        'templateFormatLabel',
        'templateThemeId',
        'templateThemeName'
      ].forEach((key) => {
        const value = String(sourcePage?.[key] || '').trim()
        if (value) copiedPage[key] = value
      })
      if (sourcePage?.templateCompositionManaged === true) copiedPage.templateCompositionManaged = true
      if (!sourceProject.is_template) {
        const sourceTemplatePageId = String(sourcePage?.templateSourcePageId || '').trim()
        if (sourceTemplatePageId) copiedPage.templateSourcePageId = sourceTemplatePageId
      }

      let sourceCanvas = sourcePage?.canvasData
      if (!sourceCanvas || typeof sourceCanvas !== 'object') {
        const sourceCanvasKey = String(normalizeStoredStorageRef(sourcePage?.canvasDataPath) || '').trim()
        if (sourceCanvasKey) {
          if (!isUserProjectKey(sourceCanvasKey, user.id)) {
            throw createError({ statusCode: 403, statusMessage: 'Canvas do modelo fora do escopo permitido.' })
          }
          const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: sourceCanvasKey }))
          sourceCanvas = parseStoredCanvas(await streamToBuffer(response.Body))
        }
      }

      if (!sourceCanvas || typeof sourceCanvas !== 'object') {
        throw createError({
          statusCode: 422,
          statusMessage: `A página “${copiedPage.name}” ainda não tem um canvas salvo para duplicar.`
        })
      }

      const clonedCanvas = clonePageCanvasDataWithFreshIds(sourceCanvas)
      const savedAt = Date.now()
      clonedCanvas.__savedAt = savedAt
      const targetCanvasKey = `projects/${user.id}/${targetProjectId}/page_${targetPageId}.json`
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: targetCanvasKey,
        Body: gzipSync(JSON.stringify(clonedCanvas)),
        ContentType: 'application/octet-stream',
        CacheControl: 'no-store'
      }))
      writtenKeys.push(targetCanvasKey)
      copiedPage.canvasDataPath = targetCanvasKey
      copiedPage.canvasSavedAt = savedAt

      const sourceThumbnailKey = String(normalizeStoredStorageRef(sourcePage?.thumbnailUrl) || '').trim()
      if (sourceThumbnailKey && isUserProjectKey(sourceThumbnailKey, user.id)) {
        const targetThumbnailKey = `projects/${user.id}/${targetProjectId}/thumb_${targetPageId}${getThumbnailExtension(sourceThumbnailKey)}`
        try {
          await s3.send(new CopyObjectCommand({
            Bucket: bucket,
            Key: targetThumbnailKey,
            CopySource: copySourceForS3(bucket, sourceThumbnailKey)
          }))
          writtenKeys.push(targetThumbnailKey)
          copiedPage.thumbnailUrl = targetThumbnailKey
        } catch (thumbnailError) {
          // A prévia é derivada; não pode impedir a cópia do modelo editável.
          console.warn('[projects:duplicate] Thumbnail não copiado', { sourceProjectId, sourcePageId, thumbnailError })
        }
      }

      copiedPages.push(copiedPage)
    }

    const canvasData = withProjectPages(sourceProject.canvas_data, copiedPages)
    const templateConfig = copyTemplateConfigForDuplicate(
      sourceProject.template_config,
      copiedPages,
      pageIdBySourceId,
      sourceProject.is_template === true
    )
    const previewUrl = String(copiedPages[0]?.thumbnailUrl || '').trim() || null
    const inserted = await pgTx(async (client) => {
      const result = await client.query<any>(
        `insert into public.projects
           (id, name, canvas_data, preview_url, user_id, updated_at, folder_id, last_viewed, is_template, template_config)
         values
           ($1::uuid, $2, $3::jsonb, $4, $5::uuid, timezone('utc', now()), $6::uuid, timezone('utc', now()), $7, $8::jsonb)
         returning *`,
        [
          targetProjectId,
          buildDuplicateName(sourceProject.name),
          parseAndStringifyJsonbParam(canvasData, 'canvas_data'),
          previewUrl,
          user.id,
          sourceProject.folder_id || null,
          sourceProject.is_template === true,
          templateConfig == null ? null : parseAndStringifyJsonbParam(templateConfig, 'template_config')
        ]
      )
      return result.rows[0] || null
    })
    if (!inserted?.id) throw new Error('O banco não confirmou a cópia do modelo.')

    try {
      await publishProjectChange({
        projectId: String(inserted.id),
        userId: user.id,
        action: 'created',
        updatedAt: String(inserted.updated_at || new Date().toISOString()),
        actorClientId: String(getHeader(event, 'x-client-id') || '').trim() || null
      })
    } catch (notifyError) {
      console.warn('[projects:duplicate] Falha ao publicar atualização em tempo real', notifyError)
    }

    return { success: true, project: inserted }
  } catch (error: any) {
    if (writtenKeys.length > 0) {
      try {
        await s3.send(new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: writtenKeys.map(Key => ({ Key })), Quiet: true }
        }))
      } catch (cleanupError) {
        console.warn('[projects:duplicate] Não foi possível limpar arquivos da cópia incompleta', cleanupError)
      }
    }
    if (error?.statusCode) throw error
    const message = String(error?.message || '').trim() || 'Não foi possível duplicar o modelo de encarte.'
    console.error('[projects:duplicate] Falha ao duplicar projeto', { sourceProjectId, message })
    throw createError({ statusCode: 500, statusMessage: message })
  }
})
