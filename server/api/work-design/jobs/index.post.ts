import { z } from 'zod'
import { workRequestSchema } from '../../../../shared/work-design'
import { requireWorkPilot } from '../../../utils/work-design/access'
import { createWorkJob, publicWorkJob, workDatabaseReady } from '../../../utils/work-design/repository'
export default defineEventHandler(async event => {
  const user = await requireWorkPilot(event)
  if (!await workDatabaseReady()) throw createError({ statusCode: 503, statusMessage: 'A fila experimental aguarda ativação no banco.' })
  const parsed = z.object({ idempotencyKey: z.string().uuid(), request: workRequestSchema }).strict().safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues.map(i => i.message).join('; ').slice(0, 500) })
  return publicWorkJob(await createWorkJob(user.id, parsed.data.request, parsed.data.idempotencyKey))
})
