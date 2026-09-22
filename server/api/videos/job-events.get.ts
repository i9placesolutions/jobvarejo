import { createEventStream } from 'h3'
import { videoUser, ownedVideo } from '../../utils/video-studio/service'
import { videoJobStatus } from '../../utils/video-studio/job-status'
import { enforceRateLimit } from '../../utils/rate-limit'

export default defineEventHandler(async event => {
  const user = await videoUser(event)
  await enforceRateLimit(event, `video-events:${user.id}`, 60, 60_000)
  const project = await ownedVideo(String(getQuery(event).projectId || ''), user.id)
  const stream = createEventStream(event)
  let closed = false, previous = '', ticks = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  stream.onClosed(() => { closed = true; if (timer) clearTimeout(timer) })
  const tick = async () => {
    try {
      const data = JSON.stringify(await videoJobStatus(user.id, project.id))
      if (closed) return
      if (data !== previous) { await stream.push({ event: 'jobs', data }); previous = data }
      else if (++ticks % 10 === 0) await stream.push({ event: 'heartbeat', data: 'ok' })
    } catch { if (!closed) await stream.close(); closed = true }
    if (!closed) timer = setTimeout(tick, 1000)
  }
  void tick()
  return stream.send()
})
