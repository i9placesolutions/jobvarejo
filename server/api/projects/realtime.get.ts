import { createEventStream } from 'h3'
import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { subscribeProjectChanges } from '../../utils/project-realtime'

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  enforceRateLimit(event, `projects-realtime:${user.id}`, 60, 60_000)

  const query = getQuery(event)
  const projectId = String(query.id || '').trim()
  const clientId = String(query.client_id || '').trim()

  if (projectId && !isUuid(projectId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid project id format' })
  }

  const stream = createEventStream(event)
  await stream.push({
    event: 'connected',
    data: JSON.stringify({
      ok: true,
      projectId: projectId || null,
      userId: user.id,
      connectedAt: new Date().toISOString()
    })
  })

  const unsubscribe = subscribeProjectChanges((change) => {
    if (change.userId !== user.id) return
    if (projectId && change.projectId !== projectId) return
    if (clientId && change.actorClientId && clientId === change.actorClientId) return

    void stream.push({
      event: 'project-change',
      data: JSON.stringify(change)
    }).catch(() => {
      // no-op, onClosed will handle cleanup
    })
  })

  const heartbeatInterval = setInterval(() => {
    void stream.push({
      event: 'heartbeat',
      data: String(Date.now())
    }).catch(() => {
      // no-op, onClosed will handle cleanup
    })
  }, 10_000)

  stream.onClosed(async () => {
    clearInterval(heartbeatInterval)
    unsubscribe()
    await stream.close()
  })

  return stream.send()
})
