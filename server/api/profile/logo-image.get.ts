import { GetObjectCommand } from '@aws-sdk/client-s3'
import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { readLogoPreference } from '../../utils/logo-preference'
import { prepareArtLogo } from '../../utils/art-studio-logo'
import { getS3Client } from '../../utils/s3'
import { extractStorageKeyFromRef } from '../../../utils/storageRef'
import { isValidStoragePath, isStorageKeyAllowedForUser } from '../../utils/storage-scope'

export default defineEventHandler(async event => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `logo-image:${user.id}`, 240, 60_000)
  const config = useRuntimeConfig()
  const source = String(getQuery(event).source || '')
  let key = extractStorageKeyFromRef(source, { bucket: config.wasabiBucket, endpoint: config.wasabiEndpoint })
  if (!key) {
    try {
      const url = new URL(source, 'http://local')
      const candidate = url.pathname === '/api/storage/p' || url.pathname === '/api/storage/proxy'
        ? url.searchParams.get('key') || '' : decodeURIComponent(url.pathname).replace(/^\//, '')
      const withoutBucket = candidate.startsWith(`${config.wasabiBucket}/`) ? candidate.slice(String(config.wasabiBucket).length + 1) : candidate
      if (withoutBucket.startsWith('builder/')) key = withoutBucket
    } catch { /* Invalid references remain unavailable. */ }
  }
  if (!key || !isValidStoragePath(key) || !isStorageKeyAllowedForUser(key, user.id))
    throw createError({ statusCode: 403, statusMessage: 'Logo não disponível para esta conta.' })
  const preference = await readLogoPreference(user.id)
  const response = await getS3Client().send(new GetObjectCommand({ Bucket: config.wasabiBucket, Key: key }))
  if ((response.ContentLength || 0) > 10 * 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'Logo muito grande.' })
  const input = Buffer.from(await response.Body!.transformToByteArray())
  if (input.length > 10 * 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'Logo muito grande.' })
  const output = await prepareArtLogo(input, {
    width: 800, height: 600, trim: true, padding: 24, backdrop: 'none',
    outline: false, outlineColor: '#ffffff', outlineWidth: 4, ...preference
  })
  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'private, no-cache')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  return output
})
