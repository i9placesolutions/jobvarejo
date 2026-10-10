import { requireAdminUser } from '../../../utils/auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgQuery } from '../../../utils/postgres'
import { BUILDER_COUNT_TABLES, buildBuilderCountsQuery, type BuilderCounts } from '../../../utils/builder-counts'

export default defineEventHandler(async event => {
  const { user } = await requireAdminUser(event)
  await enforceRateLimit(event, `admin-builder-counts:${user.id}`, 120, 60_000)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  // Instalações parciais continuam mostrando os totais das tabelas disponíveis.
  const { rows: tables } = await pgQuery<{ name: string; available: boolean }>(
    `select name, to_regclass('public.' || name) is not null as available
       from unnest($1::text[]) as requested(name)`,
    [Object.values(BUILDER_COUNT_TABLES)],
  )
  const available = new Set(tables.filter(table => table.available).map(table => table.name))
  const { rows } = await pgQuery<BuilderCounts>(buildBuilderCountsQuery(available), [user.id])
  return { counts: rows[0] }
})
