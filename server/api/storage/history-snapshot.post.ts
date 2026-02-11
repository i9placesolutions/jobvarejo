import { CopyObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { requireAuthenticatedUser } from '../../utils/auth'
import { createSupabaseAdmin } from '../../utils/supabase'

type HistorySnapshotBody = {
  projectId?: string
  pageId?: string
  key?: string
}

const normalizeStorageKey = (input: string): string => {
  const raw = String(input || '').trim()
  if (!raw) return ''

  try {
    const parsed = new URL(raw, 'http://localhost')
    if (parsed.pathname.endsWith('/api/storage/proxy')) {
      const keyParam = String(parsed.searchParams.get('key') || '').trim()
      if (keyParam) return keyParam.replace(/^\/+/, '')
    }
  } catch {
    // fallback below
  }

  return raw.replace(/^\/+/, '')
}

const toCopySource = (bucket: string, key: string): string => {
  const encodedKey = key.split('/').map((segment) => encodeURIComponent(segment)).join('/')
  return `${bucket}/${encodedKey}`
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  const body = await readBody<HistorySnapshotBody>(event)
  const projectId = String(body?.projectId || '').trim()
  const pageId = String(body?.pageId || '').trim()

  if (!projectId || !pageId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'projectId and pageId are required'
    })
  }

  const endpoint = process.env.WASABI_ENDPOINT || 's3.wasabisys.com'
  const region = process.env.WASABI_REGION || 'us-east-1'
  const bucket = process.env.WASABI_BUCKET || 'jobvarejo'
  const accessKey = process.env.WASABI_ACCESS_KEY
  const secretKey = process.env.WASABI_SECRET_KEY

  if (!bucket || !accessKey || !secretKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Wasabi credentials are not configured'
    })
  }

  const admin: any = createSupabaseAdmin()
  const { data: projectRow, error: projectError } = await admin
    .from('projects')
    .select('id, user_id, canvas_data')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (projectError || !projectRow) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Project not found'
    })
  }

  const pages = Array.isArray(projectRow.canvas_data) ? projectRow.canvas_data : []
  const pageMeta = pages.find((page: any) => String(page?.id || '') === pageId) || null
  const defaultKey = `projects/${user.id}/${projectId}/page_${pageId}.json`
  const resolvedSourceKey = normalizeStorageKey(
    String(body?.key || '').trim() ||
    String(pageMeta?.canvasDataPath || '').trim() ||
    defaultKey
  )

  const allowedPrefix = `projects/${user.id}/${projectId}/`
  if (!resolvedSourceKey.startsWith(allowedPrefix) || !resolvedSourceKey.endsWith('.json')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid source key for history snapshot'
    })
  }

  const s3 = new S3Client({
    endpoint: `https://${endpoint}`,
    region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey
    },
    forcePathStyle: true
  })

  try {
    const head = await s3.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: resolvedSourceKey
      })
    )
    if (Number(head.ContentLength || 0) <= 2) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Source object is empty, snapshot skipped'
      })
    }
  } catch (error: any) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Source object not found for history snapshot'
      })
    }
    if (error?.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || 'Failed to validate source object for snapshot'
    })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const historyKey = `projects/${user.id}/${projectId}/history/page_${pageId}/${timestamp}.json`

  await s3.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: toCopySource(bucket, resolvedSourceKey),
      Key: historyKey,
      ACL: 'public-read',
      ContentType: 'application/json',
      MetadataDirective: 'COPY'
    })
  )

  const copiedAt = new Date().toISOString()
  console.log('🧾 [history-snapshot] Snapshot salvo no bucket', {
    projectId,
    pageId,
    userId: user.id,
    sourceKey: resolvedSourceKey,
    historyKey,
    copiedAt
  })

  return {
    ok: true,
    sourceKey: resolvedSourceKey,
    historyKey,
    copiedAt
  }
})
