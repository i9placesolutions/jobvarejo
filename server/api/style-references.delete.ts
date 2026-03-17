import { requireAuthenticatedUser } from '~/server/utils/auth'
import { enforceRateLimit } from '~/server/utils/rate-limit'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `style-refs:delete:${user.id}`, 30, 60_000)

  const body = await readBody(event)
  const id = String(body?.id || '').trim()
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'id obrigatorio.' })
  }

  const result = await pgQuery(
    'DELETE FROM public.style_references WHERE id = $1::uuid AND user_id = $2 RETURNING s3_key',
    [id, user.id]
  )

  if (result.rowCount === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Inspiracao nao encontrada.' })
  }

  return { deleted: true, id }
})
