import { requireAuthenticatedUser } from '~/server/utils/auth'
import { enforceRateLimit } from '~/server/utils/rate-limit'
import { pgOneOrNull } from '~/server/utils/postgres'
import { parseAndStringifyJsonbParam } from '~/server/utils/jsonb'
import { normalizeProductCardConfiguration, createDefaultProductCardConfiguration } from '~/utils/product-card-configuration'
import { ensureProductCardConfigurationsTable } from '~/server/utils/product-card-configurations'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `product-card-configuration:put:${user.id}`, 60, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const configuration = normalizeProductCardConfiguration(
    body?.configuration ?? createDefaultProductCardConfiguration()
  )
  const configurationJson = parseAndStringifyJsonbParam(configuration, 'configuration')

  try {
    await ensureProductCardConfigurationsTable()
    const row = await pgOneOrNull<{ configuration: unknown; updated_at: string | null }>(
      `insert into public.product_card_configurations (user_id, configuration, updated_at)
       values ($1, $2::jsonb, timezone('utc', now()))
       on conflict (user_id) do update
         set configuration = excluded.configuration,
             updated_at = timezone('utc', now())
       returning configuration, updated_at`,
      [user.id, configurationJson]
    )

    return {
      configuration: normalizeProductCardConfiguration(row?.configuration ?? configuration),
      updatedAt: row?.updated_at ?? new Date().toISOString()
    }
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Nao foi possivel salvar a configuracao dos cards.'
    })
  }
})
