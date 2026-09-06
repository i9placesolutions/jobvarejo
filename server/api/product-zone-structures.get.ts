import { requireAuthenticatedUser } from '~/server/utils/auth'
import { enforceRateLimit } from '~/server/utils/rate-limit'
import { pgOneOrNull } from '~/server/utils/postgres'
import {
  normalizeProductZoneStructureMapByPreviewFormat,
  normalizeProductZoneStructureVariantMapByPreviewFormat,
  DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT
} from '~/utils/product-zone-structure'
import { ensureProductZoneStructuresTable } from '~/server/utils/product-zone-structures'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `product-zone-structures:get:${user.id}`, 120, 60_000)

  try {
    await ensureProductZoneStructuresTable()
    const row = await pgOneOrNull<{ structures: unknown; updated_at: string | null }>(
      `select structures, updated_at
         from public.product_zone_structures
        where user_id = $1
        limit 1`,
      [user.id]
    )

    const stored = row?.structures && typeof row.structures === 'object'
      ? row.structures as Record<string, unknown>
      : null
    const legacyStructures = stored && stored.structures && typeof stored.structures === 'object'
      ? stored.structures
      : row?.structures
    const structuresByPreviewFormat = normalizeProductZoneStructureMapByPreviewFormat(
      stored?.structuresByPreviewFormat,
      {},
      legacyStructures
    )
    const variantsByPreviewFormat = normalizeProductZoneStructureVariantMapByPreviewFormat(
      stored?.variantsByPreviewFormat,
      {},
      structuresByPreviewFormat,
      stored?.structures && typeof stored.structures === 'object' ? stored.variants : undefined
    )

    return {
      structures: structuresByPreviewFormat[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT],
      variants: variantsByPreviewFormat[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT],
      structuresByPreviewFormat,
      variantsByPreviewFormat,
      updatedAt: row?.updated_at ?? null
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || 'Nao foi possivel carregar as estruturas de zonas.'
    })
  }
})
