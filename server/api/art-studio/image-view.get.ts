import { z } from 'zod'
import { artUser } from '~/server/utils/art-studio'
import { parseArtInput } from '~/server/utils/art-studio-schema'
import { readArtImage } from '~/server/utils/art-studio-image'
import { prepareArtLogo } from '~/server/utils/art-studio-logo'
export default defineEventHandler(async (event) => {
  const user = await artUser(event),
    data = parseArtInput(
      z.object({
        source: z.string().regex(/^(brand|[0-9a-f-]{36})$/),
        width: z.coerce.number().int().min(1).max(8192),
        height: z.coerce.number().int().min(1).max(8192),
        trim: z.enum(['true', 'false']),
        backdrop: z.enum(['none', 'square', 'round', 'oval']),
        padding: z.coerce.number().min(0).max(80),
        outline: z.enum(['true', 'false']),
        outlineColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        outlineWidth: z.coerce.number().min(1).max(40)
      }),
      getQuery(event)
    )
  const buffer = await readArtImage(data.source, user.id),
    output = await prepareArtLogo(buffer, {
      ...data,
      trim: data.trim === 'true',
      outline: data.outline === 'true'
    })
  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  return output
})
