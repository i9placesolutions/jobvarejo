import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { getS3Client } from '../../../../server/utils/s3'
import { requireSuperAdminUser } from '../../../../server/utils/auth'
import { enforceRateLimit } from '../../../../server/utils/rate-limit'
import {
  adminStorageBucket,
  assertAdminStorageKey,
  readAdminStorageText,
  signedAdminStoragePreviewUrl
} from '../../../../server/utils/admin-storage-manager'

const TEXT_EXTENSIONS = /\.(?:json|txt|md|csv|xml|ya?ml|html?|css|js|mjs|cjs|ts|vue|svg|sql|log)$/i
const isEditableText = (key: string, contentType?: string) => Boolean(
  key.toLowerCase().endsWith('.json.gz') ||
  contentType?.startsWith('text/') ||
  /^(?:application\/(?:json|xml|javascript|x-yaml|yaml)|image\/svg\+xml)(?:;|$)/i.test(contentType || '') ||
  TEXT_EXTENSIONS.test(key)
)

export default defineEventHandler(async (event) => {
  const user = await requireSuperAdminUser(event)
  await enforceRateLimit(event, `admin-storage-object-read:${user.id}`, 120, 60_000)
  const key = assertAdminStorageKey(getQuery(event).key)
  const bucket = adminStorageBucket()
  const s3 = getS3Client()
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
  const contentType = head.ContentType || 'application/octet-stream'

  if (isEditableText(key, contentType)) {
    if (Number(head.ContentLength || 0) <= 1024 * 1024) {
      try {
        const text = await readAdminStorageText(s3, bucket, key, head.ContentLength)
        return { key, ...text, editable: true }
      } catch (error: any) {
        if (Number(error?.statusCode) !== 413) throw error
      }
    }
  }

  return {
    key,
    size: Number(head.ContentLength || 0),
    lastModified: head.LastModified?.toISOString() || null,
    etag: head.ETag || null,
    contentType,
    editable: false,
    previewUrl: await signedAdminStoragePreviewUrl(s3, bucket, key)
  }
})
