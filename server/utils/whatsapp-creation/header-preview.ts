import { createHash } from 'node:crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import type { CreationKind } from '~/shared/whatsapp-creation'
import type { ResolvedWhatsAppAccount } from './access'
import type { CreationHeader } from './catalog'
import { renderCreationHeaderPreview } from './render'
import { getS3Client } from '../s3'
import { videoBucket } from '../video-studio/service'

/** Reusable preview in this customer's namespace; no project/job/paid call. */
export async function prepareCreationHeader(header: CreationHeader, kind: CreationKind, account: ResolvedWhatsAppAccount): Promise<CreationHeader> {
  if (header.headerKey || header.previewUrl) return header
  const png = await renderCreationHeaderPreview(header, kind, account.user, account.businessProfile)
  const hash = createHash('sha256').update(png).digest('hex')
  const key = `whatsapp-creation/${account.user.id}/headers/${hash}.png`
  await getS3Client().send(new PutObjectCommand({ Bucket: videoBucket(), Key: key, Body: png, ContentType: 'image/png' }))
  return { ...header, headerKey: key }
}
