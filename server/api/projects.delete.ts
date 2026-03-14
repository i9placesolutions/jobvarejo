import { requireAuthenticatedUser } from '../utils/auth'
import { publishProjectChange } from '../utils/project-realtime'
import { enforceRateLimit } from '../utils/rate-limit'
import { pgOneOrNull } from '../utils/postgres'

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `projects-delete:${user.id}`, 90, 60_000)
  const actorClientId = String(getHeader(event, 'x-client-id') || '').trim() || null

  const query = getQuery(event)
  const queryId = String(query.id || '').trim()
  let bodyId = ''
  if (!queryId) {
    try {
      const body = await readBody<Record<string, any>>(event)
      bodyId = String(body?.id || '').trim()
    } catch {
      bodyId = ''
    }
  }
  const projectId = queryId || bodyId

  if (!projectId || !isUuid(projectId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid project id format' })
  }

  try {
    const row = await pgOneOrNull<{ id: string }>(
      `delete from public.projects
       where id = $1
         and user_id = $2
       returning id`,
      [projectId, user.id]
    )
    if (!row?.id) {
      throw createError({ statusCode: 404, statusMessage: 'Project not found' })
    }

    try {
      await publishProjectChange({
        projectId: String(row.id),
        userId: user.id,
        action: 'deleted',
        updatedAt: new Date().toISOString(),
        actorClientId
      })
    } catch (notifyErr) {
      console.warn('[api/projects:delete] Failed to publish realtime notification:', notifyErr)
    }

    return { success: true }
  } catch (error: any) {
    if (error?.statusCode) throw error
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to delete project' })
  }
})
