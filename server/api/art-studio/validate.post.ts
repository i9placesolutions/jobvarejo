import { artUser, checkArtAssets } from '~/server/utils/art-studio'
import {
  parseArtInput,
  artCompositionSchema
} from '~/server/utils/art-studio-schema'
export default defineEventHandler(async (event) => {
  const user = await artUser(event, true),
    composition = parseArtInput(artCompositionSchema, await readBody(event))
  await checkArtAssets(composition, user.id)
  return composition
})
