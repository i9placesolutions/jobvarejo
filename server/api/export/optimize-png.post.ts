import sharp from 'sharp'
import { requireAuthenticatedUser } from '../../utils/auth'

// Apenas recompressão PNG: sem resize, paleta reduzida ou compressão com perda.
export default defineEventHandler(async (event) => {
  await requireAuthenticatedUser(event)
  const maxBytes = 50 * 1024 * 1024
  const length = Number(getHeader(event, 'content-length'))
  if (length > maxBytes) throw createError({ statusCode: 413, statusMessage: 'Arquivo muito grande' })
  if (!String(getHeader(event, 'content-type')).startsWith('image/png')) {
    throw createError({ statusCode: 415, statusMessage: 'Envie um PNG' })
  }
  const body = await readRawBody(event, false)
  if (!body?.length || body.length > maxBytes || !body.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    throw createError({ statusCode: 400, statusMessage: 'PNG inválido' })
  }
  const optimized = await sharp(body, { limitInputPixels: 140_000_000 })
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toBuffer()
  setHeader(event, 'content-type', 'image/png')
  setHeader(event, 'cache-control', 'no-store')
  return optimized.length < body.length ? optimized : body
})
