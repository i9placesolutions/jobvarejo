import type { H3Event } from 'h3'
import type { BuilderTenant } from '~/types/builder'
import { requireBuilderTenant } from './builder-auth'
import { pgOneOrNull } from './postgres'

interface CanvaDesignRecord {
  id: string
  tenant_id: string
  title: string | null
  canva_design_id: string
  canva_edit_url: string | null
  canva_view_url: string | null
  folder_id: string | null
  template_id: string | null
  status: string | null
  thumbnail_url: string | null
  created_at: string | null
  updated_at: string | null
}

export interface ResolvedCanvaDesignRoute {
  tenant: BuilderTenant
  routeId: string
  canvaDesignId: string
  localDesign: CanvaDesignRecord | null
}

export const resolveCanvaDesignRoute = async (
  event: H3Event,
  opts: { allowRemoteFallback?: boolean } = {}
): Promise<ResolvedCanvaDesignRoute> => {
  const tenant = await requireBuilderTenant(event)
  const routeId = String(getRouterParam(event, 'id') || '').trim()

  if (!routeId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID do design e obrigatorio',
    })
  }

  const localDesign = await pgOneOrNull<CanvaDesignRecord>(
    `SELECT id, tenant_id, title, canva_design_id, canva_edit_url, canva_view_url,
            folder_id, template_id, status, thumbnail_url, created_at, updated_at
     FROM public.canva_designs
     WHERE tenant_id = $1 AND (id = $2 OR canva_design_id = $2)
     LIMIT 1`,
    [tenant.id, routeId]
  )

  if (localDesign?.canva_design_id) {
    return {
      tenant,
      routeId,
      canvaDesignId: String(localDesign.canva_design_id),
      localDesign,
    }
  }

  if (opts.allowRemoteFallback) {
    return {
      tenant,
      routeId,
      canvaDesignId: routeId,
      localDesign: null,
    }
  }

  throw createError({
    statusCode: 404,
    statusMessage: 'Design nao encontrado',
  })
}
