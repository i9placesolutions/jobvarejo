import { requireAuthenticatedUser } from '~/server/utils/auth'
import { enforceRateLimit } from '~/server/utils/rate-limit'
import { pgOneOrNull } from '~/server/utils/postgres'
import { parseAndStringifyJsonbParam } from '~/server/utils/jsonb'
import {
  normalizeProductZoneStructureMapByPreviewFormat,
  normalizeProductZoneStructureVariantMapByPreviewFormat,
  DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT
} from '~/utils/product-zone-structure'
import { ensureProductZoneStructuresTable } from '~/server/utils/product-zone-structures'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `product-zone-structures:put:${user.id}`, 60, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const structuresByPreviewFormat = normalizeProductZoneStructureMapByPreviewFormat(
    body?.structuresByPreviewFormat,
    {},
    body?.structures
  )
  const variantsByPreviewFormat = normalizeProductZoneStructureVariantMapByPreviewFormat(
    body?.variantsByPreviewFormat,
    {},
    structuresByPreviewFormat,
    body?.variants
  )
  const structuresJson = parseAndStringifyJsonbParam({
    structures: structuresByPreviewFormat[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT],
    variants: variantsByPreviewFormat[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT],
    structuresByPreviewFormat,
    variantsByPreviewFormat
  }, 'structures')

  try {
    await ensureProductZoneStructuresTable()
    const row = await pgOneOrNull<{ structures: unknown; updated_at: string | null }>(
      `insert into public.product_zone_structures (user_id, structures, updated_at)
       values ($1, $2::jsonb, timezone('utc', now()))
       on conflict (user_id) do update
         set structures = excluded.structures,
             updated_at = timezone('utc', now())
       returning structures, updated_at`,
      [user.id, structuresJson]
    )

    const stored = row?.structures && typeof row.structures === 'object'
      ? row.structures as Record<string, unknown>
      : null
    const legacyStructures = stored && stored.structures && typeof stored.structures === 'object'
      ? stored.structures
      : row?.structures
    const responseStructuresByPreviewFormat = normalizeProductZoneStructureMapByPreviewFormat(
      stored?.structuresByPreviewFormat,
      {},
      legacyStructures ?? structuresByPreviewFormat[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT]
    )
    const responseVariantsByPreviewFormat = normalizeProductZoneStructureVariantMapByPreviewFormat(
      stored?.variantsByPreviewFormat,
      {},
      responseStructuresByPreviewFormat,
      stored?.structures && typeof stored.structures === 'object'
        ? stored.variants
        : variantsByPreviewFormat[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT]
    )

    return {
      structures: responseStructuresByPreviewFormat[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT],
      variants: responseVariantsByPreviewFormat[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT],
      structuresByPreviewFormat: responseStructuresByPreviewFormat,
      variantsByPreviewFormat: responseVariantsByPreviewFormat,
      updatedAt: row?.updated_at ?? new Date().toISOString()
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || 'Nao foi possivel salvar as estruturas de zonas.'
    })
  }
})
