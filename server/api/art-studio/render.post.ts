import { readArtImage } from '~/server/utils/art-studio-image'
import { prepareArtLogo } from '~/server/utils/art-studio-logo'
import {
  hasArtLogoTreatment,
  artLayerImageSrc,
  artLogoOptions
} from '~/utils/art-studio/logo'
import { z } from 'zod'
import { zipSync } from 'fflate'
import { artUser, checkArtAssets } from '~/server/utils/art-studio'
import {
  artCompositionSchema,
  parseArtInput
} from '~/server/utils/art-studio-schema'
import { runArtPython } from '~/server/utils/art-studio-python'
import { enforceRateLimit } from '~/server/utils/rate-limit'
export default defineEventHandler(async (event) => {
  const user = await artUser(event)
  await enforceRateLimit(event, `art-render:${user.id}`, 10, 60_000)
  const data = parseArtInput(
    z.object({ compositions: z.array(artCompositionSchema).min(1).max(8) }),
    await readBody(event)
  )
  for (const doc of data.compositions) await checkArtAssets(doc, user.id)
  const sources = [
    ...new Set(
      data.compositions.flatMap((doc) =>
        doc.layers
          .filter((l) => l.visible && l.kind === 'image' && l.src)
          .map((l) => l.src!)
      )
    )
  ]
  if (sources.length > 30)
    throw createError({
      statusCode: 400,
      statusMessage: 'Exporte até 30 imagens diferentes por lote.'
    })
  const assets: Record<string, string> = {},
    rawImages = new Map<string, Buffer>()
  let bytes = 0
  for (const src of sources) {
    const raw = await readArtImage(
      src === '/api/art-studio/brand-logo' ? 'brand' : src.split('/').pop()!,
      user.id
    )
    bytes += raw.length
    if (bytes > 60 * 1024 * 1024)
      throw createError({
        statusCode: 413,
        statusMessage: 'As imagens do lote excedem 60 MB.'
      })
    rawImages.set(src, raw)
    assets[src] = raw.toString('base64')
  }
  // Browser e export Pillow recebem exatamente o mesmo trim/container/contorno.
  for (const doc of data.compositions)
    for (const layer of doc.layers) {
      if (!layer.visible || !layer.src || !hasArtLogoTreatment(layer)) continue
      const source = layer.src,
        key = artLayerImageSrc(layer)
      if (!assets[key])
        assets[key] = (
          await prepareArtLogo(rawImages.get(source)!, artLogoOptions(layer))
        ).toString('base64')
      layer.src = key
      layer.fit = 'contain'
    }
  const result = await runArtPython({
    mode: 'render',
    compositions: data.compositions,
    assets
  })
  if (!result.files?.length)
    throw createError({
      statusCode: 502,
      statusMessage: 'O motor não retornou a arte.'
    })
  if (result.files.length === 1) {
    setHeader(event, 'Content-Type', 'image/png')
    setHeader(
      event,
      'Content-Disposition',
      `attachment; filename="${result.files[0]!.name}"`
    )
    return result.files[0]!.buffer
  }
  setHeader(event, 'Content-Type', 'application/zip')
  setHeader(
    event,
    'Content-Disposition',
    'attachment; filename="artes-formatos.zip"'
  )
  return Buffer.from(
    zipSync(
      Object.fromEntries(result.files.map((file) => [file.name, file.buffer])),
      { level: 0 }
    )
  )
})
