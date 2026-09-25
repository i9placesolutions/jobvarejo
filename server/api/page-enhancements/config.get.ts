import { requireAuthenticatedUser } from '../../utils/auth'
import { enhancementApiKey, getAvailableEnhancementModels } from '../../utils/page-enhancement'
export default defineEventHandler(async event=>{
  await requireAuthenticatedUser(event)
  const configured = !!enhancementApiKey()
  const available = configured && (await getAvailableEnhancementModels()).length > 0
  return { configured, available }
})
