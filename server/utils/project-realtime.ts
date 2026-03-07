import { EventEmitter } from 'node:events'
import type { Notification, PoolClient } from 'pg'
import { getPostgresPool, pgQuery } from './postgres'

export type ProjectChangeAction = 'created' | 'updated' | 'deleted'

export type ProjectChangeEvent = {
  projectId: string
  userId: string
  action: ProjectChangeAction
  updatedAt: string
  actorClientId?: string | null
}

const PROJECT_CHANGES_CHANNEL = 'project_changes'

const projectChangesBus = new EventEmitter()
projectChangesBus.setMaxListeners(250)

let listenerClient: PoolClient | null = null
let listenerStartPromise: Promise<void> | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

const asTrimmedString = (value: unknown): string => String(value || '').trim()

const normalizeProjectChangePayload = (value: unknown): ProjectChangeEvent | null => {
  if (!value || typeof value !== 'object') return null
  const source = value as Record<string, any>
  const projectId = asTrimmedString(source.projectId || source.project_id)
  const userId = asTrimmedString(source.userId || source.user_id)
  const actionRaw = asTrimmedString(source.action)
  const action = (
    actionRaw === 'created' || actionRaw === 'deleted' ? actionRaw : 'updated'
  ) as ProjectChangeAction
  const updatedAt = asTrimmedString(source.updatedAt || source.updated_at) || new Date().toISOString()
  const actorClientId = asTrimmedString(source.actorClientId || source.actor_client_id) || null

  if (!projectId || !userId) return null

  return {
    projectId,
    userId,
    action,
    updatedAt,
    actorClientId
  }
}

const handleNotification = (message: Notification) => {
  if (!message || message.channel !== PROJECT_CHANGES_CHANNEL) return
  const rawPayload = asTrimmedString(message.payload)
  if (!rawPayload) return

  try {
    const parsed = JSON.parse(rawPayload)
    const normalized = normalizeProjectChangePayload(parsed)
    if (!normalized) return
    projectChangesBus.emit('change', normalized)
  } catch {
    // ignore malformed payloads
  }
}

const clearReconnectTimer = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

const releaseListenerClient = async () => {
  const client = listenerClient
  listenerClient = null
  if (!client) return

  try {
    client.removeListener('notification', handleNotification)
    await client.query(`UNLISTEN ${PROJECT_CHANGES_CHANNEL}`)
  } catch {
    // ignore
  }

  try {
    client.release()
  } catch {
    // ignore
  }
}

const scheduleReconnect = () => {
  if (reconnectTimer) return
  if (projectChangesBus.listenerCount('change') <= 0) return

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    void ensureListenerStarted()
  }, 1500)
}

const ensureListenerStarted = async () => {
  if (listenerClient) return
  if (listenerStartPromise) return listenerStartPromise

  listenerStartPromise = (async () => {
    try {
      clearReconnectTimer()
      const pool = getPostgresPool()
      const client = await pool.connect()
      listenerClient = client

      client.on('notification', handleNotification)
      client.on('error', () => {
        void releaseListenerClient().finally(() => {
          scheduleReconnect()
        })
      })

      await client.query(`LISTEN ${PROJECT_CHANGES_CHANNEL}`)
    } catch (error) {
      console.error('[project-realtime] Failed to start LISTEN channel:', error)
      await releaseListenerClient()
      scheduleReconnect()
    } finally {
      listenerStartPromise = null
    }
  })()

  return listenerStartPromise
}

const maybeStopListener = async () => {
  if (projectChangesBus.listenerCount('change') > 0) return
  clearReconnectTimer()
  await releaseListenerClient()
}

export const subscribeProjectChanges = (
  handler: (change: ProjectChangeEvent) => void
): (() => void) => {
  projectChangesBus.on('change', handler)
  void ensureListenerStarted()

  return () => {
    projectChangesBus.off('change', handler)
    void maybeStopListener()
  }
}

export const publishProjectChange = async (change: ProjectChangeEvent): Promise<void> => {
  const payload = normalizeProjectChangePayload(change)
  if (!payload) return
  await pgQuery('select pg_notify($1, $2)', [
    PROJECT_CHANGES_CHANNEL,
    JSON.stringify(payload)
  ])
}
