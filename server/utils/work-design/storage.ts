import { createHash } from 'node:crypto'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { createError } from 'h3'
import { getS3Client } from '../s3'
import { isPublicStorageKey, isStorageKeyAllowedForUser, isValidStoragePath } from '../storage-scope'

export function assertWorkImageKey(key: string, owner: string) {
  if (!isValidStoragePath(key) || !/\.(png|webp|jpe?g)$/i.test(key) ||
      !(isPublicStorageKey(key) || isStorageKeyAllowedForUser(key, owner)))
    throw createError({ statusCode: 403, statusMessage: 'Imagem fora do escopo da conta.' })
}
export const workBucket = () => String(useRuntimeConfig().wasabiBucket || process.env.WASABI_BUCKET || '')
export async function readWorkBytes(key: string) {
  const object = await getS3Client().send(new GetObjectCommand({ Bucket: workBucket(), Key: key }))
  if (Number(object.ContentLength || 0) > 12 * 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'Arquivo muito grande.' })
  const bytes = Buffer.from(await object.Body!.transformToByteArray())
  if (bytes.length > 12 * 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'Arquivo muito grande.' })
  return bytes
}
export async function writeWorkBytes(key: string, bytes: Buffer, mime: string) {
  await getS3Client().send(new PutObjectCommand({ Bucket: workBucket(), Key: key, Body: bytes, ContentType: mime }))
  const readback = await readWorkBytes(key)
  if (!readback.equals(bytes)) throw createError({ statusCode: 502, statusMessage: 'Falha na conferência do arquivo salvo.' })
}
export async function readWorkImage(key: string, owner: string) {
  assertWorkImageKey(key, owner)
  const bytes = await readWorkBytes(key)
  const sharp = (await import('sharp')).default
  const info = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata()
  if (!['png', 'jpeg', 'webp'].includes(String(info.format)) || !info.width || !info.height)
    throw createError({ statusCode: 422, statusMessage: 'Imagem inválida.' })
  return { bytes, width: info.width, height: info.height, dataUrl: `data:image/${info.format === 'jpeg' ? 'jpeg' : info.format};base64,${bytes.toString('base64')}` }
}
export async function stageWorkAsset(owner: string, job: string, base64: string) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length > 14_000_000)
    throw createError({ statusCode: 413, statusMessage: 'Envie PNG, JPG ou WebP de até 10 MB em base64.' })
  const bytes = Buffer.from(base64, 'base64')
  const sharp = (await import('sharp')).default
  const image = sharp(bytes, { limitInputPixels: 40_000_000 })
  const meta = await image.metadata()
  if (!['png', 'jpeg', 'webp'].includes(String(meta.format))) throw createError({ statusCode: 422, statusMessage: 'Tipo de imagem não permitido.' })
  const png = await image.png().toBuffer()
  if (png.length > 10 * 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'Imagem muito grande.' })
  const key = `projects/${owner}/work-assets/${job}/${createHash('sha256').update(png).digest('hex')}.png`
  await writeWorkBytes(key, png, 'image/png')
  return { key, width: meta.width, height: meta.height }
}
