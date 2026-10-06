import { requireAdminUser } from '../../../utils/auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { warmAllCatalogPreviews } from '../../../utils/project-catalog-preview'

// Dispara a geração antecipada das prévias da biblioteca sem segurar a resposta.
export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  await enforceRateLimit(event, `catalog-previews-warm:${user.id}`, 3, 60_000)
  event.waitUntil(warmAllCatalogPreviews().catch((error: any) => {
    console.warn('[catalog-preview] Warm manual falhou:', String(error?.message || error))
  }))
  return { started: true }
})
