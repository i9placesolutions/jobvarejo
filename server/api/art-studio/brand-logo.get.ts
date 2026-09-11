import { artUser } from '~/server/utils/art-studio'
import { readArtImage } from '~/server/utils/art-studio-image'
import { trimArtTransparency } from '~/server/utils/art-studio-logo'
export default defineEventHandler(async (event) => {
  const user = await artUser(event)
  const output = await trimArtTransparency(await readArtImage('brand', user.id))
  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  return output
})
