// Atualizar design do cliente (mover para pasta, renomear, mudar status)
// Body: { title?, folder_id?, status? }

import { requireBuilderTenant } from '../../../utils/builder-auth'
import { pgOneOrNull } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  const designId = getRouterParam(event, 'id')

  if (!designId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID do design e obrigatorio',
    })
  }

  const body = await readBody(event) || {}

  // Verificar se o design existe e pertence ao tenant
  const existing = await pgOneOrNull(
    `SELECT id FROM public.canva_designs WHERE id = $1 AND tenant_id = $2`,
    [designId, tenant.id]
  )

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Design nao encontrado',
    })
  }

  // Montar campos para atualizar dinamicamente
  const updates: string[] = []
  const params: any[] = []
  let paramIndex = 1

  if (body.title !== undefined) {
    const title = String(body.title).trim()
    if (!title) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Titulo nao pode ser vazio',
      })
    }
    updates.push(`title = $${paramIndex}`)
    params.push(title)
    paramIndex++
  }

  if (body.folder_id !== undefined) {
    const folderId = body.folder_id ? String(body.folder_id) : null

    // Se informou folder_id, verificar se pertence ao tenant
    if (folderId) {
      const folder = await pgOneOrNull(
        `SELECT id FROM public.canva_folders WHERE id = $1 AND tenant_id = $2`,
        [folderId, tenant.id]
      )
      if (!folder) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Pasta nao encontrada',
        })
      }
    }

    updates.push(`folder_id = $${paramIndex}`)
    params.push(folderId)
    paramIndex++
  }

  if (body.status !== undefined) {
    const status = String(body.status).trim().toLowerCase()
    const allowedStatuses = ['draft', 'published', 'archived']
    if (!allowedStatuses.includes(status)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Status invalido. Valores permitidos: ${allowedStatuses.join(', ')}`,
      })
    }
    updates.push(`status = $${paramIndex}`)
    params.push(status)
    paramIndex++
  }

  if (updates.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nenhum campo para atualizar',
    })
  }

  updates.push('updated_at = NOW()')

  // Adicionar designId e tenantId como ultimos parametros
  params.push(designId)
  params.push(tenant.id)

  const design = await pgOneOrNull(
    `UPDATE public.canva_designs
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
     RETURNING id, title, canva_design_id, edit_url, view_url,
               folder_id, template_id, status, thumbnail_url,
               created_at, updated_at`,
    params
  )

  return { design }
})
