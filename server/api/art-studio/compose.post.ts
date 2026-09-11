import { z } from 'zod'
import { artUser, checkArtAssets } from '~/server/utils/art-studio'
import {
  artCompositionSchema,
  parseArtInput
} from '~/server/utils/art-studio-schema'
import { runArtPython } from '~/server/utils/art-studio-python'
import { enforceRateLimit } from '~/server/utils/rate-limit'
const schema = z.object({
  composition: artCompositionSchema,
  formats: z
    .array(
      z.object({
        width: z.number().int().min(320).max(4096),
        height: z.number().int().min(320).max(4096)
      })
    )
    .min(1)
    .max(8)
})
export default defineEventHandler(async (event) => {
  const user = await artUser(event)
  await enforceRateLimit(event, `art-compose:${user.id}`, 20, 60_000)
  const data = parseArtInput(schema, await readBody(event))
  await checkArtAssets(data.composition, user.id)
  const result = await runArtPython({ mode: 'compose', ...data })
  return {
    compositions: (result.compositions || []).map((doc) =>
      parseArtInput(artCompositionSchema, doc)
    ),
    engine: 'Pillow'
  }
})
