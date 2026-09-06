import { requireAuthenticatedUser } from '~/server/utils/auth'
import { enforceRateLimit } from '~/server/utils/rate-limit'
import { pgOneOrNull } from '~/server/utils/postgres'
import { createDefaultProductCardConfiguration, normalizeProductCardConfiguration } from '~/utils/product-card-configuration'
import { ensureProductCardConfigurationsTable } from '~/server/utils/product-card-configurations'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `product-card-configuration:get:${user.id}`, 120, 60_000)

  try {
    await ensureProductCardConfigurationsTable()
    const row = await pgOneOrNull<{ configuration: unknown; updated_at: string | null }>(
      `select configuration, updated_at
         from public.product_card_configurations
        where user_id = $1
        limit 1`,
      [user.id]
    )

    return {
      configuration: normalizeProductCardConfiguration(
        row?.configuration ?? createDefaultProductCardConfiguration()
      ),
      updatedAt: row?.updated_at ?? null
    }
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Nao foi possivel carregar a configuracao dos cards.'
    })
  }
})
