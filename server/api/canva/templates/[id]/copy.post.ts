// Copiar template para o cliente logado
// Body: { title?, folder_id? }
// 1. Busca template no banco
// 2. Copia design via Canva API
// 3. Salva na tabela canva_designs com tenant_id do cliente

import { requireBuilderTenant } from '../../../../utils/builder-auth'
import { pgOneOrNull } from '../../../../utils/postgres'
import { canvaCopyDesign } from '../../../../utils/canva-client'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  const templateId = getRouterParam(event, 'id')

  if (!templateId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID do template e obrigatorio',
    })
  }

  const body = await readBody(event) || {}

  // Buscar template no banco
  const template = await pgOneOrNull(
    `SELECT id, title, canva_design_id, category
     FROM public.canva_templates
     WHERE id = $1 AND is_active = true`,
    [templateId]
  )

  if (!template) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Template nao encontrado ou inativo',
    })
  }

  const title = String(body.title || template.title).trim()
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

  // Copiar design via Canva API
  const canvaResult = await canvaCopyDesign(template.canva_design_id, title)

  // Salvar na tabela canva_designs
  const design = await pgOneOrNull(
    `INSERT INTO public.canva_designs
       (tenant_id, title, canva_design_id, canva_edit_url, canva_view_url, folder_id, template_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'DRAFT')
     RETURNING id, tenant_id, title, canva_design_id, canva_edit_url, canva_view_url,
               folder_id, template_id, status, created_at, updated_at`,
    [
      tenant.id,
      canvaResult.title,
      canvaResult.design_id,
      canvaResult.edit_url,
      canvaResult.view_url,
      folderId,
      template.id,
    ]
  )

  return { design }
})
