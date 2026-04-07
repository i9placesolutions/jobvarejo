import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgQuery } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-segments-update:${user.id}`, 60, 60_000)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID obrigatorio' })

  const body = await readBody(event)
  const fields: string[] = []
  const values: any[] = []
  let idx = 1

  const allowedFields = ['name', 'slug', 'icon', 'description', 'is_active', 'sort_order']
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      fields.push(`${field} = $${idx}`)
      values.push(body[field])
      idx++
    }
  }

  if (fields.length === 0) {
    throw createError({ statusCode: 400, message: 'Nenhum campo para atualizar' })
  }

  values.push(id)
  const result = await pgQuery(
    `UPDATE public.builder_segments SET ${fields.join(', ')} WHERE id = $${idx}
     RETURNING id, name, slug, icon, description, is_active, sort_order`,
    values,
  )

  if (result.rows.length === 0) {
    throw createError({ statusCode: 404, message: 'Segmento nao encontrado' })
  }

  return result.rows[0]
})
